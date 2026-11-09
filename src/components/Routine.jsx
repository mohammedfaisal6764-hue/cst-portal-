import { ROUTINE_META, R_SUBJECTS, R_DAYS, R_TIMES, R_SLOTS } from '../routine'

const todayName = () => {
  try { return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', weekday: 'long' }).format(new Date()) } catch { return '' }
}
const endOf = (i) => R_TIMES[i + 1] || '02:00'
const AMBER = '#f5a524'

export default function Routine({ userSection }) {
  const today = todayName()
  const other = userSection && userSection !== ROUTINE_META.section

  const th = { padding: '10px 6px', textAlign: 'center', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12, fontWeight: 600 }
  const td = { padding: 6, verticalAlign: 'top', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-strong)' }}>🗓️ ক্লাস রুটিন</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, maxWidth: 560 }}>{ROUTINE_META.place}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[ROUTINE_META.semester, 'Section ' + ROUTINE_META.section, 'Institute Code ' + ROUTINE_META.code].map(t => (
            <span key={t} style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t}</span>
          ))}
        </div>
      </div>

      {other && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 10, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', fontSize: 12, color: 'var(--c-amber)' }}>
          ⚠️ এটি Section {ROUTINE_META.section}-এর রুটিন। আপনার Section {userSection}-এর রুটিন আলাদা হতে পারে।
        </div>
      )}

      <div className="m-scroll-x" style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 1040, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 104, textAlign: 'left', paddingLeft: 12, position: 'sticky', left: 0, zIndex: 2, background: 'var(--surface)', color: 'var(--text-strong)', fontSize: 13 }}>দিন</th>
              {Array.from({ length: 7 }, (_, i) => (
                <th key={i} style={th}>
                  <b style={{ display: 'block', color: 'var(--text)', fontSize: 14 }}>{R_TIMES[i]}</b>{endOf(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {R_DAYS.map(([en, bn]) => {
              const isToday = en === today
              const bg = isToday ? 'rgba(245,165,36,.14)' : undefined
              const cells = []
              let p = 1
              while (p <= 7) {
                const e = (R_SLOTS[en] || []).find(x => x[0] === p)
                if (!e) { cells.push(<td key={p} style={{ ...td, background: bg }}><div style={{ textAlign: 'center', paddingTop: 20, color: 'var(--dim)' }}>–</div></td>); p++; continue }
                const [, span, key, room, teacher, lab] = e
                const [name, , color] = R_SUBJECTS[key]
                cells.push(
                  <td key={p} colSpan={span} style={{ ...td, background: bg }}>
                    <div style={{ borderRadius: 10, padding: '7px 9px', minHeight: 62, height: '100%', borderLeft: `5px solid ${color}`, background: `color-mix(in srgb, ${color} 16%, transparent)` }}>
                      <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.25, color: 'var(--text-strong)' }}>{name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                        {lab ? <b style={{ color }}>Lab · </b> : null}{room} · {teacher}
                      </div>
                    </div>
                  </td>
                )
                p += span
              }
              return (
                <tr key={en}>
                  <th style={{ ...td, width: 104, textAlign: 'left', paddingLeft: 12, verticalAlign: 'middle', position: 'sticky', left: 0, zIndex: 1, background: isToday ? 'rgba(245,165,36,.22)' : 'var(--surface)', boxShadow: isToday ? `inset 4px 0 0 ${AMBER}` : 'none', color: 'var(--text-strong)', fontSize: 13 }}>
                    {bn}{isToday && <div style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>আজ</div>}
                  </th>
                  {cells}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: '8px 16px', marginTop: 18, fontSize: 13 }}>
        {Object.values(R_SUBJECTS).map(([name, code, color]) => (
          <div key={code} style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text)' }}>
            <i style={{ width: 12, height: 12, borderRadius: 4, background: color, flex: 'none' }} />{name}
            <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>{code}</span>
          </div>
        ))}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 14 }}>
        আজকের দিন হাইলাইট করা আছে। Lab ক্লাস ২ period জুড়ে বড় বক্সে দেখানো হয়েছে। শুক্রবার বন্ধ।
      </p>
    </div>
  )
}
