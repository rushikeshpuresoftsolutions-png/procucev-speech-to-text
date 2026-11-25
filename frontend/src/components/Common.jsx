import React from 'react'
import { AudioLines, FileText, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { clock, dateLabel, languages } from '../services/api'

export function FetchState({ resource }) {
  if (resource.loading) return <div className="notice" role="status">Loading workspace…</div>
  if (resource.error) return <div className="notice error" role="alert">{resource.error} <button onClick={resource.retry}>Retry</button></div>
  return null
}
export function Empty({ filtered = false }) {
  return <div className="empty"><div className="empty-icon"><FileText size={25}/></div>
    <h3>{filtered ? 'No matching transcriptions' : 'No transcriptions yet'}</h3>
    <p>{filtered ? 'Try another title or phrase.' : 'Your saved recordings will appear here.'}</p>
    {!filtered && <Link to="/studio">Open live studio <ArrowUpRight size={14}/></Link>}</div>
}
export function Row({ item }) {
  return <Link className="record-row" to={'/history/' + item.id}>
    <span className="file-icon"><AudioLines size={19}/></span><div className="min-w-0 flex-1">
      <strong>{item.title}</strong><p>{item.content}</p></div>
    <span className="tag">{languages[item.language]}</span><time>{clock(item.duration)}</time>
    <small>{dateLabel(item.created_at)}</small><ArrowUpRight size={15}/></Link>
}
export function Waveform() {
  return <div aria-hidden="true" className="wave-art">{Array.from({ length: 85 }, (_, i) => {
    const peak = Math.exp(-((i - 24) ** 2) / 120) + .85 * Math.exp(-((i - 58) ** 2) / 90)
    const height = 4 + 82 * peak * (.26 + .74 * Math.abs(Math.sin(i * 1.84)))
    return <i key={i} style={{ height: height + '%', opacity: .5 + .5 * peak }}/>
  })}</div>
}
