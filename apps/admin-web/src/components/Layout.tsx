import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Activity, Bell, Building2, ChevronRight, ClipboardList, FileText, LayoutDashboard, LogOut, ShieldCheck, Truck, Wrench } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useQuery } from '../lib/useQuery'

const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/restaurants', label: 'Restaurants', icon: Building2 },
  { to: '/equipment', label: 'Equipment', icon: Wrench },
  { to: '/requests', label: 'Purchase requests', icon: ClipboardList, badge: 'newLeads' },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/offers', label: 'Supplier offers', icon: FileText },
] as const

function initials(value: string) {
  const parts = value.split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'AD'
}

export function Layout() {
  const { profile, signOut } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const current = nav.find((item) => (item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)))

  const newLeads = useQuery(async () => {
    const { count, error } = await supabase.from('consultation_leads').select('id', { count: 'exact', head: true }).eq('status', 'new')
    if (error) throw error
    return count ?? 0
  }, [])

  const { reload } = newLeads
  useEffect(() => {
    reload()
  }, [location.pathname, reload])

  const displayName = profile?.full_name || profile?.email || 'Administrator'

  async function handleSignOut() {
    try {
      await signOut()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Unable to sign out.', 'error')
    }
  }

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <NavLink className="admin-brand" to="/">
          <span className="admin-brand-mark"><Activity size={18} strokeWidth={2.5} /></span>
          <span>coreha<span className="brand-period">.</span><small>ADMINISTRATION</small></span>
        </NavLink>
        <div className="admin-side-label">OPERATIONS</div>
        <nav aria-label="Admin navigation">
          {nav.map(({ to, label, icon: Icon, ...item }) => {
            const count = 'badge' in item ? newLeads.data : null
            return (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `admin-nav-item ${isActive ? 'selected' : ''}`}>
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
                {count ? <em>{count}</em> : null}
              </NavLink>
            )
          })}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-security"><ShieldCheck size={16} /><span>Restaurant data is private</span></div>
          <div className="admin-user">
            <span className="user-avatar">{initials(displayName)}</span>
            <span><strong>{displayName}</strong><small>Platform administrator</small></span>
            <button className="admin-icon-button" type="button" aria-label="Sign out" title="Sign out" onClick={handleSignOut}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-crumb"><span>CoreHa</span><ChevronRight size={14} /><strong>{current?.label ?? 'Admin'}</strong></div>
          <div className="admin-top-actions">
            <NavLink to="/requests" className="admin-icon-button" aria-label="New purchase requests">
              <Bell size={18} />
              {newLeads.data ? <span className="admin-notification" /> : null}
            </NavLink>
            <span className="top-avatar">{initials(displayName)}</span>
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
