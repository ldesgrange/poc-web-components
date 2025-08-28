export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export enum TaskStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

export enum TaskFilter {
  ALL = 'all',
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

export enum MoveDirection {
  ABOVE = 'above',
  BELOW = 'below',
}

export interface Task {
  id: string
  task: string
  status: TaskStatus
  createdAt: number
  position: number
}
