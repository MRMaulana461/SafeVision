import { summarize } from '../utils/detections.js'
import './StatsPanel.css'

export default function StatsPanel({ detections, latencyMs, status }) {
  const { compliant, violations, total } = summarize(detections)
  const complianceRate = total === 0 ? null : Math.round((compliant.length / total) * 100)

  return (
    <div className="stats">
      <div className="stats__row">
        <span className="stats__label">STATUS</span>
        <span className={`stats__pill stats__pill--${status}`}>
          {status === 'live'
            ? 'LIVE'
            : status === 'starting'
              ? 'INIT'
              : status === 'loading-model'
                ? 'MEMUAT MODEL'
                : status === 'error'
                  ? 'ERROR'
                  : 'STANDBY'}
        </span>
      </div>

      <div className="stats__gauge">
        <div className="stats__gauge-value">
          {complianceRate === null ? '—' : `${complianceRate}%`}
        </div>
        <div className="stats__gauge-label">TINGKAT KEPATUHAN</div>
        <div className="stats__gauge-bar">
          <div
            className="stats__gauge-fill"
            style={{
              width: `${complianceRate ?? 0}%`,
              background: (complianceRate ?? 0) >= 70 ? 'var(--signal-safe)' : 'var(--signal-alert)',
            }}
          />
        </div>
      </div>

      <div className="stats__grid">
        <div className="stats__cell">
          <div className="stats__cell-value" style={{ color: 'var(--signal-safe)' }}>
            {compliant.length}
          </div>
          <div className="stats__cell-label">Sesuai APD</div>
        </div>
        <div className="stats__cell">
          <div className="stats__cell-value" style={{ color: 'var(--signal-alert)' }}>
            {violations.length}
          </div>
          <div className="stats__cell-label">Pelanggaran</div>
        </div>
        <div className="stats__cell">
          <div className="stats__cell-value">{total}</div>
          <div className="stats__cell-label">Total objek</div>
        </div>
        <div className="stats__cell">
          <div className="stats__cell-value">{latencyMs ? `${latencyMs}` : '—'}</div>
          <div className="stats__cell-label">Latensi (ms)</div>
        </div>
      </div>
    </div>
  )
}
