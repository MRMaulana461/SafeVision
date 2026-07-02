import { VIOLATION_KEYWORDS } from '../config.js'

export function isViolation(className) {
  const lower = className.toLowerCase()
  return VIOLATION_KEYWORDS.some((kw) => lower.includes(kw))
}

export function colorForClass(className) {
  return isViolation(className) ? '#ff4d5e' : '#2fd6a0'
}

// Meringkas array deteksi jadi { compliant: [...], violations: [...] , total }
export function summarize(detections) {
  const violations = detections.filter((d) => isViolation(d.class_name))
  const compliant = detections.filter((d) => !isViolation(d.class_name))
  return { compliant, violations, total: detections.length }
}

export function formatConfidence(conf) {
  return `${Math.round(conf * 100)}%`
}
