// Server-only Mercado Livre OAuth endpoint for Lovable Cloud.
// Lives in the app server so there is no separate "functions" runtime: the client
// already sends the Supabase bearer token (auth-attacher), and the service-role
// admin client writes server-only tables that the browser cannot touch.
//
// Required backend secrets (Lovable Secrets, server-side only):
// - ML_CLIENT_ID / ML_CLIENT_SECRET: official Mercado Livre application credentials
// - ML_REDIRECT_URI: the full HTTPS URL registered in Mercado Livre DevCenter, i.e.
//   https://<seu-app>/.server/marketplace/ml-oauth
// - TOPMIX_APP_URL: HTTPS URL where the user lands after authorization
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type UserLike = { id: string; email?: string | null };

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function missingSecrets(): string[] {
  return ["ML_CLIENT_ID", "ML_CLIENT_SECRET", "ML_REDIRECT_URI", "TOPMIX_APP_URL"].filter(
    (name) => !process.env[name],
  );
}

function admin() {
  // Lazy so the client bundle never ships the service-role key.
  return (async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  })();
}

// The GET callback is the public leg of the OAuth flow: Mercado Livre redirects the
// browser there with ?state&code, so there is no Supabase session yet. Safety comes
// from the one-time, short-lived, per-company state token, not from a JWT.
export const mlOauthGet = requireSupabaseAuth.handler(async () => {
  const request = getRequest();
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(JSON.stringify({ error: "O Mercado Livre negou a autorização: " + error }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (!state) {
    return jsonResponse({ error: "Estado OAuth ausente. Clique em Conectar Mercado Livre para iniciar." }, 400);
  }

  const adminClient = await admin();
  const { data: entry, error: entryError } = await adminClient
    .from("marketplace_oauth_states")
    .delete()
    .eq("state", state)
    .select("*")
    .maybeSingle();
  if (entryError || !entry) {
    return jsonResponse({ error: "Autorização expirada ou inválida. Inicie a conexão novamente." }, 400);
  }

  const returnUrl = entry.return_url;
  if (!code) {
    return Response.redirect(redirectWithFlag(returnUrl, false).toString(), 302);
  }

  try {
    const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env["ML_CLIENT_ID"]!,
        client_secret: process.env["ML_CLIENT_SECRET"]!,
        code,
        redirect_uri: process.env["ML_REDIRECT_URI"]!,
      }),
    });
    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      throw new Error("Falha na troca de código pelo token do Mercado Livre: " + (tokenPayload.error || String(tokenResponse.status)));
    }

    const profileResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { authorization: "Bearer " + tokenPayload.access_token },
    });
    if (!profileResponse.ok) throw new Error("Não foi possível identificar a loja no Mercado Livre (HTTP " + profileResponse.status + ").");
    const profile = (await profileResponse.json()) as { id?: number; nickname?: string };
    const externalId = String(profile.id ?? "");

    const { data: existing } = await adminClient
      .from("marketplace_accounts")
      .select("id,company_id")
      .eq("provider", "mercadolivre")
      .eq("external_account_id", externalId)
      .maybeSingle();
    if (existing && existing.company_id !== entry.company_id) {
      throw new Error("Esta loja já está vinculada a outra empresa. Desconecte-a antes de usar aqui.");
    }

    const { data: account, error: upsertError } = await adminClient
      .from("marketplace_accounts")
      .upsert(
        {
          id: existing?.id,
          company_id: entry.company_id,
          provider: "mercadolivre",
          external_account_id: externalId,
          nickname: profile.nickname || externalId,
          status: "connected",
        },
        { onConflict: "provider,external_account_id" },
      )
      .select("id")
      .single();
    if (upsertError || !account) throw upsertError || new Error("Falha ao salvar a conexão da loja.");

    const { error: tokenError } = await adminClient.from("marketplace_tokens").upsert({
      account_id: account.id,
      access_token: tokenPayload.access_token,
      refresh_token: tokenPayload.refresh_token ?? "",
      expires_at: new Date(Date.now() + (tokenPayload.expires_in ?? 0) * 1000).toISOString(),
    });
    if (tokenError) throw tokenError;

    return Response.redirect(redirectWithFlag(returnUrl, true).toString(), 302);
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Erro inesperado ao concluir a autorização.";
    return Response.redirect(redirectWithFlag(returnUrl, false, detail).toString(), 302);
  }
});

