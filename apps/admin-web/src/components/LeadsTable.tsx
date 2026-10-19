import { useState } from 'react'
import { useNavigate } from 'react-router'
import { formatDate } from '../lib/format'
import { errorMessage, supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import type { LeadRow, LeadStatus } from '../lib/types'
import { StatusLabel } from './ui'

// eslint-disable-next-line react-refresh/only-export-components
export const leadSelect =
  'id, equipment_type, fuel_source, electrical_supply, capacity_requirement, technical_details, status, created_at, restaurants(legal_name, city), author:profiles(email, phone), consultation_lead_items(count)'

// eslint-disable-next-line react-refresh/only-export-components
export const leadStatuses: { value: LeadStatus; label: string; tone: string }[] = [
  { value: 'new', label: 'New', tone: 'new' },
  { value: 'contacted', label: 'Contacted', tone: 'rfq-sent' },
  { value: 'quote_requested', label: 'Quote requested', tone: 'offers-received' },
  { value: 'closed', label: 'Closed', tone: 'active' },
]

export function LeadsTable({ rows, onChanged, editable = true }: { rows: LeadRow[]; onChanged: () => void; editable?: boolean }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function changeStatus(lead: LeadRow, status: LeadStatus) {
    setBusyId(lead.id)
    try {
      const { error } = await supabase.from('consultation_leads').update({ status }).eq('id', lead.id)
      if (error) throw error
      const label = leadStatuses.find((item) => item.value === status)?.label ?? status
      toast(`Request for ${lead.equipment_type} moved to ${label}.`)
      onChanged()
    } catch (err) {
      toast(errorMessage(err, 'Unable to update the request.'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="table-scroll">
      <table className="admin-table request-table">
        <thead>
          <tr><th>RESTAURANT</th><th>EQUIPMENT</th><th>ITEMS</th><th>CONTACT</th><th>SUBMITTED</th><th>STATUS</th></tr>
        </thead>
        <tbody>
          {rows.map((lead) => {
            const status = leadStatuses.find((item) => item.value === lead.status) ?? leadStatuses[0]
            const itemCount = lead.consultation_lead_items[0]?.count ?? 0
            // Requests sent before multi-item support keep their details on the lead itself.
            const legacyRequirements = [lead.fuel_source, lead.electrical_supply, lead.capacity_requirement].filter(Boolean).join(' · ')
            const open = () => navigate(`/requests/${lead.id}`)
            return (
              <tr
                key={lead.id}
                className="clickable-row"
                tabIndex={0}
                aria-label={`Open request for ${lead.equipment_type}`}
                onClick={open}
                onKeyDown={(event) => {
                  if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault()
                    open()
                  }
                }}
              >
                <td>
                  <div className="business-cell">
                    <span className="business-avatar compact-avatar">{lead.restaurants?.legal_name.slice(0, 1) ?? '?'}</span>
                    <span><strong>{lead.restaurants?.legal_name ?? '—'}</strong><small>{lead.restaurants?.city ?? ''}</small></span>
                  </div>
                </td>
                <td>
                  <strong className="product-name">{lead.equipment_type}</strong>
                  {lead.technical_details && <div className="muted-value cell-note" title={lead.technical_details}>{lead.technical_details}</div>}
                </td>
                <td>
                  {itemCount > 0
                    ? <span className="request-count">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
                    : legacyRequirements || <span className="muted-value">—</span>}
                </td>
                <td>
                  {lead.author?.email ?? '—'}
                  {lead.author?.phone && <><br /><span className="muted-value">{lead.author.phone}</span></>}
                </td>
                <td className="muted-value">{formatDate(lead.created_at)}</td>
                <td>
                  {editable ? (
                    <label className="admin-select status-select" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                      <span className="sr-only">Status</span>
                      <select value={lead.status} disabled={busyId === lead.id} onChange={(event) => changeStatus(lead, event.target.value as LeadStatus)}>
                        {leadStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </label>
                  ) : (
                    <StatusLabel label={status.label} tone={status.tone} />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty-table">No purchase requests yet.</div>}
    </div>
  )
}
