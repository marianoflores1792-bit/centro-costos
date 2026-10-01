import webpush from 'web-push'
import { NextRequest, NextResponse } from 'next/server'

webpush.setVapidDetails(
  'mailto:marianoflores1792@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: NextRequest) {
  const { subscriptions, title, body } = await req.json()

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const payload = JSON.stringify({ title, body })
  let sent = 0

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload)
      sent++
    } catch {
      // Subscription expired or invalid — ignore
    }
  }

  return NextResponse.json({ ok: true, sent })
}
