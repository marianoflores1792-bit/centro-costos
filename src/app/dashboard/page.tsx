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
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <span className="font-bold">Reto 75 Días</span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Día {currentDay} de 75</p>
        </div>
        <button onClick={signOut} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
          Salir
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-4 pt-4 gap-2">
        {(['hoy', 'progreso'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className="flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-all"
            style={view === tab
              ? { background: 'var(--accent)', color: '#0d1117' }
              : { background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            {tab === 'hoy' ? '📅 Hoy' : '📊 Progreso'}
          </button>
        ))}
      </div>

      {view === 'hoy' && (
        <div className="px-4 mt-4 space-y-4">
          {/* Day selector */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                const newDay = Math.max(1, selectedDay - 1)
                setSelectedDay(newDay)
                setMyCheckin(getDayCheckin(allMyCheckins, newDay))
                setFriendCheckin(getDayCheckin(allFriendCheckins, newDay))
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
              style={{ background: 'var(--bg-tertiary)' }}
              disabled={selectedDay <= 1}
            >
              ‹
            </button>
            <div className="text-center">
              <div className="font-bold">Día {selectedDay}</div>
              {!isToday && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Día pasado</div>}
            </div>
            <button
              onClick={() => {
                const newDay = Math.min(currentDay, selectedDay + 1)
                setSelectedDay(newDay)
                setMyCheckin(getDayCheckin(allMyCheckins, newDay))
                setFriendCheckin(getDayCheckin(allFriendCheckins, newDay))
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
              style={{ background: 'var(--bg-tertiary)' }}
              disabled={selectedDay >= currentDay}
            >
              ›
            </button>
          </div>

          {/* My tasks */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--bg-secondary)' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--accent)', color: '#0d1117' }}>
                  {myDisplayName[0].toUpperCase()}
                </div>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveName()}
                      autoFocus
                      className="text-sm font-semibold rounded px-2 py-0.5 w-32 focus:outline-none"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--accent)' }}
                    />
                    <button onClick={saveName} className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent)', color: '#0d1117' }}>✓</button>
                    <button onClick={() => setEditingName(false)} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingName(true)}
                    className="flex items-center gap-1 group"
                  >
                    <span className="font-semibold text-sm">{myDisplayName}</span>
                    <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }}>✏️</span>
                  </button>
                )}
              </div>
              <span className="text-sm font-bold" style={{ color: allTasksDone ? 'var(--green)' : 'var(--text-muted)' }}>
                {myCheckin.length}/{TASKS.length} {allTasksDone ? '🎉' : ''}
              </span>
            </div>
            <div>
              {TASKS.map((task, i) => {
                const done = myCheckin.includes(task.id)
                return (
                  <button
                    key={task.id}
                    onClick={() => isToday && toggleTask(task.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    style={{
                      background: done ? 'rgba(63,185,80,0.08)' : 'var(--bg-primary)',
                      cursor: isToday ? 'pointer' : 'default',
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                         style={{ borderColor: done ? 'var(--green)' : 'var(--border)', background: done ? 'var(--green)' : 'transparent' }}>
                      {done && <span className="text-white font-bold" style={{ fontSize: '10px' }}>✓</span>}
                    </div>
                    <span className="text-sm">{task.emoji} {task.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Friend tasks */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--bg-secondary)' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#7c3aed', color: 'white' }}>
                  {friendProfile ? friendDisplayName[0].toUpperCase() : '?'}
                </div>
                <span className="font-semibold text-sm">{friendProfile ? friendDisplayName : (profile?.friend_email ? profile.friend_email.split('@')[0] : 'Tu amiga')}</span>
                {!friendProfile && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                    {profile?.friend_email ? 'pendiente' : 'no vinculada'}
                  </span>
                )}
              </div>
              {friendProfile && (
                <span className="text-sm font-bold" style={{ color: friendAllDone ? 'var(--green)' : 'var(--text-muted)' }}>
                  {friendCheckin.length}/{TASKS.length} {friendAllDone ? '🎉' : ''}
                </span>
              )}
            </div>
            <div>
              {TASKS.map((task, i) => {
                const done = friendProfile ? friendCheckin.includes(task.id) : false
                return (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3"
                       style={{
                         background: done ? 'rgba(63,185,80,0.08)' : 'var(--bg-primary)',
                         borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                         opacity: !friendProfile ? 0.4 : 1,
                       }}>
                    <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                         style={{ borderColor: done ? 'var(--green)' : 'var(--border)', background: done ? 'var(--green)' : 'transparent' }}>
                      {done && <span className="text-white font-bold" style={{ fontSize: '10px' }}>✓</span>}
                    </div>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{task.emoji} {task.label}</span>
                  </div>
                )
              })}
            </div>
            {!friendProfile && !profile?.friend_email && (
              <div className="px-4 py-3 text-xs text-center" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
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
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                {getCompletedCount(allMyCheckins)}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Días perfectos de {myDisplayName}</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
              <div className="text-2xl font-bold" style={{ color: '#7c3aed' }}>
                {getCompletedCount(allFriendCheckins)}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Días de {friendProfile ? friendDisplayName : 'tu amiga'}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
            <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              <span>Progreso del reto</span>
              <span>{currentDay}/75 días</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="h-full rounded-full" style={{ width: `${(currentDay / 75) * 100}%`, background: 'var(--accent)' }} />
            </div>
          </div>

          {/* Calendar grid */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
            <div className="text-sm font-semibold mb-3">Calendario de 75 días</div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
              {Array.from({ length: 75 }, (_, i) => {
                const day = i + 1
                const myDone = getDayCheckin(allMyCheckins, day).length === TASKS.length
                const friendDone = friendProfile ? getDayCheckin(allFriendCheckins, day).length === TASKS.length : false
                const myPartial = !myDone && getDayCheckin(allMyCheckins, day).length > 0
                const isCurrentDay = day === currentDay
                const isFuture = day > currentDay

                let bg = 'var(--bg-tertiary)'
                if (myDone && friendDone) bg = 'var(--green)'
                else if (myDone) bg = 'var(--accent)'
                else if (friendDone) bg = '#7c3aed'
                else if (myPartial) bg = 'rgba(34,211,238,0.3)'
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
                      fontSize: '9px',
                    }}
                  >
                    {day}
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span><span style={{ color: 'var(--accent)' }}>■</span> {myDisplayName}</span>
              <span><span style={{ color: '#7c3aed' }}>■</span> {friendProfile ? friendDisplayName : 'Tu amiga'}</span>
              <span><span style={{ color: 'var(--green)' }}>■</span> Ambas</span>
            </div>
          </div>

          {/* Task breakdown */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
            <div className="text-sm font-semibold mb-3">Tareas completadas</div>
            {TASKS.map(task => {
              const myCount = allMyCheckins.filter(c => c.tasks.includes(task.id)).length
              const friendCount = allFriendCheckins.filter(c => c.tasks.includes(task.id)).length
              return (
                <div key={task.id} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>{task.emoji} {task.label}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{myCount}d</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(myCount / 75) * 100}%`, background: 'var(--accent)' }} />
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mt-0.5" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(friendCount / 75) * 100}%`, background: '#7c3aed' }} />
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
