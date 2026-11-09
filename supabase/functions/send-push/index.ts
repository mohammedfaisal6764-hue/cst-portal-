// Supabase Edge Function: নতুন ফাইল/Homework-এর push notification পাঠায়
// (Firebase Hosting-এ Netlify function চলে না, তাই Supabase-এই চালানো হচ্ছে — বিনামূল্যে)
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const ADMIN_EMAIL = 'mohammedfaisal6764@gmail.com'
const SENDER_ROLES = ['admin', 'teacher', 'cr', 'group_admin', 'uploader']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (obj: Record<string, unknown>) =>
  new Response(JSON.stringify(obj), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const parsed = await req.json().catch(() => ({}))
    // অ্যাপ নিজে public key জেনে নেয় — কোডের key ও Secrets-এর private key কখনো অমিল হবে না
    if (parsed?.action === 'key') return reply({ key: Deno.env.get('VAPID_PUBLIC_KEY') || null })
    const need = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_EMAIL']
    const missing = need.filter((k) => !Deno.env.get(k))
    if (missing.length) return reply({ error: 'Supabase Secrets-এ নেই: ' + missing.join(', ') })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // শুধু লগইন করা admin/uploader পাঠাতে পারবে (অন্য কেউ spam করতে পারবে না)
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: u } = await admin.auth.getUser(token)
    const user = u?.user
    if (!user) return reply({ error: 'লগইন করা নেই' })
    if (user.email !== ADMIN_EMAIL) {
      const { data: prof } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
      if (!prof || !SENDER_ROLES.includes(prof.role)) return reply({ error: 'পাঠানোর অনুমতি নেই' })
    }

    const { section, title, body, url } = parsed

    const email = String(Deno.env.get('VAPID_EMAIL')).replace(/^mailto:/i, '').trim()
    webpush.setVapidDetails('mailto:' + email, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

    let q = admin.from('push_subscriptions').select('*')
    if (section && section !== 'all') q = q.or(`section.eq.${section},section.is.null`)
    const { data: subs, error } = await q
    if (error) return reply({ error: 'push_subscriptions পড়া যায়নি: ' + error.message + ' (push_setup.sql run করেছেন?)' })
    if (!subs || !subs.length) return reply({ sent: 0, failed: 0, total: 0 })

    const payload = JSON.stringify({ title, body, url: url || '/', icon: '/favicon.svg', tag: 'cst:' + title + '|' + body })
    let firstError: string | null = null
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload).catch(async (err) => {
          if (!firstError) firstError = (err.statusCode ? err.statusCode + ': ' : '') + (err.body || err.message || 'error')
          // 403 = পুরোনো key-র subscription (আর কখনো কাজ করবে না) — মুছে দিলে সংখ্যা সঠিক থাকে; user সাইট খুললে নিজে নতুন করে জমা হয়
          if (err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 403) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          throw err
        })
      )
    )
    const sent = results.filter((r) => r.status === 'fulfilled').length
    return reply({ sent, failed: results.length - sent, total: subs.length, firstError })
  } catch (e) {
    return reply({ error: String((e as Error)?.message || e) })
  }
})
