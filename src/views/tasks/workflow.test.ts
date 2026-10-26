import { describe, expect, it } from 'vitest'
import { availableTransitions } from './workflow'

describe('availableTransitions', () => {
  it('follows the workflow for an assignee', () => {
    expect(availableTransitions('TODO', false, true)).toEqual(['IN_PROGRESS'])
    expect(availableTransitions('IN_PROGRESS', false, true)).toEqual(['IN_REVIEW'])
    expect(availableTransitions('IN_REVIEW', false, true)).toEqual([])
    expect(availableTransitions('DONE', false, true)).toEqual([])
  })

  it('reserves reopen for the owner and hides all actions from readers', () => {
    expect(availableTransitions('DONE', true, false)).toEqual(['IN_PROGRESS'])
    expect(availableTransitions('IN_REVIEW', true, false)).toEqual(['IN_PROGRESS', 'DONE'])
    expect(availableTransitions('IN_REVIEW', false, false)).toEqual([])
  })
})
