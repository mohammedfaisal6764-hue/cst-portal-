import { useState, useEffect } from 'react'
import { sb, rollToSection, SECTIONS } from '../supabase'
import FileCard from './FileCard'

const FILTER_TABS = [
  { value:'all',        label:'সব',        icon:'📚', grad:'linear-gradient(135deg,var(--muted),var(--dim))', glow:'rgba(71,85,105,.35)',  border:'rgba(71,85,105,.4)'  },
  { value:'note',       label:'নোট',       icon:'📝', grad:'linear-gradient(135deg,#2563eb,#1d4ed8)', glow:'rgba(37,99,235,.4)',   border:'rgba(37,99,235,.5)'  },
  { value:'suggestion', label:'সাজেশন',    icon:'💡', grad:'linear-gradient(135deg,#7c3aed,#6d28d9)', glow:'rgba(124,58,237,.4)',  border:'rgba(124,58,237,.5)' },
  { value:'mid',        label:'Mid Term',  icon:'📘', grad:'linear-gradient(135deg,#059669,#047857)', glow:'rgba(5,150,105,.4)',   border:'rgba(5,150,105,.5)'  },
  { value:'final',      label:'Final',     icon:'🏆', grad:'linear-gradient(135deg,#d97706,#b45309)', glow:'rgba(217,119,6,.4)',   border:'rgba(217,119,6,.5)'  },
  { value:'jobsheet',   label:'Job Sheet', icon:'📋', grad:'linear-gradient(135deg,#0891b2,#0e7490)', glow:'rgba(8,145,178,.4)',   border:'rgba(8,145,178,.5)'  },
]

// Roll/GroupAdmin থেকে default section বের করো
function getDefaultSection(userRoll, isAdmin, isGroupAdmin, adminSection, userSection) {
  if (isAdmin) return 'all'
  if (isGroupAdmin && adminSection) return adminSection
  if (SECTIONS.includes(userSection)) return userSection   // প্রোফাইলের Section (নিজে বদলালে সেটাই)
  if (userRoll) {
    const s = rollToSection(userRoll)
    if (s) return s
  }
  return 'all'
}

