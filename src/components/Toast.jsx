export default function Toast({ msg, type }) {
  const colors = {
    ok:  { border: 'rgba(16,185,129,.4)', color: 'var(--c-green)' },
    err: { border: 'rgba(239,68,68,.4)',  color: 'var(--c-red)' },
  }
  const c = colors[type] || colors.ok
  return (
    <div className="toast-pop" style={{
      position: 'fixed', bottom: 24, right: 24,
      padding: '12px 18px', borderRadius: 12,
      background: 'var(--surface-strong)', WebkitBackdropFilter: 'blur(18px) saturate(160%)', backdropFilter: 'blur(18px) saturate(160%)', border: `1px solid ${c.border}`,
      color: c.color, fontSize: 13, zIndex: 9998,
      maxWidth: 300, boxShadow: '0 8px 28px rgba(15,23,42,.28)',
      animation: 'slideUp .3s ease'
    }}>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
      {msg}
    </div>
  )
}
