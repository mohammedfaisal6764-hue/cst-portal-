import React from 'react'

// Class Work row = homeworks table row, যার questions.kind === 'classwork'
export const isLabWork = (hw) =>
  !!hw && !!hw.questions && !Array.isArray(hw.questions) && hw.questions.kind === 'labwork'
// Class Work ও Lab Work — দুটোই একই ধরনের কার্ড (ছবি/ফাইল + নোট)
export const isClassWork = (hw) =>
  !!hw && !!hw.questions && !Array.isArray(hw.questions) && (hw.questions.kind === 'classwork' || hw.questions.kind === 'labwork')

const isImg = (f) => (f.type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(f.name || f.url || '')

// ছবি thumbnail + PDF chip
export function ClassWorkFiles({ files = [] }) {
  const [view, setView] = React.useState(null)
  if (!files.length) return <div style={{ fontSize: 12, color: 'var(--muted)' }}>কোনো ফাইল নেই</div>
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {files.map((f, i) => isImg(f) ? (
          <img key={i} src={f.url} alt={f.name} onClick={() => setView(f.url)} loading="lazy"
            style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 9, border: '1px solid var(--border)', cursor: 'zoom-in', background: 'var(--surface-2)' }} />
        ) : (
          <a key={i} href={f.url} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderRadius: 9, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: 'var(--c-red2)', fontSize: 12, fontWeight: 600, textDecoration: 'none', maxWidth: 220 }}>
            📄 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || 'PDF'}</span>
          </a>
        ))}
      </div>
      {view && (
        <div onClick={() => setView(null)} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, cursor: 'zoom-out' }}>
          <img src={view} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
          <a href={view} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', top: 14, right: 14, padding: '8px 14px', borderRadius: 8, background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>⬇ খুলুন / ডাউনলোড</a>
        </div>
      )}
    </>
  )
}

// গ্রুপ/তালিকায় দেখানোর Class Work card
export function ClassWorkCard({ hw, canDelete, onDelete, onEdit }) {
  const files = hw.questions?.files || []
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${isLabWork(hw) ? '#14b8a6' : '#f59e0b'}`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {isLabWork(hw)
          ? <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: 'rgba(20,184,166,.1)', border: '1px solid rgba(20,184,166,.3)', color: '#14b8a6' }}>🧪 Lab Work</span>
          : <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', color: 'var(--c-amber)' }}>🏫 Class Work</span>}
        <span style={{ fontSize: 10, color: 'var(--text-4)' }}>Section {hw.section}</span>
        {hw.chapter && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, background: 'rgba(var(--ov),.05)', color: 'var(--text-3)' }}>📖 {hw.chapter}</span>}
        {hw.created_at && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{new Date(hw.created_at).toLocaleDateString('bn-BD')}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => {
              const url = window.location.origin + '/?hw=' + hw.id
              if (navigator.share) navigator.share({ title: hw.subject, url }).catch(() => {})
              else navigator.clipboard.writeText(url).then(() => alert('✅ লিংক কপি হয়েছে!'))
            }}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }} title="শেয়ার">🔗</button>
          {onEdit && <button onClick={() => onEdit(hw)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }} title="এডিট">✏️</button>}
          {canDelete && <button onClick={() => onDelete(hw.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }} title="মুছুন">🗑</button>}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{hw.subject?.split(' - ')[1] || hw.subject}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>{hw.subject?.split(' - ')[0]}</div>
      {(files.length > 0 || !hw.note) && <ClassWorkFiles files={files} />}
      {hw.note && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-2)', background: 'rgba(124,58,237,.06)', border: '1px solid rgba(124,58,237,.15)', borderRadius: 8, padding: '7px 10px' }}>💬 {hw.note}</div>}
    </div>
  )
}
