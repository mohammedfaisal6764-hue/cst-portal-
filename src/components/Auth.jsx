import ThemeSwitch from './ThemeSwitch'
import { useState, useEffect } from 'react'
import { sb, rollToSection, toBengaliToEnglishNum } from '../supabase'
import { getIPAndDevice } from '../track'

export default function Auth({ showToast }) {
  const [tab,   setTab]   = useState('login')
  // forgot: পাসওয়ার্ড রিসেট, verify: email verification screen
  const [view,  setView]  = useState('main')   // main | forgot | forgotSent | verify
  const [fEmail, setFEmail] = useState('')
  const [verifyEmail, setVerifyEmail] = useState('')
  const [cool, setCool] = useState(0)
  useEffect(() => { if (cool <= 0) return; const t = setTimeout(() => setCool(c => c - 1), 1000); return () => clearTimeout(t) }, [cool])
  const [busy,  setBusy]  = useState(false)
  const [errors, setErrors] = useState({})

  const [lEmail, setLEmail] = useState('')
  const [lPass,  setLPass]  = useState('')

  const [rName,     setRName]     = useState('')
  const [rRoll,     setRRoll]     = useState('')
  const [rSemester, setRSemester] = useState('')
  const [rPhone, setRPhone] = useState('')
  const [rEmail, setREmail] = useState('')
  const [rPass,  setRPass]  = useState('')
  const [rPass2, setRPass2] = useState('')

  // Auto-detect section from roll
  const detectedSection = rollToSection(rRoll)

  async function doLogin() {
    const errs = {}
    if (!lEmail) errs.lEmail = 'Gmail দিন'
    if (!lPass)  errs.lPass  = 'পাসওয়ার্ড দিন'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setBusy(true)
    const { data, error } = await sb.auth.signInWithPassword({ email: lEmail, password: lPass })
    if (error) {
      setBusy(false)
      if (/not confirmed/i.test(error.message || '')) { setVerifyEmail(lEmail.trim()); setView('verify'); return }
      setErrors({ lPass: 'ভুল Email বা পাসওয়ার্ড' }); return
    }
    try {
      const { ip, device } = await getIPAndDevice()
      await sb.from('users').update({ ip_address: ip, device_info: device, last_seen: new Date().toISOString() }).eq('id', data.user.id)
    } catch {}
    setBusy(false)
    showToast('✅ লগইন সফল!')
  }

  async function doRegister() {
    const errs = {}
    if (!rName.trim())     errs.rName     = 'নাম দিন'
    if (!rRoll.trim())     errs.rRoll     = 'Roll দিন'
    if (!rSemester)        errs.rSemester = 'Semester বেছে নিন'
    else {
      // Validate roll range
      const section = rollToSection(rRoll.trim())
      if (!section) errs.rRoll = 'Roll সঠিক নয় (263298–271149)'
    }
    if (!rPhone.trim()) errs.rPhone = 'ফোন দিন'
    else if (!/^01[3-9]\d{8}$/.test(rPhone)) errs.rPhone = 'সঠিক নম্বর দিন'
    if (!rEmail.trim()) errs.rEmail = 'Gmail দিন'
    else if (!rEmail.toLowerCase().endsWith('@gmail.com')) errs.rEmail = 'শুধু @gmail.com গ্রহণযোগ্য'
    if (!rPass)         errs.rPass  = 'পাসওয়ার্ড দিন'
    else if (rPass.length < 6) errs.rPass = 'কমপক্ষে ৬ অক্ষর'
    if (!rPass2)        errs.rPass2 = 'নিশ্চিত করুন'
    else if (rPass !== rPass2) errs.rPass2 = 'মিলছে না'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setBusy(true)
    const section = rollToSection(rRoll.trim())
    const { data, error } = await sb.auth.signUp({ email: rEmail, password: rPass, options: { data: { name: rName, roll: rRoll.trim(), section, phone: rPhone, semester: rSemester }, emailRedirectTo: window.location.origin } })
    if (error) {
      setBusy(false)
      setErrors({ rEmail: error.message === 'User already registered' ? 'এই Gmail আগেই ব্যবহার হয়েছে' : error.message })
      return
    }
    if (data.user) {
      const { ip, device } = await getIPAndDevice()
      await sb.from('users').upsert({
        id: data.user.id, name: rName, roll: rRoll.trim(), section,
        phone: rPhone, email: rEmail, role: 'student', semester: rSemester,
        ip_address: ip, device_info: device,
        last_seen: new Date().toISOString(), is_banned: false,
      })
    }
    setBusy(false)
    // Session থাকলে সরাসরি লগইন, না থাকলে email confirm দরকার
    if (data.session) {
      showToast('✅ রেজিস্ট্রেশন সফল! স্বাগতম ' + rName)
    } else {
      setVerifyEmail(rEmail.trim()); setCool(30); setView('verify')
    }
  }

  async function sendReset(isResend) {
    const email = fEmail.trim()
    if (!email) { setErrors({ fEmail: 'Gmail দিন' }); return }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErrors({ fEmail: 'সঠিক Email দিন' }); return }
    setErrors({}); setBusy(true)
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/?type=recovery' })
    setBusy(false)
    if (error) { setErrors({ fEmail: /rate|seconds/i.test(error.message) ? 'কিছুক্ষণ পরে আবার চেষ্টা করুন' : error.message }); return }
    setCool(30); setView('forgotSent')
    if (isResend) showToast('📧 আবার পাঠানো হয়েছে')
  }

  async function resendVerify() {
    if (cool > 0 || !verifyEmail) return
    setBusy(true)
    const { error } = await sb.auth.resend({ type: 'signup', email: verifyEmail, options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (error) { showToast('ব্যর্থ: ' + error.message, 'err'); return }
    setCool(30); showToast('📧 Verification email আবার পাঠানো হয়েছে')
  }

  const s = styles
  const hdr = (
    <div style={s.head}>
      <div style={s.icon}>📚</div>
      <h1 style={s.h1}>CST 4th Semester পোর্টাল</h1>
      <p style={s.sub}>BTEB Diploma in Computer Science & Technology</p>
    </div>
  )
  const linkBtn = { background:'none', border:'none', color:'var(--c-blue)', cursor:'pointer', fontSize:12, fontWeight:600, padding:0 }

  if (view === 'forgot') return (
    <div style={s.page}>
      <div style={{ position:'fixed', top:12, right:12, zIndex:50 }}><ThemeSwitch compact /></div>
      <div style={s.box} className="auth-inner">
        {hdr}
        <div style={{ fontSize:15, fontWeight:700, color:'var(--text-strong)', marginBottom:6 }}>🔑 পাসওয়ার্ড ভুলে গেছেন?</div>
        <p style={{ fontSize:12, color:'var(--muted)', marginBottom:16, lineHeight:1.7 }}>আপনার Gmail দিন। আমরা পাসওয়ার্ড রিসেট করার লিংক পাঠাব।</p>
        <FG label="Gmail" error={errors.fEmail}>
          <Input type="email" value={fEmail} onChange={e => { setFEmail(e.target.value); setErrors({}) }} placeholder="example@gmail.com" autoComplete="email"
            onKeyDown={e => e.key==='Enter' && sendReset(false)} hasError={!!errors.fEmail} />
        </FG>
        <button style={{ ...s.btn, opacity: busy ? .6 : 1 }} onClick={() => sendReset(false)} disabled={busy}>{busy ? 'পাঠানো হচ্ছে...' : '📨 রিসেট লিংক পাঠান'}</button>
        <div style={{ textAlign:'center', marginTop:14 }}><button style={linkBtn} onClick={() => { setView('main'); setErrors({}) }}>← লগইনে ফিরে যান</button></div>
      </div>
    </div>
  )

  if (view === 'forgotSent') return (
    <div style={s.page}>
      <div style={{ position:'fixed', top:12, right:12, zIndex:50 }}><ThemeSwitch compact /></div>
      <div style={{ ...s.box, textAlign:'center' }} className="auth-inner">
        {hdr}
        <div style={{ fontSize:44, marginBottom:8 }}>📧</div>
        <div style={{ fontSize:16, fontWeight:700, color:'var(--text-strong)', marginBottom:8 }}>ইমেইল পাঠানো হয়েছে!</div>
        <p style={{ fontSize:12, color:'var(--muted)', lineHeight:1.8, marginBottom:16 }}>
          <strong style={{ color:'var(--text)' }}>{fEmail.trim()}</strong> এ একটি রিসেট লিংক পাঠানো হয়েছে।<br />Gmail খুলে লিংকে ক্লিক করুন। না পেলে Spam ফোল্ডার দেখুন।
        </p>
        <button style={{ ...s.btn, opacity: (busy || cool>0) ? .55 : 1 }} onClick={() => sendReset(true)} disabled={busy || cool>0}>
          {cool > 0 ? `আবার পাঠাও (${cool}s)` : '🔁 আবার পাঠাও'}
        </button>
        <div style={{ marginTop:14 }}><button style={linkBtn} onClick={() => { setView('main'); setErrors({}) }}>← লগইনে ফিরে যান</button></div>
      </div>
    </div>
  )

  if (view === 'verify') return (
    <div style={s.page}>
      <div style={{ position:'fixed', top:12, right:12, zIndex:50 }}><ThemeSwitch compact /></div>
      <div style={{ ...s.box, textAlign:'center' }} className="auth-inner">
        {hdr}
        <div style={{ fontSize:44, marginBottom:8 }}>📧</div>
        <div style={{ fontSize:16, fontWeight:700, color:'var(--text-strong)', marginBottom:8 }}>Email Verify করো</div>
        <p style={{ fontSize:12, color:'var(--muted)', lineHeight:1.8, marginBottom:16 }}>
          <strong style={{ color:'var(--text)' }}>{verifyEmail}</strong> এ একটি confirmation মেইল পাঠানো হয়েছে।<br />
          Gmail থেকে লিংকে ক্লিক করে Confirm করুন, তারপর লগইন হবে। না পেলে Spam ফোল্ডার দেখুন।
        </p>
        <button style={{ ...s.btn, opacity: (busy || cool>0) ? .55 : 1 }} onClick={resendVerify} disabled={busy || cool>0}>
          {cool > 0 ? `আবার পাঠাও (${cool}s)` : '🔁 আবার পাঠাও'}
        </button>
        <div style={{ marginTop:14 }}><button style={linkBtn} onClick={() => { setView('main'); setTab('login'); setErrors({}) }}>✅ Confirm করেছি — লগইন করুন</button></div>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={{ position:'fixed', top:12, right:12, zIndex:50 }}><ThemeSwitch compact /></div>
      <div style={s.box} className="auth-inner">
        {hdr}

        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(tab==='login'    ? s.tabOn : {}) }} onClick={() => { setTab('login');    setErrors({}) }}>🔐 লগইন</button>
          <button style={{ ...s.tab, ...(tab==='register' ? s.tabOn : {}) }} onClick={() => { setTab('register'); setErrors({}) }}>📝 রেজিস্ট্রেশন</button>
        </div>

        {tab === 'login' ? (
          <div>
            <FG label="Gmail" error={errors.lEmail}>
              <Input type="email" value={lEmail} onChange={e => { setLEmail(e.target.value); setErrors(p=>({...p,lEmail:''})) }}
                placeholder="example@gmail.com" autoComplete="email" hasError={!!errors.lEmail} />
            </FG>
            <FG label="পাসওয়ার্ড" error={errors.lPass}>
              <Input type="password" value={lPass} onChange={e => { setLPass(e.target.value); setErrors(p=>({...p,lPass:''})) }}
                placeholder="••••••••" autoComplete="current-password"
                onKeyDown={e => e.key==='Enter' && doLogin()} hasError={!!errors.lPass} />
            </FG>
            <div style={{ textAlign:'right', marginTop:-6, marginBottom:12 }}>
              <button type="button" style={{ background:'none', border:'none', color:'var(--c-blue)', cursor:'pointer', fontSize:12, fontWeight:600, padding:0 }}
                onClick={() => { setFEmail(lEmail); setErrors({}); setView('forgot') }}>পাসওয়ার্ড ভুলে গেছেন?</button>
            </div>
            <button style={{ ...s.btn, opacity: busy ? .6 : 1 }} onClick={doLogin} disabled={busy}>
              {busy ? 'অপেক্ষা করুন...' : 'লগইন করুন'}
            </button>
            <div style={s.hint}>অ্যাকাউন্ট নেই? উপরে রেজিস্ট্রেশন করুন</div>
          </div>
        ) : (
          <div>
            <div style={s.row} className="auth-name-r">
              <FG label="পুরো নাম *" error={errors.rName}>
                <Input value={rName} onChange={e => { setRName(e.target.value); setErrors(p=>({...p,rName:''})) }}
                  placeholder="আপনার নাম" hasError={!!errors.rName} />
              </FG>
              <FG label="Roll নম্বর *" error={errors.rRoll}>
                <Input value={rRoll} onChange={e => { setRRoll(toBengaliToEnglishNum(e.target.value)); setErrors(p=>({...p,rRoll:''})) }}
                  placeholder="263298–271149" hasError={!!errors.rRoll} />
              </FG>
            </div>

            {/* Semester select */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 500, marginBottom: 6 }}>
                Semester * {errors.rSemester && <span style={{ color:'var(--c-red)', marginLeft:8 }}>⚠ {errors.rSemester}</span>}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {['3rd', '4th'].map(sem => (
                  <button key={sem} type="button"
                    onClick={() => { setRSemester(sem); setErrors(p=>({...p,rSemester:''})) }}
                    style={{
                      flex: 1, padding: '11px', borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${rSemester===sem ? '#2563eb' : (errors.rSemester ? '#ef4444' : 'var(--border)')}`,
                      background: rSemester===sem ? 'rgba(37,99,235,.12)' : 'transparent',
                      color: rSemester===sem ? 'var(--c-blue)' : 'var(--muted)',
                      fontSize: 13, fontWeight: rSemester===sem ? 700 : 400,
                      transition: 'all .15s',
                    }}>
                    {rSemester===sem ? '✅ ' : ''}{sem} Semester
                  </button>
                ))}
              </div>
            </div>

            {/* Auto section badge */}
            {rRoll && (
              <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: detectedSection ? 'rgba(37,99,235,.08)' : 'rgba(220,38,38,.08)', border: `1px solid ${detectedSection ? 'rgba(37,99,235,.2)' : 'rgba(220,38,38,.2)'}`, fontSize: 12, color: detectedSection ? 'var(--c-blue)' : 'var(--c-red)', display: 'flex', alignItems: 'center', gap: 7 }}>
                {detectedSection
                  ? <><span>✅</span> আপনি <strong>Section {detectedSection}</strong> এ আছেন (Auto-detect)</>
                  : <><span>❌</span> Roll সীমার মধ্যে নেই (263298–271149)</>
                }
              </div>
            )}

            <FG label="ফোন নম্বর *" error={errors.rPhone}>
              <Input type="tel" value={rPhone} onChange={e => { setRPhone(e.target.value); setErrors(p=>({...p,rPhone:''})) }}
                placeholder="01XXXXXXXXX" hasError={!!errors.rPhone} />
            </FG>
            <FG label="Gmail * (শুধু @gmail.com)" error={errors.rEmail}>
              <Input type="email" value={rEmail} onChange={e => { setREmail(e.target.value); setErrors(p=>({...p,rEmail:''})) }}
                placeholder="example@gmail.com" autoComplete="email" hasError={!!errors.rEmail} />
            </FG>
            <div style={s.row} className="auth-pass-r">
              <FG label="পাসওয়ার্ড *" error={errors.rPass}>
                <Input type="password" value={rPass} onChange={e => { setRPass(e.target.value); setErrors(p=>({...p,rPass:''})) }}
                  placeholder="কমপক্ষে ৬ অক্ষর" autoComplete="new-password" hasError={!!errors.rPass} />
              </FG>
              <FG label="নিশ্চিত করুন *" error={errors.rPass2}>
                <Input type="password" value={rPass2} onChange={e => { setRPass2(e.target.value); setErrors(p=>({...p,rPass2:''})) }}
                  placeholder="আবার লিখুন" autoComplete="new-password"
                  onKeyDown={e => e.key==='Enter' && doRegister()} hasError={!!errors.rPass2} />
              </FG>
            </div>
            <button style={{ ...s.btn, opacity: busy ? .6 : 1 }} onClick={doRegister} disabled={busy}>
              {busy ? 'অপেক্ষা করুন...' : 'রেজিস্ট্রেশন করুন'}
            </button>
            <div style={s.hint}>ইতিমধ্যে অ্যাকাউন্ট আছে? উপরে লগইন করুন</div>
          </div>
        )}
      </div>
    </div>
  )
}

function FG({ label, error, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 5 }}>
        <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 500 }}>{label}</label>
        {error && <span style={{ fontSize: 10, color: 'var(--c-red)', fontWeight: 600 }}>⚠ {error}</span>}
      </div>
      {children}
    </div>
  )
}

function Input({ hasError, ...props }) {
  return (
    <input {...props}
      style={{
        width: '100%', padding: '11px 14px',
        background: hasError ? 'rgba(220,38,38,.05)' : 'var(--surface-2)',
        border: `1px solid ${hasError ? '#ef4444' : 'var(--border)'}`,
        borderRadius: 10, color: 'var(--text)', fontSize: 13, outline: 'none',
        transition: 'border-color .15s',
      }}
      onFocus={e  => e.target.style.borderColor = hasError ? '#ef4444' : '#2563eb'}
      onBlur={e   => e.target.style.borderColor = hasError ? '#ef4444' : 'var(--border)'}
    />
  )
}

const styles = {
  page:  { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20, position:'relative', zIndex:1 },
  box:   { width:'100%', maxWidth:460, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:20, padding:'36px 32px', boxShadow:'0 24px 80px rgba(0,0,0,.6)' },
  head:  { textAlign:'center', marginBottom:24 },
  icon:  { width:58, height:58, background:'linear-gradient(135deg,#2563eb,#0891b2)', borderRadius:16, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:26, marginBottom:12, boxShadow:'0 8px 28px rgba(37,99,235,.35)' },
  h1:    { fontSize:'1.25rem', fontWeight:700, color:'var(--text-strong)' },
  sub:   { fontSize:12, color:'var(--muted)', marginTop:4 },
  tabs:  { display:'flex', gap:5, background:'var(--surface-2)', borderRadius:10, padding:4, marginBottom:22 },
  tab:   { flex:1, padding:8, border:'none', borderRadius:8, background:'transparent', color:'var(--text-4)', fontSize:13, fontWeight:500, cursor:'pointer' },
  tabOn: { background:'#2563eb', color:'#fff', boxShadow:'0 4px 12px rgba(37,99,235,.35)' },
  btn:   { width:'100%', padding:12, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:10, color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', boxShadow:'0 4px 16px rgba(37,99,235,.3)' },
  hint:  { marginTop:12, padding:'9px 13px', background:'rgba(37,99,235,.06)', border:'1px solid rgba(37,99,235,.12)', borderRadius:8, fontSize:11, color:'var(--muted)', textAlign:'center' },
  row:   { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
}


// ─── Reset Password (recovery link) ───
export function ResetPassword({ onDone, showToast }) {
  const [p1, setP1] = useState(''), [p2, setP2] = useState('')
  const [errs, setErrs] = useState({}), [busy, setBusy] = useState(false)
  const s = styles
  async function save() {
    const e = {}
    if (!p1) e.p1 = 'নতুন পাসওয়ার্ড দিন'; else if (p1.length < 6) e.p1 = 'কমপক্ষে ৬ অক্ষর'
    if (!p2) e.p2 = 'নিশ্চিত করুন'; else if (p1 !== p2) e.p2 = 'মিলছে না'
    if (Object.keys(e).length) { setErrs(e); return }
    setErrs({}); setBusy(true)
    const { error } = await sb.auth.updateUser({ password: p1 })
    if (error) { setBusy(false); setErrs({ p1: /session/i.test(error.message) ? 'লিংকের মেয়াদ শেষ — আবার রিসেট করুন' : error.message }); return }
    await sb.auth.signOut()
    setBusy(false)
    showToast('✅ পাসওয়ার্ড বদলানো হয়েছে! এখন লগইন করুন।')
    onDone()
  }
  return (
    <div style={s.page}>
      <div style={{ position:'fixed', top:12, right:12, zIndex:50 }}><ThemeSwitch compact /></div>
      <div style={s.box} className="auth-inner">
        <div style={s.head}>
          <div style={s.icon}>🔑</div>
          <h1 style={s.h1}>নতুন পাসওয়ার্ড দিন</h1>
          <p style={s.sub}>কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন</p>
        </div>
        <FG label="নতুন পাসওয়ার্ড" error={errs.p1}>
          <Input type="password" value={p1} onChange={e => { setP1(e.target.value); setErrs({}) }} placeholder="••••••••" autoComplete="new-password" hasError={!!errs.p1} />
        </FG>
        <FG label="আবার লিখুন" error={errs.p2}>
          <Input type="password" value={p2} onChange={e => { setP2(e.target.value); setErrs({}) }} placeholder="••••••••" autoComplete="new-password"
            onKeyDown={e => e.key==='Enter' && save()} hasError={!!errs.p2} />
        </FG>
        <button style={{ ...s.btn, opacity: busy ? .6 : 1 }} onClick={save} disabled={busy}>{busy ? 'সংরক্ষণ হচ্ছে...' : '✅ পাসওয়ার্ড সংরক্ষণ করুন'}</button>
      </div>
    </div>
  )
}
