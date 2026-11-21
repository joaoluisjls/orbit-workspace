create table if not exists public.marketplace_oauth_states (
  state text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  return_url text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

grant insert, select, delete on public.marketplace_oauth_states to service_role;
alter table public.marketplace_oauth_states enable row level security;

-- Server-only OAuth state store. No grants for authenticated, so the
-- edge/server function is the only writer and reader.
