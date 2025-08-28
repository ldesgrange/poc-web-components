import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import '../../../src/components/app-task-list'
import { AppTaskList } from '../../../src/components/app-task-list'
import { serviceRegistry } from '../../../src/core/service-registry'
import { TaskService } from '../../../src/core/task-service'
import { TaskStatus } from '../../../src/core/task-types'

// Mock TaskService methods
const mockGetTasks = vi.fn().mockResolvedValue([])
const mockAddTask = vi.fn().mockResolvedValue(undefined)
const mockUpdateTaskStatus = vi.fn().mockResolvedValue(undefined)
const mockUpdateTaskName = vi.fn().mockResolvedValue(undefined)
const mockDeleteTask = vi.fn().mockResolvedValue(undefined)
const mockMoveTask = vi.fn().mockResolvedValue(undefined)

const mockTaskService: TaskService = {
  getTasks: mockGetTasks,
  addTask: mockAddTask,
  updateTaskStatus: mockUpdateTaskStatus,
  updateTaskName: mockUpdateTaskName,
  deleteTask: mockDeleteTask,
  moveTask: mockMoveTask,
}

// Stub dialog methods for jsdom.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
})

describe('AppTaskList', () => {
  let element: AppTaskList

  beforeEach(async () => {
    vi.clearAllMocks()
    serviceRegistry.set(TaskService, mockTaskService)
  })

  afterEach(() => {
    document.body.removeChild(element)
  })

  it('should render the active task counter', async () => {
    mockGetTasks.mockResolvedValue([
      { id: '1', task: 'Task 1', status: TaskStatus.ACTIVE, createdAt: Date.now() },
      { id: '2', task: 'Task 2', status: TaskStatus.COMPLETED, createdAt: Date.now() },
      { id: '3', task: 'Task 3', status: TaskStatus.ACTIVE, createdAt: Date.now() },
    ])

    element = document.createElement('app-task-list') as AppTaskList
    document.body.appendChild(element)

    await vi.waitFor(() => {
      const counter = element.shadowRoot!.querySelector('.task-count')
      expect(counter?.textContent).toBe('2 items left')
    })
  })

  it('should display singular "item" when count is 1', async () => {
    mockGetTasks.mockResolvedValue([
      { id: '1', task: 'Task 1', status: TaskStatus.ACTIVE, createdAt: Date.now() },
    ])

    element = document.createElement('app-task-list') as AppTaskList
    document.body.appendChild(element)

    await vi.waitFor(() => {
      const counter = element.shadowRoot!.querySelector('.task-count')
      expect(counter?.textContent).toBe('1 item left')
    })
  })

  it('should display plural "items" when count is 0', async () => {
    mockGetTasks.mockResolvedValue([
      { id: '1', task: 'Task 1', status: TaskStatus.COMPLETED, createdAt: Date.now() },
    ])

    element = document.createElement('app-task-list') as AppTaskList
    document.body.appendChild(element)

    await vi.waitFor(() => {
      const counter = element.shadowRoot!.querySelector('.task-count')
      expect(counter?.textContent).toBe('0 items left')
    })
  })

  it('should open rename dialog and update task name on confirm', async () => {
    mockGetTasks.mockResolvedValue([
      { id: '1', task: 'Buy milk', status: TaskStatus.ACTIVE, createdAt: Date.now() },
    ])
    element = document.createElement('app-task-list') as AppTaskList
    document.body.appendChild(element)

    await vi.waitFor(() => {
      expect(element.shadowRoot!.querySelector('.task-name')?.textContent).toBe('Buy milk')
    })

    const editButton = element.shadowRoot!.querySelector('.edit-task') as HTMLButtonElement
    editButton.click()

    const renameDialog = element.shadowRoot!.getElementById('rename-dialog') as HTMLDialogElement
    await vi.waitFor(() => expect(renameDialog.open).toBe(true))

    const renameInput = element.shadowRoot!.getElementById('rename-input') as HTMLInputElement
    expect(renameInput.value).toBe('Buy milk')
    renameInput.value = 'Buy oat milk'

    const confirmButton = renameDialog.querySelector('#rename-confirm') as HTMLButtonElement
    confirmButton.click()

    await vi.waitFor(() => {
      expect(mockUpdateTaskName).toHaveBeenCalledWith('1', 'Buy oat milk')
    })
  })

  it('should close rename dialog without updating on cancel', async () => {
    mockGetTasks.mockResolvedValue([
      { id: '1', task: 'Buy milk', status: TaskStatus.ACTIVE, createdAt: Date.now() },
    ])
    element = document.createElement('app-task-list') as AppTaskList
    document.body.appendChild(element)

    await vi.waitFor(() => {
      expect(element.shadowRoot!.querySelector('.task-name')?.textContent).toBe('Buy milk')
    })

    const editButton = element.shadowRoot!.querySelector('.edit-task') as HTMLButtonElement
    editButton.click()

    const renameDialog = element.shadowRoot!.getElementById('rename-dialog') as HTMLDialogElement
    await vi.waitFor(() => expect(renameDialog.open).toBe(true))

    const cancelButton = renameDialog.querySelector('#rename-cancel') as HTMLButtonElement
    cancelButton.click()

    await vi.waitFor(() => expect(renameDialog.open).toBe(false))
    expect(mockUpdateTaskName).not.toHaveBeenCalled()
  })

  it('should open delete dialog and delete task on confirm', async () => {
    mockGetTasks.mockResolvedValue([
      { id: '1', task: 'Buy milk', status: TaskStatus.ACTIVE, createdAt: Date.now() },
    ])
    element = document.createElement('app-task-list') as AppTaskList
    document.body.appendChild(element)

    await vi.waitFor(() => {
      expect(element.shadowRoot!.querySelector('.task-name')?.textContent).toBe('Buy milk')
    })

    const deleteButton = element.shadowRoot!.querySelector('.delete-task') as HTMLButtonElement
    deleteButton.click()

    const deleteDialog = element.shadowRoot!.getElementById('delete-dialog') as HTMLDialogElement
    await vi.waitFor(() => expect(deleteDialog.open).toBe(true))

    const deleteMessage = element.shadowRoot!.getElementById('delete-message') as HTMLElement
    expect(deleteMessage.textContent).toBe('Are you sure you want to delete “Buy milk”?')

    const confirmButton = deleteDialog.querySelector('#delete-confirm') as HTMLButtonElement
    confirmButton.click()

    await vi.waitFor(() => {
      expect(mockDeleteTask).toHaveBeenCalledWith('1')
    })
  })

  it('should close delete dialog without deleting on cancel', async () => {
    mockGetTasks.mockResolvedValue([
      { id: '1', task: 'Buy milk', status: TaskStatus.ACTIVE, createdAt: Date.now() },
    ])
    element = document.createElement('app-task-list') as AppTaskList
    document.body.appendChild(element)

    await vi.waitFor(() => {
      expect(element.shadowRoot!.querySelector('.task-name')?.textContent).toBe('Buy milk')
    })

    const deleteButton = element.shadowRoot!.querySelector('.delete-task') as HTMLButtonElement
    deleteButton.click()

    const deleteDialog = element.shadowRoot!.getElementById('delete-dialog') as HTMLDialogElement
    await vi.waitFor(() => expect(deleteDialog.open).toBe(true))

    const cancelButton = deleteDialog.querySelector('#delete-cancel') as HTMLButtonElement
    cancelButton.click()

    await vi.waitFor(() => expect(deleteDialog.open).toBe(false))
    expect(mockDeleteTask).not.toHaveBeenCalled()
  })

  it('should filter tasks by status', async () => {
    const tasks = [
      { id: '1', task: 'Active Task', status: TaskStatus.ACTIVE, createdAt: Date.now() },
      { id: '2', task: 'Completed Task', status: TaskStatus.COMPLETED, createdAt: Date.now() },
    ]
    mockGetTasks.mockResolvedValue(tasks)

    element = document.createElement('app-task-list') as AppTaskList
    document.body.appendChild(element)
    await vi.waitFor(() => {
      const taskNames = Array.from(element.shadowRoot!.querySelectorAll('.task-name')).map(el => el.textContent)
      expect(taskNames).toContain('Active Task')
      expect(taskNames).not.toContain('Completed Task')
    })

    // Switch to Completed filter
    const completedButton = element.shadowRoot!.querySelector('.filter-group > button[data-filter="completed"]') as HTMLButtonElement
    completedButton.click()
    await vi.waitFor(() => {
      const taskNames = Array.from(element.shadowRoot!.querySelectorAll('.task-name')).map(el => el.textContent)
      expect(taskNames).not.toContain('Active Task')
      expect(taskNames).toContain('Completed Task')
    })

    // Switch to All filter
    const allButton = element.shadowRoot!.querySelector('.filter-group > button[data-filter="all"]') as HTMLButtonElement
    allButton.click()
    await vi.waitFor(() => {
      const taskNames = Array.from(element.shadowRoot!.querySelectorAll('.task-name')).map(el => el.textContent)
      expect(taskNames).toContain('Active Task')
      expect(taskNames).toContain('Completed Task')
    })
  })
})
