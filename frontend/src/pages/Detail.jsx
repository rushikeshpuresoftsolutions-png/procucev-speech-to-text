import React, { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Save } from 'lucide-react'
import { useResource } from '../hooks/useResource'
import { FetchState } from '../components/Common'
import { api, clock, dateLabel, languages, problem } from '../services/api'

function Editor({ item }) {
  const [title,setTitle]=useState(item.title), [content,setContent]=useState(item.content)
  const [saving,setSaving]=useState(false), [error,setError]=useState('')
  const navigate=useNavigate()
  async function submit(e) {
    e.preventDefault();setSaving(true)
    try {await api.put('/transcriptions/'+item.id,{title,content});navigate('/history/'+item.id,{state:{notice:'Changes saved.'}})}
    catch(e){setError(problem(e));setSaving(false)}
  }
  return <form className="panel form" onSubmit={submit}><label>Title<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Transcription<textarea required maxLength={100000} rows={10} value={content} onChange={e=>setContent(e.target.value)}/></label>
    {error && <p role="alert" className="notice error">{error}</p>}<div className="form-actions"><Link className="secondary" to={'/history/'+item.id}>Cancel</Link><button className="primary" disabled={saving||!title.trim()||!content.trim()}><Save size={15}/>{saving?'Saving…':'Save changes'}</button></div></form>
}
export default function Detail({edit=false}) {
  const {id}=useParams(), location=useLocation()
  const resource=useResource('/transcriptions/'+encodeURIComponent(id))
  const item=resource.data
  return <><Link className="text-link" to="/history"><ArrowLeft size={16}/> History</Link><header className="page-heading"><div><h1>{edit?'Edit transcription':'Transcription'}</h1></div></header>
    {location.state?.notice && <p role="status" className="notice">{location.state.notice}</p>}<FetchState resource={resource}/>{item && (edit?<Editor key={id} item={item}/>:
    <article className="panel document"><div className="panel-head"><div><h2>{item.title}</h2><p>{dateLabel(item.created_at)} · {clock(item.duration)} · {languages[item.language]}</p></div><Link className="secondary" to={'/history/'+id+'/edit'}><Pencil size={15}/> Edit</Link></div><div className="prose-text">{item.content}</div></article>)}</>
}
