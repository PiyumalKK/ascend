// Live voice input for the assistant, with three engines tried in order:
//   1. native  – Android app: the phone's own speech recognizer (live partial results)
//   2. web     – Chrome / Edge / Android Chrome: Web Speech API (live interim results)
//   3. record  – anything else: record, then transcribe on the server (Groq Whisper)
// The hook reports a clear state, a live mic level, and the text as it is recognised.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

const SILENCE_MS = 2500 // web engine: stop after this much quiet once something was said
const NO_SPEECH_MS = 8000 // stop if nothing at all is heard
const MAX_MS = 60_000

const WebSR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

export function pickEngine() {
  if (Capacitor.isNativePlatform()) return 'native'
  if (WebSR) return 'web'
  if (navigator.mediaDevices?.getUserMedia && window.MediaRecorder) return 'record'
  return null
}

const ERRORS = {
  'not-allowed': 'Microphone permission is blocked. Allow it for this site (lock icon in the address bar) and try again.',
  'service-not-allowed': 'Speech recognition is blocked in this browser. Try Chrome.',
  'no-speech': "I didn't hear anything. Tap the mic and start speaking.",
  'audio-capture': 'No microphone found. Check that one is connected.',
}

/**
 * @param onText(text, isFinal) receives the full recognised text so far.
 */
export function useVoiceInput({ onText, lang = 'en-US' }) {
  const [state, setState] = useState('idle') // idle | starting | listening | transcribing
  const [level, setLevel] = useState(0)
  const [error, setError] = useState('')
  const [engine, setEngine] = useState(pickEngine)
  const stopRef = useRef(null)
  const meterRef = useRef(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  // Live mic level for the meter (best effort; the recognizer keeps working without it).
  const startMeter = useCallback(async (existingStream) => {
    try {
      const stream = existingStream || (await navigator.mediaDevices.getUserMedia({ audio: true }))
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      let raf
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (const v of data) sum += (v - 128) * (v - 128)
        setLevel(Math.min(1, Math.sqrt(sum / data.length) / 40))
        raf = requestAnimationFrame(tick)
      }
      tick()
      meterRef.current = () => {
        cancelAnimationFrame(raf)
        ctx.close().catch(() => {})
        if (!existingStream) stream.getTracks().forEach((t) => t.stop())
        setLevel(0)
      }
    } catch {
      /* no meter */
    }
  }, [])

  const stopMeter = () => {
    meterRef.current?.()
    meterRef.current = null
  }

  const finish = useCallback(() => {
    stopMeter()
    stopRef.current = null
    setState('idle')
  }, [])

  // ---------------------------------------------------------------- engines
  const startNative = useCallback(async () => {
    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition')
    const perm = await SpeechRecognition.requestPermissions()
    if (perm.speechRecognition !== 'granted') throw new Error('Microphone permission is needed. Allow it in Settings → Apps → ASCEND → Permissions.')
    const { available } = await SpeechRecognition.available()
    if (!available) throw new Error('Speech recognition is not available on this phone. Install or enable the Google app.')
    let latest = ''
    await SpeechRecognition.removeAllListeners()
    await SpeechRecognition.addListener('partialResults', (d) => {
      latest = d.matches?.[0] || latest
      onTextRef.current(latest, false)
    })
    await SpeechRecognition.addListener('listeningState', (d) => {
      if (d.status === 'started') setState('listening')
      if (d.status === 'stopped') {
        if (latest) onTextRef.current(latest, true)
        SpeechRecognition.removeAllListeners()
        finish()
      }
    })
    stopRef.current = () => SpeechRecognition.stop().catch(() => {})
    await SpeechRecognition.start({ language: lang, partialResults: true, popup: false, maxResults: 1 })
  }, [lang, finish])

  const startWeb = useCallback(() => new Promise((resolve, reject) => {
    const rec = new WebSR()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1
    let finalText = ''
    let heard = false
    let silence
    const hardStop = setTimeout(() => rec.stop(), MAX_MS)
    const armSilence = () => {
      clearTimeout(silence)
      silence = setTimeout(() => rec.stop(), SILENCE_MS)
    }
    rec.onstart = () => {
      silence = setTimeout(() => rec.stop(), NO_SPEECH_MS)
      setState('listening')
      startMeter()
      resolve()
    }
    rec.onresult = (e) => {
      heard = true
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t
        else interim += t
      }
      onTextRef.current((finalText + interim).trim(), false)
      armSilence()
    }
    rec.onerror = (e) => {
      clearTimeout(silence)
      clearTimeout(hardStop)
      // Browsers that expose the API but cannot reach a speech service: fall back to recording.
      if (e.error === 'network' || e.error === 'language-not-supported') {
        setEngine('record')
        reject(Object.assign(new Error('fallback'), { fallback: true }))
        return
      }
      if (e.error !== 'aborted') setError(ERRORS[e.error] || `Voice input error: ${e.error}`)
      reject(new Error(e.error))
    }
    rec.onend = () => {
      clearTimeout(silence)
      clearTimeout(hardStop)
      if (finalText.trim()) onTextRef.current(finalText.trim(), true)
      else if (!heard) setError((err) => err || ERRORS['no-speech'])
      finish()
    }
    stopRef.current = () => rec.stop()
    rec.start()
  }), [lang, finish, startMeter])

  const startRecord = useCallback(async () => {
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      throw new Error(ERRORS['not-allowed'])
    }
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported?.(m)) || ''
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined)
    const chunks = []
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    recorder.onstop = async () => {
      stopMeter()
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' })
      if (blob.size < 1500) {
        setError(ERRORS['no-speech'])
        finish()
        return
      }
      setState('transcribing')
      try {
        const audio = await new Promise((res, rej) => {
          const r = new FileReader()
          r.onload = () => res(String(r.result).split(',')[1] || '')
          r.onerror = rej
          r.readAsDataURL(blob)
        })
        const { data, error: fnErr } = await supabase.functions.invoke('assistant', { body: { action: 'transcribe', audio, mime: blob.type } })
        if (fnErr) {
          let msg = fnErr.message
          try { msg = (await fnErr.context.json()).error || msg } catch { /* keep */ }
          throw new Error(msg)
        }
        if (data?.text) onTextRef.current(data.text, true)
        else setError(ERRORS['no-speech'])
      } catch (e) {
        setError(e.message)
      } finally {
        finish()
      }
    }
    const hardStop = setTimeout(() => recorder.state === 'recording' && recorder.stop(), MAX_MS)
    stopRef.current = () => {
      clearTimeout(hardStop)
      if (recorder.state === 'recording') recorder.stop()
    }
    recorder.start()
    setState('listening')
    startMeter(stream)
  }, [finish, startMeter])

  // ---------------------------------------------------------------- controls
  const start = useCallback(async () => {
    if (state !== 'idle') return
    setError('')
    setState('starting')
    const run = async (e) => (e === 'native' ? startNative() : e === 'web' ? startWeb() : e === 'record' ? startRecord() : Promise.reject(new Error('Voice input is not supported on this device.')))
    try {
      await run(engine)
    } catch (e) {
      if (e.fallback) {
        try {
          await run('record')
          return
        } catch (e2) {
          setError(e2.message)
        }
      } else if (e.message && !['aborted', 'not-allowed', 'no-speech'].includes(e.message)) {
        setError(e.message)
      }
      finish()
    }
  }, [state, engine, startNative, startWeb, startRecord, finish])

  const stop = useCallback(() => stopRef.current?.(), [])

  useEffect(() => () => {
    stopRef.current?.()
    stopMeter()
  }, [])

  return { state, level, error, engine, start, stop, clearError: () => setError('') }
}
