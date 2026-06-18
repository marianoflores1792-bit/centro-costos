export type ParsedEntry = {
  description: string
  amount: number
  type: 'gasto' | 'ingreso'
  category: string
}

const CATEGORIES: Record<string, string[]> = {
  Bencina: ['bencina', 'gasolina', 'combustible', 'copec', 'shell', 'petrobras'],
  Comida: ['comida', 'almuerzo', 'cena', 'desayuno', 'restaurant', 'sushi', 'pizza', 'mcdonalds', 'burger', 'rappi', 'uber eats', 'pedidos ya'],
  Supermercado: ['supermercado', 'jumbo', 'lider', 'unimarc', 'tottus', 'santa isabel'],
  Fiesta: ['fiesta', 'bar', 'tragos', 'cerveza', 'pisco', 'disco', 'boliche', 'uber'],
  Suscripciones: ['netflix', 'spotify', 'claude', 'blizzard', 'youtube', 'amazon', 'suscripcion', 'suscripción'],
  Salud: ['farmacia', 'medico', 'médico', 'doctor', 'hospital', 'clinica', 'clínica', 'remedios'],
  Transporte: ['metro', 'bus', 'taxi', 'uber', 'cabify', 'bip', 'transporte'],
  Ropa: ['ropa', 'zapatillas', 'zapatos', 'falabella', 'ripley', 'paris', 'zara'],
  Ingreso: ['sueldo', 'salario', 'pago', 'transferencia recibida', 'ingreso', 'freelance'],
}

function detectCategory(text: string): string {
  const lower = text.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(k => lower.includes(k))) return category
  }
  return 'Otros'
}

function detectType(text: string): 'gasto' | 'ingreso' {
  const lower = text.toLowerCase()
  const ingresoWords = ['sueldo', 'salario', 'ingreso', 'cobré', 'cobre', 'gané', 'gane', 'recibí', 'recibi', 'transferencia recibida']
  if (ingresoWords.some(w => lower.includes(w))) return 'ingreso'
  return 'gasto'
}

export function parseEntry(input: string): ParsedEntry | null {
  const cleaned = input.trim()
  if (!cleaned) return null

  // Buscar número en el texto (con o sin puntos de miles)
  const numberMatch = cleaned.match(/[\d.,]+/)
  if (!numberMatch) return null

  const amountStr = numberMatch[0].replace(/\./g, '').replace(',', '.')
  const amount = parseFloat(amountStr)
  if (isNaN(amount) || amount <= 0) return null

  const description = cleaned.replace(numberMatch[0], '').trim().replace(/^[-\s]+|[-\s]+$/g, '') || cleaned

  return {
    description: description || cleaned,
    amount,
    type: detectType(cleaned),
    category: detectCategory(cleaned),
  }
}
