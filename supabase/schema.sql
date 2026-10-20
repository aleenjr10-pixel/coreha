-- CoreHa database: the single script that defines the whole database.
--
-- Run it in the Supabase SQL editor for a NEW project or for an EXISTING one.
-- Every statement is idempotent, so it is safe to run again at any time: it never drops
-- tables or data, it only creates what is missing and replaces functions, triggers and
-- policies with the versions below. It runs in one transaction: all or nothing.
--
-- To change the database, edit this file (keeping it idempotent) and run it again.

begin;

create extension if not exists pgcrypto;

-- pg_net sends push notifications over HTTP; pg_cron runs the daily due-date check.
-- Both ship with Supabase; they are skipped where unavailable (e.g. a plain local Postgres).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
end;
$$;

-- Types ----------------------------------------------------------------------------

do $$ begin
  create type public.app_role as enum ('customer', 'admin');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.restaurant_member_role as enum ('owner', 'manager', 'staff');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.equipment_category as enum ('refrigeration', 'dishwasher', 'ice_machine', 'cooking');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.alert_status as enum ('sent', 'acknowledged', 'scheduled', 'resolved');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.lead_status as enum ('new', 'contacted', 'quote_requested', 'closed');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.quote_status as enum ('draft', 'sent', 'received', 'closed');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.report_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles and roles ----------------------------------------------------------------

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

-- Every new auth user gets a customer profile. Admins are promoted from the SQL editor.
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Users may edit their own profile, but only admins (or the SQL editor) can change roles.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() and new.role is distinct from old.role then
    raise exception 'Only CoreHa administrators can change roles';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_role_guard on public.profiles;
create trigger trg_profiles_role_guard
before update on public.profiles
for each row execute procedure public.guard_profile_update();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

-- Restaurants ------------------------------------------------------------------------

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

-- The owner becomes a member automatically, so membership checks cover owners too.
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

drop trigger if exists on_restaurant_created on public.restaurants;
create trigger on_restaurant_created
after insert on public.restaurants
for each row execute procedure public.handle_new_restaurant();

drop trigger if exists trg_restaurants_updated_at on public.restaurants;
create trigger trg_restaurants_updated_at
before update on public.restaurants
for each row execute procedure public.set_updated_at();

-- Equipment and maintenance alerts (module 1) -----------------------------------------

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

-- next_due_at follows the last service and the frequency whenever either changes.
create or replace function public.set_equipment_next_due()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.last_service_at is not null and (
    tg_op = 'INSERT' and new.next_due_at is null
    or tg_op = 'UPDATE' and (
      new.maintenance_frequency_days is distinct from old.maintenance_frequency_days
      or new.last_service_at is distinct from old.last_service_at
    )
  ) then
    new.next_due_at = new.last_service_at + make_interval(days => new.maintenance_frequency_days);
  end if;

  return new;
end;
$$;

-- Customers edit their equipment details; only admins retire equipment or move it.
create or replace function public.guard_equipment_customer_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- auth.uid() is null for the SQL editor and service-role calls; RLS already blocks anonymous users.
  if auth.uid() is not null and not public.is_admin() and (
    new.status is distinct from old.status
    or new.restaurant_id is distinct from old.restaurant_id
  ) then
    raise exception 'Only CoreHa administrators can change the status of equipment';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_equipment_items_updated_at on public.equipment_items;
create trigger trg_equipment_items_updated_at
before update on public.equipment_items
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_equipment_items_next_due on public.equipment_items;
create trigger trg_equipment_items_next_due
before insert or update on public.equipment_items
for each row execute procedure public.set_equipment_next_due();

drop trigger if exists trg_equipment_items_customer_guard on public.equipment_items;
create trigger trg_equipment_items_customer_guard
before update on public.equipment_items
for each row execute procedure public.guard_equipment_customer_update();

create table if not exists public.alert_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  equipment_item_id uuid not null references public.equipment_items(id) on delete cascade,
  status public.alert_status not null default 'sent',
  alert_message text not null,
  delivered_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  scheduled_for timestamptz,
  responded_by uuid references public.profiles(id) on delete set null,
  -- Push delivery log: devices reached on the last send, when, how often, and any error.
  push_device_count integer not null default 0,
  push_sent_at timestamptz,
  push_attempts integer not null default 0,
  push_error text,
  created_at timestamptz not null default now()
);

