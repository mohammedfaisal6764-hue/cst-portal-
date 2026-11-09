import { useState, useEffect } from 'react'
import { sb } from './supabase'
import { uploadToR2 } from './r2'
import { applyStyle } from './theme'

// আসল প্রকৃতির ছবি — প্রজেক্টের ভেতরেই (public/wallpapers/photos), তাই নিজের সাইট থেকেই দ্রুত লোড হয়
const ph = (id, label) => ({ id, label, url: `/wallpapers/photos/${id}.jpg`, thumb: `/wallpapers/photos/${id}-thumb.jpg` })
export const PHOTOS = [
  ph('foggy-forest', 'Fog Forest'), ph('pine-lake', 'Pine Lake'), ph('shore', 'Shore'),
  ph('snow-peaks', 'Snow Peaks'),   ph('iceland', 'Iceland'),     ph('golden-hills', 'Golden Hills'),
  ph('mountain-lake', 'Mountain Lake'), ph('sunset-shore', 'Sunset'), ph('dusk-dunes', 'Dusk Dunes'),
  ph('dolomites', 'Dolomites'),     ph('canyon', 'Canyon'),       ph('mist-ridge', 'Mist'),
]
const MIRROR = {}
// ইন্টারনেট না থাকলে/ছবি না এলে এগুলো কাজ করে (সাথেই বান্ডল করা)
export const ABSTRACT = [
  { id: 'ice',      label: 'Ice',      url: '/wallpapers/ice.jpg',      thumb: '/wallpapers/ice-thumb.jpg' },
  { id: 'sand',     label: 'Sand',     url: '/wallpapers/sand.jpg',     thumb: '/wallpapers/sand-thumb.jpg' },
  { id: 'sunset',   label: 'Glow',     url: '/wallpapers/sunset.jpg',   thumb: '/wallpapers/sunset-thumb.jpg' },
  { id: 'aurora',   label: 'Aurora',   url: '/wallpapers/aurora.jpg',   thumb: '/wallpapers/aurora-thumb.jpg' },
  { id: 'forest',   label: 'Moss',     url: '/wallpapers/forest.jpg',   thumb: '/wallpapers/forest-thumb.jpg' },
  { id: 'midnight', label: 'Midnight', url: '/wallpapers/midnight.jpg', thumb: '/wallpapers/midnight-thumb.jpg' },
]
export const PRESETS = [...PHOTOS, ...ABSTRACT]
const FALLBACK = ABSTRACT[0].url
const DEFAULT_URL = PHOTOS[0].url
const K_SITE = 'cst_wp_site'   // { url, mode, ids, allow }  (allow = এই ইউজারের জন্য অনুমতি আছে কি না)
const K_USER = 'cst_wp_user'   // পুরোনো — এখন ব্যবহার হয় না
try { localStorage.removeItem(K_USER) } catch {}

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)) } catch {} }

export function getSite() { const c = read(K_SITE) || {}; if (/images\.unsplash\.com|picsum\.photos/.test(c.url || '')) c.url = DEFAULT_URL; return { url: DEFAULT_URL, mode: 'none', ids: [], allow: false, ...c } }
export function getUserWp() { return '' }
export function effectiveUrl() { return getSite().url || DEFAULT_URL }

// ছবি আগে লুকিয়ে লোড করে, এলে তবেই পেছনে বসায়; না এলে bundled ছবি
let seq = 0
function setVar(url) { document.documentElement.style.setProperty('--wp-img', `url("${url.replace(/"/g, '%22')}")`) }
export function applyWallpaper() {
  const url = effectiveUrl(), me = ++seq
  if (url.startsWith('/') || url.startsWith('data:')) { setVar(url); return }
  const im = new Image()
  im.onload = () => { if (me === seq) setVar(url) }
  im.onerror = () => {
    if (me !== seq) return
    const alt = MIRROR[url]
    if (!alt) { setVar(FALLBACK); return }
    const i2 = new Image()
    i2.onload = () => { if (me === seq) setVar(alt) }
    i2.onerror = () => { if (me === seq) setVar(FALLBACK) }
    i2.src = alt
  }
  im.src = url
}
const notify = () => { applyStyle(); applyWallpaper(); window.dispatchEvent(new Event('cst-wp')) }

