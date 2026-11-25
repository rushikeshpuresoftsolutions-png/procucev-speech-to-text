import { useEffect, useRef, useState } from 'react'
import { socketUrl } from '../services/api'

const types = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']

function release(s) {
  clearTimeout(s.timeout)
  clearInterval(s.clock)
  if (s.recorder?.state === 'recording') s.recorder.stop()
  s.stream?.getTracks().forEach(track => track.stop())
  if (s.ws && s.ws.readyState < 2) s.ws.close()
}

export function useRecording() {
  const current = useRef(null)
  const [state, setState] = useState('idle')
  const [content, setContent] = useState('')
  const [partial, setPartial] = useState('')
  const [duration, setDuration] = useState(0)
  const [language, setLanguage] = useState('auto')
  const [error, setError] = useState('')
  useEffect(() => () => {
    const s = current.current
    current.current = null
    if (s) release(s)
  }, [])

  function stop() {
    const s = current.current
    if (s?.recorder?.state === 'recording') {
      setState('finishing')
      clearInterval(s.clock)
      setDuration(Math.min(1800, (Date.now() - s.started) / 1000))
      s.recorder.stop()
      s.stream.getTracks().forEach(track => track.stop())
      s.timeout = setTimeout(() => s.fail('Finalization timed out. Review the text received so far.'), 180000)
    }
  }

  async function start(mode) {
    if (current.current) return
    const s = { seen: new Set(), languages: new Set() }
    current.current = s
    const active = () => current.current === s
    function finish(message) {
      if (!active()) return
      current.current = null
      release(s)
      if (message) setError(message)
      setState('idle')
      setPartial('')
    }
    s.fail = finish
    setState('connecting')
    setError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error('Microphone recording needs HTTPS or localhost and a browser with MediaRecorder.')
      const mime = types.find(type => MediaRecorder.isTypeSupported(type))
      if (!mime) throw new Error('This browser has no supported audio recording format.')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false })
      if (!active()) { stream.getTracks().forEach(t => t.stop()); return }
      s.stream = stream
      s.recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 48000 })
      s.ws = new WebSocket(socketUrl())
      s.timeout = setTimeout(() => finish('The studio took too long to connect. Try again.'), 20000)
      s.ws.onopen = () => { if (active()) s.ws.send(JSON.stringify({ type: 'start', mime, language: mode })) }
      s.ws.onerror = () => finish('Could not connect to the transcription server.')
      s.ws.onclose = () => finish('Connection lost. Your finalized text is available below.')
      s.recorder.onerror = () => finish('Microphone recording failed.')
      s.recorder.ondataavailable = event => {
        if (!active() || !event.data.size || s.ws.readyState !== WebSocket.OPEN) return
        if (s.ws.bufferedAmount > 1024 * 1024) return finish('The connection is too slow to stream audio.')
        s.ws.send(event.data)
      }
      s.recorder.onstop = () => { if (active() && s.ws.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify({ type: 'stop' })) }
      s.ws.onmessage = ({ data }) => {
        if (!active()) return
        try {
          const m = JSON.parse(data)
          if (m.type === 'status' && m.state === 'ready') {
            clearTimeout(s.timeout)
            setDuration(0); setLanguage(mode); setContent(''); setState('recording')
            s.started = Date.now()
            s.recorder.start(250)
            s.clock = setInterval(() => {
              const elapsed = (Date.now() - s.started) / 1000
              if (elapsed >= 1800) stop()
              else setDuration(elapsed)
            }, 250)
          } else if (m.type === 'partial') setPartial(m.text)
          else if (m.type === 'final' && !s.seen.has(m.id)) {
            s.seen.add(m.id)
            setPartial('')
            setContent(text => [text, m.text].filter(Boolean).join(' '))
            if (mode === 'auto' && ['hi', 'en'].includes(m.language)) {
              s.languages.add(m.language)
              setLanguage(s.languages.size > 1 ? 'mixed' : m.language)
            }
          } else if (m.type === 'error') finish(m.message)
          else if (m.type === 'status' && m.state === 'complete') { setDuration(m.duration); finish() }
        } catch { finish('The server sent an unreadable update.') }
      }
    } catch (e) {
      finish(e.name === 'NotAllowedError' ? 'Microphone access was denied. Allow it in your browser and try again.' : e.message)
    }
  }
  function clear() { setContent(''); setPartial(''); setDuration(0); setError(''); setLanguage('auto') }
  return { state, content, setContent, partial, duration, language, error, start, stop, clear }
}
