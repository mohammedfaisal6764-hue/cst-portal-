import React, { useState } from 'react'
import { useThemePref, useStylePref, wallpaperAllowed, isWpFamily, useTintPref, TINTS, getClarity, setClarity } from '../theme'
import { ABSTRACT, useWallpaper, setSiteWallpaper, setAccess, uploadToLibrary, addToLibrary, removeFromLibrary, importStarterPhotos, testImage, refreshSiteWallpaper } from '../wallpaper'

const OPTS = [
  { v: 'light',  icon: '☀️', label: 'Light' },
  { v: 'dark',   icon: '🌙', label: 'Dark'  },
  { v: 'system', icon: '💻', label: 'Auto'  },
]

// compact=true হলে শুধু আইকন (login পাতার জন্য)
export default function ThemeSwitch({ compact = false }) {
  const [pref, setPref] = useThemePref()
  return (
    <div role="radiogroup" aria-label="Theme" style={{ display: 'flex', gap: 3, padding: 3, background: 'rgba(37,99,235,.06)', border: '1px solid var(--border)', borderRadius: 10 }}>
      {OPTS.map(o => {
        const on = pref === o.v
        return (
          <button key={o.v} role="radio" aria-checked={on} onClick={() => setPref(o.v)} title={o.label + ' theme'}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: compact ? '6px 9px' : '7px 4px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: on ? 700 : 500,
              border: on ? '1px solid rgba(37,99,235,.5)' : '1px solid transparent',
              background: on ? 'rgba(37,99,235,.18)' : 'transparent',
              color: on ? 'var(--c-blue)' : 'var(--text-4)', transition: 'all .15s',
            }}>
            <span style={{ fontSize: 13 }}>{o.icon}</span>{!compact && o.label}
          </button>
        )
      })}
    </div>
  )
}

// Profile-এ: design style বেছে নেওয়ার card (Glass / Classic)
export function StyleSwitch() {
  const [st, setSt] = useStylePref()
  const OPT = [
    { v: 'crystal', icon: '💎', title: 'Crystal', sub: 'স্বচ্ছ উজ্জ্বল কাচ — ডিফল্ট',
      prev: 'linear-gradient(135deg,#7aa6d6,#c6b7d9 60%,#e8c9b8)', glass: true },
    { v: 'wallpaper', icon: '🏔️', title: 'Wallpaper', sub: 'Frosted glass — ছবির ওপর ঝাপসা কাচ',
      prev: 'linear-gradient(135deg,#9cc4ec,#dcecfa 60%,#f5faff)', glass: true },
    { v: 'transparent', icon: '🪟', title: 'Transparent', sub: 'একদম স্বচ্ছ কাচ — ছবি সবখানে দেখা যায়',
      prev: 'linear-gradient(135deg,#7aa6d8,#c9b6e8 55%,#f0c9a8)', glass: true, clear: true },
    { v: 'glass',     icon: '🫧', title: 'Glass',     sub: 'Glassmorphism — রঙিন কাচ',
      prev: 'linear-gradient(135deg, rgba(37,99,235,.7), rgba(124,58,237,.6) 55%, rgba(8,145,178,.5))', glass: true },
    { v: 'classic',   icon: '🧱', title: 'Classic',   sub: 'আরও আগের সাধারণ design',
      prev: 'linear-gradient(135deg, #111827, #0d1117)' },
  ]
  const showWp = wallpaperAllowed()
  const list = showWp ? OPT : OPT.filter(o => !isWpFamily(o.v))
  const cur = (isWpFamily(st) && !showWp) ? 'glass' : st
  return (
    <div role="radiogroup" aria-label="Design style" style={{ display: 'grid', gridTemplateColumns: `repeat(${list.length > 3 ? 2 : list.length}, minmax(0,1fr))`, gap: 8 }}>
      {list.map(o => {
        const on = cur === o.v
        return (
          <button key={o.v} role="radio" aria-checked={on} onClick={() => setSt(o.v)}
            style={{ textAlign: 'left', padding: 7, borderRadius: 14, cursor: 'pointer',
              border: on ? '1.5px solid rgba(37,99,235,.75)' : '1px solid var(--border)',
              background: on ? 'rgba(37,99,235,.12)' : 'transparent', boxShadow: on ? '0 0 0 3px rgba(37,99,235,.15)' : 'none' }}>
            <div style={{ height: 50, borderRadius: 9, background: o.prev, position: 'relative', overflow: 'hidden', marginBottom: 7, border: '1px solid rgba(148,163,184,.25)' }}>
              <div style={{ position: 'absolute', left: 7, top: 7, right: 18, height: 12, borderRadius: (o.v === 'wallpaper' || o.v === 'crystal') ? 99 : 5,
                background: o.clear ? 'rgba(255,255,255,.16)' : o.glass ? 'rgba(255,255,255,.4)' : '#1e3050', border: o.glass ? '1px solid rgba(255,255,255,.6)' : '1px solid #243655' }} />
              <div style={{ position: 'absolute', left: 7, top: 25, width: '48%', height: 16, borderRadius: (o.v === 'wallpaper' || o.v === 'crystal') ? 10 : 5,
                background: o.glass ? 'rgba(255,255,255,.28)' : '#1e3050', border: o.glass ? '1px solid rgba(255,255,255,.5)' : '1px solid #243655' }} />
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: on ? 'var(--c-blue)' : 'var(--text)' }}>{o.icon} {o.title}{on ? ' ✓' : ''}</div>
            <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.35 }}>{o.sub}</div>
          </button>
        )
      })}
    </div>
  )
}

