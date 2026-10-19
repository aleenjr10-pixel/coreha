import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { AuthProvider, useAuth } from './lib/auth'
import { ToastProvider } from './lib/toast'
import { CreateQuoteRequest } from './pages/CreateQuoteRequest'
import { Equipment } from './pages/Equipment'
import { Login } from './pages/Login'
import { Offers } from './pages/Offers'
import { Overview } from './pages/Overview'
import { RequestDetail } from './pages/RequestDetail'
import { Requests } from './pages/Requests'
import { RestaurantDetail } from './pages/RestaurantDetail'
import { Restaurants } from './pages/Restaurants'
import { Suppliers } from './pages/Suppliers'
import './AdminApp.css'

export default function AdminApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AdminRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

function AdminRoutes() {
  const { loading, session, profile } = useAuth()

  if (loading) return <div className="login-page"><span className="muted-value">Loading…</span></div>

  // Signed out, or signed in without the admin role: the login page handles both.
  if (!session || profile?.role !== 'admin') return <Login />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="restaurants" element={<Restaurants />} />
        <Route path="restaurants/:id" element={<RestaurantDetail />} />
        <Route path="equipment" element={<Equipment />} />
        <Route path="requests" element={<Requests />} />
        <Route path="requests/:id" element={<RequestDetail />} />
        <Route path="requests/:id/quote" element={<CreateQuoteRequest />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="offers" element={<Offers />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
