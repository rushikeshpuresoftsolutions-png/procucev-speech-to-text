import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Eye, Pencil, Search, Trash2 } from 'lucide-react'
import { useResource } from '../hooks/useResource'
import { Empty, FetchState } from '../components/Common'
import { api, clock, dateLabel, languages, problem } from '../services/api'

export default function History() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || '', page = Math.max(1, Number(params.get('page'))||1)
  const [term,setTerm] = useState(q), [deleting,setDeleting] = useState(null), [notice,setNotice]=useState(''), [error,setError]=useState('')
  const resource = useResource('/transcriptions?limit=12&page='+page+'&q='+encodeURIComponent(q))
  const d = resource.data
  useEffect(()=>setTerm(q),[q])
  function search(e) {e.preventDefault();setParams({q:term,page:'1'})}
  async function remove(item) {
    if (!window.confirm('Delete “'+item.title+'”? This permanently removes the saved transcript.')) return
    setDeleting(item.id);setError('')
    try {
      await api.delete('/transcriptions/'+item.id)
      setNotice('Transcription deleted.')
      if (page>1 && d.items.length===1) setParams({q,page:String(page-1)})
      else resource.retry()
    } catch(e){setError(problem(e))} finally{setDeleting(null)}
  }
  return <><header className="page-heading"><div><h1>Transcription history</h1><p>Find, review, and manage your saved sessions.</p></div></header>
    <section className="panel"><div className="panel-head"><h2>Saved transcriptions</h2><form className="search" onSubmit={search}><Search size={16}/><input aria-label="Search transcriptions" maxLength={180} value={term} onChange={e=>setTerm(e.target.value)} placeholder="Search title or text"/><button>Search</button></form></div>
    {notice && <p role="status" className="notice">{notice}</p>}{error && <p role="alert" className="notice error">{error}</p>}<FetchState resource={resource}/>
    {d && (d.items.length ? <div className="table-scroll"><table><thead><tr>{['Title','Preview','Language','Duration','Created','Actions'].map(label=><th key={label}>{label}</th>)}</tr></thead>
    <tbody>{d.items.map(item=><tr key={item.id}><td><Link to={'/history/'+item.id}>{item.title}</Link></td><td className="preview">{item.content}</td><td><span className="tag">{languages[item.language]}</span></td><td>{clock(item.duration)}</td><td>{dateLabel(item.created_at)}</td><td><div className="actions"><Link aria-label={'View '+item.title} to={'/history/'+item.id}><Eye size={16}/></Link><Link aria-label={'Edit '+item.title} to={'/history/'+item.id+'/edit'}><Pencil size={16}/></Link><button disabled={!!deleting} aria-label={'Delete '+item.title} onClick={()=>remove(item)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div> : <Empty filtered={!!q}/>)}
    {d && (d.total>12||page>1) && <nav className="pagination" aria-label="Pagination"><button disabled={page<=1} onClick={()=>setParams({q,page:String(page-1)})}><ChevronLeft size={16}/>Previous</button>Page {page}<button disabled={page*12>=d.total} onClick={()=>setParams({q,page:String(page+1)})}>Next<ChevronRight size={16}/></button></nav>}</section></>
}