-- Expo push tokens of the phones signed in to the mobile app.
create table if not exists public.push_tokens (
  token text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  platform text check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Consultation requests (module 2) ----------------------------------------------------
-- A consultation_leads row is the request; each requested machine is a
-- consultation_lead_items row. equipment_type on the lead is a short summary of
-- the item types; the other detail columns are only used by older requests.

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

drop trigger if exists trg_consultation_leads_updated_at on public.consultation_leads;
create trigger trg_consultation_leads_updated_at
before update on public.consultation_leads
for each row execute procedure public.set_updated_at();

create table if not exists public.consultation_lead_items (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.consultation_leads(id) on delete cascade,
  position integer not null default 0,
  category text not null,
  equipment_type text not null,
  fuel_source text check (fuel_source in ('gas', 'electric', 'none')),
  gas_notes text,
  electrical_supply text check (electrical_supply in ('220V', '380V')),
  capacity_requirement text,
  photo_path text,
  created_at timestamptz not null default now()
);

-- Suppliers and quote requests (module 3) ---------------------------------------------

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  -- Consultation category labels the supplier covers, e.g. 'Gătire (Cald)'.
  categories text[] not null default '{}',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_suppliers_updated_at on public.suppliers;
create trigger trg_suppliers_updated_at
before update on public.suppliers
for each row execute procedure public.set_updated_at();

create table if not exists public.supplier_quote_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  lead_id uuid references public.consultation_leads(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text,
  technical_specifications text not null,
  status public.quote_status not null default 'draft',
  response_due date,
  sent_at timestamptz,
  lead_item_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_supplier_quote_requests_updated_at on public.supplier_quote_requests;
create trigger trg_supplier_quote_requests_updated_at
before update on public.supplier_quote_requests
for each row execute procedure public.set_updated_at();

create table if not exists public.supplier_quote_recipients (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.supplier_quote_requests(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  status text not null default 'sent' check (status in ('sent', 'replied', 'declined')),
  sent_at timestamptz not null default now(),
  unique (quote_request_id, supplier_id)
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

drop trigger if exists trg_supplier_offers_updated_at on public.supplier_offers;
create trigger trg_supplier_offers_updated_at
before update on public.supplier_offers
for each row execute procedure public.set_updated_at();

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

drop trigger if exists trg_comparison_reports_updated_at on public.comparison_reports;
create trigger trg_comparison_reports_updated_at
before update on public.comparison_reports
for each row execute procedure public.set_updated_at();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Columns and constraints added after the first release ---------------------------------
-- No-ops on a new database; bring older databases up to date.

alter table public.alert_events
  add column if not exists scheduled_for timestamptz,
  add column if not exists responded_by uuid references public.profiles(id) on delete set null,
  add column if not exists push_device_count integer not null default 0,
  add column if not exists push_sent_at timestamptz,
  add column if not exists push_attempts integer not null default 0,
  add column if not exists push_error text;

alter table public.supplier_quote_requests
  add column if not exists title text,
  add column if not exists response_due date,
  add column if not exists sent_at timestamptz,
  add column if not exists lead_item_ids uuid[] not null default '{}';

alter table public.equipment_items drop constraint if exists equipment_items_maintenance_frequency_days_check;
alter table public.equipment_items
  add constraint equipment_items_maintenance_frequency_days_check check (maintenance_frequency_days > 0);

-- RPC functions used by the apps ------------------------------------------------------
-- They run as the table owner, so each one checks access itself.

-- Mobile: confirm or schedule an alert (kept for API compatibility).
create or replace function public.respond_to_alert(
  p_alert_id uuid,
  p_status public.alert_status,
  p_scheduled_for timestamptz default null
)
returns public.alert_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alert public.alert_events;
begin
  select * into v_alert from public.alert_events where id = p_alert_id;

  if v_alert.id is null
     or not (public.is_admin() or public.is_restaurant_member(v_alert.restaurant_id)) then
    raise exception 'Alert not found';
  end if;

  if v_alert.status = 'resolved' then
    raise exception 'This alert is already resolved';
  end if;

  if p_status not in ('acknowledged', 'scheduled') then
    raise exception 'Customers can only acknowledge or schedule an alert';
  end if;

  if p_status = 'scheduled' and p_scheduled_for is null then
    raise exception 'A scheduled date is required';
  end if;

  update public.alert_events
  set status = p_status,
      acknowledged_at = coalesce(acknowledged_at, now()),
      scheduled_for = case when p_status = 'scheduled' then p_scheduled_for else scheduled_for end,
      responded_by = auth.uid()
  where id = p_alert_id
  returning * into v_alert;

  return v_alert;
end;
$$;

-- Mobile: "Request cleaning". Reuses the open alert for the item if there is one,
-- otherwise logs a new alert already in the 'scheduled' state so the admin sees it.
create or replace function public.request_equipment_service(
  p_equipment_id uuid,
  p_scheduled_for timestamptz
)
returns public.alert_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.equipment_items;
  v_alert public.alert_events;
begin
  select * into v_item from public.equipment_items where id = p_equipment_id;

  if v_item.id is null
     or v_item.status = 'retired'
     or not (public.is_admin() or public.is_restaurant_member(v_item.restaurant_id)) then
    raise exception 'Equipment not found';
  end if;

  if p_scheduled_for is null then
    raise exception 'A preferred date is required';
  end if;

  select * into v_alert
  from public.alert_events
  where equipment_item_id = p_equipment_id
    and status <> 'resolved'
  order by delivered_at desc
  limit 1;

  if v_alert.id is not null then
    update public.alert_events
    set status = 'scheduled',
        scheduled_for = p_scheduled_for,
        acknowledged_at = coalesce(acknowledged_at, now()),
        responded_by = auth.uid()
    where id = v_alert.id
    returning * into v_alert;
  else
    insert into public.alert_events (
      restaurant_id, equipment_item_id, status, alert_message,
      acknowledged_at, scheduled_for, responded_by
    )
    values (
      v_item.restaurant_id, v_item.id, 'scheduled',
      'Cleaning requested by the restaurant for ' || v_item.label || '.',
      now(), p_scheduled_for, auth.uid()
    )
    returning * into v_alert;
  end if;

  return v_alert;
end;
$$;

-- Mobile: a consultation request and all its items in one transaction.
create or replace function public.create_consultation_request(
  p_restaurant_id uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_count integer;
  v_summary text;
begin
  if not (public.is_admin() or public.is_restaurant_member(p_restaurant_id)) then
    raise exception 'Restaurant not found';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Items must be a list';
  end if;

  v_count := jsonb_array_length(p_items);
  if v_count < 1 or v_count > 20 then
    raise exception 'A request must contain between 1 and 20 items';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where coalesce(trim(item->>'category'), '') = ''
       or coalesce(trim(item->>'equipment_type'), '') = ''
  ) then
    raise exception 'Each item needs a category and an equipment type';
  end if;

  -- Photos must sit in the restaurant's own storage folder.
  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where nullif(item->>'photo_path', '') is not null
      and item->>'photo_path' not like p_restaurant_id::text || '/%'
  ) then
    raise exception 'Invalid photo for this restaurant';
  end if;

  select left(string_agg(item->>'equipment_type', ', ' order by ordinality), 200)
  into v_summary
  from jsonb_array_elements(p_items) with ordinality as t(item, ordinality);

  insert into public.consultation_leads (restaurant_id, created_by, equipment_type)
  values (p_restaurant_id, auth.uid(), v_summary)
  returning id into v_lead_id;

  insert into public.consultation_lead_items (
    lead_id, position, category, equipment_type, fuel_source, gas_notes,
    electrical_supply, capacity_requirement, photo_path
  )
  select
    v_lead_id,
    ordinality - 1,
    trim(item->>'category'),
    trim(item->>'equipment_type'),
    nullif(item->>'fuel_source', ''),
    nullif(trim(item->>'gas_notes'), ''),
    nullif(item->>'electrical_supply', ''),
    nullif(trim(item->>'capacity_requirement'), ''),
    nullif(item->>'photo_path', '')
  from jsonb_array_elements(p_items) with ordinality as t(item, ordinality);

  return v_lead_id;
end;
$$;

-- Admin: a supplier quote request with its recipients in one transaction.
create or replace function public.create_supplier_quote_request(
  p_lead_id uuid,
  p_item_ids uuid[],
  p_supplier_ids uuid[],
  p_title text,
  p_specifications text,
  p_response_due date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.consultation_leads;
  v_supplier_ids uuid[];
  v_quote_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can create quote requests';
  end if;

  select * into v_lead from public.consultation_leads where id = p_lead_id;
  if v_lead.id is null then
    raise exception 'Request not found';
  end if;

  v_supplier_ids := array(select distinct unnest(p_supplier_ids));
  if coalesce(array_length(v_supplier_ids, 1), 0) = 0 then
    raise exception 'Choose at least one supplier';
  end if;

  if (select count(*) from public.suppliers where id = any(v_supplier_ids) and is_active) <> array_length(v_supplier_ids, 1) then
    raise exception 'One of the selected suppliers does not exist or is inactive';
  end if;

  if coalesce(array_length(p_item_ids, 1), 0) > 0 and (
    select count(*) from public.consultation_lead_items where id = any(p_item_ids) and lead_id = p_lead_id
  ) <> array_length(p_item_ids, 1) then
    raise exception 'One of the selected items does not belong to this request';
  end if;

  if coalesce(trim(p_specifications), '') = '' then
    raise exception 'The quote request text is empty';
  end if;

  insert into public.supplier_quote_requests (
    restaurant_id, lead_id, created_by, technical_specifications, status,
    title, response_due, sent_at, lead_item_ids
  )
  values (
    v_lead.restaurant_id, v_lead.id, auth.uid(), p_specifications, 'sent',
    nullif(trim(p_title), ''), p_response_due, now(), coalesce(p_item_ids, '{}')
  )
  returning id into v_quote_id;

  insert into public.supplier_quote_recipients (quote_request_id, supplier_id)
  select v_quote_id, unnest(v_supplier_ids);

  update public.consultation_leads
  set status = 'quote_requested'
  where id = p_lead_id and status in ('new', 'contacted');

  return v_quote_id;
end;
$$;

revoke all on function public.respond_to_alert(uuid, public.alert_status, timestamptz) from public, anon;
grant execute on function public.respond_to_alert(uuid, public.alert_status, timestamptz) to authenticated;
revoke all on function public.request_equipment_service(uuid, timestamptz) from public, anon;
grant execute on function public.request_equipment_service(uuid, timestamptz) to authenticated;
revoke all on function public.create_consultation_request(uuid, jsonb) from public, anon;
grant execute on function public.create_consultation_request(uuid, jsonb) to authenticated;
revoke all on function public.create_supplier_quote_request(uuid, uuid[], uuid[], text, text, date) from public, anon;
grant execute on function public.create_supplier_quote_request(uuid, uuid[], uuid[], text, text, date) to authenticated;

-- Push notifications and automatic alerts ---------------------------------------------

-- Mobile: remember this phone for the signed-in user (a phone moves to whoever signs in).
create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to enable notifications';
  end if;

  if p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'Invalid push token';
  end if;

  insert into public.push_tokens (token, profile_id, platform)
  values (p_token, auth.uid(), nullif(p_platform, ''))
  on conflict (token) do update
  set profile_id = excluded.profile_id,
      platform = excluded.platform,
      updated_at = now();
end;
$$;

-- Mobile: forget this phone on sign-out.
create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens where token = p_token and profile_id = auth.uid();
$$;

-- Sends the alert to every phone of the restaurant's members through the Expo push service.
-- A push failure never blocks the alert itself: the error is logged on the alert.
create or replace function public.send_alert_push(p_alert_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alert public.alert_events;
  v_label text;
  v_tokens text[];
  v_count integer;
  v_offset integer := 1;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only administrators can send alerts';
  end if;

  select * into v_alert from public.alert_events where id = p_alert_id;
  if v_alert.id is null then
    raise exception 'Alert not found';
  end if;

  select label into v_label from public.equipment_items where id = v_alert.equipment_item_id;

  select array_agg(distinct pt.token) into v_tokens
  from public.push_tokens pt
  join public.restaurant_members rm on rm.profile_id = pt.profile_id
  where rm.restaurant_id = v_alert.restaurant_id;

  v_count := coalesce(array_length(v_tokens, 1), 0);

  if v_count = 0 then
    update public.alert_events
    set push_device_count = 0, push_attempts = push_attempts + 1, push_error = 'No phone registered'
    where id = p_alert_id;
    return 0;
  end if;

  begin
    -- The Expo push API accepts at most 100 messages per request.
    while v_offset <= v_count loop
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := (
          select jsonb_agg(jsonb_build_object(
            'to', token,
            'title', 'Maintenance required: ' || coalesce(v_label, 'equipment'),
            'body', v_alert.alert_message,
            'data', jsonb_build_object('type', 'maintenance_alert', 'alertId', v_alert.id, 'equipmentId', v_alert.equipment_item_id),
            'priority', 'high',
            'channelId', 'critical-alerts',
            'sound', 'default',
            'interruptionLevel', 'time-sensitive',
            'ttl', 86400
          ))
          from unnest(v_tokens[v_offset:v_offset + 99]) as token
        ),
        headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json')
      );
      v_offset := v_offset + 100;
    end loop;

    update public.alert_events
    set push_device_count = v_count, push_sent_at = now(), push_attempts = push_attempts + 1, push_error = null
    where id = p_alert_id;
  exception when others then
    update public.alert_events
    set push_device_count = 0, push_attempts = push_attempts + 1, push_error = left(sqlerrm, 300)
    where id = p_alert_id;
    v_count := 0;
  end;

  return v_count;
end;
$$;

-- Every new maintenance alert goes straight to the restaurant's phones.
create or replace function public.handle_new_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.send_alert_push(new.id);
  return new;
end;
$$;

drop trigger if exists on_alert_created on public.alert_events;
create trigger on_alert_created
after insert on public.alert_events
for each row
when (new.status = 'sent')
execute procedure public.handle_new_alert();

-- Daily check (pg_cron, and the admin's "Run check now"): creates an alert for every active
-- machine due today or overdue that has no open alert, and re-sends the push for alerts
-- still unanswered after a day, so a critical alert keeps coming back until it is handled.
create or replace function public.generate_due_alerts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created integer;
  v_renotified integer := 0;
  v_alert record;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only administrators can run the due-date check';
  end if;

  insert into public.alert_events (restaurant_id, equipment_item_id, alert_message)
  select e.restaurant_id, e.id, 'Equipment ' || e.label || ' requires periodic maintenance.'
  from public.equipment_items e
  where e.status = 'active'
    and e.next_due_at < date_trunc('day', now()) + interval '1 day'
    and not exists (
      select 1 from public.alert_events a
      where a.equipment_item_id = e.id and a.status <> 'resolved'
    );
  get diagnostics v_created = row_count;

  for v_alert in
    select id from public.alert_events
    where status = 'sent'
      and coalesce(push_sent_at, delivered_at) < now() - interval '20 hours'
  loop
    perform public.send_alert_push(v_alert.id);
    v_renotified := v_renotified + 1;
  end loop;

  return jsonb_build_object('created', v_created, 'renotified', v_renotified);
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;
revoke all on function public.send_alert_push(uuid) from public, anon;
grant execute on function public.send_alert_push(uuid) to authenticated;
revoke all on function public.generate_due_alerts() from public, anon;
grant execute on function public.generate_due_alerts() to authenticated;

-- Row level security -------------------------------------------------------------------
-- One policy per table and command. Calls that do not depend on the row are wrapped in
-- (select ...) so Postgres evaluates them once per query instead of once per row.

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.equipment_items enable row level security;
alter table public.alert_events enable row level security;
alter table public.consultation_leads enable row level security;
alter table public.consultation_lead_items enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_quote_requests enable row level security;
alter table public.supplier_quote_recipients enable row level security;
alter table public.supplier_offers enable row level security;
alter table public.comparison_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

-- Existing policies are removed first so this file is the only source of truth.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'restaurants', 'restaurant_members', 'equipment_items', 'alert_events',
        'consultation_leads', 'consultation_lead_items', 'suppliers', 'supplier_quote_requests',
        'supplier_quote_recipients', 'supplier_offers', 'comparison_reports', 'notifications',
        'push_tokens'
      )
  loop
    execute format('drop policy %I on public.%I', v_policy.policyname, v_policy.tablename);
  end loop;
end;
$$;

-- profiles
create policy "Profiles: read own or admin" on public.profiles for select
using (id = (select auth.uid()) or (select public.is_admin()));
create policy "Profiles: update own or admin" on public.profiles for update
using (id = (select auth.uid()) or (select public.is_admin()))
with check (id = (select auth.uid()) or (select public.is_admin()));

-- restaurants
create policy "Restaurants: read as member or admin" on public.restaurants for select
using ((select public.is_admin()) or owner_id = (select auth.uid()) or public.is_restaurant_member(id));
create policy "Restaurants: create own or admin" on public.restaurants for insert
with check (owner_id = (select auth.uid()) or (select public.is_admin()));
create policy "Restaurants: update own or admin" on public.restaurants for update
using (owner_id = (select auth.uid()) or (select public.is_admin()))
with check (owner_id = (select auth.uid()) or (select public.is_admin()));

-- restaurant_members
create policy "Members: read own restaurants or admin" on public.restaurant_members for select
using ((select public.is_admin()) or profile_id = (select auth.uid()) or public.is_restaurant_member(restaurant_id));
create policy "Members: owner or admin adds" on public.restaurant_members for insert
with check (
  (select public.is_admin()) or exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.owner_id = (select auth.uid())
  )
);
create policy "Members: owner or admin updates" on public.restaurant_members for update
using (
  (select public.is_admin()) or exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.owner_id = (select auth.uid())
  )
)
with check (
  (select public.is_admin()) or exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.owner_id = (select auth.uid())
  )
);

-- equipment_items (customer changes to status/restaurant are blocked by trigger)
create policy "Equipment: read as member or admin" on public.equipment_items for select
using ((select public.is_admin()) or public.is_restaurant_member(restaurant_id));
create policy "Equipment: admin adds" on public.equipment_items for insert
with check ((select public.is_admin()));
create policy "Equipment: member or admin updates" on public.equipment_items for update
using ((select public.is_admin()) or public.is_restaurant_member(restaurant_id))
with check ((select public.is_admin()) or public.is_restaurant_member(restaurant_id));

-- alert_events (customers respond through request_equipment_service / respond_to_alert)
create policy "Alerts: read as member or admin" on public.alert_events for select
using ((select public.is_admin()) or public.is_restaurant_member(restaurant_id));
create policy "Alerts: admin creates" on public.alert_events for insert
with check ((select public.is_admin()));
create policy "Alerts: admin updates" on public.alert_events for update
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- consultation_leads (customers create them through create_consultation_request)
create policy "Leads: read as member or admin" on public.consultation_leads for select
using ((select public.is_admin()) or public.is_restaurant_member(restaurant_id));
create policy "Leads: admin creates" on public.consultation_leads for insert
with check ((select public.is_admin()));
create policy "Leads: admin updates" on public.consultation_leads for update
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- consultation_lead_items
create policy "Lead items: read as member or admin" on public.consultation_lead_items for select
using (
  (select public.is_admin()) or exists (
    select 1 from public.consultation_leads cl
    where cl.id = lead_id and public.is_restaurant_member(cl.restaurant_id)
  )
);
create policy "Lead items: admin creates" on public.consultation_lead_items for insert
with check ((select public.is_admin()));
create policy "Lead items: admin updates" on public.consultation_lead_items for update
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Lead items: admin deletes" on public.consultation_lead_items for delete
using ((select public.is_admin()));

-- suppliers and recipients: admin only; customers never see which suppliers were contacted
create policy "Suppliers: admin only" on public.suppliers for all
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Quote recipients: admin only" on public.supplier_quote_recipients for all
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- supplier_quote_requests
create policy "Quote requests: read as member or admin" on public.supplier_quote_requests for select
using ((select public.is_admin()) or public.is_restaurant_member(restaurant_id));
create policy "Quote requests: admin creates" on public.supplier_quote_requests for insert
with check ((select public.is_admin()));
create policy "Quote requests: admin updates" on public.supplier_quote_requests for update
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- supplier_offers: customers only see offers once the comparison is published
create policy "Offers: read published or admin" on public.supplier_offers for select
using (
  (select public.is_admin()) or exists (
    select 1
    from public.supplier_quote_requests sqr
    join public.comparison_reports cr on cr.quote_request_id = sqr.id
    where sqr.id = supplier_offers.quote_request_id
      and cr.status = 'published'
      and public.is_restaurant_member(sqr.restaurant_id)
  )
);
create policy "Offers: admin adds" on public.supplier_offers for insert
with check ((select public.is_admin()));
create policy "Offers: admin updates" on public.supplier_offers for update
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- comparison_reports: customers only see published reports
create policy "Reports: read published or admin" on public.comparison_reports for select
using (
  (select public.is_admin()) or (
    status = 'published' and exists (
      select 1 from public.supplier_quote_requests sqr
      where sqr.id = quote_request_id and public.is_restaurant_member(sqr.restaurant_id)
    )
  )
);
create policy "Reports: admin creates" on public.comparison_reports for insert
with check ((select public.is_admin()));
create policy "Reports: admin updates" on public.comparison_reports for update
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- notifications
create policy "Notifications: read own restaurant or admin" on public.notifications for select
using ((select public.is_admin()) or user_id = (select auth.uid()) or public.is_restaurant_member(restaurant_id));
create policy "Notifications: admin creates" on public.notifications for insert
with check ((select public.is_admin()));

-- push_tokens: written only through register_push_token / unregister_push_token
create policy "Push tokens: read own or admin" on public.push_tokens for select
using (profile_id = (select auth.uid()) or (select public.is_admin()));

-- Indexes -------------------------------------------------------------------------------

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_restaurants_owner on public.restaurants (owner_id);
create index if not exists idx_restaurant_members_restaurant on public.restaurant_members (restaurant_id);
create index if not exists idx_restaurant_members_profile on public.restaurant_members (profile_id);
create index if not exists idx_equipment_restaurant on public.equipment_items (restaurant_id);
create index if not exists idx_alerts_equipment on public.alert_events (equipment_item_id);
create index if not exists idx_alerts_restaurant on public.alert_events (restaurant_id);
create index if not exists idx_leads_restaurant on public.consultation_leads (restaurant_id);
create index if not exists idx_lead_items_lead on public.consultation_lead_items (lead_id);
create index if not exists idx_quotes_restaurant on public.supplier_quote_requests (restaurant_id);
create index if not exists idx_quotes_lead on public.supplier_quote_requests (lead_id);
create index if not exists idx_quote_recipients_quote on public.supplier_quote_recipients (quote_request_id);
create index if not exists idx_quote_recipients_supplier on public.supplier_quote_recipients (supplier_id);
create index if not exists idx_offers_quote on public.supplier_offers (quote_request_id);
create index if not exists idx_reports_quote on public.comparison_reports (quote_request_id);
create index if not exists idx_notifications_restaurant on public.notifications (restaurant_id);
create index if not exists idx_notifications_user on public.notifications (user_id);
create index if not exists idx_push_tokens_profile on public.push_tokens (profile_id);
create index if not exists idx_alerts_open on public.alert_events (equipment_item_id) where status <> 'resolved';

-- Storage: photos of the installation space ---------------------------------------------
-- Private bucket; files live under <restaurant_id>/.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('consultation-photos', 'consultation-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Restaurant members upload consultation photos" on storage.objects;
create policy "Restaurant members upload consultation photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'consultation-photos'
  and exists (
    select 1
    from public.restaurant_members rm
    where rm.profile_id = (select auth.uid())
      and rm.restaurant_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "Restaurant members and admins read consultation photos" on storage.objects;
create policy "Restaurant members and admins read consultation photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'consultation-photos'
  and (
    (select public.is_admin()) or exists (
      select 1
      from public.restaurant_members rm
      where rm.profile_id = (select auth.uid())
        and rm.restaurant_id::text = (storage.foldername(name))[1]
    )
  )
);

-- Daily due-date check at 06:00 UTC (09:00 in Romania in summer, 08:00 in winter).
-- Scheduling under the same name replaces the existing job.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('coreha-due-alerts', '0 6 * * *', 'select public.generate_due_alerts()');
  end if;
end;
$$;

commit;
