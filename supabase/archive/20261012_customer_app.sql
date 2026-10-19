-- Customer mobile app support.
--
-- 1. Lets restaurant users respond to maintenance alerts (confirm / schedule)
--    through a narrow RPC instead of a broad UPDATE policy.
-- 2. Hides draft comparison reports and their offers from customers.
-- 3. Restricts admin-only workflow writes (inventory, alerts, quotes, offers,
--    reports) to admins. Customers keep insert access to consultation leads.

-- 1. Alert responses -------------------------------------------------------

alter table public.alert_events
  add column if not exists scheduled_for timestamptz,
  add column if not exists responded_by uuid references public.profiles(id) on delete set null;

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

revoke all on function public.respond_to_alert(uuid, public.alert_status, timestamptz) from public, anon;
grant execute on function public.respond_to_alert(uuid, public.alert_status, timestamptz) to authenticated;

create policy "Admins can update alerts"
on public.alert_events
for update
using (public.is_admin())
with check (public.is_admin());

-- 2. Published-only reports for customers -----------------------------------

drop policy if exists "Comparison reports readable by restaurant members and admins" on public.comparison_reports;
create policy "Comparison reports readable by restaurant members and admins"
on public.comparison_reports
for select
using (
  public.is_admin() or (
    status = 'published' and exists (
      select 1
      from public.supplier_quote_requests sqr
      where sqr.id = quote_request_id
        and public.is_restaurant_member(sqr.restaurant_id)
    )
  )
);

drop policy if exists "Supplier offers readable by restaurant members and admins" on public.supplier_offers;
create policy "Supplier offers readable by restaurant members and admins"
on public.supplier_offers
for select
using (
  public.is_admin() or exists (
    select 1
    from public.supplier_quote_requests sqr
    join public.comparison_reports cr on cr.quote_request_id = sqr.id
    where sqr.id = supplier_offers.quote_request_id
      and cr.status = 'published'
      and public.is_restaurant_member(sqr.restaurant_id)
  )
);

-- 3. Admin-only workflow writes ----------------------------------------------

drop policy if exists "Equipment editable by restaurant members and admins" on public.equipment_items;
create policy "Admins can add equipment"
on public.equipment_items
for insert
with check (public.is_admin());

drop policy if exists "Equipment updates by restaurant members and admins" on public.equipment_items;
create policy "Admins can update equipment"
on public.equipment_items
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Alerts writable by restaurant members and admins" on public.alert_events;
create policy "Admins can create alerts"
on public.alert_events
for insert
with check (public.is_admin());

drop policy if exists "Leads writable by restaurant members and admins" on public.consultation_leads;
create policy "Leads writable by restaurant members and admins"
on public.consultation_leads
for insert
with check (
  public.is_admin() or (
    created_by = auth.uid()
    and status = 'new'
    and public.is_restaurant_member(restaurant_id)
  )
);

drop policy if exists "Leads editable by restaurant members and admins" on public.consultation_leads;
create policy "Admins can update leads"
on public.consultation_leads
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Quote requests writable by restaurant members and admins" on public.supplier_quote_requests;
create policy "Admins can create quote requests"
on public.supplier_quote_requests
for insert
with check (public.is_admin());

drop policy if exists "Quote requests editable by restaurant members and admins" on public.supplier_quote_requests;
create policy "Admins can update quote requests"
on public.supplier_quote_requests
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Supplier offers writable by restaurant members and admins" on public.supplier_offers;
create policy "Admins can add supplier offers"
on public.supplier_offers
for insert
with check (public.is_admin());

drop policy if exists "Comparison reports writable by restaurant members and admins" on public.comparison_reports;
create policy "Admins can create comparison reports"
on public.comparison_reports
for insert
with check (public.is_admin());

create policy "Admins can update comparison reports"
on public.comparison_reports
for update
using (public.is_admin())
with check (public.is_admin());
