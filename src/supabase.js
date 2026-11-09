import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dzmwjmjefjzxpjoforrk.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mz7s1-249C3dpLK9AOCoVQ_GE9C1t7w'

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
  auth: { persistSession: true, autoRefreshToken: true }
})

export const ADMIN_EMAIL = 'mohammedfaisal6764@gmail.com'

// ── Role system ──────────────────────────────────────────────
// DB তে English key থাকবে, UI তে বাংলা দেখাবে
export const ROLES = ['student', 'uploader', 'group_admin', 'cr', 'teacher']
export const ROLE_LABELS = {
  student:     '👤 শিক্ষার্থী',
  uploader:    '📤 File Uploader',
  group_admin: '🛡️ Group Admin',
  cr:          '📋 CR',
  teacher:     '👨‍🏫 শিক্ষক',
}

// এই রোলগুলো ফাইল আপলোড করতে পারবে
export const UPLOADER_ROLES = ['teacher', 'cr', 'group_admin', 'uploader']

export function canUploadFiles(profile) {
  if (!profile) return false
  return UPLOADER_ROLES.includes(profile.role) || profile.email === ADMIN_EMAIL
}

// Group Admin permission check
export function isGroupAdmin(profile) {
  return profile?.role === 'group_admin'
}

// Group Admin শুধু নিজের section দেখবে/manage করবে
export function getAdminSection(profile) {
  if (!profile) return null
  if (profile.role === 'admin' || profile.email === ADMIN_EMAIL) return null // সব section
  if (profile.role === 'group_admin') return profile.section || null
  return null
}
export const TYPE_LABELS = { note: 'নোট', mid: 'Mid Term Suggestion', final: 'Final Suggestion', suggestion: 'সাজেশন', jobsheet: '📋 Job Sheet' }
export const SECTIONS = ['A', 'B']
// Section C তুলে দেওয়া হয়েছে — পুরোনো 'C' ডেটা এখন 'B' হিসেবে গণ্য হয় (ডাটাবেসেও merge_section_c_into_b.sql দিয়ে বদলানো যায়)
export const normSec = (s) => (s === 'C' ? 'B' : s)
export const normRows = (rows) => (rows || []).map(r => (r && r.section === 'C') ? { ...r, section: 'B' } : r)
export const SUBJECTS = [
  '25831 - Business Communication',
  '26841 - Digital Electronics 2',
  '28541 - Java Programming',
  '28542 - Data Structure & Algorithm',
  '28543 - Computer Peripherals & Interfacing',
  '28544 - Web Design & Development 1',
  '29041 - Environmental Studies',
]
export const HW_TYPES = [
  { value: 'read_write', label: '📖✍️ পড়া + লেখা' },
  { value: 'read',       label: '📖 শুধু পড়া'     },
  { value: 'write',      label: '✍️ লেখা'          },
  { value: 'vsq',        label: '❓ অতি সংক্ষিপ্ত প্রশ্ন' },
  { value: 'sq',         label: '📝 সংক্ষিপ্ত প্রশ্ন'     },
  { value: 'essay',      label: '📄 রচনা প্রশ্ন'          },
]

// ── Roll → Section mapping ───────────────────
// A: 263298–263371, B: 263373–263444, C: 263445–271149
// বাংলা সংখ্যা → English convert
export function toBengaliToEnglishNum(str) {
  return String(str).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d))
}

export function rollToSection(roll) {
  const n = parseInt(toBengaliToEnglishNum(roll))
  if (isNaN(n)) return null
  if (n >= 263298 && n <= 263371) return 'A'
  if (n >= 263373 && n <= 271149) return 'B'
  return null
}

export const CHAPTERS = Array.from({ length: 14 }, (_, i) => `অধ্যায় ${i + 1}`)
