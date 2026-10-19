import type { FormEvent, ReactNode } from 'react'
import { statusClass } from '../lib/format'

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="admin-page-heading">
      <div>
        <div className="admin-eyebrow">{eyebrow}</div>
        <h1>{title}<span>.</span></h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

export function StatusLabel({ label, tone }: { label: string; tone?: string }) {
  return <span className={statusClass(tone ?? label)}><i />{label}</span>
}

export function LoadState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry?: () => void }) {
  if (error) {
    return (
      <div className="empty-table load-error">
        {error}
        {onRetry && <button className="admin-text-button" type="button" onClick={onRetry}>Try again</button>}
      </div>
    )
  }
  if (loading) return <div className="empty-table">Loading…</div>
  return null
}

export function Modal({
  kicker,
  title,
  description,
  onClose,
  onSubmit,
  submitLabel,
  submitting,
  children,
}: {
  kicker: string
  title: string
  description?: string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  submitLabel: string
  submitting?: boolean
  children: ReactNode
}) {
  return (
    <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header>
          <div><span className="admin-section-kicker">{kicker}</span><h2 id="modal-title">{title}</h2></div>
          <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>×</button>
        </header>
        {description && <p>{description}</p>}
        <form onSubmit={onSubmit}>
          {children}
          <div className="admin-modal-actions">
            <button type="button" className="admin-secondary-button" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="admin-primary-button" disabled={submitting}>{submitting ? 'Saving…' : submitLabel}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
