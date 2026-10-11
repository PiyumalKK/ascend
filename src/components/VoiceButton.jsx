import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const MAX_SECONDS = 60

function pickMime() {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return options.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || ''
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

/**
 * Tap to record, tap again to stop. The recording is transcribed on the server
 * (Whisper on Groq, Gemini fallback) and handed to `onText`. Works in browsers and the Android app.
 */
export default function VoiceButton({ onText, onError, disabled }) {
  const [state, setState] = useState('idle') // idle | recording | transcribing
  const [seconds, setSeconds] = useState(0)
  const rec = useRef(null)
  const timer = useRef(null)

  useEffect(() => () => {
    clearInterval(timer.current)
    rec.current?.stream?.getTracks().forEach((t) => t.stop())
  }, [])

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      onError?.('Voice input is not supported on this device.')
      return
    }
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      onError?.('Microphone permission was denied. Allow it in your browser or app settings.')
      return
    }
    const mime = pickMime()
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined)
    const chunks = []
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    recorder.onstop = async () => {
      clearInterval(timer.current)
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' })
      if (blob.size < 1500) {
        setState('idle')
        return
      }
      setState('transcribing')
      try {
        const audio = await toBase64(blob)
        const { data, error } = await supabase.functions.invoke('assistant', { body: { action: 'transcribe', audio, mime: blob.type } })
        if (error) {
          let msg = error.message
          try { msg = (await error.context.json()).error || msg } catch { /* keep */ }
          throw new Error(msg)
        }
        if (data?.text) onText(data.text)
        else onError?.('I could not hear anything. Try again a bit closer to the mic.')
      } catch (e) {
        onError?.(e.message)
      } finally {
        setState('idle')
      }
    }
    rec.current = recorder
    rec.current.stream = stream
    recorder.start()
    setSeconds(0)
    setState('recording')
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) recorder.state === 'recording' && recorder.stop()
        return s + 1
      })
    }, 1000)
  }

  function stop() {
    if (rec.current?.state === 'recording') rec.current.stop()
  }

  return (
    <button
      type="button"
      className={`mic-btn ${state}`}
      disabled={disabled || state === 'transcribing'}
      onClick={state === 'recording' ? stop : start}
      aria-label={state === 'recording' ? 'Stop recording' : 'Speak'}
      title={state === 'recording' ? 'Tap to stop' : 'Tap and speak'}
    >
      {state === 'recording' ? (
        <span className="mic-time mono">{String(Math.floor(seconds / 60)).padStart(1, '0')}:{String(seconds % 60).padStart(2, '0')}</span>
      ) : state === 'transcribing' ? (
        <span className="mic-spin" />
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      )}
    </button>
  )
}
