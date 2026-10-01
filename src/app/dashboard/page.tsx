'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const TASKS = [
  { id: 'workout1', emoji: '💪', label: 'Entrená 45 min (sesión 1)' },
  { id: 'workout2', emoji: '🏃', label: 'Entrená 45 min (sesión 2, afuera)' },
  { id: 'water', emoji: '💧', label: 'Tomá 4 litros de agua' },
  { id: 'diet', emoji: '🥗', label: 'Seguí la dieta (sin alcohol ni chatarra)' },
  { id: 'read', emoji: '📖', label: 'Leé 10 páginas' },
  { id: 'photo', emoji: '📸', label: 'Sacate la foto de progreso' },
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
    }
    init()
  }, [supabase, router, loadData])

  async function saveName() {
    if (!profile || !nameInput.trim()) return
    const name = nameInput.trim()
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

  const myDisplayName = profile?.display_name || profile?.email.split('@')[0] || 'Vos'
  const friendDisplayName = friendProfile?.display_name || friendProfile?.email.split('@')[0] || '?'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-4xl">🔥</div>
      </div>
    )
  }

  const allTasksDone = myCheckin.length === TASKS.length
  const friendAllDone = friendCheckin.length === TASKS.length
  const isToday = selectedDay === currentDay

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Background glow top */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-96 h-32 pointer-events-none opacity-20" style={{ background: 'radial-gradient(ellipse, #22d3ee 0%, transparent 70%)' }} />

      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <span className="text-xl">🔥</span>
          <div>
            <div className="font-black text-sm tracking-wider gradient-text">RETO 75 DÍAS</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Día {currentDay} de 75</div>
          </div>
        </div>
        <button onClick={signOut} className="text-xs px-3 py-1.5 rounded-lg transition-colors" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
          Salir
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-4 pt-4 gap-2">
        {(['hoy', 'progreso'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all"
            style={view === tab
              ? { background: 'linear-gradient(135deg, #22d3ee, #06b6d4)', color: '#050810', boxShadow: '0 0 15px var(--accent-glow)' }
              : { background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {tab === 'hoy' ? '📅 HOY' : '📊 PROGRESO'}
          </button>
        ))}
      </div>

      {view === 'hoy' && (
        <div className="px-4 mt-4 space-y-4">
          {/* Day selector */}
          <div className="flex items-center justify-between px-2">
            <button
              onClick={() => {
                const newDay = Math.max(1, selectedDay - 1)
                setSelectedDay(newDay)
                setMyCheckin(getDayCheckin(allMyCheckins, newDay))
                setFriendCheckin(getDayCheckin(allFriendCheckins, newDay))
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold transition-colors"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              disabled={selectedDay <= 1}
            >
              ‹
            </button>
            <div className="text-center">
              <div className="text-xl font-black gradient-text">DÍA {selectedDay}</div>
              {!isToday && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>día pasado — solo lectura</div>}
            </div>
            <button
              onClick={() => {
                const newDay = Math.min(currentDay, selectedDay + 1)
                setSelectedDay(newDay)
                setMyCheckin(getDayCheckin(allMyCheckins, newDay))
                setFriendCheckin(getDayCheckin(allFriendCheckins, newDay))
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold transition-colors"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              disabled={selectedDay >= currentDay}
            >
              ›
            </button>
          </div>

          {/* My tasks */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black" style={{ background: 'linear-gradient(135deg, #22d3ee, #06b6d4)', color: '#050810', boxShadow: '0 0 10px var(--accent-glow)' }}>
                  {myDisplayName[0].toUpperCase()}
                </div>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveName()}
                      autoFocus
                      className="text-sm font-bold rounded-lg px-2 py-1 w-28 focus:outline-none"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--accent)' }}
                    />
                    <button onClick={saveName} className="text-xs px-2 py-1 rounded-lg font-bold" style={{ background: 'var(--accent)', color: '#050810' }}>✓</button>
                    <button onClick={() => setEditingName(false)} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => setEditingName(true)} className="flex items-center gap-1.5 group">
                    <span className="font-bold text-sm">{myDisplayName}</span>
                    <span className="text-xs opacity-0 group-hover:opacity-60 transition-opacity">✏️</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black" style={{ color: allTasksDone ? 'var(--green)' : 'var(--text-muted)' }}>
                  {myCheckin.length}/{TASKS.length}
                </span>
                {allTasksDone && <span>🎉</span>}
              </div>
            </div>
            <div>
              {TASKS.map((task, i) => {
                const done = myCheckin.includes(task.id)
                return (
                  <button
                    key={task.id}
                    onClick={() => isToday && toggleTask(task.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all"
                    style={{
                      background: done ? 'rgba(16,217,138,0.06)' : 'transparent',
                      cursor: isToday ? 'pointer' : 'default',
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                         style={{
                           border: done ? 'none' : '2px solid var(--border)',
                           background: done ? 'linear-gradient(135deg, #10d98a, #06b6d4)' : 'transparent',
                           boxShadow: done ? '0 0 8px var(--green-glow)' : 'none',
                         }}>
                      {done && <span className="text-white font-black" style={{ fontSize: '10px' }}>✓</span>}
                    </div>
                    <span className="text-sm" style={{ color: done ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {task.emoji} {task.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Friend tasks */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black" style={{ background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', color: 'white', boxShadow: '0 0 10px var(--purple-glow)' }}>
                  {friendProfile ? friendDisplayName[0].toUpperCase() : '?'}
                </div>
                <div>
                  <span className="font-bold text-sm">{friendProfile ? friendDisplayName : (profile?.friend_email?.split('@')[0] || 'Tu amiga')}</span>
                  {!friendProfile && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      {profile?.friend_email ? 'esperando...' : 'no vinculada'}
                    </span>
                  )}
                </div>
              </div>
              {friendProfile && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black" style={{ color: friendAllDone ? 'var(--green)' : 'var(--text-muted)' }}>
                    {friendCheckin.length}/{TASKS.length}
                  </span>
                  {friendAllDone && <span>🎉</span>}
                </div>
              )}
            </div>
            <div>
              {TASKS.map((task, i) => {
                const done = friendProfile ? friendCheckin.includes(task.id) : false
                return (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3.5 transition-all"
                       style={{
                         background: done ? 'rgba(16,217,138,0.06)' : 'transparent',
                         borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                         opacity: !friendProfile ? 0.35 : 1,
                       }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                         style={{
                           border: done ? 'none' : '2px solid var(--border)',
                           background: done ? 'linear-gradient(135deg, #10d98a, #7c3aed)' : 'transparent',
                           boxShadow: done ? '0 0 8px var(--green-glow)' : 'none',
                         }}>
                      {done && <span className="text-white font-black" style={{ fontSize: '10px' }}>✓</span>}
                    </div>
                    <span className="text-sm" style={{ color: done ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {task.emoji} {task.label}
                    </span>
                  </div>
                )
              })}
            </div>
            {!friendProfile && !profile?.friend_email && (
              <div className="px-4 py-3 text-xs text-center" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                Registrate con el email de tu amiga para vincularla
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'progreso' && (
        <div className="px-4 mt-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="text-3xl font-black gradient-text">{getCompletedCount(allMyCheckins)}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Días perfectos</div>
              <div className="text-xs font-bold mt-0.5" style={{ color: 'var(--accent)' }}>{myDisplayName}</div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="text-3xl font-black" style={{ color: '#a78bfa' }}>{getCompletedCount(allFriendCheckins)}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Días perfectos</div>
              <div className="text-xs font-bold mt-0.5" style={{ color: '#7c3aed' }}>{friendProfile ? friendDisplayName : 'Tu amiga'}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between text-xs mb-2">
              <span style={{ color: 'var(--text-muted)' }}>Progreso del reto</span>
              <span className="font-bold" style={{ color: 'var(--accent)' }}>{currentDay}/75</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(currentDay / 75) * 100}%`, background: 'linear-gradient(90deg, #22d3ee, #7c3aed)', boxShadow: '0 0 8px var(--accent-glow)' }} />
            </div>
          </div>

          {/* Calendar grid */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-black tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>CALENDARIO 75 DÍAS</div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
              {Array.from({ length: 75 }, (_, i) => {
                const day = i + 1
                const myDone = getDayCheckin(allMyCheckins, day).length === TASKS.length
                const friendDone = friendProfile ? getDayCheckin(allFriendCheckins, day).length === TASKS.length : false
                const myPartial = !myDone && getDayCheckin(allMyCheckins, day).length > 0
                const isCurrentDay = day === currentDay
                const isFuture = day > currentDay

                let bg = 'var(--bg-tertiary)'
                if (myDone && friendDone) bg = 'linear-gradient(135deg, #10d98a, #06b6d4)'
                else if (myDone) bg = 'linear-gradient(135deg, #22d3ee, #06b6d4)'
                else if (friendDone) bg = 'linear-gradient(135deg, #7c3aed, #a78bfa)'
                else if (myPartial) bg = 'rgba(34,211,238,0.2)'
                else if (isFuture) bg = 'var(--bg-hover)'

                return (
                  <div
                    key={day}
                    className="rounded aspect-square flex items-center justify-center font-bold"
                    style={{
                      background: bg,
                      color: (myDone || friendDone) ? 'white' : 'var(--text-muted)',
                      outline: isCurrentDay ? '2px solid var(--accent)' : 'none',
                      outlineOffset: '1px',
                      fontSize: '8px',
                      boxShadow: isCurrentDay ? '0 0 6px var(--accent-glow)' : 'none',
                    }}
                  >
                    {day}
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-3" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              <span><span style={{ color: 'var(--accent)' }}>■</span> {myDisplayName}</span>
              <span><span style={{ color: '#7c3aed' }}>■</span> {friendProfile ? friendDisplayName : 'Tu amiga'}</span>
              <span><span style={{ color: 'var(--green)' }}>■</span> Ambas</span>
            </div>
          </div>

          {/* Task breakdown */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-black tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>TAREAS COMPLETADAS</div>
            {TASKS.map(task => {
              const myCount = allMyCheckins.filter(c => c.tasks.includes(task.id)).length
              const friendCount = allFriendCheckins.filter(c => c.tasks.includes(task.id)).length
              return (
                <div key={task.id} className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: 'var(--text-secondary)' }}>{task.emoji} {task.label}</span>
                    <span className="font-bold" style={{ color: 'var(--accent)' }}>{myCount}d</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-0.5" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(myCount / 75) * 100}%`, background: 'linear-gradient(90deg, #22d3ee, #06b6d4)', boxShadow: '0 0 4px var(--accent-glow)' }} />
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(friendCount / 75) * 100}%`, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
