import { useState, useEffect, useRef } from 'react'
import { sb, ADMIN_EMAIL, canUploadFiles, normRows } from './supabase'
import Auth, { ResetPassword } from './components/Auth'
import Sidebar from './components/Sidebar'
import Home from './components/Home'
import { AllFiles, Upload, Manage, Profile, CompleteProfile, GuestFileView, GuestHwView } from './components/Pages'
import Homework from './components/Homework'
import Routine from './components/Routine'
import { Users } from './components/Users'
import Toast from './components/Toast'
import { WpRefresh } from './components/ThemeSwitch'
import { syncPushSubscription, subscribePush, checkPushSubscription, showLocalNotification, fileNotice, hwNotice } from './push'
import { loadSiteSettings, applyWallpaper, clearAllowOnLogout } from './wallpaper'
import { touchUser } from './track'
import VerifyGate from './components/VerifyGate'

// নতুন ফাইল/Homework-এর notification চালু করার অনুরোধ (একবার চাপলেই চালু)
function PushPrompt({ user, section, showToast }) {
  const KEY = 'cst_push_prompt_until'
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || Notification.permission !== 'default') return
      if (Date.now() < Number(localStorage.getItem(KEY) || 0)) return
      checkPushSubscription().then(on => { if (!on) setShow(true) })
    } catch {}
  }, [user?.id])
  if (!show) return null
  async function enable() {
    setBusy(true)
    const r = await subscribePush(user.id, section)
    setBusy(false)
    showToast(r.ok ? '🔔 Notification চালু হয়েছে' : '🔔 ' + r.reason, (r.ok || r.local) ? 'ok' : 'err')
    if (r.ok || r.local) setShow(false)
  }
  function later() { try { localStorage.setItem(KEY, String(Date.now() + 7 * 864e5)) } catch {}; setShow(false) }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', padding:'10px 14px', marginBottom:14, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12 }}>
      <span style={{ fontSize:20 }}>🔔</span>
      <div style={{ flex:1, minWidth:180, fontSize:12, color:'var(--text)', fontWeight:600 }}>নতুন ফাইল ও Homework-এর notification পেতে চালু করুন</div>
      <button onClick={enable} disabled={busy} style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'#2563eb', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', opacity: busy ? .6 : 1 }}>{busy ? '...' : 'চালু করুন'}</button>
      <button onClick={later} style={{ padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', fontSize:12, cursor:'pointer' }}>পরে</button>
    </div>
  )
}

