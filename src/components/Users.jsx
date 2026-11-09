import React, { useState, useEffect } from 'react'
import { sb, ROLE_LABELS, normRows } from '../supabase'
import { useWallpaper, setAccess } from '../wallpaper'

function Avatar({ email, name, size = 44 }) {
  const initials = (name || email || '?').slice(0, 2).toUpperCase()
  const hue      = [...(email || '')].reduce((h, c) => h + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
      background: `hsl(${hue},55%,35%)`,
      border: '2px solid rgba(var(--ov),.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: '#fff', userSelect: 'none',
    }}>{initials}</div>
  )
}

// ── Job Sheet Date Modal ──────────────────────────────────────
function JobSheetDateModal({ user: u, files, onClose }) {
  const [section, setSection] = useState('')
  const jobFiles = files.filter(f => f.type === 'jobsheet' && (!section || f.section === section))
  function parseJob(desc) {
    const parts = {}
    ;(desc || '').split(' | ').forEach(p => {
      const [k, ...v] = p.split(': ')
      if (k && v.length) parts[k.trim()] = v.join(': ').trim()
    })
    return parts
  }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ width:'100%', maxWidth:500, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'18px 18px 0 0', padding:'20px 20px 36px', maxHeight:'80vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:36, height:4, background:'var(--border)', borderRadius:2, margin:'0 auto 16px' }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-strong)' }}>📋 Job Sheet Date</h3>
            <p style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{u.name} এর জন্য</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        {!section ? (
          <div>
            <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:14, textAlign:'center' }}>কোন Section এর Job Sheet দেখতে চান?</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {['B'].map(s => (
                <button key={s} onClick={() => setSection(s)} style={{ padding:'20px 16px', borderRadius:12, cursor:'pointer', border:'1.5px solid rgba(8,145,178,.3)', background:'rgba(8,145,178,.06)', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:28 }}>🏫</span>
                  <span style={{ fontSize:16, fontWeight:700, color:'var(--c-cyan)' }}>Section {s}</span>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>{files.filter(f=>f.type==='jobsheet'&&f.section===s).length} টি</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <button onClick={() => setSection('')} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:7, padding:'5px 12px', fontSize:12, cursor:'pointer', marginBottom:14 }}>← Section {section}</button>
            {jobFiles.length === 0
              ? <div style={{ textAlign:'center', padding:30, color:'var(--dim)', fontSize:13 }}>Section {section} এ কোনো Job Sheet নেই</div>
              : jobFiles.map(f => {
                  const job = parseJob(f.description)
                  return (
                    <div key={f.id} style={{ background:'rgba(8,145,178,.05)', border:'1px solid rgba(8,145,178,.15)', borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:8 }}>{f.subject}</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
                        {[['Job No',job['Job No']],['Job Name',job['Job Name']]].map(([label,val]) => val&&val!=='—'?(
                          <div key={label} style={{ background:'rgba(var(--ob),.2)', borderRadius:6, padding:'5px 8px' }}>
                            <div style={{ fontSize:9, color:'#0891b2', fontWeight:700 }}>{label}</div>
                            <div style={{ fontSize:11, color:'var(--text)', marginTop:1 }}>{val}</div>
                          </div>
                        ):null)}
                      </div>
                      <div style={{ background:section==='B'?'rgba(37,99,235,.08)':'rgba(124,58,237,.08)', border:`1px solid ${section==='B'?'rgba(37,99,235,.15)':'rgba(124,58,237,.15)'}`, borderRadius:8, padding:'8px 10px' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:section==='B'?'var(--c-blue)':'var(--c-violet)', marginBottom:6 }}>🏫 Section {section}</div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
                          {[['Exp Date',(job[`Exp-${section}`] || (section === 'B' ? job['Exp-C'] : ''))],['Submit Date',(job[`Submit-${section}`] || (section === 'B' ? job['Submit-C'] : ''))]].map(([label,val]) => (
                            <div key={label} style={{ background:'rgba(var(--ob),.2)', borderRadius:5, padding:'5px 7px' }}>
                              <div style={{ fontSize:9, color:'var(--muted)', fontWeight:600 }}>{label}</div>
                              <div style={{ fontSize:12, color:section==='B'?'var(--c-blue2)':'var(--c-violet2)', fontWeight:600, marginTop:1 }}>{val||'—'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })
            }
          </div>
        )}
      </div>
    </div>
  )
}

// ── Edit User Modal ───────────────────────────────────────────
function EditModal({ user: u, onClose, onSave }) {
  const [name,  setName]  = useState(u.name  || '')
  const [roll,  setRoll]  = useState(u.roll  || '')
  const [phone, setPhone] = useState(u.phone || '')
  const [role,  setRole]  = useState(u.role  || 'student')
  const [sec,   setSec]   = useState(u.section || '')
  const [busy,  setBusy]  = useState(false)

  async function save() {
    setBusy(true)
    await onSave(u, { name, roll, phone, role, section: sec || null })
    setBusy(false)
    onClose()
  }

  const inp = { padding:'10px 13px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:9, color:'var(--text)', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' }

  const roleColors = {
    student:     { bg:'rgba(5,150,105,.12)',  color:'var(--c-green)', border:'rgba(5,150,105,.25)' },
    uploader:    { bg:'rgba(6,182,212,.12)',  color:'var(--c-cyan)', border:'rgba(6,182,212,.25)' },
    group_admin: { bg:'rgba(234,179,8,.12)',  color:'var(--c-amber)', border:'rgba(234,179,8,.25)' },
    cr:          { bg:'rgba(8,145,178,.12)',  color:'var(--c-cyan)', border:'rgba(8,145,178,.25)' },
    teacher:     { bg:'rgba(124,58,237,.12)', color:'var(--c-violet)', border:'rgba(124,58,237,.25)' },
    admin:       { bg:'rgba(37,99,235,.12)',  color:'var(--c-blue)', border:'rgba(37,99,235,.25)' },
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ width:'100%', maxWidth:480, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'18px 18px 0 0', padding:'20px 20px 36px', maxHeight:'90vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:36, height:4, background:'var(--border)', borderRadius:2, margin:'0 auto 16px' }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-strong)' }}>✏️ User Edit করুন</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[['পুরো নাম', name, setName, 'text'], ['Roll নম্বর', roll, setRoll, 'text'], ['ফোন নম্বর', phone, setPhone, 'tel']].map(([label, val, setter, type]) => (
            <div key={label}>
              <label style={{ fontSize:11, color:'var(--muted)', fontWeight:500, display:'block', marginBottom:5 }}>{label}</label>
              <input type={type} value={val} onChange={e=>setter(e.target.value)} style={inp} />
            </div>
          ))}
          {/* Section পরিবর্তন (admin) */}
          <div>
            <label style={{ fontSize:11, color:'var(--muted)', fontWeight:500, display:'block', marginBottom:7 }}>🏫 Section পরিবর্তন করুন</label>
            <div style={{ display:'flex', gap:7 }}>
              {['A','B'].map(x => (
                <button key={x} type="button" onClick={() => setSec(x)} style={{ flex:1, padding:'9px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700,
                  border:`1.5px solid ${sec===x ? '#2563eb' : 'var(--border)'}`, background: sec===x ? 'rgba(37,99,235,.15)' : 'transparent', color: sec===x ? 'var(--c-blue)' : 'var(--muted)' }}>{sec===x ? '✅ ' : ''}Section {x}</button>
              ))}
            </div>
          </div>
          {/* Role selector */}
          <div>
            <label style={{ fontSize:11, color:'var(--muted)', fontWeight:500, display:'block', marginBottom:7 }}>🎭 Role পরিবর্তন করুন</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
              {[
                { value:'student',     label:'👤 শিক্ষার্থী',       note:'ফাইল দেখতে পারবে' },
                { value:'uploader',    label:'📤 File Uploader',   note:'ফাইল আপলোড করতে পারবে' },
                { value:'group_admin', label:'🛡️ Group Admin',     note:'নিজের Section manage করবে' },
                { value:'cr',          label:'📋 CR',               note:'ফাইল আপলোড করতে পারবে' },
                { value:'teacher',     label:'👨‍🏫 শিক্ষক',          note:'ফাইল আপলোড করতে পারবে' },
              ].map(r => (
                <button key={r.value} onClick={() => setRole(r.value)} style={{
                  padding:'9px 10px', borderRadius:9, cursor:'pointer', textAlign:'left',
                  border: `1.5px solid ${role===r.value ? roleColors[r.value].border : 'var(--border)'}`,
                  background: role===r.value ? roleColors[r.value].bg : 'transparent',
                }}>
                  <div style={{ fontSize:12, fontWeight:600, color: role===r.value ? roleColors[r.value].color : 'var(--text-4)' }}>{r.label}</div>
                  <div style={{ fontSize:10, color:'var(--dim)', marginTop:2 }}>{r.note}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{ fontSize:11, color:'var(--dim)', padding:'8px 12px', background:'rgba(var(--ov),.02)', borderRadius:8, border:'1px solid var(--border)' }}>
            📧 Gmail: {u.email}
          </div>
          <button onClick={save} disabled={busy} style={{ padding:12, borderRadius:10, border:'none', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', opacity:busy?.6:1 }}>
            {busy ? 'সংরক্ষণ হচ্ছে...' : '✅ সংরক্ষণ করুন'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Download Logs Modal ───────────────────────────────────────
function DownloadLogsModal({ user: u, logs, files, onClose }) {
  const userLogs = logs
    .filter(l => l.user_id === u.id)
    .sort((a, b) => new Date(b.downloaded_at) - new Date(a.downloaded_at))

  function getFile(fileId) {
    return files.find(f => f.id === fileId)
  }

  function formatTime(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString('bn-BD', { dateStyle:'short', timeStyle:'short' })
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ width:'100%', maxWidth:500, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'18px 18px 0 0', padding:'20px 20px 36px', maxHeight:'85vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:36, height:4, background:'var(--border)', borderRadius:2, margin:'0 auto 16px' }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-strong)' }}>⬇ Download History</h3>
            <p style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{u.name} — মোট {userLogs.length} টি download</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
          <div style={{ background:'rgba(5,150,105,.08)', border:'1px solid rgba(5,150,105,.15)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
            <div style={{ fontSize:26, fontWeight:700, color:'var(--c-green)' }}>{userLogs.length}</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>মোট Download</div>
          </div>
          <div style={{ background:'rgba(37,99,235,.08)', border:'1px solid rgba(37,99,235,.15)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
            <div style={{ fontSize:26, fontWeight:700, color:'var(--c-blue)' }}>{new Set(userLogs.map(l=>l.file_id)).size}</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>আলাদা File</div>
          </div>
        </div>

        {userLogs.length === 0 ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--dim)', fontSize:13 }}>
            <div style={{ fontSize:32, marginBottom:8, opacity:.3 }}>📭</div>
            এখনো কোনো download নেই
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {userLogs.map((log, i) => {
              const file = getFile(log.file_id)
              return (
                <div key={i} style={{ background:'rgba(var(--ov),.02)', border:'1px solid var(--border)', borderRadius:9, padding:'10px 12px', display:'flex', gap:10, alignItems:'flex-start' }}>
                  <div style={{ fontSize:18, flexShrink:0, marginTop:1 }}>
                    {file?.type==='note'?'📄':file?.type==='jobsheet'?'📋':file?.type==='mid'?'📘':'🏆'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {file?.subject || log.file_name || 'Unknown File'}
                    </div>
                    <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>
                      🕒 {formatTime(log.downloaded_at)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── User Detail Modal ─────────────────────────────────────────
function UserModal({ user: u, files, logs, onClose, onBan, onUnban, onRemove, onEdit }) {
  const [tab, setTab] = useState('info')
  const userLogs = logs.filter(l => l.user_id === u.id)
  const topFiles = [...files].filter(f=>(f.downloads||0)>0).sort((a,b)=>(b.downloads||0)-(a.downloads||0)).slice(0,8)

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.8)', display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ width:'100%', maxWidth:480, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'18px 18px 0 0', padding:'20px 20px 32px', maxHeight:'88vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:36, height:4, background:'var(--border)', borderRadius:2, margin:'0 auto 18px' }} />
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
          <Avatar email={u.email} name={u.name} size={52} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--text-strong)' }}>{u.name||'—'}</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.email}</div>
            <div style={{ marginTop:5 }}>
              <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:5, ...(u.is_banned?{background:'rgba(220,38,38,.12)',color:'var(--c-red)'}:{background:'rgba(5,150,105,.1)',color:'var(--c-green)'}) }}>
                {u.is_banned?'🚫 Banned':'✅ Active'}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer', flexShrink:0 }}>✕</button>
        </div>

        <div style={{ display:'flex', gap:4, background:'var(--surface-2)', borderRadius:9, padding:4, marginBottom:14 }}>
          {[['info','📋 তথ্য'],['downloads','⬇ Downloads']].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ flex:1, padding:'7px 0', border:'none', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:600, background:tab===id?'#2563eb':'transparent', color:tab===id?'#fff':'var(--muted)' }}>{label}</button>
          ))}
        </div>

        {tab === 'info' ? (
          <>
            <div style={{ background:'rgba(var(--ov),.02)', border:'1px solid var(--border)', borderRadius:12, marginBottom:14, overflow:'hidden' }}>
              {[
                {icon:'🎓',label:'Roll',val:u.roll||'—'},
                {icon:'📱',label:'Phone',val:u.phone||'—'},
                {icon:'✉️',label:'Email Verify',val:u.email_verified?('✅ Verified'+(u.email_verified_at?' — '+new Date(u.email_verified_at).toLocaleString('bn-BD'):'')):'⏳ এখনও verify করেনি'},
                {icon:'📅',label:'Joined',val:u.created_at?new Date(u.created_at).toLocaleDateString('bn-BD'):'—'},
                {icon:'🌐',label:'IP Address',val:u.ip_address||'N/A (এখনও login করেনি)'},
                {icon:'💻',label:'Device',val:u.device_info||'N/A'},
                {icon:'🕒',label:'Last Seen',val:u.last_seen?new Date(u.last_seen).toLocaleString('bn-BD'):'N/A'},
              ].map((r,i,arr) => (
                <div key={r.label} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'11px 14px', borderBottom:i<arr.length-1?'1px solid rgba(var(--ov),.04)':'none' }}>
                  <span style={{ fontSize:15, flexShrink:0 }}>{r.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:10, color:'var(--dim)', fontWeight:600, marginBottom:2 }}>{r.label}</div>
                    <div style={{ fontSize:12, color:'var(--text-3)', wordBreak:'break-all' }}>{r.val}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <button onClick={() => { onEdit(u); onClose() }} style={{ width:'100%', padding:12, borderRadius:10, border:'1px solid rgba(37,99,235,.25)', background:'rgba(37,99,235,.1)', color:'var(--c-blue)', cursor:'pointer', fontSize:13, fontWeight:600 }}>✏️ Edit করুন</button>
              {u.is_banned
                ? <button onClick={() => { onUnban(u); onClose() }} style={{ width:'100%', padding:12, borderRadius:10, border:'1px solid rgba(5,150,105,.25)', background:'rgba(5,150,105,.1)', color:'var(--c-green)', cursor:'pointer', fontSize:13, fontWeight:600 }}>✅ Unban করুন</button>
                : <button onClick={() => { onBan(u); onClose() }}   style={{ width:'100%', padding:12, borderRadius:10, border:'1px solid rgba(217,119,6,.25)', background:'rgba(217,119,6,.1)', color:'var(--c-amber)', cursor:'pointer', fontSize:13, fontWeight:600 }}>🚫 Ban করুন</button>
              }
              <button onClick={() => { onRemove(u); onClose() }} style={{ width:'100%', padding:12, borderRadius:10, border:'1px solid rgba(220,38,38,.2)', background:'rgba(220,38,38,.08)', color:'var(--c-red)', cursor:'pointer', fontSize:13, fontWeight:600 }}>🗑 সম্পূর্ণ মুছুন</button>
            </div>
          </>
        ) : (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
              <div style={{ background:'rgba(5,150,105,.08)', border:'1px solid rgba(5,150,105,.15)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
                <div style={{ fontSize:26, fontWeight:700, color:'var(--c-green)' }}>{userLogs.length}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>মোট Download</div>
              </div>
              <div style={{ background:'rgba(37,99,235,.08)', border:'1px solid rgba(37,99,235,.15)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
                <div style={{ fontSize:26, fontWeight:700, color:'var(--c-blue)' }}>{new Set(userLogs.map(l=>l.file_id)).size}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>আলাদা File</div>
              </div>
            </div>
            {userLogs.length === 0 ? (
              <div style={{ textAlign:'center', padding:32, color:'var(--dim)', fontSize:13 }}>
                <div style={{ fontSize:32, marginBottom:8, opacity:.3 }}>📭</div>
                এখনো কোনো download নেই
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {userLogs.sort((a,b)=>new Date(b.downloaded_at)-new Date(a.downloaded_at)).slice(0,15).map((log,i) => {
                  const file = files.find(f=>f.id===log.file_id)
                  return (
                    <div key={i} style={{ background:'rgba(var(--ov),.02)', border:'1px solid var(--border)', borderRadius:9, padding:'10px 12px', display:'flex', gap:10, alignItems:'flex-start' }}>
                      <div style={{ fontSize:18, flexShrink:0 }}>{file?.type==='note'?'📄':file?.type==='jobsheet'?'📋':file?.type==='mid'?'📘':'🏆'}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file?.subject||log.file_name||'Unknown'}</div>
                        <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>🕒 {log.downloaded_at ? new Date(log.downloaded_at).toLocaleString('bn-BD',{dateStyle:'short',timeStyle:'short'}) : '—'}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function Users({ showToast }) {
  const [users,        setUsers]        = useState([])
  const [files,        setFiles]        = useState([])
  const [logs,         setLogs]         = useState([])
  const [upLogs,       setUpLogs]       = useState([])
  const [showUpLogs,   setShowUpLogs]   = useState(false)
  const [showDup, setShowDup] = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState(null)
  const [editUser,     setEditUser]     = useState(null)
  const [dlUser,       setDlUser]       = useState(null)
  const [jobSheetUser, setJobSheetUser] = useState(null)
  const [search,       setSearch]       = useState('')
  const [vf,           setVf]           = useState('all')   // all | yes | no (email verify filter)
  const wpa = useWallpaper().site
  async function toggleWp(u) {
    const ids = wpa.ids || [], has = ids.includes(u.id)
    const next = has ? ids.filter(x => x !== u.id) : [...ids, u.id]
    try {
      await setAccess(wpa.mode === 'all' ? 'all' : 'selected', next)
      showToast && showToast(has ? `🔒 ${u.name || u.email} আগের design-এ ফিরল` : `🖼️ ${u.name || u.email} এখন wallpaper design পাবে`)
    } catch (e) { showToast && showToast('ব্যর্থ: ' + e.message + ' (site_settings.sql run করেছেন?)', 'err') }
  }

  async function loadAll() {
    setLoading(true)
    const [u, f, l] = await Promise.all([
      sb.from('users').select('*').order('created_at', { ascending: false }),
      sb.from('files').select('*').order('downloads', { ascending: false }),
      sb.from('download_logs').select('*').order('downloaded_at', { ascending: false }),
    ])
    if (u.data) setUsers(normRows(u.data))
    if (f.data) setFiles(normRows(f.data).filter(x => x.approved !== false))
    if (l.data) setLogs(l.data)
    try {
      const ul = await sb.from('upload_logs').select('*').order('uploaded_at', { ascending: false }).limit(500)
      if (ul.data) setUpLogs(ul.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    const ch = sb.channel('users-ch')
      .on('postgres_changes', { event:'*', schema:'public', table:'users' }, loadAll)
      .on('postgres_changes', { event:'*', schema:'public', table:'download_logs' }, loadAll)
      .on('postgres_changes', { event:'*', schema:'public', table:'upload_logs' }, loadAll)
      .subscribe()
    return () => sb.removeChannel(ch)
  }, [])

  async function banUser(u) {
    if (!confirm(`"${u.name}" কে ban করতে চান?`)) return
    const { error } = await sb.from('users').update({ is_banned: true }).eq('id', u.id)
    if (error) { showToast('ব্যর্থ: ' + error.message, 'err'); return }
    showToast('✅ Ban করা হয়েছে'); loadAll()
  }

  async function unbanUser(u) {
    const { error } = await sb.from('users').update({ is_banned: false }).eq('id', u.id)
    if (error) { showToast('ব্যর্থ: ' + error.message, 'err'); return }
    showToast('✅ Unban করা হয়েছে'); loadAll()
  }

  async function removeUser(u) {
    if (!confirm(`"${u.name}" কে মুছে দিতে চান?\n\nতাদের account সম্পূর্ণ ডিলিট হবে এবং পরবর্তী লগইনে block হবে।`)) return
    // প্রথমে ban করো যাতে active session টার্মিনেট হয়
    await sb.from('users').update({ is_banned: true }).eq('id', u.id)
    // তারপর users table থেকে মুছো
    const { error } = await sb.from('users').delete().eq('id', u.id)
    if (error) { showToast('মুছতে ব্যর্থ: ' + error.message, 'err'); return }
    showToast('✅ মুছে দেওয়া হয়েছে'); setSelected(null); loadAll()
  }

  async function saveEdit(u, data) {
    const { error } = await sb.from('users').update(data).eq('id', u.id)
    if (error) { showToast('ব্যর্থ: ' + error.message, 'err'); return }
    showToast('✅ তথ্য আপডেট হয়েছে'); loadAll()
  }

  // Duplicate Roll: একই roll একাধিক user
  const dupGroups = (() => {
    const m = {}
    users.forEach(u => { const r = (u.roll || '').toString().trim(); if (r) (m[r] = m[r] || []).push(u) })
    return Object.entries(m).filter(([, a]) => a.length > 1).map(([roll, list]) => ({ roll, list }))
  })()
  const dupCount = dupGroups.length

  const verifiedCount   = users.filter(u => u.email_verified).length
  const unverifiedList  = users.filter(u => !u.email_verified)
  const filtered = users.filter(u =>
    (vf === 'all' || (vf === 'yes' ? u.email_verified : !u.email_verified)) && (
    (u.name||'').toLowerCase().includes(search.toLowerCase()) ||
    (u.email||'').toLowerCase().includes(search.toLowerCase()) ||
    (u.roll||'').toLowerCase().includes(search.toLowerCase()))
  )

  async function resendVerify(u) {
    if (!u.email) return
    const { error } = await sb.auth.resend({ type: 'signup', email: u.email, options: { emailRedirectTo: window.location.origin } })
    if (error) { showToast('ব্যর্থ: ' + (/rate|seconds/i.test(error.message) ? 'কিছুক্ষণ পরে আবার চেষ্টা করুন' : error.message), 'err'); return }
    showToast('📧 ' + (u.name||'user') + '-কে verification মেইল পাঠানো হয়েছে')
  }
  // Auto-confirmed দের জোর করে আবার unverified করা (SQL function: force_reverify.sql)
  const [autoCount, setAutoCount] = useState(null)
  const [fvBusy, setFvBusy] = useState(false)
  useEffect(() => {
    (async () => { try { const { data, error } = await sb.rpc('admin_auto_confirmed_count'); if (!error && typeof data === 'number') setAutoCount(data) } catch {} })()
  }, [users.length, users.filter(u => u.email_verified).length])
  async function forceReverify() {
    if (!confirm('১০ জন auto-confirmed user-কে আবার unverified করবেন?\n\nতারা পরের বার ঢুকলে "Email Verify করুন" screen দেখবে ও Gmail-এর লিংকে ক্লিক করতে হবে।')) return
    setFvBusy(true)
    const { data, error } = await sb.rpc('admin_force_reverify', { p_limit: 10 })
    setFvBusy(false)
    if (error) { showToast('ব্যর্থ: ' + error.message + ' (force_reverify.sql run করেছেন?)', 'err'); return }
    showToast('🔁 ' + data + ' জনকে unverified করা হয়েছে — তারা ঢুকলেই verify screen পাবে')
    loadAll()
  }
  function copyUnverified() {
    const txt = unverifiedList.map(u => `${u.name||'—'} | ${u.roll||'—'} | ${u.phone||'—'} | ${u.email||'—'}`).join('\n')
    try { navigator.clipboard.writeText(txt); showToast('📋 ' + unverifiedList.length + ' জনের তালিকা কপি হয়েছে') } catch { showToast('কপি হয়নি', 'err') }
  }

  return (
    <div>
      {/* TOPBAR */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, gap:14, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:700, color:'var(--text-strong)' }}>👥 User ম্যানেজ</h1>
          <p style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>সব registered user দেখুন ও পরিচালনা করুন</p>
        </div>
        <div className="u-stats" style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {[
            { n:users.length, l:'মোট', c:'var(--c-blue)', bg:'rgba(37,99,235,.1)', bd:'rgba(37,99,235,.2)' },
            { n:users.filter(u=>!u.is_banned).length, l:'Active', c:'var(--c-green)', bg:'rgba(5,150,105,.1)', bd:'rgba(5,150,105,.2)' },
            { n:verifiedCount, l:'✉️ Verified', c:'var(--c-green)', bg:'rgba(5,150,105,.1)', bd:'rgba(5,150,105,.2)', click:() => setVf('yes') },
            { n:unverifiedList.length, l:'⏳ Unverified', c:'var(--c-amber)', bg:'rgba(217,119,6,.1)', bd:'rgba(217,119,6,.25)', click:() => setVf('no') },
            { n:users.filter(u=>u.is_banned).length,  l:'Banned', c:'var(--c-red)', bg:'rgba(220,38,38,.08)', bd:'rgba(220,38,38,.15)' },
            { n:logs.length, l:'Downloads', c:'var(--c-amber)', bg:'rgba(217,119,6,.08)', bd:'rgba(217,119,6,.15)' },
            { n:upLogs.length, l:'Uploads', c:'var(--c-cyan)', bg:'rgba(6,182,212,.08)', bd:'rgba(6,182,212,.18)' },
            { n:dupCount, l:'Dup Roll', c:'var(--c-red)', bg:'rgba(220,38,38,.08)', bd:'rgba(220,38,38,.2)', click:() => setShowDup(true) },
          ].map(sc => (
            <div key={sc.l} onClick={sc.click} title={sc.click ? 'ক্লিক করে দেখুন' : undefined} style={{ cursor: sc.click ? 'pointer' : 'default', padding:'6px 14px', background:sc.bg, border:`1px solid ${sc.bd}`, borderRadius:8, textAlign:'center', minWidth:58 }}>
              <div style={{ fontSize:18, fontWeight:700, color:sc.c, lineHeight:1 }}>{sc.n}</div>
              <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>{sc.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* UPLOAD LOG */}
      <div style={{ marginBottom:14 }}>
        <button onClick={() => setShowUpLogs(v => !v)} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'rgba(6,182,212,.06)', border:'1px solid rgba(6,182,212,.2)', borderRadius:10, color:'var(--c-cyan)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          <span>📤 Upload Log — কে কোন ফাইল আপলোড করেছে ({upLogs.length})</span>
          <span>{showUpLogs ? '▲' : '▼'}</span>
        </button>
        {showUpLogs && (
          <div style={{ marginTop:8, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, maxHeight:380, overflowY:'auto' }}>
            {!upLogs.length ? (
              <div style={{ padding:20, textAlign:'center', color:'var(--dim)', fontSize:12 }}>এখনো কোনো upload log নেই (নতুন আপলোড থেকে জমা হবে)</div>
            ) : upLogs.map(l => (
              <div key={l.id} style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', gap:10, alignItems:'flex-start', flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:180 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{l.user_name || l.user_email || 'অজানা'}
                    {l.user_role && <span style={{ marginLeft:6, fontSize:10, color:'var(--c-cyan)' }}>{ROLE_LABELS[l.user_role] || l.user_role}</span>}
                  </div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{l.user_email}</div>
                </div>
                <div style={{ flex:2, minWidth:200 }}>
                  <div style={{ fontSize:12, color:'var(--text-2)' }}>📄 {l.file_name || '—'} <span style={{ color:'var(--muted)' }}>({l.size || '—'})</span></div>
                  <div style={{ fontSize:11, color:'var(--text-4)' }}>{l.subject}{l.file_type ? ' · ' + l.file_type : ''}{l.section ? ' · Section ' + l.section : ''}{l.chapter ? ' · ' + l.chapter : ''}</div>
                </div>
                <div style={{ fontSize:11, color:'var(--muted)', whiteSpace:'nowrap' }}>{l.uploaded_at ? new Date(l.uploaded_at).toLocaleString('bn-BD') : ''}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EMAIL VERIFY FILTER */}
      <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
        {[['all','সবাই',users.length],['yes','✉️ Verified',verifiedCount],['no','⏳ Unverified',unverifiedList.length]].map(([id,l,n]) => (
          <button key={id} onClick={() => setVf(id)} style={{ padding:'6px 12px', borderRadius:999, fontSize:12, fontWeight:700, cursor:'pointer', border:'1px solid var(--border)', background: vf===id ? '#2563eb' : 'var(--surface)', color: vf===id ? '#fff' : 'var(--text-3)' }}>{l} ({n})</button>
        ))}
        <button onClick={forceReverify} disabled={fvBusy} title="Auto-confirmed user-দের জোর করে আবার Gmail verify করানো (১০ জন করে)" style={{ marginLeft:'auto', padding:'6px 12px', borderRadius:999, fontSize:12, fontWeight:700, cursor:'pointer', opacity: fvBusy ? .55 : 1, background:'rgba(220,38,38,.1)', border:'1px solid rgba(220,38,38,.3)', color:'var(--c-red)' }}>
          🔁 Force Re-verify (১০ জন){autoCount != null ? ` · বাকি ${autoCount}` : ''}
        </button>
        {vf === 'no' && unverifiedList.length > 0 && (
          <button onClick={copyUnverified} style={{ padding:'6px 12px', borderRadius:999, fontSize:12, fontWeight:700, cursor:'pointer', background:'rgba(217,119,6,.12)', border:'1px solid rgba(217,119,6,.3)', color:'var(--c-amber)' }}>📋 Unverified তালিকা কপি</button>
        )}
      </div>

      {/* SEARCH */}
      <div style={{ display:'flex', alignItems:'center', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, marginBottom:14, overflow:'hidden' }}>
        <span style={{ paddingLeft:12, color:'var(--dim)', fontSize:14 }}>🔍</span>
        <input placeholder="নাম, Gmail বা Roll দিয়ে খুঁজুন..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{ flex:1, padding:'10px 12px', background:'transparent', border:'none', color:'var(--text)', fontSize:13, outline:'none' }} />
        <span style={{ paddingRight:12, fontSize:12, color:'var(--dim)' }}>{filtered.length} জন</span>
      </div>

      {/* USER CARDS */}
      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--dim)' }}>লোড হচ্ছে...</div>
      ) : !filtered.length ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--dim)' }}>কোনো user নেই</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map((u, i) => {
            const uLogs = logs.filter(l => l.user_id === u.id)
            return (
              <div key={u.id} className="u-card" style={{ background:'var(--surface)', border:'1px solid var(--border)', borderLeft:`3px solid ${u.is_banned?'#ef4444':'#2563eb'}`, borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', gap:12, transition:'background .15s' }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(var(--ov),.03)'}
                onMouseLeave={e=>e.currentTarget.style.background='var(--surface)'}>
                <div style={{ fontSize:11, color:'var(--dim)', width:20, flexShrink:0, textAlign:'center' }}>{i+1}</div>
                <Avatar email={u.email} name={u.name} size={38} />
                <div style={{ flex:1, minWidth:0, cursor:'pointer' }} onClick={() => setSelected(u)}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.name||'—'}</span>
                    {u.is_banned && <span style={{ fontSize:9, padding:'1px 5px', background:'rgba(220,38,38,.12)', color:'var(--c-red)', borderRadius:4, flexShrink:0 }}>banned</span>}
                    <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, flexShrink:0, fontWeight:700, background: u.email_verified ? 'rgba(5,150,105,.14)' : 'rgba(217,119,6,.14)', color: u.email_verified ? 'var(--c-green)' : 'var(--c-amber)' }}>{u.email_verified ? '✉️ verified' : '⏳ unverified'}</span>
                    {u.role && u.role !== 'student' && (
                      <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, flexShrink:0,
                        background: u.role==='admin' ? 'rgba(37,99,235,.12)' : u.role==='teacher' ? 'rgba(124,58,237,.12)' : u.role==='group_admin' ? 'rgba(234,179,8,.12)' : 'rgba(8,145,178,.12)',
                        color: u.role==='admin' ? 'var(--c-blue)' : u.role==='teacher' ? 'var(--c-violet)' : u.role==='group_admin' ? 'var(--c-amber)' : 'var(--c-cyan)'
                      }}>{ROLE_LABELS[u.role] || u.role}</span>
                    )}
                  </div>
                  <div style={{ fontSize:11, color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.email||'—'}</div>
                  <div style={{ display:'flex', gap:8, marginTop:3 }}>
                    {u.roll && <span style={{ fontSize:10, color:'var(--dim)' }}>Roll: {u.roll}</span>}
                    {uLogs.length > 0 && <span style={{ fontSize:10, color:'#d97706' }}>⬇ {uLogs.length}</span>}
                  </div>
                </div>
                <div className="u-acts" style={{ display:'flex', gap:5, flexShrink:0 }}>
                  {!u.email_verified && <button onClick={() => resendVerify(u)} title="Verification মেইল আবার পাঠান" style={{ padding:'5px 8px', borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer', background:'rgba(217,119,6,.12)', border:'1px solid rgba(217,119,6,.3)', color:'var(--c-amber)' }}>📧</button>}
                  <button onClick={() => toggleWp(u)} title="Wallpaper design-এর অনুমতি (সবুজ = পাবে)" style={{ padding:'5px 8px', borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer',
                    background: (wpa.mode==='all' || (wpa.ids||[]).includes(u.id)) ? 'rgba(5,150,105,.16)' : 'rgba(148,163,184,.1)',
                    border: (wpa.mode==='all' || (wpa.ids||[]).includes(u.id)) ? '1px solid rgba(5,150,105,.4)' : '1px solid var(--border)',
                    color: (wpa.mode==='all' || (wpa.ids||[]).includes(u.id)) ? 'var(--c-green)' : 'var(--muted)', opacity: wpa.mode==='all' ? .6 : 1 }}>🖼️</button>
                  <button onClick={() => setJobSheetUser(u)} style={{ padding:'5px 8px', borderRadius:7, fontSize:11, fontWeight:600, background:'rgba(8,145,178,.1)', border:'1px solid rgba(8,145,178,.2)', color:'var(--c-cyan)', cursor:'pointer' }}>📋</button>
                  <button onClick={() => setDlUser(u)}      style={{ padding:'5px 8px', borderRadius:7, fontSize:11, fontWeight:600, background:'rgba(217,119,6,.1)', border:'1px solid rgba(217,119,6,.2)', color:'var(--c-amber)', cursor:'pointer' }}>⬇</button>
                  <button onClick={() => setEditUser(u)}    style={{ padding:'5px 8px', borderRadius:7, fontSize:11, fontWeight:600, background:'rgba(37,99,235,.1)', border:'1px solid rgba(37,99,235,.2)', color:'var(--c-blue)', cursor:'pointer' }}>✏️</button>
                  {u.is_banned
                    ? <button onClick={()=>unbanUser(u)} style={{ padding:'5px 9px', borderRadius:7, fontSize:11, fontWeight:600, background:'rgba(5,150,105,.1)', border:'1px solid rgba(5,150,105,.2)', color:'var(--c-green)', cursor:'pointer' }}>Unban</button>
                    : <button onClick={()=>banUser(u)}   style={{ padding:'5px 9px', borderRadius:7, fontSize:11, fontWeight:600, background:'rgba(217,119,6,.1)', border:'1px solid rgba(217,119,6,.2)', color:'var(--c-amber)', cursor:'pointer' }}>Ban</button>
                  }
                  <button onClick={() => setSelected(u)} style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showDup && (
        <div onClick={() => setShowDup(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:900, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:560, maxHeight:'85vh', overflowY:'auto', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text-strong)' }}>🔁 Duplicate Roll ({dupCount})</div>
              <button onClick={() => setShowDup(false)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:18, cursor:'pointer' }}>✕</button>
            </div>
            {!dupGroups.length ? (
              <div style={{ padding:24, textAlign:'center', color:'var(--dim)', fontSize:13 }}>✅ কোনো duplicate roll নেই</div>
            ) : dupGroups.map(g => (
              <div key={g.roll} style={{ marginBottom:12, border:'1px solid rgba(220,38,38,.25)', borderRadius:12, overflow:'hidden' }}>
                <div style={{ padding:'8px 12px', background:'rgba(220,38,38,.08)', fontSize:12, fontWeight:700, color:'var(--c-red)' }}>Roll {g.roll} — {g.list.length} জন ব্যবহার করেছে</div>
                {g.list.map(u => (
                  <div key={u.id} style={{ padding:'9px 12px', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', borderTop:'1px solid var(--border)' }}>
                    <div style={{ flex:1, minWidth:160 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{u.name || '—'}{u.is_banned && <span style={{ marginLeft:6, fontSize:9, padding:'1px 5px', background:'rgba(220,38,38,.12)', color:'var(--c-red)', borderRadius:4 }}>banned</span>}</div>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>{u.email || '—'}</div>
                      <div style={{ fontSize:11, color:'var(--dim)' }}>Section: {u.section || '—'}</div>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => setSelected(u)} style={{ padding:'5px 11px', borderRadius:7, fontSize:11, fontWeight:600, background:'rgba(37,99,235,.1)', border:'1px solid rgba(37,99,235,.2)', color:'var(--c-blue)', cursor:'pointer' }}>👁 দেখো</button>
                      {!u.is_banned && <button onClick={() => banUser(u)} style={{ padding:'5px 11px', borderRadius:7, fontSize:11, fontWeight:600, background:'rgba(217,119,6,.1)', border:'1px solid rgba(217,119,6,.2)', color:'var(--c-amber)', cursor:'pointer' }}>🚫 Ban</button>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {selected    && <UserModal user={selected} files={files} logs={logs} onClose={()=>setSelected(null)} onBan={banUser} onUnban={unbanUser} onRemove={removeUser} onEdit={setEditUser} />}
      {editUser    && <EditModal user={editUser} onClose={()=>setEditUser(null)} onSave={saveEdit} />}
      {dlUser      && <DownloadLogsModal user={dlUser} logs={logs} files={files} onClose={()=>setDlUser(null)} />}
      {jobSheetUser && <JobSheetDateModal user={jobSheetUser} files={files} onClose={()=>setJobSheetUser(null)} />}
    </div>
  )
}
