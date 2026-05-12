export function calculateScore(pointsBase: number, timeLimitMs: number, answeredInMs: number): number {
  if (answeredInMs > timeLimitMs) return 0
  const raw = pointsBase * (timeLimitMs - answeredInMs) / timeLimitMs
  const minimum = pointsBase * 0.5
  return Math.floor(Math.max(raw, minimum))
}