function NotifBell({ notifs, onRead }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const unread = notifs.filter(n => !n.read).length

  useEffect(() => {
    function click(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => { setOpen(!open); if (!open && unread > 0) onRead() }} style={{
        background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px',
        color: 'var(--text)', cursor: 'pointer', position: 'relative', fontSize: 16,
      }}>
        🔔
        {unread > 0 && (
          <span style={{ position:'absolute', top:-5, right:-5, background:'#ef4444', color:'#fff', fontSize:10, fontWeight:700, width:17, height:17, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position:'absolute', right:0, top:'calc(100% + 8px)', width:300, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, zIndex:1000, overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,.6)' }}>
          <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:600, color:'var(--text-4)' }}>🔔 নোটিফিকেশন</div>
          {notifs.length === 0 ? (
            <div style={{ padding:20, textAlign:'center', color:'var(--dim)', fontSize:12 }}>কোনো নোটিফিকেশন নেই</div>
          ) : (
            <div style={{ maxHeight:320, overflowY:'auto' }}>
              {notifs.slice(0, 20).map((n, i) => (
                <div key={i} style={{ padding:'10px 14px', borderBottom:'1px solid rgba(30,48,80,.5)', background: n.read ? 'transparent' : 'rgba(37,99,235,.05)' }}>
                  <div style={{ fontSize:12, color: n.read ? 'var(--muted)' : 'var(--text)', fontWeight: n.read ? 400 : 600 }}>{n.message}</div>
                  <div style={{ fontSize:10, color:'var(--dim)', marginTop:3 }}>{n.time}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const NAV_META = {
  home:     { icon:'🏠', label:'হোম',            short:'হোম' },
  all:      { icon:'📂', label:'সব ফাইল',        short:'ফাইল' },
  homework: { icon:'📚', label:'Homework',       short:'Homework' },
  routine:  { icon:'🗓️', label:'ক্লাস রুটিন',    short:'রুটিন' },
  profile:  { icon:'👤', label:'আমার Profile',   short:'Profile' },
  upload:   { icon:'⬆️', label:'ফাইল আপলোড',     short:'আপলোড' },
  manage:   { icon:'⚙️', label:'ফাইল ম্যানেজ',   short:'ম্যানেজ' },
  users:    { icon:'👥', label:'User ম্যানেজ',   short:'Users' },
}

const GO_OK = ['home', 'all', 'homework', 'routine', 'profile']
function goFromUrl(u) {
  try {
    const x = new URL(u, location.origin)
    if (x.searchParams.has('sheet')) return 'homework'
    if (x.searchParams.has('hwd') || x.searchParams.has('hwb') || x.searchParams.has('hw')) return 'homework'
    const g = x.searchParams.get('go') || x.hash.replace('#', '')
    return GO_OK.includes(g) ? g : null
  } catch { return null }
}

export default function App() {
  const [user, setUser]               = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [needVerify, setNeedVerify] = useState(false)
  const [loading, setLoading]         = useState(true)
  const [section, setSection]         = useState(() => goFromUrl(location.href) || 'home')

  // Notification/লিঙ্ক থেকে সরাসরি নির্দিষ্ট পেজে যাও (ট্যাব আগে খোলা থাকলেও)
  useEffect(() => {
    try { if (new URL(location.href).searchParams.has('go')) history.replaceState(null, '', location.pathname) } catch {}
    const onMsg = (e) => {
      if (e.data?.type !== 'cst-go') return
      const g = goFromUrl(e.data.url)
      if (g) { setSection(g); window.scrollTo({ top: 0 }) }
    }
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg)
  }, [])
  const [files, setFiles]             = useState([])
  const [pendingFiles, setPendingFiles] = useState([])
  const [toast, setToast]             = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifs, setNotifs]           = useState([])
  const notifKey = 'cst_notifs_read_v1'
  // পাসওয়ার্ড রিসেট লিংক (?type=recovery বা #type=recovery)
  const [recovery, setRecovery] = useState(() => {
    try { return /(^|[?&#])type=recovery/.test(window.location.search + '&' + window.location.hash.replace(/^#/, '')) } catch { return false }
  })

  const isAdmin      = user?.email === ADMIN_EMAIL || userProfile?.role === 'admin'
  const isGroupAdmin = userProfile?.role === 'group_admin'
  const canUpload    = isAdmin || canUploadFiles(userProfile)
  // Group Admin শুধু নিজের section এর data দেখবে/manage করবে
  const adminSection = isAdmin ? null : isGroupAdmin ? (userProfile?.section || null) : null

  const toastTimer = useRef(null)
  function showToast(msg, type = 'ok') {
    setToast({ msg, type })
    clearTimeout(toastTimer.current)   // আগের toast-এর timer নতুন toast মুছে না ফেলে
    toastTimer.current = setTimeout(() => setToast(null), 3600)
  }

  const knownFileIds = useRef(null)
  async function loadFiles() {
    const { data: rawFiles, error } = await sb.from('files').select('*').order('created_at', { ascending: false })
    const data = rawFiles ? normRows(rawFiles) : rawFiles
    if (!error && data) {
      // নতুন approved ফাইল এলে (সাইট খোলা কিন্তু অন্য ট্যাবে/ব্যাকগ্রাউন্ডে থাকলে) Chrome notification
      const approvedNow = data.filter(f => f.approved !== false)
      if (knownFileIds.current) {
        const { section: mine, isAdmin: adm } = hwCtx.current
        approvedNow.filter(f => !knownFileIds.current.has(f.id) && (adm || !f.section || !mine || f.section === mine)).slice(0, 3)
          .forEach(f => showLocalNotification(fileNotice(f)))
      }
      knownFileIds.current = new Set(approvedNow.map(f => f.id))
      // Approval: pending ফাইল কেউ দেখবে না (admin শুধু Manage পেজে দেখবে)
      setFiles(data.filter(f => f.approved !== false))
      setPendingFiles(data.filter(f => f.approved === false))
    }
  }

  // Profile লোড + ban/delete চেক
  async function loadUserProfile(uid) {
    const { data, error } = await sb.from('users').select('*').eq('id', uid).single()

    // প্রোফাইল নেই = account মুছা হয়েছে
    if (error || !data) {
      await sb.auth.signOut()
      showToast('⛔ আপনার অ্যাকাউন্ট মুছে দেওয়া হয়েছে।', 'err')
      return
    }

    // Banned হলে logout করো
    if (data.is_banned) {
      await sb.auth.signOut()
      showToast('🚫 আপনার অ্যাকাউন্ট বন্ধ করা হয়েছে। Admin-এর সাথে যোগাযোগ করুন।', 'err')
      return
    }

    if (data.section === 'C') data.section = 'B'   // Section C → B
    setUserProfile(data)
    // email-verify link দিয়ে ঢুকলেও ip/device/last seen/verified সেভ হবে
    const { data: au } = await sb.auth.getUser()
    setNeedVerify(!!au?.user && !au.user.email_confirmed_at)
    touchUser(au?.user, data)
    syncPushSubscription(uid, data.section)
  }

  // Profile incomplete কিনা check — roll বা phone নেই
  const profileIncomplete = user && userProfile && !isAdmin && (!userProfile.roll || !userProfile.phone)

  function buildNotifs(fileList) {
    const readSet = new Set(JSON.parse(localStorage.getItem(notifKey) || '[]'))
    const recent = fileList.filter(f => {
      const age = Date.now() - new Date(f.created_at).getTime()
      return age < 7 * 24 * 60 * 60 * 1000
    })
    return recent.map(f => ({
      id: f.id,
      message: `📂 নতুন ফাইল: ${f.subject || f.type || 'ফাইল'} — ${f.type || ''}`,
      time: new Date(f.created_at).toLocaleDateString('bn-BD'),
      read: readSet.has(f.id),
    }))
  }

  function markAllRead() {
    const ids = notifs.map(n => n.id)
    localStorage.setItem(notifKey, JSON.stringify(ids))
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadUserProfile(session.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadUserProfile(session.user.id)
      } else {
        setUserProfile(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // সাইট খোলা থাকলে/ফিরে এলে Last Seen হালনাগাদ (৫ মিনিটে একবার)
  useEffect(() => {
    if (!user?.id) return
    const on = () => { if (document.visibilityState === 'visible') touchUser(user, userProfile) }
    document.addEventListener('visibilitychange', on)
    const t = setInterval(on, 5 * 60 * 1000)
    return () => { document.removeEventListener('visibilitychange', on); clearInterval(t) }
  }, [user?.id, userProfile?.id])

  // Wallpaper ও admin-এর সেটিং লোড (login ছাড়াও)
  useEffect(() => { applyWallpaper(); loadSiteSettings() }, [])
  useEffect(() => { if (user?.id) loadSiteSettings(user.id, isAdmin); else clearAllowOnLogout() }, [user?.id, isAdmin])

  useEffect(() => {
    if (!user) return
    loadFiles()
    const channel = sb
      .channel('files-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, () => loadFiles())
      .subscribe()
    return () => sb.removeChannel(channel)
  }, [user])

  // নতুন Homework এলে Chrome notification (সাইট খোলা থাকলে)
  const hwCtx = useRef({})
  hwCtx.current = { section: userProfile?.section, isAdmin }
  useEffect(() => {
    if (!user) return
    const ch = sb.channel('hw-notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'homeworks' }, (payload) => {
        const h = payload.new || {}
        const { section, isAdmin: adm } = hwCtx.current
        if (adm || !h.section || !section || h.section === section) showLocalNotification(hwNotice(h))
      })
      .subscribe()
    return () => sb.removeChannel(ch)
  }, [user?.id])

  useEffect(() => {
    if (files.length > 0) setNotifs(buildNotifs(files))
  }, [files])

  if (loading) return (
    <div style={{ position:'fixed', inset:0, background:'rgba(var(--bg-rgb),.95)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, zIndex:9999 }}>
      <div style={{ width:42, height:42, border:'3px solid rgba(37,99,235,.2)', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <p style={{ fontSize:13, color:'var(--muted)' }}>লোড হচ্ছে...</p>
    </div>
  )

  if (recovery) return (
    <>
      <ResetPassword showToast={showToast} onDone={() => {
        try { window.history.replaceState({}, '', window.location.pathname) } catch {}
        setRecovery(false); setUser(null); setUserProfile(null)
      }} />
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  )

  // Share links
  const urlParams    = new URLSearchParams(window.location.search)
  const sharedFileId = urlParams.get('file')
  const sharedHwId   = urlParams.get('hw')
  const sharedHwBatch = urlParams.get('hwb')
  const sharedHwDay   = urlParams.get('hwd')
  const sharedFile   = sharedFileId ? files.find(f => f.id === sharedFileId) : null

  if (!user) {
    if (sharedFile) return <GuestFileView file={sharedFile} showToast={showToast} />
    if (sharedHwDay) return <GuestHwView day={sharedHwDay} sec={urlParams.get('sec')} />
    if (sharedHwBatch) return <GuestHwView batchId={sharedHwBatch} />
    if (sharedHwId) return <GuestHwView hwId={sharedHwId} />
    return <Auth showToast={showToast} />
  }

  // Email verify না থাকলে (admin ছাড়া) আগে verify করতে হবে
  if (needVerify && !isAdmin) return (
    <>
      <VerifyGate user={user} showToast={showToast} onVerified={() => loadUserProfile(user.id)} />
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  )

  // Profile incomplete হলে forced complete screen
  if (profileIncomplete) return <CompleteProfile user={user} showToast={showToast} onDone={() => loadUserProfile(user.id)} />
  // লগইন করা ইউজার শেয়ার লিঙ্ক খুললে অতিথির মতোই সরল বক্স-ভিউ দেখাবে
  if (sharedHwDay || sharedHwBatch || sharedHwId) return (
    <>
      <GuestHwView loggedIn day={sharedHwDay} sec={urlParams.get('sec')} batchId={sharedHwBatch} hwId={sharedHwId} />
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  )

  const props = { files, loadFiles, showToast, isAdmin, isGroupAdmin, adminSection, canUpload }

  return (
    <div className="app-shell" style={{ display:'flex', minHeight:'100vh', position:'relative', zIndex:1 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .mob-bar { display: none; }
        * { box-sizing: border-box; }
        .hw-expand { cursor: pointer; user-select: none; }
        @media(min-width:1400px) {
          .main-inner { padding:32px 40px!important; }
          .files-grid-r { grid-template-columns:repeat(auto-fill,minmax(280px,1fr))!important; }
        }
        @media(min-width:900px) {
          .app-sidebar { position:sticky!important; transform:none!important; }
          .stats-grid { grid-template-columns:repeat(4,minmax(0,1fr))!important; }
          .search-r input { min-width:220px!important; }
        }
        @media(max-width:900px) {
          .app-sidebar { position:fixed!important; transform:translateX(-232px)!important; z-index:200!important; transition:transform .3s!important; }
          .app-sidebar.sb-open { transform:translateX(0)!important; }
          .app-main { margin-left:0!important; }
          .main-inner { padding:14px!important; }
          .mob-bar { display:flex!important; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--surface-2); border-bottom:1px solid var(--border); position:sticky; top:0; z-index:100; }
          .stats-grid { grid-template-columns:repeat(2,minmax(0,1fr))!important; }
          .up-grid-r { grid-template-columns:1fr!important; }
          .topbar-r { flex-direction:column!important; align-items:flex-start!important; gap:10px!important; }
          .search-r { width:100%!important; }
          .search-r input { width:100%!important; min-width:0!important; }
          .detail-panel { display:none; }
        }
        @media(max-width:600px) {
          .main-inner { padding:10px!important; }
          .files-grid-r { grid-template-columns:1fr!important; }
          .stats-grid { gap:8px!important; }
          .pills-r { overflow-x:auto; flex-wrap:nowrap!important; padding-bottom:4px; -webkit-overflow-scrolling:touch; }
          .pills-r::-webkit-scrollbar { display:none; }
          .auth-inner { padding:22px 14px!important; }
          .auth-name-r { grid-template-columns:1fr!important; }
          .auth-pass-r { grid-template-columns:1fr!important; }
          .tbl-r { font-size:11px!important; }
          .tbl-r th,.tbl-r td { padding:7px 7px!important; }
          .users-layout { flex-direction:column!important; }
        }
        @media(max-width:900px) { .notif-desktop { display:none!important; } }
      `}</style>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:199 }} />
      )}

      <Sidebar
        user={user} isAdmin={isAdmin} canUpload={canUpload}
        userProfile={userProfile}
        section={section} setSection={setSection} files={files}
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        showToast={showToast}
      />

      <main className="app-main" style={{ flex:1, minWidth:0 }}>
        <div className="mob-bar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, background:'linear-gradient(135deg,#2563eb,#0891b2)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>📚</div>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--text-strong)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'44vw' }}>{section === 'home' ? 'CST 4th Semester' : (NAV_META[section] || NAV_META.home).label}</span>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <WpRefresh isAdmin={isAdmin} showToast={showToast} />
            <NotifBell notifs={notifs} onRead={markAllRead} />
            <button onClick={() => setSidebarOpen(true)} style={{ background:'none', border:'1px solid var(--border)', color:'var(--text)', padding:'6px 12px', borderRadius:7, fontSize:14, cursor:'pointer' }}>☰</button>
          </div>
        </div>

        <div style={{ padding:'12px 28px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, background:'var(--surface-2)' }} className="notif-desktop">
          <div style={{ display:'flex', alignItems:'center', gap:11, minWidth:0 }}>
            <span className="tb-ico">{(NAV_META[section] || NAV_META.home).icon}</span>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--text-strong)', lineHeight:1.25 }}>{(NAV_META[section] || NAV_META.home).label}</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>স্বাগতম, {userProfile?.name || user?.email?.split('@')[0] || 'User'} 👋</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <WpRefresh isAdmin={isAdmin} showToast={showToast} />
            <NotifBell notifs={notifs} onRead={markAllRead} />
          </div>
        </div>

        <div className="main-inner" style={{ padding:'26px 28px' }}>
          <PushPrompt user={user} section={userProfile?.section || null} showToast={showToast} />
          {section === 'home'     && <Home key={userProfile?.id || 'guest'} {...props} userRoll={userProfile?.roll} userSectionProp={userProfile?.section} isGroupAdmin={isGroupAdmin} adminSection={adminSection} userSemester={userProfile?.semester} />}
          {section === 'all'      && <AllFiles {...props} userSemester={userProfile?.semester} />}
          {section === 'upload'   && canUpload && <Upload  {...props} />}
          {section === 'manage'   && canUpload && <Manage  {...props} pendingFiles={pendingFiles} />}
          {section === 'users'    && isAdmin   && <Users   showToast={showToast} />}
          {section === 'routine'  && <Routine userSection={userProfile?.section} />}
          {section === 'profile'  && <Profile  user={user} isAdmin={isAdmin} showToast={showToast} userProfile={userProfile} onProfileUpdate={() => loadUserProfile(user.id)} />}
          {section === 'homework' && <Homework key={userProfile?.id || 'guest'} isAdmin={isAdmin} isGroupAdmin={isGroupAdmin} isCR={userProfile?.role === 'cr'} userSectionProp={userProfile?.section} adminSection={adminSection} showToast={showToast} userRoll={userProfile?.roll} userId={user?.id} />}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="মূল মেনু">
        {[['home','🏠'],['all','📂'],['homework','📚'],['profile','👤']].map(([id, ic]) => (
          <button key={id} className={section === id ? 'on' : ''} onClick={() => { setSection(id); setSidebarOpen(false); window.scrollTo({ top:0 }) }}>
            <span className="bn-ico">{ic}</span><span className="bn-lbl">{NAV_META[id].short}</span>
          </button>
        ))}
        <button className={sidebarOpen ? 'on' : ''} onClick={() => setSidebarOpen(v => !v)}>
          <span className="bn-ico">☰</span><span className="bn-lbl">মেনু</span>
        </button>
      </nav>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
