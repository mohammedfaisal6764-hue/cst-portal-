import { useState, useEffect } from 'react'
import { uploadToR2 } from '../r2'
import { R_SUBJECTS } from '../routine'
import { ClassWorkCard, ClassWorkFiles, isClassWork, isLabWork } from './ClassWork'
import { sb, SUBJECTS, SECTIONS, HW_TYPES, CHAPTERS, rollToSection, normRows } from '../supabase'

const WORK_TYPES = [
  { value: 'read_write', label: '📖✍️ পড়া + লেখা' },
  { value: 'read',       label: '📖 শুধু পড়া'      },
  { value: 'write',      label: '✍️ শুধু লেখা'      },
]

const Q_TYPES = [
  { value: 'vsq',   label: 'অতি সংক্ষিপ্ত প্রশ্ন', short: 'অতি সংক্ষিপ্ত', color: 'var(--c-green)', bg: 'rgba(5,150,105,.1)',  border: 'rgba(5,150,105,.25)'  },
  { value: 'sq',    label: 'সংক্ষিপ্ত প্রশ্ন',      short: 'সংক্ষিপ্ত',     color: 'var(--c-blue)', bg: 'rgba(37,99,235,.1)',  border: 'rgba(37,99,235,.25)'  },
  { value: 'essay', label: 'রচনা প্রশ্ন',            short: 'রচনা',           color: 'var(--c-amber)', bg: 'rgba(217,119,6,.1)',  border: 'rgba(217,119,6,.25)'  },
]

function QuestionSection({ value = {}, onChange }) {
  const [inputs, setInputs] = useState({ vsq: '', sq: '', essay: '' })

  function addNums(type) {
    const raw = inputs[type] || ''
    const nums = raw.split(/[,\s،]+/).map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n > 0)
    const existing = value[type] || []
    const merged = [...new Set([...existing, ...nums])].sort((a,b) => a-b)
    onChange({ ...value, [type]: merged })
    setInputs(p => ({ ...p, [type]: '' }))
  }

  function removeNum(type, n) {
    onChange({ ...value, [type]: (value[type]||[]).filter(x => x !== n) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Q_TYPES.map(qt => (
        <div key={qt.value} style={{ background: qt.bg, border: `1px solid ${qt.border}`, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: qt.color, marginBottom: 8 }}>{qt.label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7, minHeight: 24 }}>
            {(value[qt.value] || []).map(n => (
              <span key={n} style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 9px', borderRadius:20, background:'rgba(var(--ob),.25)', fontSize:13, fontWeight:700, color: qt.color }}>
                {n}
                <button onClick={() => removeNum(qt.value, n)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:12, padding:0, lineHeight:1 }}>×</button>
              </span>
            ))}
            {!(value[qt.value]||[]).length && <span style={{ fontSize:11, color:'rgba(var(--ov),.2)' }}>কোনো প্রশ্ন নেই</span>}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <input
              value={inputs[qt.value]} onChange={e => setInputs(p => ({...p, [qt.value]: e.target.value}))}
              onKeyDown={e => e.key === 'Enter' && addNums(qt.value)}
              placeholder="নম্বর লিখুন: 1 2 3 5"
              style={{ flex:1, padding:'7px 10px', background:'rgba(var(--ob),.3)', border:'1px solid rgba(var(--ov),.08)', borderRadius:7, color:'var(--text)', fontSize:12, outline:'none' }}
            />
            <button onClick={() => addNums(qt.value)} style={{ padding:'7px 12px', borderRadius:7, background:'rgba(var(--ob),.3)', border:`1px solid ${qt.border}`, color:qt.color, fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
              + যোগ
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Homework Card ─────────────────────────────────────────────
// ── Live Clock (Asia/Dhaka, 12-hour, সার্ভারের সময়ের সাথে sync) ─────
const TZ = 'Asia/Dhaka'
let clockOffset = 0 // server time - device time (ms)
async function syncClock() {
  try {
    const t0 = Date.now()
    const res = await fetch(window.location.origin + '/?_t=' + t0, { method: 'HEAD', cache: 'no-store' })
    const d = res.headers.get('date')
    if (d) { const t1 = Date.now(); clockOffset = new Date(d).getTime() + (t1 - t0) / 2 - t1 }
  } catch {}
}
const nowMs = () => Date.now() + clockOffset
// আজকের তারিখ (Dhaka) YYYY-MM-DD
function todayDhaka() { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(nowMs())) }
function dayDiff(dueStr) {
  if (!dueStr) return null
  const [y1,m1,d1] = todayDhaka().split('-').map(Number)
  const [y2,m2,d2] = String(dueStr).slice(0,10).split('-').map(Number)
  return Math.round((Date.UTC(y2,m2-1,d2) - Date.UTC(y1,m1-1,d1)) / 86400000)
}

// ৭-segment digit (SVG) — কোনো external font লাগে না
const SEG_ON = { 0:'abcdef', 1:'bc', 2:'abdeg', 3:'abcdg', 4:'bcfg', 5:'acdfg', 6:'acdefg', 7:'abc', 8:'abcdefg', 9:'abcdfg' }
const SEG_PTS = {
  a: '2.2,1 9.8,1 8.6,2.4 3.4,2.4',
  b: '10.2,1.4 11,2.2 10.2,8.6 9.2,9.6 8.6,8.6 9.2,2.8',
  c: '9.2,10.4 10.2,11.4 9.6,17.8 8.8,18.6 8,17.2 8.6,11.2',
  d: '2.2,19 9.8,19 8.6,17.6 3.4,17.6',
  e: '1.8,10.4 2.8,11.4 2.2,17.2 1.4,18.6 0.6,17.8 1.2,11.4',
  f: '1.8,1.4 2.8,2.8 2.2,8.6 1.2,9.6 0.4,8.6 1,2.2',
  g: '2.4,10 3.4,9 8.6,9 9.6,10 8.6,11 3.4,11',
}
function SegDigit({ n, h = 22 }) {
  const on = SEG_ON[n] || ''
  return (
    <svg viewBox="0 0 11.6 20" height={h} width={h * 0.58} style={{ display:'block', overflow:'visible' }}>
      {Object.keys(SEG_PTS).map(k => (
        <polygon key={k} points={SEG_PTS[k]} fill={on.includes(k) ? '#fff' : 'rgba(var(--ov),.07)'} />
      ))}
    </svg>
  )
}
function SegColon({ h = 22, blink }) {
  return (
    <svg viewBox="0 0 3 20" height={h} width={h * 0.15} style={{ display:'block', animation: blink ? 'clkBlink 1s steps(1) infinite' : 'none' }}>
      <circle cx="1.5" cy="6.5" r="1.15" fill="#fff" />
      <circle cx="1.5" cy="13.5" r="1.15" fill="#fff" />
    </svg>
  )
}

function LiveClock() {
  const [now, setNow] = useState(nowMs())
  useEffect(() => {
    syncClock()
    const id = setInterval(() => setNow(nowMs()), 1000)
    const re = setInterval(syncClock, 5 * 60 * 1000)
    return () => { clearInterval(id); clearInterval(re) }
  }, [])
  const d = new Date(now)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      .formatToParts(d).map(p => [p.type, p.value])
  )
  const dateStr = new Intl.DateTimeFormat('bn-BD', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  const H = 22
  const digs = (v, hh = H) => String(v).split('').map((c, i) => <SegDigit key={i} n={+c} h={hh} />)
  return (
    <div style={{ background:'#000', border:'1px solid #1f2937', borderRadius:10, padding:'7px 12px 6px', display:'inline-flex', flexDirection:'column', alignItems:'center', gap:4 }}>
      <style>{'@keyframes clkBlink{0%,49%{opacity:1}50%,100%{opacity:.2}}'}</style>
      <div style={{ display:'flex', alignItems:'flex-end', gap:3, transform:'skewX(-7deg)' }}>
        <div style={{ display:'flex', gap:3 }}>{digs(parts.hour)}</div>
        <SegColon h={H} blink />
        <div style={{ display:'flex', gap:3 }}>{digs(parts.minute)}</div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:2, marginLeft:5, opacity:.85 }}>
          <div style={{ display:'flex', gap:2 }}>{digs(parts.second, 13)}</div>
        </div>
        <span style={{ transform:'skewX(7deg)', marginLeft:5, fontSize:10, fontWeight:700, color:'#9ca3af', letterSpacing:.5, lineHeight:1, paddingBottom:1 }}>{parts.dayPeriod}</span>
      </div>
      <div style={{ fontSize:10.5, color:'#9ca3af', letterSpacing:.3 }}>{dateStr}</div>
    </div>
  )
}

// একসাথে যোগ করা বিষয়গুলো (একই batch) এক box-এ গোষ্ঠীবদ্ধ করে
function groupByBatch(list) {
  const groups = []; const idx = {}
  for (const h of list) {
    const b = h.questions && !Array.isArray(h.questions) ? h.questions.batch : null
    if (b) {
      if (idx[b] === undefined) { idx[b] = groups.length; groups.push([h]) }
      else groups[idx[b]].push(h)
    } else groups.push([h])
  }
  return groups
}

// একই "যোগ" তারিখ (ঢাকা) + Section = এক box
const dayOf = (iso) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date(iso)) } catch { return '' } }
const bnDate = (iso) => { try { return new Date(iso).toLocaleDateString('bn-BD', { timeZone: 'Asia/Dhaka' }) } catch { return '' } }
function groupByDay(list) {
  const groups = []; const idx = {}
  for (const h of list) {
    const k = dayOf(h.created_at) + '|' + h.section
    if (idx[k] === undefined) { idx[k] = groups.length; groups.push([h]) } else groups[idx[k]].push(h)
  }
  return groups
}

