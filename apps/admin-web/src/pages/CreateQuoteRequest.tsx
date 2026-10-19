import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Copy, Mail, RefreshCw } from 'lucide-react'
import { LoadState, PageHeading } from '../components/ui'
import { buildRfq, rfqReference } from '../lib/rfq'
import { errorMessage, supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import type { LeadItem, Supplier } from '../lib/types'
import { useQuery } from '../lib/useQuery'

type LeadForQuote = {
  id: string
  equipment_type: string
  fuel_source: string | null
  electrical_supply: string | null
  capacity_requirement: string | null
  technical_details: string | null
  restaurants: { legal_name: string; city: string | null } | null
  consultation_lead_items: LeadItem[]
}

function inDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

// Requests sent before multi-item support have their details on the lead itself.
function legacyItem(lead: LeadForQuote): LeadItem {
  return {
    id: 'legacy',
    position: 0,
    category: 'Echipament',
    equipment_type: lead.equipment_type,
    fuel_source: lead.fuel_source === 'gas' ? 'gas' : lead.fuel_source === 'electric' ? 'electric' : null,
    gas_notes: null,
    electrical_supply: lead.electrical_supply?.startsWith('380') ? '380V' : lead.electrical_supply?.startsWith('220') ? '220V' : null,
    capacity_requirement: [lead.capacity_requirement, lead.technical_details].filter(Boolean).join(' – ') || null,
    photo_path: null,
  }
}

export function CreateQuoteRequest() {
  const { id = '' } = useParams()

  const data = useQuery(async () => {
    const [leadResult, suppliersResult] = await Promise.all([
      supabase
        .from('consultation_leads')
        .select('id, equipment_type, fuel_source, electrical_supply, capacity_requirement, technical_details, restaurants(legal_name, city), consultation_lead_items(id, position, category, equipment_type, fuel_source, gas_notes, electrical_supply, capacity_requirement, photo_path)')
        .eq('id', id)
        .order('position', { referencedTable: 'consultation_lead_items' })
        .maybeSingle<LeadForQuote>(),
      supabase
        .from('suppliers')
        .select('id, name, contact_name, email, phone, categories, notes, is_active')
        .eq('is_active', true)
        .order('name')
        .returns<Supplier[]>(),
    ])
    if (leadResult.error) throw leadResult.error
    if (suppliersResult.error) throw suppliersResult.error
    if (!leadResult.data) throw new Error('Request not found.')
    return { lead: leadResult.data, suppliers: suppliersResult.data }
  }, [id])

  const backLink = <Link className="admin-text-button back-link" to={`/requests/${id}`}><ArrowLeft size={14} /> Back to request</Link>

  if (!data.data) {
    return (
      <>
        {backLink}
        <LoadState loading={data.loading} error={data.error} onRetry={data.reload} />
      </>
    )
  }

  return (
    <>
      {backLink}
      <QuoteForm lead={data.data.lead} suppliers={data.data.suppliers} />
    </>
  )
}

function QuoteForm({ lead, suppliers }: { lead: LeadForQuote; suppliers: Supplier[] }) {
  const toast = useToast()
  const navigate = useNavigate()
  const isLegacy = lead.consultation_lead_items.length === 0
  const allItems = useMemo(() => (isLegacy ? [legacyItem(lead)] : lead.consultation_lead_items), [isLegacy, lead])

  const [itemIds, setItemIds] = useState<string[]>(() => allItems.map((item) => item.id))
  const selectedItems = allItems.filter((item) => itemIds.includes(item.id))
  const selectedCategories = new Set(selectedItems.map((item) => item.category))

  const matches = (supplier: Supplier) => supplier.categories.some((category) => selectedCategories.has(category))
  const sortedSuppliers = [...suppliers].sort((a, b) => Number(matches(b)) - Number(matches(a)) || a.name.localeCompare(b.name))

  const [supplierIds, setSupplierIds] = useState<string[]>(() => {
    const categories = new Set(allItems.map((item) => item.category))
    return suppliers.filter((supplier) => supplier.email && supplier.categories.some((category) => categories.has(category))).map((supplier) => supplier.id)
  })
  const [responseDue, setResponseDue] = useState(() => inDays(5))
  const [notes, setNotes] = useState('')
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const generated = buildRfq({ leadId: lead.id, items: selectedItems, city: lead.restaurants?.city ?? null, responseDue, notes })
  // The text follows the selections until the admin edits it by hand.
  const subject = draft?.subject ?? generated.subject
  const body = draft?.body ?? generated.body

  const selectedSuppliers = suppliers.filter((supplier) => supplierIds.includes(supplier.id))
  const missingEmail = selectedSuppliers.filter((supplier) => !supplier.email)
  const canSave = selectedItems.length > 0 && selectedSuppliers.length > 0 && body.trim().length > 0 && !saving

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value])
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`)
      toast('Quote request text copied.')
    } catch {
      toast('Unable to copy. Select the text and copy it manually.', 'error')
    }
  }

  async function save() {
    setSaving(true)
    try {
      const { error } = await supabase.rpc('create_supplier_quote_request', {
        p_lead_id: lead.id,
        p_item_ids: isLegacy ? [] : itemIds,
        p_supplier_ids: supplierIds,
        p_title: subject,
        p_specifications: body,
        p_response_due: responseDue,
      })
      if (error) throw error

      const emails = selectedSuppliers.map((supplier) => supplier.email).filter(Boolean).join(',')
      if (emails) {
        window.location.assign(`mailto:?bcc=${encodeURIComponent(emails)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
      }
      toast(`Quote request ${rfqReference(lead.id)} saved for ${selectedSuppliers.length} ${selectedSuppliers.length === 1 ? 'supplier' : 'suppliers'}.`)
      navigate(`/requests/${lead.id}`)
    } catch (err) {
      toast(errorMessage(err, 'Unable to save the quote request.'), 'error')
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeading
        eyebrow={`QUOTE REQUEST · ${rfqReference(lead.id)}`}
        title="Request supplier offers"
        description={`For ${lead.restaurants?.legal_name ?? 'the restaurant'}. Suppliers only see the equipment and the delivery city, not the restaurant's name.`}
      />

      <div className="rfq-layout">
        <div className="rfq-column">
          <section className="admin-panel rfq-section">
            <div className="admin-section-kicker">1 · EQUIPMENT</div>
            <h2>What to quote</h2>
            {allItems.map((item) => (
              <label key={item.id} className="rfq-option">
                <input type="checkbox" checked={itemIds.includes(item.id)} onChange={() => toggle(itemIds, item.id, setItemIds)} disabled={isLegacy} />
                <span>
                  <strong>{item.equipment_type}</strong>
                  <small>{item.category}{item.capacity_requirement ? ` · ${item.capacity_requirement}` : ''}</small>
                </span>
              </label>
            ))}
          </section>

          <section className="admin-panel rfq-section">
            <div className="admin-section-kicker">2 · SUPPLIERS</div>
            <h2>Who receives it ({selectedSuppliers.length})</h2>
            {suppliers.length === 0 ? (
              <p className="rfq-empty">No active suppliers. <Link to="/suppliers">Add suppliers</Link> first.</p>
            ) : (
              sortedSuppliers.map((supplier) => (
                <label key={supplier.id} className="rfq-option">
                  <input type="checkbox" checked={supplierIds.includes(supplier.id)} onChange={() => toggle(supplierIds, supplier.id, setSupplierIds)} />
                  <span>
                    <strong>
                      {supplier.name}
                      {matches(supplier) && <em className="rfq-match">Matches category</em>}
                    </strong>
                    <small>{supplier.email || 'No email — add one on the Suppliers page'}</small>
                  </span>
                </label>
              ))
            )}
          </section>

          <section className="admin-panel rfq-section">
            <div className="admin-section-kicker">3 · DETAILS</div>
            <h2>Deadline and notes</h2>
            <label className="rfq-field">Offers due by
              <input type="date" min={inDays(1)} value={responseDue} onChange={(event) => setResponseDue(event.target.value)} />
            </label>
            <label className="rfq-field">Notes for suppliers (optional)
              <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. installation needed, preferred brands" />
            </label>
          </section>
        </div>

        <section className="admin-panel rfq-section rfq-preview">
          <div className="admin-section-head rfq-preview-head">
            <div><div className="admin-section-kicker">4 · PREVIEW</div><h2>Quote request</h2></div>
            {draft && (
              <button className="admin-text-button" type="button" onClick={() => setDraft(null)}>
                <RefreshCw size={13} /> Regenerate
              </button>
            )}
          </div>
          <label className="rfq-field">Subject
            <input value={subject} onChange={(event) => setDraft({ subject: event.target.value, body })} />
          </label>
          <label className="rfq-field">Message
            <textarea rows={22} value={body} onChange={(event) => setDraft({ subject, body: event.target.value })} />
          </label>
          {missingEmail.length > 0 && (
            <div className="login-error">
              {missingEmail.map((supplier) => supplier.name).join(', ')} {missingEmail.length === 1 ? 'has' : 'have'} no email. They will be recorded as contacted, but you need to send it to them yourself.
            </div>
          )}
          <div className="rfq-actions">
            <button className="admin-secondary-button" type="button" onClick={copyText}><Copy size={14} /> Copy text</button>
            <button className="admin-primary-button" type="button" onClick={save} disabled={!canSave}>
              <Mail size={14} /> {saving ? 'Saving…' : 'Save & open email'}
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