export default function Home({ files, loadFiles, showToast, isAdmin, isGroupAdmin, adminSection, userRoll, userSemester, userSectionProp }) {
  const defaultSec = getDefaultSection(userRoll, isAdmin, isGroupAdmin, adminSection, userSectionProp)

  const [filter,        setFilter]        = useState('all')
  const [sort,          setSort]          = useState('newest')
  const [q,             setQ]             = useState('')
  const [filterSection, setFilterSection] = useState(defaultSec)
  useEffect(() => { setFilterSection(defaultSec) }, [defaultSec])   // Section বদলালে ফিল্টারও বদলাবে

  // userRoll পরে আসলেও catch করো (DB delay)
  useEffect(() => {
    if (isAdmin) return
    const s = getDefaultSection(userRoll, isAdmin, isGroupAdmin, adminSection)
    if (s !== 'all') setFilterSection(s)
  }, [userRoll, isGroupAdmin, adminSection])

  function getFiltered() {
    let f = [...files]
    // User এর semester অনুযায়ী filter — admin সব দেখবে
    if (!isAdmin && userSemester) {
      f = f.filter(x => (x.semester || '4th') === userSemester)
    }
    if (filter !== 'all') f = f.filter(x => x.type === filter)
    if (filterSection !== 'all') f = f.filter(x => x.section === filterSection)
    if (q) { const lq = q.toLowerCase(); f = f.filter(x => (x.subject||'').toLowerCase().includes(lq)) }
    if (sort === 'popular') f.sort((a, b) => (b.downloads||0) - (a.downloads||0))
    else if (sort === 'az') f.sort((a, b) => (a.subject||'').localeCompare(b.subject||'', 'bn'))
    return f
  }

  async function onDownload(file) {
    if (!file.file_url && !file.storage_path) { showToast('ফাইল URL নেই', 'err'); return }
    // R2 file → file_url সরাসরি | পুরনো Drive file → Drive URL
    const dlUrl = file.file_url
      || `https://drive.usercontent.google.com/download?id=${file.storage_path}&export=download&confirm=t`
    window.open(dlUrl, '_blank')
    await sb.from('files').update({ downloads: (file.downloads||0)+1 }).eq('id', file.id)
    try {
      const { data: { session } } = await sb.auth.getSession()
      if (session?.user) {
        await sb.from('download_logs').insert({
          user_id:       session.user.id,
          file_id:       file.id,
          file_name:     file.subject,
          downloaded_at: new Date().toISOString(),
        })
      }
    } catch {}
    await loadFiles()
    showToast('✅ ডাউনলোড শুরু হয়েছে!')
  }

  async function onDelete(file) {
    if (!confirm('এই ফাইলটি মুছে দিতে চান?')) return
    if (file.storage_path) { try { await sb.storage.from('files').remove([file.storage_path]) } catch {} }
    await sb.from('files').delete().eq('id', file.id)
    await loadFiles()
    showToast('✅ মুছে দেওয়া হয়েছে')
  }

  const shown    = getFiltered()
  const totalDL  = files.reduce((a, f) => a + (f.downloads||0), 0)
  // Counts semester দিয়ে filter করো
  const semFiles = (!isAdmin && userSemester)
    ? files.filter(f => (f.semester || '4th') === userSemester)
    : files
  const counts   = {
    all:        semFiles.length,
    note:       semFiles.filter(f=>f.type==='note').length,
    suggestion: semFiles.filter(f=>f.type==='suggestion').length,
    mid:        semFiles.filter(f=>f.type==='mid').length,
    final:      semFiles.filter(f=>f.type==='final').length,
    jobsheet:   semFiles.filter(f=>f.type==='jobsheet').length,
  }

  const s = styles
  return (
    <div>
      <style>{`
        .ft-btn { transition: all .18s ease !important; -webkit-tap-highlight-color: transparent; }
        .ft-btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
        .ft-btn:active { transform: translateY(0); }
        * { -webkit-text-size-adjust: 100%; }
        input, select, textarea, button { -webkit-appearance: none; font-family: inherit; }
        @supports (-webkit-touch-callout: none) {
          .app-sidebar { height: -webkit-fill-available !important; }
        }
      `}</style>

      {/* TOPBAR */}
      <div style={s.topbar} className="topbar-r">
        <div>
          <h1 style={s.h1}>নোট ও সাজেশন 📚</h1>
          <p style={s.sub}>BTEB Diploma CST — 4th Semester</p>
        </div>
        <div style={s.searchWrap} className="search-r">
          <input placeholder="বিষয় খুঁজুন..." value={q} onChange={e => setQ(e.target.value)} style={s.searchInput} />
          <span style={{ paddingRight:12, color:'var(--dim)', fontSize:14 }}>🔍</span>
        </div>
      </div>

      {/* ANNOUNCEMENT */}
      <div style={s.ann}>
        <div style={s.annDot} />
        <span>4th Semester-এর নতুন ফাইল আপলোড হয়েছে!</span>
      </div>

      {/* STATS */}
      <div style={s.stats} className="stats-grid">
        {[
          { n: files.length,             l: 'মোট ফাইল', icon:'📂' },
          { n: totalDL.toLocaleString(), l: 'ডাউনলোড',  icon:'⬇️' },
          { n: counts.note,              l: 'নোট',       icon:'📝' },
          { n: counts.jobsheet,          l: 'Job Sheet', icon:'📋' },
        ].map((sc, i) => (
          <div key={i} style={s.sc}>
            <span style={{ fontSize:18, lineHeight:1 }}>{sc.icon}</span>
            <div style={s.scNum}>{sc.n}</div>
            <div style={s.scLbl}>{sc.l}</div>
          </div>
        ))}
      </div>

      {/* FILTER TABS */}
      <div style={s.filterRow} className="pills-r">
        {FILTER_TABS.map(tab => {
          const active = filter === tab.value
          const cnt    = counts[tab.value]
          return (
            <button key={tab.value} className="ft-btn" onClick={() => setFilter(tab.value)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 12,
              border: `1.5px solid ${active ? tab.border : 'rgba(var(--ov),.07)'}`,
              background: active ? tab.grad : 'rgba(var(--ov),.03)',
              color: active ? '#fff' : 'var(--muted)',
              fontSize: 13, fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              boxShadow: active ? `0 4px 16px ${tab.glow}` : 'none',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ fontSize:14 }}>{tab.icon}</span>
              <span>{tab.label}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
                background: active ? 'rgba(var(--ov),.2)' : 'rgba(var(--ov),.06)',
                color: active ? '#fff' : 'var(--dim)',
                minWidth: 18, textAlign: 'center',
              }}>{cnt}</span>
            </button>
          )
        })}

        <select value={sort} onChange={e => setSort(e.target.value)} style={s.fpSort}>
          <option value="newest">সর্বশেষ</option>
          <option value="popular">জনপ্রিয়</option>
          <option value="az">নাম A-Z</option>
        </select>
      </div>

      {/* Section filter */}
      {(filter === 'note' || filter === 'suggestion' || filter === 'all') && (
        <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--dim)', fontWeight:500 }}>Section:</span>
          {[['all','সব'], ['A','A'], ['B','B']].map(([val, label]) => {
            // Group Admin শুধু নিজের section দেখবে
            if (isGroupAdmin && val !== 'all' && val !== adminSection) return null
            if (isGroupAdmin && val === 'all') return null
            const colors = { A:'var(--c-green)', B:'var(--c-blue)', C:'var(--c-violet)' }
            const active = filterSection === val
            return (
              <button key={val}
                onClick={() => !isGroupAdmin && setFilterSection(val)}
                style={{
                  padding:'5px 13px', borderRadius:20,
                  cursor: isGroupAdmin ? 'default' : 'pointer',
                  fontSize:11, fontWeight:600,
                  border: active ? `1.5px solid ${val!=='all'?`color-mix(in srgb, ${colors[val]} 50%, transparent)`:'rgba(var(--ov),.2)'}` : '1px solid var(--border)',
                  background: active ? (val!=='all'?`rgba(${val==='A'?'16,185,129':val==='B'?'37,99,235':'124,58,237'},.12)`:'rgba(var(--ov),.06)') : 'transparent',
                  color: active ? (val!=='all'?colors[val]:'var(--text)') : 'var(--muted)',
                }}>{label === val && val !== 'all' ? `Section ${label}` : label}</button>
            )
          })}
        </div>
      )}

      {/* GRID */}
      <div style={s.grid} className="files-grid-r">
        {shown.length ? shown.map(f => (
          <FileCard key={f.id} file={f} isAdmin={isAdmin} isGuest={false} onDownload={onDownload} onDelete={onDelete} />
        )) : (
          <div style={s.empty}>
            <div style={{ fontSize:32, opacity:.3, marginBottom:10 }}>📂</div>
            <p>কোনো ফাইল নেই</p>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  topbar:     { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:22, gap:14, flexWrap:'wrap' },
  h1:         { fontSize:'1.3rem', fontWeight:700, color:'var(--text-strong)' },
  sub:        { fontSize:12, color:'var(--muted)', marginTop:3 },
  searchWrap: { display:'flex', alignItems:'center', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' },
  searchInput:{ padding:'9px 13px', background:'transparent', border:'none', color:'var(--text)', fontSize:13, outline:'none', width:185 },
  ann:        { background:'rgba(37,99,235,.07)', border:'1px solid rgba(37,99,235,.14)', borderRadius:10, padding:'10px 16px', display:'flex', alignItems:'center', gap:10, marginBottom:20, fontSize:13, color:'var(--c-blue2)' },
  annDot:     { width:6, height:6, borderRadius:'50%', background:'#2563eb', flexShrink:0 },
  stats:      { display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:12, marginBottom:22 },
  sc:         { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', display:'flex', flexDirection:'column', gap:4 },
  scNum:      { fontSize:22, fontWeight:700, color:'var(--text-strong)', lineHeight:1 },
  scLbl:      { fontSize:12, color:'var(--muted)' },
  filterRow:  { display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:18 },
  fpSort:     { marginLeft:'auto', padding:'8px 11px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, color:'var(--text)', fontSize:12, outline:'none' },
  grid:       { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(265px,1fr))', gap:14 },
  empty:      { gridColumn:'1/-1', textAlign:'center', padding:48, color:'var(--dim)', fontSize:13, border:'1px dashed var(--border)', borderRadius:12 },
}
