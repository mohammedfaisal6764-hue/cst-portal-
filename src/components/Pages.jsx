import { useState, useRef, useEffect } from 'react'
import { subscribePush, unsubscribePush, checkPushSubscription, triggerNotification as sendPush, pushResultText, pushKeyStatus, resetPushSubscription } from '../push'
import { uploadToR2, deleteFromR2 } from '../r2'
import { useStylePref } from '../theme'
import { ClassWorkCard, ClassWorkFiles, isClassWork } from './ClassWork'
import ThemeSwitch, { StyleSwitch, WallpaperPicker, TintSwitch, ClaritySwitch } from './ThemeSwitch'
import { wallpaperAllowed, isWpFamily } from '../theme'
import { sb, SUBJECTS, SECTIONS, HW_TYPES, TYPE_LABELS, rollToSection, toBengaliToEnglishNum, normSec, normRows } from '../supabase'
import FileCard from './FileCard'

// ─── ALL FILES ───────────────────────────────
export function AllFiles({ files, loadFiles, showToast, isAdmin, userSemester }) {
  const [filter, setFilter] = useState('all')
  // Semester filter — admin সব দেখবে
  const semFiles = (!isAdmin && userSemester)
    ? files.filter(f => (f.semester || '4th') === userSemester)
    : files
  const shown = filter === 'all' ? semFiles : semFiles.filter(f => f.type === filter)

  async function onDownload(file) {
    if (!file.file_url && !file.storage_path) { showToast('ফাইল URL নেই', 'err'); return }
    // R2 file হলে file_url সরাসরি, পুরনো Drive file হলে Drive URL
    const dlUrl = file.file_url || `https://drive.usercontent.google.com/download?id=${file.storage_path}&export=download&confirm=t`
    window.open(dlUrl, '_blank')
    await sb.from('files').update({ downloads: (file.downloads || 0) + 1 }).eq('id', file.id)
    await loadFiles()
    showToast('✅ ডাউনলোড শুরু হয়েছে!')
  }

  async function onDelete(file) {
    if (!confirm('মুছে দিতে চান?')) return
    if (file.storage_path) {
      try { await deleteFromR2(file.storage_path) } catch {}
    }
    const { error } = await sb.from('files').delete().eq('id', file.id)
    if (error) { showToast('মুছতে ব্যর্থ: ' + error.message, 'err'); return }
    await loadFiles()
    showToast('✅ মুছে দেওয়া হয়েছে')
  }

  const s = sh
  return (
    <div>
      <div style={s.topbar} className="topbar-r">
        <div><h1 style={s.h1}>📂 সব ফাইল</h1><p style={s.sub}>আপলোড করা সব ফাইল</p></div>
      </div>
      <div style={s.filterRow} className="pills-r">
        {[['all','সব'],['note','📝 নোট'],['suggestion','💡 সাজেশন'],['mid','📘 Mid Term'],['final','🏆 Final'],['jobsheet','📋 Job Sheet']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ ...s.fp, ...(filter === v ? s.fpOn : {}) }}>{l}</button>
        ))}
      </div>
      <div style={s.grid} className="files-grid-r">
        {shown.length
          ? shown.map(f => <FileCard key={f.id} file={f} isAdmin={isAdmin} onDownload={onDownload} onDelete={onDelete} />)
          : <div style={s.empty}><div style={{ fontSize: 32, opacity: .3, marginBottom: 10 }}>📂</div><p>কোনো ফাইল নেই</p></div>
        }
      </div>
    </div>
  )
}

// ─── UPLOAD ──────────────────────────────────
// ── Apps Script URL — paste yours after deploying GOOGLE_APPS_SCRIPT.js ────
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxXVoJpVZEHpGmReq67KkpcSAD05uotJ1ZQOdRXV6HsfCbBEX5eOmb-azRL2Gesgwxi3A/exec'

