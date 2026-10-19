import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, ChevronDown, ImageOff, Send } from 'lucide-react'
import { leadStatuses } from '../components/LeadsTable'
import { LoadState, PageHeading, StatusLabel } from '../components/ui'
import { formatDate } from '../lib/format'
import { errorMessage, supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import type { LeadItem, LeadStatus, Profile, QuoteRecipient, QuoteStatus } from '../lib/types'
import { useQuery } from '../lib/useQuery'

type RequestDetailRow = {
  id: string
  restaurant_id: string
  equipment_type: string
  fuel_source: string | null
  electrical_supply: string | null
  capacity_requirement: string | null
  technical_details: string | null
  status: LeadStatus
  created_at: string
  restaurants: { legal_name: string; city: string | null; cui: string | null } | null
  author: Pick<Profile, 'email' | 'full_name' | 'phone'> | null
  consultation_lead_items: LeadItem[]
}

const fuelLabels = { gas: 'Gaz', electric: 'Electric', none: 'Fără alimentare' } as const
const supplyLabels = { '220V': '220V (Monofazic)', '380V': '380V/400V (Trifazic)' } as const

const PHOTO_URL_SECONDS = 60 * 60

type LeadQuote = {
  id: string
  title: string | null
  status: QuoteStatus
  sent_at: string | null
  response_due: string | null
  created_at: string
  supplier_quote_recipients: QuoteRecipient[]
}

const recipientTone = { sent: 'rfq-sent', replied: 'comparison-ready', declined: 'setup-pending' } as const
const recipientLabel = { sent: 'Sent', replied: 'Replied', declined: 'Declined' } as const

export function RequestDetail() {
  const { id = '' } = useParams()
  const toast = useToast()
  const [updating, setUpdating] = useState(false)
  const [brokenPhotos, setBrokenPhotos] = useState<Record<string, boolean>>({})

  const request = useQuery(async () => {
    const { data, error } = await supabase
      .from('consultation_leads')
      .select(
        'id, restaurant_id, equipment_type, fuel_source, electrical_supply, capacity_requirement, technical_details, status, created_at, restaurants(legal_name, city, cui), author:profiles(email, full_name, phone), consultation_lead_items(id, position, category, equipment_type, fuel_source, gas_notes, electrical_supply, capacity_requirement, photo_path)',
      )
      .eq('id', id)
      .order('position', { referencedTable: 'consultation_lead_items' })
      .maybeSingle<RequestDetailRow>()
    if (error) throw error
    if (!data) throw new Error('Request not found.')

    // Photos are in a private bucket, so each one gets a short-lived signed URL.
    const paths = data.consultation_lead_items.map((item) => item.photo_path).filter((path): path is string => Boolean(path))
    const photoUrls: Record<string, string> = {}
    const photoErrors: Record<string, string> = {}
    if (paths.length) {
      const { data: signed, error: signError } = await supabase.storage.from('consultation-photos').createSignedUrls(paths, PHOTO_URL_SECONDS)
      if (signError) {
        for (const path of paths) photoErrors[path] = signError.message
      } else {
        signed.forEach((entry, index) => {
          const path = entry.path ?? paths[index]
          if (entry.signedUrl) photoUrls[path] = entry.signedUrl
          else photoErrors[path] = entry.error ?? 'Photo not found in storage.'
        })
      }
    }
    return { ...data, photoUrls, photoErrors }
  }, [id])

  const quotes = useQuery(async () => {
    const { data, error } = await supabase
      .from('supplier_quote_requests')
      .select('id, title, status, sent_at, response_due, created_at, supplier_quote_recipients(id, status, sent_at, suppliers(name, email))')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .returns<LeadQuote[]>()
    if (error) throw error
    return data
  }, [id])

  async function changeStatus(status: LeadStatus) {
    setUpdating(true)
    try {
      const { error } = await supabase.from('consultation_leads').update({ status }).eq('id', id)
      if (error) throw error
      toast(`Request moved to ${leadStatuses.find((item) => item.value === status)?.label ?? status}.`)
      await request.reload()
    } catch (err) {
      toast(errorMessage(err, 'Unable to update the request.'), 'error')
    } finally {
      setUpdating(false)
    }
  }

  const backLink = <Link className="admin-text-button back-link" to="/requests"><ArrowLeft size={14} /> All purchase requests</Link>

  if (!request.data) {
    return (
      <>
        {backLink}
        <LoadState loading={request.loading} error={request.error} onRetry={request.reload} />
      </>
    )
  }

  const lead = request.data
  const items = lead.consultation_lead_items

  return (
    <>
      {backLink}
      <PageHeading
        eyebrow={`PURCHASE REQUEST · ${formatDate(lead.created_at).toUpperCase()}`}
        title={items.length > 1 ? `${items.length} equipment items` : lead.equipment_type}
        description={`Sent by ${lead.restaurants?.legal_name ?? 'a restaurant'}. Call the customer to confirm the details, then move the request forward.`}
        action={
          <div className="heading-actions">
            <label className="admin-select">
              <span className="sr-only">Status</span>
              <select value={lead.status} disabled={updating} onChange={(event) => changeStatus(event.target.value as LeadStatus)}>
                {leadStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <ChevronDown size={14} />
            </label>
            <Link className="admin-primary-button" to={`/requests/${lead.id}/quote`}><Send size={15} /> Create quote request</Link>
          </div>
        }
      />

      <section className="admin-panel detail-panel">
        <dl className="detail-grid">
          <div>
            <dt>RESTAURANT</dt>
            <dd><Link to={`/restaurants/${lead.restaurant_id}`}>{lead.restaurants?.legal_name ?? '—'}</Link></dd>
          </div>
          <div><dt>CUI · CITY</dt><dd>{[lead.restaurants?.cui, lead.restaurants?.city].filter(Boolean).join(' · ') || '—'}</dd></div>
          <div><dt>CONTACT</dt><dd>{lead.author?.full_name || '—'}</dd></div>
          <div><dt>EMAIL</dt><dd>{lead.author?.email ? <a href={`mailto:${lead.author.email}`}>{lead.author.email}</a> : '—'}</dd></div>
          <div><dt>PHONE</dt><dd>{lead.author?.phone ? <a href={`tel:${lead.author.phone}`}>{lead.author.phone}</a> : '—'}</dd></div>
        </dl>
      </section>

      {items.length === 0 ? (
        // Requests sent before multi-item support.
        <section className="admin-panel detail-panel">
          <dl className="detail-grid">
            <div><dt>EQUIPMENT</dt><dd>{lead.equipment_type}</dd></div>
            <div><dt>FUEL</dt><dd>{lead.fuel_source ?? '—'}</dd></div>
            <div><dt>ELECTRICAL SUPPLY</dt><dd>{lead.electrical_supply ?? '—'}</dd></div>
            <div><dt>CAPACITY</dt><dd>{lead.capacity_requirement ?? '—'}</dd></div>
            <div><dt>DETAILS</dt><dd>{lead.technical_details ?? '—'}</dd></div>
          </dl>
        </section>
      ) : (
        <section className="lead-items">
          {items.map((item, index) => {
            const photoUrl = item.photo_path ? lead.photoUrls[item.photo_path] : null
            const photoError = item.photo_path
              ? lead.photoErrors[item.photo_path] ?? (brokenPhotos[item.photo_path] ? 'The photo file is empty or not a valid image.' : null)
              : null
            return (
              <article key={item.id} className="admin-panel lead-item">
                <div className="lead-item-body">
                  <div className="admin-section-kicker">ITEM {index + 1} · {item.category.toUpperCase()}</div>
                  <h2>{item.equipment_type}</h2>
                  <dl className="detail-grid lead-item-grid">
                    <div><dt>POWER</dt><dd>{item.fuel_source ? fuelLabels[item.fuel_source] : '—'}</dd></div>
                    {item.fuel_source === 'electric' && (
                      <div><dt>ELECTRICAL SUPPLY</dt><dd>{item.electrical_supply ? supplyLabels[item.electrical_supply] : '—'}</dd></div>
                    )}
                    {item.fuel_source === 'gas' && <div><dt>GAS NOTES</dt><dd>{item.gas_notes || '—'}</dd></div>}
                    <div><dt>VOLUME / CAPACITY</dt><dd>{item.capacity_requirement || '—'}</dd></div>
                  </dl>
                </div>
                <div className="lead-item-photo">
                  {photoError ? (
                    <span className="lead-item-no-photo lead-item-photo-error"><ImageOff size={18} />Photo unavailable: {photoError}</span>
                  ) : photoUrl ? (
                    <a href={photoUrl} target="_blank" rel="noreferrer" title="Open full size">
                      <img
                        src={photoUrl}
                        alt={`Kitchen space for ${item.equipment_type}`}
                        onError={() => setBrokenPhotos((current) => ({ ...current, [item.photo_path as string]: true }))}
                      />
                    </a>
                  ) : (
                    <span className="lead-item-no-photo"><ImageOff size={18} />No photo</span>
                  )}
                </div>
              </article>
            )
          })}
        </section>
      )}

      <section className="admin-panel">
        <div className="admin-section-head">
          <div><div className="admin-section-kicker">SUPPLIER OUTREACH</div><h2>Quote requests ({quotes.data?.length ?? '–'})</h2></div>
        </div>
        <LoadState loading={quotes.loading} error={quotes.error} onRetry={quotes.reload} />
        {quotes.data && quotes.data.length === 0 && (
          <div className="empty-table">No quote requests yet. Use “Create quote request” to contact suppliers.</div>
        )}
        {quotes.data?.map((quote) => (
          <div key={quote.id} className="quote-block">
            <div className="quote-block-head">
              <strong>{quote.title ?? 'Quote request'}</strong>
              <span className="muted-value">
                Sent {formatDate(quote.sent_at ?? quote.created_at)}{quote.response_due ? ` · offers due ${formatDate(quote.response_due)}` : ''}
              </span>
            </div>
            <div className="tag-list">
              {quote.supplier_quote_recipients.map((recipient) => (
                <span key={recipient.id} className="quote-recipient">
                  {recipient.suppliers?.name ?? 'Supplier'}
                  <StatusLabel label={recipientLabel[recipient.status]} tone={recipientTone[recipient.status]} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  )
}