export const allowedFor = (mode, ids, uid) => mode === 'all' || (mode === 'selected' && !!uid && (ids || []).includes(uid))

// Supabase থেকে site setting আনা (login ছাড়াও পড়া যায়). uid দিলে এই ইউজারের অনুমতি ঠিক হয়
let lastUid = null, lastAdmin = false
// show = এই ব্যক্তি wallpaper design দেখবে কি না (admin সবসময়; ইউজার শুধু অনুমতি পেলে; login-এর আগে: কাউকে অনুমতি থাকলে)
const showFor = (mode, ids) => lastAdmin || (lastUid ? allowedFor(mode, ids, lastUid) : mode !== 'none')
export async function loadSiteSettings(uid, isAdmin) {
  if (uid !== undefined) lastUid = uid
  if (isAdmin !== undefined) lastAdmin = !!isAdmin
  try {
    const { data, error } = await sb.from('site_settings').select('key,value')
    if (error || !data) return
    const cur = getSite()
    let mode = cur.mode, ids = cur.ids
    for (const r of data) {
      if (r.key === 'wallpaper' && r.value?.url) cur.url = /images\.unsplash\.com|picsum\.photos/.test(r.value.url) ? DEFAULT_URL : r.value.url
      if (r.key === 'wallpaper_library') cur.lib = r.value?.items || []
      if (r.key === 'allow_user_wallpaper') mode = r.value?.on ? 'all' : 'none'   // পুরোনো সুইচের সাথে মিল
      if (r.key === 'wallpaper_access') { mode = r.value?.mode || 'none'; ids = r.value?.ids || [] }
    }
    cur.mode = mode; cur.ids = ids; cur.show = showFor(mode, ids); cur.allow = cur.show
    write(K_SITE, cur); notify()
  } catch {}
}
export function clearAllowOnLogout() { lastUid = null; lastAdmin = false; const c = getSite(); write(K_SITE, { ...c, show: c.mode !== 'none', allow: false }); notify() }

// শুধু admin (RLS দিয়েও সুরক্ষিত)
async function upsert(key, value) {
  const { error } = await sb.from('site_settings').upsert({ key, value })
  if (error) throw new Error(error.message)
}
export async function setSiteWallpaper(url) { await upsert('wallpaper', { url }); write(K_SITE, { ...getSite(), url }); notify() }
export async function setAccess(mode, ids) {
  await upsert('wallpaper_access', { mode, ids })
  const cur = getSite()
  write(K_SITE, { ...cur, mode, ids, show: showFor(mode, ids), allow: showFor(mode, ids) && !lastAdmin })
  notify()
}
// ইন্টারনেটের ছবি নিজের R2 সার্ভারে কপি করে রাখে (দ্রুত, নিজের CDN) — না পারলে মূল লিংকই থাকে
export async function mirrorToR2(url, onProgress) {
  const tryFetch = async (u) => { const r = await fetch(u, { mode: 'cors' }); if (!r.ok) throw new Error('http ' + r.status); return r.blob() }
  let blob
  try { blob = await tryFetch(url) } catch { const alt = MIRROR[url]; if (!alt) return url; try { blob = await tryFetch(alt) } catch { return url } }
  try { return await uploadWallpaper(new File([blob], 'src.jpg', { type: blob.type || 'image/jpeg' }), onProgress) } catch { return url }
}

// লিংক থেকে ছবি লোড হয় কি না যাচাই (timeout সহ)
export function testImage(url, ms = 15000) {
  return new Promise(res => { const im = new Image(); const t = setTimeout(() => { im.src = ''; res(false) }, ms); im.onload = () => { clearTimeout(t); res(true) }; im.onerror = () => { clearTimeout(t); res(false) }; im.src = url })
}

