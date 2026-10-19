-- Customers manage their own equipment from the mobile app:
-- edit, remove (soft delete via status = 'retired'), and request cleaning.
-- Run after 20261012_customer_app.sql.

-- 1. Restaurant members can update their equipment again ---------------------

drop policy if exists "Admins can update equipment" on public.equipment_items;
drop policy if exists "Equipment updates by restaurant members and admins" on public.equipment_items;
create policy "Equipment updates by restaurant members and admins"
on public.equipment_items
for update
using (public.is_admin() or public.is_restaurant_member(restaurant_id))
with check (public.is_admin() or public.is_restaurant_member(restaurant_id));

-- 2. Keep next_due_at in sync with the last service and the frequency ------------

create or replace function public.set_equipment_next_due()
returns trigger
language plpgsql
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

drop trigger if exists trg_equipment_items_next_due on public.equipment_items;
create trigger trg_equipment_items_next_due
before insert or update on public.equipment_items
for each row execute procedure public.set_equipment_next_due();

-- 3. Cleaning requests ---------------------------------------------------------
-- Reuses the open alert for the item if there is one, otherwise logs a new
-- alert event already in the 'scheduled' state so the admin sees the request.

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

revoke all on function public.request_equipment_service(uuid, timestamptz) from public, anon;
grant execute on function public.request_equipment_service(uuid, timestamptz) to authenticated;