// 🎨 রঙ বাছাই — কাচ/মেনু/বোতাম সব এই রঙে
export function TintSwitch() {
  const [tint, setTint] = useTintPref()
  const [st] = useStylePref()
  if (st === 'classic') return <div style={{ fontSize: 11, color: 'var(--muted)' }}>Classic design-এ রঙ বদলায় না — Glass বা Wallpaper বেছে নিন।</div>
  return (
    <div role="radiogroup" aria-label="রঙ" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
      {TINTS.map(t => {
        const on = tint === t.v
        return (
          <button key={t.v} role="radio" aria-checked={on} onClick={() => setTint(t.v)} title={t.label}
            style={{ padding: '8px 4px 7px', borderRadius: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              border: on ? '1.5px solid ' + t.c : '1px solid var(--border)', background: on ? 'rgba(148,163,184,.14)' : 'transparent',
              boxShadow: on ? `0 0 0 3px ${t.c}33` : 'none', textShadow: 'none' }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${t.c}, ${t.c2})`, border: '2px solid rgba(255,255,255,.7)', boxShadow: '0 3px 10px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 800 }}>{on ? '✓' : ''}</span>
            <span style={{ fontSize: 10, fontWeight: on ? 700 : 500, color: on ? 'var(--text)' : 'var(--muted)' }}>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// 🔄 নতুন ব্যাকগ্রাউন্ড ছবি — শুধু admin, শুধু wallpaper design চললে
export function WpRefresh({ showToast, isAdmin }) {
  const [st] = useStylePref()
  const [busy, setBusy] = React.useState(false)
  if (!isAdmin || !isWpFamily(st) || !wallpaperAllowed()) return null
  async function go() {
    if (busy) return
    setBusy(true); showToast && showToast('🔄 ইন্টারনেট থেকে নতুন ছবি আনা হচ্ছে…')
    try {
      const r = await refreshSiteWallpaper()
      showToast && showToast(r.saved ? '✅ নতুন background ছবি সবার জন্য সেট হয়েছে' : '✅ নতুন ছবি এসেছে (সবার জন্য সেভ হয়নি — site_settings.sql run করুন)', r.saved ? undefined : 'err')
    } catch (e) { showToast && showToast(e.message, 'err') }
    setBusy(false)
  }
  return (
    <button className="wp-refresh" onClick={go} disabled={busy} title="নতুন background ছবি আনুন" aria-label="নতুন background ছবি">
      <span style={{ display: 'inline-block', animation: busy ? 'spin .8s linear infinite' : 'none' }}>🔄</span>
      <span className="wp-refresh-txt">{busy ? 'আনছে…' : 'নতুন ছবি'}</span>
    </button>
  )
}

// Wallpaper: ছবি থাকে আপনার নিজের R2 সার্ভারে. Admin সেখান থেকে বাছে; ইউজার শুধু অনুমতি পেলে wallpaper design দেখে
export function WallpaperPicker({ isAdmin, showToast }) {
  const wp = useWallpaper()
  const [busy, setBusy] = React.useState(false)
  const [prog, setProg] = React.useState('')
  const [link, setLink] = React.useState('')
  const fileRef = React.useRef()
  const lib = wp.site.lib || []
  const chosen = wp.site.url
  const say = (m, t) => showToast && showToast(m, t)
  if (!isAdmin) return (
    <div style={{ fontSize: 11.5, color: 'var(--muted)', padding: '10px 12px', borderRadius: 10, border: '1px dashed var(--border)' }}>
      🔒 Wallpaper design admin-এর অনুমতি সাপেক্ষ, আর ছবি admin-ই ঠিক করেন।
    </div>
  )
  const fail = (e, pre) => say(pre + e.message + ' (site_settings.sql run করেছেন?)', 'err')

  async function choose(url) {
    try { setBusy(true); await setSiteWallpaper(url); say('✅ সবার জন্য wallpaper বদলানো হয়েছে') } catch (e) { fail(e, 'ব্যর্থ: ') }
    setBusy(false)
  }
  async function onFiles(e) {
    const files = [...(e.target.files || [])].filter(f => f.type.startsWith('image/')); e.target.value = ''
    if (!files.length) { say('শুধু ছবি দিন', 'err'); return }
    setBusy(true)
    try {
      const out = []
      for (let i = 0; i < files.length; i++) {
        setProg(`⏳ ${i + 1}/${files.length} আপনার সার্ভারে যাচ্ছে…`)
        out.push(await uploadToLibrary(files[i], undefined, p => setProg(`⏳ ${i + 1}/${files.length} — ${p}%`)))
      }
      await addToLibrary(out); say(`✅ ${out.length}টি ছবি আপনার সার্ভারে সেভ হয়েছে`)
    } catch (er) { fail(er, 'আপলোড ব্যর্থ: ') }
    setProg(''); setBusy(false)
  }
  async function seed() {
    setBusy(true)
    try { const n = await importStarterPhotos((i, t) => setProg(`⏳ নমুনা ছবি ${i}/${t} আপনার সার্ভারে যাচ্ছে…`)); say(`✅ ${n}টি নমুনা ছবি আপনার সার্ভারে যোগ হয়েছে`) }
    catch (er) { fail(er, 'ব্যর্থ: ') }
    setProg(''); setBusy(false)
  }
  async function fromLink() {
    const u = link.trim()
    if (!/^https?:\/\//i.test(u)) { say('https:// দিয়ে শুরু হওয়া ছবির লিংক দিন', 'err'); return }
    setBusy(true); setProg('⏳ লিংক থেকে ছবি আনা হচ্ছে…')
    try {
      if (!(await testImage(u))) throw new Error('এই লিংক থেকে ছবি লোড হয়নি')
      const r = await fetch(u, { mode: 'cors' }).catch(() => null)
      if (!r || !r.ok) throw new Error('এই সাইট ছবি কপি করতে দিচ্ছে না — ছবিটা ডাউনলোড করে আপলোড করুন')
      const item = await uploadToLibrary(new File([await r.blob()], 'link.jpg', { type: 'image/jpeg' }), 'লিংক থেকে')
      await addToLibrary([item]); setLink(''); say('✅ ছবি আপনার সার্ভারে সেভ হয়েছে')
    } catch (er) { say(er.message, 'err') }
    setProg(''); setBusy(false)
  }
  async function del(it) {
    if (!window.confirm('এই ছবি তালিকা থেকে সরাবেন? (R2-তে ফাইলটা থেকে যাবে)')) return
    try { setBusy(true); await removeFromLibrary(it.id); say('তালিকা থেকে সরানো হয়েছে') } catch (e) { fail(e, 'ব্যর্থ: ') }
    setBusy(false)
  }

  const modes = [['none', '🔒', 'কেউ না'], ['selected', '🎯', 'বাছাই করা'], ['all', '👥', 'সবাই']]
  async function setMode(mode) {
    try {
      await setAccess(mode, wp.site.ids || [])
      say(mode === 'none' ? '🔒 কেউ wallpaper design পাবে না — সবাই আগের design দেখবে' : mode === 'all' ? '✅ সব ইউজার wallpaper design পাবে' : '🎯 শুধু অনুমতি দেওয়া ইউজাররা পাবে — User ম্যানেজ পাতায় বাছুন')
    } catch (e) { fail(e, 'ব্যর্থ: ') }
  }
  const sub = { fontSize: 10.5, color: 'var(--muted)', margin: '12px 0 6px', fontWeight: 600 }
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }
  const tile = (it, removable) => {
    const on = chosen === it.url
    return (
      <div key={it.id} style={{ position: 'relative' }}>
        <button disabled={busy} onClick={() => choose(it.url)} title={it.name || it.label}
          style={{ width: '100%', padding: 0, borderRadius: 11, overflow: 'hidden', cursor: 'pointer', position: 'relative', aspectRatio: '16/10', background: 'rgba(120,140,170,.25)',
            border: on ? '2px solid #3b82f6' : '1px solid var(--border)', boxShadow: on ? '0 0 0 3px rgba(59,130,246,.25)' : 'none', opacity: busy ? .6 : 1 }}>
          <img src={it.thumb} alt={it.name || it.label} loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 6px 3px', fontSize: 10, fontWeight: 700, color: '#fff', textAlign: 'center', background: 'linear-gradient(transparent, rgba(0,0,0,.55))', textShadow: 'none' }}>{on ? '✓ ' : ''}{it.name || it.label}</span>
        </button>
        {removable && <button disabled={busy} onClick={() => del(it)} title="তালিকা থেকে সরান"
          style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 11, color: '#fff', background: 'rgba(0,0,0,.55)', textShadow: 'none' }}>✕</button>}
      </div>
    )
  }

  return (
    <div>
      <div style={{ padding: '11px 12px', marginBottom: 12, borderRadius: 12, background: 'rgba(37,99,235,.08)', border: '1px solid rgba(37,99,235,.2)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>🔐 Wallpaper design কারা পাবে?</div>
        <div style={{ fontSize: 10.5, color: 'var(--muted)', margin: '2px 0 8px' }}>
          {wp.site.mode === 'all' ? 'সবাই wallpaper design দেখবে (ছবি শুধু আপনি বদলাতে পারবেন)'
            : wp.site.mode === 'selected' ? `শুধু আপনার অনুমতি দেওয়া ${(wp.site.ids || []).length} জন পাবে — User ম্যানেজ পাতার 🖼️ বোতামে বাছুন`
            : 'কেউ পাবে না — সবাই আগের design-ই দেখবে (শুধু আপনি wallpaper দেখছেন)'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          {modes.map(([m, ic, l]) => {
            const on = wp.site.mode === m
            return <button key={m} onClick={() => setMode(m)} style={{ padding: '8px 4px', borderRadius: 10, cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
              border: on ? '1.5px solid #2563eb' : '1px solid var(--border)', background: on ? 'rgba(37,99,235,.16)' : 'transparent', color: on ? 'var(--c-blue)' : 'var(--text-3)' }}>{ic} {l}</button>
          })}
        </div>
      </div>

      <button disabled={busy} onClick={async () => { setBusy(true); try { const r = await refreshSiteWallpaper(); say(r.saved ? '✅ নতুন ছবি সবার জন্য সেট হয়েছে' : '✅ নতুন ছবি এসেছে (সেভ হয়নি — site_settings.sql run করুন)', r.saved ? undefined : 'err') } catch (e) { say(e.message, 'err') } setBusy(false) }}
        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', border: 'none', boxShadow: '0 8px 22px rgba(79,70,229,.35)', textShadow: 'none', opacity: busy ? .6 : 1 }}>
        🔄 ইন্টারনেট থেকে নতুন প্রকৃতির ছবি আনুন
      </button>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', margin: '6px 2px 0' }}>ওয়েবসাইট ইন্টারনেটের ছবির সার্ভারের সাথে যুক্ত — প্রতিবার চাপলে নতুন ছবি আসে। উপরের বারেও এই বোতাম আছে।</div>

      <div style={sub}>🗄️ আমার সংগ্রহের ছবি (আপনার R2 সার্ভারে) — {lib.length}টি</div>
      {lib.length === 0
        ? <div style={{ fontSize: 11.5, color: 'var(--muted)', padding: '12px', borderRadius: 10, border: '1px dashed var(--border)', textAlign: 'center' }}>এখনো কোনো ছবি নেই। নিচের বোতাম দিয়ে ছবি আপলোড করুন, অথবা নমুনা ছবি যোগ করুন।</div>
        : <div style={grid}>{lib.map(it => tile(it, true))}</div>}

      <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: 'none' }} />
      <button disabled={busy} onClick={() => fileRef.current?.click()}
        style={{ marginTop: 10, width: '100%', padding: '10px 14px', borderRadius: 11, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--c-blue)', background: 'rgba(37,99,235,.1)', border: '1px dashed rgba(37,99,235,.45)' }}>
        {prog || '⬆️ আমার সার্ভারে ছবি আপলোড করুন (একসাথে অনেকগুলো)'}
      </button>
      {lib.length === 0 && (
        <button disabled={busy} onClick={seed}
          style={{ marginTop: 8, width: '100%', padding: '9px 14px', borderRadius: 11, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)', background: 'transparent', border: '1px solid var(--border)' }}>
          📥 ১২টা নমুনা প্রকৃতির ছবি আমার সার্ভারে যোগ করুন
        </button>
      )}
      <div style={sub}>🔗 ইন্টারনেটের ছবির লিংক থেকে আমার সার্ভারে আনুন</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://…/photo.jpg" style={{ flex: 1, minWidth: 0, padding: '9px 14px', fontSize: 12, color: 'var(--text)', background: 'var(--surface-2)', border: '1px solid var(--border)', outline: 'none' }} />
        <button disabled={busy || !link.trim()} onClick={fromLink} style={{ padding: '0 16px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--c-blue)', background: 'rgba(37,99,235,.1)', border: '1px solid rgba(37,99,235,.35)' }}>আনুন</button>
      </div>
      <div style={sub}>🫧 হালকা abstract (সাইটের ভেতরে, ইন্টারনেট ছাড়াও চলে)</div>
      <div style={grid}>{ABSTRACT.map(it => tile(it, false))}</div>
    </div>
  )
}

export function ClaritySwitch() {
  const [st] = useStylePref()
  const [v, setV] = useState(getClarity())
  if (st !== 'crystal') return null
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-2)' }}>
        <span>🔍 স্বচ্ছতা</span><span>{v}%</span>
      </div>
      <input type="range" min="0" max="100" value={v} aria-label="স্বচ্ছতা"
        onChange={e => { const n = +e.target.value; setV(n); setClarity(n) }}
        style={{ width: '100%', accentColor: 'var(--acc-hex, #6366f1)', cursor: 'pointer' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)' }}><span>ঘন কাচ</span><span>একদম পরিষ্কার</span></div>
    </div>
  )
}
