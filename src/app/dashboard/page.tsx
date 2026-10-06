'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const TASKS = [
  { id: 'workout1', emoji: '💪', label: 'ENTRENAR 45MIN #1' },
  { id: 'water', emoji: '💧', label: '4 LITROS DE AGUA' },
  { id: 'diet', emoji: '🥗', label: 'SEGUIR LA DIETA' },
  { id: 'read', emoji: '📖', label: 'LEER 10 PAGINAS' },
  { id: 'photo', emoji: '📸', label: 'FOTO DE PROGRESO' },
]

const APOYOS = ['🔥 VAMOS QUE NO LLEGAMOS AL DIA 75 DURMIENDO!', '😂 RECUERDA: YO TAMBIEN ESTOY CANSADA Y LO HICE IGUAL', '🥗 ESA PIZZA NO CUENTA COMO DIETA...', '📸 LA FOTO NO SE SACA SOLA!']

type Profile = { id: string; email: string; display_name: string | null; start_date: string }
type CheckIn = { user_id: string; day: number; tasks: string[] }
type Message = { id: string; from_user_id: string; message: string; created_at: string }

export default function Dashboard() {
  const [me, setMe] = useState<Profile | null>(null)
  const [other, setOther] = useState<Profile | null>(null)
  const [myCheckin, setMyCheckin] = useState<string[]>([])
  const [otherCheckin, setOtherCheckin] = useState<string[]>([])
  const [allMine, setAllMine] = useState<CheckIn[]>([])
  const [allOther, setAllOther] = useState<CheckIn[]>([])
  const [currentDay, setCurrentDay] = useState(1)
  const [selectedDay, setSelectedDay] = useState(1)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'hoy' | 'progreso'>('hoy')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [showApoyos, setShowApoyos] = useState(false)
  const [lastMsg, setLastMsg] = useState<Message | null>(null)
  const [showMsgBanner, setShowMsgBanner] = useState(false)
  const otherSubsRef = useRef<PushSubscriptionJSON[]>([])

  const router = useRouter()
  const supabase = createClient()
  const selectedDayRef = useRef(1)
  const meIdRef = useRef('')
  const otherIdRef = useRef('')

  useEffect(() => { selectedDayRef.current = selectedDay }, [selectedDay])

  function getStreak(checkins: CheckIn[], today: number): number {
    let streak = 0
    for (let d = today; d >= 1; d--) {
      const c = checkins.find(c => c.day === d)
      if (c && c.tasks.length === TASKS.length) streak++
      else break
    }
    return streak
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      meIdRef.current = user.id

      const { data: profiles } = await supabase.from('profiles').select('*')
      if (!profiles) return

      let myProf = profiles.find(p => p.id === user.id)
      if (!myProf) {
        const newProf = { id: user.id, email: user.email || '', display_name: null, start_date: new Date().toISOString().split('T')[0] }
        await supabase.from('profiles').upsert(newProf)
        myProf = newProf
      }
      if (!myProf.email) myProf.email = user.email || ''
      setMe(myProf)
      setNameInput(myProf.display_name || myProf.email?.split('@')[0] || '')

      const otherProf = profiles.find(p => p.id !== user.id) || null
      setOther(otherProf)
      if (otherProf) otherIdRef.current = otherProf.id

      const start = new Date(myProf.start_date)
      const today = new Date()
      const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      const day = Math.min(Math.max(diff, 1), 75)
      setCurrentDay(day)
      setSelectedDay(day)
      selectedDayRef.current = day

      const { data: checkins } = await supabase.from('checkins').select('*')
      const all: CheckIn[] = checkins || []
      const mine = all.filter(c => c.user_id === user.id)
      const theirs = otherProf ? all.filter(c => c.user_id === otherProf.id) : []
      setAllMine(mine)
      setAllOther(theirs)
      setMyCheckin(mine.find(c => c.day === day)?.tasks || [])
      setOtherCheckin(theirs.find(c => c.day === day)?.tasks || [])

      // Cargar mensajes
      const today = new Date().toISOString().split('T')[0]
      const { data: msgs } = await supabase.from('messages').select('*').gte('created_at', today).order('created_at', { ascending: false }).limit(20)
      setMessages(msgs || [])

      setLoading(false)

      // Push notifications
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js')
          const permission = await Notification.requestPermission()
          if (permission === 'granted') {
            let sub = await reg.pushManager.getSubscription()
            if (!sub) {
              sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
              })
            }
            const subJson = sub.toJSON()
            // Guardar en Supabase
            await supabase.from('push_subscriptions').upsert(
              { user_id: user.id, subscription: subJson },
              { onConflict: 'user_id' }
            )
            // Cargar suscripciones del otro
            if (otherProf) {
              const { data: otherSubs } = await supabase
                .from('push_subscriptions')
                .select('subscription')
                .eq('user_id', otherProf.id)
              otherSubsRef.current = (otherSubs || []).map((r: { subscription: PushSubscriptionJSON }) => r.subscription)
            }
          }
        } catch {
          // Push not supported or blocked — continue without it
        }
      }
    }
    init()
  }, [supabase, router])

  // Real-time checkins + messages
  useEffect(() => {
    const channel = supabase
      .channel('live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, (payload) => {
        const row = payload.new as CheckIn
        if (!row) return
        if (row.user_id === meIdRef.current) {
          setAllMine(prev => [...prev.filter(c => c.day !== row.day), row])
          if (row.day === selectedDayRef.current) setMyCheckin(row.tasks)
        } else if (row.user_id === otherIdRef.current) {
          setAllOther(prev => [...prev.filter(c => c.day !== row.day), row])
          if (row.day === selectedDayRef.current) setOtherCheckin(row.tasks)
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message
        if (!msg) return
        const todayDate = new Date().toISOString().split('T')[0]
        if (!msg.created_at.startsWith(todayDate)) return
        setMessages(prev => [msg, ...prev])
        // Mostrar banner solo si el mensaje es de la otra persona
        if (msg.from_user_id !== meIdRef.current) {
          setLastMsg(msg)
          setShowMsgBanner(true)
          setTimeout(() => setShowMsgBanner(false), 4000)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  async function sendApoyo(msg: string) {
    if (!me) return
    await supabase.from('messages').insert({ from_user_id: me.id, message: msg })
    setShowApoyos(false)
    // Enviar push si hay suscripciones del otro
    if (otherSubsRef.current.length > 0) {
      fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptions: otherSubsRef.current,
          title: `💪 ${myName} te manda apoyo!`,
          body: msg,
        }),
      }).catch(() => {})
    }
  }

  async function saveName() {
    if (!me || !nameInput.trim()) return
    const name = nameInput.trim().toUpperCase().slice(0, 10)
    await supabase.from('profiles').update({ display_name: name }).eq('id', me.id)
    setMe({ ...me, display_name: name })
    setEditingName(false)
  }

  async function toggleTask(taskId: string) {
    if (!me) return
    const updated = myCheckin.includes(taskId) ? myCheckin.filter(t => t !== taskId) : [...myCheckin, taskId]
    setMyCheckin(updated)
    await supabase.from('checkins').upsert(
      { user_id: me.id, day: selectedDay, tasks: updated, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,day' }
    )
    setAllMine(prev => [...prev.filter(c => c.day !== selectedDay), { user_id: me.id, day: selectedDay, tasks: updated }])
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const getDayCheckin = (checkins: CheckIn[], day: number) => checkins.find(c => c.day === day)?.tasks || []
  const getPerfectDays = (checkins: CheckIn[]) => checkins.filter(c => c.tasks.length === TASKS.length).length
  const myName = (me?.display_name || me?.email?.split('@')[0] || 'P1').toUpperCase().slice(0, 10)
  const otherName = (other?.display_name || other?.email?.split('@')[0] || 'P2').toUpperCase().slice(0, 10)

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg)' }}>
        <div className="text-4xl">🔥</div>
        <div className="blink" style={{ fontFamily: 'var(--pixel)', color: 'var(--yellow)', fontSize: '10px' }}>LOADING...</div>
      </div>
    )
  }

  const myDone = myCheckin.length === TASKS.length
  const otherDone = otherCheckin.length === TASKS.length
  const isToday = selectedDay === currentDay
  const pct = Math.round((currentDay / 75) * 100)
  const myStreak = getStreak(allMine, currentDay)
  const otherStreak = getStreak(allOther, currentDay)

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: 'var(--bg)', fontFamily: 'var(--pixel)' }}>
      <div className="stars" />
      <div className="scanlines" />

      {/* Banner mensaje entrante */}
      {showMsgBanner && lastMsg && (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 py-3 text-center"
             style={{ background: 'var(--purple)', borderBottom: '3px solid var(--white)', fontSize: '9px', color: 'white' }}>
          ❤️ {otherName}: {lastMsg.message}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 px-3 py-2" style={{ background: 'var(--bg)', borderBottom: '3px solid var(--yellow)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div style={{ color: 'var(--yellow)', fontSize: '11px', textShadow: '2px 2px 0 #7a3a00' }}>🔥 RETO 75</div>
            <div style={{ color: 'var(--cyan)', fontSize: '7px', marginTop: '2px' }}>DIA {currentDay}/75 — {pct}%</div>
          </div>
          <div className="flex items-center gap-2">
            {/* Racha */}
            {myStreak > 0 && (
              <div className="px-2 py-1" style={{ background: 'var(--bg2)', border: '2px solid var(--orange)', fontSize: '7px', color: 'var(--orange)' }}>
                🔥{myStreak}
              </div>
            )}
            <button onClick={signOut} className="pixel-btn px-2 py-1" style={{ background: 'var(--bg3)', color: 'var(--gray)', fontSize: '7px' }}>EXIT</button>
          </div>
        </div>
        <div className="mt-2 h-2" style={{ background: 'var(--bg3)', border: '2px solid var(--gray)' }}>
          <div className="h-full" style={{ width: `${pct}%`, background: 'var(--cyan)' }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-3 pt-3 gap-2">
        {(['hoy', 'progreso'] as const).map(tab => (
          <button key={tab} onClick={() => setView(tab)} className="flex-1 py-2"
            style={view === tab
              ? { background: 'var(--yellow)', color: '#0a0a1a', fontFamily: 'var(--pixel)', fontSize: '8px', border: '3px solid var(--white)', boxShadow: '3px 3px 0 #7a3a00' }
              : { background: 'var(--bg2)', color: 'var(--gray)', fontFamily: 'var(--pixel)', fontSize: '8px', border: '3px solid var(--gray)' }}>
            {tab === 'hoy' ? '▶ HOY' : '★ SCORE'}
          </button>
        ))}
      </div>

      {view === 'hoy' && (
        <div className="px-3 mt-4 space-y-4 relative z-10">
          {/* Day nav */}
          <div className="flex items-center justify-between">
            <button onClick={() => { const d = Math.max(1, selectedDay-1); setSelectedDay(d); selectedDayRef.current=d; setMyCheckin(getDayCheckin(allMine,d)); setOtherCheckin(getDayCheckin(allOther,d)) }}
              disabled={selectedDay<=1} className="pixel-btn w-10 h-10 flex items-center justify-center"
              style={{ background:'var(--bg2)', color:'var(--white)', fontSize:'14px', border:'3px solid var(--gray)', boxShadow:'3px 3px 0 #000' }}>◄</button>
            <div className="text-center">
              <div style={{ color:'var(--yellow)', fontSize:'12px', textShadow:'2px 2px 0 #7a3a00' }}>DIA {selectedDay}</div>
              {!isToday && <div className="blink mt-1" style={{ color:'var(--red)', fontSize:'7px' }}>READ ONLY</div>}
            </div>
            <button onClick={() => { const d = Math.min(currentDay, selectedDay+1); setSelectedDay(d); selectedDayRef.current=d; setMyCheckin(getDayCheckin(allMine,d)); setOtherCheckin(getDayCheckin(allOther,d)) }}
              disabled={selectedDay>=currentDay} className="pixel-btn w-10 h-10 flex items-center justify-center"
              style={{ background:'var(--bg2)', color:'var(--white)', fontSize:'14px', border:'3px solid var(--gray)', boxShadow:'3px 3px 0 #000' }}>►</button>
          </div>

          {/* P1 */}
          <div style={{ border:'3px solid var(--cyan)', background:'var(--bg2)', boxShadow:'4px 4px 0 #000' }}>
            <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom:'3px solid var(--cyan)', background:'#001a1a' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 flex items-center justify-center font-black" style={{ background:'var(--cyan)', color:'#001a1a', fontSize:'9px' }}>{myName[0]}</div>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input value={nameInput} onChange={e => setNameInput(e.target.value.toUpperCase().slice(0,10))}
                      onKeyDown={e => e.key==='Enter' && saveName()} autoFocus
                      className="px-2 py-1 focus:outline-none w-24"
                      style={{ background:'var(--bg)', border:'2px solid var(--cyan)', color:'var(--cyan)', fontFamily:'var(--pixel)', fontSize:'8px' }} />
                    <button onClick={saveName} style={{ color:'var(--green)', fontFamily:'var(--pixel)', fontSize:'8px' }}>OK</button>
                  </div>
                ) : (
                  <button onClick={() => setEditingName(true)}>
                    <span style={{ color:'var(--cyan)', fontSize:'9px' }}>P1: {myName}</span>
                    <span style={{ color:'var(--gray)', fontSize:'7px', marginLeft:'4px' }}>✏</span>
                  </button>
                )}
                {myStreak >= 2 && <span style={{ color:'var(--orange)', fontSize:'8px' }}>🔥{myStreak}</span>}
              </div>
              <span style={{ color: myDone ? 'var(--green)' : 'var(--yellow)', fontSize:'9px' }}>
                {myDone ? '★ PERFECT!' : `${myCheckin.length}/${TASKS.length}`}
              </span>
            </div>
            {TASKS.map((task, i) => {
              const done = myCheckin.includes(task.id)
              return (
                <button key={task.id} onClick={() => isToday && toggleTask(task.id)}
                  className="w-full flex items-center gap-3 px-3 py-3"
                  style={{ background: done ? '#001a00' : 'transparent', borderTop: i>0 ? '2px solid #1a1a3a' : 'none', cursor: isToday ? 'pointer' : 'default' }}>
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0"
                    style={{ border:`2px solid ${done ? 'var(--green)' : 'var(--gray)'}`, background: done ? 'var(--green)' : 'transparent' }}>
                    {done && <span style={{ color:'#001a00', fontSize:'8px', fontWeight:'bold' }}>✓</span>}
                  </div>
                  <span style={{ color: done ? 'var(--green)' : 'var(--gray)', fontSize:'8px', textAlign:'left' }}>{task.emoji} {task.label}</span>
                </button>
              )
            })}
          </div>

          {/* Botón apoyo */}
          <div className="relative">
            <button onClick={() => setShowApoyos(!showApoyos)}
              className="pixel-btn w-full py-2.5"
              style={{ background:'var(--purple)', color:'white', fontSize:'8px', border:'3px solid var(--white)', boxShadow:'3px 3px 0 #3a0060' }}>
              ❤️ MANDAR APOYO A {otherName}
            </button>
            {showApoyos && (
              <div className="absolute left-0 right-0 z-20 mt-1" style={{ background:'var(--bg2)', border:'3px solid var(--purple)', boxShadow:'4px 4px 0 #000' }}>
                {APOYOS.map(msg => (
                  <button key={msg} onClick={() => sendApoyo(msg)}
                    className="w-full px-3 py-3 text-left"
                    style={{ fontSize:'8px', color:'var(--white)', borderBottom:'2px solid #1a1a3a' }}>
                    {msg}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mensajes recientes */}
          {messages.length > 0 && (
            <div style={{ border:'3px solid var(--gray)', background:'var(--bg2)', boxShadow:'4px 4px 0 #000' }}>
              <div className="px-3 py-2" style={{ borderBottom:'3px solid var(--gray)', background:'var(--bg3)' }}>
                <span style={{ color:'var(--gray)', fontSize:'8px' }}>❤️ MENSAJES</span>
              </div>
              {messages.slice(0, 3).map(msg => {
                const fromMe = msg.from_user_id === me?.id
                return (
                  <div key={msg.id} className="px-3 py-2" style={{ borderBottom:'1px solid #1a1a3a' }}>
                    <span style={{ color: fromMe ? 'var(--cyan)' : 'var(--purple)', fontSize:'7px' }}>
                      {fromMe ? myName : otherName}:
                    </span>
                    <span style={{ color:'var(--white)', fontSize:'7px', marginLeft:'6px' }}>{msg.message}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* P2 */}
          <div style={{ border:'3px solid var(--purple)', background:'var(--bg2)', boxShadow:'4px 4px 0 #000' }}>
            <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom:'3px solid var(--purple)', background:'#0f001a' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 flex items-center justify-center font-black" style={{ background:'var(--purple)', color:'#0f001a', fontSize:'9px' }}>
                  {other ? otherName[0] : '?'}
                </div>
                <span style={{ color:'var(--purple)', fontSize:'9px' }}>P2: {other ? otherName : <span className="blink">OFFLINE</span>}</span>
                {otherStreak >= 2 && <span style={{ color:'var(--orange)', fontSize:'8px' }}>🔥{otherStreak}</span>}
              </div>
              {other && (
                <span style={{ color: otherDone ? 'var(--green)' : 'var(--yellow)', fontSize:'9px' }}>
                  {otherDone ? '★ PERFECT!' : `${otherCheckin.length}/${TASKS.length}`}
                </span>
              )}
            </div>
            {TASKS.map((task, i) => {
              const done = other ? otherCheckin.includes(task.id) : false
              return (
                <div key={task.id} className="flex items-center gap-3 px-3 py-3"
                  style={{ background: done ? '#0f001a' : 'transparent', borderTop: i>0 ? '2px solid #1a1a3a' : 'none', opacity: !other ? 0.3 : 1 }}>
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0"
                    style={{ border:`2px solid ${done ? 'var(--purple)' : 'var(--gray)'}`, background: done ? 'var(--purple)' : 'transparent' }}>
                    {done && <span style={{ color:'white', fontSize:'8px', fontWeight:'bold' }}>✓</span>}
                  </div>
                  <span style={{ color: done ? 'var(--purple)' : 'var(--gray)', fontSize:'8px' }}>{task.emoji} {task.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'progreso' && (
        <div className="px-3 mt-4 space-y-4 relative z-10">
          {/* Rachas */}
          <div style={{ border:'3px solid var(--orange)', background:'var(--bg2)', boxShadow:'4px 4px 0 #000' }}>
            <div className="px-3 py-2 text-center" style={{ borderBottom:'3px solid var(--orange)', background:'#1a0800' }}>
              <span style={{ color:'var(--orange)', fontSize:'9px' }}>🔥 RACHAS ACTUALES</span>
            </div>
            <div className="px-3 py-3 space-y-2">
              <div className="flex justify-between items-center">
                <span style={{ color:'var(--cyan)', fontSize:'8px' }}>{myName}</span>
                <span style={{ color:'var(--orange)', fontSize:'14px', textShadow:'2px 2px 0 #7a3a00' }}>🔥{myStreak}</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color:'var(--purple)', fontSize:'8px' }}>{other ? otherName : 'P2'}</span>
                <span style={{ color:'var(--orange)', fontSize:'14px', textShadow:'2px 2px 0 #7a3a00' }}>🔥{otherStreak}</span>
              </div>
            </div>
          </div>

          {/* High scores */}
          <div style={{ border:'3px solid var(--yellow)', background:'var(--bg2)', boxShadow:'4px 4px 0 #000' }}>
            <div className="px-3 py-2 text-center" style={{ borderBottom:'3px solid var(--yellow)', background:'#1a1000' }}>
              <span style={{ color:'var(--yellow)', fontSize:'9px' }}>★ DIAS PERFECTOS ★</span>
            </div>
            <div className="px-3 py-3 space-y-3">
              <div className="flex justify-between items-center">
                <span style={{ color:'var(--cyan)', fontSize:'8px' }}>{myName}</span>
                <span style={{ color:'var(--yellow)', fontSize:'12px', textShadow:'2px 2px 0 #7a3a00' }}>{String(getPerfectDays(allMine)).padStart(3,'0')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color:'var(--purple)', fontSize:'8px' }}>{other ? otherName : '???'}</span>
                <span style={{ color:'var(--yellow)', fontSize:'12px', textShadow:'2px 2px 0 #7a3a00' }}>{String(getPerfectDays(allOther)).padStart(3,'0')}</span>
              </div>
              <div style={{ borderTop:'2px solid var(--gray)', paddingTop:'8px' }}>
                <div className="flex justify-between" style={{ color:'var(--gray)', fontSize:'7px' }}>
                  <span>PROGRESO</span><span>{currentDay}/75</span>
                </div>
                <div className="mt-1 h-3" style={{ background:'var(--bg3)', border:'2px solid var(--gray)' }}>
                  <div className="h-full" style={{ width:`${pct}%`, background:'var(--cyan)', boxShadow:'0 0 6px var(--cyan)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Mapa */}
          <div style={{ border:'3px solid var(--gray)', background:'var(--bg2)', boxShadow:'4px 4px 0 #000' }}>
            <div className="px-3 py-2" style={{ borderBottom:'3px solid var(--gray)', background:'var(--bg3)' }}>
              <span style={{ color:'var(--gray)', fontSize:'8px' }}>★ MAP — 75 NIVELES</span>
            </div>
            <div className="p-3">
              <div className="grid gap-1" style={{ gridTemplateColumns:'repeat(15, 1fr)' }}>
                {Array.from({ length: 75 }, (_, i) => {
                  const day = i + 1
                  const md = getDayCheckin(allMine, day).length === TASKS.length
                  const od = other ? getDayCheckin(allOther, day).length === TASKS.length : false
                  const mp = !md && getDayCheckin(allMine, day).length > 0
                  let bg = '#1a1a3a', color = '#4a4a7a'
                  if (md && od) { bg='#00ff88'; color='#000' }
                  else if (md) { bg='#22d3ee'; color='#000' }
                  else if (od) { bg='#a855f7'; color='#fff' }
                  else if (mp) { bg='#004455' }
                  else if (day > currentDay) { bg='#0f0f2a' }
                  return (
                    <div key={day} className="aspect-square flex items-center justify-center"
                      style={{ background:bg, color, fontSize:'6px', fontFamily:'var(--pixel)',
                        outline: day===currentDay ? '2px solid var(--yellow)' : 'none', outlineOffset:'1px' }}>
                      {day}
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-3 mt-3" style={{ fontSize:'7px', color:'var(--gray)' }}>
                <span>■ <span style={{ color:'var(--cyan)' }}>{myName}</span></span>
                <span>■ <span style={{ color:'var(--purple)' }}>{other ? otherName : 'P2'}</span></span>
                <span>■ <span style={{ color:'#00ff88' }}>AMBAS</span></span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ border:'3px solid var(--gray)', background:'var(--bg2)', boxShadow:'4px 4px 0 #000' }}>
            <div className="px-3 py-2" style={{ borderBottom:'3px solid var(--gray)', background:'var(--bg3)' }}>
              <span style={{ color:'var(--gray)', fontSize:'8px' }}>★ STATS</span>
            </div>
            <div className="p-3 space-y-3">
              {TASKS.map(task => {
                const mc = allMine.filter(c => c.tasks.includes(task.id)).length
                const oc = allOther.filter(c => c.tasks.includes(task.id)).length
                return (
                  <div key={task.id}>
                    <div className="flex justify-between mb-1">
                      <span style={{ color:'var(--gray)', fontSize:'7px' }}>{task.emoji} {task.label}</span>
                      <span style={{ color:'var(--cyan)', fontSize:'7px' }}>{mc}D</span>
                    </div>
                    <div className="h-2 mb-0.5" style={{ background:'var(--bg3)', border:'1px solid var(--gray)' }}>
                      <div className="h-full" style={{ width:`${(mc/75)*100}%`, background:'var(--cyan)' }} />
                    </div>
                    <div className="h-1.5" style={{ background:'var(--bg3)', border:'1px solid var(--gray)' }}>
                      <div className="h-full" style={{ width:`${(oc/75)*100}%`, background:'var(--purple)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
