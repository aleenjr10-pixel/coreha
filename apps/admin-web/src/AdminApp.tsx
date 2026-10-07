import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Snowflake,
  Utensils,
  Waves,
  Wrench,
} from 'lucide-react'
import './AdminApp.css'

type Section = 'Overview' | 'Restaurants' | 'Equipment' | 'Purchase requests' | 'Supplier offers'
type Restaurant = {
  id: string
  name: string
  cui: string
  city: string
  contact: string
  equipment: number
  requests: number
  status: 'Active' | 'Setup pending'
}
type PurchaseRequest = {
  id: string
  restaurant: string
  city: string
  product: string
  portions: number
  submitted: string
  state: 'New' | 'RFQ sent' | 'Offers received' | 'Comparison ready'
}

const restaurantSeed: Restaurant[] = [
  { id: 'rest-01', name: 'Meridian Kitchen', cui: 'RO 41286015', city: 'Bucharest', contact: 'Andrei Dima', equipment: 14, requests: 2, status: 'Active' },
  { id: 'rest-02', name: 'Casa Verde Bistro', cui: 'RO 38724190', city: 'Cluj-Napoca', contact: 'Ioana Pop', equipment: 9, requests: 1, status: 'Active' },
  { id: 'rest-03', name: 'Atelier 17', cui: 'RO 45819362', city: 'Timișoara', contact: 'Mihai Ionescu', equipment: 21, requests: 0, status: 'Active' },
  { id: 'rest-04', name: 'North Pier Dining', cui: 'RO 30294718', city: 'Constanța', contact: 'Elena Pavel', equipment: 0, requests: 0, status: 'Setup pending' },
  { id: 'rest-05', name: 'Sora Bakery & Kitchen', cui: 'RO 37150644', city: 'Brașov', contact: 'Ana Marinescu', equipment: 12, requests: 1, status: 'Active' },
]

const requestSeed: PurchaseRequest[] = [
  { id: 'CH-240827', restaurant: 'Casa Verde Bistro', city: 'Cluj-Napoca', product: 'Deck oven', portions: 120, submitted: 'Today, 09:42', state: 'New' },
  { id: 'CH-240819', restaurant: 'Sora Bakery & Kitchen', city: 'Brașov', product: 'Spiral mixer', portions: 240, submitted: 'Yesterday', state: 'RFQ sent' },
  { id: 'CH-240815', restaurant: 'Meridian Kitchen', city: 'Bucharest', product: 'Combi oven', portions: 180, submitted: '25 Sept', state: 'Comparison ready' },
  { id: 'CH-240811', restaurant: 'Meridian Kitchen', city: 'Bucharest', product: 'Walk-in cold room', portions: 180, submitted: '22 Sept', state: 'Offers received' },
]

