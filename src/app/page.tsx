'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [friendEmail, setFriendEmail] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/dashboard')
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email,
          friend_email: friendEmail || null,
          start_date: new Date().toISOString().split('T')[0],
          display_name: displayName.trim().toUpperCase().slice(0, 10) || null,
        })
        setError('CHEQUEÁ TU EMAIL!')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="stars" />
      <div className="scanlines" />

      <div className="relative z-10 w-full max-w-xs">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔥</div>
          <div style={{ fontFamily: 'var(--pixel)', color: 'var(--yellow)', fontSize: '14px', lineHeight: '1.8', textShadow: '3px 3px 0 #7a3a00' }}>
            RETO
          </div>
          <div style={{ fontFamily: 'var(--pixel)', color: 'var(--yellow)', fontSize: '20px', lineHeight: '1.8', textShadow: '3px 3px 0 #7a3a00' }}>
            75 DIAS
          </div>
          <div className="mt-2" style={{ color: 'var(--cyan)', fontSize: '8px', letterSpacing: '2px' }}>
            {isLogin ? '— INSERT COIN —' : '— NEW PLAYER —'}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label style={{ color: 'var(--cyan)', fontSize: '8px', display: 'block', marginBottom: '6px' }}>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 focus:outline-none"
              style={{
                background: 'var(--bg2)',
                border: '3px solid var(--gray)',
                color: 'var(--white)',
                fontFamily: 'var(--pixel)',
                fontSize: '9px',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--cyan)'}
              onBlur={e => e.target.style.borderColor = 'var(--gray)'}
            />
          </div>

          <div>
            <label style={{ color: 'var(--cyan)', fontSize: '8px', display: 'block', marginBottom: '6px' }}>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 focus:outline-none"
              style={{
                background: 'var(--bg2)',
                border: '3px solid var(--gray)',
                color: 'var(--white)',
                fontFamily: 'var(--pixel)',
                fontSize: '9px',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--cyan)'}
              onBlur={e => e.target.style.borderColor = 'var(--gray)'}
            />
          </div>

          {!isLogin && (
            <div>
              <label style={{ color: 'var(--yellow)', fontSize: '8px', display: 'block', marginBottom: '6px' }}>TU NOMBRE (MAX 10)</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="PLAYER 1"
                className="w-full px-3 py-2.5 focus:outline-none"
                style={{
                  background: 'var(--bg2)',
                  border: '3px solid var(--gray)',
                  color: 'var(--white)',
                  fontFamily: 'var(--pixel)',
                  fontSize: '9px',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--yellow)'}
                onBlur={e => e.target.style.borderColor = 'var(--gray)'}
              />
            </div>
          )}

          {!isLogin && (
            <div>
              <label style={{ color: 'var(--purple)', fontSize: '8px', display: 'block', marginBottom: '6px' }}>EMAIL AMIGA (OPC)</label>
              <input
                type="email"
                value={friendEmail}
                onChange={e => setFriendEmail(e.target.value)}
                className="w-full px-3 py-2.5 focus:outline-none"
                style={{
                  background: 'var(--bg2)',
                  border: '3px solid var(--gray)',
                  color: 'var(--white)',
                  fontFamily: 'var(--pixel)',
                  fontSize: '9px',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--purple)'}
                onBlur={e => e.target.style.borderColor = 'var(--gray)'}
              />
            </div>
          )}

          {error && (
            <div className="text-center py-2" style={{ color: error.includes('EMAIL') ? 'var(--green)' : 'var(--red)', fontSize: '8px', border: `2px solid ${error.includes('EMAIL') ? 'var(--green)' : 'var(--red)'}`, background: 'var(--bg2)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="pixel-btn w-full py-3 font-bold disabled:opacity-50"
            style={{
              background: 'var(--yellow)',
              color: '#0a0a1a',
              fontFamily: 'var(--pixel)',
              fontSize: '9px',
              letterSpacing: '1px',
            }}
          >
            {loading ? 'LOADING...' : isLogin ? '▶ PLAY' : '▶ START'}
          </button>
        </form>

        <button
          onClick={() => { setIsLogin(!isLogin); setError('') }}
          className="w-full mt-6 blink"
          style={{ color: 'var(--gray)', fontFamily: 'var(--pixel)', fontSize: '7px' }}
        >
          {isLogin ? '[ NEW PLAYER? PRESS HERE ]' : '[ CONTINUE? PRESS HERE ]'}
        </button>
      </div>
    </div>
  )
}
