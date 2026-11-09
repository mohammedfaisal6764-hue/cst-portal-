import { useState, useEffect } from 'react'
import { sb } from '../supabase'
import ThemeSwitch from './ThemeSwitch'

// Email verify না থাকলে পোর্টাল ব্যবহার বন্ধ — লিংকে ক্লিক করলে তবেই ঢুকতে পারবে
export default function VerifyGate({ user, showToast, onVerified }) {
  const [busy, setBusy] = useState(false)
  const [cool, setCool] = useState(0)
  useEffect(() => { if (cool <= 0) return; const t = setTimeout(() => setCool(c => c - 1), 1000); return () => clearTimeout(t) }, [cool])

  async function resend() {
    if (cool > 0) return
    setBusy(true)
    const { error } = await sb.auth.resend({ type: 'signup', email: user.email, options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (error) { showToast('ব্যর্থ: ' + (/rate|seconds/i.test(error.message) ? 'কিছুক্ষণ পরে আবার চেষ্টা করুন' : error.message), 'err'); return }
    setCool(60); showToast('📧 Verification মেইল পাঠানো হয়েছে')
  }
  async function check() {
    setBusy(true)
    const { data } = await sb.auth.getUser()
    setBusy(false)
    if (data?.user?.email_confirmed_at) onVerified()
    else showToast('এখনও verify হয়নি — Gmail-এ লিংকে ক্লিক করুন', 'err')
  }
  async function logout() { await sb.auth.signOut() }

  const btn = { width:'100%', padding:'12px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }
  return (
    <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflow:'auto' }}>
      <div style={{ position:'fixed', top:12, right:12, zIndex:50 }}><ThemeSwitch compact /></div>
      <div style={{ width:'100%', maxWidth:400, textAlign:'center', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:18, padding:'28px 22px' }}>
        <div style={{ fontSize:46, marginBottom:8 }}>📧</div>
        <div style={{ fontSize:17, fontWeight:700, color:'var(--text-strong)', marginBottom:8 }}>Email Verify করুন</div>
        <p style={{ fontSize:12, color:'var(--muted)', lineHeight:1.9, marginBottom:18 }}>
          <strong style={{ color:'var(--text)' }}>{user.email}</strong> এ একটি verification লিংক পাঠান।<br />
          Gmail থেকে লিংকে ক্লিক করুন, তারপর নিচের <b>“Verify করেছি”</b> বোতাম চাপুন। না পেলে Spam ফোল্ডার দেখুন।
        </p>
        <button style={{ ...btn, opacity:(busy||cool>0)?.55:1 }} onClick={resend} disabled={busy||cool>0}>{cool>0?`আবার পাঠাও (${cool}s)`:'📧 Verification মেইল পাঠাও'}</button>
        <button style={{ ...btn, marginTop:10, background:'rgba(5,150,105,.9)' }} onClick={check} disabled={busy}>✅ Verify করেছি</button>
        <div style={{ marginTop:14 }}><button onClick={logout} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:12 }}>লগআউট</button></div>
      </div>
    </div>
  )
}
