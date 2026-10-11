import { useEffect, useRef, useState } from 'react'
import { useVoiceInput } from '../lib/voice'

const BARS = 7

/**
 * Mic button + status bar. Text is written into the message box live via `setText`.
 * `getText` returns the current box text so speech is appended to what was typed.
 */
export function useVoiceControls({ getText, setText, onDone, disabled }) {
  const base = useRef('')
  const [done, setDone] = useState(false)
  const voice = useVoiceInput({
    onText: (t, isFinal) => {
      setText(base.current ? `${base.current} ${t}` : t)
      if (isFinal) {
        setDone(true)
        onDone?.()
      }
    },
  })
  const active = voice.state !== 'idle'

  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => setDone(false), 4000)
    return () => clearTimeout(id)
  }, [done])

  function toggle() {
    if (active) {
      voice.stop()
      return
    }
    base.current = getText().trim()
    setDone(false)
    voice.start()
  }

  // Bars react to the live mic level; the native engine has no level, so they pulse instead.
  const bars = Array.from({ length: BARS }, (_, i) => {
    const centre = 1 - Math.abs(i - (BARS - 1) / 2) / BARS
    return voice.level ? Math.max(0.15, Math.min(1, voice.level * 1.6 * centre + 0.1)) : null
  })

  return {
    button: (
      <button
        type="button"
        className={`mic-btn ${active ? 'recording' : ''}`}
        disabled={disabled || voice.state === 'transcribing' || !voice.engine}
        onClick={toggle}
        aria-label={active ? 'Stop listening' : 'Speak'}
        title={voice.engine ? (active ? 'Tap to stop' : 'Tap and speak') : 'Voice input is not supported here'}
      >
        {active ? (
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        )}
      </button>
    ),
    bar: (
      <>
        {voice.state === 'starting' && (
          <div className="voice-bar" role="status"><span className="mic-spin" /> Starting the microphone… allow access if asked</div>
        )}
        {voice.state === 'listening' && (
          <div className="voice-bar live" role="status" aria-live="polite">
            <span className="rec-dot" />
            <b>Listening… speak now</b>
            <span X aria-hidden="true">
              {bars.map((h, i) => <i key={i} style={h != null ? { transform: `scaleY(${h})` } : { animationDelay: `${i * 0.1}s` }} />)}
            </span>
            <button type="button" className="btn ghost sm" onClick={voice.stop}>Stop</button>
          </div>
        )}
        {voice.state === 'transcribing' && (
          <div className="voice-bar" role="status"><span className="mic-spin" /> Turning your voice into text…</div>
        )}
        {done && voice.state === 'idle' && (
          <div className="voice-bar ok" role="status">✓ Done. Check the text, then press send ➤</div>
        )}
        {voice.error && (
          <div className="voice-bar err" role="alert">
            {voice.error}
            <button type="button" className="link-btn" onClick={voice.clearError}>Dismiss</button>
          </div>
        )}
      </>
    ),
  }
}
