import { useState, type FormEvent } from 'react'
import { Activity, ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { errorMessage, supabaseConfigured } from '../lib/supabase'

export function Login() {
  const { session, profile, signIn, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Signed in, but the profile is not an admin (customers use the mobile app).
  const notAdmin = Boolean(session && profile?.role !== 'admin')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(errorMessage(err, 'Unable to sign in.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-card">
        <div className="admin-brand">
          <span className="admin-brand-mark"><Activity size={18} strokeWidth={2.5} /></span>
          <span>coreha<span className="brand-period">.</span><small>ADMINISTRATION</small></span>
        </div>

        {notAdmin ? (
          <>
            <h1>No admin access</h1>
            <p>
              <strong>{session?.user.email}</strong> is not a CoreHa administrator. Restaurant accounts use the mobile app.
            </p>
            <button className="admin-primary-button login-submit" type="button" onClick={() => signOut()}>Use another account</button>
          </>
        ) : (
          <>
            <h1>Sign in</h1>
            <p>Use your CoreHa staff account.</p>
            {!supabaseConfigured && (
              <div className="login-error">Missing Supabase config. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.</div>
            )}
            <form onSubmit={handleSubmit}>
              <label>Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              {error && <div className="login-error">{error}</div>}
              <button className="admin-primary-button login-submit" type="submit" disabled={submitting || !supabaseConfigured} aria-busy={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </>
        )}

        <div className="admin-security"><ShieldCheck size={16} /><span>Access is limited to accounts with the admin role.</span></div>
      </section>
    </div>
  )
}
