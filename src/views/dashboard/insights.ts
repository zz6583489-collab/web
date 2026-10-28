import type { TaskStats } from '../tasks/taskApi'

export interface StatsEntry {
  stats: TaskStats
}

export function aggregateProjectStats(entries: readonly StatsEntry[]): {
  total: number
  todo: number
  inProgress: number
  inReview: number
  done: number
  overdue: number
  completionRate: number
} {
  const result = entries.reduce(
    (sum, entry) => ({
      total: sum.total + entry.stats.total,
      todo: sum.todo + entry.stats.todo,
      inProgress: sum.inProgress + entry.stats.inProgress,
      inReview: sum.inReview + entry.stats.inReview,
      done: sum.done + entry.stats.done,
      overdue: sum.overdue + entry.stats.overdue,
    }),
    { total: 0, todo: 0, inProgress: 0, inReview: 0, done: 0, overdue: 0 },
  )
  return {
    ...result,
    completionRate:
      result.total === 0 ? 0 : Number(((result.done / result.total) * 100).toFixed(1)),
  }
}