function redirectWithFlag(baseUrl: string, success: boolean, detail?: string): URL {
  const target = new URL(baseUrl);
  target.searchParams.set("ml_connection", success ? "success" : "error");
  if (!success && detail) target.searchParams.set("ml_error", encodeURIComponent(detail));
  return target;
}

export type MlAction = "start" | "status" | "sync" | "disconnect";

// POST actions run with the Supabase session attached by auth-attacher.
export const mlOauthPost = requireSupabaseAuth.handler(async () => {
  const request = getRequest();
  if (request.method !== "POST") return jsonResponse({ error: "Método inválido" }, 405);

  const user = await userFromRequest();
  if (!user.id) return jsonResponse({ error: "Sessão necessária" }, 401);
  const body = (await request.json()) as {
    action?: MlAction;
    company_id?: string;
    account_id?: string;
  };
  const companyId = body.company_id;
  if (!companyId) return jsonResponse({ error: "Empresa não informada" }, 400);

  const adminClient = await admin();
  const { data: membership, error: membershipError } = await adminClient
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return jsonResponse({ error: "Acesso à empresa negado" }, 403);

  const action = body.action;
  if (action === "start") {
    const missing = missingSecrets();
    if (missing.length) {
      return jsonResponse(
        {
          error:
            "Integração Mercado Livre ainda não configurada. No Lovable Cloud, informe os segredos: " +
            missing.join(", ") +
            " (crie o app em developers.mercadolivre.com.br e cadastre a URL de retorno no painel do projeto).",
        },
        503,
      );
    }
    const state = crypto.randomUUID() + crypto.randomUUID();
    const { error: stateError } = await adminClient.from("marketplace_oauth_states").insert({
      state,
      company_id: companyId,
      user_id: user.id,
      return_url: process.env["TOPMIX_APP_URL"]!,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (stateError) throw stateError;

    const target = new URL("https://auth.mercadolivre.com.br/authorization");
    target.searchParams.set("response_type", "code");
    target.searchParams.set("client_id", process.env["ML_CLIENT_ID"]!);
    target.searchParams.set("redirect_uri", process.env["ML_REDIRECT_URI"]!);
    target.searchParams.set("state", state);
    return jsonResponse({ url: target.toString(), state });
  }

  if (action === "status") {
    const { data, error } = await adminClient
      .from("marketplace_accounts")
      .select("id,nickname,status,last_sync_at,external_account_id")
      .eq("company_id", companyId)
      .eq("provider", "mercadolivre");
    if (error) throw error;
    return jsonResponse({ accounts: data || [] });
  }

  if (action === "disconnect") {
    const { data: account } = await adminClient
      .from("marketplace_accounts")
      .select("id")
      .eq("company_id", companyId)
      .eq("id", body.account_id)
      .maybeSingle();
    if (!account) return jsonResponse({ error: "Conta não encontrada" }, 404);
    await adminClient.from("marketplace_tokens").delete().eq("account_id", account.id);
    await adminClient.from("marketplace_accounts").update({ status: "disconnected" }).eq("id", account.id);
    return jsonResponse({ ok: true });
  }

  if (action === "sync") {
    const { data: account } = await adminClient
      .from("marketplace_accounts")
      .select("id,external_account_id")
      .eq("company_id", companyId)
      .eq("id", body.account_id)
      .eq("status", "connected")
      .maybeSingle();
    if (!account?.external_account_id) return jsonResponse({ error: "Conta não conectada" }, 404);

    const token = await freshAccessToken(adminClient, account.id);
    const itemsResponse = await fetch(
      "https://api.mercadolibre.com/users/" + encodeURIComponent(account.external_account_id) + "/items/search?limit=50&sort_criteria:price",
      { headers: { authorization: "Bearer " + token } },
    );
    if (!itemsResponse.ok) throw new Error("Falha ao consultar anúncios no Mercado Livre (HTTP " + itemsResponse.status + ").");
    const listing = (await itemsResponse.json()) as {
      results?: string[];
      paging?: { total?: number };
    };

    let imported = 0;
    for (const itemId of listing.results || []) {
      const itemResponse = await fetch("https://api.mercadolibre.com/items/" + encodeURIComponent(itemId), {
        headers: { authorization: "Bearer " + token },
      });
      if (!itemResponse.ok) continue;
      const item = (await itemResponse.json()) as {
        id?: string;
        title?: string;
        price?: number;
        permalink_base?: string;
        picture_id?: string;
        quantity_available?: number;
        sold_quantity?: number;
        status?: string;
        seller_custom_field?: string;
      };
      const { error: upsertError } = await adminClient.from("products").upsert(
        {
          company_id: companyId,
          marketplace_item_id: String(item.id ?? itemId),
          title: item.title || String(item.id ?? itemId),
          sku: item.seller_custom_field || null,
          price: item.price ?? null,
          permalink: item.permalink_base || null,
          thumbnail: item.picture_id || null,
          available_quantity: item.quantity_available ?? null,
          sold_quantity: item.sold_quantity ?? null,
          status: item.status || null,
        },
        { onConflict: "company_id,marketplace_item_id", ignoreDuplicates: false },
      );
      if (!upsertError) imported++;
    }

    // Real orders for this seller, newest first; upserted idempotently per company.
    let importedOrders = 0;
    const ordersResponse = await fetch(
      "https://api.mercadolibre.com/orders/search?seller_id=" + encodeURIComponent(account.external_account_id) + "&sort_criteria:created_at&order:desc&limit=50",
      { headers: { authorization: "Bearer " + token } },
    );
    if (ordersResponse.ok) {
      const ordersPayload = (await ordersResponse.json()) as { results?: Array<Record<string, unknown>> };
      for (const order of ordersPayload.results || []) {
        const orderId = String(order.id ?? "");
        if (!orderId) continue;
        const grossAmount = Number((order.purchase_price as { value?: number } | undefined)?.value ?? 0);
        const fees = Number((order.marketplace_fee as { value?: number } | undefined)?.value ?? 0);
        const { error: orderError } = await adminClient.from("orders").upsert(
          {
            company_id: companyId,
            marketplace_account_id: account.id,
            external_order_id: orderId,
            gross_amount: grossAmount,
            marketplace_fees: fees,
            status: String(order.status ?? "pending"),
            ordered_at: order.created_at ? new Date(String(order.created_at)).toISOString() : null,
          },
          { onConflict: "company_id,external_order_id", ignoreDuplicates: false },
        );
        if (!orderError) importedOrders++;
      }
    }

    await adminClient.from("marketplace_accounts").update({ last_sync_at: new Date().toISOString() }).eq("id", account.id);
    return jsonResponse({
      ok: true,
      imported,
      importedOrders,
      partial: !!(listing.paging && listing.paging.total > 50),
    });
  }

  return jsonResponse({ error: "Ação desconhecida" }, 400);
});

async function userFromRequest(): Promise<UserLike> {
  const token = getRequest().headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return { id: "" };
  const adminClient = await admin();
  const { data } = await adminClient.auth.getUser(token);
  if (!data.user) return { id: "" };
  return data.user as UserLike;
}

async function freshAccessToken(adminClient: Awaited<ReturnType<typeof admin>>, accountId: string): Promise<string> {
  const { data: creds, error } = await adminClient.from("marketplace_tokens").select("*").eq("account_id", accountId).single();
  if (error || !creds) throw new Error("Credenciais indisponíveis para esta loja. Reconecte o Mercado Livre.");
  if (Date.parse(creds.expires_at) > Date.now() + 60_000) return creds.access_token;

  const missing = ["ML_CLIENT_ID", "ML_CLIENT_SECRET"].filter((name) => !process.env[name]);
  if (missing.length) throw new Error("Não foi possível renovar o token: segredos faltando no backend (" + missing.join(", ") + ").");

  const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env["ML_CLIENT_ID"]!,
      client_secret: process.env["ML_CLIENT_SECRET"]!,
      refresh_token: creds.refresh_token,
    }),
  });
  const next = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!tokenResponse.ok || !next.access_token) {
    throw new Error("Falha ao renovar o token do Mercado Livre: " + (next.error || String(tokenResponse.status)) + ". Reconecte a loja.");
  }
  const { error: saveError } = await adminClient
    .from("marketplace_tokens")
    .update({
      access_token: next.access_token,
      refresh_token: next.refresh_token || creds.refresh_token,
      expires_at: new Date(Date.now() + (next.expires_in ?? 0) * 1000).toISOString(),
    })
    .eq("account_id", accountId);
  if (saveError) throw saveError;
  return next.access_token;
}
