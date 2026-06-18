'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { parseEntry } from '@/lib/parser'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

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

type Budget = {
  id: string
  type: 'general' | 'category'
  category: string | null
  amount: number
}

const LEVELS = [
  { name: 'Peter Parker', min: 0, max: 100000, emoji: '🕷️', color: 'text-red-400' },
  { name: 'Michael Scott', min: 100000, max: 300000, emoji: '📋', color: 'text-yellow-400' },
  { name: 'Bill Gates', min: 300000, max: 600000, emoji: '💻', color: 'text-blue-400' },
  { name: 'MrBeast', min: 600000, max: 1200000, emoji: '🎯', color: 'text-orange-400' },
  { name: 'Tony Stark', min: 1200000, max: 2000000, emoji: '🦾', color: 'text-cyan-400' },
  { name: 'Jeff Bezos', min: 2000000, max: Infinity, emoji: '🚀', color: 'text-green-400' },
]

function getLevel(balance: number) {
  if (balance <= 0) return null
  return LEVELS.find(l => balance >= l.min && balance < l.max) || LEVELS[LEVELS.length - 1]
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
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [budgetGeneral, setBudgetGeneral] = useState('')
  const [budgetCategory, setBudgetCategory] = useState('Comida')
  const [budgetCategoryAmount, setBudgetCategoryAmount] = useState('')
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'inicio' | 'gastos' | 'ingresos' | 'suscripciones'>('inicio')
  const [showPerfil, setShowPerfil] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [currentDate, setCurrentDate] = useState(new Date())

  function changeMonth(dir: number) {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1)
    setCurrentDate(next)
    if (userId) loadData(userId, next)
  }

  const isCurrentMonth = currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear()

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next === 'light' ? 'light' : '')
  }
  const [userId, setUserId] = useState<string | null>(null)
  const [entryType, setEntryType] = useState<'gasto' | 'ingreso'>('gasto')
  const [nombre, setNombre] = useState('')
  const [nombreEdit, setNombreEdit] = useState('')
  const [editingNombre, setEditingNombre] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [editingTx, setEditingTx] = useState<string | null>(null)
  const [editTxDesc, setEditTxDesc] = useState('')
  const [editTxAmount, setEditTxAmount] = useState('')
  const [editTxCategory, setEditTxCategory] = useState('')
  const [newSubName, setNewSubName] = useState('')
  const [newSubAmount, setNewSubAmount] = useState('')
  const [showSubForm, setShowSubForm] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const loadData = useCallback(async (uid: string, date?: Date) => {
    const ref = date || currentDate
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString().split('T')[0]
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).toISOString().split('T')[0]

    const [{ data: txs }, { data: subs }, { data: buds }] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', uid).gte('date', start).lte('date', end).order('date', { ascending: false }),
      supabase.from('subscriptions').select('*').eq('user_id', uid),
      supabase.from('budgets').select('*').eq('user_id', uid),
    ])
    setTransactions(txs || [])
    setSubscriptions(subs || [])
    setBudgets(buds || [])
    const general = buds?.find(b => b.type === 'general')
    if (general) setBudgetGeneral(String(general.amount))
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/'); return }
      setUserId(data.user.id)
      setUserEmail(data.user.email || '')
      loadData(data.user.id)
      const { data: profile } = await supabase.from('profiles').select('nombre').eq('id', data.user.id).single()
      if (profile?.nombre) { setNombre(profile.nombre); setNombreEdit(profile.nombre) }
    })
  }, [supabase, router, loadData])

  async function handleSaveBudgetGeneral() {
    if (!userId || !budgetGeneral) return
    const amount = parseFloat(budgetGeneral.replace(/\./g, '').replace(',', '.'))
    if (isNaN(amount) || amount <= 0) return
    await supabase.from('budgets').upsert({ user_id: userId, type: 'general', category: null, amount }, { onConflict: 'user_id,type,category' })
    await loadData(userId)
  }

  async function handleSaveBudgetCategory() {
    if (!userId || !budgetCategoryAmount || !budgetCategory) return
    const amount = parseFloat(budgetCategoryAmount.replace(/\./g, '').replace(',', '.'))
    if (isNaN(amount) || amount <= 0) return
    await supabase.from('budgets').upsert({ user_id: userId, type: 'category', category: budgetCategory, amount }, { onConflict: 'user_id,type,category' })
    setBudgetCategoryAmount('')
    await loadData(userId)
  }

  async function handleDeleteBudget(id: string) {
    await supabase.from('budgets').delete().eq('id', id)
    if (userId) await loadData(userId)
  }

  async function handleSaveNombre() {
    if (!userId || !nombreEdit.trim()) return
    await supabase.from('profiles').upsert({ id: userId, nombre: nombreEdit.trim() })
    setNombre(nombreEdit.trim())
    setEditingNombre(false)
  }

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

  function startEditTx(t: Transaction) {
    setEditingTx(t.id)
    setEditTxDesc(t.description)
    setEditTxAmount(String(t.amount))
    setEditTxCategory(t.category)
  }

  async function handleSaveTx() {
    if (!editingTx || !userId) return
    const amount = parseFloat(editTxAmount.replace(/\./g, '').replace(',', '.'))
    if (isNaN(amount) || amount <= 0) return
    await supabase.from('transactions').update({ description: editTxDesc, amount, category: editTxCategory }).eq('id', editingTx)
    setEditingTx(null)
    await loadData(userId)
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

  const mes = currentDate.toLocaleString('es-CL', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold">💰 Centro de Costos</h1>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-lg transition-colors">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button onClick={() => setShowPerfil(!showPerfil)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl">⚙️</button>
            <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">Salir</button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button onClick={() => changeMonth(-1)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm px-1">‹</button>
          <p className="text-[var(--text-secondary)] text-xs capitalize">{currentDate.toLocaleString('es-CL', { month: 'long', year: 'numeric' })}</p>
          <button onClick={() => changeMonth(1)} disabled={isCurrentMonth} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm px-1 disabled:opacity-30">›</button>
          {!isCurrentMonth && <span className="text-xs text-[var(--accent)]">← mes anterior</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] px-4 mt-2">
        {(['inicio', 'gastos', 'ingresos', 'suscripciones'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 px-3 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-[#a3e635] text-[var(--accent)]' : 'border-transparent text-[var(--text-muted)]'}`}
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
              <div className="bg-[var(--bg-secondary)] rounded-2xl p-4">
                <p className="text-xs text-[var(--text-secondary)]">Gastos</p>
                <p className="text-xl font-bold text-red-400">{formatCLP(totalGastos)}</p>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-2xl p-4">
                <p className="text-xs text-[var(--text-secondary)]">Ingresos</p>
                <p className="text-xl font-bold text-green-400">{formatCLP(totalIngresos)}</p>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-2xl p-4">
                <p className="text-xs text-[var(--text-secondary)]">Suscripciones</p>
                <p className="text-xl font-bold text-yellow-400">{formatCLP(totalSubs)}</p>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-2xl p-4">
                <p className="text-xs text-[var(--text-secondary)]">Balance</p>
                <p className={`text-xl font-bold ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCLP(balance)}</p>
              </div>
            </div>

            {/* Presupuesto general */}
            {budgets.find(b => b.type === 'general') && (() => {
              const limit = budgets.find(b => b.type === 'general')!.amount
              const pct = Math.min((totalGastos / limit) * 100, 100)
              const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-400' : 'bg-[var(--accent)]'
              return (
                <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Presupuesto mensual</span>
                    <span className={pct >= 90 ? 'text-red-400' : 'text-[var(--text-secondary)]'}>{formatCLP(totalGastos)} / {formatCLP(limit)}</span>
                  </div>
                  <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2">
                    <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  {pct >= 90 && <p className="text-xs text-red-400">⚠️ Estás cerca del límite de gasto</p>}
                </div>
              )
            })()}

            {/* Presupuestos por categoría */}
            {budgets.filter(b => b.type === 'category').length > 0 && (
              <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 space-y-3">
                <p className="text-xs text-[var(--text-secondary)]">Presupuesto por categoría</p>
                {budgets.filter(b => b.type === 'category').map(b => {
                  const gastado = transactions.filter(t => t.type === 'gasto' && t.category === b.category).reduce((s, t) => s + t.amount, 0)
                  const pct = Math.min((gastado / b.amount) * 100, 100)
                  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-400' : 'bg-[var(--accent)]'
                  return (
                    <div key={b.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{CATEGORY_EMOJI[b.category!] || '📦'} {b.category}</span>
                        <span className={pct >= 90 ? 'text-red-400' : 'text-[var(--text-secondary)]'}>{formatCLP(gastado)} / {formatCLP(b.amount)}</span>
                      </div>
                      <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-1.5">
                        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Nivel de ahorro */}
            {(() => {
              const balance = totalIngresos - totalGastos
              const level = getLevel(balance)
              const nextLevel = level ? LEVELS[LEVELS.indexOf(level) + 1] : LEVELS[0]
              return level ? (
                <div className="bg-[var(--bg-secondary)] rounded-2xl p-4">
                  <p className="text-xs text-[var(--text-secondary)] mb-1">Nivel de ahorro este mes</p>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{level.emoji}</span>
                    <div>
                      <p className={`text-lg font-bold ${level.color}`}>{level.name}</p>
                      {nextLevel && (
                        <p className="text-xs text-[var(--text-muted)]">
                          Siguiente: {nextLevel.name} a ${nextLevel.min.toLocaleString('es-CL')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 text-center">
                  <p className="text-xs text-[var(--text-secondary)]">Ahorrá $100.000 este mes para desbloquear tu primer nivel 🕷️</p>
                </div>
              )
            })()}

            {/* Input */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setEntryType('gasto')}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${entryType === 'gasto' ? 'bg-red-600 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}
                >
                  🔴 Gasto
                </button>
                <button
                  onClick={() => setEntryType('ingreso')}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${entryType === 'ingreso' ? 'bg-green-600 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}
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
                  className="flex-1 bg-[var(--bg-secondary)] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
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
              <p className="text-xs text-[var(--text-secondary)] mb-2">Últimos movimientos</p>
              {transactions.slice(0, 5).map(t => (
                <div key={t.id} className="border-b border-[var(--border)]">
                  {editingTx === t.id ? (
                    <div className="py-3 space-y-2">
                      <input
                        value={editTxDesc}
                        onChange={e => setEditTxDesc(e.target.value)}
                        placeholder="Descripción"
                        className="w-full bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                      <div className="flex gap-2">
                        <input
                          value={editTxAmount}
                          onChange={e => setEditTxAmount(e.target.value)}
                          placeholder="Monto"
                          className="flex-1 bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        />
                        <select
                          value={editTxCategory}
                          onChange={e => setEditTxCategory(e.target.value)}
                          className="flex-1 bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        >
                          {Object.keys(CATEGORY_EMOJI).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSaveTx} className="flex-1 bg-[var(--accent)] text-[var(--bg-primary)] rounded-lg py-2 text-sm font-semibold">Guardar</button>
                        <button onClick={() => setEditingTx(null)} className="flex-1 bg-[var(--bg-tertiary)] rounded-lg py-2 text-sm">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span>{CATEGORY_EMOJI[t.category] || '📦'}</span>
                        <div>
                          <p className="text-sm">{t.description}</p>
                          <p className="text-xs text-[var(--text-muted)]">{t.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${t.type === 'ingreso' ? 'text-green-400' : 'text-red-400'}`}>
                          {t.type === 'ingreso' ? '+' : '-'}{formatCLP(t.amount)}
                        </p>
                        <button onClick={() => startEditTx(t)} className="text-[var(--text-muted)] hover:text-[var(--accent)] text-xs">✏️</button>
                        <button onClick={() => handleDeleteTransaction(t.id)} className="text-[var(--text-muted)] hover:text-red-400 text-xs">✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'gastos' && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-sm text-[var(--text-secondary)]">{transactions.length} movimientos este mes</p>
              <button onClick={exportExcel} className="text-xs bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] px-3 py-1 rounded-lg transition-colors">
                📊 Exportar Excel
              </button>
            </div>

            {/* Gráfico donut */}
            {(() => {
              const COLORS = ['#22d3ee','#f87171','#fbbf24','#4ade80','#a78bfa','#fb923c','#60a5fa','#f472b6','#34d399','#e879f9']
              const byCategory = Object.entries(
                transactions
                  .filter(t => t.type === 'gasto')
                  .reduce((acc, t) => ({ ...acc, [t.category]: (acc[t.category] || 0) + t.amount }), {} as Record<string, number>)
              ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

              if (byCategory.length === 0) return null

              return (
                <div className="bg-[var(--bg-secondary)] rounded-2xl p-4">
                  <p className="text-xs text-[var(--text-secondary)] mb-3">Gastos por categoría</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={byCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        onClick={(d) => setActiveCategory(activeCategory === d.name ? null : d.name)}
                        style={{ cursor: 'pointer' }}
                      >
                        {byCategory.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={COLORS[i % COLORS.length]}
                            stroke="transparent"
                            opacity={activeCategory && activeCategory !== entry.name ? 0.3 : 1}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [formatCLP(value), '']}
                        contentStyle={{ background: '#21262d', border: 'none', borderRadius: 8, color: '#e6edf3', fontSize: 12 }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => <span style={{ color: '#8b949e', fontSize: 12 }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {activeCategory && (
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">{CATEGORY_EMOJI[activeCategory] || '📦'} {activeCategory}</p>
                        <button onClick={() => setActiveCategory(null)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
                      </div>
                      {transactions
                        .filter(t => t.type === 'gasto' && t.category === activeCategory)
                        .map(t => (
                          <div key={t.id} className="flex justify-between items-center py-1.5 border-b border-[var(--border)]">
                            <div>
                              <p className="text-sm">{t.description}</p>
                              <p className="text-xs text-[var(--text-muted)]">{t.date}</p>
                            </div>
                            <p className="text-sm font-semibold text-red-400">-{formatCLP(t.amount)}</p>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              )
            })()}
            {transactions.map(t => (
              <div key={t.id} className="border-b border-[var(--border)]">
                {editingTx === t.id ? (
                  <div className="py-3 space-y-2">
                    <input
                      value={editTxDesc}
                      onChange={e => setEditTxDesc(e.target.value)}
                      placeholder="Descripción"
                      className="w-full bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <div className="flex gap-2">
                      <input
                        value={editTxAmount}
                        onChange={e => setEditTxAmount(e.target.value)}
                        placeholder="Monto"
                        className="flex-1 bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                      <select
                        value={editTxCategory}
                        onChange={e => setEditTxCategory(e.target.value)}
                        className="flex-1 bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      >
                        {Object.keys(CATEGORY_EMOJI).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveTx} className="flex-1 bg-[var(--accent)] text-[var(--bg-primary)] rounded-lg py-2 text-sm font-semibold">Guardar</button>
                      <button onClick={() => setEditingTx(null)} className="flex-1 bg-[var(--bg-tertiary)] rounded-lg py-2 text-sm">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span>{CATEGORY_EMOJI[t.category] || '📦'}</span>
                      <div>
                        <p className="text-sm">{t.description}</p>
                        <p className="text-xs text-[var(--text-muted)]">{t.date} · {t.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${t.type === 'ingreso' ? 'text-green-400' : 'text-red-400'}`}>
                        {t.type === 'ingreso' ? '+' : '-'}{formatCLP(t.amount)}
                      </p>
                      <button onClick={() => startEditTx(t)} className="text-[var(--text-muted)] hover:text-[var(--accent)] text-xs">✏️</button>
                      <button onClick={() => handleDeleteTransaction(t.id)} className="text-[var(--text-muted)] hover:text-red-400 text-xs">✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {tab === 'ingresos' && (
          <>
            <div className="bg-[var(--bg-secondary)] rounded-2xl p-4">
              <p className="text-xs text-[var(--text-secondary)]">Total ingresos este mes</p>
              <p className="text-3xl font-bold text-green-400">{formatCLP(totalIngresos)}</p>
            </div>

            {transactions.filter(t => t.type === 'ingreso').length === 0 && (
              <p className="text-center text-[var(--text-muted)] text-sm py-8">No hay ingresos registrados este mes.</p>
            )}

            {transactions.filter(t => t.type === 'ingreso').map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span>💵</span>
                  <div>
                    <p className="text-sm">{t.description}</p>
                    <p className="text-xs text-[var(--text-muted)]">{t.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-green-400">+{formatCLP(t.amount)}</p>
                  <button onClick={() => handleDeleteTransaction(t.id)} className="text-[var(--text-muted)] hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'suscripciones' && (
          <>
            <div className="flex justify-between items-center">
              <p className="text-xs text-[var(--text-secondary)]">Total activo: <span className="text-yellow-400 font-bold">{formatCLP(totalSubs)}/mes</span></p>
              <button onClick={() => setShowSubForm(!showSubForm)} className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-3 py-1 rounded-lg transition-colors">
                + Agregar
              </button>
            </div>

            {showSubForm && (
              <div className="bg-[var(--bg-secondary)] rounded-xl p-4 space-y-3">
                <input
                  placeholder="Nombre (ej: Spotify)"
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  className="w-full bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
                <input
                  placeholder="Monto mensual (ej: 5000)"
                  value={newSubAmount}
                  onChange={e => setNewSubAmount(e.target.value)}
                  className="w-full bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
                <div className="flex gap-2">
                  <button onClick={handleAddSub} className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg py-2 text-sm font-semibold transition-colors">
                    Guardar
                  </button>
                  <button onClick={() => setShowSubForm(false)} className="flex-1 bg-[var(--bg-tertiary)] hover:bg-gray-600 rounded-lg py-2 text-sm transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {subscriptions.length === 0 && (
              <p className="text-center text-[var(--text-muted)] text-sm py-8">No tenés suscripciones. ¡Agregá una!</p>
            )}

            {subscriptions.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-[var(--bg-secondary)] rounded-xl px-4 py-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{formatCLP(s.amount)}/mes</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleSub(s.id, s.active)}
                    className={`text-xs px-3 py-1 rounded-full transition-colors ${s.active ? 'bg-green-600 hover:bg-yellow-600' : 'bg-[var(--bg-tertiary)] hover:bg-green-600'}`}
                  >
                    {s.active ? 'Activa' : 'Inactiva'}
                  </button>
                  <button onClick={() => handleDeleteSub(s.id)} className="text-[var(--text-muted)] hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
            ))}
          </>
        )}

        {showPerfil && (
          <>
            {/* Datos del usuario */}
            <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 space-y-3">
              <p className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">Mis datos</p>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Email</p>
                <p className="text-sm text-white">{userEmail}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Nombre</p>
                {editingNombre ? (
                  <div className="flex gap-2 mt-1">
                    <input
                      value={nombreEdit}
                      onChange={e => setNombreEdit(e.target.value)}
                      className="flex-1 bg-[var(--bg-tertiary)] rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <button onClick={handleSaveNombre} className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-3 py-1 rounded-lg">Guardar</button>
                    <button onClick={() => setEditingNombre(false)} className="text-xs bg-[var(--bg-tertiary)] hover:bg-gray-600 px-3 py-1 rounded-lg">Cancelar</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-white">{nombre || 'Sin nombre'}</p>
                    <button onClick={() => setEditingNombre(true)} className="text-xs text-[var(--accent)] hover:text-[#67e8f9]">Editar</button>
                  </div>
                )}
              </div>
            </div>

            {/* Presupuesto */}
            <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">Presupuesto</p>
                <button onClick={() => setShowBudgetForm(!showBudgetForm)} className="text-xs text-[var(--accent)]">
                  {showBudgetForm ? 'Cerrar' : '+ Configurar'}
                </button>
              </div>

              {showBudgetForm && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1">Límite general mensual</p>
                    <div className="flex gap-2">
                      <input
                        value={budgetGeneral}
                        onChange={e => setBudgetGeneral(e.target.value)}
                        placeholder="ej: 500000"
                        className="flex-1 bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                      <button onClick={handleSaveBudgetGeneral} className="bg-[var(--accent)] text-[var(--bg-primary)] px-3 rounded-lg text-sm font-semibold">Guardar</button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1">Límite por categoría</p>
                    <div className="flex gap-2 mb-2">
                      <select
                        value={budgetCategory}
                        onChange={e => setBudgetCategory(e.target.value)}
                        className="flex-1 bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      >
                        {Object.keys(CATEGORY_EMOJI).filter(c => c !== 'Ingreso').map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input
                        value={budgetCategoryAmount}
                        onChange={e => setBudgetCategoryAmount(e.target.value)}
                        placeholder="Monto"
                        className="flex-1 bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                      <button onClick={handleSaveBudgetCategory} className="bg-[var(--accent)] text-[var(--bg-primary)] px-3 rounded-lg text-sm font-semibold">+</button>
                    </div>
                  </div>
                </div>
              )}

              {budgets.length === 0 && !showBudgetForm && (
                <p className="text-xs text-[var(--text-muted)]">No tenés presupuestos configurados.</p>
              )}

              {budgets.map(b => (
                <div key={b.id} className="flex justify-between items-center text-sm">
                  <span>{b.type === 'general' ? '🎯 General' : `${CATEGORY_EMOJI[b.category!] || '📦'} ${b.category}`}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-secondary)]">{formatCLP(b.amount)}</span>
                    <button onClick={() => handleDeleteBudget(b.id)} className="text-[var(--text-muted)] hover:text-red-400 text-xs">✕</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Niveles */}
            <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 space-y-3">
              <p className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider">Niveles de ahorro</p>
              {LEVELS.map((level, i) => {
                const balance = totalIngresos - totalGastos
                const alcanzado = balance >= level.min
                return (
                  <div key={i} className={`flex items-center gap-3 py-2 border-b border-[var(--border)] ${alcanzado ? 'opacity-100' : 'opacity-40'}`}>
                    <span className="text-2xl">{level.emoji}</span>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${level.color}`}>{level.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {level.max === Infinity
                          ? `Más de $${level.min.toLocaleString('es-CL')}`
                          : `$${level.min.toLocaleString('es-CL')} - $${level.max.toLocaleString('es-CL')}`}
                      </p>
                    </div>
                    {alcanzado && <span className="text-green-400 text-xs font-bold">✓</span>}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

