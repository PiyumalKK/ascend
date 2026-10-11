import { useCallback, useEffect, useState } from 'react'
import Section from './Section'
import { useStored } from '../hooks'
import {
  isNative, notificationStatus, requestNotificationAccess, openExactAlarmSettings,
  scheduleTimetable, sendTestNotification,
} from '../lib/native'
import { useContent } from '../lib/content'

const APK_URL = import.meta.env.VITE_APK_URL || 'https://github.com/PiyumalKK/ascend/releases/latest/download/ASCEND.apk'

function NativeAlerts({ plan }) {
  const content = useContent()
  // Reschedule only when the timetable itself changes, not on every content edit.
  const scheduleKey = JSON.stringify([content.schedule, content.plans])
  // Device-local settings: each phone decides whether it rings.
  const [enabled, setEnabled] = useStored('ascend.alerts.enabled', true)
  const [lead, setLead] = useStored('ascend.alerts.lead', 0)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => setStatus(await notificationStatus()), [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const s = await notificationStatus()
      if (enabled && s.permission !== 'granted') await requestNotificationAccess()
      await scheduleTimetable(content, plan, { enabled, leadMinutes: lead })
      if (alive) refresh()
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, enabled, lead, refresh, scheduleKey])

  useEffect(() => {
    // Returning from Android settings: re-read permission state.
    const onVis = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refresh])

  const ok = status?.permission === 'granted' && status?.exact === 'granted'

  return (
    <div className="glass card alerts">
      <div className="alerts-head">
        <div>
          <h3>Timetable alarms</h3>
          <p className="muted small">On-device and exact. They work offline and when the app is closed.</p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span />
        </label>
      </div>

      <div className="alert-stats">
        <div><b className={status?.permission === 'granted' ? 'good' : 'bad'}>{status?.permission === 'granted' ? 'Allowed' : 'Blocked'}</b><small>Notifications</small></div>
        <div><b className={status?.exact === 'granted' ? 'good' : 'bad'}>{status?.exact === 'granted' ? 'Exact' : 'Inexact'}</b><small>Alarm timing</small></div>
        <div><b>{status?.scheduled ?? '…'}</b><small>Alarms / week</small></div>
      </div>

      <div className="lead">
        <span className="muted small">Ring</span>
        {[0, 5, 10].map((m) => (
          <button key={m} className={lead === m ? 'on' : ''} onClick={() => setLead(m)}>
            {m === 0 ? 'At start' : `${m} min early`}
          </button>
        ))}
      </div>
      <p className="muted small">Following {content.plans[plan].name}. Switch plans at the top of the page and the alarms update automatically.</p>

      <div className="alert-actions">
        {status?.permission !== 'granted' && (
          <button className="btn primary" onClick={async () => { await requestNotificationAccess(); refresh() }}>Allow notifications</button>
        )}
        {status?.exact !== 'granted' && (
          <button className="btn primary" onClick={openExactAlarmSettings}>Allow exact alarms</button>
        )}
        <button className="btn ghost" disabled={busy} onClick={async () => { setBusy(true); await sendTestNotification(); setTimeout(() => setBusy(false), 3500) }}>
          {busy ? 'Sending…' : 'Send test alert'}
        </button>
      </div>
      {!ok && status && (
        <p className="small warn-text">For reliable alarms, also set Settings → Apps → ASCEND → Battery → <b>Unrestricted</b>.</p>
      )}
    </div>
  )
}

function WebApps() {
  return (
    <div className="panel-grid">
      <div className="glass card">
        <h3>Android app</h3>
        <p className="muted small">The full ASCEND app with exact on-device alarms for every block of your day.</p>
        <ol className="steps">
          <li>Tap <b>Download APK</b> on your Android phone.</li>
          <li>Open it and allow <b>Install unknown apps</b> for your browser when Android asks.</li>
          <li>Open ASCEND, sign in, and allow notifications and exact alarms.</li>
        </ol>
        <div className="alert-actions">
          <a className="btn primary" href={APK_URL}>Download APK</a>
          <a className="btn ghost" href="https://github.com/PiyumalKK/ascend/releases" target="_blank" rel="noreferrer">All versions</a>
        </div>
      </div>
      <div className="glass card">
        <h3>Install the web app</h3>
        <p className="muted small">On any device, without the APK.</p>
        <ol className="steps">
          <li><b>Android Chrome:</b> menu ⋮ → <b>Install app</b>.</li>
          <li><b>Desktop Chrome / Edge:</b> the install icon in the address bar, or the <b>Install app</b> button at the top of this page.</li>
          <li><b>iPhone Safari:</b> Share → <b>Add to Home Screen</b>.</li>
        </ol>
      </div>
    </div>
  )
}

export default function Alerts({ plan }) {
  const native = isNative()
  return (
    <Section
      id="alerts"
      kicker="08 · Apps & alerts"
      title={native ? 'Never miss a block' : 'Take it with you'}
      intro={native ? 'Every block in your timetable rings at the right minute, seven days a week.' : 'Use ASCEND as an installed app on your phone and laptop. Your progress syncs between them.'}
    >
      {native ? <NativeAlerts plan={plan} /> : <WebApps />}
    </Section>
  )
}
