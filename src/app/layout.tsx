import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Centro de Costos',
  description: 'Gestión de gastos personales',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Centro de Costos',
  },
}

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.className} h-full`}>
      <body className="min-h-full bg-gray-950 text-white">{children}</body>
    </html>
  )
}
