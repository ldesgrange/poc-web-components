import { inject } from './service-registry'
import { DbInfo, StorageService } from './storage-service'
import { Task, TaskStatus, ValidationError, MoveDirection } from './task-types'

const DB_INFO = {
  name: 'task-db',
  version: 1,
  storeName: 'tasks',
} as DbInfo

export abstract class TaskService {
  abstract getTasks(): Promise<Task[]>
  abstract addTask(taskName: string): Promise<Task>
  abstract updateTaskStatus(id: string, status: TaskStatus): Promise<Task>
  abstract updateTaskName(id: string, newName: string): Promise<Task>
  abstract deleteTask(id: string): Promise<void>
  abstract moveTask(id: string, targetId: string, direction: MoveDirection): Promise<void>
}

export class PersistedTaskService extends TaskService {
  private storageService = inject(StorageService)

  override async getTasks(): Promise<Task[]> {
    const tasks = await this.storageService.getAll<Task>(DB_INFO)
    return tasks
      // Use any here to detect malformed data retrieved from IndexedDB.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((t: any) => 'id' in t && t.id && typeof t.id === 'string' && t.id.trim() !== '')
      .sort((a, b) => (a.position - b.position) || (a.createdAt - b.createdAt))
  }

  override async addTask(taskName: string): Promise<Task> {
    const trimmedName = await this.validateTaskName(taskName)

    const tasks = await this.getTasks()
    const maxPosition = tasks.length > 0 ? Math.max(...tasks.map(t => t.position)) : 0

    const task: Task = {
      id: crypto.randomUUID(),
      task: trimmedName,
      status: TaskStatus.ACTIVE,
      createdAt: Date.now(),
      position: maxPosition + 1000,
    }

    await this.storageService.put(DB_INFO, task)

    return task
  }

  override async updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
    const task = await this.storageService.get<Task>(DB_INFO, id)

    if (!task) {
      throw new Error(`Task with id ${id} not found`)
    }

    // Duplicate check if reactivating.
    if (status === TaskStatus.ACTIVE && task.status === TaskStatus.COMPLETED) {
      await this.validateTaskName(task.task, id)
    }

    task.status = status
    await this.storageService.put(DB_INFO, task)

    return task
  }

  override async updateTaskName(id: string, newName: string): Promise<Task> {
    const trimmedName = await this.validateTaskName(newName, id)

    const task = await this.storageService.get<Task>(DB_INFO, id)
    if (!task) {
      throw new Error(`Task with id ${id} not found`)
    }

    task.task = trimmedName
    await this.storageService.put(DB_INFO, task)

    return task
  }

  private async validateTaskName(name: string, excludeId?: string): Promise<string> {
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new ValidationError('Task name is required')
    }

    const tasks = await this.getTasks()
    const exists = tasks.some(
      (t) => {
        return t.id !== excludeId && t.status === TaskStatus.ACTIVE && t.task.trim().toLowerCase() === trimmedName.toLowerCase()
      },
    )
    if (exists) {
      throw new ValidationError('Task already exists')
    }

    return trimmedName
  }

  override async deleteTask(id: string): Promise<void> {
    await this.storageService.delete(DB_INFO, id)
  }

  override async moveTask(id: string, targetId: string, direction: MoveDirection): Promise<void> {
    const tasks = await this.getTasks()
    const taskIndex = tasks.findIndex(t => t.id === id)
    const targetIndex = tasks.findIndex(t => t.id === targetId)

    if (taskIndex === -1 || targetIndex === -1) throw new Error('Task not found.')
    const task = tasks[taskIndex]
    if (!task) throw new Error('Task not found.')

    // Remove the task from the current position.
    tasks.splice(taskIndex, 1)

    // Find a new index for the target after removal.
    const newTargetIndex = tasks.findIndex(t => t.id === targetId)
    const insertIndex = direction === MoveDirection.ABOVE ? newTargetIndex : newTargetIndex + 1

    // Calculate the new position.
    let newPosition: number
    const prevTask = tasks[insertIndex - 1]
    const nextTask = tasks[insertIndex]

    if (!prevTask && !nextTask) {
      // List is now empty (should not happen as targetId exists).
      newPosition = 1000
    } else if (!prevTask) {
      // Inserting at the beginning.
      newPosition = nextTask!.position / 2
    } else if (!nextTask) {
      // Inserting at the end.
      newPosition = prevTask.position + 1000
    } else {
      // Inserting between two tasks.
      newPosition = (prevTask.position + nextTask.position) / 2
    }

    // If the gap is too small, fallback to re-indexing everything.
    if (Math.abs(newPosition - (prevTask?.position ?? 0)) < 0.001 || Math.abs(newPosition - (nextTask?.position ?? newPosition + 1)) < 0.001) {
      tasks.splice(insertIndex, 0, task)
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i]
        if (t) {
          t.position = (i + 1) * 1000
          await this.storageService.put(DB_INFO, t)
        }
      }
    } else {
      task.position = newPosition
      await this.storageService.put(DB_INFO, task)
    }
  }
}