export default function AdminApp() {
  const [section, setSection] = useState<Section>('Overview')
  const [restaurants, setRestaurants] = useState(restaurantSeed)
  const [requests, setRequests] = useState(requestSeed)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All status')
  const [toast, setToast] = useState('')
  const [showRestaurantForm, setShowRestaurantForm] = useState(false)
  const [restaurantForm, setRestaurantForm] = useState({ name: '', cui: '', city: '', contact: '' })

  const filteredRestaurants = useMemo(() => restaurants.filter((restaurant) => {
    const query = search.toLowerCase()
    const matchesQuery = `${restaurant.name} ${restaurant.cui} ${restaurant.city} ${restaurant.contact}`.toLowerCase().includes(query)
    return matchesQuery && (statusFilter === 'All status' || restaurant.status === statusFilter)
  }), [restaurants, search, statusFilter])

  const filteredRequests = useMemo(() => requests.filter((request) => {
    const query = search.toLowerCase()
    return `${request.restaurant} ${request.product} ${request.id} ${request.city}`.toLowerCase().includes(query)
  }), [requests, search])

  function saveRestaurant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRestaurants((current) => [{
      id: crypto.randomUUID(), name: restaurantForm.name.trim(), cui: restaurantForm.cui.trim(),
      city: restaurantForm.city.trim(), contact: restaurantForm.contact.trim(), equipment: 0, requests: 0, status: 'Setup pending',
    }, ...current])
    setRestaurantForm({ name: '', cui: '', city: '', contact: '' })
    setShowRestaurantForm(false)
    setToast('Restaurant workspace added. Invite the customer to complete setup.')
  }

  function advanceRequest(id: string, state: PurchaseRequest['state']) {
    const next: PurchaseRequest['state'] = state === 'New' ? 'RFQ sent' : state === 'RFQ sent' ? 'Offers received' : 'Comparison ready'
    setRequests((current) => current.map((request) => request.id === id ? { ...request, state: next } : request))
    setToast(`Request ${id} moved to ${next}.`)
  }

  const nav: { name: Section; icon: typeof LayoutDashboard; count?: number }[] = [
    { name: 'Overview', icon: LayoutDashboard },
    { name: 'Restaurants', icon: Building2 },
    { name: 'Equipment', icon: Wrench },
    { name: 'Purchase requests', icon: ClipboardList, count: requests.filter((item) => item.state === 'New').length },
    { name: 'Supplier offers', icon: FileText },
  ]
  const statusClass = (status: string) => `status-label status-${status.toLowerCase().replaceAll(' ', '-')}`

  function renderRestaurantRows(rows: Restaurant[]) {
    return <div className="table-scroll"><table className="admin-table"><thead><tr><th>BUSINESS</th><th>CUI</th><th>LOCATION</th><th>ASSETS</th><th>OPEN REQUESTS</th><th>ACCOUNT</th><th /></tr></thead><tbody>{rows.map((restaurant) => <tr key={restaurant.id}><td><div className="business-cell"><span className="business-avatar">{restaurant.name.slice(0, 1)}</span><span><strong>{restaurant.name}</strong><small>{restaurant.contact}</small></span></div></td><td className="cui-cell">{restaurant.cui || 'Not added'}</td><td>{restaurant.city || 'Not set'}</td><td>{restaurant.equipment}</td><td>{restaurant.requests ? <span className="request-count">{restaurant.requests} open</span> : <span className="muted-value">—</span>}</td><td><span className={statusClass(restaurant.status)}><i />{restaurant.status}</span></td><td><button className="more-button" type="button" aria-label={`Manage ${restaurant.name}`} onClick={() => setToast(`Restaurant details for ${restaurant.name} are ready to manage.`)}><MoreHorizontal size={18} /></button></td></tr>)}</tbody></table>{rows.length === 0 && <div className="empty-table">No restaurants match those filters.</div>}</div>
  }

  function renderRequestRows(rows: PurchaseRequest[]) {
    return <div className="table-scroll"><table className="admin-table request-table"><thead><tr><th>REQUEST</th><th>RESTAURANT</th><th>EQUIPMENT</th><th>VOLUME</th><th>SUBMITTED</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{rows.map((request) => <tr key={request.id}><td><span className="request-id">{request.id}</span></td><td><div className="business-cell"><span className="business-avatar compact-avatar">{request.restaurant.slice(0, 1)}</span><span><strong>{request.restaurant}</strong><small>{request.city}</small></span></div></td><td><strong className="product-name">{request.product}</strong></td><td>{request.portions} <span className="muted-value">portions/day</span></td><td className="muted-value">{request.submitted}</td><td><span className={statusClass(request.state)}><i />{request.state}</span></td><td><button className="row-button" type="button" onClick={() => advanceRequest(request.id, request.state)}>{request.state === 'New' ? 'Prepare RFQ' : request.state === 'RFQ sent' ? 'Add offers' : request.state === 'Offers received' ? 'Compare' : 'Open report'}<ChevronRight size={14} /></button></td></tr>)}</tbody></table>{rows.length === 0 && <div className="empty-table">No requests match your search.</div>}</div>
  }

  return <div className="admin-app">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="#overview" onClick={(event) => { event.preventDefault(); setSection('Overview') }}><span className="admin-brand-mark"><Activity size={18} strokeWidth={2.5} /></span><span>coreha<span className="brand-period">.</span><small>ADMINISTRATION</small></span></a>
      <div className="admin-side-label">OPERATIONS</div>
      <nav aria-label="Admin navigation">{nav.map(({ name, icon: Icon, count }) => <button key={name} className={`admin-nav-item ${section === name ? 'selected' : ''}`} type="button" onClick={() => { setSection(name); setSearch('') }}><Icon size={17} strokeWidth={1.8} /><span>{name}</span>{count ? <em>{count}</em> : null}</button>)}</nav>
      <div className="admin-sidebar-bottom"><div className="admin-security"><ShieldCheck size={16} /><span>Restaurant data is private</span></div><button className="admin-nav-item settings-item" type="button" onClick={() => setToast('Admin settings are coming next.')}><Settings2 size={17} /><span>Settings</span></button><div className="admin-user"><span className="user-avatar">AD</span><span><strong>Andrei Dima</strong><small>Platform administrator</small></span><MoreHorizontal size={18} /></div></div>
    </aside>

    <div className="admin-main">
      <header className="admin-topbar"><div className="admin-crumb"><span>CoreHa</span><ChevronRight size={14} /><strong>{section}</strong></div><div className="admin-top-actions"><span className="environment-label"><i /> DEMO ENVIRONMENT</span><button type="button" className="admin-icon-button" aria-label="Notifications" onClick={() => setSection('Purchase requests')}><Bell size={18} /><span className="admin-notification" /></button><span className="top-avatar">AD</span></div></header>
      <main className="admin-content">
        {section === 'Overview' && <>
          <div className="admin-page-heading"><div><div className="admin-eyebrow">WEDNESDAY · 07 OCTOBER 2026</div><h1>Operations overview<span>.</span></h1><p>Restaurant activity, equipment care, and purchase enquiries.</p></div><button className="admin-primary-button" type="button" onClick={() => setShowRestaurantForm(true)}><Plus size={16} /> Add restaurant</button></div>
          <section className="admin-metrics"><article className="admin-metric"><div><span>Restaurant accounts</span><Building2 size={17} /></div><strong>{restaurants.length}<small> businesses</small></strong><footer><i /> {restaurants.filter((item) => item.status === 'Active').length} active workspaces</footer></article><article className="admin-metric metric-attention"><div><span>New purchase requests</span><CircleAlert size={17} /></div><strong>{requests.filter((item) => item.state === 'New').length}<small> to review</small></strong><footer><ArrowRight size={13} /> Needs first response</footer></article><article className="admin-metric"><div><span>Equipment registered</span><Wrench size={17} /></div><strong>{restaurants.reduce((sum, item) => sum + item.equipment, 0)}<small> assets</small></strong><footer><i /> Across all businesses</footer></article><article className="admin-metric"><div><span>Comparisons ready</span><FileText size={17} /></div><strong>{requests.filter((item) => item.state === 'Comparison ready').length}<small> reports</small></strong><footer><i /> Awaiting customer review</footer></article></section>
          <section className="admin-panel"><div className="admin-section-head"><div><div className="admin-section-kicker">INCOMING WORK</div><h2>Purchase requests</h2></div><button className="admin-text-button" type="button" onClick={() => setSection('Purchase requests')}>All requests <ArrowRight size={14} /></button></div>{renderRequestRows(requests.slice(0, 3))}</section>
          <section className="admin-panel overview-restaurants"><div className="admin-section-head"><div><div className="admin-section-kicker">CUSTOMER WORKSPACES</div><h2>Recently active</h2></div><button className="admin-text-button" type="button" onClick={() => setSection('Restaurants')}>All restaurants <ArrowRight size={14} /></button></div>{renderRestaurantRows(restaurants.slice(0, 4))}</section>
        </>}

        {section === 'Restaurants' && <><div className="admin-page-heading"><div><div className="admin-eyebrow">CUSTOMER DIRECTORY</div><h1>Restaurants<span>.</span></h1><p>Business workspaces, registration details, and account activity.</p></div><button className="admin-primary-button" type="button" onClick={() => setShowRestaurantForm(true)}><Plus size={16} /> Add restaurant</button></div><section className="admin-panel directory-panel"><div className="directory-toolbar"><label className="admin-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search business, CUI, city, contact" /></label><label className="admin-select"><span className="sr-only">Account status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All status</option><option>Active</option><option>Setup pending</option></select><ChevronDown size={14} /></label><span className="result-count">{filteredRestaurants.length} workspaces</span></div>{renderRestaurantRows(filteredRestaurants)}</section></>}

        {section === 'Equipment' && <><div className="admin-page-heading"><div><div className="admin-eyebrow">EQUIPMENT CARE</div><h1>Restaurant assets<span>.</span></h1><p>Review registered machinery and cleaning attention across customers.</p></div><button className="admin-secondary-button" type="button" onClick={() => setToast('Equipment export prepared.')}>Export list <ArrowRight size={14} /></button></div><section className="category-grid"><article><span><Snowflake size={18} /></span><strong>Refrigeration</strong><small>24 machines · 3 due this week</small></article><article><span><Waves size={18} /></span><strong>Dishwashers</strong><small>16 machines · 2 overdue</small></article><article><span><Activity size={18} /></span><strong>Ice machines</strong><small>11 machines · 1 due this week</small></article><article><span><Utensils size={18} /></span><strong>Cooking equipment</strong><small>28 machines · 4 due this week</small></article></section><section className="admin-panel directory-panel"><div className="admin-section-head asset-head"><div><div className="admin-section-kicker">CLEANING ATTENTION</div><h2>Upcoming and overdue</h2></div><span className="status-label status-overdue"><i />6 need attention</span></div><div className="table-scroll"><table className="admin-table"><thead><tr><th>EQUIPMENT</th><th>RESTAURANT</th><th>WORKLOAD</th><th>LAST CLEANED</th><th>NEXT CLEAN</th><th>STATUS</th></tr></thead><tbody>{[{ name: 'Walk-in cold room', category: 'Refrigeration', business: 'Meridian Kitchen', workload: 'High', cleaned: '2 Aug 2026', due: '2 Oct 2026', state: 'Overdue', Icon: Snowflake }, { name: 'Deck oven', category: 'Cooking equipment', business: 'Casa Verde Bistro', workload: 'High', cleaned: '6 Aug 2026', due: '6 Oct 2026', state: 'Overdue', Icon: Utensils }, { name: 'Undercounter dishwasher', category: 'Dishwasher', business: 'Meridian Kitchen', workload: 'Medium', cleaned: '13 Jun 2026', due: '13 Oct 2026', state: 'Due soon', Icon: Waves }, { name: 'Ice maker IM-45', category: 'Ice machine', business: 'Atelier 17', workload: 'Low', cleaned: '24 Apr 2026', due: '24 Oct 2026', state: 'On schedule', Icon: Activity }].map((asset) => <tr key={asset.name}><td><div className="business-cell"><span className="business-avatar asset-avatar"><asset.Icon size={16} /></span><span><strong>{asset.name}</strong><small>{asset.category}</small></span></div></td><td>{asset.business}</td><td><span className={`workload-chip workload-${asset.workload.toLowerCase()}`}><i />{asset.workload}</span></td><td>{asset.cleaned}</td><td>{asset.due}</td><td><span className={statusClass(asset.state)}><i />{asset.state}</span></td></tr>)}</tbody></table></div></section></>}

        {section === 'Purchase requests' && <><div className="admin-page-heading"><div><div className="admin-eyebrow">ADVISORY PIPELINE</div><h1>Purchase requests<span>.</span></h1><p>Review customer needs, prepare RFQs, and manage supplier follow-up.</p></div><button className="admin-secondary-button" type="button" onClick={() => setToast('Request export prepared.')}>Export requests <ArrowRight size={14} /></button></div><section className="request-flow"><div><strong>{requests.filter((item) => item.state === 'New').length}</strong><span>New</span></div><i /><div><strong>{requests.filter((item) => item.state === 'RFQ sent').length}</strong><span>RFQ sent</span></div><i /><div><strong>{requests.filter((item) => item.state === 'Offers received').length}</strong><span>Offers received</span></div><i /><div><strong>{requests.filter((item) => item.state === 'Comparison ready').length}</strong><span>Comparison ready</span></div></section><section className="admin-panel directory-panel"><div className="directory-toolbar"><label className="admin-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search request, equipment, restaurant" /></label><span className="result-count">{filteredRequests.length} requests</span></div>{renderRequestRows(filteredRequests)}</section></>}

        {section === 'Supplier offers' && <><div className="admin-page-heading"><div><div className="admin-eyebrow">SUPPLIER RELATIONSHIPS</div><h1>Offer management<span>.</span></h1><p>Record proposals and prepare transparent customer comparisons.</p></div><button className="admin-primary-button" type="button" onClick={() => setToast('Choose a purchase request before adding an offer.')}><Plus size={16} /> Add an offer</button></div><section className="offer-inbox"><div className="offer-inbox-icon"><FileText size={20} /></div><div><strong>{requests.filter((item) => item.state === 'Offers received').length} request ready for comparison</strong><span>Supplier communication stays manual. Record offers against their purchase request.</span></div><button className="admin-text-button" type="button" onClick={() => setSection('Purchase requests')}>Open requests <ArrowRight size={14} /></button></section><section className="offer-overview"><article className="admin-panel offer-sample"><div className="offer-card-top"><span>CH-240815</span><span className="status-label status-comparison-ready"><i />Published</span></div><h2>Combi oven</h2><p>Meridian Kitchen · 180 portions/day</p><div className="offer-stat-row"><div><strong>2</strong><span>supplier offers</span></div><div><strong>€11.2k–€12.8k</strong><span>price range</span></div></div><button className="admin-text-button" type="button" onClick={() => setToast('Open Purchase requests to manage this comparison.')}>Review comparison <ArrowRight size={14} /></button></article><article className="offer-guidance"><ShieldCheck size={19} /><strong>Make the trade-offs clear.</strong><span>Compare price, estimated monthly kWh, materials, warranty, maintenance, advantages, and considerations. Disclose intermediary commissions with the report.</span></article></section></>}
      </main>
    </div>

    {showRestaurantForm && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowRestaurantForm(false) }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="restaurant-modal-title"><header><div><span className="admin-section-kicker">CUSTOMER WORKSPACE</span><h2 id="restaurant-modal-title">Add a restaurant</h2></div><button className="modal-close" type="button" aria-label="Close" onClick={() => setShowRestaurantForm(false)}>×</button></header><p>Create a workspace first; the restaurant completes its profile after accepting an invitation.</p><form onSubmit={saveRestaurant}><label>Business name<input required value={restaurantForm.name} onChange={(event) => setRestaurantForm({ ...restaurantForm, name: event.target.value })} placeholder="Restaurant name" /></label><label>CUI<input required value={restaurantForm.cui} onChange={(event) => setRestaurantForm({ ...restaurantForm, cui: event.target.value })} placeholder="RO 12345678" /></label><div className="admin-form-grid"><label>City<input required value={restaurantForm.city} onChange={(event) => setRestaurantForm({ ...restaurantForm, city: event.target.value })} placeholder="City" /></label><label>Primary contact<input value={restaurantForm.contact} onChange={(event) => setRestaurantForm({ ...restaurantForm, contact: event.target.value })} placeholder="Contact name" /></label></div><div className="admin-modal-actions"><button type="button" className="admin-secondary-button" onClick={() => setShowRestaurantForm(false)}>Cancel</button><button type="submit" className="admin-primary-button"><Plus size={15} /> Create workspace</button></div></form></section></div>}
    {toast && <div className="admin-toast" role="status"><Check size={16} />{toast}<button type="button" aria-label="Dismiss" onClick={() => setToast('')}>×</button></div>}
  </div>
}
