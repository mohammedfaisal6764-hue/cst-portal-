import { sb } from './supabase'

// IP + device (IP একবার আনলে এই session-এ মনে রাখে, বারবার ipify ডাকে না)
export async function getIPAndDevice() {
  let ip = null
  try { ip = sessionStorage.getItem('cst_ip') } catch {}
  if (!ip) {
    try {
      const r = await fetch('https://api.ipify.org?format=json')
      const d = await r.json()
      ip = d.ip || null
      if (ip) try { sessionStorage.setItem('cst_ip', ip) } catch {}
    } catch {}
  }
  const ua = navigator.userAgent
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Linux'
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Other'
  return { ip: ip || 'Unknown', device: `${os} / ${br}` }
}

// যেকোনো ভাবে session চালু হলে (login, email-verify link, আবার সাইটে ঢোকা) এটা চলে:
// ip, device, last_seen, email_verified আপডেট + signup-এর সময় দেওয়া roll/phone/section/semester পূরণ
let lastTouch = 0
export async function touchUser(authUser, profile) {
  if (!authUser?.id) return
  const now = Date.now()
  if (now - lastTouch < 5 * 60 * 1000) return   // ৫ মিনিটে একবার
  lastTouch = now
  try {
    const { ip, device } = await getIPAndDevice()
    const m = authUser.user_metadata || {}
    const base = { ip_address: ip, device_info: device, last_seen: new Date().toISOString() }
    if (profile) {
      if (!profile.roll && m.roll) base.roll = m.roll
      if (!profile.section && m.section) base.section = m.section
      if (!profile.phone && m.phone) base.phone = m.phone
      if (!profile.semester && m.semester) base.semester = m.semester
      if (!profile.name && m.name) base.name = m.name
    }
    const withVerify = { ...base, email_verified: !!authUser.email_confirmed_at, email_verified_at: authUser.email_confirmed_at || null }
    let { error } = await sb.from('users').update(withVerify).eq('id', authUser.id)
    // email_verified কলাম এখনও না থাকলে (SQL run হয়নি) বাকি তথ্য তবু সেভ হবে
    if (error) await sb.from('users').update(base).eq('id', authUser.id)
  } catch {}
}