// ───── ইন্টারনেটের ছবির সার্ভার (live): বোতাম চাপলে নতুন প্রকৃতির ছবি ─────
// seed একই থাকলে একই ছবি আসে, তাই সেভ করা লিংক সবার কাছে একই ছবি দেখায়
const SOURCES = [
  (n) => `https://loremflickr.com/1920/1080/nature,landscape?lock=${n}`,   // প্রকৃতি/ল্যান্ডস্কেপ (Flickr)
  (n) => `https://picsum.photos/seed/cst${n}/1920/1080`,                    // বিকল্প সার্ভার
]
export async function fetchNewInternetPhoto() {
  const n = Math.floor(Math.random() * 900000) + 100
  for (const f of SOURCES) { const u = f(n); if (await testImage(u)) return u }
  return null
}
// নতুন ছবি এনে সবার জন্য সেট (admin). সেভ না হলেও এই ডিভাইসে বসে যায়
export async function refreshSiteWallpaper() {
  const u = await fetchNewInternetPhoto()
  if (!u) throw new Error('ইন্টারনেটের ছবির সার্ভারে যাওয়া যাচ্ছে না — একটু পরে আবার চেষ্টা করুন')
  try { await setSiteWallpaper(u); return { url: u, saved: true } }
  catch { write(K_SITE, { ...getSite(), url: u }); notify(); return { url: u, saved: false } }
}

// ছবি ছোট করে (max 1920px, JPEG) আপলোড — দ্রুত লোড হওয়ার জন্য
export async function uploadWallpaper(file, onProgress) {
  const bmp = await createImageBitmap(file)
  const sc = Math.min(1, 1920 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.84))
  const small = new File([blob], 'wallpaper-' + Date.now() + '.jpg', { type: 'image/jpeg' })
  const { downloadUrl } = await uploadToR2(small, onProgress)
  return downloadUrl
}

// ───── আপনার নিজের R2 সার্ভারের ছবির সংগ্রহ (library) ─────
export const getLib = () => getSite().lib || []
async function toJpegFile(src, maxW, q, name) {
  const bmp = await createImageBitmap(src)
  const sc = Math.min(1, maxW / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q))
  return new File([blob], name, { type: 'image/jpeg' })
}
// একটা ছবি → R2-তে বড় (1920px) + ছোট (preview) দুটো কপি; ফেরত দেয় library item
export async function uploadToLibrary(file, name, onProgress) {
  const t = Date.now()
  const big = await toJpegFile(file, 1920, 0.82, `wp-${t}.jpg`)
  const th  = await toJpegFile(file, 520, 0.72, `wp-th-${t}.jpg`)
  const a = await uploadToR2(big, p => onProgress && onProgress(Math.round(p * 0.85)))
  const b = await uploadToR2(th)
  return { id: 'p' + t + Math.random().toString(36).slice(2, 6), name: name || (file.name || 'photo').replace(/\.[^.]+$/, ''), url: a.downloadUrl, thumb: b.downloadUrl }
}
async function saveLib(items) { await upsert('wallpaper_library', { items }); write(K_SITE, { ...getSite(), lib: items }); notify() }
export const addToLibrary = (items) => saveLib([...getLib(), ...items])
export const removeFromLibrary = (id) => saveLib(getLib().filter(x => x.id !== id))
// প্রজেক্টের ভেতরের নমুনা ছবিগুলো এক ক্লিকে আপনার সার্ভারে তুলে দেয়
export async function importStarterPhotos(onStep) {
  const out = []
  for (let i = 0; i < PHOTOS.length; i++) {
    onStep && onStep(i + 1, PHOTOS.length)
    const r = await fetch(PHOTOS[i].url); if (!r.ok) continue
    const blob = await r.blob()
    out.push(await uploadToLibrary(new File([blob], PHOTOS[i].label + '.jpg', { type: 'image/jpeg' }), PHOTOS[i].label))
  }
  if (out.length) await addToLibrary(out)
  return out.length
}

export function useWallpaper() {
  const [, force] = useState(0)
  useEffect(() => {
    const on = () => force(n => n + 1)
    window.addEventListener('cst-wp', on)
    return () => window.removeEventListener('cst-wp', on)
  }, [])
  return { site: getSite(), user: getUserWp(), current: effectiveUrl() }
}
