import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../lib/auth'
import { useSyncStatus } from '../lib/store'

const STATUS_COPY = {
  idle: 'Synced',
  synced: 'Synced',
  saving: 'Saving…',
  offline: 'Offline · will retry',
  error: 'Sync error',
}

function SignInModal({ onClose }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const first = useRef(null)
  // The parent re-renders every second (live clock), so onClose changes identity each tick.
  // Keep it in a ref so the effects below run only once, on open.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    first.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(email, password)
      onClose()
    } catch (err) {
      const msg = err?.message || ''
      if (msg === 'Invalid login credentials') setError('Email or password is incorrect.')
      else if (/fetch|network/i.test(msg)) setError('Can’t reach the server. Check your connection and try again.')
      else setError(msg || 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div className="modal-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form
        className="modal glass"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
      >
        <span className="modal-mark" />
        <h2 id="signin-title">Owner sign-in</h2>
        <p className="muted small">Everyone can view this page. Only the owner can track progress, sync devices and use the assistant.</p>
        <label className="field">
          <span>Email</span>
          <input ref={first} type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <div className="pw-wrap">
            <input type={showPw ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="go" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <span className="build-tag mono">{__APP_VERSION__}</span>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </div>
      </motion.form>
    </motion.div>
  )
}

export default function Account() {
  const { enabled, ready, isOwner, user, signOut, expired } = useAuth()
  const status = useSyncStatus()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)

  if (!enabled || !ready) return null

  return (
    <>
      {isOwner ? (
        <div className="account">
          <button className="account-btn" onClick={() => setMenu(!menu)} aria-expanded={menu}>
            <span className={`sync-dot ${status}`} />
            <span className="account-label">{STATUS_COPY[status]}</span>
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div className="account-menu glass" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <span className="muted small">Signed in as</span>
                <b>{user.email}</b>
                <span className="build-tag mono">{__APP_VERSION__}</span>
                <button className="btn ghost" onClick={() => { setMenu(false); signOut() }}>Sign out</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <button className={`account-btn ${expired ? 'expired' : ''}`} onClick={() => setOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span className="account-label">{expired ? 'Session expired · Sign in' : 'Sign in'}</span>
        </button>
      )}
      {createPortal(<AnimatePresence>{open && <SignInModal onClose={() => setOpen(false)} />}</AnimatePresence>, document.body)}
    </>
  )
}

// Small banner shown above stateful panels for visitors.
export function ViewOnlyNote() {
  const { isOwner, enabled } = useAuth()
  if (isOwner || !enabled) return null
  return (
    <p className="view-only">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      View-only. Progress tracking is private to the owner.
    </p>
  )
}
