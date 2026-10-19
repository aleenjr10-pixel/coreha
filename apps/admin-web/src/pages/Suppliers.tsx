import { useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import { LoadState, Modal, PageHeading, StatusLabel } from '../components/ui'
import { consultCategories } from '../lib/categories'
import { errorMessage, supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import type { Supplier } from '../lib/types'
import { useQuery } from '../lib/useQuery'

export function Suppliers() {
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null)

  const suppliers = useQuery(async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name, contact_name, email, phone, categories, notes, is_active')
      .order('name')
      .returns<Supplier[]>()
    if (error) throw error
    return data
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (suppliers.data ?? []).filter((item) =>
      (showInactive || item.is_active)
      && `${item.name} ${item.contact_name ?? ''} ${item.email ?? ''} ${item.categories.join(' ')}`.toLowerCase().includes(query),
    )
  }, [suppliers.data, search, showInactive])

  return (
    <>
      <PageHeading
        eyebrow="SUPPLIER NETWORK"
        title="Suppliers"
        description="Suppliers you send quote requests to. Categories decide which suppliers are suggested for a request."
        action={<button className="admin-primary-button" type="button" onClick={() => setEditing('new')}><Plus size={16} /> Add supplier</button>}
      />

      <section className="admin-panel directory-panel">
        <div className="directory-toolbar">
          <label className="admin-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, contact, email, category" />
          </label>
          <label className="admin-checkbox">
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            Show inactive
          </label>
          <span className="result-count">{filtered.length} suppliers</span>
        </div>
        <LoadState loading={suppliers.loading} error={suppliers.error} onRetry={suppliers.reload} />
        {suppliers.data && (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr><th>SUPPLIER</th><th>EMAIL</th><th>PHONE</th><th>CATEGORIES</th><th>STATUS</th><th /></tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="clickable-row" tabIndex={0} onClick={() => setEditing(item)} onKeyDown={(event) => { if (event.key === 'Enter') setEditing(item) }}>
                    <td>
                      <div className="business-cell">
                        <span className="business-avatar">{item.name.slice(0, 1)}</span>
                        <span><strong>{item.name}</strong><small>{item.contact_name || '—'}</small></span>
                      </div>
                    </td>
                    <td>{item.email || <span className="muted-value">Missing</span>}</td>
                    <td>{item.phone || '—'}</td>
                    <td>
                      <div className="tag-list">
                        {item.categories.length ? item.categories.map((category) => <span key={category} className="tag">{category}</span>) : <span className="muted-value">None</span>}
                      </div>
                    </td>
                    <td>{item.is_active ? <StatusLabel label="Active" /> : <StatusLabel label="Inactive" tone="setup-pending" />}</td>
                    <td><span className="more-button" aria-hidden="true"><Pencil size={14} /></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="empty-table">No suppliers yet. Add the suppliers you work with.</div>}
          </div>
        )}
      </section>

      {editing && (
        <SupplierModal
          supplier={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            suppliers.reload()
          }}
        />
      )}
    </>
  )
}

function SupplierModal({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    contactName: supplier?.contact_name ?? '',
    email: supplier?.email ?? '',
    phone: supplier?.phone ?? '',
    categories: supplier?.categories ?? [],
    notes: supplier?.notes ?? '',
    isActive: supplier?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleCategory(category: string) {
    setForm((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const values = {
      name: form.name.trim(),
      contact_name: form.contactName.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      categories: form.categories,
      notes: form.notes.trim() || null,
      is_active: form.isActive,
    }
    try {
      const { error: saveError } = supplier
        ? await supabase.from('suppliers').update(values).eq('id', supplier.id)
        : await supabase.from('suppliers').insert(values)
      if (saveError) throw saveError
      toast(supplier ? `${values.name} updated.` : `${values.name} added to suppliers.`)
      onSaved()
    } catch (err) {
      setError(errorMessage(err, 'Unable to save the supplier.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      kicker="SUPPLIER NETWORK"
      title={supplier ? 'Edit supplier' : 'Add supplier'}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={supplier ? 'Save changes' : 'Add supplier'}
      submitting={saving}
    >
      <label>Company name
        <input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Horeca Pro SRL" />
      </label>
      <div className="admin-form-grid">
        <label>Contact person
          <input value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} />
        </label>
        <label>Phone
          <input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </label>
      </div>
      <label>Email for quote requests
        <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="oferte@furnizor.ro" />
      </label>
      <fieldset className="checkbox-group">
        <legend>Categories supplied</legend>
        {consultCategories.map((category) => (
          <label key={category} className="admin-checkbox">
            <input type="checkbox" checked={form.categories.includes(category)} onChange={() => toggleCategory(category)} />
            {category}
          </label>
        ))}
      </fieldset>
      <label>Notes
        <input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Brands, delivery area, payment terms" />
      </label>
      <label className="admin-checkbox">
        <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
        Active — suggested for new quote requests
      </label>
      {error && <div className="login-error">{error}</div>}
    </Modal>
  )
}