// Convert File object → base64 string
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function Upload({ loadFiles, showToast, canUpload, isAdmin }) {
  const [subject,    setSubject]    = useState('')
  const [type,       setType]       = useState('note')
  const [section,    setSection]    = useState('')
  const [desc,       setDesc]       = useState('')
  const [chapter,     setChapter]     = useState('')
  const [jobNo,       setJobNo]       = useState('')
  const [jobName,     setJobName]     = useState('')
  const [expDateA,    setExpDateA]    = useState('')
  const [submitDateA, setSubmitDateA] = useState('')
  const [expDateB,    setExpDateB]    = useState('')
  const [submitDateB, setSubmitDateB] = useState('')
  const [expDateC,    setExpDateC]    = useState('')
  const [submitDateC, setSubmitDateC] = useState('')
  const [file,    setFile]    = useState(null)
  const [prog,    setProg]    = useState(0)
  const [busy,    setBusy]    = useState(false)
  const [drag,    setDrag]    = useState(false)
  const fileRef = useRef()

  async function doUpload() {
    if (!subject) { showToast('বিষয় বেছে নিন!', 'err'); return }
    if (!file)    { showToast('ফাইল সিলেক্ট করুন!', 'err'); return }

    setBusy(true); setProg(5)
    try {
      // সরাসরি Google Drive এ Chunked Upload (fast!)
      const { fileId, downloadUrl } = await uploadToR2(file, (p) => setProg(p))

      setProg(88)
      const sizeKB  = Math.round(file.size / 1024)
      const sizeStr = sizeKB > 1024 ? (sizeKB / 1024).toFixed(1) + ' MB' : sizeKB + ' KB'

      const jobInfo = type === 'jobsheet' && (jobNo || jobName || expDateA || expDateB || expDateC)
        ? `Job No: ${jobNo || '—'} | Job Name: ${jobName || '—'} | Exp-A: ${expDateA || '—'} | Submit-A: ${submitDateA || '—'} | Exp-B: ${expDateB || '—'} | Submit-B: ${submitDateB || '—'} | Exp-C: ${expDateC || '—'} | Submit-C: ${submitDateC || '—'}`
        : null

      setProg(93)
      const { data: insData, error: dbErr } = await sb.from('files').insert({
        subject,
        type,
        section:      section || null,
        chapter:      chapter || null,
        description:  jobInfo || desc || null,
        file_url:     downloadUrl,
        storage_path: fileId,
        size:         sizeStr,
        downloads:    0,
        date_str:     new Date().toLocaleDateString('bn-BD'),
        semester:     '4th',
        ...(isAdmin ? {} : { approved: false }),   // Admin ছাড়া সবার ফাইল আগে pending
      }).select().maybeSingle()
      if (dbErr) throw new Error('DB: ' + dbErr.message)

      // Upload log — কে কোন ফাইল আপলোড করল (ব্যর্থ হলেও আপলোড আটকাবে না)
      try {
        const { data: { session } } = await sb.auth.getSession()
        const u = session?.user
        if (u) {
          const { data: prof } = await sb.from('users').select('name,role,roll').eq('id', u.id).maybeSingle()
          await sb.from('upload_logs').insert({
            user_id:     u.id,
            user_name:   prof?.name || null,
            user_email:  u.email || null,
            user_role:   prof?.role || null,
            file_id:     insData?.id || null,
            subject,
            file_type:   type,
            section:     section || null,
            chapter:     chapter || null,
            file_name:   file.name,
            size:        sizeStr,
            uploaded_at: new Date().toISOString(),
          })
        }
      } catch {}

      setProg(100)
      setTimeout(() => setProg(0), 1500)
      setSubject(''); setType('note'); setSection(''); setChapter(''); setDesc(''); setJobNo(''); setJobName(''); setExpDateA(''); setSubmitDateA(''); setExpDateB(''); setSubmitDateB(''); setExpDateC(''); setSubmitDateC(''); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await loadFiles()
      showToast(isAdmin ? '✅ সফলভাবে আপলোড হয়েছে!' : '⏳ আপলোড হয়েছে! Admin approve করলে সবাই দেখতে পাবে।')
      // Section এর user দের push notification পাঠাও (শুধু approved ফাইলের জন্য)
      if (!isAdmin) { setBusy(false); return }
      try {
        const r = await sendPush({
          section: section || 'all',
          title:   '📚 নতুন ফাইল আপলোড হয়েছে!',
          body:    `${subject || 'নতুন ফাইল'} — ${TYPE_LABELS[type] || type}`,
          url:     '/?go=all',
        })
        setTimeout(() => showToast(pushResultText(r), r.ok ? 'ok' : 'err'), 1200)
      } catch {}

    } catch (e) {
      showToast('ত্রুটি: ' + e.message, 'err')
      setProg(0)
    }
    setBusy(false)
  }

  const s = sh
  const notConfigured = false // Google Drive API direct upload

  return (
    <div>
      <div style={s.topbar} className="topbar-r">
        <div>
          <h1 style={s.h1}>⬆️ ফাইল আপলোড</h1>
          <p style={s.sub}>নতুন নোট বা সাজেশন যোগ করুন</p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 14px', borderRadius: 8,
          background: 'rgba(5,150,105,.08)',
          border: '1px solid rgba(5,150,105,.2)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--c-green)', fontWeight: 600 }}>
            {'✅ Google Drive সংযুক্ত'}
          </span>
        </div>
      </div>

      {/* Setup warning */}
      {notConfigured && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.15)', borderRadius: 12, fontSize: 12, color: 'var(--c-red2)', lineHeight: 1.9 }}>
          ⚠️ <strong>Storage এখনো সংযুক্ত হয়নি।</strong> নিচের ধাপগুলো অনুসরণ করুন:<br/>
          ১. <code>GOOGLE_APPS_SCRIPT.js</code> ফাইলটা <a href="https://script.google.com" target="_blank" style={{color:'var(--c-blue2)'}}>script.google.com</a>-এ paste করুন<br/>
          ২. Deploy → Web app → Execute as: <strong>Me</strong> → Access: <strong>Anyone</strong><br/>
          ৩. Web app URL কপি করে <code>Pages.jsx</code>-এর <code>APPS_SCRIPT_URL</code>-এ বসান
        </div>
      )}

      <div style={s.panel}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 18 }}>📁 নতুন ফাইল যোগ করুন</h3>
        <div style={s.upGrid} className="up-grid-r">

          {/* DROPZONE */}
          <div style={{ gridColumn: '1/-1' }}>
            <div
              style={{
                ...s.dz,
                ...(drag ? s.dzDrag : {}),
                ...(file ? { borderColor: 'rgba(34,197,94,.4)', background: 'rgba(34,197,94,.03)' } : {})
              }}
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]) }}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.zip"
                onChange={e => e.target.files[0] && setFile(e.target.files[0])} />

              {file ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-green3)' }}>{file.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {Math.round(file.size / 1024) > 1024
                      ? (file.size / 1024 / 1024).toFixed(1) + ' MB'
                      : Math.round(file.size / 1024) + ' KB'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 6 }}>ক্লিক করে পরিবর্তন করুন</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>ফাইল টেনে আনুন বা ক্লিক করুন</div>
                  <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 3 }}>PDF, DOC, PPT, JPG, PNG, ZIP</div>
                </>
              )}
            </div>
          </div>

          {/* SUBJECT */}
          <InpG label="বিষয় *">
            <select value={subject} onChange={e => setSubject(e.target.value)} style={s.inp}>
              <option value="">-- বিষয় বেছে নিন --</option>
              {SUBJECTS.map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </select>
          </InpG>

          {/* TYPE */}
          <InpG label="ধরন *">
            <select value={type} onChange={e => setType(e.target.value)} style={s.inp}>
              <option value="note">📝 নোট</option>
              <option value="suggestion">💡 সাজেশন</option>
              <option value="mid">📘 Mid Term Suggestion</option>
              <option value="final">🏆 Final Suggestion</option>
              <option value="jobsheet">📋 Job Sheet</option>
            </select>
          </InpG>

          {/* SECTION */}
          <InpG label="Section (ঐচ্ছিক)">
            <select value={section} onChange={e => setSection(e.target.value)} style={s.inp}>
              <option value="">-- সব Section --</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>
          </InpG>

          {/* CHAPTER — শুধু নোট/সাজেশন এ */}
          {(type === 'note' || type === 'suggestion') && (
            <InpG label="অধ্যায় (ঐচ্ছিক)">
              <input
                value={chapter}
                onChange={e => setChapter(e.target.value)}
                placeholder="যেমন: অধ্যায় ১, Chapter 2"
                style={s.inp}
              />
            </InpG>
          )}

          {/* DESC — Job Sheet হলে লুকাবে */}
          {type !== 'jobsheet' && (
            <div style={{ gridColumn: '1/-1' }}>
              <InpG label="বিবরণ (ঐচ্ছিক)">
                <textarea value={desc} onChange={e => setDesc(e.target.value)}
                  placeholder="ফাইল সম্পর্কে সংক্ষিপ্ত বিবরণ..."
                  rows={3} style={{ ...s.inp, resize: 'vertical' }} />
              </InpG>
            </div>
          )}

          {/* JOB SHEET FIELDS — শুধু jobsheet select করলে দেখাবে */}
          {type === 'jobsheet' && (
            <div style={{ gridColumn: '1/-1', background: 'rgba(8,145,178,.06)', border: '1px solid rgba(8,145,178,.15)', borderRadius: 12, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-cyan)' }}>📋 Job Sheet তথ্য</div>

              {/* Job No & Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <InpG label="Job No">
                  <input value={jobNo} onChange={e => setJobNo(e.target.value)}
                    placeholder="যেমন: 01" style={s.inp} />
                </InpG>
                <InpG label="Job Name">
                  <input value={jobName} onChange={e => setJobName(e.target.value)}
                    placeholder="Job এর নাম" style={s.inp} />
                </InpG>
              </div>

              {/* Section A dates */}
              <div style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-green)', marginBottom: 10 }}>🏫 Section A</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <InpG label="Exp Date — A">
                    <input type="date" value={expDateA} onChange={e => setExpDateA(e.target.value)} style={s.inp} />
                  </InpG>
                  <InpG label="Submit Date — A">
                    <input type="date" value={submitDateA} onChange={e => setSubmitDateA(e.target.value)} style={s.inp} />
                  </InpG>
                </div>
              </div>

              {/* Section B dates */}
              <div style={{ background: 'rgba(37,99,235,.06)', border: '1px solid rgba(37,99,235,.15)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-blue)', marginBottom: 10 }}>🏫 Section B</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <InpG label="Exp Date — B">
                    <input type="date" value={expDateB} onChange={e => setExpDateB(e.target.value)} style={s.inp} />
                  </InpG>
                  <InpG label="Submit Date — B">
                    <input type="date" value={submitDateB} onChange={e => setSubmitDateB(e.target.value)} style={s.inp} />
                  </InpG>
                </div>
              </div>

            </div>
          )}

          {/* SUBMIT */}
          <div style={{ gridColumn: '1/-1' }}>
            <button onClick={doUpload} disabled={busy} style={{
              padding: '10px 28px',
              background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
              border: 'none', borderRadius: 9, color: '#fff',
              fontSize: 13, fontWeight: 600,
              cursor: (busy || notConfigured) ? 'not-allowed' : 'pointer',
              opacity: busy ? .6 : 1,
              boxShadow: notConfigured ? 'none' : '0 4px 14px rgba(37,99,235,.25)',
            }}>
              {busy ? '⏳ আপলোড হচ্ছে...' : '⬆️ আপলোড করুন'}
            </button>
          </div>

          {/* PROGRESS */}
          {prog > 0 && (
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg,#2563eb,#0891b2)', borderRadius: 3, width: prog + '%', transition: 'width .4s' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                {prog < 40 ? 'প্রস্তুত করা হচ্ছে...' : prog < 85 ? `Storage-এ পাঠানো হচ্ছে... ${prog}%` : prog < 100 ? 'সংরক্ষণ হচ্ছে...' : '✅ সম্পন্ন!'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ─── FILE EDIT MODAL ─────────────────────────
function FileEditModal({ file, onClose, onSave }) {
  const [subject,    setSubject]    = useState(file.subject || '')
  const [type,       setType]       = useState(file.type    || 'note')
  const [desc,       setDesc]       = useState(file.type !== 'jobsheet' ? (file.description || '') : '')
  const [section,    setSection]    = useState(file.section || '')
  const [newFile,    setNewFile]    = useState(null)
  const [busy,       setBusy]       = useState(false)
  const [prog,       setProg]       = useState(0)
  const fileRef = useRef()

  // Job Sheet fields — parse from existing description
  const existingParts = {}
  ;(file.description || '').split(' | ').forEach(p => {
    const [k, ...v] = p.split(': ')
    if (k && v.length) existingParts[k.trim()] = v.join(': ').trim()
  })
  const [chapter,     setChapter]     = useState(file.chapter || '')
  const [jobNo,       setJobNo]       = useState(existingParts['Job No']    || '')
  const [jobName,     setJobName]     = useState(existingParts['Job Name']  || '')
  const [expDateA,    setExpDateA]    = useState(existingParts['Exp-A']     || '')
  const [submitDateA, setSubmitDateA] = useState(existingParts['Submit-A']  || '')
  const [expDateB,    setExpDateB]    = useState(existingParts['Exp-B']     || '')
  const [submitDateB, setSubmitDateB] = useState(existingParts['Submit-B']  || '')
  const [expDateC,    setExpDateC]    = useState(existingParts['Exp-C']     || '')
  const [submitDateC, setSubmitDateC] = useState(existingParts['Submit-C']  || '')

  async function doSave() {
    if (!subject) { return }
    setBusy(true)
    try {
      let updateData = { subject, type, section: section || null, chapter: chapter || null }

      // Description / Job info
      if (type === 'jobsheet') {
        updateData.description = `Job No: ${jobNo||'—'} | Job Name: ${jobName||'—'} | Exp-A: ${expDateA||'—'} | Submit-A: ${submitDateA||'—'} | Exp-B: ${expDateB||'—'} | Submit-B: ${submitDateB||'—'} | Exp-C: ${expDateC||'—'} | Submit-C: ${submitDateC||'—'}`
      } else {
        updateData.description = desc
      }

      // File replace করতে চাইলে
      if (newFile) {
        setProg(20)
        // পুরনো Drive file মুছব
        if (file.storage_path) {
          try { await deleteFromR2(file.storage_path) } catch {}
        }
        // নতুন file Drive এ fast upload
        const { fileId: newId, downloadUrl: newUrl } = await uploadToR2(newFile, (p) => setProg(20 + Math.round(p * 0.7)))
        const sizeKB  = Math.round(newFile.size / 1024)
        updateData.file_url     = newUrl
        updateData.storage_path = newId
        updateData.size         = sizeKB > 1024 ? (sizeKB/1024).toFixed(1)+' MB' : sizeKB+' KB'
        setProg(90)
      }

      await onSave(file.id, updateData)
      setProg(100)
      setTimeout(() => { setProg(0); onClose() }, 600)
    } catch(e) {
      alert('ত্রুটি: ' + e.message)
      setProg(0)
    }
    setBusy(false)
  }

  const inp = { padding:'10px 13px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:9, color:'var(--text)', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto' }}>
      <div style={{ width:'100%', maxWidth:520, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'24px 22px', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:'var(--text-strong)' }}>✏️ File Edit করুন</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
          {/* Subject */}
          <div>
            <label style={{ fontSize:11, color:'var(--muted)', fontWeight:500, display:'block', marginBottom:5 }}>বিষয় *</label>
            <select value={subject} onChange={e=>setSubject(e.target.value)} style={inp}>
              <option value="">-- বিষয় বেছে নিন --</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Type + Section */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontSize:11, color:'var(--muted)', fontWeight:500, display:'block', marginBottom:5 }}>ধরন *</label>
              <select value={type} onChange={e=>setType(e.target.value)} style={inp}>
                <option value="note">📝 নোট</option>
                <option value="suggestion">💡 সাজেশন</option>
                <option value="mid">📘 Mid Term</option>
                <option value="final">🏆 Final</option>
                <option value="jobsheet">📋 Job Sheet</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--muted)', fontWeight:500, display:'block', marginBottom:5 }}>Section</label>
              <select value={section} onChange={e=>setSection(e.target.value)} style={inp}>
                <option value="">-- সব Section --</option>
                <option value="A">Section A</option>
              <option value="B">Section B</option>
              </select>
            </div>
          </div>

          {/* Chapter — নোট/সাজেশন এ */}
          {(type === 'note' || type === 'suggestion') && (
            <div>
              <label style={{ fontSize:11, color:'var(--muted)', fontWeight:500, display:'block', marginBottom:5 }}>অধ্যায় (ঐচ্ছিক)</label>
              <input value={chapter} onChange={e=>setChapter(e.target.value)} style={inp} placeholder="যেমন: অধ্যায় ১, Chapter 2" />
            </div>
          )}

          {/* Description / Job Sheet fields */}
          {type !== 'jobsheet' ? (
            <div>
              <label style={{ fontSize:11, color:'var(--muted)', fontWeight:500, display:'block', marginBottom:5 }}>বিবরণ</label>
              <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} style={{ ...inp, resize:'vertical' }} placeholder="বিবরণ..." />
            </div>
          ) : (
            <div style={{ background:'rgba(8,145,178,.06)', border:'1px solid rgba(8,145,178,.15)', borderRadius:12, padding:'14px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--c-cyan)', marginBottom:12 }}>📋 Job Sheet তথ্য</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div><label style={{ fontSize:11, color:'var(--muted)', fontWeight:500, display:'block', marginBottom:5 }}>Job No</label><input value={jobNo} onChange={e=>setJobNo(e.target.value)} style={inp} placeholder="01" /></div>
                <div><label style={{ fontSize:11, color:'var(--muted)', fontWeight:500, display:'block', marginBottom:5 }}>Job Name</label><input value={jobName} onChange={e=>setJobName(e.target.value)} style={inp} placeholder="Job নাম" /></div>
              </div>
              <div style={{ background:'rgba(16,185,129,.06)', border:'1px solid rgba(16,185,129,.15)', borderRadius:9, padding:'10px 12px', marginBottom:8 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--c-green)', marginBottom:8 }}>🏫 Section A</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><label style={{ fontSize:11, color:'var(--muted)', fontWeight:500, display:'block', marginBottom:5 }}>Exp Date</label><input type="date" value={expDateA} onChange={e=>setExpDateA(e.target.value)} style={inp} /></div>
                  <div><label style={{ fontSize:11, color:'var(--muted)', fontWeight:500, display:'block', marginBottom:5 }}>Submit Date</label><input type="date" value={submitDateA} onChange={e=>setSubmitDateA(e.target.value)} style={inp} /></div>
                </div>
              </div>
              <div style={{ background:'rgba(37,99,235,.06)', border:'1px solid rgba(37,99,235,.15)', borderRadius:9, padding:'10px 12px', marginBottom:8 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--c-blue)', marginBottom:8 }}>🏫 Section B</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><label style={{ fontSize:11, color:'var(--muted)', fontWeight:500, display:'block', marginBottom:5 }}>Exp Date</label><input type="date" value={expDateB} onChange={e=>setExpDateB(e.target.value)} style={inp} /></div>
                  <div><label style={{ fontSize:11, color:'var(--muted)', fontWeight:500, display:'block', marginBottom:5 }}>Submit Date</label><input type="date" value={submitDateB} onChange={e=>setSubmitDateB(e.target.value)} style={inp} /></div>
                </div>
              </div>
            </div>
          )}

          {/* File Replace */}
          <div style={{ background:'rgba(var(--ov),.02)', border:'1px dashed var(--border)', borderRadius:10, padding:'14px', cursor:'pointer' }} onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" style={{ display:'none' }} accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.zip" onChange={e => e.target.files[0] && setNewFile(e.target.files[0])} />
            {newFile ? (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, marginBottom:4 }}>✅</div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--c-green3)' }}>{newFile.name}</div>
                <div style={{ fontSize:11, color:'var(--dim)', marginTop:3 }}>ক্লিক করে পরিবর্তন করুন</div>
              </div>
            ) : (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, marginBottom:4 }}>📎</div>
                <div style={{ fontSize:12, color:'var(--muted)' }}>নতুন File দিয়ে replace করতে ক্লিক করুন</div>
                <div style={{ fontSize:11, color:'var(--dim)', marginTop:2 }}>বর্তমান: {file.size || '—'}</div>
              </div>
            )}
          </div>

          {/* Progress */}
          {prog > 0 && (
            <div>
              <div style={{ height:5, background:'var(--surface-2)', borderRadius:3, overflow:'hidden', marginBottom:4 }}>
                <div style={{ height:'100%', background:'linear-gradient(90deg,#2563eb,#0891b2)', width:prog+'%', transition:'width .4s', borderRadius:3 }} />
              </div>
              <div style={{ fontSize:11, color:'var(--muted)', textAlign:'right' }}>{prog < 100 ? `${prog}%` : '✅ সম্পন্ন!'}</div>
            </div>
          )}

          {/* Save button */}
          <button onClick={doSave} disabled={busy} style={{ padding:12, borderRadius:10, border:'none', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', fontSize:13, fontWeight:600, cursor:busy?'not-allowed':'pointer', opacity:busy?.6:1 }}>
            {busy ? '⏳ সংরক্ষণ হচ্ছে...' : '✅ Save করুন'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MANAGE ──────────────────────────────────
export function Manage({ files, loadFiles, showToast, pendingFiles = [], isAdmin }) {
  const [editFile, setEditFile] = useState(null)
  const [upNames, setUpNames] = useState({})
  const [pBusy, setPBusy] = useState(null)

  // কে আপলোড করেছে (upload_logs থেকে)
  useEffect(() => {
    if (!pendingFiles.length) return
    let off = false
    ;(async () => {
      try {
        const { data } = await sb.from('upload_logs').select('file_id,user_name,user_email').in('file_id', pendingFiles.map(f => f.id))
        if (!off && data) setUpNames(Object.fromEntries(data.map(l => [l.file_id, l.user_name || l.user_email || ''])))
      } catch {}
    })()
    return () => { off = true }
  }, [pendingFiles.map(f => f.id).join(',')])

  async function approveFile(f) {
    setPBusy(f.id)
    const { error } = await sb.from('files').update({ approved: true }).eq('id', f.id)
    setPBusy(null)
    if (error) { showToast('Approve ব্যর্থ: ' + error.message, 'err'); return }
    await loadFiles()
    showToast('✅ Approve হয়েছে — এখন সবাই দেখতে পাবে')
    try {
      const r = await sendPush({ section: f.section || 'all', title: '📚 নতুন ফাইল আপলোড হয়েছে!', body: `${f.subject || 'নতুন ফাইল'} — ${TYPE_LABELS[f.type] || f.type}`, url: '/?go=all' })
      setTimeout(() => showToast(pushResultText(r), r.ok ? 'ok' : 'err'), 1200)
    } catch {}
  }

  async function rejectFile(f) {
    if (!confirm(`"${f.subject}" ফাইলটি Reject করে মুছে দিতে চান?`)) return
    setPBusy(f.id)
    if (f.storage_path) { try { await deleteFromR2(f.storage_path) } catch {} }
    const { error } = await sb.from('files').delete().eq('id', f.id)
    setPBusy(null)
    if (error) { showToast('Reject ব্যর্থ: ' + error.message, 'err'); return }
    await loadFiles()
    showToast('❌ Reject করা হয়েছে')
  }

  async function onDelete(file) {
    if (!confirm('মুছে দিতে চান?')) return
    if (file.storage_path) {
      try { await deleteFromR2(file.storage_path) } catch {}
    }
    const { error } = await sb.from('files').delete().eq('id', file.id)
    if (error) { showToast('মুছতে ব্যর্থ: ' + error.message, 'err'); return }
    await loadFiles()
    showToast('✅ মুছে দেওয়া হয়েছে')
  }

  async function onSaveEdit(fileId, data) {
    const { error } = await sb.from('files').update(data).eq('id', fileId)
    if (error) { showToast('ব্যর্থ: ' + error.message, 'err'); return }
    await loadFiles()
    showToast('✅ আপডেট হয়েছে')
  }

  const tc = {
    note:      { bg:'rgba(37,99,235,.1)',   color:'var(--c-blue)', label:'নোট'       },
    mid:       { bg:'rgba(5,150,105,.1)',   color:'var(--c-green)', label:'Mid'       },
    final:     { bg:'rgba(217,119,6,.1)',   color:'var(--c-amber)', label:'Final'     },
    suggestion:{ bg:'rgba(124,58,237,.1)',  color:'var(--c-violet)', label:'সাজেশন'   },
    jobsheet:  { bg:'rgba(8,145,178,.1)',   color:'var(--c-cyan)', label:'Job Sheet' },
  }

  return (
    <div>
      {editFile && <FileEditModal file={editFile} onClose={() => setEditFile(null)} onSave={onSaveEdit} />}

      <div style={sh.topbar} className="topbar-r">
        <div><h1 style={sh.h1}>⚙️ ফাইল ম্যানেজ</h1><p style={sh.sub}>সব ফাইল দেখুন, edit ও মুছুন</p></div>
      </div>

      {isAdmin && pendingFiles.length > 0 && (
        <div style={{ marginBottom:16, background:'rgba(217,119,6,.06)', border:'1px solid rgba(217,119,6,.25)', borderRadius:14, overflow:'hidden' }}>
          <div style={{ padding:'11px 14px', fontSize:13, fontWeight:700, color:'var(--c-amber)', borderBottom:'1px solid rgba(217,119,6,.2)' }}>⏳ Pending Approval ({pendingFiles.length})</div>
          {pendingFiles.map(f => (
            <div key={f.id} style={{ padding:'11px 14px', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', borderBottom:'1px solid rgba(217,119,6,.12)' }}>
              <div style={{ flex:1, minWidth:180 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{f.subject}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                  {TYPE_LABELS[f.type] || f.type}{f.section ? ' · Section ' + f.section : ''}{f.size ? ' · ' + f.size : ''}{upNames[f.id] ? ' · 👤 ' + upNames[f.id] : ''}
                </div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => f.file_url && window.open(f.file_url, '_blank', 'noopener')} style={{ padding:'5px 11px', borderRadius:7, fontSize:11, fontWeight:600, background:'rgba(37,99,235,.08)', border:'1px solid rgba(37,99,235,.2)', color:'var(--c-blue)', cursor:'pointer' }}>👁 দেখো</button>
                <button disabled={pBusy===f.id} onClick={() => approveFile(f)} style={{ padding:'5px 11px', borderRadius:7, fontSize:11, fontWeight:600, background:'rgba(5,150,105,.12)', border:'1px solid rgba(5,150,105,.3)', color:'var(--c-green)', cursor:'pointer', opacity: pBusy===f.id ? .5 : 1 }}>✅ Approve</button>
                <button disabled={pBusy===f.id} onClick={() => rejectFile(f)} style={{ padding:'5px 11px', borderRadius:7, fontSize:11, fontWeight:600, background:'rgba(220,38,38,.08)', border:'1px solid rgba(220,38,38,.2)', color:'var(--c-red)', cursor:'pointer', opacity: pBusy===f.id ? .5 : 1 }}>❌ Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:520 }} className="tbl-r tbl-cards">
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {['#','বিষয়','ধরন','ডাউনলোড','তারিখ','অ্যাকশন'].map(h => (
                  <th key={h} style={{ padding:'9px 12px', fontSize:10, color:'var(--dim)', textTransform:'uppercase', letterSpacing:'.6px', textAlign:'left', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {files.length ? files.map((f, i) => {
                const t = tc[f.type] || tc.note
                return (
                  <tr key={f.id} style={{ borderBottom:'1px solid rgba(var(--ov),.03)' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(var(--ov),.02)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'11px 12px', fontSize:12, color:'var(--dim)' }}>{i+1}</td>
                    <td style={{ padding:'11px 12px', fontSize:12, color:'var(--text)', fontWeight:500, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.subject}</td>
                    <td style={{ padding:'11px 12px' }}>
                      <span style={{ padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700, background:t.bg, color:t.color, whiteSpace:'nowrap' }}>{t.label}</span>
                    </td>
                    <td style={{ padding:'11px 12px', fontSize:12, color:'var(--text-4)' }}>{(f.downloads||0).toLocaleString()}</td>
                    <td style={{ padding:'11px 12px', fontSize:12, color:'var(--muted)', whiteSpace:'nowrap' }}>{f.date_str||'—'}</td>
                    <td style={{ padding:'11px 12px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => setEditFile(f)} style={{ padding:'4px 11px', borderRadius:6, fontSize:11, fontWeight:600, background:'rgba(37,99,235,.08)', border:'1px solid rgba(37,99,235,.18)', color:'var(--c-blue)', cursor:'pointer', whiteSpace:'nowrap' }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => onDelete(f)} style={{ padding:'4px 11px', borderRadius:6, fontSize:11, fontWeight:600, background:'rgba(220,38,38,.08)', border:'1px solid rgba(220,38,38,.16)', color:'var(--c-red)', cursor:'pointer', whiteSpace:'nowrap' }}>
                          🗑 মুছুন
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={6} style={{ textAlign:'center', padding:30, color:'var(--dim)', fontSize:13 }}>কোনো ফাইল নেই</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── PROFILE ─────────────────────────────────
// SHA-256 দিয়ে Gravatar URL বানায়
async function getGravatarUrl(email) {
  const clean  = (email || '').trim().toLowerCase()
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clean))
  const hash   = Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2,'0')).join('')
  return `https://www.gravatar.com/avatar/${hash}?s=200&d=404`
}

export function Profile({ user, isAdmin, userProfile, onProfileUpdate, showToast }) {
  const [data,          setData]          = useState(null)
  const [avatar,        setAvatar]        = useState(null)
  const [pushOn,        setPushOn]        = useState(false)
  const [pushLoading,   setPushLoading]   = useState(false)
  const [changingSem,   setChangingSem]   = useState(false)
  const [changingSec,   setChangingSec]   = useState(false)
  const [secBusy,       setSecBusy]       = useState(false)
  const [semBusy,       setSemBusy]       = useState(false)
  const email = user?.email || ''

  useEffect(() => {
    sb.from('users').select('*').eq('id', user.id).single()
      .then(({ data }) => setData(data && data.section === 'C' ? { ...data, section: 'B' } : data))
  }, [user.id])

  useEffect(() => {
    if (!email) return
    let cancelled = false
    getGravatarUrl(email).then(url => {
      if (cancelled) return
      const img = new Image()
      img.onload  = () => { if (!cancelled) setAvatar(url) }
      img.onerror = () => { if (!cancelled) setAvatar(null) }
      img.src = url
    })
    return () => { cancelled = true }
  }, [email])

  // Push subscription check
  useEffect(() => {
    checkPushSubscription().then(setPushOn)
  }, [])

  async function togglePush() {
    setPushLoading(true)
    if (pushOn) {
      await unsubscribePush(user.id)
      setPushOn(false)
    } else {
      const section = data?.section || userProfile?.section || null
      const r = await subscribePush(user.id, section)
      setPushOn(!!r.ok)
      showToast && showToast(r.ok ? '🔔 Notification চালু হয়েছে' : '🔔 ' + r.reason, r.ok ? 'ok' : 'err')
    }
    setPushLoading(false)
  }

  const initials = (data?.name || email || '?').slice(0, 2).toUpperCase()
  const hue      = [...email].reduce((h, c) => h + c.charCodeAt(0), 0) % 360

  async function changeSection(sec) {
    setSecBusy(true)
    const { error } = await sb.from('users').update({ section: sec }).eq('id', user.id)
    if (error) { showToast && showToast('Section বদলাতে ব্যর্থ: ' + error.message, 'err'); setSecBusy(false); return }
    try { await sb.from('push_subscriptions').update({ section: sec }).eq('user_id', user.id) } catch {}
    setData(d => ({ ...d, section: sec }))
    setChangingSec(false); setSecBusy(false)
    showToast && showToast('✅ Section ' + sec + '-এ বদলানো হয়েছে')
    if (onProfileUpdate) onProfileUpdate()
  }

  async function changeSemester(sem) {
    setSemBusy(true)
    const { error } = await sb.from('users').update({ semester: sem }).eq('id', user.id)
    if (error) { alert('Error: ' + error.message); setSemBusy(false); return }
    setData(d => ({ ...d, semester: sem }))
    setChangingSem(false)
    setSemBusy(false)
    if (onProfileUpdate) onProfileUpdate()
  }

  const rows = data ? [
    { label: 'নাম',      val: data.name  || '—' },
    { label: 'Roll',     val: data.roll  || '—' },
    { label: 'Section',  val: data.section ? 'Section ' + data.section : '—' },
    { label: 'Phone',    val: data.phone || '—' },
    { label: 'Gmail',    val: data.email || '—' },
    { label: 'Role',     val: isAdmin ? 'Admin 🔐' : 'Student 👤' },
  ] : []

  return (
    <div>
      <div style={sh.topbar}><div><h1 style={sh.h1}>👤 আমার Profile</h1><p style={sh.sub}>আপনার তথ্য</p></div></div>
      <div style={{ maxWidth: 460 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
          {/* Avatar */}
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            {avatar
              ? <img src={avatar} alt="avatar" style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', border: '3px solid rgba(37,99,235,.4)', boxShadow: '0 4px 16px rgba(37,99,235,.2)' }} />
              : (
                <div style={{ width: 72, height: 72, borderRadius: 18, background: `hsl(${hue},60%,38%)`, border: '3px solid rgba(var(--ov),.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-1px', boxShadow: '0 4px 16px rgba(15,23,42,.25)' }}>
                  {initials}
                </div>
              )
            }
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-strong)' }}>{data?.name || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{email}</div>
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  ...(isAdmin ? { background: 'rgba(37,99,235,.18)', color: 'var(--c-blue)' } : { background: 'rgba(5,150,105,.14)', color: 'var(--c-green)' }) }}>
                  {isAdmin ? '🔐 Admin' : '👤 Student'}
                </span>
              </div>
            </div>
          </div>

          {!data ? <p style={{ color: 'var(--dim)', fontSize: 13 }}>লোড হচ্ছে...</p>
            : rows.map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid rgba(var(--ov),.04)' }}>
                <span style={{ fontSize: 12, color: 'var(--dim)', fontWeight: 500 }}>{r.label}</span>
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{r.val}</span>
              </div>
            ))
          }

          {/* Section Change (সবাই — admin সহ) */}
          <div style={{ marginTop:16, padding:'14px 16px', background:'rgba(var(--ov),.03)', border:'1px solid rgba(var(--ov),.07)', borderRadius:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: changingSec ? 12 : 0 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>🏫 Section</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>বর্তমান: <strong style={{ color:'var(--c-blue)' }}>{data?.section ? 'Section ' + data.section : 'বাছাই করা নেই'}</strong></div>
              </div>
              {!changingSec && (
                <button onClick={() => setChangingSec(true)} style={{ padding:'6px 14px', borderRadius:8, background:'rgba(37,99,235,.1)', border:'1px solid rgba(37,99,235,.25)', color:'var(--c-blue)', fontSize:12, cursor:'pointer', fontWeight:600 }}>পরিবর্তন করুন</button>
              )}
            </div>
            {changingSec && (
              <div>
                <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                  {SECTIONS.map(sec => (
                    <button key={sec} onClick={() => !secBusy && changeSection(sec)} disabled={secBusy || data?.section === sec}
                      style={{ flex:1, padding:'10px', borderRadius:9, cursor: (secBusy || data?.section===sec) ? 'not-allowed' : 'pointer',
                        border:`1.5px solid ${data?.section===sec ? '#2563eb' : 'var(--border)'}`, background: data?.section===sec ? 'rgba(37,99,235,.15)' : 'transparent',
                        color: data?.section===sec ? 'var(--c-blue)' : 'var(--muted)', fontSize:13, fontWeight:600, opacity: secBusy ? .6 : 1 }}>
                      {data?.section===sec ? '✅ ' : ''}Section {sec}
                    </button>
                  ))}
                </div>
                <button onClick={() => setChangingSec(false)} style={{ width:'100%', padding:'8px', background:'transparent', border:'1px solid var(--border)', borderRadius:8, color:'var(--muted)', fontSize:12, cursor:'pointer' }}>বাতিল করুন</button>
              </div>
            )}
          </div>

          {/* Semester Change */}
          {!isAdmin && (
            <div style={{ marginTop:16, padding:'14px 16px', background:'rgba(var(--ov),.03)', border:'1px solid rgba(var(--ov),.07)', borderRadius:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: changingSem ? 12 : 0 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>📚 Semester</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>
                    বর্তমান: <strong style={{ color:'var(--c-blue)' }}>{data?.semester || '4th'} Semester</strong>
                  </div>
                </div>
                {!changingSem && (
                  <button onClick={() => setChangingSem(true)} style={{ padding:'6px 14px', borderRadius:8, background:'rgba(37,99,235,.1)', border:'1px solid rgba(37,99,235,.25)', color:'var(--c-blue)', fontSize:12, cursor:'pointer', fontWeight:600 }}>
                    পরিবর্তন করুন
                  </button>
                )}
              </div>
              {changingSem && (
                <div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginBottom:8 }}>নতুন Semester বেছে নিন:</div>
                  <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                    {['3rd','4th'].map(sem => (
                      <button key={sem} onClick={() => !semBusy && changeSemester(sem)}
                        disabled={semBusy || data?.semester === sem}
                        style={{
                          flex:1, padding:'10px', borderRadius:9, cursor: semBusy || data?.semester===sem ? 'not-allowed' : 'pointer',
                          border:`1.5px solid ${data?.semester===sem ? '#2563eb' : 'var(--border)'}`,
                          background: data?.semester===sem ? 'rgba(37,99,235,.15)' : 'transparent',
                          color: data?.semester===sem ? 'var(--c-blue)' : 'var(--muted)',
                          fontSize:13, fontWeight:600, opacity: semBusy ? .6 : 1,
                        }}>
                        {data?.semester===sem ? '✅ ' : ''}{sem} Semester
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setChangingSem(false)} style={{ width:'100%', padding:'8px', background:'transparent', border:'1px solid var(--border)', borderRadius:8, color:'var(--muted)', fontSize:12, cursor:'pointer' }}>
                    বাতিল করুন
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Push Notification Toggle */}
          <div style={{ marginTop: 18, padding: '14px 16px', background: 'rgba(var(--ov),.03)', border: '1px solid rgba(var(--ov),.07)', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>🔔 Push Notification</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                  {pushOn ? 'নতুন ফাইল ও Homework এর notification পাচ্ছেন' : 'Notification বন্ধ আছে'}
                </div>
                {typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
                  <div style={{ fontSize: 11, color: 'var(--c-red)', marginTop: 4 }}>⚠ ব্রাউজারে block করা — ঠিকানার পাশের 🔒 → Notifications → Allow করুন</div>
                )}
                {isAdmin && (
                  <>
                  <button onClick={async () => {
                      const k = await pushKeyStatus()
                      const diag = !k.fn ? '⚠ Supabase ফাংশনে নতুন কোড deploy হয়নি বা VAPID_PUBLIC_KEY secret নেই' : !k.sub ? '⚠ এই ব্রাউজারে notification চালু নেই' : k.match ? '✅ এই ব্রাউজারের key সার্ভারের সাথে মেলে' : '❌ এই ব্রাউজারের key সার্ভারের সাথে মেলে না — নিচের "🔄 আমার notification রিসেট" চাপুন'
                      const r = await sendPush({ section: 'all', title: '🔔 টেস্ট notification', body: 'Notification ঠিকঠাক কাজ করছে ✅', url: '/' })
                      showToast(diag + ' | ' + pushResultText(r), r.ok && r.sent ? 'ok' : 'err') }}
                    style={{ marginTop: 8, padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(37,99,235,.1)', border: '1px solid rgba(37,99,235,.25)', color: 'var(--c-blue)' }}>🧪 সবাইকে টেস্ট notification পাঠান</button>
                  <button onClick={async () => { const r = await resetPushSubscription(user.id, data?.section || userProfile?.section || null); setPushOn(!!r.ok); showToast(r.ok ? '🔄 নতুন করে চালু হয়েছে' : '🔔 ' + r.reason, (r.ok || r.local) ? 'ok' : 'err') }}
                    style={{ marginTop: 8, marginLeft: 6, padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(217,119,6,.1)', border: '1px solid rgba(217,119,6,.3)', color: 'var(--c-amber)' }}>🔄 আমার notification রিসেট</button>
                  </>
                )}
              </div>
              <button
                onClick={togglePush}
                disabled={pushLoading}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: pushLoading ? 'wait' : 'pointer',
                  background: pushOn ? '#2563eb' : 'var(--border)',
                  position: 'relative', transition: 'background .2s',
                  flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: pushOn ? 24 : 3,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#fff', transition: 'left .2s',
                  display: 'block',
                }} />
              </button>
            </div>
          </div>

          {/* Appearance: theme + design style */}
          <div style={{ marginTop: 18, padding: '14px 16px', background: 'rgba(var(--ov),.03)', border: '1px solid rgba(var(--ov),.07)', borderRadius: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>🎨 Appearance</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', margin: '3px 0 12px' }}>থিম ও design style — শুধু আপনার এই ডিভাইসে প্রযোজ্য</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>থিম</div>
            <ThemeSwitch />
            <div style={{ fontSize: 11, color: 'var(--muted)', margin: '14px 0 6px' }}>Design style</div>
            <StyleSwitch />
            <div style={{ fontSize: 11, color: 'var(--muted)', margin: '14px 0 6px' }}>🎨 রঙ — কাচ, মেনু ও বোতাম এই রঙে সাজবে</div>
            <TintSwitch />
            <ClaritySwitch />
            <WallpaperSection isAdmin={isAdmin} showToast={showToast} />
          </div>
        </div>
      </div>
    </div>
  )
}

function WallpaperSection({ isAdmin, showToast }) {
  const [st] = useStylePref()
  if (!isAdmin || !isWpFamily(st) || !wallpaperAllowed()) return null
  return (
    <>
      <div style={{ fontSize: 11, color: 'var(--muted)', margin: '14px 0 6px' }}>🖼️ Wallpaper</div>
      <WallpaperPicker isAdmin={isAdmin} showToast={showToast} />
    </>
  )
}

// ─── HELPERS ─────────────────────────────────
function InpG({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}

const sh = {
  topbar:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, gap: 14, flexWrap: 'wrap' },
  h1:       { fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-strong)' },
  sub:      { fontSize: 12, color: 'var(--muted)', marginTop: 3 },
  filterRow:{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 },
  fp:       { padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' },
  fpOn:     { background: '#2563eb', borderColor: '#2563eb', color: '#fff', fontWeight: 600 },
  grid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(265px,1fr))', gap: 14 },
  empty:    { gridColumn: '1/-1', textAlign: 'center', padding: 48, color: 'var(--dim)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 12 },
  panel:    { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 22, marginBottom: 20 },
  upGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 },
  dz:       { border: '1.5px dashed var(--border)', borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all .2s', userSelect: 'none' },
  dzDrag:   { borderColor: '#2563eb', background: 'rgba(37,99,235,.04)' },
  inp:      { padding: '10px 13px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%' },
}

// ─── COMPLETE PROFILE (Forced screen for incomplete accounts) ─────────────────
export function CompleteProfile({ user, showToast, onDone }) {
  const [roll,     setRoll]     = useState('')
  const [phone,    setPhone]    = useState('')
  const [semester, setSemester] = useState('')
  const [busy,     setBusy]     = useState(false)
  const [errors,   setErrors]   = useState({})

  async function save() {
    const errs = {}
    const cleanRoll = toBengaliToEnglishNum(roll.trim())
    const section   = rollToSection(cleanRoll)
    if (!cleanRoll)    errs.roll     = 'Roll দিন'
    else if (!section) errs.roll     = 'Roll সঠিক নয় (263298–271149)'
    if (!phone.trim()) errs.phone    = 'ফোন দিন'
    else if (!/^01[3-9]\d{8}$/.test(phone.trim())) errs.phone = 'সঠিক নম্বর দিন'
    if (!semester)     errs.semester = 'Semester বেছে নিন'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setBusy(true)
    const { error } = await sb.from('users').upsert({
      id:    user.id,
      email: user.email,
      roll:  cleanRoll,
      phone: phone.trim(),
      section,
      semester,
      role:  'student',
      created_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    if (error) {
      alert('Save error: ' + error.message + '\nCode: ' + error.code)
      setBusy(false)
      return
    }
    onDone()
  }

  const detectedSection = rollToSection(toBengaliToEnglishNum(roll))

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:420, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:20, padding:'36px 32px', boxShadow:'0 24px 80px rgba(0,0,0,.6)' }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:36, marginBottom:10 }}>⚠️</div>
          <h2 style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text-strong)', marginBottom:6 }}>Profile সম্পন্ন করুন</h2>
          <p style={{ fontSize:12, color:'var(--muted)' }}>আপনার Roll নম্বর ও ফোন নম্বর ছাড়া পোর্টাল ব্যবহার করা যাবে না।</p>
        </div>

        {/* Roll */}
        <div style={{ marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <label style={{ fontSize:11, color:'var(--text-4)', fontWeight:500 }}>Roll নম্বর *</label>
            {errors.roll && <span style={{ fontSize:10, color:'var(--c-red)', fontWeight:600 }}>⚠ {errors.roll}</span>}
          </div>
          <input
            value={roll}
            onChange={e => { setRoll(toBengaliToEnglishNum(e.target.value)); setErrors(p=>({...p,roll:''})) }}
            placeholder="263298–271149"
            style={{ width:'100%', padding:'11px 14px', background: errors.roll ? 'rgba(220,38,38,.05)' : 'var(--surface-2)', border:`1px solid ${errors.roll ? '#ef4444' : 'var(--border)'}`, borderRadius:10, color:'var(--text)', fontSize:13, outline:'none' }}
          />
          {roll && (
            <div style={{ marginTop:7, padding:'7px 11px', borderRadius:7, fontSize:11,
              background: detectedSection ? 'rgba(37,99,235,.08)' : 'rgba(220,38,38,.08)',
              border: `1px solid ${detectedSection ? 'rgba(37,99,235,.2)' : 'rgba(220,38,38,.2)'}`,
              color: detectedSection ? 'var(--c-blue)' : 'var(--c-red)',
            }}>
              {detectedSection ? `✅ Section ${detectedSection} (Auto-detect)` : '❌ Roll সীমার মধ্যে নেই'}
            </div>
          )}
        </div>

        {/* Phone */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
            <label style={{ fontSize:11, color:'var(--text-4)', fontWeight:500 }}>ফোন নম্বর *</label>
            {errors.phone && <span style={{ fontSize:10, color:'var(--c-red)', fontWeight:600 }}>⚠ {errors.phone}</span>}
          </div>
          <input
            value={phone}
            onChange={e => { setPhone(e.target.value); setErrors(p=>({...p,phone:''})) }}
            placeholder="01XXXXXXXXX"
            type="tel"
            style={{ width:'100%', padding:'11px 14px', background: errors.phone ? 'rgba(220,38,38,.05)' : 'var(--surface-2)', border:`1px solid ${errors.phone ? '#ef4444' : 'var(--border)'}`, borderRadius:10, color:'var(--text)', fontSize:13, outline:'none' }}
          />
        </div>

        {/* Semester select */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <label style={{ fontSize:11, color:'var(--text-4)', fontWeight:500 }}>Semester *</label>
            {errors.semester && <span style={{ fontSize:10, color:'var(--c-red)', fontWeight:600 }}>⚠ {errors.semester}</span>}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {['3rd','4th'].map(sem => (
              <button key={sem} type="button"
                onClick={() => { setSemester(sem); setErrors(p=>({...p,semester:''})) }}
                style={{
                  flex:1, padding:'11px', borderRadius:10, cursor:'pointer',
                  border:`1.5px solid ${semester===sem ? '#2563eb' : (errors.semester ? '#ef4444' : 'var(--border)')}`,
                  background: semester===sem ? 'rgba(37,99,235,.12)' : 'transparent',
                  color: semester===sem ? 'var(--c-blue)' : 'var(--muted)',
                  fontSize:13, fontWeight: semester===sem ? 700 : 400, transition:'all .15s',
                }}>
                {semester===sem ? '✅ ' : ''}{sem} Semester
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={save}
          disabled={busy}
          style={{ width:'100%', padding:12, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:10, color:'#fff', fontSize:14, fontWeight:600, cursor: busy ? 'wait' : 'pointer', opacity: busy ? .6 : 1 }}
        >
          {busy ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন ও প্রবেশ করুন'}
        </button>

        <button
          onClick={() => sb.auth.signOut()}
          style={{ width:'100%', marginTop:10, padding:'10px', background:'transparent', border:'1px solid var(--border)', borderRadius:10, color:'var(--muted)', fontSize:13, cursor:'pointer' }}
        >
          লগআউট
        </button>
      </div>
    </div>
  )
}

// ─── GUEST FILE VIEW (Share link দিয়ে আসলে দেখাবে) ──────────────
export function GuestFileView({ file, showToast }) {
  const [showLogin, setShowLogin] = useState(false)

  if (!file) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', color:'var(--muted)', flexDirection:'column', gap:12 }}>
      <div style={{ fontSize:40 }}>🔍</div>
      <p style={{ fontSize:14 }}>ফাইলটি পাওয়া যায়নি</p>
      <button onClick={() => window.location.href='/'} style={{ padding:'10px 20px', background:'#2563eb', border:'none', borderRadius:10, color:'#fff', cursor:'pointer', fontSize:13 }}>
        হোমে যান
      </button>
    </div>
  )

  const type   = file.type || 'note'
  const colors = {
    note: '#2563eb', mid: '#059669', final: '#d97706', suggestion: '#7c3aed', jobsheet: '#0891b2'
  }
  const fileId   = file.storage_path
  const isR2File = fileId && fileId.startsWith('files/')
  const isDrive  = fileId && !isR2File
  const embedUrl = isR2File
    ? file.file_url
    : isDrive
      ? `https://drive.google.com/file/d/${fileId}/preview`
      : `https://docs.google.com/viewer?url=${encodeURIComponent(file.file_url)}&embedded=true`

  return (
    <div style={{ minHeight:'100vh', background:'transparent', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontSize:24 }}>📚</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-strong)' }}>{file.subject}</div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>CST 4th Semester Portal</div>
          </div>
        </div>
        <button
          onClick={() => setShowLogin(true)}
          style={{ padding:'9px 16px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:10, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}
        >🔐 Login / Register</button>
      </div>

      {/* File info bar */}
      <div style={{ background:'rgba(37,99,235,.06)', borderBottom:'1px solid rgba(37,99,235,.12)', padding:'10px 20px', display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:11, fontWeight:700, color: colors[type] || 'var(--c-blue)', textTransform:'uppercase' }}>{TYPE_LABELS[type] || type}</span>
        {file.section && <span style={{ fontSize:11, color:'var(--muted)' }}>Section {file.section}</span>}
        <span style={{ fontSize:11, color:'var(--muted)' }}>⬇ {(file.downloads||0).toLocaleString()} ডাউনলোড</span>
        <span style={{ fontSize:11, color:'var(--muted)' }}>{file.date_str || ''}</span>
        <div style={{ marginLeft:'auto' }}>
          <button
            onClick={() => setShowLogin(true)}
            style={{ padding:'7px 16px', background:'linear-gradient(135deg,#059669,#047857)', border:'none', borderRadius:8, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}
          >⬇ ডাউনলোড করুন</button>
        </div>
      </div>

      {/* Preview */}
      <div style={{ flex:1, padding:'16px 20px', position:'relative' }}>
        <div style={{ width:'100%', height:'calc(100vh - 160px)', background:'var(--surface)', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)', position:'relative' }}>
          <iframe
            src={embedUrl}
            style={{ width:'100%', height:'100%', border:'none' }}
            title={file.subject}
            allowFullScreen
          />
          {/* Download blur overlay */}
          <div style={{
            position:'absolute', bottom:0, left:0, right:0, height:180,
            background:'linear-gradient(to top, var(--bg) 30%, transparent)',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', paddingBottom:24, gap:10,
          }}>
            <p style={{ fontSize:12, color:'var(--text-3)', margin:0 }}>ডাউনলোড করতে Login করুন</p>
            <button
              onClick={() => setShowLogin(true)}
              style={{ padding:'11px 28px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:12, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 20px rgba(37,99,235,.4)' }}
            >🔐 Login / রেজিস্ট্রেশন করুন</button>
          </div>
        </div>
      </div>

      {/* Login Modal */}
      {showLogin && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setShowLogin(false)}>
          <div style={{ width:'100%', maxWidth:380, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:20, padding:'32px 28px', textAlign:'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔐</div>
            <h3 style={{ fontSize:'1rem', fontWeight:700, color:'var(--text-strong)', marginBottom:8 }}>Login করুন</h3>
            <p style={{ fontSize:12, color:'var(--muted)', marginBottom:22, lineHeight:1.6 }}>
              ফাইলটি ডাউনলোড করতে আপনার CST Portal অ্যাকাউন্টে লগইন করুন।<br/>
              অ্যাকাউন্ট না থাকলে বিনামূল্যে রেজিস্ট্রেশন করুন।
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button
                onClick={() => window.location.href = '/'}
                style={{ flex:1, padding:'11px', borderRadius:10, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}
              >🔐 Login / Register</button>
              <button
                onClick={() => setShowLogin(false)}
                style={{ padding:'11px 16px', borderRadius:10, background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', fontSize:13, cursor:'pointer' }}
              >✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── GUEST HOMEWORK VIEW ───────────────────────────────────────────────────────
export function GuestHwView({ hwId, batchId, day, sec, loggedIn }) {
  const [hws,       setHws]       = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    const q = day
      ? (() => { let x = sb.from('homeworks').select('*').gte('created_at', day + 'T00:00:00+06:00').lt('created_at', new Date(new Date(day + 'T00:00:00+06:00').getTime() + 864e5).toISOString()).order('created_at', { ascending: true }); return sec ? x.eq('section', sec) : x })()
      : batchId
      ? sb.from('homeworks').select('*').eq('questions->>batch', batchId).order('created_at', { ascending: true })
      : sb.from('homeworks').select('*').eq('id', hwId)
    q.then(({ data }) => { setHws(normRows(data || [])); setLoading(false) })
  }, [hwId, batchId, day, sec])

  const Q_TYPES = [
    { value: 'vsq',   label: 'অতি সংক্ষিপ্ত',  color: 'var(--c-green)', bg: 'rgba(5,150,105,.1)',   border: 'rgba(5,150,105,.25)'  },
    { value: 'sq',    label: 'সংক্ষিপ্ত',        color: 'var(--c-blue)', bg: 'rgba(37,99,235,.1)',  border: 'rgba(37,99,235,.25)'  },
    { value: 'essay', label: 'রচনা',              color: 'var(--c-amber)', bg: 'rgba(217,119,6,.1)',  border: 'rgba(217,119,6,.25)'  },
  ]

  const scColors = { A: { color:'var(--c-green)', bg:'rgba(5,150,105,.1)' }, B: { color:'var(--c-blue)', bg:'rgba(37,99,235,.1)' }, C: { color:'var(--c-violet)', bg:'rgba(124,58,237,.1)' } }
  const renderCard = (hw) => {
  if (isClassWork(hw)) return <ClassWorkCard hw={hw} canDelete={false} />
  const sc = scColors[hw.section] || { color:'var(--text-3)', bg:'rgba(var(--ov),.05)' }

  const due = hw.due_date ? new Date(hw.due_date) : null
  const daysLeft = due ? Math.ceil((due - new Date()) / 86400000) : null
  const dueText = daysLeft === null ? '' : daysLeft < 0 ? `${Math.abs(daysLeft)} দিন আগে` : daysLeft === 0 ? 'আজকে!' : `${daysLeft} দিন বাকি`
  const dueColor = daysLeft === null ? 'var(--text-4)' : daysLeft <= 0 ? 'var(--c-red)' : daysLeft <= 3 ? 'var(--c-amber)' : 'var(--c-green)'

  const hasQuestions = !!hw.questions && typeof hw.questions === 'object' && !Array.isArray(hw.questions)

    return (
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderLeft:`3px solid ${sc.color}`, borderRadius:12, padding:20 }}>

            {/* Tags row */}
            <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:14 }}>
              <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:6, background:sc.bg, color:sc.color }}>
                Section {hw.section}
              </span>
              {hw.chapter && (
                <span style={{ fontSize:11, padding:'3px 10px', borderRadius:6, background:'rgba(var(--ov),.05)', color:'var(--text-3)' }}>
                  📖 {hw.chapter}
                </span>
              )}
              {hw.page_numbers && (
                <span style={{ fontSize:11, padding:'3px 10px', borderRadius:6, background:'rgba(var(--ov),.05)', color:'var(--text-3)' }}>
                  📄 পৃষ্ঠা: {hw.page_numbers}
                </span>
              )}
              {hw.work_type && (
                <span style={{ fontSize:11, padding:'3px 10px', borderRadius:6, background:'rgba(124,58,237,.1)', color:'var(--c-violet)' }}>
                  {HW_TYPES.find(t => t.value === hw.work_type)?.label || hw.work_type}
                </span>
              )}
              {due && (
                <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:6, background:`color-mix(in srgb, ${dueColor} 10%, transparent)`, color:dueColor }}>
                  📅 {hw.due_date} {dueText && `(${dueText})`}
                </span>
              )}
            </div>

            {/* Subject */}
            <h2 style={{ fontSize:16, fontWeight:700, color:'var(--text-strong)', marginBottom:14 }}>{hw.subject}</h2>

            {/* Note */}
            {hw.note && (
              <div style={{ padding:'10px 14px', background:'rgba(124,58,237,.06)', border:'1px solid rgba(124,58,237,.15)', borderRadius:9, marginBottom:14, fontSize:13, color:'var(--text-2)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--c-violet)', marginBottom:3 }}>💬 শিক্ষকের নোট</div>
                {hw.note}
              </div>
            )}

            {/* ছবি / ফাইল */}
            {hasQuestions && (hw.questions.images || []).length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', marginBottom:6 }}>🖼 ছবি / ফাইল</div>
                <ClassWorkFiles files={hw.questions.images} />
              </div>
            )}

            {/* Questions */}
            {hasQuestions && Q_TYPES.map(qt => {
              const nums = hw.questions[qt.value] || []
              if (!nums.length) return null
              return (
                <div key={qt.value} style={{ marginBottom:12, padding:'10px 14px', background:qt.bg, border:`1px solid ${qt.border}`, borderRadius:9 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:qt.color, marginBottom:8 }}>{qt.label} — {nums.length} টি</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {nums.map(n => (
                      <span key={n} style={{ fontSize:12, fontWeight:600, padding:'3px 10px', borderRadius:6, background:'rgba(var(--ov),.08)', color:'var(--text)' }}>{n}</span>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Sessional */}
            {hasQuestions && (Object.values(hw.questions.sessional || {}).some(v => Array.isArray(v) && v.length) || hw.questions.sign_date) && (
              <div style={{ marginBottom:12, padding:'10px 14px', border:'1px solid rgba(124,58,237,.25)', background:'rgba(124,58,237,.05)', borderRadius:9 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--c-violet)', marginBottom:8 }}>📒 Sessional Work</div>
                {Q_TYPES.map(qt => {
                  const nums = (hw.questions.sessional || {})[qt.value] || []
                  if (!nums.length) return null
                  return (
                    <div key={qt.value} style={{ marginBottom:8 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:qt.color, marginBottom:5 }}>{qt.label} — {nums.length} টি</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {nums.map(n => <span key={n} style={{ fontSize:12, fontWeight:600, padding:'3px 10px', borderRadius:6, background:'rgba(var(--ov),.08)', color:'var(--text)' }}>{n}</span>)}
                      </div>
                    </div>
                  )
                })}
                {hw.questions.sign_date && <div style={{ fontSize:12, color:'var(--c-amber)', fontWeight:600 }}>✍️ সাইন করার শেষ তারিখ: {hw.questions.sign_date}</div>}
              </div>
            )}

          </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'transparent', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:22 }}>📚</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-strong)' }}>CST Portal</div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>Homework</div>
          </div>
        </div>
        {loggedIn ? (
          <button onClick={() => { window.location.href = '/' }} style={{ padding:'9px 16px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:10, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            🏠 পোর্টালে যান
          </button>
        ) : (
        <button onClick={() => setShowLogin(true)} style={{ padding:'9px 16px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:10, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
          🔐 Login
        </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex:1, padding:20, maxWidth:640, margin:'0 auto', width:'100%' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:60, color:'var(--muted)' }}>লোড হচ্ছে...</div>
        ) : !hws.length ? (
          <div style={{ textAlign:'center', padding:60, color:'var(--muted)' }}>Homework পাওয়া যায়নি</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {hws.length > 1 && <div style={{ fontSize:12, fontWeight:700, color:'var(--c-blue)' }}>📚 Homework + Class Work একসাথে ({hws.length}টি)</div>}
            {hws.map(h => <div key={h.id}>{renderCard(h)}</div>)}
            {/* Login CTA */}
            {!loggedIn && <div style={{ marginTop:18, padding:'14px 16px', background:'rgba(37,99,235,.06)', border:'1px solid rgba(37,99,235,.15)', borderRadius:10, textAlign:'center' }}>
              <p style={{ fontSize:12, color:'var(--c-blue2)', marginBottom:10 }}>✅ Done mark করতে বা সব Homework দেখতে Login করুন</p>
              <button onClick={() => setShowLogin(true)} style={{ padding:'10px 24px', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', borderRadius:10, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                🔐 Login / Register
              </button>
            </div>}
          </div>
        )}
      </div>

      {/* Login Modal */}
      {showLogin && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setShowLogin(false)}>
          <div style={{ width:'100%', maxWidth:380, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:20, padding:'32px 28px', textAlign:'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔐</div>
            <h3 style={{ fontSize:'1rem', fontWeight:700, color:'var(--text-strong)', marginBottom:8 }}>Login করুন</h3>
            <p style={{ fontSize:12, color:'var(--muted)', marginBottom:22 }}>সব Homework দেখতে ও Done mark করতে Login করুন।</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => window.location.href='/'} style={{ flex:1, padding:'11px', borderRadius:10, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                🔐 Login / Register
              </button>
              <button onClick={() => setShowLogin(false)} style={{ padding:'11px 16px', borderRadius:10, background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', fontSize:13, cursor:'pointer' }}>✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
