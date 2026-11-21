# Ativação da integração Mercado Livre — TopMix Gestão

## Situação atual
A interface de conectar loja, OAuth com `state` de uso único, armazenamento restrito de tokens,
renovação de token, importação de anúncios (primeira página, até 50 itens) e importação básica de
pedidos reais estão implementadas. Não há ainda sincronização automática por webhook nem importação
completa paginada de taxas/envios/repasses. Não classifique como integração completa até essas
rotinas estarem implementadas e testadas.

O backend de integração agora vive em **dois locais equivalentes**:

1. `src/server/marketplace-ml-oauth.server.ts` — publicado pelo próprio app no Lovable Cloud em
   `https://<app>/.server/marketplace/ml-oauth` (rotas por arquivo do TanStack Start). É o
   caminho primário; a interface usa fetch direto, sem "functions" runtime.
2. `supabase/functions/ml-oauth/index.ts` — Edge Function Supabase (fallback legado no GitHub),
   publicada pelo workflow `.github/workflows/deploy-topmix-backend.yml` em
   `https://<project>.supabase.co/functions/v1/ml-oauth`.

Ambos usam as mesmas tabelas (`marketplace_oauth_states`, `marketplace_accounts`,
`marketplace_tokens`) e a mesma lógica de OAuth; mantenha os dois em sincronia.

## Configuração necessária
1. Ativar o banco Lovable Cloud do projeto e aplicar as migrações SQL em ordem
   (`supabase/migrations/0000_*` e `0001_marketplace_oauth_states.sql`).
2. Publicar o app no Lovable Cloud (a rota `/.server/marketplace/ml-oauth` sai junto com o deploy).
   Se for manter a Edge Function legada, publicar também com `supabase functions deploy ml-oauth --no-verify-jwt`.
3. Criar uma aplicação Mercado Livre em https://developers.mercadolivre.com.br/.
4. Cadastrar como redirect URI a URL HTTPS real do callback, por exemplo
   `https://<app>/.server/marketplace/ml-oauth` (ou `https://<project>.supabase.co/functions/v1/ml-oauth`
   para a legada).
5. No gerenciador de Secrets do Lovable Cloud, configurar **somente as credenciais oficiais
   que estiverem faltando** (server-side, nunca VITE_):
   - `ML_CLIENT_ID` / `ML_CLIENT_SECRET` da aplicação Mercado Livre
   - `ML_REDIRECT_URI` — a mesma URL cadastrada no passo 4
   - `TOPMIX_APP_URL` — URL HTTPS exata do app para onde o usuário retorna após autorizar
   - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem quando o Lovable Cloud está conectado
6. Habilitar permissões mínimas (anúncios, pedidos, renovação de token); não ativar PKCE no
   DevCenter sem adaptar o fluxo.
7. Testar com conta real de homologação antes de usar em produção.

## O que a interface agora mostra
- Status real da loja conectada (nickname, conectada/desconectada, última sincronização).
- Erros específicos de integração (segredos faltantes, loja já vinculada a outra empresa,
  falha na API do Mercado Livre, state expirado).
- Contagem de anúncios e pedidos importados a cada sincronização.

## Segurança
Nunca publicar Client Secret, access tokens, refresh tokens nem service role no repositório.
Os tokens ficam em `marketplace_tokens`, sem grants/policies para `authenticated` — apenas a
camada de servidor (service role) lê e escreve. A interface nunca recebe tokens.

## Próximas etapas
- Paginação completa e fila de sincronização de anúncios.
- Importação idempotente de itens, taxas, envios, reembolsos e repasses conforme disponibilidade oficial.
- Webhooks, reconciliação periódica e alertas.
- Cálculo de lucros com snapshots de custos e kits.
- Testes reais de isolamento entre empresas e do fluxo OAuth completo de ponta a ponta.
