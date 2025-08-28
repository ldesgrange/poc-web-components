import { icon } from '@fortawesome/fontawesome-svg-core'

import { inject } from '@app/core/service-registry'
import { TaskService } from '@app/core/task-service'
import { Task, TaskStatus, TaskFilter, MoveDirection } from '@app/core/task-types'
import { theme } from '@app/styles/theme'

import cssContent from './app-task-list.css?raw'

const template = document.createElement('template')
template.innerHTML = `
<div id="task-app">
  <div class="input-group">
    <input type="text" id="new-task" placeholder="What needs to be done?" />
  </div>
  <div class="filter-group">
    <button data-filter="all">All</button>
    <button data-filter="active">Active</button>
    <button data-filter="completed">Completed</button>
  </div>
  <ul id="task-list"></ul>
  <div class="footer">
    <span class="task-count"></span>
  </div>
</div>
<dialog id="rename-dialog" aria-modal="true">
  <form method="dialog">
    <label for="rename-input">Rename task</label>
    <input type="text" id="rename-input" />
    <div class="dialog-actions">
      <button type="submit" id="rename-confirm">Rename</button>
      <button type="button" id="rename-cancel">Cancel</button>
    </div>
  </form>
</dialog>
<dialog id="delete-dialog" aria-modal="true">
  <p id="delete-message"></p>
  <div class="dialog-actions">
    <button id="delete-confirm">Delete</button>
    <button id="delete-cancel">Cancel</button>
  </div>
</dialog>
`

export class AppTaskList extends HTMLElement {
  private taskService = inject(TaskService)

  private input!: HTMLInputElement
  private list!: HTMLUListElement
  private counter!: HTMLElement
  private renameDialog!: HTMLDialogElement
  private renameInput!: HTMLInputElement
  private deleteDialog!: HTMLDialogElement
  private deleteMessage!: HTMLElement

