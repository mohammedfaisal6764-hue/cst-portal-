const webpush = require('web-push')
const { createClient } = require('@supabase/supabase-js')

const json = (statusCode, obj) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) })

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' })

  try {
    // Netlify → Site settings → Environment variables এ এগুলো সব থাকতে হবে
    const need = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_EMAIL', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY']
    const missing = need.filter(k => !process.env[k])
    if (missing.length) return json(500, { error: 'Netlify-তে environment variable নেই: ' + missing.join(', ') })

    const { section, title, body, url } = JSON.parse(event.body || '{}')

    const email = String(process.env.VAPID_EMAIL).replace(/^mailto:/i, '').trim()
    webpush.setVapidDetails('mailto:' + email, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

    // ঐ section-এর subscription + যাদের section ফাঁকা (তারা সব ফাইলের notification পাবে)
    let query = supabase.from('push_subscriptions').select('*')
    if (section && section !== 'all') query = query.or(`section.eq.${section},section.is.null`)
    const { data: subs, error } = await query
    if (error) return json(500, { error: 'push_subscriptions পড়া যায়নি: ' + error.message + ' (push_setup.sql run করেছেন?)' })
    if (!subs || subs.length === 0) return json(200, { sent: 0, failed: 0, total: 0 })

    const payload = JSON.stringify({ title, body, url: url || '/', icon: '/favicon.svg', tag: 'cst-' + Date.now() })

    let firstError = null
    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
          .catch(async err => {
            if (!firstError) firstError = (err.statusCode ? err.statusCode + ': ' : '') + (err.body || err.message || 'error')
            // Expired subscription হলে delete করো
            if (err.statusCode === 410 || err.statusCode === 404) {
              await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
            }
            throw err
          })
      )
    )

    const sent   = results.filter(r => r.status === 'fulfilled').length
    const failed = results.length - sent
    return json(200, { sent, failed, total: subs.length, firstError })
  } catch (err) {
    console.error('send-push error:', err)
    return json(500, { error: err.message })
  }
}
