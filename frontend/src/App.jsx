import { useCallback, useRef, useState } from 'react'
import WebcamFeed from './components/WebcamFeed.jsx'
import StatsPanel from './components/StatsPanel.jsx'
import ViolationLog from './components/ViolationLog.jsx'
import { isViolation, formatConfidence } from './utils/detections.js'
import './App.css'

let idCounter = 0

export default function App() {
  const [detections, setDetections] = useState([])
  const [latencyMs, setLatencyMs] = useState(null)
  const [status, setStatus] = useState('idle')
  const [logEntries, setLogEntries] = useState([])
  const lastLoggedRef = useRef(new Set())

  const handleDetections = useCallback((dets) => {
    setDetections(dets)

    const currentViolations = dets.filter((d) => isViolation(d.class_name))
    const currentKeys = new Set(currentViolations.map((d) => d.class_name))

    const newlyEntered = currentViolations.filter((d) => !lastLoggedRef.current.has(d.class_name))
    if (newlyEntered.length > 0) {
      const now = new Date()
      const time = now.toLocaleTimeString('id-ID', { hour12: false })
      setLogEntries((prev) => {
        const additions = newlyEntered.map((d) => ({
          id: ++idCounter,
          time,
          className: d.class_name,
          confidence: formatConfidence(d.confidence),
        }))
        return [...additions, ...prev].slice(0, 50)
      })
    }
    lastLoggedRef.current = currentKeys
  }, [])

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__brand-mark" aria-hidden="true" />
          <span className="app__brand-name">SAFEVISION</span>
        </div>
        <span className="app__tagline">REALTIME PPE COMPLIANCE SCANNER — YOLO</span>
        <span className={`app__dot app__dot--${status}`} title={`Status: ${status}`} />
      </header>

      <main className="app__main">
        <section className="app__feed-col">
          <WebcamFeed
            onDetections={handleDetections}
            onLatency={setLatencyMs}
            onStatusChange={setStatus}
          />
        </section>

        <aside className="app__side-col">
          <StatsPanel detections={detections} latencyMs={latencyMs} status={status} />
          <ViolationLog entries={logEntries} />
        </aside>
      </main>

      <footer className="app__footer">
        <span>Model: YOLO11s PPE Detection (ONNX)</span>
        <span>100% berjalan di browser — React + ONNX Runtime Web</span>
      </footer>
    </div>
  )
}
