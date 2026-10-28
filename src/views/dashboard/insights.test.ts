import { describe, expect, it } from 'vitest'
import { aggregateProjectStats } from './insights'

describe('cross-project task statistics', () => {
  it('weights completion by task count and sums overdue tasks', () => {
    const result = aggregateProjectStats([
      {
        stats: {
          total: 1,
          todo: 0,
          inProgress: 0,
          inReview: 0,
          done: 1,
          overdue: 0,
          completionRatePercent: 100,
        },
      },
      {
        stats: {
          total: 9,
          todo: 7,
          inProgress: 1,
          inReview: 1,
          done: 0,
          overdue: 2,
          completionRatePercent: 0,
        },
      },
    ])
    expect(result).toMatchObject({ total: 10, done: 1, overdue: 2, completionRate: 10 })
  })

  it('reports zero completion when no tasks exist', () => {
    expect(aggregateProjectStats([]).completionRate).toBe(0)
  })
})
