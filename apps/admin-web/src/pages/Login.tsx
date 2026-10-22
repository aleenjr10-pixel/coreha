import { useEffect, useState, type FormEvent } from 'react'
import { Activity, MailCheck, ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { errorMessage, supabase, supabaseConfigured } from '../lib/supabase'

// signin → forgot (send code) → reset (code + new password)
type Mode = 'signin' | 'forgot' | 'reset'

const RESEND_SECONDS = 60

function friendlyError(err: unknown, fallback: string) {
  const message = errorMessage(err, fallback)
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.'
  if (/token has expired|otp.*(expired|invalid)|invalid.*token/i.test(message)) return 'The code is wrong or has expired. Request a new one.'
  if (/rate limit|security purposes|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.'
  if (/should be different/i.test(message)) return 'Choose a password different from the old one.'
  return message
}

export function Login() {
  const { session, profile, signIn, signOut } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordAgain, setNewPasswordAgain] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (resendAt <= Date.now()) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [resendAt])
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000))

  // Signed in, but the profile is not an admin (customers use the mobile app).
  const notAdmin = Boolean(session && profile?.role !== 'admin')

  function go(next: Mode, message: string | null = null) {
    setMode(next)
    setError(null)
    setNotice(message)
    setCode('')
  }

  async function run(action: () => Promise<void>, fallback: string) {
    setSubmitting(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(friendlyError(err, fallback))
    } finally {
      setSubmitting(false)
    }
  }

  function sendCode() {
    return run(async () => {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (resetError) throw resetError
      setResendAt(Date.now() + RESEND_SECONDS * 1000)
      setNow(Date.now())
      // Same message whether or not the account exists.
      go('reset', `If ${email.trim()} has an account, we sent it a code.`)
    }, 'Unable to send the code.')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode === 'signin') return run(() => signIn(email.trim(), password), 'Unable to sign in.')
    if (mode === 'forgot') return sendCode()
    return run(async () => {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' })
      if (verifyError) throw verifyError
      // The code signed the admin in; the app may switch screens before this resolves.
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) window.alert(`Password not changed: ${friendlyError(updateError, 'Unable to save the new password.')}`)
    }, 'Unable to reset the password.')
  }

  const canSubmit = !submitting && supabaseConfigured && {
    signin: email.trim().length > 3 && password.length > 0,
    forgot: email.trim().length > 3,
    reset: /^\d{6,10}$/.test(code.trim()) && newPassword.length >= 6 && newPassword === newPasswordAgain,
  }[mode]

  const titles: Record<Mode, [string, string]> = {
    signin: ['Sign in', 'Use your CoreHa staff account.'],
    forgot: ['Reset your password', 'Enter your account email and we will send you a code.'],
    reset: ['Choose a new password', 'Enter the code from the email and your new password.'],
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
            <h1>{titles[mode][0]}</h1>
            <p>{titles[mode][1]}</p>
            {!supabaseConfigured && (
              <div className="login-error">Missing Supabase config. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.</div>
            )}
            {notice && <div className="login-notice"><MailCheck size={16} />{notice}</div>}

            <form onSubmit={handleSubmit}>
              {mode !== 'reset' && (
                <label>Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              )}
              {mode === 'signin' && (
                <label>
                  <span className="label-row">
                    Password
                    <button className="admin-text-button" type="button" onClick={() => go('forgot')}>Forgot password?</button>
                  </span>
                  <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </label>
              )}
              {mode === 'reset' && (
                <>
                  <label>Code from the email
                    <input
                      className="code-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={10}
                      required
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                    />
                  </label>
                  <label>New password<input type="password" required minLength={6} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
                  <label>New password again<input type="password" required autoComplete="new-password" value={newPasswordAgain} onChange={(event) => setNewPasswordAgain(event.target.value)} /></label>
                  {newPasswordAgain && newPassword !== newPasswordAgain && <span className="muted-value">The two passwords don't match yet.</span>}
                </>
              )}
              {error && <div className="login-error">{error}</div>}
              <button className="admin-primary-button login-submit" type="submit" disabled={!canSubmit} aria-busy={submitting}>
                {mode === 'signin' ? 'Sign in' : mode === 'forgot' ? 'Send code' : 'Save new password'}
              </button>
              {mode === 'reset' && (
                <button className="admin-secondary-button login-submit" type="button" onClick={sendCode} disabled={submitting || resendIn > 0}>
                  {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
                </button>
              )}
              {mode !== 'signin' && (
                <button className="admin-text-button login-back" type="button" onClick={() => go('signin')}>Back to sign in</button>
              )}
            </form>
          </>
        )}

        <div className="admin-security"><ShieldCheck size={16} /><span>Access is limited to the CoreHa administrator account.</span></div>
      </section>
    </div>
  )
}
