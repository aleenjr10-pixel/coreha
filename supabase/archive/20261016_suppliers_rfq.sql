-- Supplier directory and quote requests (RFQ) sent to suppliers from a consultation request.
-- Run after 20261015_consultation_items.sql.

-- 1. Suppliers (admin only) -------------------------------------------------------

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

create trigger trg_suppliers_updated_at
before update on public.suppliers
for each row execute procedure public.set_updated_at();

alter table public.suppliers enable row level security;

create policy "Admins manage suppliers"
on public.suppliers
for all
using (public.is_admin())
with check (public.is_admin());

-- 2. Quote request details and recipients ------------------------------------------

alter table public.supplier_quote_requests
  add column if not exists title text,
  add column if not exists response_due date,
  add column if not exists sent_at timestamptz,
  add column if not exists lead_item_ids uuid[] not null default '{}';

create table if not exists public.supplier_quote_recipients (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.supplier_quote_requests(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  status text not null default 'sent' check (status in ('sent', 'replied', 'declined')),
  sent_at timestamptz not null default now(),
  unique (quote_request_id, supplier_id)
);

create index if not exists idx_quote_recipients_quote on public.supplier_quote_recipients (quote_request_id);

alter table public.supplier_quote_recipients enable row level security;

-- Customers never see which suppliers were contacted.
create policy "Admins manage quote recipients"
on public.supplier_quote_recipients
for all
using (public.is_admin())
with check (public.is_admin());

-- 3. Create a quote request with its recipients in one transaction -----------------

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
  v_quote_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can create quote requests';
  end if;

  select * into v_lead from public.consultation_leads where id = p_lead_id;
  if v_lead.id is null then
    raise exception 'Request not found';
  end if;

  if coalesce(array_length(p_supplier_ids, 1), 0) = 0 then
    raise exception 'Choose at least one supplier';
  end if;

  if (select count(*) from public.suppliers where id = any(p_supplier_ids) and is_active) <> array_length(p_supplier_ids, 1) then
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
  select v_quote_id, unnest(p_supplier_ids);

  update public.consultation_leads
  set status = 'quote_requested'
  where id = p_lead_id and status in ('new', 'contacted');

  return v_quote_id;
end;
$$;

revoke all on function public.create_supplier_quote_request(uuid, uuid[], uuid[], text, text, date) from public, anon;
grant execute on function public.create_supplier_quote_request(uuid, uuid[], uuid[], text, text, date) to authenticated;
