-- Customers can edit their equipment details but can no longer remove equipment
-- (status = 'retired') or change its status or restaurant. Only admins can.
-- Run after 20261013_customer_equipment_management.sql.

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

drop trigger if exists trg_equipment_items_customer_guard on public.equipment_items;
create trigger trg_equipment_items_customer_guard
before update on public.equipment_items
for each row execute procedure public.guard_equipment_customer_update();
