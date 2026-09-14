// Small inline SVG line chart: the student's average progress-review score and
// the class reference across the periods of the year. Prints crisply.
export default function TrendChart({ periods, student, reference, width = 300, height = 110 }) {
  const padL = 26, padR = 10, padT = 14, padB = 18
  const n = Math.max(periods.length, 2)
  const x = (i) => padL + (i * (width - padL - padR)) / (n - 1)
  const y = (v) => padT + ((100 - v) * (height - padT - padB)) / 100
  const path = (vals) => {
    const pts = vals.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean)
    return pts.length ? 'M' + pts.map((p) => p.join(',')).join(' L') : ''
  }
  const navy = '#163a63', grey = '#9aa5b1', green = '#6f9f2f'
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxHeight: height, display: 'block' }} role="img" aria-label="Progress over time">
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={padL} x2={width - padR} y1={y(g)} y2={y(g)} stroke="#e5e9ef" strokeWidth="1" />
          <text x={padL - 4} y={y(g) + 3} fontSize="7" textAnchor="end" fill="#6b7280">{g}%</text>
        </g>
      ))}
      {periods.map((p, i) => (
        <text key={p.label} x={x(i)} y={height - 5} fontSize="7.5" textAnchor="middle" fill="#4b5563" fontWeight="600">{p.short || p.label}</text>
      ))}
      <path d={path(reference)} fill="none" stroke={grey} strokeWidth="1.5" strokeDasharray="4 3" />
      <path d={path(student)} fill="none" stroke={green} strokeWidth="2.2" />
      {reference.map((v, i) => v != null && <circle key={'r' + i} cx={x(i)} cy={y(v)} r="2.6" fill={grey} />)}
      {student.map((v, i) => v != null && (
        <g key={'s' + i}>
          <circle cx={x(i)} cy={y(v)} r="3.2" fill={navy} />
          <text x={x(i) + 6} y={y(v) + 3} fontSize="7.5" textAnchor="start" fill={navy} fontWeight="700">{v}%</text>
        </g>
      ))}
    </svg>
  )
}
