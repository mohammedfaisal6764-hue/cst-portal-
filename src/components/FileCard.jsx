import { useState } from 'react'
import { TYPE_LABELS } from '../supabase'

// ── Job Sheet Date Modal ──────────────────────────────────────
function DateModal({ file, onClose }) {
  const [section, setSection] = useState(null)

  const parts = {}
  ;(file.description || '').split(' | ').forEach(p => {
    const [k, ...v] = p.split(': ')
    if (k && v.length) parts[k.trim()] = v.join(': ').trim()
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.85)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '18px 18px 0 0', padding: '20px 20px 36px',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>📅 তারিখ দেখুন</h3>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{file.subject}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {!section ? (
          // Section selection
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginBottom: 16 }}>
              আপনার Section বেছে নিন
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { id: 'A', color: 'var(--c-green)', bg: 'rgba(16,185,129,.08)', border: 'rgba(16,185,129,.25)' },
                { id: 'B', color: 'var(--c-blue)', bg: 'rgba(37,99,235,.08)', border: 'rgba(37,99,235,.25)' },
              ].map(s => (
                <button key={s.id} onClick={() => setSection(s.id)} style={{
                  padding: '22px 16px', borderRadius: 14, cursor: 'pointer',
                  border: `1.5px solid ${s.border}`,
                  background: s.bg,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'all .2s',
                }}>
                  <span style={{ fontSize: 30 }}>🏫</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>Section {s.id}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Date display
          <div>
            <button onClick={() => setSection(null)} style={{
              background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
              borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
              marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6,
            }}>← সব Section</button>

            <div style={{
              background: section === 'A' ? 'rgba(16,185,129,.06)' : section === 'B' ? 'rgba(37,99,235,.06)' : 'rgba(124,58,237,.06)',
              border: `1px solid ${section === 'A' ? 'rgba(16,185,129,.2)' : section === 'B' ? 'rgba(37,99,235,.2)' : 'rgba(124,58,237,.2)'}`,
              borderRadius: 14, padding: '20px 18px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: section === 'A' ? 'var(--c-green)' : section === 'B' ? 'var(--c-blue)' : 'var(--c-violet)', marginBottom: 16 }}>
                🏫 Section {section}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Exp Date',    val: parts[`Exp-${section}`],    icon: '📅' },
                  { label: 'Submit Date', val: parts[`Submit-${section}`], icon: '✅' },
                ].map(item => (
                  <div key={item.label} style={{
                    background: 'rgba(var(--ob),.2)', borderRadius: 10, padding: '14px 12px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 18, marginBottom: 6 }}>{item.icon}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: section === 'A' ? 'var(--c-green2)' : section === 'B' ? 'var(--c-blue2)' : 'var(--c-violet2)' }}>
                      {item.val && item.val !== '—' ? item.val : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PDF Preview Modal ────────────────────────────────────────
function PreviewModal({ file, onClose }) {
  const [loaded, setLoaded] = useState(false)
  const fileId    = file.storage_path
  const isR2File  = fileId && fileId.startsWith('files/')
  const isDrive   = fileId && !isR2File

  // R2 file → direct iframe (PDF browser built-in viewer)
  // Drive file → Google Drive preview
  // fallback → Google Docs viewer
  const embedUrl = isR2File
    ? file.file_url
    : isDrive
      ? `https://drive.google.com/file/d/${fileId}/preview`
      : `https://docs.google.com/viewer?url=${encodeURIComponent(file.file_url)}&embedded=true`

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.92)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '12px',
      paddingTop:    'max(12px, env(safe-area-inset-top))',
      paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
    }}>
      {/* Header */}
      <div style={{
        width: '100%', maxWidth: 820,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10, gap: 10,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          📄 {file.subject}
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(220,38,38,.15)', border: '1px solid rgba(220,38,38,.3)',
          color: 'var(--c-red)', borderRadius: 8, padding: '6px 16px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
        }}>✕ বন্ধ</button>
      </div>

      {/* Viewer */}
      <div style={{
        width: '100%', maxWidth: 820,
        background: 'var(--surface-2)', borderRadius: 12, overflow: 'hidden',
        border: '1px solid var(--border)',
        height: 'calc(100vh - 110px)',
        position: 'relative',
      }}>
        {/* Loading overlay */}
        {!loaded && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 2,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 14,
            background: 'var(--surface-2)',
          }}>
            <div style={{
              width: 40, height: 40,
              border: '3px solid rgba(37,99,235,.2)',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'spin .7s linear infinite',
            }} />
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>ফাইল লোড হচ্ছে...</p>
            <p style={{ fontSize: 11, color: 'var(--dim)' }}>একটু অপেক্ষা করুন</p>
          </div>
        )}
        <iframe
          src={embedUrl}
          style={{ width: '100%', height: '100%', border: 'none', opacity: loaded ? 1 : 0, transition: 'opacity .3s' }}
          title={file.subject}
          allow="autoplay"
          allowFullScreen
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  )
}

// ── Analytics Modal (Admin) ───────────────────────────────────
function AnalyticsModal({ file, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 24, width: '100%', maxWidth: 400,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>📊 Download Analytics</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'rgba(37,99,235,.08)', border: '1px solid rgba(37,99,235,.15)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>ফাইলের নাম</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{file.subject}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'rgba(5,150,105,.08)', border: '1px solid rgba(5,150,105,.15)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--c-green)' }}>{(file.downloads || 0).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>মোট ডাউনলোড</div>
            </div>
            <div style={{ background: 'rgba(217,119,6,.08)', border: '1px solid rgba(217,119,6,.15)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-amber)' }}>{file.size || '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>ফাইল সাইজ</div>
            </div>
          </div>
          <div style={{ background: 'rgba(var(--ov),.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>আপলোডের তারিখ</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{file.date_str || '—'}</div>
          </div>
          {file.section && (
            <div style={{ background: 'rgba(var(--ov),.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Section</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>Section {file.section}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Login Gate Modal ─────────────────────────────────────────
function LoginGateModal({ onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '32px 28px', textAlign: 'center',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)', marginBottom: 8 }}>
          ডাউনলোড করতে Login করুন
        </h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 22, lineHeight: 1.6 }}>
          ফাইলটি ডাউনলোড করতে আপনার CST Portal অ্যাকাউন্টে লগইন করতে হবে।<br/>
          অ্যাকাউন্ট না থাকলে বিনামূল্যে রেজিস্ট্রেশন করুন।
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { onClose(); window.location.href = '/' }}
            style={{
              flex: 1, padding: '11px', borderRadius: 10,
              background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >🔐 লগইন / রেজিস্ট্রেশন</button>
          <button
            onClick={onClose}
            style={{
              padding: '11px 16px', borderRadius: 10,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--muted)', fontSize: 13, cursor: 'pointer',
            }}
          >✕</button>
        </div>
      </div>
    </div>
  )
}

// ── Main FileCard ─────────────────────────────────────────────
export default function FileCard({ file, isAdmin, onDownload, onDelete, isGuest }) {
  const [showPreview,   setShowPreview]   = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showDate,      setShowDate]      = useState(false)
  const [showLoginGate, setShowLoginGate] = useState(false)

  function handleDownload() {
    if (isGuest) { setShowLoginGate(true); return }
    onDownload(file)
  }

  function handleShare() {
    const url = `${window.location.origin}/?file=${file.id}`
    if (navigator.share) {
      navigator.share({ title: file.subject, url })
    } else {
      navigator.clipboard.writeText(url)
        .then(() => alert('✅ লিংক কপি হয়েছে!'))
    }
  }

  const type  = file.type || 'note'
  const label = TYPE_LABELS[type] || 'নোট'
  const ico   = type === 'note' ? '📄' : type === 'mid' ? '📘' : type === 'final' ? '🏆' : type === 'jobsheet' ? '📋' : '💡'

  const colors = {
    note:      { border: '#2563eb', ico: 'rgba(37,99,235,.14)',  type: 'var(--c-blue)', dl: 'rgba(37,99,235,.1)',  dlBorder: 'rgba(37,99,235,.2)',  dlHover: '#2563eb', dlHoverText: '#fff' },
    mid:       { border: '#059669', ico: 'rgba(5,150,105,.13)',  type: 'var(--c-green)', dl: 'rgba(5,150,105,.1)',  dlBorder: 'rgba(5,150,105,.2)',  dlHover: '#059669', dlHoverText: '#fff' },
    final:     { border: '#d97706', ico: 'rgba(217,119,6,.12)',  type: 'var(--c-amber)', dl: 'rgba(217,119,6,.1)',  dlBorder: 'rgba(217,119,6,.2)',  dlHover: '#d97706', dlHoverText: '#000' },
    suggestion:{ border: '#7c3aed', ico: 'rgba(124,58,237,.12)', type: 'var(--c-violet)', dl: 'rgba(124,58,237,.1)', dlBorder: 'rgba(124,58,237,.2)', dlHover: '#7c3aed', dlHoverText: '#fff' },
    jobsheet:  { border: '#0891b2', ico: 'rgba(8,145,178,.13)',  type: 'var(--c-cyan)', dl: 'rgba(8,145,178,.1)',  dlBorder: 'rgba(8,145,178,.2)',  dlHover: '#0891b2', dlHoverText: '#fff' },
  }
  const c = colors[type] || colors.note

  return (
    <>
      {showPreview   && <PreviewModal   file={file} onClose={() => setShowPreview(false)}   />}
      {showAnalytics && <AnalyticsModal file={file} onClose={() => setShowAnalytics(false)} />}
      {showDate      && <DateModal      file={file} onClose={() => setShowDate(false)}      />}
      {showLoginGate && <LoginGateModal             onClose={() => setShowLoginGate(false)} />}

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderTop: `3px solid ${c.border}`,
        borderRadius: 14, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        transition: 'transform .22s, box-shadow .22s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 12px 36px rgba(15,23,42,.3)' }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}
      >
        {/* TOP */}
        <div style={{ padding: '14px 14px 10px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: c.ico, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{ico}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: c.type }}>{label}</div>
              {file.section && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: 'rgba(var(--ov),.08)', color: 'var(--text-4)' }}>
                  Section {file.section}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)', lineHeight: 1.35 }}>{file.subject}</div>
          </div>
          {isAdmin && (
            <button onClick={() => setShowAnalytics(true)} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 15, cursor: 'pointer', padding: 2, flexShrink: 0, transition: 'color .2s' }}
              onMouseEnter={e => e.currentTarget.style.color='var(--c-blue)'}
              onMouseLeave={e => e.currentTarget.style.color='var(--dim)'}
            >📊</button>
          )}
        </div>

        {/* BODY */}
        <div style={{ padding: '0 14px 12px', flex: 1 }}>
          {/* Job Sheet — শুধু Job No ও Name দেখাবে, date button এ */}
          {file.type === 'jobsheet' && file.description && (() => {
            const parts = {}
            file.description.split(' | ').forEach(p => {
              const [k, ...v] = p.split(': ')
              if (k && v.length) parts[k.trim()] = v.join(': ').trim()
            })
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                {[['Job No', parts['Job No']], ['Job Name', parts['Job Name']]].map(([label, val]) =>
                  val && val !== '—' ? (
                    <div key={label} style={{ background: 'rgba(8,145,178,.07)', border: '1px solid rgba(8,145,178,.12)', borderRadius: 7, padding: '5px 8px' }}>
                      <div style={{ fontSize: 9, color: '#0891b2', fontWeight: 700, marginBottom: 1 }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>{val}</div>
                    </div>
                  ) : null
                )}
              </div>
            )
          })()}
          {file.type !== 'jobsheet' && file.description && (
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 8 }}>{file.description}</p>
          )}
          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--dim)', flexWrap: 'wrap' }}>
            <span>⬇ {(file.downloads || 0).toLocaleString()}</span>
            <span>{file.size || '—'}</span>
            <span>{file.date_str || ''}</span>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(var(--ov),.04)', display: 'flex', gap: 7, flexWrap: 'nowrap' }}>
          {/* তারিখ দেখুন — শুধু Job Sheet এ */}
          {type === 'jobsheet' && (
            <button onClick={() => setShowDate(true)} style={{
              padding: '8px 10px', borderRadius: 9,
              border: '1px solid rgba(8,145,178,.25)',
              background: 'rgba(8,145,178,.08)', color: 'var(--c-cyan)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
              display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(8,145,178,.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(8,145,178,.08)' }}
            >📅 তারিখ</button>
          )}
          <button onClick={() => setShowPreview(true)} style={{
            padding: '8px 10px', borderRadius: 9,
            border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(var(--ov),.05)'; e.currentTarget.style.color='var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--muted)' }}
          >দেখুন</button>

          <button onClick={handleDownload} style={{
            flex: 1, padding: 8, borderRadius: 9,
            border: `1px solid ${c.dlBorder}`, background: c.dl, color: c.type,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
          onMouseEnter={e => { e.currentTarget.style.background=c.dlHover; e.currentTarget.style.color=c.dlHoverText; e.currentTarget.style.borderColor=c.dlHover }}
          onMouseLeave={e => { e.currentTarget.style.background=c.dl; e.currentTarget.style.color=c.type; e.currentTarget.style.borderColor=c.dlBorder }}
          >⬇ ডাউনলোড</button>

          {/* Share button */}
          <button onClick={handleShare} style={{
            width: 34, height: 34, borderRadius: 9,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--dim)', fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .2s', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(37,99,235,.1)'; e.currentTarget.style.borderColor='rgba(37,99,235,.3)'; e.currentTarget.style.color='var(--c-blue)' }}
          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--dim)' }}
          title="শেয়ার করুন"
          >🔗</button>

          {isAdmin && (
            <button onClick={() => onDelete(file)} style={{
              width: 32, height: 32, borderRadius: 9,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--dim)', fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .2s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(220,38,38,.1)'; e.currentTarget.style.borderColor='rgba(220,38,38,.3)'; e.currentTarget.style.color='var(--c-red)' }}
            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--dim)' }}
            >🗑</button>
          )}
        </div>
      </div>
    </>
  )
}
