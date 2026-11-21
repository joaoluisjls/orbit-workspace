-- TopMix Gestão: isolated Mercado Livre connections
create extension if not exists pgcrypto;
create table if not exists public.companies (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 owner_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists public.company_members (
 company_id uuid not null references public.companies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','member')) default 'owner',
 primary key(company_id,user_id)
);
create or replace function public.is_company_member(cid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.company_members m where m.company_id=cid and m.user_id=(select auth.uid()))
$$;
create or replace function public.create_company(company_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if auth.uid() is null then raise exception 'Login necessário'; end if;
 if length(trim(company_name)) < 2 then raise exception 'Nome inválido'; end if;
 insert into public.companies(name,owner_id) values(trim(company_name),auth.uid()) returning id into cid;
 insert into public.company_members(company_id,user_id,role) values(cid,auth.uid(),'owner');
 return cid;
end $$;
revoke all on function public.create_company(text) from public;
grant execute on function public.create_company(text) to authenticated;
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 title text not null,
 sku text,
 marketplace_item_id text,
 purchase_cost numeric(14,2) check(purchase_cost >= 0),
 packaging_cost numeric(14,2) not null default 0 check(packaging_cost>=0),
 transport_cost numeric(14,2) not null default 0 check(transport_cost>=0),
 created_at timestamptz not null default now(),
 unique(company_id,marketplace_item_id)
);
create table if not exists public.expenses (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 description text not null,
 category text not null default 'other',
 amount numeric(14,2) not null check(amount>=0),
 due_date date, paid_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.marketplace_accounts (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 provider text not null default 'mercadolivre',
 external_account_id text not null,
 nickname text,
 status text not null default 'connected',
 last_sync_at timestamptz,
 created_at timestamptz not null default now(),
 unique(provider,external_account_id)
);
create table if not exists private_placeholder_ignore (id integer);
drop table if exists private_placeholder_ignore;
create schema if not exists private;
create table if not exists private.marketplace_tokens (
 account_id uuid primary key references public.marketplace_accounts(id) on delete cascade,
 access_token text not null,
 refresh_token text not null,
 expires_at timestamptz not null
);
create table if not exists private.oauth_states (
 state text primary key,
 company_id uuid not null references public.companies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 return_url text not null,
 expires_at timestamptz not null default(now()+interval '10 minutes')
);
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 marketplace_account_id uuid references public.marketplace_accounts(id),
 external_order_id text not null,
 gross_amount numeric(14,2) not null default 0,
 marketplace_fees numeric(14,2),
 shipping_cost numeric(14,2),
 status text not null default 'pending',
 ordered_at timestamptz,
 unique(company_id,external_order_id)
);
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.products enable row level security;
alter table public.expenses enable row level security;
alter table public.marketplace_accounts enable row level security;
alter table public.orders enable row level security;
create policy "companies select" on public.companies for select to authenticated using(public.is_company_member(id));
create policy "companies update" on public.companies for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "members select" on public.company_members for select to authenticated using(public.is_company_member(company_id));
create policy "products tenant" on public.products for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id));
create policy "expenses tenant" on public.expenses for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id));
create policy "marketplace tenant read" on public.marketplace_accounts for select to authenticated using(public.is_company_member(company_id));
create policy "orders tenant read" on public.orders for select to authenticated using(public.is_company_member(company_id));
revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
