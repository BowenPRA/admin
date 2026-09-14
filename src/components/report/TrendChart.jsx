export default function TrendChart({ periods, series, width = 350, height = 100 }) {
  const padL = 26, padR = 10, padT = 10, padB = 18
  const n = Math.max(periods.length, 2)
  const x = (i) => padL + (i * (width - padL - padR)) / (n - 1)
  const y = (v) => padT + ((100 - v) * (height - padT - padB)) / 100
  const path = (vals) => {
    const pts = vals.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean)
    return pts.length ? 'M' + pts.map((p) => p.join(',')).join(' L') : ''
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxHeight: height, display: 'block' }} role="img" aria-label="Academic progress over time">
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={padL} x2={width - padR} y1={y(g)} y2={y(g)} stroke="#e5e9ef" strokeWidth="0.7" />
          <text x={padL - 4} y={y(g) + 3} fontSize="6.5" textAnchor="end" fill="#6b7280">{g}%</text>
        </g>
      ))}
      {periods.map((p, i) => (
        <text key={p.label} x={x(i)} y={height - 4} fontSize="7" textAnchor="middle" fill="#4b5563" fontWeight="600">{p.short || p.label}</text>
      ))}
      {series.map((s) => (
        <g key={s.name}>
          {s.reference && <path d={path(s.reference)} fill="none" stroke={s.color} strokeWidth="1" strokeDasharray="3 2" opacity="0.45" />}
          <path d={path(s.student)} fill="none" stroke={s.color} strokeWidth="1.8" />
          {s.reference && s.reference.map((v, i) => v != null && <circle key={'r' + i} cx={x(i)} cy={y(v)} r="1.8" fill={s.color} opacity="0.45" />)}
          {s.student.map((v, i) => v != null && <circle key={'s' + i} cx={x(i)} cy={y(v)} r="2.5" fill={s.color} />)}
        </g>
      ))}
    </svg>
  )
}
