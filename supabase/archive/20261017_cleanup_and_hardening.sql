-- Cleanup and hardening. Brings an existing database to exactly the state of schema.sql.
-- Run after 20261016_suppliers_rfq.sql. Safe to run more than once.
--
-- 1. SECURITY: customers could promote themselves to admin by updating profiles.role.
-- 2. Trigger functions get a fixed search_path (Supabase linter: function_search_path_mutable).
-- 3. RLS policies are rebuilt: one per table and command, with auth.uid()/is_admin() wrapped
--    in (select ...) so they run once per query (Supabase linter: auth_rls_initplan).
--    Behavior changes: customers can no longer insert consultation_leads directly (the app
--    uses create_consultation_request) or insert notifications; admins can now update offers.
-- 4. Indexes for foreign keys used by RLS checks and joins.
-- 5. create_consultation_request reports invalid photo paths clearly;
--    create_supplier_quote_request ignores duplicate supplier ids.
-- 6. maintenance_frequency_days must be positive.

-- 1. Only admins can change roles -------------------------------------------------------

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

-- 2. Fixed search_path for trigger functions --------------------------------------------

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

-- 3. Rebuild RLS policies ------------------------------------------------------------------

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
        'supplier_quote_recipients', 'supplier_offers', 'comparison_reports', 'notifications'
      )
  loop
    execute format('drop policy %I on public.%I', v_policy.policyname, v_policy.tablename);
  end loop;
end;
$$;

drop policy if exists "Restaurant members upload consultation photos" on storage.objects;
drop policy if exists "Restaurant members and admins read consultation photos" on storage.objects;

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

-- 4. Indexes --------------------------------------------------------------------------------

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

-- 5. Clearer RPC validation ------------------------------------------------------------------

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

-- 6. Positive maintenance frequency -----------------------------------------------------------

alter table public.equipment_items drop constraint if exists equipment_items_maintenance_frequency_days_check;
alter table public.equipment_items
  add constraint equipment_items_maintenance_frequency_days_check check (maintenance_frequency_days > 0);