  private currentFilter: TaskFilter = TaskFilter.ACTIVE

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })
    const style = new CSSStyleSheet()
    style.replaceSync(cssContent)
    shadow.adoptedStyleSheets = [theme, style]
    shadow.appendChild(template.content.cloneNode(true))
  }

  override connectedCallback() {
    this.input = this.shadowRoot!.getElementById('new-task') as HTMLInputElement
    this.list = this.shadowRoot!.getElementById('task-list') as HTMLUListElement
    this.counter = this.shadowRoot!.querySelector('.task-count') as HTMLElement
    this.renameDialog = this.shadowRoot!.getElementById('rename-dialog') as HTMLDialogElement
    this.renameInput = this.shadowRoot!.getElementById('rename-input') as HTMLInputElement
    this.deleteDialog = this.shadowRoot!.getElementById('delete-dialog') as HTMLDialogElement
    this.deleteMessage = this.shadowRoot!.getElementById('delete-message') as HTMLElement

    this.input.addEventListener('keydown', this.onInputKeyDownRef)
    this.shadowRoot!.querySelectorAll('.filter-group > button').forEach(button => {
      button.addEventListener('click', this.onFilterClickRef)
    })

    this.updateFilterButtons()
    this.loadTasks()
  }

  override disconnectedCallback() {
    this.input.removeEventListener('keydown', this.onInputKeyDownRef)
    this.shadowRoot!.querySelectorAll('.filter-group > button').forEach(button => {
      button.removeEventListener('click', this.onFilterClickRef)
    })
  }

  private updateFilterButtons() {
    this.shadowRoot!.querySelectorAll('.filter-group > button').forEach(button => {
      if (button.getAttribute('data-filter') === this.currentFilter) {
        button.classList.add('active')
      } else {
        button.classList.remove('active')
      }
    })
  }

  private async loadTasks() {
    const tasks = await this.taskService.getTasks()
    const filteredTasks = tasks.filter(task => {
      if (this.currentFilter === TaskFilter.ACTIVE) return task.status === TaskStatus.ACTIVE
      if (this.currentFilter === TaskFilter.COMPLETED) return task.status === TaskStatus.COMPLETED
      return true
    })
    const activeCount = tasks.filter(t => t.status === TaskStatus.ACTIVE).length
    this.renderTasks(filteredTasks, activeCount)
  }

  private async handleAddTask() {
    const taskName = this.input.value
    try {
      await this.taskService.addTask(taskName)
      this.input.value = ''
    } finally {
      await this.loadTasks()
    }
  }

  private renderTasks(tasks: Task[], activeCount: number) {
    this.list.innerHTML = ''
    tasks.forEach(task => {
      const li = document.createElement('li')
      li.className = `task-item ${task.status}`
      li.innerHTML = `
        <span class="task-name"></span>
        <div class="task-actions">
          <button class="toggle-completed">${task.status === TaskStatus.ACTIVE ? 'Complete' : 'Activate'}</button>
          <button class="edit-task" aria-label="Edit task"><i class="fa">${icon({ prefix: 'fas', iconName: 'pen-to-square' }).html}</i></button>
          <button class="delete-task" aria-label="Delete task"><i class="fa">${icon({ prefix: 'fas', iconName: 'trash-can' }).html}</i></button>
          <button class="move-up" aria-label="Move task up">↑</button>
          <button class="move-down" aria-label="Move task down">↓</button>
        </div>
      `
      li.querySelector('.task-name')!.textContent = task.task
      li.querySelector('.edit-task')!.setAttribute('aria-label', `Edit ${task.task}`)
      li.querySelector('.delete-task')!.setAttribute('aria-label', `Delete ${task.task}`)
      li.querySelector('.move-up')!.setAttribute('aria-label', `Move ${task.task} up`)
      li.querySelector('.move-down')!.setAttribute('aria-label', `Move ${task.task} down`)

      li.querySelector('.toggle-completed')?.addEventListener('click', async () => {
        try {
          const newStatus = task.status === TaskStatus.ACTIVE ? TaskStatus.COMPLETED : TaskStatus.ACTIVE
          await this.taskService.updateTaskStatus(task.id, newStatus)
        } finally {
          await this.loadTasks()
        }
      }, { once: true })
      li.querySelector('.edit-task')?.addEventListener('click', async () => {
        try {
          const newName = await this.promptRename(task.task)
          if (newName === null) return
          await this.taskService.updateTaskName(task.id, newName)
        } finally {
          await this.loadTasks()
        }
      }, { once: true })
      li.querySelector('.delete-task')?.addEventListener('click', async () => {
        try {
          const confirmed = await this.promptDelete(task.task)
          if (!confirmed) return
          await this.taskService.deleteTask(task.id)
        } finally {
          await this.loadTasks()
        }
      }, { once: true })
      li.querySelector('.move-up')?.addEventListener('click', () => this.handleMoveTask(task, tasks, MoveDirection.ABOVE), { once: true })
      li.querySelector('.move-down')?.addEventListener('click', () => this.handleMoveTask(task, tasks, MoveDirection.BELOW), { once: true })
      this.list.appendChild(li)
    })
    this.renderCounter(activeCount)
  }

  private async handleMoveTask(task: Task, tasks: Task[], direction: MoveDirection) {
    const index = tasks.findIndex(t => t.id === task.id)
    const targetIndex = direction === MoveDirection.ABOVE ? index - 1 : index + 1

    if (targetIndex >= 0 && targetIndex < tasks.length) {
      const targetTask = tasks[targetIndex]
      if (targetTask) {
        try {
          await this.taskService.moveTask(task.id, targetTask.id, direction)
        } finally {
          await this.loadTasks()
        }
      }
    }
  }

  private promptRename(currentName: string): Promise<string | null> {
    return new Promise(resolve => {
      this.renameInput.value = currentName
      this.renameDialog.showModal()

      const onConfirm = () => {
        this.renameDialog.close()
        resolve(this.renameInput.value)
        cleanup()
      }
      const onCancel = () => {
        this.renameDialog.close()
        resolve(null)
        cleanup()
      }
      const cleanup = () => {
        this.renameDialog.querySelector('#rename-confirm')!.removeEventListener('click', onConfirm)
        this.renameDialog.querySelector('#rename-cancel')!.removeEventListener('click', onCancel)
      }

      this.renameDialog.querySelector('#rename-confirm')!.addEventListener('click', onConfirm, { once: true })
      this.renameDialog.querySelector('#rename-cancel')!.addEventListener('click', onCancel, { once: true })
    })
  }

  private promptDelete(taskName: string): Promise<boolean> {
    return new Promise(resolve => {
      this.deleteMessage.textContent = `Are you sure you want to delete “${taskName}”?`
      this.deleteDialog.showModal()

      const onConfirm = () => {
        this.deleteDialog.close()
        resolve(true)
        cleanup()
      }
      const onCancel = () => {
        this.deleteDialog.close()
        resolve(false)
        cleanup()
      }
      const cleanup = () => {
        this.deleteDialog.querySelector('#delete-confirm')!.removeEventListener('click', onConfirm)
        this.deleteDialog.querySelector('#delete-cancel')!.removeEventListener('click', onCancel)
      }

      this.deleteDialog.querySelector('#delete-confirm')!.addEventListener('click', onConfirm, { once: true })
      this.deleteDialog.querySelector('#delete-cancel')!.addEventListener('click', onCancel, { once: true })
    })
  }

  private renderCounter(count: number) {
    const unit = count === 1 ? 'item' : 'items'
    this.counter.textContent = `${count} ${unit} left`
  }

  private onInputKeyDownRef = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      this.handleAddTask()
    }
  }

  private onFilterClickRef = (e: Event) => {
    const button = (e.currentTarget as HTMLElement)
    const filter = button.getAttribute('data-filter')
    const filterValues = Object.values(TaskFilter) as string[]
    if (filter !== null && filterValues.includes(filter)) {
      this.currentFilter = filter as TaskFilter
      this.updateFilterButtons()
      this.loadTasks()
    }
  }
}

if (!customElements.get('app-task-list')) {
  customElements.define('app-task-list', AppTaskList)
}
