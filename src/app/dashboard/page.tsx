'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { parseEntry } from '@/lib/parser'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

type Transaction = {
  id: string
  description: string
  amount: number
  type: 'gasto' | 'ingreso'
  category: string
  date: string
}

type Subscription = {
  id: string
  name: string
  amount: number
  active: boolean
}

const CATEGORY_EMOJI: Record<string, string> = {
  Bencina: '⛽',
  Comida: '🍔',
  Supermercado: '🛒',
  Fiesta: '🎉',
  Suscripciones: '📱',
  Salud: '💊',
  Transporte: '🚌',
  Ropa: '👕',
  Ingreso: '💵',
  Otros: '📦',
}

function formatCLP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CL')
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'inicio' | 'gastos' | 'ingresos' | 'suscripciones'>('inicio')
  const [userId, setUserId] = useState<string | null>(null)
  const [entryType, setEntryType] = useState<'gasto' | 'ingreso'>('gasto')
  const [newSubName, setNewSubName] = useState('')
  const [newSubAmount, setNewSubAmount] = useState('')
  const [showSubForm, setShowSubForm] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const loadData = useCallback(async (uid: string) => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

    const [{ data: txs }, { data: subs }] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', uid).gte('date', start).order('date', { ascending: false }),
      supabase.from('subscriptions').select('*').eq('user_id', uid),
    ])
    setTransactions(txs || [])
    setSubscriptions(subs || [])
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      setUserId(data.user.id)
      loadData(data.user.id)
    })
  }, [supabase, router, loadData])

  async function handleAddSub() {
    if (!newSubName.trim() || !newSubAmount.trim() || !userId) return
    const amount = parseFloat(newSubAmount.replace(/\./g, '').replace(',', '.'))
    if (isNaN(amount) || amount <= 0) return
    await supabase.from('subscriptions').insert({ user_id: userId, name: newSubName.trim(), amount, active: true })
    setNewSubName('')
    setNewSubAmount('')
    setShowSubForm(false)
    await loadData(userId)
  }

  async function handleDeleteSub(id: string) {
    await supabase.from('subscriptions').delete().eq('id', id)
    if (userId) await loadData(userId)
  }

  async function handleAddEntry() {
    if (!input.trim() || !userId) return
    const parsed = parseEntry(input)
    if (!parsed) { alert('No pude entender el monto. Ejemplo: "5000 bencina"'); return }

    setLoading(true)
    await supabase.from('transactions').insert({
      user_id: userId,
      description: parsed.description,
      amount: parsed.amount,
      type: entryType,
      category: entryType === 'ingreso' ? 'Ingreso' : parsed.category,
      date: new Date().toISOString().split('T')[0],
    })
    setInput('')
    await loadData(userId)
    setLoading(false)
  }

  async function handleDeleteTransaction(id: string) {
    await supabase.from('transactions').delete().eq('id', id)
    if (userId) await loadData(userId)
  }

  async function toggleSub(id: string, active: boolean) {
    await supabase.from('subscriptions').update({ active: !active }).eq('id', id)
    if (userId) await loadData(userId)
  }

  function exportExcel() {
    const data = transactions.map(t => ({
      Fecha: t.date,
      Descripción: t.description,
      Categoría: t.category,
      Tipo: t.type,
      Monto: t.type === 'gasto' ? -t.amount : t.amount,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos')
    XLSX.writeFile(wb, `centro-costos-${new Date().toISOString().slice(0, 7)}.xlsx`)
  }

  const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0)
  const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0)
  const totalSubs = subscriptions.filter(s => s.active).reduce((s, sub) => s + sub.amount, 0)
  const balance = totalIngresos - totalGastos - totalSubs

  const mes = new Date().toLocaleString('es-CL', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold">💰 Centro de Costos</h1>
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="text-xs text-gray-500 hover:text-white">
            Salir
          </button>
        </div>
        <p className="text-gray-400 text-xs capitalize">{mes}</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 px-4 mt-2">
        {(['inicio', 'gastos', 'ingresos', 'suscripciones'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 px-3 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-indigo-500 text-white' : 'border-transparent text-gray-500'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">

        {tab === 'inicio' && (
          <>
            {/* Resumen */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800 rounded-2xl p-4">
                <p className="text-xs text-gray-400">Gastos</p>
                <p className="text-xl font-bold text-red-400">{formatCLP(totalGastos)}</p>
              </div>
              <div className="bg-gray-800 rounded-2xl p-4">
                <p className="text-xs text-gray-400">Ingresos</p>
                <p className="text-xl font-bold text-green-400">{formatCLP(totalIngresos)}</p>
              </div>
              <div className="bg-gray-800 rounded-2xl p-4">
                <p className="text-xs text-gray-400">Suscripciones</p>
                <p className="text-xl font-bold text-yellow-400">{formatCLP(totalSubs)}</p>
              </div>
              <div className="bg-gray-800 rounded-2xl p-4">
                <p className="text-xs text-gray-400">Balance</p>
                <p className={`text-xl font-bold ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCLP(balance)}</p>
              </div>
            </div>

            {/* Input */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setEntryType('gasto')}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${entryType === 'gasto' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  🔴 Gasto
                </button>
                <button
                  onClick={() => setEntryType('ingreso')}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${entryType === 'ingreso' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  🟢 Ingreso
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddEntry()}
                  placeholder={entryType === 'gasto' ? 'ej: 5000 bencina' : 'ej: 500000 sueldo'}
                  className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <button
                  onClick={handleAddEntry}
                  disabled={loading}
                  className={`disabled:opacity-50 rounded-xl px-4 font-bold transition-colors ${entryType === 'gasto' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  +
                </button>
              </div>
            </div>

            {/* Últimas transacciones */}
            <div>
              <p className="text-xs text-gray-400 mb-2">Últimos movimientos</p>
              {transactions.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <span>{CATEGORY_EMOJI[t.category] || '📦'}</span>
                    <div>
                      <p className="text-sm">{t.description}</p>
                      <p className="text-xs text-gray-500">{t.category}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold ${t.type === 'ingreso' ? 'text-green-400' : 'text-red-400'}`}>
                    {t.type === 'ingreso' ? '+' : '-'}{formatCLP(t.amount)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'gastos' && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-400">{transactions.length} movimientos este mes</p>
              <button onClick={exportExcel} className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-lg transition-colors">
                📊 Exportar Excel
              </button>
            </div>
            {transactions.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <span>{CATEGORY_EMOJI[t.category] || '📦'}</span>
                  <div>
                    <p className="text-sm">{t.description}</p>
                    <p className="text-xs text-gray-500">{t.date} · {t.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-semibold ${t.type === 'ingreso' ? 'text-green-400' : 'text-red-400'}`}>
                    {t.type === 'ingreso' ? '+' : '-'}{formatCLP(t.amount)}
                  </p>
                  <button onClick={() => handleDeleteTransaction(t.id)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'ingresos' && (
          <>
            <div className="bg-gray-800 rounded-2xl p-4">
              <p className="text-xs text-gray-400">Total ingresos este mes</p>
              <p className="text-3xl font-bold text-green-400">{formatCLP(totalIngresos)}</p>
            </div>

            {transactions.filter(t => t.type === 'ingreso').length === 0 && (
              <p className="text-center text-gray-500 text-sm py-8">No hay ingresos registrados este mes.</p>
            )}

            {transactions.filter(t => t.type === 'ingreso').map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <span>💵</span>
                  <div>
                    <p className="text-sm">{t.description}</p>
                    <p className="text-xs text-gray-500">{t.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-green-400">+{formatCLP(t.amount)}</p>
                  <button onClick={() => handleDeleteTransaction(t.id)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'suscripciones' && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-400">Total activo: <span className="text-yellow-400 font-bold">{formatCLP(totalSubs)}/mes</span></p>
              <button onClick={() => setShowSubForm(!showSubForm)} className="text-xs bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-lg transition-colors">
                + Agregar
              </button>
            </div>

            {showSubForm && (
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <input
                  placeholder="Nombre (ej: Spotify)"
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  placeholder="Monto mensual (ej: 5000)"
                  value={newSubAmount}
                  onChange={e => setNewSubAmount(e.target.value)}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <button onClick={handleAddSub} className="flex-1 bg-indigo-600 hover:bg-indigo-700 rounded-lg py-2 text-sm font-semibold transition-colors">
                    Guardar
                  </button>
                  <button onClick={() => setShowSubForm(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 rounded-lg py-2 text-sm transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {subscriptions.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-8">No tenés suscripciones. ¡Agregá una!</p>
            )}

            {subscriptions.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-gray-400">{formatCLP(s.amount)}/mes</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleSub(s.id, s.active)}
                    className={`text-xs px-3 py-1 rounded-full transition-colors ${s.active ? 'bg-green-600 hover:bg-yellow-600' : 'bg-gray-700 hover:bg-green-600'}`}
                  >
                    {s.active ? 'Activa' : 'Inactiva'}
                  </button>
                  <button onClick={() => handleDeleteSub(s.id)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
