import type { TaskStatus } from './taskApi'

export function availableTransitions(
  status: TaskStatus,
  isOwner: boolean,
  isAssignee: boolean,
): TaskStatus[] {
  if (!isOwner && !isAssignee) return []
  switch (status) {
    case 'TODO':
      return ['IN_PROGRESS']
    case 'IN_PROGRESS':
      return ['IN_REVIEW']
    case 'IN_REVIEW':
      return isOwner ? ['IN_PROGRESS', 'DONE'] : []
    case 'DONE':
      return isOwner ? ['IN_PROGRESS'] : []
  }
}
