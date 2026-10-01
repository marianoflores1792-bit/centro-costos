'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const TASKS = [
  { id: 'workout1', emoji: '💪', label: 'ENTRENAR 45MIN #1' },
  { id: 'workout2', emoji: '🏃', label: 'ENTRENAR 45MIN #2' },
  { id: 'water', emoji: '💧', label: '4 LITROS DE AGUA' },
  { id: 'diet', emoji: '🥗', label: 'SEGUIR LA DIETA' },
  { id: 'read', emoji: '📖', label: 'LEER 10 PAGINAS' },
  { id: 'photo', emoji: '📸', label: 'FOTO DE PROGRESO' },
]

type Profile = {
  id: string
  email: string
  friend_email: string | null
  start_date: string
  display_name: string | null
}

type CheckIn = {
  user_id: string
  day: number
  tasks: string[]
  updated_at: string
}

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [friendProfile, setFriendProfile] = useState<Profile | null>(null)
  const [myCheckin, setMyCheckin] = useState<string[]>([])
  const [friendCheckin, setFriendCheckin] = useState<string[]>([])
  const [currentDay, setCurrentDay] = useState(1)
  const [selectedDay, setSelectedDay] = useState(1)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'hoy' | 'progreso'>('hoy')
  const [allMyCheckins, setAllMyCheckins] = useState<CheckIn[]>([])
  const [allFriendCheckins, setAllFriendCheckins] = useState<CheckIn[]>([])
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const getDayCheckin = (checkins: CheckIn[], day: number) =>
    checkins.find(c => c.day === day)?.tasks || []

  const loadData = useCallback(async (userId: string, friendId: string | null, day: number) => {
    const userIds = friendId ? [userId, friendId] : [userId]
    const { data } = await supabase.from('checkins').select('*').in('user_id', userIds)
    const all: CheckIn[] = data || []
    const mine = all.filter(c => c.user_id === userId)
    const friend = friendId ? all.filter(c => c.user_id === friendId) : []
    setAllMyCheckins(mine)
    setAllFriendCheckins(friend)
    setMyCheckin(mine.find(c => c.day === day)?.tasks || [])
    setFriendCheckin(friend.find(c => c.day === day)?.tasks || [])
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      let { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!prof) {
        prof = { id: user.id, email: user.email || '', friend_email: null, start_date: new Date().toISOString().split('T')[0], display_name: null }
        await supabase.from('profiles').upsert(prof)
      }
      setProfile(prof)
      setNameInput(prof.display_name || prof.email.split('@')[0])

      const start = new Date(prof.start_date)
      const today = new Date()
      const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      const day = Math.min(Math.max(diff, 1), 75)
      setCurrentDay(day)
      setSelectedDay(day)

      let friendId: string | null = null
      if (prof.friend_email) {
        const { data: fp } = await supabase.from('profiles').select('*').eq('email', prof.friend_email).single()
        if (fp) { setFriendProfile(fp); friendId = fp.id }
      }

      await loadData(user.id, friendId, day)
      setLoading(false)

      // Suscripción real-time
      const channel = supabase
        .channel('checkins-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, (payload) => {
          const row = payload.new as CheckIn
          if (!row) return

          if (row.user_id === user.id) {
            setAllMyCheckins(prev => {
              const without = prev.filter(c => c.day !== row.day)
              return [...without, row]
            })
            setSelectedDay(prev => {
              if (prev === row.day) setMyCheckin(row.tasks)
              return prev
            })
          } else if (friendId && row.user_id === friendId) {
            setAllFriendCheckins(prev => {
              const without = prev.filter(c => c.day !== row.day)
              return [...without, row]
            })
            setSelectedDay(prev => {
              if (prev === row.day) setFriendCheckin(row.tasks)
              return prev
            })
          }
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    init()
  }, [supabase, router, loadData])

  async function saveName() {
    if (!profile || !nameInput.trim()) return
    const name = nameInput.trim().toUpperCase().slice(0, 10)
    await supabase.from('profiles').update({ display_name: name }).eq('id', profile.id)
    setProfile({ ...profile, display_name: name })
    setEditingName(false)
  }

  async function toggleTask(taskId: string) {
    if (!profile) return
    const updated = myCheckin.includes(taskId)
      ? myCheckin.filter(t => t !== taskId)
      : [...myCheckin, taskId]
    setMyCheckin(updated)

    await supabase.from('checkins').upsert({
      user_id: profile.id,
      day: selectedDay,
      tasks: updated,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,day' })

    setAllMyCheckins(prev => {
      const without = prev.filter(c => c.day !== selectedDay)
      return [...without, { user_id: profile.id, day: selectedDay, tasks: updated, updated_at: new Date().toISOString() }]
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function getCompletedCount(checkins: CheckIn[]) {
    return checkins.filter(c => c.tasks.length === TASKS.length).length
  }

  const myDisplayName = (profile?.display_name || profile?.email.split('@')[0] || 'P1').toUpperCase().slice(0, 10)
  const friendDisplayName = (friendProfile?.display_name || friendProfile?.email.split('@')[0] || 'P2').toUpperCase().slice(0, 10)

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg)' }}>
        <div className="text-4xl">🔥</div>
        <div className="blink" style={{ fontFamily: 'var(--pixel)', color: 'var(--yellow)', fontSize: '10px' }}>LOADING...</div>
      </div>
    )
  }

  const allTasksDone = myCheckin.length === TASKS.length
  const friendAllDone = friendCheckin.length === TASKS.length
  const isToday = selectedDay === currentDay
  const pct = Math.round((currentDay / 75) * 100)

  return (
    <div className="min-h-screen pb-24 relative" style={{ background: 'var(--bg)', fontFamily: 'var(--pixel)' }}>
      <div className="stars" />
      <div className="scanlines" />

      {/* Header */}
      <div className="sticky top-0 z-10 px-3 py-2" style={{ background: 'var(--bg)', borderBottom: '3px solid var(--yellow)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div style={{ color: 'var(--yellow)', fontSize: '11px', textShadow: '2px 2px 0 #7a3a00' }}>🔥 RETO 75</div>
            <div style={{ color: 'var(--cyan)', fontSize: '7px', marginTop: '2px' }}>DIA {currentDay}/75 — {pct}%</div>
          </div>
          <div className="flex items-center gap-3">
            <div style={{ color: 'var(--red)', fontSize: '12px' }}>
              {Array.from({ length: Math.min(3, Math.floor(getCompletedCount(allMyCheckins) / 5) + 1) }).map((_, i) => (
                <span key={i}>❤️</span>
              ))}
            </div>
            <button onClick={signOut} className="pixel-btn px-2 py-1" style={{ background: 'var(--bg3)', color: 'var(--gray)', fontSize: '7px' }}>
              EXIT
            </button>
          </div>
        </div>
        {/* XP bar */}
        <div className="mt-2 h-2" style={{ background: 'var(--bg3)', border: '2px solid var(--gray)' }}>
          <div className="h-full" style={{ width: `${pct}%`, background: 'var(--cyan)' }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-3 pt-3 gap-2">
        {(['hoy', 'progreso'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className="flex-1 py-2"
            style={view === tab
              ? { background: 'var(--yellow)', color: '#0a0a1a', fontFamily: 'var(--pixel)', fontSize: '8px', border: '3px solid var(--white)', boxShadow: '3px 3px 0 #7a3a00' }
              : { background: 'var(--bg2)', color: 'var(--gray)', fontFamily: 'var(--pixel)', fontSize: '8px', border: '3px solid var(--gray)' }}
          >
            {tab === 'hoy' ? '▶ HOY' : '★ SCORE'}
          </button>
        ))}
      </div>

      {view === 'hoy' && (
        <div className="px-3 mt-4 space-y-4 relative z-10">
          {/* Day selector */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                const newDay = Math.max(1, selectedDay - 1)
                setSelectedDay(newDay)
                setMyCheckin(getDayCheckin(allMyCheckins, newDay))
                setFriendCheckin(getDayCheckin(allFriendCheckins, newDay))
              }}
              disabled={selectedDay <= 1}
              className="pixel-btn w-10 h-10 flex items-center justify-center"
              style={{ background: 'var(--bg2)', color: 'var(--white)', fontSize: '14px', border: '3px solid var(--gray)', boxShadow: '3px 3px 0 #000' }}
            >◄</button>
            <div className="text-center">
              <div style={{ color: 'var(--yellow)', fontSize: '12px', textShadow: '2px 2px 0 #7a3a00' }}>DIA {selectedDay}</div>
              {!isToday && <div className="blink mt-1" style={{ color: 'var(--red)', fontSize: '7px' }}>READ ONLY</div>}
            </div>
            <button
              onClick={() => {
                const newDay = Math.min(currentDay, selectedDay + 1)
                setSelectedDay(newDay)
                setMyCheckin(getDayCheckin(allMyCheckins, newDay))
                setFriendCheckin(getDayCheckin(allFriendCheckins, newDay))
              }}
              disabled={selectedDay >= currentDay}
              className="pixel-btn w-10 h-10 flex items-center justify-center"
              style={{ background: 'var(--bg2)', color: 'var(--white)', fontSize: '14px', border: '3px solid var(--gray)', boxShadow: '3px 3px 0 #000' }}
            >►</button>
          </div>

          {/* PLAYER 1 */}
          <div style={{ border: '3px solid var(--cyan)', background: 'var(--bg2)', boxShadow: '4px 4px 0 #000' }}>
            <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '3px solid var(--cyan)', background: '#001a1a' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 flex items-center justify-center font-black" style={{ background: 'var(--cyan)', color: '#001a1a', fontSize: '9px' }}>
                  {myDisplayName[0]}
                </div>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value.toUpperCase().slice(0, 10))}
                      onKeyDown={e => e.key === 'Enter' && saveName()}
                      autoFocus
                      className="px-2 py-1 focus:outline-none w-24"
                      style={{ background: 'var(--bg)', border: '2px solid var(--cyan)', color: 'var(--cyan)', fontFamily: 'var(--pixel)', fontSize: '8px' }}
                    />
                    <button onClick={saveName} style={{ color: 'var(--green)', fontFamily: 'var(--pixel)', fontSize: '8px' }}>OK</button>
                  </div>
                ) : (
                  <button onClick={() => setEditingName(true)}>
                    <span style={{ color: 'var(--cyan)', fontSize: '9px' }}>P1: {myDisplayName}</span>
                    <span style={{ color: 'var(--gray)', fontSize: '7px', marginLeft: '4px' }}>✏</span>
                  </button>
                )}
              </div>
              <span style={{ color: allTasksDone ? 'var(--green)' : 'var(--yellow)', fontSize: '9px' }}>
                {allTasksDone ? '★ PERFECT!' : `${myCheckin.length}/${TASKS.length}`}
              </span>
            </div>
            {TASKS.map((task, i) => {
              const done = myCheckin.includes(task.id)
              return (
                <button
                  key={task.id}
                  onClick={() => isToday && toggleTask(task.id)}
                  className="w-full flex items-center gap-3 px-3 py-3"
                  style={{
                    background: done ? '#001a00' : 'transparent',
                    borderTop: i > 0 ? '2px solid #1a1a3a' : 'none',
                    cursor: isToday ? 'pointer' : 'default',
                  }}
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0"
                       style={{ border: `2px solid ${done ? 'var(--green)' : 'var(--gray)'}`, background: done ? 'var(--green)' : 'transparent' }}>
                    {done && <span style={{ color: '#001a00', fontSize: '8px', fontWeight: 'bold' }}>✓</span>}
                  </div>
                  <span style={{ color: done ? 'var(--green)' : 'var(--gray)', fontSize: '8px', textAlign: 'left' }}>
                    {task.emoji} {task.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* PLAYER 2 */}
          <div style={{ border: '3px solid var(--purple)', background: 'var(--bg2)', boxShadow: '4px 4px 0 #000' }}>
            <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '3px solid var(--purple)', background: '#0f001a' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 flex items-center justify-center font-black" style={{ background: 'var(--purple)', color: '#0f001a', fontSize: '9px' }}>
                  {friendProfile ? friendDisplayName[0] : '?'}
                </div>
                <div>
                  <span style={{ color: 'var(--purple)', fontSize: '9px' }}>P2: {friendProfile ? friendDisplayName : 'AMIGA'}</span>
                  {!friendProfile && (
                    <span className="blink ml-2" style={{ color: 'var(--gray)', fontSize: '7px' }}>
                      {profile?.friend_email ? 'OFFLINE' : '???'}
                    </span>
                  )}
                </div>
              </div>
              {friendProfile && (
                <span style={{ color: friendAllDone ? 'var(--green)' : 'var(--yellow)', fontSize: '9px' }}>
                  {friendAllDone ? '★ PERFECT!' : `${friendCheckin.length}/${TASKS.length}`}
                </span>
              )}
            </div>
            {TASKS.map((task, i) => {
              const done = friendProfile ? friendCheckin.includes(task.id) : false
              return (
                <div key={task.id} className="flex items-center gap-3 px-3 py-3"
                     style={{
                       background: done ? '#0f001a' : 'transparent',
                       borderTop: i > 0 ? '2px solid #1a1a3a' : 'none',
                       opacity: !friendProfile ? 0.3 : 1,
                     }}>
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0"
                       style={{ border: `2px solid ${done ? 'var(--purple)' : 'var(--gray)'}`, background: done ? 'var(--purple)' : 'transparent' }}>
                    {done && <span style={{ color: 'white', fontSize: '8px', fontWeight: 'bold' }}>✓</span>}
                  </div>
                  <span style={{ color: done ? 'var(--purple)' : 'var(--gray)', fontSize: '8px' }}>
                    {task.emoji} {task.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'progreso' && (
        <div className="px-3 mt-4 space-y-4 relative z-10">
          {/* Score board */}
          <div style={{ border: '3px solid var(--yellow)', background: 'var(--bg2)', boxShadow: '4px 4px 0 #000' }}>
            <div className="px-3 py-2 text-center" style={{ borderBottom: '3px solid var(--yellow)', background: '#1a1000' }}>
              <span style={{ color: 'var(--yellow)', fontSize: '9px' }}>★ HIGH SCORES ★</span>
            </div>
            <div className="px-3 py-3 space-y-3">
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--cyan)', fontSize: '8px' }}>P1 {myDisplayName}</span>
                <span style={{ color: 'var(--yellow)', fontSize: '12px', textShadow: '2px 2px 0 #7a3a00' }}>{String(getCompletedCount(allMyCheckins)).padStart(3, '0')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--purple)', fontSize: '8px' }}>P2 {friendProfile ? friendDisplayName : 'AMIGA'}</span>
                <span style={{ color: 'var(--yellow)', fontSize: '12px', textShadow: '2px 2px 0 #7a3a00' }}>{String(getCompletedCount(allFriendCheckins)).padStart(3, '0')}</span>
              </div>
              <div style={{ borderTop: '2px solid var(--gray)', paddingTop: '8px' }}>
                <div className="flex justify-between" style={{ color: 'var(--gray)', fontSize: '7px' }}>
                  <span>PROGRESO</span>
                  <span>{currentDay}/75</span>
                </div>
                <div className="mt-1 h-3" style={{ background: 'var(--bg3)', border: '2px solid var(--gray)' }}>
                  <div className="h-full" style={{ width: `${pct}%`, background: 'var(--cyan)', boxShadow: '0 0 6px var(--cyan)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Map/Calendar */}
          <div style={{ border: '3px solid var(--gray)', background: 'var(--bg2)', boxShadow: '4px 4px 0 #000' }}>
            <div className="px-3 py-2" style={{ borderBottom: '3px solid var(--gray)', background: 'var(--bg3)' }}>
              <span style={{ color: 'var(--gray)', fontSize: '8px' }}>★ MAP — 75 NIVELES</span>
            </div>
            <div className="p-3">
              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
                {Array.from({ length: 75 }, (_, i) => {
                  const day = i + 1
                  const myDone = getDayCheckin(allMyCheckins, day).length === TASKS.length
                  const friendDone = friendProfile ? getDayCheckin(allFriendCheckins, day).length === TASKS.length : false
                  const myPartial = !myDone && getDayCheckin(allMyCheckins, day).length > 0
                  const isCurrentDay = day === currentDay
                  const isFuture = day > currentDay

                  let bg = '#1a1a3a'
                  let color = '#4a4a7a'
                  if (myDone && friendDone) { bg = '#00ff88'; color = '#000' }
                  else if (myDone) { bg = '#22d3ee'; color = '#000' }
                  else if (friendDone) { bg = '#a855f7'; color = '#fff' }
                  else if (myPartial) { bg = '#004455' }
                  else if (isFuture) { bg = '#0f0f2a' }

                  return (
                    <div key={day} className="aspect-square flex items-center justify-center"
                         style={{
                           background: bg,
                           color,
                           fontSize: '6px',
                           fontFamily: 'var(--pixel)',
                           outline: isCurrentDay ? '2px solid var(--yellow)' : 'none',
                           outlineOffset: '1px',
                           boxShadow: isCurrentDay ? '0 0 4px var(--yellow)' : 'none',
                         }}>
                      {day}
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-3 mt-3" style={{ fontSize: '7px', color: 'var(--gray)' }}>
                <span>■ <span style={{ color: 'var(--cyan)' }}>P1</span></span>
                <span>■ <span style={{ color: 'var(--purple)' }}>P2</span></span>
                <span>■ <span style={{ color: '#00ff88' }}>AMBAS</span></span>
              </div>
            </div>
          </div>

          {/* Task stats */}
          <div style={{ border: '3px solid var(--gray)', background: 'var(--bg2)', boxShadow: '4px 4px 0 #000' }}>
            <div className="px-3 py-2" style={{ borderBottom: '3px solid var(--gray)', background: 'var(--bg3)' }}>
              <span style={{ color: 'var(--gray)', fontSize: '8px' }}>★ STATS</span>
            </div>
            <div className="p-3 space-y-3">
              {TASKS.map(task => {
                const myCount = allMyCheckins.filter(c => c.tasks.includes(task.id)).length
                const friendCount = allFriendCheckins.filter(c => c.tasks.includes(task.id)).length
                return (
                  <div key={task.id}>
                    <div className="flex justify-between mb-1">
                      <span style={{ color: 'var(--gray)', fontSize: '7px' }}>{task.emoji} {task.label}</span>
                      <span style={{ color: 'var(--cyan)', fontSize: '7px' }}>{myCount}D</span>
                    </div>
                    <div className="h-2 mb-0.5" style={{ background: 'var(--bg3)', border: '1px solid var(--gray)' }}>
                      <div className="h-full" style={{ width: `${(myCount / 75) * 100}%`, background: 'var(--cyan)' }} />
                    </div>
                    <div className="h-1.5" style={{ background: 'var(--bg3)', border: '1px solid var(--gray)' }}>
                      <div className="h-full" style={{ width: `${(friendCount / 75) * 100}%`, background: 'var(--purple)' }} />
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
