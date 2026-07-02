import './ViolationLog.css'

export default function ViolationLog({ entries }) {
  return (
    <div className="log">
      <div className="log__header">
        <span className="stats__label log__title">LOG PELANGGARAN</span>
        <span className="log__count">{entries.length}</span>
      </div>
      <div className="log__list">
        {entries.length === 0 && (
          <p className="log__empty">Belum ada pelanggaran terekam. Log akan muncul di sini secara realtime.</p>
        )}
        {entries.map((e) => (
          <div key={e.id} className="log__entry">
            <span className="log__time">{e.time}</span>
            <span className="log__class">{e.className}</span>
            <span className="log__conf">{e.confidence}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
