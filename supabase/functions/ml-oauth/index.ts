import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"content-type":"application/json"}});
const env=(name:string)=>{const value=Deno.env.get(name);if(!value)throw new Error("Configuração pendente: "+name);return value};
const db=()=>createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});
const redirect=(url:string,success:boolean)=>{const target=new URL(url);target.searchParams.set("ml_connection",success?"success":"error");return Response.redirect(target.toString(),302)};
async function userFor(req:Request){const token=req.headers.get("authorization")?.replace(/^Bearer /i,"");if(!token)throw new Error("Sessão necessária");const {data,error}=await db().auth.getUser(token);if(error||!data.user)throw new Error("Sessão inválida");return data.user};
async function member(companyId:string,userId:string){const {data,error}=await db().from("company_members").select("role").eq("company_id",companyId).eq("user_id",userId).maybeSingle();if(error||!data)throw new Error("Acesso à empresa negado")};
async function tokenRequest(params:Record<string,string>){const body=new URLSearchParams(params);const res=await fetch("https://api.mercadolibre.com/oauth/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded","accept":"application/json"},body});const data=await res.json();if(!res.ok)throw new Error("Falha na autorização do Mercado Livre: "+(data.error||res.status));return data}
async function freshToken(accountId:string){const admin=db();const {data:creds,error}=await admin.from("marketplace_credentials").select("*").eq("account_id",accountId).single();if(error||!creds)throw new Error("Credenciais indisponíveis");if(Date.parse(creds.expires_at)>Date.now()+60000)return creds.access_token;const next=await tokenRequest({grant_type:"refresh_token",client_id:env("ML_CLIENT_ID"),client_secret:env("ML_CLIENT_SECRET"),refresh_token:creds.refresh_token});const {error:saveError}=await admin.from("marketplace_credentials").update({access_token:next.access_token,refresh_token:next.refresh_token,expires_at:new Date(Date.now()+next.expires_in*1000).toISOString()}).eq("account_id",accountId);if(saveError)throw saveError;return next.access_token}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 try{
  const url=new URL(req.url);
  if(req.method==="GET"){
   const state=url.searchParams.get("state"),code=url.searchParams.get("code");
   if(!state)return json({error:"Estado OAuth ausente"},400);
   const admin=db();const {data:entry,error}=await admin.from("marketplace_oauth_states").delete().eq("state",state).select("*").maybeSingle();
   if(error||!entry||Date.parse(entry.expires_at)<Date.now())return json({error:"Autorização expirada ou inválida"},400);
   if(!code)return redirect(entry.return_url,false);
   const tokens=await tokenRequest({grant_type:"authorization_code",client_id:env("ML_CLIENT_ID"),client_secret:env("ML_CLIENT_SECRET"),code,redirect_uri:env("ML_REDIRECT_URI")});
   const profileResponse=await fetch("https://api.mercadolibre.com/users/me",{headers:{authorization:"Bearer "+tokens.access_token}});
   if(!profileResponse.ok)throw new Error("Não foi possível identificar a loja");
   const profile=await profileResponse.json();const externalId=String(profile.id);
   const {data:existing}=await admin.from("marketplace_accounts").select("id,company_id").eq("provider","mercadolivre").eq("external_account_id",externalId).maybeSingle();
   if(existing&&existing.company_id!==entry.company_id)throw new Error("Esta loja já está vinculada a outra empresa");
   const {data:account,error:upsertError}=await admin.from("marketplace_accounts").upsert({id:existing?.id,company_id:entry.company_id,provider:"mercadolivre",external_account_id:externalId,nickname:profile.nickname||externalId,status:"connected"},{onConflict:"provider,external_account_id"}).select("id").single();
   if(upsertError||!account)throw upsertError||new Error("Falha ao salvar conexão");
   const {error:saveError}=await admin.from("marketplace_credentials").upsert({account_id:account.id,access_token:tokens.access_token,refresh_token:tokens.refresh_token,expires_at:new Date(Date.now()+tokens.expires_in*1000).toISOString()});
   if(saveError)throw saveError;
   return redirect(entry.return_url,true);
  }
  if(req.method!=="POST")return json({error:"Método inválido"},405);
  const user=await userFor(req);const body=await req.json();const companyId=body.company_id;
  if(!companyId)return json({error:"Empresa não informada"},400);
  await member(companyId,user.id);const admin=db();
  if(body.action==="start"){
   const state=crypto.randomUUID()+crypto.randomUUID();const returnUrl=env("TOPMIX_APP_URL");
   const {error}=await admin.from("marketplace_oauth_states").insert({state,company_id:companyId,user_id:user.id,return_url:returnUrl});if(error)throw error;
   const target=new URL("https://auth.mercadolivre.com.br/authorization");target.searchParams.set("response_type","code");target.searchParams.set("client_id",env("ML_CLIENT_ID"));target.searchParams.set("redirect_uri",env("ML_REDIRECT_URI"));target.searchParams.set("state",state);
   return json({url:target.toString()});
  }
  if(body.action==="status"){
   const {data,error}=await admin.from("marketplace_accounts").select("id,nickname,status,last_sync_at").eq("company_id",companyId).eq("provider","mercadolivre");if(error)throw error;return json({accounts:data||[]});
  }
  if(body.action==="disconnect"){
   const {data:account}=await admin.from("marketplace_accounts").select("id").eq("company_id",companyId).eq("id",body.account_id).maybeSingle();if(!account)return json({error:"Conta não encontrada"},404);
   await admin.from("marketplace_credentials").delete().eq("account_id",account.id);await admin.from("marketplace_accounts").update({status:"disconnected"}).eq("id",account.id);return json({ok:true});
  }
  if(body.action==="sync"){
   const {data:account}=await admin.from("marketplace_accounts").select("id,external_account_id").eq("company_id",companyId).eq("id",body.account_id).eq("status","connected").maybeSingle();if(!account)return json({error:"Conta não conectada"},404);
   const token=await freshToken(account.id);let imported=0;
   // Bounded first page; repeatable by external item id. Full pagination and background sync are next stage.
   const response=await fetch("https://api.mercadolibre.com/users/"+encodeURIComponent(account.external_account_id)+"/items/search?limit=50",{headers:{authorization:"Bearer "+token}});
   if(!response.ok)throw new Error("Falha ao consultar anúncios: HTTP "+response.status);
   const listing=await response.json();
   for(const itemId of listing.results||[]){
    const itemResponse=await fetch("https://api.mercadolibre.com/items/"+encodeURIComponent(itemId),{headers:{authorization:"Bearer "+token}});
    if(!itemResponse.ok)continue;
    const item=await itemResponse.json();
    const {error}=await admin.from("products").upsert({company_id:companyId,marketplace_item_id:String(item.id),title:item.title||String(item.id),sku:item.seller_custom_field||null},{onConflict:"company_id,marketplace_item_id",ignoreDuplicates:false});
    if(!error)imported++;
   }
   await admin.from("marketplace_accounts").update({last_sync_at:new Date().toISOString()}).eq("id",account.id);
   return json({ok:true,imported,partial:!!listing.paging&&listing.paging.total>50});
  }
  return json({error:"Ação desconhecida"},400);
 }catch(e){console.error("Mercado Livre integration error",e instanceof Error?e.message:"unknown");return json({error:e instanceof Error?e.message:"Erro inesperado"},400)}
});
