import { sb, TYPE_LABELS } from './supabase'

// তোমার VAPID public key
export const VAPID_PUBLIC_KEY = 'BJgf3vKec6ROV-XCKuI1coYeX8Pu-48xV8U42mZB3hCUhX-RJ6kXs-6UVMdB8nPl5CTCXveXU8bchkyGdkdb6AM'

// base64url → Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// সার্ভারের public key (সার্ভার = সত্যের উৎস, তাই private key-র সাথে কখনো অমিল হবে না)
let _serverKey = null
async function getServerKey() {
  if (_serverKey) return _serverKey
  try {
    const { data } = await sb.functions.invoke('send-push', { body: { action: 'key' } })
    if (data?.key) { _serverKey = data.key; return _serverKey }
  } catch {}
  return VAPID_PUBLIC_KEY
}
function sameKey(sub, key) {
  try {
    const a = new Uint8Array(sub.options.applicationServerKey || [])
    const b = urlBase64ToUint8Array(key)
    return a.length === b.length && a.every((v, i) => v === b[i])
  } catch { return true }
}
// DB-তে subscription সেভ (ব্যর্থ হলে কারণ ফেরত দেয় — আগে এটা চুপচাপ ব্যর্থ হতো)
async function saveSubscription(userId, section, sub) {
  const j = sub.toJSON()
  const row = { user_id: userId, section: section || null, endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth, updated_at: new Date().toISOString() }
  const { error } = await sb.from('push_subscriptions').upsert(row, { onConflict: 'user_id' })
  return error ? error.message : null
}

// Service Worker register + push subscribe → { ok, reason }
export async function subscribePush(userId, section) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { ok: false, reason: 'এই ব্রাউজারে notification সাপোর্ট নেই (iPhone হলে সাইটটা Home Screen-এ Add করে খুলুন)' }
  }
  try {
    const perm = await Notification.requestPermission()
    if (perm === 'denied') return { ok: false, reason: 'Notification block করা আছে — ঠিকানার পাশের 🔒 → Notifications → Allow করুন' }
    if (perm !== 'granted') return { ok: false, reason: 'Allow চাপা হয়নি' }

    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // আগের (পুরোনো key-র) subscription থাকলে নতুন করে নিতে হয়
    const key = await getServerKey()
    let sub = await reg.pushManager.getSubscription()
    if (sub && !sameKey(sub, key)) { try { await sub.unsubscribe() } catch {}; sub = null }   // পুরোনো key-র subscription কাজ করে না
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
    }
    let err = await saveSubscription(userId, section, sub)
    if (err) {
      // পুরোনো subscription নষ্ট হলে নতুন বানিয়ে আবার চেষ্টা
      try { await sub.unsubscribe() } catch {}
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
      err = await saveSubscription(userId, section, sub)
    }
    if (err) return { ok: false, local: true, reason: 'সাইট খোলা থাকলে notification আসবে; বন্ধ থাকলে আসার জন্য সার্ভার সেটআপ বাকি (সেভ হয়নি: ' + err + ')' }
    return { ok: true }
  } catch (e) {
    console.error('Push subscribe error:', e)
    return { ok: false, local: ('Notification' in window && Notification.permission === 'granted'), reason: (('Notification' in window && Notification.permission === 'granted') ? 'সাইট খোলা থাকলে notification আসবে (বন্ধ থাকলে আসার জন্য সার্ভার সেটআপ বাকি): ' : 'ব্যর্থ: ') + (e?.message || e) }
  }
}

// permission আগেই দেওয়া আছে কিন্তু DB-তে row নেই/পুরোনো — চুপচাপ ঠিক করে দেয়
export async function syncPushSubscription(userId, section) {
  try {
    if (!userId || !('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    let sub = reg && await reg.pushManager.getSubscription()
    if (!sub) return
    // key বদলে গেছে (বা অমিল) হলে নতুন key-তে আবার subscribe — এতেই "০ জনকে গেছে" সমস্যা মেটে
    const key = await getServerKey()
    if (!sameKey(sub, key)) {
      try { await sub.unsubscribe() } catch {}
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
    }
    await saveSubscription(userId, section, sub)
  } catch {}
}

// Subscription আছে কিনা check
export async function checkPushSubscription() {
  if (!('serviceWorker' in navigator)) return false
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!reg) return false
    const sub = await reg.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}

// Unsubscribe
export async function unsubscribePush(userId) {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    if (reg) {
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
    }
    if (userId) await sb.from('push_subscriptions').delete().eq('user_id', userId)
    return true
  } catch {
    return false
  }
}

// ========== SEND NOTIFICATION (Netlify Function থেকে call হবে) ==========
// এই function টা Netlify Function এর মাধ্যমে call করতে হবে
// কারণ VAPID private key client-side রাখা unsafe

