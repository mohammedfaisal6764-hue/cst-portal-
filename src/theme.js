import { useState, useEffect } from 'react'

// 'dark' (default) | 'light' | 'system'
const KEY = 'cst_theme'
export function getThemePref() {
  try { const v = localStorage.getItem(KEY); if (v === 'light' || v === 'dark' || v === 'system') return v } catch {}
  return 'dark'
}
export function resolveTheme(pref) {
  if (pref === 'system') {
    try { return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark' } catch { return 'dark' }
  }
  return pref
}
export function applyTheme(pref) {
  const t = resolveTheme(pref)
  document.documentElement.setAttribute('data-theme', t)
  const m = document.querySelector('meta[name="theme-color"]')
  if (m) m.setAttribute('content', t === 'light' ? '#eef2f8' : '#07090f')
}
export function setThemePref(pref) {
  try { localStorage.setItem(KEY, pref) } catch {}
  applyTheme(pref)
  window.dispatchEvent(new Event('cst-theme'))
}
export function useThemePref() {
  const [pref, setPref] = useState(getThemePref())
  useEffect(() => {
    const on = () => setPref(getThemePref())
    window.addEventListener('cst-theme', on)
    let mq; try { mq = window.matchMedia('(prefers-color-scheme: light)'); mq.addEventListener('change', () => applyTheme(getThemePref())) } catch {}
    return () => window.removeEventListener('cst-theme', on)
  }, [])
  return [pref, setThemePref]
}

// ── Design style: 'wallpaper' (নতুন, default) | 'glass' (আগের glass) | 'classic' (আগের সাধারণ) ──
const SKEY = 'cst_style'
export function getStylePref() {
  try { const v = localStorage.getItem(SKEY); if (v === 'crystal' || v === 'wallpaper' || v === 'transparent' || v === 'glass' || v === 'classic') return v } catch {}
  return 'crystal'
}
// wallpaper design শুধু তখনই দেখানো হয় যখন admin অনুমতি দিয়েছেন (cst_wp_site.show); নাহলে আগের glass design
export function wallpaperAllowed() {
  try { return !!JSON.parse(localStorage.getItem('cst_wp_site') || 'null')?.show } catch { return false }
}
// wallpaper-পরিবার = wallpaper (শান্ত) ও transparent (স্বচ্ছ). দুটোই admin-এর অনুমতি লাগে
export const isWpFamily = (v) => v === 'wallpaper' || v === 'transparent' || v === 'crystal'
export function effectiveStyle() {
  const v = getStylePref()
  return (isWpFamily(v) && !wallpaperAllowed()) ? 'glass' : v
}
export function applyStyle() {
  const e = effectiveStyle(), root = document.documentElement
  // transparent = wallpaper design + data-variant="clear" (শুধু panel স্বচ্ছ হয়)
  root.setAttribute('data-style', (e === 'transparent' || e === 'crystal') ? 'wallpaper' : e)
  if (e === 'transparent') root.setAttribute('data-variant', 'clear')
  else if (e === 'crystal') root.setAttribute('data-variant', 'crystal')
  else root.removeAttribute('data-variant')
  window.dispatchEvent(new Event('cst-style'))
}
export function setStylePref(v) {
  try { localStorage.setItem(SKEY, v) } catch {}
  applyStyle()
}
export function useStylePref() {
  const [v, setV] = useState(getStylePref())
  useEffect(() => {
    const on = () => setV(getStylePref())
    window.addEventListener('cst-style', on)
    return () => window.removeEventListener('cst-style', on)
  }, [])
  return [v, setStylePref]
}

// ── রঙ (tint): কাচ, মেনু, বোতাম সব এই রঙে সাজে. প্রত্যেকের নিজের ডিভাইসে ──
export const TINTS = [
  { v: 'clear',   label: 'ক্লিয়ার', c: '#cbd5e1', c2: '#94a3b8' },
  { v: 'blue',    label: 'নীল',     c: '#3b82f6', c2: '#6366f1' },
  { v: 'violet',  label: 'বেগুনি',  c: '#8b5cf6', c2: '#d946ef' },
  { v: 'rose',    label: 'গোলাপি',  c: '#f43f5e', c2: '#fb923c' },
  { v: 'amber',   label: 'সোনালি',  c: '#f59e0b', c2: '#ef4444' },
  { v: 'emerald', label: 'সবুজ',    c: '#10b981', c2: '#06b6d4' },
  { v: 'cyan',    label: 'আকাশি',   c: '#06b6d4', c2: '#3b82f6' },
  { v: 'slate',   label: 'ধূসর',    c: '#94a3b8', c2: '#64748b' },
]
const TKEY = 'cst_tint'
export function getTintPref() {
  try { const v = localStorage.getItem(TKEY); if (TINTS.some(t => t.v === v)) return v } catch {}
  return 'clear'
}
export function applyTint() {
  const v = getTintPref(), root = document.documentElement
  if (v === 'clear') root.removeAttribute('data-tint'); else root.setAttribute('data-tint', v)
}
export function setTintPref(v) {
  try { localStorage.setItem(TKEY, v) } catch {}
  applyTint(); window.dispatchEvent(new Event('cst-tint'))
}
export function useTintPref() {
  const [v, setV] = useState(getTintPref())
  useEffect(() => {
    const on = () => setV(getTintPref())
    window.addEventListener('cst-tint', on)
    return () => window.removeEventListener('cst-tint', on)
  }, [])
  return [v, setTintPref]
}

// ── স্বচ্ছতা (Crystal): 0 = ঘন কাচ, 100 = একদম পরিষ্কার
export function getClarity() {
  try { const n = parseInt(localStorage.getItem('cst_clarity'), 10); if (n >= 0 && n <= 100) return n } catch {}
  return 100
}
export function applyClarity() { document.documentElement.style.setProperty('--cl', String(getClarity() / 100)) }
export function setClarity(n) { try { localStorage.setItem('cst_clarity', String(n)) } catch {}; applyClarity() }
