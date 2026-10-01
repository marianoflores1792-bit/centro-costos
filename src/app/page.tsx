'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
        // Crear perfil con email de amiga
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: email,
          friend_email: friendEmail || null,
          start_date: new Date().toISOString().split('T')[0],
        })
        setError('Revisá tu email para confirmar la cuenta')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔥</div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Reto 75 Días</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {isLogin ? 'Continuá tu reto' : 'Empezá el reto con tu amiga'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Tu email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />

          {!isLogin && (
            <input
              type="email"
              placeholder="Email de tu amiga (opcional)"
              value={friendEmail}
              onChange={e => setFriendEmail(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          )}

          {error && (
            <p className={`text-sm text-center ${error.includes('Revisá') ? '' : 'text-red-400'}`}
               style={error.includes('Revisá') ? { color: 'var(--accent)' } : {}}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl px-4 py-3 font-semibold text-sm transition-colors disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#0d1117' }}
          >
            {loading ? 'Cargando...' : isLogin ? 'Ingresar' : 'Empezar el reto'}
          </button>
        </form>

        <button
          onClick={() => { setIsLogin(!isLogin); setError('') }}
          className="w-full mt-4 text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          {isLogin ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Ingresá'}
        </button>
      </div>
    </div>
  )
}
