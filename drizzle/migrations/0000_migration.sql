create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, created_at timestamptz not null default now()
);
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name))>0),
  owner_id uuid not null,
  created_at timestamptz not null default now()
);
create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner' check(role in ('owner','admin','member')),
  primary key(company_id,user_id)
);
create table public.marketplace_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null default 'mercadolivre',
  external_account_id text,
  nickname text,
  status text not null default 'disconnected',
  last_sync_at timestamptz,
  unique(company_id,provider)
);
-- server-only token storage (no grants to authenticated)
create table public.marketplace_tokens (
  account_id uuid primary key references public.marketplace_accounts(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null, sku text, marketplace_item_id text,
  price numeric(14,2), sold_quantity integer default 0, available_quantity integer default 0,
  status text, permalink text, thumbnail text,
  purchase_cost numeric(14,2) default 0 check(purchase_cost>=0),
  packaging_cost numeric(14,2) default 0 check(packaging_cost>=0),
  transport_cost numeric(14,2) default 0 check(transport_cost>=0),
  created_at timestamptz default now(),
  unique(company_id,marketplace_item_id)
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  marketplace_account_id uuid references public.marketplace_accounts(id) on delete set null,
  external_order_id text,
  gross_amount numeric(14,2) not null default 0,
  marketplace_fees numeric(14,2),
  shipping_cost numeric(14,2),
  status text not null default 'pending',
  ordered_at timestamptz,
  unique(company_id,external_order_id)
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null check(quantity>0),
  unit_price numeric(14,2) not null,
  unit_cost_snapshot numeric(14,2),
  packaging_snapshot numeric(14,2),
  transport_snapshot numeric(14,2)
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  description text not null, category text not null default 'other',
  amount numeric(14,2) not null check(amount>=0),
  due_date date, paid_at timestamptz, created_at timestamptz default now()
);

grant select, insert, update, delete on public.profiles, public.companies, public.company_members, public.products, public.expenses to authenticated;
grant select on public.marketplace_accounts, public.orders, public.order_items to authenticated;
grant all on public.profiles, public.companies, public.company_members, public.marketplace_accounts, public.marketplace_tokens, public.products, public.orders, public.order_items, public.expenses to service_role;

create or replace function public.is_company_member(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.company_members m where m.company_id=cid and m.user_id=(select auth.uid()));
$$;
create or replace function public.is_company_owner(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.companies c where c.id=cid and c.owner_id=(select auth.uid()));
$$;
create or replace function public.create_company(company_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.companies(name,owner_id) values(company_name,auth.uid()) returning id into cid;
  insert into public.company_members(company_id,user_id,role) values(cid,auth.uid(),'owner');
  return cid;
end; $$;
revoke all on function public.create_company(text) from public;
grant execute on function public.create_company(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.marketplace_accounts enable row level security;
alter table public.marketplace_tokens enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.expenses enable row level security;

create policy "own profile" on public.profiles for all to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy "member reads companies" on public.companies for select to authenticated using(public.is_company_member(id));
create policy "owner updates companies" on public.companies for update to authenticated using(public.is_company_owner(id)) with check(public.is_company_owner(id));
create policy "members read membership" on public.company_members for select to authenticated using(public.is_company_member(company_id));
create policy "owners manage membership" on public.company_members for all to authenticated using(public.is_company_owner(company_id)) with check(public.is_company_owner(company_id));
create policy "members manage products" on public.products for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id));
create policy "members manage expenses" on public.expenses for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id));
create policy "members read marketplace accounts" on public.marketplace_accounts for select to authenticated using(public.is_company_member(company_id));
create policy "members read orders" on public.orders for select to authenticated using(public.is_company_member(company_id));
create policy "members read order items" on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and public.is_company_member(o.company_id)));