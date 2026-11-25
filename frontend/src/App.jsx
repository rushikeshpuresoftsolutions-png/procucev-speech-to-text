import React from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { AudioLines, CalendarDays, ChevronRight, FolderClock, LayoutDashboard, Mic, PanelLeft } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Studio from './pages/Studio'
import History from './pages/History'
import Detail from './pages/Detail'

const pages = [['/',LayoutDashboard,'Dashboard'],['/studio',Mic,'Live studio'],['/history',FolderClock,'History']]
export default function App() {
  const location=useLocation()
  const name=location.pathname.startsWith('/history')?'History':location.pathname==='/studio'?'Live studio':'Dashboard'
  return <div className="shell"><aside><Link className="brand" to="/"><span><AudioLines size={25}/></span><div>Procucev<small>Speech Studio</small></div></Link>
    <div className="nav-label">WORKSPACE</div><nav aria-label="Workspace">{pages.map(([path,Icon,label])=><NavLink key={path} to={path} end={path==='/'} className={({isActive})=>isActive?'nav-item active':'nav-item'}><Icon size={18}/>{label}</NavLink>)}</nav>
    <div className="side-foot"><AudioLines size={17}/><div>Speech engine<small>Faster-Whisper</small></div></div></aside>
    <div className="workspace"><header className="topbar"><div><PanelLeft size={16}/> Workspace <ChevronRight size={13}/><strong>{name}</strong></div><span><CalendarDays size={15}/>{new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span></header>
    <main><Routes><Route path="/" element={<Dashboard/>}/><Route path="/studio" element={<Studio/>}/><Route path="/history" element={<History/>}/><Route path="/history/:id" element={<Detail key={location.key}/>}/><Route path="/history/:id/edit" element={<Detail key={location.key} edit/>}/><Route path="*" element={<section className="panel form"><h1>Page not found</h1><Link to="/">Return to dashboard</Link></section>}/></Routes></main></div></div>
}
