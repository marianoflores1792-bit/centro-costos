'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setError('Revisá tu email para confirmar la cuenta')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">💰 Centro de Costos</h1>
        <p className="text-[#8b949e] text-center mb-8 text-sm">Controlá tus gastos desde el celu</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-[#161b22] border border-[#21262d] rounded-xl px-4 py-3 text-white placeholder-[#6e7681] focus:outline-none focus:ring-2 focus:ring-[#22d3ee]"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-[#161b22] border border-[#21262d] rounded-xl px-4 py-3 text-white placeholder-[#6e7681] focus:outline-none focus:ring-2 focus:ring-[#22d3ee]"
          />

          {error && (
            <p className={`text-sm text-center ${error.includes('Revisá') ? 'text-[#22d3ee]' : 'text-red-400'}`}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#22d3ee] hover:bg-[#06b6d4] text-[#0d1117] disabled:opacity-50 rounded-xl px-4 py-3 font-semibold transition-colors"
          >
            {loading ? 'Cargando...' : isLogin ? 'Ingresar' : 'Registrarse'}
          </button>
        </form>

        <button
          onClick={() => { setIsLogin(!isLogin); setError('') }}
          className="w-full mt-4 text-[#6e7681] hover:text-white text-sm transition-colors"
        >
          {isLogin ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Ingresá'}
        </button>
      </div>
    </div>
  )
}
