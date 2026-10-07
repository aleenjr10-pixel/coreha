create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'admin');
create type public.restaurant_member_role as enum ('owner', 'manager', 'staff');
create type public.equipment_category as enum ('refrigeration', 'dishwasher', 'ice_machine', 'cooking');
create type public.alert_status as enum ('sent', 'acknowledged', 'scheduled', 'resolved');
create type public.lead_status as enum ('new', 'contacted', 'quote_requested', 'closed');
create type public.quote_status as enum ('draft', 'sent', 'received', 'closed');
create type public.report_status as enum ('draft', 'published', 'archived');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  phone text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'customer'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  legal_name text not null,
  cui text,
  address_line_1 text,
  address_line_2 text,
  city text,
  county text,
  country text not null default 'RO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurant_members (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.restaurant_member_role not null default 'manager',
  created_at timestamptz not null default now(),
  unique (restaurant_id, profile_id)
);

create or replace function public.is_restaurant_member(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_members rm
    where rm.restaurant_id = p_restaurant_id
      and rm.profile_id = auth.uid()
  );
$$;

create or replace function public.handle_new_restaurant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.restaurant_members (restaurant_id, profile_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (restaurant_id, profile_id) do nothing;

  return new;
end;
$$;

create trigger on_restaurant_created
after insert on public.restaurants
for each row execute procedure public.handle_new_restaurant();

create table if not exists public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category public.equipment_category not null,
  label text not null,
  maintenance_frequency_days integer not null default 30,
  last_service_at timestamptz,
  next_due_at timestamptz,
  status text not null default 'active' check (status in ('active', 'inactive', 'maintenance', 'retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alert_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  equipment_item_id uuid not null references public.equipment_items(id) on delete cascade,
  status public.alert_status not null default 'sent',
  alert_message text not null,
  delivered_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.consultation_leads (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  equipment_type text not null,
  fuel_source text,
  electrical_supply text,
  capacity_requirement text,
  technical_details text,
  status public.lead_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_quote_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  lead_id uuid references public.consultation_leads(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  technical_specifications text not null,
  status public.quote_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_offers (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.supplier_quote_requests(id) on delete cascade,
  supplier_name text not null,
  model_name text,
  price numeric(12,2),
  estimated_monthly_kwh numeric(10,2),
  warranty_terms text,
  material_durability text,
  maintenance_cost numeric(12,2),
  advantages text,
  disadvantages text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comparison_reports (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.supplier_quote_requests(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  summary text not null,
  recommendation text,
  status public.report_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger trg_restaurants_updated_at
before update on public.restaurants
for each row execute procedure public.set_updated_at();

create trigger trg_equipment_items_updated_at
before update on public.equipment_items
for each row execute procedure public.set_updated_at();

create trigger trg_consultation_leads_updated_at
before update on public.consultation_leads
for each row execute procedure public.set_updated_at();

create trigger trg_supplier_quote_requests_updated_at
before update on public.supplier_quote_requests
for each row execute procedure public.set_updated_at();

create trigger trg_supplier_offers_updated_at
before update on public.supplier_offers
for each row execute procedure public.set_updated_at();

create trigger trg_comparison_reports_updated_at
before update on public.comparison_reports
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.equipment_items enable row level security;
alter table public.alert_events enable row level security;
alter table public.consultation_leads enable row level security;
alter table public.supplier_quote_requests enable row level security;
alter table public.supplier_offers enable row level security;
alter table public.comparison_reports enable row level security;
alter table public.notifications enable row level security;

create policy "Profiles visible to self or admins"
on public.profiles
for select
using (auth.uid() = id or public.is_admin());

create policy "Profiles editable by self or admins"
on public.profiles
for update
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

create policy "Admins can view all restaurants"
on public.restaurants
for select
using (public.is_admin());

create policy "Restaurant owners or members can view their restaurants"
on public.restaurants
for select
using (owner_id = auth.uid() or public.is_restaurant_member(id));

create policy "Restaurant owners can create their own restaurant"
on public.restaurants
for insert
with check (owner_id = auth.uid() or public.is_admin());

create policy "Restaurant owners or admins can update restaurants"
on public.restaurants
for update
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "Admins can view all restaurant members"
on public.restaurant_members
for select
using (public.is_admin());

create policy "Members and owners can view their memberships"
on public.restaurant_members
for select
using (profile_id = auth.uid() or public.is_restaurant_member(restaurant_id));

create policy "Restaurant owners and admins can manage memberships"
on public.restaurant_members
for insert
with check (
  public.is_admin() or
  exists (
    select 1
    from public.restaurants r
    where r.id = restaurant_id and r.owner_id = auth.uid()
  )
);

create policy "Restaurant owners and admins can update memberships"
on public.restaurant_members
for update
using (
  public.is_admin() or
  exists (
    select 1
    from public.restaurants r
    where r.id = restaurant_id and r.owner_id = auth.uid()
  )
)
with check (
  public.is_admin() or
  exists (
    select 1
    from public.restaurants r
    where r.id = restaurant_id and r.owner_id = auth.uid()
  )
);

create policy "Equipment readable by restaurant members and admins"
on public.equipment_items
for select
using (public.is_admin() or public.is_restaurant_member(restaurant_id));

create policy "Equipment editable by restaurant members and admins"
on public.equipment_items
for insert
with check (public.is_admin() or public.is_restaurant_member(restaurant_id));

create policy "Equipment updates by restaurant members and admins"
on public.equipment_items
for update
using (public.is_admin() or public.is_restaurant_member(restaurant_id))
with check (public.is_admin() or public.is_restaurant_member(restaurant_id));

create policy "Alerts readable by restaurant members and admins"
on public.alert_events
for select
using (public.is_admin() or public.is_restaurant_member(restaurant_id));

create policy "Alerts writable by restaurant members and admins"
on public.alert_events
for insert
with check (public.is_admin() or public.is_restaurant_member(restaurant_id));

create policy "Leads readable by restaurant members and admins"
on public.consultation_leads
for select
using (public.is_admin() or public.is_restaurant_member(restaurant_id));

create policy "Leads writable by restaurant members and admins"
on public.consultation_leads
for insert
with check (public.is_admin() or public.is_restaurant_member(restaurant_id));

create policy "Leads editable by restaurant members and admins"
on public.consultation_leads
for update
using (public.is_admin() or public.is_restaurant_member(restaurant_id))
with check (public.is_admin() or public.is_restaurant_member(restaurant_id));

create policy "Quote requests readable by restaurant members and admins"
on public.supplier_quote_requests
for select
using (public.is_admin() or public.is_restaurant_member(restaurant_id));

create policy "Quote requests writable by restaurant members and admins"
on public.supplier_quote_requests
for insert
with check (public.is_admin() or public.is_restaurant_member(restaurant_id));

create policy "Quote requests editable by restaurant members and admins"
on public.supplier_quote_requests
for update
using (public.is_admin() or public.is_restaurant_member(restaurant_id))
with check (public.is_admin() or public.is_restaurant_member(restaurant_id));

create policy "Supplier offers readable by restaurant members and admins"
on public.supplier_offers
for select
using (
  public.is_admin() or
  exists (
    select 1
    from public.supplier_quote_requests sqr
    where sqr.id = quote_request_id
      and public.is_restaurant_member(sqr.restaurant_id)
  )
);

create policy "Supplier offers writable by restaurant members and admins"
on public.supplier_offers
for insert
with check (
  public.is_admin() or
  exists (
    select 1
    from public.supplier_quote_requests sqr
    where sqr.id = quote_request_id
      and public.is_restaurant_member(sqr.restaurant_id)
  )
);

create policy "Comparison reports readable by restaurant members and admins"
on public.comparison_reports
for select
using (
  public.is_admin() or
  exists (
    select 1
    from public.supplier_quote_requests sqr
    where sqr.id = quote_request_id
      and public.is_restaurant_member(sqr.restaurant_id)
  )
);

create policy "Comparison reports writable by restaurant members and admins"
on public.comparison_reports
for insert
with check (
  public.is_admin() or
  exists (
    select 1
    from public.supplier_quote_requests sqr
    where sqr.id = quote_request_id
      and public.is_restaurant_member(sqr.restaurant_id)
  )
);

create policy "Notifications readable by owner or assigned user"
on public.notifications
for select
using (public.is_admin() or user_id = auth.uid() or exists (
  select 1
  from public.restaurant_members rm
  where rm.restaurant_id = notifications.restaurant_id
    and rm.profile_id = auth.uid()
));

create policy "Notifications writable by admin or restaurant members"
on public.notifications
for insert
with check (public.is_admin() or exists (
  select 1
  from public.restaurant_members rm
  where rm.restaurant_id = notifications.restaurant_id
    and rm.profile_id = auth.uid()
));

create index if not exists idx_profiles_role
on public.profiles (role);

create index if not exists idx_restaurants_owner
on public.restaurants (owner_id);

create index if not exists idx_restaurant_members_restaurant
on public.restaurant_members (restaurant_id);

create index if not exists idx_equipment_restaurant
on public.equipment_items (restaurant_id);

create index if not exists idx_alerts_equipment
on public.alert_events (equipment_item_id);

create index if not exists idx_leads_restaurant
on public.consultation_leads (restaurant_id);

create index if not exists idx_quotes_restaurant
on public.supplier_quote_requests (restaurant_id);

create index if not exists idx_offers_quote
on public.supplier_offers (quote_request_id);

create index if not exists idx_reports_quote
on public.comparison_reports (quote_request_id);
