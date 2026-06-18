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
        <p className="text-gray-400 text-center mb-8 text-sm">Controlá tus gastos desde el celu</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {error && (
            <p className={`text-sm text-center ${error.includes('Revisá') ? 'text-green-400' : 'text-red-400'}`}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl px-4 py-3 font-semibold transition-colors"
          >
            {loading ? 'Cargando...' : isLogin ? 'Ingresar' : 'Registrarse'}
          </button>
        </form>

        <button
          onClick={() => { setIsLogin(!isLogin); setError('') }}
          className="w-full mt-4 text-gray-400 hover:text-white text-sm transition-colors"
        >
          {isLogin ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Ingresá'}
        </button>
      </div>
    </div>
  )
}
