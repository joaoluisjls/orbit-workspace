# Ativação da integração Mercado Livre — TopMix Gestão

## Situação atual
A interface de conectar loja, OAuth com state de uso único, armazenamento restrito de tokens, renovação de token e importação manual da primeira página (até 50 anúncios) estão implementados no código. Não há sincronização automática por webhook, importação completa paginada de pedidos, taxas ou repasses. Não classifique como integração completa até essas rotinas estarem implementadas e testadas.

## Configuração necessária
1. Ativar o banco Lovable Cloud do projeto e aplicar as migrações SQL em ordem.
2. Implantar a Edge Function `ml-oauth` com `verify_jwt = false` (o endpoint GET público valida state de uso único; ações POST validam JWT do usuário).
3. Criar uma aplicação Mercado Livre em https://developers.mercadolivre.com.br/ .
4. Cadastrar **exatamente** a URL HTTPS `https://SEU-PROJETO.supabase.co/functions/v1/ml-oauth` como redirect URI, substituindo pelo endpoint real da função.
5. Configurar **segredos de backend**, nunca variáveis VITE_: `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REDIRECT_URI` (a mesma URL cadastrada) e `TOPMIX_APP_URL` (URL HTTPS exata do app para retorno). `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` devem existir no ambiente da função.
6. Habilitar permissões mínimas para consulta de anúncios e renovação de token; caso habilite PKCE no DevCenter, o fluxo deve ser adaptado antes de ativar.
7. Testar com conta autorizada, primeiro em ambiente de homologação.

## Segurança
Não publicar Client Secret, access tokens, refresh tokens nem service role no repositório. Os tokens ficam em tabela sem políticas de acesso do cliente, acessada exclusivamente pela função com service role. A interface nunca recebe os tokens.

## Próximas etapas
- Paginação e filas de sincronização de anúncios.
- Importação idempotente de pedidos, itens, taxas, envios, reembolsos e repasses conforme disponibilidade oficial.
- Webhooks, reconciliação periódica e alertas.
- Cálculo de lucros com snapshots de custos e kits.
- Testes reais de isolamento entre empresas e OAuth completo.
