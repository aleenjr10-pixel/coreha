import { useNavigate } from 'react-router'
import { FileText, ShieldCheck } from 'lucide-react'
import { LoadState, PageHeading, StatusLabel } from '../components/ui'
import { formatDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { QuoteRequestRow, QuoteStatus, ReportStatus } from '../lib/types'
import { useQuery } from '../lib/useQuery'

const quoteTone: Record<QuoteStatus, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'setup-pending' },
  sent: { label: 'RFQ sent', tone: 'rfq-sent' },
  received: { label: 'Offers received', tone: 'offers-received' },
  closed: { label: 'Closed', tone: 'active' },
}

const reportTone: Record<ReportStatus, { label: string; tone: string }> = {
  draft: { label: 'Report draft', tone: 'setup-pending' },
  published: { label: 'Published', tone: 'comparison-ready' },
  archived: { label: 'Archived', tone: 'setup-pending' },
}

export function Offers() {
  const navigate = useNavigate()
  const quotes = useQuery(async () => {
    const { data, error } = await supabase
      .from('supplier_quote_requests')
      .select('id, title, lead_id, technical_specifications, status, created_at, restaurants(legal_name), supplier_offers(count), supplier_quote_recipients(count), comparison_reports(id, status, published_at)')
      .order('created_at', { ascending: false })
      .returns<QuoteRequestRow[]>()
    if (error) throw error
    return data
  }, [])

  return (
    <>
      <PageHeading
        eyebrow="SUPPLIER RELATIONSHIPS"
        title="Offer management"
        description="Quote requests sent to suppliers, the offers received, and the comparison published to the customer."
      />

      <section className="offer-inbox">
        <div className="offer-inbox-icon"><FileText size={20} /></div>
        <div>
          <strong>Quote requests are created from purchase requests</strong>
          <span>Open a purchase request and use “Create quote request”. Recording offers and publishing reports come next.</span>
        </div>
      </section>

      <section className="admin-panel directory-panel">
        <LoadState loading={quotes.loading} error={quotes.error} onRetry={quotes.reload} />
        {quotes.data && (
          <div className="table-scroll">
            <table className="admin-table request-table">
              <thead>
                <tr><th>RESTAURANT</th><th>SPECIFICATIONS</th><th>CREATED</th><th>RFQ</th><th>SUPPLIERS</th><th>OFFERS</th><th>COMPARISON</th></tr>
              </thead>
              <tbody>
                {quotes.data.map((quote) => {
                  const report = quote.comparison_reports[0]
                  return (
                    <tr
                      key={quote.id}
                      className={quote.lead_id ? 'clickable-row' : undefined}
                      tabIndex={quote.lead_id ? 0 : undefined}
                      onClick={() => quote.lead_id && navigate(`/requests/${quote.lead_id}`)}
                      onKeyDown={(event) => { if (event.key === 'Enter' && quote.lead_id) navigate(`/requests/${quote.lead_id}`) }}
                    >
                      <td>{quote.restaurants?.legal_name ?? '—'}</td>
                      <td><strong className="product-name cell-note" title={quote.technical_specifications}>{quote.title ?? quote.technical_specifications}</strong></td>
                      <td className="muted-value">{formatDate(quote.created_at)}</td>
                      <td><StatusLabel label={quoteTone[quote.status].label} tone={quoteTone[quote.status].tone} /></td>
                      <td>{quote.supplier_quote_recipients[0]?.count ?? 0}</td>
                      <td>{quote.supplier_offers[0]?.count ?? 0}</td>
                      <td>
                        {report
                          ? <StatusLabel label={reportTone[report.status].label} tone={reportTone[report.status].tone} />
                          : <span className="muted-value">Not started</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {quotes.data.length === 0 && <div className="empty-table">No quote requests yet.</div>}
          </div>
        )}
      </section>

      <article className="offer-guidance" style={{ marginTop: 13 }}>
        <ShieldCheck size={19} />
        <strong>Make the trade-offs clear.</strong>
        <span>Compare price, estimated monthly kWh, materials, warranty, maintenance, advantages, and considerations.</span>
      </article>
    </>
  )
}