// Supabase Edge Function "send-push" ডাকে (Firebase Hosting-এ Netlify function চলে না)
// ফেরত দেয়: { ok, sent, failed, total, error }
export async function triggerNotification({ section, title, body, url }) {
  try {
    const { data, error } = await sb.functions.invoke('send-push', { body: { section, title, body, url } })
    if (error) {
      let msg = error.message || String(error)
      if (/not found|404/i.test(msg) || error.context?.status === 404) msg = 'Supabase function "send-push" deploy করা নেই'
      else if (/failed to send|fetch/i.test(msg)) msg = 'Function-এ পৌঁছানো যায়নি (deploy করেছেন?)'
      return { ok: false, error: msg }
    }
    if (!data) return { ok: false, error: 'ফাঁকা উত্তর' }
    if (data.error) return { ok: false, error: data.error }
    return { ok: true, sent: data.sent || 0, failed: data.failed || 0, total: data.total ?? ((data.sent || 0) + (data.failed || 0)), firstError: data.firstError }
  } catch (err) {
    console.error('Trigger notification error:', err)
    return { ok: false, error: 'নেটওয়ার্ক সমস্যা: ' + (err?.message || err) }
  }
}

// ব্যর্থতার কারণ বাংলায়
export function pushWhy(e) {
  const t = String(e || '')
  if (/^(401|403)|vapid|credentials/i.test(t)) return 'VAPID key মিলছে না — Supabase Secrets-এর private key ও public key একই জোড়ার হতে হবে; user-কে সাইট খুলে আবার চালু করতে হবে'
  if (/^(404|410)/.test(t)) return 'user-এর subscription মেয়াদ শেষ — সে সাইট খুলে notification আবার চালু করবে'
  if (/^413/.test(t)) return 'বার্তা বেশি বড়'
  if (/^(429|5\d\d)/.test(t)) return 'Chrome-এর সার্ভার সাময়িক ব্যস্ত, একটু পরে আবার দেখুন'
  return t || 'অজানা কারণ'
}

// Toast-এর জন্য ছোট বার্তা
export function pushResultText(r) {
  if (!r) return ''
  if (!r.ok) return '🔔 Notification যায়নি: ' + r.error
  if (r.total === 0) return '🔔 কেউ এখনও notification চালু করেনি'
  return `🔔 ${r.sent} জনকে notification গেছে` + (r.failed ? ` (${r.failed} জনকে যায়নি — ${pushWhy(r.firstError)})` : '')
}

// ═══ সাইট খোলা থাকলে (ট্যাব ব্যাকগ্রাউন্ডে থাকলেও) সরাসরি Chrome notification — কোনো সার্ভার লাগে না ═══
// সার্ভার push-এর সাথে একই tag, তাই দুটো একসাথে এলে Chrome একটাই দেখায়।
export const noticeTag = (title, body) => 'cst:' + title + '|' + body
export const fileNotice = (f) => ({ title: '📚 নতুন ফাইল আপলোড হয়েছে!', body: `${f.subject || 'নতুন ফাইল'} — ${TYPE_LABELS[f.type] || f.type}`, go: 'all' })
export const hwNotice   = (h) => ({ title: '📚 নতুন Homework যোগ হয়েছে!', body: `${h.subject || ''} — ${h.chapter || ''} | জমার তারিখ: ${h.due_date || '—'}`, go: 'homework' })

export async function showLocalNotification({ title, body, go }) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false
    // ট্যাবে চোখের সামনে থাকলে বিরক্ত করব না
    if (document.visibilityState === 'visible' && document.hasFocus()) return false
    const opts = { body, icon: '/favicon.svg', badge: '/favicon.svg', tag: noticeTag(title, body), data: { url: go ? '/?go=' + go : '/' } }
    const reg = ('serviceWorker' in navigator) ? (await navigator.serviceWorker.getRegistration('/sw.js') || await navigator.serviceWorker.register('/sw.js')) : null
    if (reg) { await reg.showNotification(title, opts); return true }
    new Notification(title, opts); return true
  } catch { return false }
}

// এই ব্রাউজারের subscription সার্ভারের key-র সাথে মেলে কি না (গোলমাল ধরতে)
export async function pushKeyStatus() {
  try {
    const { data } = await sb.functions.invoke('send-push', { body: { action: 'key' } })
    if (!data?.key) return { fn: false }   // ফাংশনে নতুন কোড deploy হয়নি বা VAPID_PUBLIC_KEY secret নেই
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = reg && await reg.pushManager.getSubscription()
    if (!sub) return { fn: true, sub: false }
    return { fn: true, sub: true, match: sameKey(sub, data.key) }
  } catch { return { fn: false } }
}

// নিজের subscription মুছে সার্ভারের key-তে নতুন করে নেওয়া
export async function resetPushSubscription(userId, section) {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = reg && await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
    if (userId) await sb.from('push_subscriptions').delete().eq('user_id', userId)
  } catch {}
  _serverKey = null
  return subscribePush(userId, section)
}
