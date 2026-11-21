-- Backend-only tables: service role access, no browser policies.
create table if not exists public.marketplace_credentials (
 account_id uuid primary key references public.marketplace_accounts(id) on delete cascade,
 access_token text not null,
 refresh_token text not null,
 expires_at timestamptz not null
);
create table if not exists public.marketplace_oauth_states (
 state text primary key,
 company_id uuid not null references public.companies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 return_url text not null,
 expires_at timestamptz not null default(now()+interval '10 minutes')
);
alter table public.marketplace_credentials enable row level security;
alter table public.marketplace_oauth_states enable row level security;
revoke all on public.marketplace_credentials, public.marketplace_oauth_states from anon, authenticated;
