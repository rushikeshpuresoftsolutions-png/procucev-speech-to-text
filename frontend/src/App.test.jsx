import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { api } from './services/api'

const item = { id: 7, title: 'Project review', content: 'आज meeting है', language:'mixed', duration: 10,
  created_at:'2026-06-01T12:00:00+00:00',updated_at:'2026-06-01T12:00:00+00:00' }
const open = (path='/') => render(<MemoryRouter initialEntries={[path]}><App/></MemoryRouter>)
const button = name => screen.getByRole('button',{name})
let rows, stream, stopTrack, socket, recorder

beforeEach(()=>{
  rows=[{...item}]
  vi.spyOn(api,'get').mockImplementation(async path=>{
    if(path.startsWith('/dashboard')) return {data:{total:rows.length,today:1,duration:10,recent:rows}}
    if(path.startsWith('/transcriptions?')) return {data:{items:rows,total:rows.length}}
    return {data:rows.find(r=>r.id===Number(path.split('/').pop()))}
  })
  vi.spyOn(api,'put').mockImplementation(async (path,body)=>{ Object.assign(rows[0],body); return {data:rows[0]} })
  vi.spyOn(api,'delete').mockImplementation(async ()=>{rows=[];return {}})
  vi.spyOn(api,'post').mockImplementation(async (path,body)=>{rows=[{...item,...body}];return {data:rows[0]}})
  stopTrack=vi.fn();stream={getTracks:()=>[{stop:stopTrack}]}
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue(stream)}})
  class Recorder {
    static isTypeSupported(){return true}
    constructor(){recorder=this;this.state='inactive'}
    start(){this.state='recording'}
    stop(){this.state='inactive';this.onstop?.()}
  }
  class Socket {
    static OPEN=1
    constructor(){socket=this;this.readyState=1;this.send=vi.fn()}
    close(){this.readyState=3}
  }
  vi.stubGlobal('MediaRecorder',Recorder);vi.stubGlobal('WebSocket',Socket)
})
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()})
const event = m=>act(()=>socket.onmessage({data:JSON.stringify(m)}))

describe('speech studio',()=>{
  it('loads dashboard metrics and navigates to the studio',async()=>{
    open();await screen.findByText(item.title)
    expect(screen.getByText('Total transcriptions')).toBeTruthy()
    fireEvent.click(screen.getByRole('link',{name:'New transcription'}))
    expect(button('Start recording')).toBeTruthy()
  })
  it('records, replaces partial updates, deduplicates final ids and saves edited text',async()=>{
    open('/studio')
    fireEvent.click(button('Start recording'));await waitFor(()=>expect(socket).toBeTruthy())
    act(()=>socket.onopen());event({type:'status',state:'ready'})
    expect(recorder.state).toBe('recording')
    event({type:'partial',text:'आज'});event({type:'partial',text:'आज meeting'})
    expect(screen.getByText('आज meeting')).toBeTruthy()
    const final={type:'final',id:1,text:'आज meeting है',language:'hi'}
    event(final);event(final);expect(screen.getByLabelText('Transcription').value).toBe(item.content)
    fireEvent.click(button('Stop recording'));expect(stopTrack).toHaveBeenCalled()
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({type:'stop'}))
    event({type:'status',state:'complete',duration:10})
    fireEvent.change(screen.getByLabelText('Title'),{target:{value:'Reviewed'}})
    fireEvent.change(screen.getByLabelText('Transcription'),{target:{value:'Edited words'}})
    fireEvent.click(button('Save transcription'));await screen.findByText('Transcription saved.')
    expect(api.post).toHaveBeenCalledWith('/transcriptions',{title:'Reviewed',content:'Edited words',duration:10,language:'hi'})
  })
  it('explains denied microphone access and allows retry',async()=>{
    navigator.mediaDevices.getUserMedia.mockRejectedValue(Object.assign(new Error(),{name:'NotAllowedError'}))
    open('/studio');fireEvent.click(button('Start recording'));expect((await screen.findByRole('alert')).textContent).toContain('denied')
    expect(button('Start recording').disabled).toBe(false)
  })
  it('lists, edits, searches and deletes after confirmation',async()=>{
    open('/history');await screen.findByText(item.title)
    fireEvent.click(screen.getByRole('link',{name:'Edit '+item.title}))
    const title=await screen.findByLabelText('Title')
    fireEvent.change(title,{target:{value:'Updated session'}});fireEvent.click(button('Save changes'))
    await screen.findByText('Updated session')
    fireEvent.click(screen.getByRole('navigation',{name:'Workspace'}).querySelector('a[href="/history"]'))
    await screen.findByText('Updated session')
    fireEvent.change(screen.getByLabelText('Search transcriptions'),{target:{value:'Updated'}})
    fireEvent.click(button('Search'));await waitFor(()=>expect(api.get.mock.calls.some(([url])=>url.includes('q=Updated'))).toBe(true))
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(false)
    fireEvent.click(button('Delete Updated session'));expect(api.delete).not.toHaveBeenCalled()
    confirm.mockReturnValue(true);fireEvent.click(button('Delete Updated session'))
    await screen.findByText('No matching transcriptions');expect(api.delete).toHaveBeenCalledWith('/transcriptions/7')
  })
  it('keeps the original content when editing is canceled',async()=>{
    open('/history/7/edit');const title=await screen.findByLabelText('Title')
    fireEvent.change(title,{target:{value:'Discard me'}});fireEvent.click(screen.getByRole('link',{name:'Cancel'}))
    await screen.findByText(item.title);expect(api.put).not.toHaveBeenCalled()
  })
})
