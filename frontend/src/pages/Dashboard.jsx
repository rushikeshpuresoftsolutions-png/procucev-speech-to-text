import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Clock3, Files, Mic, Radio } from 'lucide-react'
import { useResource } from '../hooks/useResource'
import { Empty, FetchState, Row, Waveform } from '../components/Common'
import { clock } from '../services/api'

export default function Dashboard() {
  const resource = useResource('/dashboard/stats?offset_minutes=' + new Date().getTimezoneOffset())
  const d = resource.data
  return <>
    <header className="page-heading"><div><h1>Dashboard</h1><p>A snapshot of your transcription workspace.</p></div></header>
    <section className="hero"><div className="hero-copy"><div className="hero-label"><Radio size={15}/> LIVE STUDIO</div><h2>From speech to text.</h2>
      <p>Transcribe English, Hindi, and Hinglish as you speak.</p>
      <Link className="primary mint" to="/studio"><Mic size={16}/> New transcription <ArrowRight size={16}/></Link></div><Waveform/></section>
    <section className="stats" aria-label="Workspace statistics">
      {[[Files,'Total transcriptions',d?.total,'aqua'],[CalendarDays,"Today’s transcriptions",d?.today,'peach'],[Clock3,'Recorded duration',d ? clock(d.duration) : undefined,'lilac']].map(([Icon,label,value,color]) =>
        <article key={label}><span className={'stat-icon '+color}><Icon size={19}/></span><div><p>{label}</p><strong>{value ?? '—'}</strong></div></article>)}</section>
    <section className="panel"><div className="panel-head"><div><h2>Recent transcriptions</h2><p>Your latest saved sessions.</p></div><Link className="text-link" to="/history">View history <ArrowRight size={15}/></Link></div>
      <FetchState resource={resource}/>{d && (d.recent.length ? d.recent.map(item => <Row key={item.id} item={item}/>) : <Empty/>)}</section>
  </>
}
