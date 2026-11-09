import React, { useState, useEffect } from 'react'
import { sb, ROLE_LABELS } from '../supabase'
import ThemeSwitch from './ThemeSwitch'

async function getGravatarUrl(email) {
  const clean  = (email || '').trim().toLowerCase()
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clean))
  const hash   = Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2,'0')).join('')
  return `https://www.gravatar.com/avatar/${hash}?s=200&d=404`
}

function Avatar({ email, name, size = 38 }) {
  const [src, setSrc] = useState(null)
  const initials = (name || email || '?').slice(0, 2).toUpperCase()
  const hue      = [...(email || '')].reduce((h, c) => h + c.charCodeAt(0), 0) % 360

  useEffect(() => {
    if (!email) return
    let cancelled = false
    getGravatarUrl(email).then(url => {
      if (cancelled) return
      const img = new Image()
      img.onload  = () => { if (!cancelled) setSrc(url) }
      img.onerror = () => { if (!cancelled) setSrc(null) }
      img.src = url
    })
    return () => { cancelled = true }
  }, [email])

  if (src) return (
    <img src={src} alt={name || email} style={{ width:size, height:size, borderRadius:size*0.28, objectFit:'cover', flexShrink:0, border:'2px solid rgba(37,99,235,.4)' }} />
  )
  return (
    <div style={{ width:size, height:size, borderRadius:size*0.28, flexShrink:0, background:`hsl(${hue},60%,38%)`, border:'2px solid rgba(var(--ov),.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.38, fontWeight:700, color:'#fff', userSelect:'none', letterSpacing:'-1px' }}>
      {initials}
    </div>
  )
}

// Role badge রঙ
function roleBadgeStyle(role) {
  const map = {
    admin:       { background:'rgba(37,99,235,.18)',  color:'var(--c-blue)' },
    teacher:     { background:'rgba(124,58,237,.18)', color:'var(--c-violet)' },
    cr:          { background:'rgba(8,145,178,.18)',  color:'var(--c-cyan)' },
    uploader:    { background:'rgba(6,182,212,.18)',  color:'var(--c-cyan)' },
    group_admin: { background:'rgba(234,179,8,.18)',  color:'var(--c-amber)' },
    student:     { background:'rgba(5,150,105,.14)',  color:'var(--c-green)' },
  }
  return map[role] || map.student
}

export default function Sidebar({ user, isAdmin, canUpload, userProfile, section, setSection, files, sidebarOpen, setSidebarOpen, showToast }) {
  const role        = userProfile?.role || 'student'
  const displayName = userProfile?.name  || user?.email?.split('@')[0] || 'User'
  const displayEmail= userProfile?.email || user?.email || ''

  async function logout() {
    await sb.auth.signOut()
    showToast('লগআউট হয়েছে')
  }

  const navItems = [
    { id: 'home',     icon: '🏠', label: 'হোম' },
    { id: 'all',      icon: '📂', label: 'সব ফাইল', badge: files.length },
    { id: 'homework', icon: '📚', label: 'Homework' },
    { id: 'routine',  icon: '🗓️', label: 'ক্লাস রুটিন' },
    { id: 'profile',  icon: '👤', label: 'আমার Profile' },
    ...(canUpload ? [
      { id: 'upload', icon: '⬆️', label: 'ফাইল আপলোড', special: true },
      { id: 'manage', icon: '⚙️', label: 'ফাইল ম্যানেজ', special: true },
    ] : []),
    ...(isAdmin ? [
      { id: 'users',  icon: '👥', label: 'User ম্যানেজ', special: true },
    ] : []),
  ]

  const s = styles
  return (
    <aside style={s.sidebar} className={`app-sidebar${sidebarOpen ? ' sb-open' : ''}`}>
      {/* Brand */}
      <div style={s.brand}>
        <div style={s.brandIcon}>📚</div>
        <div>
          <h2 style={{ fontSize:13, fontWeight:700, color:'var(--text-strong)', lineHeight:1.3 }}>CST পোর্টাল</h2>
          <span style={{ fontSize:11, color:'var(--dim)' }}>4th Semester</span>
        </div>
      </div>

      {/* User card */}
      <div style={s.userCard}>
        <Avatar email={displayEmail} name={displayName} size={40} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {displayName}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2 }}>
            <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5, ...roleBadgeStyle(isAdmin ? 'admin' : role) }}>
              {isAdmin ? '🔐 অ্যাডমিন' : (ROLE_LABELS[role] || ROLE_LABELS.student)}
            </span>
          </div>
          <div style={{ fontSize:10, color:'var(--dim)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {displayEmail}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding:'4px 8px', flex:1, overflowY:'auto' }}>
        <div style={s.navSec}>মেনু</div>
        {navItems.map((item, idx) => (
          <React.Fragment key={item.id}>
            {item.special && !navItems[idx - 1]?.special && <div style={{ ...s.navSec, paddingTop: 16 }}>ম্যানেজমেন্ট</div>}
            <button
              className={'nav-item' + (section === item.id ? ' on' : '') + (item.special ? ' special' : '')}
              onClick={() => { setSection(item.id); setSidebarOpen(false) }}
              style={{ ...s.navBtn, ...(section===item.id ? s.navBtnOn : {}), ...(item.special ? { borderLeft:'2px solid rgba(37,99,235,.25)' } : {}) }}>
              <span className="nav-ico">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.badge != null && (
                <span className="nav-badge" style={{ marginLeft:'auto', minWidth:20, padding:'1px 7px', background:'#2563eb', borderRadius:9, fontSize:11, fontWeight:700, color:'#fff', textAlign:'center' }}>
                  {item.badge}
                </span>
              )}
            </button>
          </React.Fragment>
        ))}
      </nav>

      <div style={{ padding:12, borderTop:'1px solid var(--border)' }}>
        <div style={{ fontSize:10, color:'var(--muted)', marginBottom:6, letterSpacing:.5 }}>🎨 থিম</div>
        <div style={{ marginBottom:10 }}><ThemeSwitch /></div>
        <button onClick={logout} style={s.logoutBtn}>🚪 লগআউট</button>
        <div style={{ textAlign:'center', fontSize:10, color:'var(--dim)', marginTop:8, opacity:.7 }}>সংস্করণ v74</div>
      </div>
    </aside>
  )
}

const styles = {
  sidebar:   { width:232, flexShrink:0, background:'var(--surface-2)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', transition:'transform .3s', zIndex:200 },
  brand:     { padding:'18px 16px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 },
  brandIcon: { width:36, height:36, background:'linear-gradient(135deg,#2563eb,#0891b2)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 },
  userCard:  { padding:'12px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, background:'rgba(37,99,235,.04)' },
  navSec:    { fontSize:10, color:'var(--faint)', textTransform:'uppercase', letterSpacing:1, padding:'12px 9px 4px', fontWeight:500 },
  navBtn:    { display:'flex', alignItems:'center', gap:9, width:'100%', padding:'9px 11px', border:'none', borderLeft:'2px solid transparent', borderRadius:9, background:'transparent', color:'var(--muted)', fontSize:13, textAlign:'left', cursor:'pointer', marginBottom:1, transition:'all .18s' },
  navBtnOn:  { background:'rgba(37,99,235,.14)', color:'var(--c-blue)', fontWeight:600 },
  logoutBtn: { width:'100%', padding:8, background:'rgba(220,38,38,.08)', border:'1px solid rgba(220,38,38,.16)', borderRadius:8, color:'var(--c-red)', fontSize:12, cursor:'pointer' },
}
