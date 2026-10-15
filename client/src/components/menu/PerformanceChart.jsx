import { useEffect, useMemo, useRef, useState } from 'react'
import { cn, formatNumber } from '../../lib/utils'

// Validated pair (dataviz validator, light surface): green = this week, blue = last week.
// Last week is also dashed so the two lines never rely on colour alone.
const SERIES = [
  { key: 'current', label: 'This week', color: '#05805F' },
  { key: 'previous', label: 'Last week', color: '#3B6FD4', dashed: true },
]

const HEIGHT = 240
const PAD = { top: 14, right: 44, bottom: 28, left: 36 }

function niceMax(value) {
  if (value <= 10) return 10
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = magnitude / 2
  return Math.ceil(value / step) * step
}

const dayLabel = (iso, opts) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', opts)

/** Smooth path through the points that never overshoots them (monotone cubic interpolation). */
function monotonePath(points) {
  if (points.length < 2) return ''
  const n = points.length
  const dx = points.slice(1).map((p, i) => p.x - points[i].x)
  const slopes = points.slice(1).map((p, i) => (p.y - points[i].y) / dx[i])
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0]
    if (i === n - 1) return slopes[n - 2]
    return slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2
  })
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C${points[i].x + h},${points[i].y + tangents[i] * h} ${points[i + 1].x - h},${points[i + 1].y - tangents[i + 1] * h} ${points[i + 1].x},${points[i + 1].y}`
  }
  return d
}

/**
 * Compares daily menu views of the last 7 days with the 7 days before.
 * `data` is the API's `viewsByDay` (14 days, oldest first).
 */
export default function PerformanceChart({ data = [], className }) {
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState(null)

  useEffect(() => {
    const node = wrapRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const days = useMemo(() => {
    const current = data.slice(-7)
    const previous = data.slice(-14, -7)
    return current.map((day, i) => ({ date: day.date, current: day.count, previous: previous[i]?.count ?? 0, previousDate: previous[i]?.date }))
  }, [data])

  const max = niceMax(Math.max(0, ...days.flatMap((d) => [d.current, d.previous])))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f))
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (i) => PAD.left + (days.length > 1 ? (i / (days.length - 1)) * plotW : plotW / 2)
  const y = (v) => PAD.top + plotH - (v / max) * plotH

  const lines = SERIES.map((s) => {
    const points = days.map((d, i) => ({ x: x(i), y: y(d[s.key]) }))
    return { ...s, points, path: monotonePath(points) }
  })
  const current = lines[0]
  const areaPath = current.points.length > 1 ? `${current.path} L${x(days.length - 1)},${y(0)} L${x(0)},${y(0)} Z` : ''

  function indexFromPointer(event) {
    const rect = wrapRef.current.getBoundingClientRect()
    const relative = (event.clientX - rect.left - PAD.left) / (plotW || 1)
    return Math.min(days.length - 1, Math.max(0, Math.round(relative * (days.length - 1))))
  }

  function onKeyDown(event) {
    if (!days.length) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const step = event.key === 'ArrowRight' ? 1 : -1
      setActive((i) => Math.min(days.length - 1, Math.max(0, (i ?? (step > 0 ? -1 : days.length)) + step)))
    }
    if (event.key === 'Escape') setActive(null)
  }

  const activeDay = active != null ? days[active] : null
  const tooltipLeft = active != null ? x(active) : 0
  const flip = active != null && tooltipLeft > width - 170

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-1" aria-hidden>
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-2 text-xs font-medium text-ink-soft">
            <svg width="16" height="4" className="shrink-0">
              <line x1="0" y1="2" x2="16" y2="2" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeDasharray={s.dashed ? '4 3' : undefined} />
            </svg>
            {s.label}
          </span>
        ))}
      </div>

      <div
        ref={wrapRef}
        className="relative rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-600"
        style={{ height: HEIGHT }}
        tabIndex={0}
        role="group"
        aria-label="Menu views per day, this week compared with last week. Use the left and right arrow keys to read each day."
        onPointerMove={(e) => days.length && setActive(indexFromPointer(e))}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        {width > 0 && (
          <svg width={width} height={HEIGHT} className="block overflow-visible" aria-hidden="true">
            <defs>
              <linearGradient id="perf-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={current.color} stopOpacity="0.14" />
                <stop offset="100%" stopColor={current.color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={tick === 0 ? '#cfd6de' : '#e9edf1'}
                  strokeDasharray={tick === 0 ? undefined : '3 4'}
                />
                <text x={PAD.left - 10} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-ink-muted text-[11px] tabular-nums">
                  {formatNumber(tick)}
                </text>
              </g>
            ))}

            {days.map((d, i) => (
              <text key={d.date} x={x(i)} y={HEIGHT - 6} textAnchor="middle" className={cn('text-[11px]', active === i ? 'fill-ink font-semibold' : 'fill-ink-muted')}>
                {dayLabel(d.date, { weekday: 'short' })}
              </text>
            ))}

            {areaPath && <path d={areaPath} fill="url(#perf-area)" />}

            {[...lines].reverse().map((line) => (
              <path
                key={line.key}
                d={line.path}
                fill="none"
                stroke={line.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={line.dashed ? '5 4' : undefined}
              />
            ))}

            {/* Direct labels: the latest value at the end of each line. */}
            {lines.map((line) => {
              const end = line.points[line.points.length - 1]
              if (!end || active != null) return null
              return (
                <g key={line.key}>
                  <circle cx={end.x} cy={end.y} r="4" fill={line.color} stroke="#fff" strokeWidth="2" />
                  <text x={end.x + 9} y={end.y} dy="0.32em" className="fill-ink-soft text-[11px] font-semibold tabular-nums">
                    {formatNumber(days[days.length - 1][line.key])}
                  </text>
                </g>
              )
            })}

            {activeDay && (
              <g>
                <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={y(0)} stroke="#98a2b3" strokeWidth="1" />
                {lines.map((line) => (
                  <circle key={line.key} cx={line.points[active].x} cy={line.points[active].y} r="4.5" fill={line.color} stroke="#fff" strokeWidth="2" />
                ))}
              </g>
            )}
          </svg>
        )}

        {activeDay && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-xl border border-line bg-white px-3 py-2.5 shadow-lift"
            style={flip ? { right: width - tooltipLeft + 12 } : { left: tooltipLeft + 12 }}
          >
            <p className="text-[11px] font-semibold text-ink-muted">{dayLabel(activeDay.date, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="mt-1.5 flex items-center gap-2">
                <svg width="12" height="4" className="shrink-0" aria-hidden>
                  <line x1="0" y1="2" x2="12" y2="2" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeDasharray={s.dashed ? '3 2' : undefined} />
                </svg>
                <span className="text-sm font-bold text-ink tabular-nums">{formatNumber(activeDay[s.key])}</span>
                <span className="text-xs text-ink-muted">{s.label.toLowerCase()}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>Daily menu views, this week and last week</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">This week</th>
            <th scope="col">Same day last week</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{dayLabel(d.date, { weekday: 'long', day: 'numeric', month: 'short' })}</td>
              <td>{d.current}</td>
              <td>{d.previous}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
