-- Multi-item consultation requests with optional photos of the installation space.
-- Run after 20261014_admin_only_equipment_status.sql.
--
-- A consultation_leads row is now the request; each requested machine is a
-- consultation_lead_items row. consultation_leads.equipment_type keeps a short
-- summary of the item types so existing lists keep working.

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

create index if not exists idx_lead_items_lead on public.consultation_lead_items (lead_id);

alter table public.consultation_lead_items enable row level security;

create policy "Lead items readable by restaurant members and admins"
on public.consultation_lead_items
for select
using (
  public.is_admin() or exists (
    select 1
    from public.consultation_leads cl
    where cl.id = lead_id
      and public.is_restaurant_member(cl.restaurant_id)
  )
);

create policy "Admins can manage lead items"
on public.consultation_lead_items
for all
using (public.is_admin())
with check (public.is_admin());

-- Customers create a request and all its items in one transaction.
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

  if jsonb_typeof(p_items) <> 'array' then
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
       or (item->>'photo_path' is not null and item->>'photo_path' not like p_restaurant_id::text || '/%')
  ) then
    raise exception 'Each item needs a category and an equipment type';
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

revoke all on function public.create_consultation_request(uuid, jsonb) from public, anon;
grant execute on function public.create_consultation_request(uuid, jsonb) to authenticated;

-- Photos of the installation space. Private bucket; files live under <restaurant_id>/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('consultation-photos', 'consultation-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'])
on conflict (id) do nothing;

create policy "Restaurant members upload consultation photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'consultation-photos'
  and exists (
    select 1
    from public.restaurant_members rm
    where rm.profile_id = auth.uid()
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
    public.is_admin() or exists (
      select 1
      from public.restaurant_members rm
      where rm.profile_id = auth.uid()
        and rm.restaurant_id::text = (storage.foldername(name))[1]
    )
  )
);