function HwCard({ hw, isAdmin, canManage, onDelete, onToggleDone, onEdit }) {
  const [done, setDone] = useState(hw.is_done || false)
  const [expanded, setExpanded] = useState(false)

  const sectionColors = {
    A: { bg: 'rgba(16,185,129,.08)', border: 'rgba(16,185,129,.2)', color: 'var(--c-green)' },
    B: { bg: 'rgba(37,99,235,.08)',  border: 'rgba(37,99,235,.2)',  color: 'var(--c-blue)' },
    C: { bg: 'rgba(124,58,237,.08)', border: 'rgba(124,58,237,.2)', color: 'var(--c-violet)' },
  }
  const sc = sectionColors[hw.section] || sectionColors.B

  const hwTypeLabel = HW_TYPES.find(t => t.value === hw.work_type)?.label
  const hasQuestions = hw.questions && typeof hw.questions === 'object' && !Array.isArray(hw.questions) && Q_TYPES.some(qt => (hw.questions[qt.value] || []).length > 0)
  const totalQs = hasQuestions ? Q_TYPES.reduce((sum, qt) => sum + (hw.questions[qt.value]?.length || 0), 0) : 0

  // Due date urgency
  const daysLeft = dayDiff(hw.due_date)
  const dueBadgeColor = daysLeft === null ? 'var(--muted)' : daysLeft < 0 ? 'var(--c-red)' : daysLeft === 0 ? 'var(--c-orange)' : daysLeft <= 2 ? 'var(--c-amber)' : 'var(--c-green)'
  const dueBadgeBg = daysLeft === null ? 'transparent' : daysLeft < 0 ? 'rgba(248,113,113,.1)' : daysLeft === 0 ? 'rgba(251,146,60,.1)' : daysLeft <= 2 ? 'rgba(251,191,36,.1)' : 'rgba(52,211,153,.1)'
  const dueText = daysLeft === null ? '—' : daysLeft < 0 ? `${Math.abs(daysLeft)}d আগেই শেষ` : daysLeft === 0 ? 'আজই শেষ!' : daysLeft === 1 ? 'আগামীকাল' : `${daysLeft}d বাকি`

  async function toggle() {
    const newVal = !done
    setDone(newVal)
    await onToggleDone(hw.id, newVal)
  }

  return (
    <div style={{
      background: done ? 'rgba(var(--ov),.01)' : 'var(--surface)',
      border: `1px solid ${done ? 'var(--border)' : 'var(--border)'}`,
      borderLeft: `3px solid ${done ? 'var(--dim)' : sc.color}`,
      borderRadius: 12, overflow: 'hidden',
      opacity: done ? .55 : 1,
      transition: 'all .2s',
    }}>
      {/* Header row */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Done checkbox */}
        <button onClick={toggle} style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 2,
          border: `2px solid ${done ? 'var(--dim)' : sc.color}`,
          background: done ? 'var(--dim)' : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .2s',
        }}>
          {done && <span style={{ color: 'var(--text)', fontSize: 12 }}>✓</span>}
        </button>

        <div style={{ flex: 1, minWidth: 0 }} onClick={() => setExpanded(!expanded)} className="hw-expand">
          {/* Tags row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color }}>
              Section {hw.section}
            </span>
            {hw.chapter && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: 'rgba(234,179,8,.08)', border: '1px solid rgba(234,179,8,.15)', color: 'var(--c-amber)' }}>
                📖 {hw.chapter}
              </span>
            )}
            {hwTypeLabel && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: 'rgba(var(--ov),.04)', color: 'var(--text-4)' }}>{hwTypeLabel}</span>
            )}
            {totalQs > 0 && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: 'rgba(96,165,250,.08)', color: 'var(--c-blue)' }}>
                {totalQs} টি প্রশ্ন
              </span>
            )}
          </div>

          {/* Subject */}
          <div style={{ fontSize: 14, fontWeight: 700, color: done ? 'var(--dim)' : 'var(--text)', textDecoration: done ? 'line-through' : 'none', marginBottom: 4 }}>
            {hw.subject?.split(' - ')[1] || hw.subject}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{hw.subject?.split(' - ')[0]}</div>

          {/* Quick info row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 7 }}>
            {hw.page_numbers && (
              <span style={{ fontSize: 11, color: 'var(--text-4)' }}>📄 পৃষ্ঠা: <strong style={{ color: 'var(--text-3)' }}>{hw.page_numbers}</strong></span>
            )}
            <span style={{ fontSize: 11, fontWeight: 600, color: dueBadgeColor, background: dueBadgeBg, padding: '1px 7px', borderRadius: 5 }}>
              📅 {hw.due_date || '—'} {daysLeft !== null ? `(${dueText})` : ''}
            </span>
          </div>
        </div>

        {/* Right buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 13, padding: '2px 4px', transition: 'color .2s' }}
            title="বিস্তারিত দেখুন">
            {expanded ? '▲' : '▼'}
          </button>
          <button
            onClick={() => {
              const url = window.location.origin + '/?hw=' + hw.id
              if (navigator.share) { navigator.share({ title: hw.subject, url }) }
              else { navigator.clipboard.writeText(url).then(() => alert('✅ লিংক কপি হয়েছে!')) }
            }}
            style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 13, padding: '2px 4px', transition: 'color .2s' }}
            onMouseEnter={e => e.currentTarget.style.color='var(--c-green)'}
            onMouseLeave={e => e.currentTarget.style.color='var(--dim)'}
            title="শেয়ার করুন">🔗</button>
          {isAdmin && (
            <>
              <button onClick={() => onEdit(hw)} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 13, padding: '2px 4px', transition: 'color .2s' }}
                onMouseEnter={e => e.currentTarget.style.color='var(--c-blue)'}
                onMouseLeave={e => e.currentTarget.style.color='var(--dim)'}
                title="সম্পাদনা">✏️</button>
              <button onClick={() => onDelete(hw.id)} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 13, padding: '2px 4px', transition: 'color .2s' }}
                onMouseEnter={e => e.currentTarget.style.color='var(--c-red)'}
                onMouseLeave={e => e.currentTarget.style.color='var(--dim)'}
                title="মুছুন">🗑</button>
            </>
          )}
          {/* Group Admin নিজের section এর homework edit/delete করতে পারবে */}
          {!isAdmin && canManage && (
            <>
              <button onClick={() => onEdit(hw)} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 13, padding: '2px 4px', transition: 'color .2s' }}
                onMouseEnter={e => e.currentTarget.style.color='var(--c-blue)'}
                onMouseLeave={e => e.currentTarget.style.color='var(--dim)'}
                title="সম্পাদনা">✏️</button>
              <button onClick={() => onDelete(hw.id)} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 13, padding: '2px 4px', transition: 'color .2s' }}
                onMouseEnter={e => e.currentTarget.style.color='var(--c-red)'}
                onMouseLeave={e => e.currentTarget.style.color='var(--dim)'}
                title="মুছুন">🗑</button>
            </>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px 14px', background: 'rgba(var(--ob),.15)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Questions by type */}
          {hasQuestions && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>📝 প্রশ্ন নম্বর</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Q_TYPES.map(qt => {
                  const nums = hw.questions[qt.value] || []
                  if (!nums.length) return null
                  return (
                    <div key={qt.value} style={{ background: qt.bg, border: `1px solid ${qt.border}`, borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: qt.color, marginBottom: 6 }}>{qt.label}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {nums.map(n => (
                          <span key={n} style={{ padding: '2px 10px', borderRadius: 20, background: 'rgba(var(--ob),.25)', fontSize: 13, fontWeight: 700, color: qt.color }}>
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sessional Work */}
          {hw.questions && !Array.isArray(hw.questions) && (Object.values(hw.questions.sessional || {}).some(v => Array.isArray(v) && v.length) || hw.questions.sign_date) && (
            <div style={{ border: '1px solid rgba(124,58,237,.25)', borderRadius: 10, padding: '10px 12px', background: 'rgba(124,58,237,.05)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-violet)', marginBottom: 8 }}>📒 Sessional Work</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Q_TYPES.map(qt => {
                  const nums = (hw.questions.sessional || {})[qt.value] || []
                  if (!nums.length) return null
                  return (
                    <div key={qt.value} style={{ background: qt.bg, border: `1px solid ${qt.border}`, borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: qt.color, marginBottom: 6 }}>{qt.label}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {nums.map(n => (
                          <span key={n} style={{ padding: '2px 10px', borderRadius: 20, background: 'rgba(var(--ob),.25)', fontSize: 13, fontWeight: 700, color: qt.color }}>{n}</span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              {hw.questions.sign_date && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--c-amber)', fontWeight: 600 }}>
                  ✍️ সাইন করার শেষ তারিখ: {new Date(hw.questions.sign_date).toLocaleDateString('bn-BD')}
                </div>
              )}
            </div>
          )}

          {/* Legacy array support */}
          {hw.questions && Array.isArray(hw.questions) && hw.questions.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>📝 প্রশ্ন নম্বর</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {hw.questions.map(n => (
                  <span key={n} style={{ padding: '2px 9px', borderRadius: 20, background: 'rgba(37,99,235,.1)', border: '1px solid rgba(37,99,235,.2)', fontSize: 13, fontWeight: 700, color: 'var(--c-blue)' }}>{n}</span>
                ))}
              </div>
            </div>
          )}

          {hw.note && (
            <div style={{ background: 'rgba(124,58,237,.06)', border: '1px solid rgba(124,58,237,.15)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-violet)', marginBottom: 3 }}>💬 শিক্ষকের নোট</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{hw.note}</div>
            </div>
          )}
          {hw.questions && !Array.isArray(hw.questions) && (hw.questions.images || []).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>🖼 ছবি / ফাইল</div>
              <ClassWorkFiles files={hw.questions.images} />
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--dim)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>🕐 যোগ: {hw.created_at ? new Date(hw.created_at).toLocaleDateString('bn-BD') : '—'}</span>
            {hw.updated_at && <span>✏️ আপডেট: {new Date(hw.updated_at).toLocaleDateString('bn-BD')}</span>}
          </div>
        </div>
      )}
    </div>
  )
}


// ছবি / PDF বাছাই: আগের ফাইল (মুছা যাবে) + নতুন ফাইল (আপলোড হবে)
function FilesField({ existing = [], files = [], onRemoveExisting, onAdd, onRemoveNew, label = '🖼 ছবি / PDF (ঐচ্ছিক)' }) {
  const small = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '3px 8px', borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-3)', maxWidth: 190 }
  const x = { background: 'none', border: 'none', color: 'var(--c-red)', cursor: 'pointer', padding: 0 }
  const isImg = (f) => (f.type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(f.name || '')
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--text-4)', display: 'block', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {existing.map((f, k) => (
          <span key={'e' + k} style={small}>
            {isImg(f) ? <img src={f.url} alt="" style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 4 }} /> : '📄'}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || 'ফাইল'}</span>
            <button type="button" title="মুছুন" onClick={() => onRemoveExisting(k)} style={x}>✕</button>
          </span>
        ))}
        {files.map((f, k) => (
          <span key={'n' + k} style={{ ...small, borderColor: 'rgba(37,99,235,.4)' }}>
            {(f.type || '').startsWith('image/') ? '🖼' : '📄'}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span><i style={{ fontStyle: 'normal', color: 'var(--c-blue)' }}>নতুন</i>
            <button type="button" title="বাদ" onClick={() => onRemoveNew(k)} style={x}>✕</button>
          </span>
        ))}
      </div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: '1px dashed var(--border)', color: 'var(--c-blue)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        📷 ছবি / PDF যোগ করুন
        <input type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }} onChange={e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) onAdd(f) }} />
      </label>
    </div>
  )
}

