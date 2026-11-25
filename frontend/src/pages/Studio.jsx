import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Circle, Eraser, Mic, Save, Square } from 'lucide-react'
import { useRecording } from '../hooks/useRecording'
import { api, clock, languages, problem } from '../services/api'

export default function Studio() {
  const r = useRecording()
  const [mode,setMode] = useState('auto'), [title,setTitle] = useState('')
  const [saving,setSaving] = useState(false), [error,setError] = useState('')
  const navigate = useNavigate()
  const busy = r.state !== 'idle'
  async function save(e) {
    e.preventDefault()
    if (busy || saving || !r.content.trim()) return
    setSaving(true); setError('')
    try {
      const {data} = await api.post('/transcriptions', {title: title.trim() || 'Untitled transcription', content: r.content.trim(), duration: r.duration, language: r.language})
      navigate('/history/'+data.id, {state:{notice:'Transcription saved.'}})
    } catch(e) {setError(problem(e)); setSaving(false)}
  }
  function start() {
    if (r.content.trim() && !window.confirm('Replace the current draft with a new recording?')) return
    setError(''); r.start(mode)
  }
  return <><header className="page-heading"><div><h1>Live studio</h1><p>Record your voice, then review and save the transcript.</p></div></header>
    <section className="console"><div className="flex justify-between items-center gap-3"><span className="hero-label"><Mic size={16}/> MICROPHONE</span><span className="connection"><Circle size={8} fill="currentColor"/>{{idle:'Disconnected',connecting:'Connecting',recording:'Connected',finishing:'Finalizing'}[r.state]}</span></div>
      <div className="console-body"><div className="timer">{clock(r.duration)}</div><p role="status">{{idle:'Ready to record',connecting:'Waiting for microphone and server…',recording:'Recording live',finishing:'Processing the last words…'}[r.state]}</p></div>
      <div className="console-foot"><label>Speech language <select value={mode} disabled={busy || saving} onChange={e=>setMode(e.target.value)}>{Object.entries(languages).map(([key,val])=><option key={key} value={key}>{val}</option>)}</select></label>
      {r.state==='recording' ? <button className="primary mint" onClick={r.stop}><Square size={15}/> Stop recording</button> :
        <button className="primary mint" disabled={busy || saving} onClick={start}><Mic size={16}/> Start recording</button>}</div></section>
    {(r.error||error) && <p role="alert" className="notice error">{r.error||error}</p>}
    <form onSubmit={save} className="panel form"><div className="panel-head"><div><h2>Transcript</h2><p>{busy ? 'Live words appear below as audio is processed.' : 'Review the text before saving.'}</p></div>
    <button type="button" className="secondary" disabled={busy||saving||(!title&&!r.content&&!r.duration)} onClick={()=>{ r.clear();setTitle('');setError('') }}><Eraser size={15}/> Clear</button></div>
    <label>Title<input maxLength={180} disabled={saving} placeholder="Untitled transcription" value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Transcription<textarea rows={7} maxLength={100000} readOnly={busy||saving} placeholder="Your words will appear here…" value={r.content} onChange={e=>r.setContent(e.target.value)}/></label>
    {r.partial && <p className="partial" aria-live="polite">{r.partial}</p>}
    <div className="form-actions"><button disabled={busy||saving||!r.content.trim()} className="primary"><Save size={16}/>{saving?'Saving…':'Save transcription'}</button></div></form></>
}