// ── Add/Edit Homework Modal ────────────────────────────────────
function HwModal({ onClose, onSave, initial = null }) {
  const editing = !!initial
  const blankItem = () => ({ subject: '', chapter: '', pages: '', workType: '', questions: {}, sessional: {}, signDate: '', images: [], newFiles: [] })
  // প্রতিটি বিষয়ের নিজস্ব অধ্যায়, পৃষ্ঠা, কাজের ধরন ও প্রশ্ন
  const [items, setItems] = useState([
    editing ? {
      subject:   initial.subject || '',
      chapter:   initial.chapter || '',
      pages:     initial.page_numbers || '',
      workType:  initial.work_type || '',
      questions: initial.questions && !Array.isArray(initial.questions) ? initial.questions : {},
      sessional: initial.questions?.sessional || {},
      signDate:  initial.questions?.sign_date || '',
      images:    Array.isArray(initial.questions?.images) ? initial.questions.images : [],
      newFiles:  [],
    } : blankItem()
  ])
  const [section, setSection] = useState(initial?.section  || '')
  const [dueDate, setDueDate] = useState(initial?.due_date || '')
  const [note,    setNote]    = useState(initial?.note     || '')
  const [busy,    setBusy]    = useState(false)
  const [cwRows,  setCwRows]  = useState([])   // Class Work: [{subject, files:[File]}]
  const [upMsg,   setUpMsg]   = useState('')

  const setItem = (i, patch) => setItems(r => r.map((it, j) => j === i ? { ...it, ...patch } : it))

  async function save() {
    const valid = items.filter(it => it.subject.trim())
    const validCw = cwRows.filter(r => r.subject && r.files.length)
    if ((!valid.length && !validCw.length) || !section) { alert('বিষয় ও Section দিন'); return }
    if (cwRows.some(r => (r.subject && !r.files.length) || (!r.subject && r.files.length))) { alert('Class Work-এ বিষয় ও ফাইল (ছবি/PDF) দুটোই দিন'); return }
    setBusy(true)
    try {
      const total = valid.length + validCw.length
      const batch = editing ? (initial.questions?.batch || '') : (total > 1 ? 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : '')
      const nowIso = new Date().toISOString()
      for (const it of valid) {
        const up = []
        for (let j = 0; j < (it.newFiles || []).length; j++) {
          const f = it.newFiles[j]
          setUpMsg(`⏳ ${f.name} আপলোড হচ্ছে (${j + 1}/${it.newFiles.length})`)
          const { downloadUrl, fileId } = await uploadToR2(f)
          up.push({ name: f.name, url: downloadUrl, key: fileId, type: f.type || '', size: f.size })
        }
        const allImgs = [...(it.images || []), ...up]
        const qs = { ...it.questions, sessional: it.sessional, sign_date: it.signDate, ...(batch ? { batch } : {}) }
        if (allImgs.length) qs.images = allImgs; else delete qs.images
        const payload = { subject: it.subject, section, chapter: it.chapter, page_numbers: it.pages, work_type: it.workType, questions: qs, due_date: dueDate, note, is_done: initial?.is_done || false }
        if (!editing) payload.created_at = nowIso
        else payload.updated_at = nowIso
        await onSave(payload)
      }
      // Class Work: ছবি/PDF আগে upload, তারপর row সংরক্ষণ
      for (let i = 0; i < validCw.length; i++) {
        const r = validCw[i]
        const uploaded = []
        for (let j = 0; j < r.files.length; j++) {
          const f = r.files[j]
          setUpMsg(`⏳ Class Work আপলোড হচ্ছে (${i + 1}/${validCw.length}) — ফাইল ${j + 1}/${r.files.length}`)
          const { downloadUrl, fileId } = await uploadToR2(f)
          uploaded.push({ name: f.name, url: downloadUrl, key: fileId, type: f.type || '', size: f.size })
        }
        await onSave({ subject: r.subject, section, chapter: '', page_numbers: '', work_type: '', questions: { kind: 'classwork', files: uploaded, ...(batch ? { batch } : {}) }, due_date: dueDate, note: '', is_done: false, created_at: nowIso })
      }
      setBusy(false); setUpMsg('')
      onClose()
    } catch (e) {
      setBusy(false); setUpMsg('')
      alert('আপলোড ব্যর্থ: ' + (e.message || e))
    }
  }

  const inp = { padding:'10px 12px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:9, color:'var(--text)', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' }
  const lbl = { fontSize:11, color:'var(--muted)', fontWeight:500, display:'block', marginBottom:5 }
  const multi = items.length > 1

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto' }}>
      <div style={{ width:'100%', maxWidth:560, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'22px', maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:'var(--text-strong)' }}>{editing ? '✏️ Homework সম্পাদনা' : '📚 নতুন Homework যোগ করুন'}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
          {/* Shared: Section + Due Date */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={lbl}>Section *</label>
              <select value={section} onChange={e=>setSection(e.target.value)} style={inp}>
                <option value="">-- বেছে নিন --</option>
                {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Due Date</label>
              <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} style={inp} />
            </div>
          </div>

          {/* One card per subject */}
          {items.map((it, i) => (
            <div key={i} style={{ border:'1px solid var(--border)', borderRadius:12, padding:14, background:'rgba(var(--ov),.015)', display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                {multi && <span style={{ fontSize:12, fontWeight:700, color:'var(--c-blue)', minWidth:18 }}>{i+1}.</span>}
                <select value={it.subject} onChange={e => setItem(i, { subject: e.target.value })} style={{ ...inp, flex:1 }}>
                  <option value="">-- বিষয় বেছে নিন --</option>
                  {SUBJECTS.map(sv => <option key={sv} value={sv}>{sv}</option>)}
                </select>
                {!editing && multi && (
                  <button type="button" onClick={() => setItems(r => r.filter((_,j) => j!==i))}
                    style={{ padding:'0 10px', height:38, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)', borderRadius:8, color:'var(--c-red)', cursor:'pointer', fontSize:16 }}>✕</button>
                )}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>অধ্যায়</label>
                  <select value={it.chapter} onChange={e => setItem(i, { chapter: e.target.value })} style={inp}>
                    <option value="">-- অধ্যায় বেছে নিন --</option>
                    {CHAPTERS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>পৃষ্ঠা নম্বর</label>
                  <input value={it.pages} onChange={e => setItem(i, { pages: e.target.value })} style={inp} placeholder="যেমন: ৪৫-৫০" />
                </div>
              </div>

              <div>
                <label style={{ ...lbl, marginBottom:8 }}>কাজের ধরন</label>
                <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
                  {WORK_TYPES.map(t => (
                    <button type="button" key={t.value} onClick={() => setItem(i, { workType: it.workType === t.value ? '' : t.value })} style={{
                      padding:'8px 14px', borderRadius:9, cursor:'pointer', fontSize:12,
                      border: it.workType === t.value ? '1.5px solid rgba(37,99,235,.5)' : '1px solid var(--border)',
                      background: it.workType === t.value ? 'rgba(37,99,235,.12)' : 'rgba(var(--ov),.02)',
                      color: it.workType === t.value ? 'var(--c-blue)' : 'var(--muted)',
                      fontWeight: it.workType === t.value ? 700 : 400,
                    }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ ...lbl, marginBottom:8 }}>প্রশ্ন নম্বর (ঐচ্ছিক)</label>
                <QuestionSection value={it.questions} onChange={q => setItem(i, { questions: q })} />
              </div>

              {/* Sessional Work */}
              <div style={{ borderTop:'1px dashed var(--border)', paddingTop:12 }}>
                <label style={{ ...lbl, color:'var(--c-violet)', fontWeight:700, marginBottom:8 }}>📒 Sessional Work (ঐচ্ছিক)</label>
                <QuestionSection value={it.sessional} onChange={q => setItem(i, { sessional: q })} />
                <div style={{ marginTop:10 }}>
                  <label style={lbl}>✍️ সাইন করার শেষ তারিখ</label>
                  <input type="date" value={it.signDate} onChange={e => setItem(i, { signDate: e.target.value })} style={inp} />
                </div>
              </div>
              <FilesField existing={it.images || []} files={it.newFiles || []}
                onRemoveExisting={k => setItem(i, { images: it.images.filter((_, j) => j !== k) })}
                onAdd={f => setItem(i, { newFiles: [...(it.newFiles || []), ...f] })}
                onRemoveNew={k => setItem(i, { newFiles: it.newFiles.filter((_, j) => j !== k) })} />
            </div>
          ))}

          {!editing && (
            <button type="button" onClick={() => setItems(r => [...r, blankItem()])}
              style={{ padding:'9px 14px', background:'rgba(37,99,235,.08)', border:'1px dashed rgba(37,99,235,.3)', borderRadius:8, color:'var(--c-blue)', cursor:'pointer', fontSize:12, fontWeight:600, width:'100%' }}>
              + আরও বিষয় যোগ করো
            </button>
          )}

          {/* Class Work (ছবি / PDF) */}
          {!editing && (
            <div style={{ border:'1px solid rgba(245,158,11,.25)', borderRadius:12, padding:14, background:'rgba(245,158,11,.03)', display:'flex', flexDirection:'column', gap:10 }}>
              <label style={{ ...lbl, color:'var(--c-amber)', fontWeight:700, marginBottom:0 }}>🏫 Class Work — ছবি বা PDF (ঐচ্ছিক)</label>
              {cwRows.map((r, i) => (
                <div key={i} style={{ border:'1px solid var(--border)', borderRadius:10, padding:10, display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'flex', gap:6 }}>
                    <select value={r.subject} onChange={e => setCwRows(a => a.map((x, j) => j === i ? { ...x, subject: e.target.value } : x))} style={{ ...inp, flex:1 }}>
                      <option value="">-- বিষয় বেছে নিন --</option>
                      {SUBJECTS.map(sv => <option key={sv} value={sv}>{sv}</option>)}
                    </select>
                    <button type="button" onClick={() => setCwRows(a => a.filter((_, j) => j !== i))}
                      style={{ padding:'0 10px', height:38, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)', borderRadius:8, color:'var(--c-red)', cursor:'pointer', fontSize:16 }}>✕</button>
                  </div>
                  <input type="file" accept="image/*,application/pdf" multiple
                    onChange={e => { const fl = Array.from(e.target.files || []); setCwRows(a => a.map((x, j) => j === i ? { ...x, files: [...x.files, ...fl] } : x)); e.target.value = '' }}
                    style={{ ...inp, padding:8, fontSize:12 }} />
                  {r.files.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {r.files.map((f, k) => (
                        <span key={k} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:20, background:'rgba(var(--ob),.25)', fontSize:11, color:'var(--text)', maxWidth:200 }}>
                          {f.type.startsWith('image/') ? '🖼' : '📄'} <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                          <button type="button" onClick={() => setCwRows(a => a.map((x, j) => j === i ? { ...x, files: x.files.filter((_, m) => m !== k) } : x))}
                            style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', padding:0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setCwRows(a => [...a, { subject:'', files:[] }])}
                style={{ padding:'9px 14px', background:'rgba(245,158,11,.08)', border:'1px dashed rgba(245,158,11,.35)', borderRadius:8, color:'var(--c-amber)', cursor:'pointer', fontSize:12, fontWeight:600, width:'100%' }}>
                + Class Work যোগ করো
              </button>
            </div>
          )}

          {/* Shared note */}
          <div>
            <label style={lbl}>শিক্ষকের নোট (ঐচ্ছিক){multi ? ' — সব বিষয়ে একই' : ''}</label>
            <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} style={{ ...inp, resize:'vertical' }} placeholder="যেকোনো বিশেষ নির্দেশনা..." />
          </div>

          <button onClick={save} disabled={busy} style={{ padding:12, borderRadius:10, border:'none', background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', opacity:busy?.6:1 }}>
            {busy ? (upMsg || '⏳ সংরক্ষণ হচ্ছে...') : editing ? '✅ আপডেট করুন' : `✅ Homework যোগ করুন${(items.filter(x=>x.subject).length + cwRows.length) > 1 ? ` (${items.filter(x=>x.subject).length}টি বিষয়${cwRows.length ? ` + ${cwRows.length}টি Class Work` : ''})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Class Work / Lab Work এডিট (ধরন, বিষয়, নোট, ছবি/PDF) ──
function CwEditModal({ hw, onClose, onSave }) {
  const [kind, setKind] = useState(hw.questions?.kind || 'classwork')
  const [subject, setSubject] = useState(hw.subject || '')
  const [note, setNote] = useState(hw.note || '')
  const [existing, setExisting] = useState(hw.questions?.files || [])
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const inp = { width: '100%', padding: '9px 11px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 13, outline: 'none' }
  const pill = (on) => ({ padding: '6px 13px', borderRadius: 18, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: on ? '1.5px solid #2563eb' : '1px solid var(--border)', background: on ? 'rgba(37,99,235,.14)' : 'transparent', color: on ? 'var(--c-blue)' : 'var(--muted)' })
  async function save() {
    setBusy(true)
    try {
      const up = []
      for (let j = 0; j < files.length; j++) {
        setMsg(`⏳ ${files[j].name} আপলোড হচ্ছে (${j + 1}/${files.length})`)
        const { downloadUrl, fileId } = await uploadToR2(files[j])
        up.push({ name: files[j].name, url: downloadUrl, key: fileId, type: files[j].type || '', size: files[j].size })
      }
      await onSave({ subject, note: note.trim() || null, questions: { ...hw.questions, kind, files: [...existing, ...up] } })
    } catch (e) { alert('ব্যর্থ: ' + (e.message || e)); setBusy(false); return }
    setBusy(false)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>✏️ Class / Lab Work সম্পাদনা</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setKind('classwork')} style={pill(kind === 'classwork')}>🏫 Class Work</button>
          <button onClick={() => setKind('labwork')} style={pill(kind === 'labwork')}>🧪 Lab Work</button>
        </div>
        <select value={subject} onChange={e => setSubject(e.target.value)} style={inp}>{SUBJECTS.map(x => <option key={x} value={x}>{x}</option>)}</select>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={4} placeholder="💬 শিক্ষকের নোট / বিবরণ" style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
        <FilesField existing={existing} files={files}
          onRemoveExisting={k => setExisting(a => a.filter((_, j) => j !== k))}
          onAdd={f => setFiles(a => [...a, ...f])} onRemoveNew={k => setFiles(a => a.filter((_, j) => j !== k))} />
        <button onClick={save} disabled={busy} style={{ padding: 12, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busy ? .6 : 1 }}>{busy ? (msg || '⏳ সংরক্ষণ হচ্ছে...') : '✅ আপডেট করুন'}</button>
      </div>
    </div>
  )
}

// ── BulkAddModal ──────────────────────────────────────────────
function BulkAddModal({ onClose, onSave, defaultSection }) {
  const [section, setSection]  = useState(defaultSection || '')
  const [dueDate, setDueDate]  = useState('')
  const [chapter, setChapter]  = useState('')
  const [note,    setNote]     = useState('')
  const [busy,    setBusy]     = useState(false)

  async function save() {
    if (!section) { alert('Section বেছে নিন'); return }
    setBusy(true)
    await onSave({ section, dueDate, chapter, note })
    setBusy(false)
  }

  const inp = { width:'100%', padding:'10px 12px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:9, color:'var(--text)', fontSize:13, outline:'none' }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:999, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:24, width:'100%', maxWidth:420 }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize:15, fontWeight:700, color:'var(--text-strong)', marginBottom:4 }}>📋 সব বিষয়ে Homework</h3>
        <p style={{ fontSize:12, color:'var(--muted)', marginBottom:18 }}>একটা date দিলে সব {SUBJECTS.length}টি বিষয়ে একসাথে Homework যোগ হবে</p>

        {/* Section */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, color:'var(--text-4)', display:'block', marginBottom:5 }}>Section *</label>
          <select value={section} onChange={e => setSection(e.target.value)} style={inp}>
            <option value=''>-- Section বেছে নিন --</option>
            {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
        </div>

        {/* Due Date */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, color:'var(--text-4)', display:'block', marginBottom:5 }}>জমার তারিখ</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inp} />
        </div>

        {/* Chapter */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, color:'var(--text-4)', display:'block', marginBottom:5 }}>অধ্যায় (optional)</label>
          <input value={chapter} onChange={e => setChapter(e.target.value)} placeholder="যেমন: অধ্যায় ১-২" style={inp} />
        </div>

        {/* Note */}
        <div style={{ marginBottom:18 }}>
          <label style={{ fontSize:11, color:'var(--text-4)', display:'block', marginBottom:5 }}>নোট (optional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="বিশেষ নির্দেশনা..." style={{ ...inp, resize:'vertical' }} />
        </div>

        {/* Subjects preview */}
        <div style={{ marginBottom:18, padding:'10px 14px', background:'rgba(var(--ov),.03)', borderRadius:9, border:'1px solid var(--border)' }}>
          <div style={{ fontSize:11, color:'var(--muted)', marginBottom:8 }}>এই বিষয়গুলোতে যোগ হবে:</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            {SUBJECTS.map(s => (
              <span key={s} style={{ fontSize:10, padding:'2px 8px', background:'rgba(37,99,235,.1)', color:'var(--c-blue)', borderRadius:5 }}>
                {s.split(' - ')[0]}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={save} disabled={busy} style={{ flex:1, padding:'11px', background:'linear-gradient(135deg,#059669,#047857)', border:'none', borderRadius:10, color:'#fff', fontSize:13, fontWeight:600, cursor: busy ? 'wait' : 'pointer', opacity: busy ? .6 : 1 }}>
            {busy ? '⏳ যোগ হচ্ছে...' : `✅ সব ${SUBJECTS.length}টি বিষয়ে যোগ করুন`}
          </button>
          <button onClick={onClose} style={{ padding:'11px 16px', background:'transparent', border:'1px solid var(--border)', borderRadius:10, color:'var(--muted)', cursor:'pointer' }}>বাতিল</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Homework Page ────────────────────────────────────────

// ─── আপডেট বার্তা: বেছে নেওয়া Homework/Class Work থেকে গ্রুপে পাঠানোর টেক্সট বানায় ───
const subjName = (s) => (s || '').split(' - ')[1] || s || ''
const chapEn = (c) => (c || '').replace(/^অধ্যায়\s*/, 'Chapter ')
const dhakaDay = (iso) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date(iso)) } catch { return '' } }

function dateHeader(dateStr) {
  try {
    const d = new Date(dateStr + 'T12:00:00+06:00')
    const dm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', weekday: 'long' }).format(d)
    return `${dm} || ${wd}`
  } catch { return dateStr }
}

function hwLines(h, opt) {
  const L = []
  if (isClassWork(h)) {
    const n = (h.questions?.files || []).length
    L.push(isLabWork(h) ? '🧪 Lab Work' : '✍️ Class Work করানো হয়েছে।' + (n ? ` (${n}টি ফাইল/ছবি)` : ''))
    if (h.note) L.push(h.note)
    return L
  }
  if (h.chapter) L.push(chapEn(h.chapter))
  const wt = HW_TYPES.find(t => t.value === h.work_type)?.label
  if (wt) L.push(wt.replace(/^[^\wঀ-৿]+\s*/u, ''))
  if (opt.pages && h.page_numbers) L.push('পৃষ্ঠা: ' + h.page_numbers)
  const q = h.questions && !Array.isArray(h.questions) ? h.questions : {}
  const QL = { vsq: 'অতি সংক্ষিপ্ত প্রশ্ন', sq: 'সংক্ষিপ্ত প্রশ্ন', essay: 'রচনা মূলক প্রশ্ন' }
  Object.keys(QL).forEach(k => { if ((q[k] || []).length) L.push(`${QL[k]} : ${q[k].join(' ')}`) })
  const ss = q.sessional || {}
  Object.keys(QL).forEach(k => { if ((ss[k] || []).length) L.push(`Sessional ${QL[k]} : ${ss[k].join(' ')}`) })
  if (q.sign_date) {
    const d = new Date(q.sign_date + 'T12:00:00+06:00')
    L.push(`${chapEn(h.chapter) || 'Chapter'} sign করানো হবে।` + (isNaN(d) ? '' : ` (শেষ তারিখ: ${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short' }).format(d)})`))
  }
  if (opt.due && h.due_date) L.push('জমার তারিখ: ' + h.due_date)
  if (h.note) L.push(h.note)
  return L
}

function UpdateMessageModal({ onClose, homeworks, defaultSection, showToast }) {
  const [date, setDate] = useState(todayDhaka())
  const [sec, setSec] = useState(defaultSection || 'all')
  const [sel, setSel] = useState({})            // id -> true/false (ম্যানুয়াল বাছাই)
  const [opt, setOpt] = useState({ pages: true, due: false })
  const [custom, setCustom] = useState([])       // [{subject, name, text}]
  const [cSubj, setCSubj] = useState(SUBJECTS[0])
  const [cName, setCName] = useState('')
  const [cText, setCText] = useState('')
  const [manual, setManual] = useState(null)     // হাতে edit করা পুরো টেক্সট

  // তালিকা: সাম্প্রতিক ৬০টি, section অনুযায়ী
  const list = homeworks.filter(h => sec === 'all' || h.section === sec).slice(0, 60)
  const isOn = (h) => sel[h.id] !== undefined ? sel[h.id] : dhakaDay(h.created_at) === date   // ঐ তারিখে যোগ করা গুলো আগে থেকেই টিক
  const picked = list.filter(isOn)

  // বিষয় অনুযায়ী ব্লক (SUBJECTS-এর ক্রম)
  const blocks = {}
  const add = (key, name, lines) => { if (!lines.length) return; (blocks[key] = blocks[key] || { name, groups: [] }).groups.push(lines) }
  picked.forEach(h => add(h.subject, subjName(h.subject), hwLines(h, opt)))
  custom.forEach(c => add(c.name ? 'c:' + c.name : c.subject, c.name || subjName(c.subject), c.text.split('\n').map(x => x.trimEnd()).filter(Boolean)))
  const order = [...SUBJECTS, ...Object.keys(blocks).filter(k => !SUBJECTS.includes(k))]
  const body = order.filter(k => blocks[k]).map(k => `📚${blocks[k].name}\n` + blocks[k].groups.map(g => g.join('\n')).join('\n\n')).join('\n\n\n')
  const auto = `${dateHeader(date)}\n\n${body}`.trimEnd()
  const text = manual !== null ? manual : auto

  const inp = { width: '100%', padding: '9px 11px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 13, outline: 'none' }
  const pill = (on) => ({ padding: '6px 13px', borderRadius: 18, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: on ? '1.5px solid #2563eb' : '1px solid var(--border)', background: on ? 'rgba(37,99,235,.14)' : 'transparent', color: on ? 'var(--c-blue)' : 'var(--muted)' })

  async function copy() {
    try { await navigator.clipboard.writeText(text); showToast('📋 বার্তা কপি হয়েছে — গ্রুপে paste করুন') }
    catch { showToast('কপি হয়নি — টেক্সট বক্স থেকে নিজে কপি করুন', 'err') }
  }
  function share() { if (navigator.share) navigator.share({ text }).catch(() => {}); else copy() }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '18px 18px 0 0', padding: '18px 18px 28px', maxHeight: '94vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>📝 আপডেট বার্তা তৈরি করুন</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>📅 তারিখ</label>
            <input type="date" value={date} onChange={e => { setDate(e.target.value || todayDhaka()); setSel({}); setManual(null) }} style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>🏫 Section</label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {['all', ...SECTIONS].map(x => <button key={x} onClick={() => { setSec(x); setManual(null) }} style={pill(sec === x)}>{x === 'all' ? 'সব' : x}</button>)}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>✅ যেগুলো বার্তায় থাকবে বেছে নিন <span style={{ color: 'var(--muted)', fontWeight: 500 }}>({picked.length} টি)</span></div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, maxHeight: 220, overflowY: 'auto', marginBottom: 8 }}>
          {!list.length ? <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--dim)' }}>কিছু নেই</div> : list.map(h => {
            const on = isOn(h)
            return (
              <label key={h.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '8px 11px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: on ? 'rgba(37,99,235,.07)' : 'transparent' }}>
                <input type="checkbox" checked={on} onChange={e => { setSel(p => ({ ...p, [h.id]: e.target.checked })); setManual(null) }} style={{ marginTop: 3, accentColor: '#2563eb', width: 16, height: 16 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{subjName(h.subject)}{isClassWork(h) ? ' · Class Work' : h.chapter ? ' · ' + chapEn(h.chapter) : ''}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Section {h.section} · {dhakaDay(h.created_at)}{h.note ? ' · ' + h.note.slice(0, 40) : ''}</div>
                </div>
              </label>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => { const m = {}; list.forEach(h => m[h.id] = true); setSel(m); setManual(null) }} style={pill(false)}>সব বেছে নিন</button>
          <button onClick={() => { const m = {}; list.forEach(h => m[h.id] = false); setSel(m); setManual(null) }} style={pill(false)}>সব বাদ দিন</button>
          <button onClick={() => setOpt(o => ({ ...o, pages: !o.pages }))} style={pill(opt.pages)}>📄 পৃষ্ঠা</button>
          <button onClick={() => setOpt(o => ({ ...o, due: !o.due }))} style={pill(opt.due)}>⏰ জমার তারিখ</button>
        </div>

        <div style={{ background: 'rgba(var(--ov),.03)', border: '1px solid rgba(var(--ov),.08)', borderRadius: 10, padding: 11, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 7 }}>➕ নিজের লাইন যোগ করুন <span style={{ color: 'var(--muted)', fontWeight: 500 }}>(যেমন: বইয়ের JOB 2 করাইছে।)</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 7 }}>
            <select value={cSubj} onChange={e => setCSubj(e.target.value)} style={inp}>{SUBJECTS.map(x => <option key={x} value={x}>{subjName(x)}</option>)}</select>
            <input value={cName} onChange={e => setCName(e.target.value)} placeholder="অন্য নাম (ঐচ্ছিক, যেমন DSA Lab)" style={inp} />
          </div>
          <textarea value={cText} onChange={e => setCText(e.target.value)} rows={3} placeholder="প্রতি লাইনে একটা করে লিখুন..." style={{ ...inp, resize: 'vertical' }} />
          <button onClick={() => { if (!cText.trim()) return; setCustom(c => [...c, { subject: cSubj, name: cName.trim(), text: cText }]); setCText(''); setCName(''); setManual(null) }}
            style={{ marginTop: 7, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(37,99,235,.3)', background: 'rgba(37,99,235,.1)', color: 'var(--c-blue)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ যোগ করুন</button>
          {custom.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 7, fontSize: 11, color: 'var(--text-3)', padding: '6px 9px', background: 'var(--surface-2)', borderRadius: 8 }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📚 {c.name || subjName(c.subject)} — {c.text.split('\n')[0]}</span>
              <button onClick={() => { setCustom(a => a.filter((_, j) => j !== i)); setManual(null) }} style={{ background: 'none', border: 'none', color: 'var(--c-red)', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>📨 বার্তা <span style={{ color: 'var(--muted)', fontWeight: 500 }}>(এখানে নিজেও বদলাতে পারবেন)</span></div>
          {manual !== null && <button onClick={() => setManual(null)} style={{ ...pill(false), padding: '3px 10px', fontSize: 11 }}>🔄 আবার তৈরি</button>}
        </div>
        <textarea value={text} onChange={e => setManual(e.target.value)} rows={12} style={{ ...inp, fontFamily: 'inherit', lineHeight: 1.7, resize: 'vertical', whiteSpace: 'pre-wrap' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button onClick={copy} style={{ flex: 1, minWidth: 120, padding: 12, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📋 কপি করুন</button>
          <button onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener')} style={{ flex: 1, minWidth: 120, padding: 12, borderRadius: 10, border: '1px solid rgba(34,197,94,.4)', background: 'rgba(34,197,94,.12)', color: 'var(--c-green)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🟢 WhatsApp</button>
          <button onClick={share} style={{ flex: 1, minWidth: 120, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📤 শেয়ার</button>
        </div>
      </div>
    </div>
  )
}


// ─── টেক্সট paste করে Homework যোগ ───
const SUBJ_KEYS = [
  [/business|communication|ব্যবসা/i, 0], [/digital|electronic|ডিজিটাল/i, 1], [/java|জাভা/i, 2],
  [/\bdsa\b|data\s*struct|algorithm/i, 3], [/peripheral|interfac/i, 4], [/web|design|ওয়েব/i, 5], [/environ|পরিবেশ/i, 6],
]
function matchSubject(name) {
  const code = (name.match(/\b(2\d{4})\b/) || [])[1]
  if (code) { const f = SUBJECTS.find(x => x.startsWith(code)); if (f) return f }
  for (const [re, i] of SUBJ_KEYS) if (re.test(name)) return SUBJECTS[i]
  return ''
}
const bn2en = (t) => (t || '').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d))
const nums = (t) => (bn2en(t).match(/\d+/g) || []).map(Number)

const uniqNums = (arr) => [...new Set(arr)].sort((x, y) => x - y)
const SESS_RE = /seasonal|sessional|sesional|seasional|সেশনাল|সেশনেল|সিজনাল|সেসনাল|সিজোনাল|সিজনেল/i

function parseUpdateText(text) {
  const lines = (text || '').replace(/\r/g, '').split('\n').map(l => l.trim())
  let dateLine = ''
  const items = []
  let cur = null, noticeMode = false
  const notice = []
  for (const l of lines) {
    if (!l) continue
    if (!cur && /\|\|/.test(l) && !l.startsWith('📚')) { dateLine = l; continue }
    if (/^notice\s*[:：-]?/i.test(l)) { noticeMode = true; cur = null; const r = l.replace(/^notice\s*[:：-]?\s*/i, ''); if (r) notice.push(r); continue }
    if (/^(সৌজন্যে|courtesy)/i.test(l)) { noticeMode = true; cur = null; notice.push(l); continue }
    if (noticeMode) { notice.push(l); continue }
    if (l.startsWith('📚')) {
      const name = l.replace(/^📚\s*/, '').trim()
      cur = { name, subject: matchSubject(name), chapter: '', questions: {}, sessional: {}, inSess: false, notes: [], kind: /\blab\b|ল্যাব/i.test(name) ? 'labwork' : 'hw' }
      items.push(cur); continue
    }
    if (!cur) continue
    const qm = l.match(/^(অতি\s*সংক্ষিপ্ত|সংক্ষিপ্ত|রচনা\s*মূলক|রচনামূলক|রচনা)\s*(?:প্রশ্নোত্তর|প্রশ্ন)?\s*[:：;\-–]?\s*(.*)$/)
    if (qm && nums(qm[2]).length) {
      const k = /অতি/.test(qm[1]) ? 'vsq' : /রচনা/.test(qm[1]) ? 'essay' : 'sq'
      const tgt = cur.inSess ? cur.sessional : cur.questions
      tgt[k] = uniqNums([...(tgt[k] || []), ...nums(qm[2])]); continue
    }
    const cw = l.match(/^(?:class\s*work|ক্লাস\s*ওয়ার্ক|ক্লাসওয়ার্ক)\s*[:：;\-–]?\s*(.*)$/i)
    if (cw) { cur.kind = 'classwork'; if (cw[1].trim()) cur.notes.push(cw[1].trim()); continue }   // "class work" লাইন → সরাসরি Class Work
    const lw = l.match(/^(?:lab\s*work|ল্যাব\s*ওয়ার্ক|ল্যাবওয়ার্ক)\s*[:：;\-–]?\s*(.*)$/i)
    if (lw) { cur.kind = 'labwork'; if (lw[1].trim()) cur.notes.push(lw[1].trim()); continue }   // "lab work" লাইন → সরাসরি Lab Work
    if (SESS_RE.test(l) && !nums(l.replace(SESS_RE, '')).length) { cur.inSess = true; continue }   // "এখান থেকে Seasonal খাতায় লিখতে হবে"
    // লাইনে "ক্লাস"/"class" থাকলে (যেমন "ক্লাসে 3.1 পড়ানো হয়েছে।") সেটা Class Work — Lab ব্লক ছাড়া
    if (cur.kind === 'hw' && /ক্লাস|\bclass\b/i.test(l)) { cur.kind = 'classwork'; cur.notes.push(l); continue }
    const cm = bn2en(l).match(/^(?:chapter|অধ্যায়)\s*[-:]?\s*(\d+)\s*(.*)$/i)
    if (cm) {
      const rest = cm[2].trim()
      if (!rest) { if (!cur.chapter) cur.chapter = `অধ্যায় ${cm[1]}`; else cur.notes.push(l); continue }
      if (/sign|সাইন/i.test(rest) || cur.chapter) { cur.notes.push(l); continue }
      cur.chapter = `অধ্যায় ${cm[1]}`; cur.notes.push(rest); continue
    }
    cur.notes.push(l)
  }
  const out = items.map(it => ({ ...it, note: it.notes.join('\n'), on: true }))
  if (notice.length) out.push({ name: 'Notice', subject: '', chapter: '', questions: {}, sessional: {}, note: notice.join('\n'), on: false })
  return { dateLine, items: out }
}

function PasteAddModal({ onClose, onSave, defaultSection }) {
  const [text, setText] = useState('')
  const [secs, setSecs] = useState(defaultSection ? [defaultSection] : [])
  const [due, setDue]   = useState('')
  const [addDate, setAddDate] = useState(todayDhaka())
  const [items, setItems] = useState(null)
  const [dateLine, setDateLine] = useState('')
  const [busy, setBusy] = useState(false)

  const inp = { width: '100%', padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none' }
  const pill = (on) => ({ padding: '6px 13px', borderRadius: 18, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: on ? '1.5px solid #2563eb' : '1px solid var(--border)', background: on ? 'rgba(37,99,235,.14)' : 'transparent', color: on ? 'var(--c-blue)' : 'var(--muted)' })
  const upd = (i, patch) => setItems(a => a.map((x, j) => j === i ? { ...x, ...patch } : x))
  const QL = { vsq: 'অতি সংক্ষিপ্ত', sq: 'সংক্ষিপ্ত', essay: 'রচনা' }
  const ready = (items || []).filter(x => x.on && x.subject)

  function analyze() {
    const r = parseUpdateText(text); setItems(r.items.map(x => ({ ...x, files: [] }))); setDateLine(r.dateLine)
    const m = r.dateLine.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/)
    if (m) { const mo = ['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(m[2].toLowerCase()); if (mo >= 0) setAddDate(`${m[3]}-${String(mo + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`) }
  }
  async function save() {
    if (!secs.length) { alert('কমপক্ষে একটা Section বেছে নিন'); return }
    if (!ready.length) { alert('যোগ করার মতো বিষয় নেই'); return }
    setBusy(true); await onSave({ items: ready, sections: secs, due, addDate }); setBusy(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '18px 18px 0 0', padding: '18px 18px 28px', maxHeight: '94vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>📥 টেক্সট থেকে Homework যোগ</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>দৈনিক আপডেট টেক্সট (📚 বিষয় / Chapter / প্রশ্ন) paste করুন — ওয়েবসাইট নিজেই পড়ে Homework বানাবে।</p>

        {!items ? (<>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={13} placeholder={'1 November 2026 || Sunday\n\n📚Environmental Studies\nChapter 3\nরচনা মূলক প্রশ্ন :1 2 4'} style={{ ...inp, fontSize: 13, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit' }} />
          <button onClick={analyze} disabled={!text.trim()} style={{ marginTop: 10, width: '100%', padding: 12, borderRadius: 10, border: 'none', background: text.trim() ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : 'var(--surface-2)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🔍 পড়ে দেখুন</button>
        </>) : (<>
          {dateLine && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>📅 {dateLine}</div>}
          {!items.length && <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--c-red)' }}>কোনো 📚 বিষয় পাওয়া যায়নি। প্রতিটি বিষয়ের আগে 📚 দিন।</div>}
          {items.map((it, i) => (
            <div key={i} style={{ border: '1px solid ' + (it.on && it.subject ? 'var(--border)' : 'rgba(239,68,68,.35)'), borderRadius: 10, padding: 10, marginBottom: 8, opacity: it.on ? 1 : .5 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 7 }}>
                <input type="checkbox" checked={it.on} onChange={e => upd(i, { on: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#2563eb' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>📚 {it.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 7 }}>
                {[['hw', '📚 Homework'], ['classwork', '🏫 Class Work'], ['labwork', '🧪 Lab Work']].map(([k, t]) => (
                  <button key={k} onClick={() => upd(i, { kind: k })} style={pill((it.kind || 'hw') === k)}>{t}</button>
                ))}
              </div>
              <select value={it.subject} onChange={e => upd(i, { subject: e.target.value })} style={{ ...inp, marginBottom: 6 }}>
                <option value="">-- বিষয় বেছে নিন (মেলেনি) --</option>
                {SUBJECTS.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 6, marginBottom: 6 }}>
                <select value={it.chapter} onChange={e => upd(i, { chapter: e.target.value })} style={inp}>
                  <option value="">Chapter নেই</option>
                  {CHAPTERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input value={[...Object.keys(QL).filter(k => (it.questions[k] || []).length).map(k => `${QL[k]}: ${it.questions[k].join(' ')}`), ...Object.keys(QL).filter(k => ((it.sessional || {})[k] || []).length).map(k => `Sessional ${QL[k]}: ${it.sessional[k].join(' ')}`)].join(' | ') || 'প্রশ্ননম্বর নেই'} readOnly style={{ ...inp, color: 'var(--muted)' }} />
              </div>
              <textarea value={it.note} onChange={e => upd(i, { note: e.target.value })} rows={Math.min(5, Math.max(2, it.note.split('\n').length))} placeholder="💬 শিক্ষকের নোট / বিবরণ" style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 7, padding: '6px 12px', borderRadius: 8, border: '1px dashed var(--border)', color: 'var(--c-blue)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                📷 ছবি / PDF যোগ করুন
                <input type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }} onChange={e => { const f = [...e.target.files]; e.target.value = ''; upd(i, { files: [...(it.files || []), ...f] }) }} />
              </label>
              {(it.files || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                  {it.files.map((f, k) => (
                    <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '3px 8px', borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-3)', maxWidth: 170 }}>
                      {f.type.startsWith('image/') ? '🖼' : '📄'} <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <button onClick={() => upd(i, { files: it.files.filter((_, j) => j !== k) })} style={{ background: 'none', border: 'none', color: 'var(--c-red)', cursor: 'pointer' }}>✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '10px 0' }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>🏫 Section *</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {SECTIONS.map(x => <button key={x} onClick={() => setSecs(a => a.includes(x) ? a.filter(y => y !== x) : [...a, x])} style={pill(secs.includes(x))}>{x}</button>)}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>📅 যোগ তারিখ (মূল তারিখ)</label>
              <input type="date" value={addDate} onChange={e => setAddDate(e.target.value || todayDhaka())} style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>⏰ জমার তারিখ (ঐচ্ছিক)</label>
              <input type="date" value={due} onChange={e => setDue(e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setItems(null)} style={{ ...pill(false), padding: '12px 16px' }}>← টেক্সট বদলান</button>
            <button onClick={save} disabled={busy || !ready.length} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: ready.length ? 1 : .5 }}>
              {busy ? 'যোগ/আপলোড হচ্ছে...' : `✅ ${ready.length * secs.length || ready.length}টি Homework যোগ করুন`}
            </button>
          </div>
        </>)}
      </div>
    </div>
  )
}


// ─── Homework শিট: সব Homework সুন্দর করে সাজানো আলাদা পেজ (প্রিন্ট / PDF-ও করা যায়) ───
const subjColor = (subject) => {
  const code = (subject || '').split(' - ')[0]
  return (Object.values(R_SUBJECTS).find(x => x[1] === code) || [])[2] || '#2563eb'
}
const WEEK_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার']

function HomeworkSheet({ homeworks, defaultSection, lockSection, onClose }) {
  const urlSec = (() => { try { return new URL(location.href).searchParams.get('sec') } catch { return null } })()
  const [sec, setSec] = useState(SECTIONS.includes(urlSec) ? urlSec : (defaultSection && defaultSection !== 'all' ? defaultSection : 'all'))
  const [onlyPending, setOnlyPending] = useState(false)
  const urlDay = (() => { try { return new URL(location.href).searchParams.get('day') } catch { return null } })()
  const [day, setDay] = useState(urlDay && /^\d{4}-\d{2}-\d{2}$/.test(urlDay) ? urlDay : '')
  const clearDay = () => { setDay(''); try { const u = new URL(location.href); u.searchParams.delete('day'); history.replaceState(history.state, '', u.pathname + u.search) } catch {} }
  const list = homeworks.filter(h => (sec === 'all' || h.section === sec) && (!onlyPending || !h.is_done) && (!day || dayOf(h.created_at) === day))
  const groups = groupByDay(list)
  const QL = [['vsq', 'অতি সংক্ষিপ্ত', '#059669'], ['sq', 'সংক্ষিপ্ত', '#2563eb'], ['essay', 'রচনা', '#d97706']]
  const bnd = (iso) => { try { return new Date(iso).toLocaleDateString('bn-BD', { timeZone: 'Asia/Dhaka' }) } catch { return '' } }
  const wd = (iso) => { try { return WEEK_BN[new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date(iso)) + 'T12:00:00+06:00').getDay()] } catch { return '' } }

  const chip = (bg, color) => ({ display: 'inline-block', padding: '2px 9px', borderRadius: 20, background: bg, color, fontSize: 12, fontWeight: 700, margin: '0 4px 4px 0' })

  return (
    <div id="hw-sheet-root" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(3,7,18,.78)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }} onClick={onClose}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #hw-sheet, #hw-sheet * { visibility: visible !important; }
          #hw-sheet-root { position: static !important; background: #fff !important; overflow: visible !important; }
          #hw-sheet { position: absolute; left: 0; top: 0; width: 100%; max-width: none !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
          .hw-noprint { display: none !important; }
          .hw-item { break-inside: avoid; }
        }
      `}</style>
      <div id="hw-sheet" onClick={e => e.stopPropagation()} style={{ maxWidth: 860, margin: '0 auto', background: '#f6f8fc', color: '#14213d', minHeight: '100%', padding: '18px 16px 40px', fontFamily: 'inherit', boxShadow: '0 0 60px rgba(0,0,0,.5)', textShadow: 'none' }}>
        <div className="hw-noprint" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#14213d', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← ফিরে যান</button>
          <button onClick={() => { const u = location.origin + '/?sheet=1' + (day ? '&day=' + day : '') + (sec !== 'all' ? '&sec=' + sec : ''); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => alert('✅ লিংক কপি হয়েছে (লগইন করা ইউজার খুলতে পারবে)')).catch(() => alert(u)) }} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#14213d', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>🔗 লিংক</button>
          <button onClick={() => window.print()} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🖨️ প্রিন্ট / PDF</button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.01em' }}>📚 Homework শিট</div>
          <div style={{ fontSize: 13, color: '#5d6b86', marginTop: 2 }}>CST 4th Semester{sec !== 'all' ? ` · Section ${sec}` : ''} · মোট {list.length}টি</div>
          {day && (
            <div className="hw-noprint" style={{ marginTop: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 20, background: '#dbeafe', color: '#1d4ed8', fontSize: 12, fontWeight: 700 }}>
                📅 শুধু {new Date(day + 'T12:00:00+06:00').toLocaleDateString('bn-BD', { timeZone: 'Asia/Dhaka' })}-এর সব
                <button onClick={clearDay} style={{ background: 'none', border: '1px solid #93c5fd', color: '#1d4ed8', borderRadius: 12, padding: '1px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>সব তারিখ দেখুন</button>
              </span>
            </div>
          )}
        </div>

        <div className="hw-noprint" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
          {(lockSection ? [lockSection] : ['all', ...SECTIONS]).map(x => (
            <button key={x} onClick={() => setSec(x)} style={{ padding: '6px 14px', borderRadius: 18, border: sec === x ? '1.5px solid #2563eb' : '1px solid #cbd5e1', background: sec === x ? '#dbeafe' : '#fff', color: sec === x ? '#1d4ed8' : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{x === 'all' ? 'সব Section' : 'Section ' + x}</button>
          ))}
          <button onClick={() => setOnlyPending(v => !v)} style={{ padding: '6px 14px', borderRadius: 18, border: onlyPending ? '1.5px solid #16a34a' : '1px solid #cbd5e1', background: onlyPending ? '#dcfce7' : '#fff', color: onlyPending ? '#15803d' : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⏳ শুধু বাকি</button>
        </div>

        {!groups.length && <div style={{ textAlign: 'center', padding: 50, color: '#64748b' }}>কোনো Homework নেই</div>}

        {groups.map(g => (
          <div key={dayOf(g[0].created_at) + g[0].section} style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', borderBottom: '2px solid #2563eb', paddingBottom: 5, marginBottom: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#1d4ed8' }}>📅 {bnd(g[0].created_at)}</span>
              <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>{wd(g[0].created_at)}</span>
              <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>Section {g[0].section}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 10 }}>
              {g.map(h => {
                const color = subjColor(h.subject)
                const q = h.questions && !Array.isArray(h.questions) ? h.questions : {}
                const cw = isClassWork(h)
                const files = cw ? (q.files || []) : (q.images || [])
                const ss = q.sessional || {}
                const wt = (HW_TYPES.find(t => t.value === h.work_type)?.label || '')
                return (
                  <div key={h.id} className="hw-item" style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', borderLeft: `5px solid ${color}`, padding: '10px 12px', opacity: h.is_done ? .6 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.25 }}>{subjName(h.subject)}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{(h.subject || '').split(' - ')[0]}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', color: cw ? (isLabWork(h) ? '#0f766e' : '#b45309') : '#475569' }}>
                        {cw ? (isLabWork(h) ? '🧪 Lab Work' : '🏫 Class Work') : (h.chapter ? '📖 ' + chapEn(h.chapter) : '')}{h.is_done ? ' ✓' : ''}
                      </span>
                    </div>
                    {!cw && (wt || h.page_numbers) && (
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 5 }}>{wt.replace(/^[^\wঀ-৿]+\s*/u, '')}{h.page_numbers ? ` · পৃষ্ঠা ${h.page_numbers}` : ''}</div>
                    )}
                    {!cw && QL.filter(([k]) => (q[k] || []).length).map(([k, l, c]) => (
                      <div key={k} style={{ marginTop: 7 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c, marginBottom: 3 }}>{l} প্রশ্ন</div>
                        {q[k].map(n => <span key={n} style={chip(c + '1a', c)}>{n}</span>)}
                      </div>
                    ))}
                    {!cw && QL.some(([k]) => (ss[k] || []).length) && (
                      <div style={{ marginTop: 7, padding: '6px 8px', borderRadius: 8, background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#6d28d9', marginBottom: 3 }}>📒 Sessional খাতায়</div>
                        {QL.filter(([k]) => (ss[k] || []).length).map(([k, l, c]) => (
                          <div key={k} style={{ fontSize: 12, color: '#334155' }}><b style={{ color: c }}>{l}:</b> {ss[k].join(', ')}</div>
                        ))}
                      </div>
                    )}
                    {!cw && q.sign_date && <div style={{ fontSize: 12, color: '#b45309', marginTop: 6, fontWeight: 600 }}>✍️ সাইন করার শেষ তারিখ: {bnd(q.sign_date + 'T12:00:00+06:00')}</div>}
                    {h.note && <div style={{ marginTop: 7, fontSize: 12.5, color: '#334155', background: '#f1f5f9', borderRadius: 8, padding: '6px 9px', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>💬 {h.note}</div>}
                    {files.length > 0 && <div style={{ marginTop: 8 }}><ClassWorkFiles files={files} /></div>}
                    {h.due_date && !cw && <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>⏰ জমার তারিখ: {h.due_date}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Homework({ isAdmin, isGroupAdmin, isCR, adminSection, showToast, userRoll, userSectionProp }) {
  const [homeworks,   setHomeworks]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showAdd,     setShowAdd]     = useState(false)
  const [showBulk,    setShowBulk]    = useState(false)
  const [showMsg,     setShowMsg]     = useState(false)
  const [showPaste,   setShowPaste]   = useState(false)
  const [editCw,      setEditCw]      = useState(null)
  const sheetInUrl = () => { try { return new URL(location.href).searchParams.has('sheet') } catch { return false } }
  const [showSheet,    setShowSheet]   = useState(sheetInUrl)
  // সুন্দর পেজ = নিজস্ব লিঙ্ক (?sheet=1); ব্রাউজারের Back দিয়েও ফেরা যায়
  const openSheet = (day, sec) => {
    const sc = sec || (filterSec !== 'all' ? filterSec : '')
    try { history.pushState({ sheet: 1 }, '', '?sheet=1' + (day ? '&day=' + day : '') + (sc ? '&sec=' + sc : '')) } catch {}
    setShowSheet(true)
  }
  const closeSheet = () => {
    if (history.state && history.state.sheet) history.back()
    else { try { history.replaceState(null, '', location.pathname) } catch {} ; setShowSheet(false) }
  }
  useEffect(() => {
    const onPop = () => setShowSheet(sheetInUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const [openBoxes, setOpenBoxes] = useState({})   // তারিখ-বক্স খোলা/বন্ধ (ক্লিক করলে বিষয়গুলো দেখায়)
  const [editHw,      setEditHw]      = useState(null)
  const [focus, setFocus] = useState(() => { try { const u = new URL(location.href); const q = u.searchParams
    if (q.get('hwd')) return { day: q.get('hwd'), sec: q.get('sec') || '' }
    if (q.get('hwb')) return { batch: q.get('hwb') }
    if (q.get('hw'))  return { id: q.get('hw') }
    return null } catch { return null } })
  const clearFocus = () => { setFocus(null); try { history.replaceState(null, '', location.pathname) } catch {} }
  const [filterSec,   setFilterSec]   = useState(() => { try { const u = new URL(location.href); const x = u.searchParams.get('sec'); return u.searchParams.has('hwd') && SECTIONS.includes(x) ? x : 'all' } catch { return 'all' } })
  const [filterSubj,  setFilterSubj]  = useState('all')
  const [filterChap,  setFilterChap]  = useState('all')
  const [filterDone,  setFilterDone]  = useState('pending')
  const [searchQ,     setSearchQ]     = useState('')
  const canManage = isAdmin || isGroupAdmin
  const canCompose = canManage || !!isCR   // CR-ও টেক্সট থেকে যোগ / আপডেট বার্তা / সব বিষয়ে ব্যবহার করতে পারবে

  // userRoll বা adminSection যখনই আসুক — auto section set
  useEffect(() => {
    if (isAdmin) return
    if (isGroupAdmin && adminSection) { setFilterSec(adminSection); return }
    // প্রোফাইলের Section (বদলানো হলে সেটা) আগে, না থাকলে রোল থেকে
    const s = SECTIONS.includes(userSectionProp) ? userSectionProp : (userRoll ? rollToSection(userRoll) : null)
    if (s) setFilterSec(s)
  }, [userRoll, isGroupAdmin, adminSection, userSectionProp])

  async function loadHw() {
    setLoading(true)
    const { data } = await sb.from('homeworks').select('*').order('created_at', { ascending: false })
    if (data) setHomeworks(normRows(data))
    setLoading(false)
  }

  useEffect(() => {
    loadHw()
    const ch = sb.channel('hw-ch')
      .on('postgres_changes', { event:'*', schema:'public', table:'homeworks' }, loadHw)
      .subscribe()
    return () => sb.removeChannel(ch)
  }, [])

  async function addHw(data) {
    const { error } = await sb.from('homeworks').insert(data)
    if (error) { showToast('ব্যর্থ: ' + error.message, 'err'); return }
    showToast('✅ Homework যোগ হয়েছে')
    loadHw()
    // Section এর user দের push notification পাঠাও
    try {
      const { triggerNotification, pushResultText } = await import('../push')
      const r = await triggerNotification({
        section: data.section || 'all',
        title:   '📚 নতুন Homework যোগ হয়েছে!',
        body:    `${data.subject || ''} — ${data.chapter || ''} | জমার তারিখ: ${data.due_date || '—'}`,
        url:     '/?go=homework',
      })
      setTimeout(() => showToast(pushResultText(r), r.ok ? 'ok' : 'err'), 1200)
    } catch {}
  }

  async function bulkAdd({ section, dueDate, chapter, note }) {
    const rows = SUBJECTS.map(s => ({
      subject:   s,
      section,
      chapter:   chapter || null,
      due_date:  dueDate || null,
      note:      note || null,
      is_done:   false,
      questions: {},
    }))
    const { error } = await sb.from('homeworks').insert(rows)
    if (error) { showToast('ব্যর্থ: ' + error.message, 'err'); return }
    showToast(`✅ সব ${SUBJECTS.length}টি বিষয়ে Homework যোগ হয়েছে!`)
    loadHw()
    setShowBulk(false)
    try {
      const { triggerNotification, pushResultText } = await import('../push')
      const r = await triggerNotification({
        section,
        title: '📚 সব বিষয়ে Homework যোগ হয়েছে!',
        body:  `জমার তারিখ: ${dueDate || '—'}`,
        url:   '/?go=homework',
      })
      setTimeout(() => showToast(pushResultText(r), r.ok ? 'ok' : 'err'), 1200)
    } catch {}
  }

  async function pasteAdd({ items, sections, due, addDate }) {
    const rows = []
    const createdAt = new Date(`${addDate}T${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka' })}+06:00`)
    const iso = isNaN(createdAt) ? new Date().toISOString() : createdAt.toISOString()
    try {
      for (const it of items) {
        it.images = []
        for (const f of (it.files || [])) {
          showToast(`⏳ ${f.name} আপলোড হচ্ছে...`)
          const { downloadUrl, fileId } = await uploadToR2(f)
          it.images.push({ name: f.name, url: downloadUrl, key: fileId, type: f.type || '', size: f.size })
        }
      }
    } catch (e) { showToast('ছবি আপলোড ব্যর্থ: ' + (e.message || e), 'err'); return }
    sections.forEach(sec => items.forEach(it => rows.push({
      subject: it.subject, section: sec, chapter: it.chapter || null, due_date: due || null,
      note: it.note?.trim() || null, is_done: false, created_at: iso,
      questions: it.kind && it.kind !== 'hw'
        ? { kind: it.kind, files: it.images }
        : { ...(it.questions || {}), ...(Object.keys(it.sessional || {}).length ? { sessional: it.sessional } : {}), ...(it.images.length ? { images: it.images } : {}) },
    })))
    const { error } = await sb.from('homeworks').insert(rows)
    if (error) { showToast('ব্যর্থ: ' + error.message, 'err'); return }
    showToast(`✅ ${rows.length}টি Homework যোগ হয়েছে`)
    loadHw(); setShowPaste(false)
    try {
      const { triggerNotification, pushResultText } = await import('../push')
      const r = await triggerNotification({
        section: sections.length === 1 ? sections[0] : 'all',
        title: '📚 নতুন Homework যোগ হয়েছে!',
        body: items.map(i => i.subject.split(' - ')[1] || i.subject).join(', '),
        url: '/?go=homework',
      })
      setTimeout(() => showToast(pushResultText(r), r.ok ? 'ok' : 'err'), 1200)
    } catch {}
  }

  async function updateHw(data) {
    let { error } = await sb.from('homeworks').update(data).eq('id', editHw.id)
    // updated_at কলাম না থাকলে (SQL চালানো হয়নি) তা বাদ দিয়েই সংরক্ষণ করো
    if (error && /updated_at/.test(error.message || '')) {
      const { updated_at, ...rest } = data
      ;({ error } = await sb.from('homeworks').update(rest).eq('id', editHw.id))
    }
    if (error) { showToast('ব্যর্থ: ' + error.message, 'err'); return }
    showToast('✅ আপডেট হয়েছে')
    loadHw()
  }

  async function deleteHw(id) {
    if (!confirm('মুছে দিতে চান?')) return
    await sb.from('homeworks').delete().eq('id', id)
    showToast('✅ মুছে দেওয়া হয়েছে')
    loadHw()
  }

  async function toggleDone(id, val) {
    await sb.from('homeworks').update({ is_done: val }).eq('id', id)
    setHomeworks(prev => prev.map(h => h.id === id ? { ...h, is_done: val } : h))
  }

  // Filters
  let shown = [...homeworks]
  if (focus) {
    shown = shown.filter(h => focus.day ? (dayOf(h.created_at) === focus.day && (!focus.sec || h.section === focus.sec))
      : focus.batch ? h.questions?.batch === focus.batch : h.id === focus.id)
  } else {
  if (filterSec  !== 'all') shown = shown.filter(h => h.section === filterSec)
  if (filterSubj !== 'all') shown = shown.filter(h => h.subject === filterSubj)
  if (filterChap !== 'all') shown = shown.filter(h => h.chapter === filterChap)
  if (filterDone === 'pending') shown = shown.filter(h => !h.is_done)
  if (filterDone === 'done')    shown = shown.filter(h => h.is_done)
  if (searchQ.trim()) {
    const q = searchQ.trim().toLowerCase()
    shown = shown.filter(h => (h.subject||'').toLowerCase().includes(q) || (h.note||'').toLowerCase().includes(q) || (h.chapter||'').includes(q))
  }
  }

  const pending = homeworks.filter(h => !h.is_done).length
  const done    = homeworks.filter(h => h.is_done).length

  // Counts per section
  const secCounts = { A: 0, B: 0, C: 0 }
  homeworks.filter(h=>!h.is_done).forEach(h => { if(secCounts[h.section]!==undefined) secCounts[h.section]++ })

  const sectionColors = { A: 'var(--c-green)', B: 'var(--c-blue)', C: 'var(--c-violet)' }
  const inp = { width:'100%', padding:'10px 12px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:10, color:'var(--text)', fontSize:13, outline:'none' }

  // Auto-detected user section
  const userSection = SECTIONS.includes(userSectionProp) ? userSectionProp : (userRoll ? rollToSection(userRoll) : null)

  return (
    <div>
      {showAdd  && <HwModal      onClose={() => setShowAdd(false)}  onSave={addHw}  />}
      {showBulk && <BulkAddModal onClose={() => setShowBulk(false)} onSave={bulkAdd} defaultSection={filterSec !== 'all' ? filterSec : ''} />}
      {editHw && <HwModal onClose={() => setEditHw(null)} onSave={updateHw} initial={editHw} />}
      {editCw && <CwEditModal hw={editCw} onClose={() => setEditCw(null)} onSave={async d => { const { error } = await sb.from('homeworks').update(d).eq('id', editCw.id); if (error) { showToast('ব্যর্থ: ' + error.message, 'err'); return } showToast('✅ আপডেট হয়েছে'); setEditCw(null); loadHw() }} />}
      {showSheet && <HomeworkSheet homeworks={homeworks} defaultSection={filterSec} lockSection={isGroupAdmin && adminSection ? adminSection : ''} onClose={closeSheet} />}
      {showPaste && <PasteAddModal onClose={() => setShowPaste(false)} onSave={pasteAdd} defaultSection={filterSec !== 'all' ? filterSec : ''} />}
      {showMsg && <UpdateMessageModal onClose={() => setShowMsg(false)} homeworks={homeworks} defaultSection={filterSec !== 'all' ? filterSec : ''} showToast={showToast} />}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:18, gap:14, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:700, color:'var(--text-strong)' }}>📚 Homework</h1>
          <p style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>বাড়ির কাজের তালিকা</p>
          {userSection && !isAdmin && (
            <div style={{ marginTop:6, fontSize:11, color: sectionColors[userSection], background:'rgba(37,99,235,.06)', border:`1px solid color-mix(in srgb, ${sectionColors[userSection]} 19%, transparent)`, padding:'3px 10px', borderRadius:6, display:'inline-block' }}>
              আপনার Section: <strong>{userSection}</strong> (Auto)
            </div>
          )}
        </div>
        <LiveClock />
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {/* Stats */}
          <div style={{ display:'flex', gap:6 }}>
            <div style={{ padding:'6px 12px', background:'rgba(217,119,6,.08)', border:'1px solid rgba(217,119,6,.2)', borderRadius:8, textAlign:'center' }}>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--c-amber)' }}>{pending}</div>
              <div style={{ fontSize:10, color:'var(--muted)' }}>বাকি</div>
            </div>
            <div style={{ padding:'6px 12px', background:'rgba(5,150,105,.08)', border:'1px solid rgba(5,150,105,.2)', borderRadius:8, textAlign:'center' }}>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--c-green)' }}>{done}</div>
              <div style={{ fontSize:10, color:'var(--muted)' }}>শেষ</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => openSheet()} style={{
              padding:'9px 14px', borderRadius:10,
              background:'rgba(8,145,178,.12)', border:'1px solid rgba(8,145,178,.3)',
              color:'var(--c-cyan)', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
            }}>🖼️ সুন্দর পেজে দেখুন</button>
            {canCompose && (
              <button onClick={() => setShowPaste(true)} style={{
                padding:'9px 14px', borderRadius:10,
                background:'rgba(22,163,74,.12)', border:'1px solid rgba(22,163,74,.3)',
                color:'var(--c-green)', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
              }}>📥 টেক্সট থেকে যোগ</button>
            )}
            {canCompose && (
              <button onClick={() => setShowMsg(true)} style={{
                padding:'9px 14px', borderRadius:10,
                background:'rgba(124,58,237,.12)', border:'1px solid rgba(124,58,237,.28)',
                color:'var(--c-violet)', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
              }}>📝 আপডেট বার্তা</button>
            )}
            {canCompose && (
              <button onClick={() => setShowBulk(true)} style={{
                padding:'9px 14px', borderRadius:10,
                background:'rgba(5,150,105,.12)', border:'1px solid rgba(5,150,105,.25)',
                color:'var(--c-green)', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
              }}>📋 সব বিষয়ে</button>
            )}
            <button onClick={() => setShowAdd(true)} style={{
              padding:'9px 16px', borderRadius:10,
              background: isAdmin ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : 'rgba(37,99,235,.12)',
              border: isAdmin ? 'none' : '1px solid rgba(37,99,235,.25)',
              color: isAdmin ? '#fff' : 'var(--c-blue)', fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
            }}>
              + {isAdmin ? 'নতুন যোগ করুন' : 'Homework যোগ করুন'}
            </button>
          </div>
          
        </div>
      </div>

      {/* Section pills with counts */}
      <div className="m-scroll-row" style={{ display:'flex', gap:7, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        {/* Group Admin সব section দেখতে পারবে না */}
        {!isGroupAdmin && (
          <button onClick={() => setFilterSec('all')} style={{
            padding:'7px 16px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:600,
            border: filterSec==='all' ? '1.5px solid rgba(var(--ov),.2)' : '1px solid var(--border)',
            background: filterSec==='all' ? 'rgba(var(--ov),.06)' : 'transparent',
            color: filterSec==='all' ? 'var(--text)' : 'var(--muted)',
          }}>সব Section</button>
        )}
        {SECTIONS.map(s => {
          const active = filterSec === s
          const col = sectionColors[s]
          // Group Admin শুধু নিজের section দেখবে, অন্য section click করতে পারবে না
          if (isGroupAdmin && s !== adminSection) return null
          return (
            <button key={s} onClick={() => !isGroupAdmin && setFilterSec(s)} style={{
              padding:'7px 16px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:600,
              border: active ? `1.5px solid color-mix(in srgb, ${col} 38%, transparent)` : '1px solid var(--border)',
              background: active ? `rgba(${s==='A'?'16,185,129':s==='B'?'37,99,235':'124,58,237'},.12)` : 'transparent',
              color: active ? col : 'var(--muted)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              Section {s}
              {secCounts[s] > 0 && (
                <span style={{ fontSize:10, background: active ? `color-mix(in srgb, ${col} 12%, transparent)` : 'rgba(var(--ov),.05)', color: active ? col : 'var(--muted)', padding:'1px 6px', borderRadius:10 }}>
                  {secCounts[s]}
                </span>
              )}
            </button>
          )
        })}
        <span style={{ fontSize:12, color:'var(--dim)', marginLeft:'auto' }}>{shown.length} টি</span>
      </div>

      {/* Filters */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px', marginBottom:14 }}>
        <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, marginBottom:10 }}>🔍 ফিল্টার</div>
        <div className="m-filter-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:14 }}>
          <div>
            <label style={{ fontSize:10, color:'var(--dim)', display:'block', marginBottom:4 }}>বিষয়</label>
            <select value={filterSubj} onChange={e=>setFilterSubj(e.target.value)} style={inp}>
              <option value="all">সব বিষয়</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s.split(' - ')[1] || s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, color:'var(--dim)', display:'block', marginBottom:4 }}>অধ্যায়</label>
            <select value={filterChap} onChange={e=>setFilterChap(e.target.value)} style={inp}>
              <option value="all">সব অধ্যায়</option>
              {CHAPTERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, color:'var(--dim)', display:'block', marginBottom:4 }}>অবস্থা</label>
            <select value={filterDone} onChange={e=>setFilterDone(e.target.value)} style={inp}>
              <option value="all">সব</option>
              <option value="pending">বাকি আছে</option>
              <option value="done">শেষ হয়েছে</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, color:'var(--dim)', display:'block', marginBottom:4 }}>খুঁজুন</label>
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} style={inp} placeholder="বিষয়/নোট লিখুন..." />
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--dim)' }}>
          <div style={{ width:28,height:28,border:'3px solid rgba(37,99,235,.2)',borderTopColor:'#2563eb',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto 10px' }}/>
          লোড হচ্ছে...
        </div>
      ) : shown.length === 0 ? (
        <div style={{ textAlign:'center', padding:48, color:'var(--dim)', border:'1px dashed var(--border)', borderRadius:12 }}>
          <div style={{ fontSize:32, marginBottom:8, opacity:.3 }}>📭</div>
          <p>কোনো Homework নেই</p>
          {focus && <button onClick={clearFocus} style={{ marginTop:10, padding:'7px 14px', borderRadius:8, border:'1px solid rgba(37,99,235,.35)', background:'rgba(37,99,235,.1)', color:'var(--c-blue)', fontSize:12, fontWeight:600, cursor:'pointer' }}>সব Homework দেখুন</button>}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {focus && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'8px 12px', borderRadius:10, background:'rgba(37,99,235,.1)', border:'1px solid rgba(37,99,235,.25)', fontSize:12, color:'var(--c-blue)', fontWeight:600 }}>
              <span>🔗 শেয়ার করা Homework দেখাচ্ছে</span>
              <button onClick={clearFocus} style={{ background:'none', border:'1px solid rgba(37,99,235,.35)', color:'var(--c-blue)', borderRadius:7, padding:'3px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}>সব Homework দেখুন</button>
            </div>
          )}
          {groupByDay(shown).map(g => {
            const day = dayOf(g[0].created_at)
            const bkey = day + '|' + g[0].section
            const nHw = g.filter(x => !isClassWork(x)).length, nCw = g.filter(isClassWork).length
            const open = !!focus || !!searchQ.trim() || !!openBoxes[bkey]
            const toggleBox = () => setOpenBoxes(o => ({ ...o, [bkey]: !o[bkey] }))
            return (
              <div key={bkey} style={{ border:'1px solid var(--border)', borderRadius:14, padding:10, background:'rgba(37,99,235,.03)', display:'flex', flexDirection:'column', gap:8 }}>
                <div role="button" tabIndex={0} aria-expanded={open} onClick={toggleBox} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBox() } }}
                  style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8, padding:'6px 6px', cursor:'pointer', userSelect:'none' }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--c-blue)' }}>📅 যোগ: {bnDate(g[0].created_at)}</span>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>Section {g[0].section} · {nHw ? nHw + 'টি Homework' : ''}{nHw && nCw ? ' + ' : ''}{nCw ? nCw + 'টি Class/Lab Work' : ''}</span>
                  <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
                    <button onClick={e => { e.stopPropagation(); openSheet(day, g[0].section) }}
                      style={{ background:'linear-gradient(135deg,#2563eb,#1d4ed8)', border:'none', color:'#fff', borderRadius:8, padding:'5px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                      👁 দেখুন
                    </button>
                    <button onClick={e => {
                        e.stopPropagation()
                        const url = window.location.origin + '/?hwd=' + day + '&sec=' + g[0].section
                        if (navigator.share) { navigator.share({ title: 'Homework — ' + bnDate(g[0].created_at), url }).catch(()=>{}) }
                        else { navigator.clipboard.writeText(url).then(() => alert('✅ এই দিনের সব বিষয়ের লিংক কপি হয়েছে!')) }
                      }}
                      style={{ background:'rgba(52,211,153,.08)', border:'1px solid rgba(52,211,153,.25)', color:'var(--c-green)', borderRadius:7, padding:'3px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                      🔗 সব একসাথে শেয়ার
                    </button>
                    <span style={{ fontSize:14, color:'var(--muted)', transition:'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
                  </span>
                  {!open && (
                    <div style={{ flexBasis:'100%', fontSize:11, color:'var(--text-3)', lineHeight:1.6 }}>
                      {g.map(h => (h.subject || '').split(' - ')[1] || h.subject).join(' · ')}
                    </div>
                  )}
                </div>
                {open && g.map(hw => isClassWork(hw)
                  ? <ClassWorkCard key={hw.id} hw={hw} canDelete={canManage} onDelete={deleteHw} onEdit={canManage ? setEditCw : null} />
                  : <HwCard key={hw.id} hw={hw} isAdmin={isAdmin} canManage={canManage} onDelete={deleteHw} onToggleDone={toggleDone} onEdit={setEditHw} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
