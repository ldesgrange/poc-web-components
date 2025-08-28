import { Given, When, Then, DataTable } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

import { generateMasterKey } from '../../../src/core/master-key-utils.js'
import { TaskStatus } from '../../../src/core/task-types.js'
import { setupMasterKeyInPage } from '../support/test-utils.js'
import { CustomWorld } from '../support/world.js'

/**
 * Helper class to access protected methods of AppTaskList in tests.
 */
interface AppTaskList extends HTMLElement {
  loadTasks(): Promise<void>
}

async function clearTaskObjectStore(page: CustomWorld['page']): Promise<void> {
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const request = indexedDB.open('task-db', 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' })
      }
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('tasks', 'readwrite')
        const store = tx.objectStore('tasks')
        const clearReq = store.clear()
        clearReq.onsuccess = () => {
          tx.oncomplete = () => db.close()
          resolve(true)
        }
        clearReq.onerror = () => {
          tx.oncomplete = () => db.close()
          resolve(false)
        }
      }
      request.onerror = () => resolve(false)
    })
  })
}

// BACKGROUND STEPS
// These steps are mostly handled by existing step definitions in:
// - compatibility.steps.ts
// - initialization.steps.ts
// - unlock.steps.ts

Given('a compatible web browser', async function (this: CustomWorld) {
  // Logic from compatibility.feature: Ensure Secure Context, Crypto, Storage API, etc.
  // By default, Playwright's chromium is compatible.
  // We can just verify it if needed, or assume it's set up correctly by default.
  await this.page.addInitScript(() => {
    // Ensure it's treated as a compatible browser.
    Object.defineProperty(window, 'isSecureContext', { get: () => true })
  })
})

Given('an initialized and unlocked encryption key', async function (this: CustomWorld) {
  // 1. Setup the master key.
  const masterKeyData = await generateMasterKey('default', 'correct-password')
  await setupMasterKeyInPage(this.page, masterKeyData)

  // 2. Load the app.
  await this.goto()

  // 3. Unlock it (if app-unlock is shown).
  try {
    const unlockComponent = this.page.locator('app-unlock')
    await expect(unlockComponent).toBeAttached({ timeout: 5000 })
    const unlockButton = unlockComponent.locator('button#submit-unlock')
    await unlockButton.waitFor({ state: 'visible', timeout: 5000 })
    await unlockComponent.locator('input#unlock-password').fill('correct-password')
    await unlockButton.click()
  } catch {
    // If not visible, maybe it's already unlocked or directly on task list.
  }

  await expect(this.page.locator('app-unlock')).not.toBeAttached()
})

// TASK STEPS

Given('an empty task list', async function (this: CustomWorld) {
  // Ensure we are on the task list and it's empty.
  const taskList = this.page.locator('app-task-list')
  await expect(taskList).toBeAttached({ timeout: 10000 })

  // Clear the object store without reloading the page to avoid losing the unlocked state.
  await clearTaskObjectStore(this.page)

  // Ask component to refresh its view.
  await this.page.evaluate(() => (document.querySelector<AppTaskList>('app-task-list'))?.loadTasks?.())
  const taskItems = this.page.locator('app-task-list .task-item')
  await expect(taskItems).toHaveCount(0)
})

Given('a task list with:', async function (this: CustomWorld, dataTable: DataTable) {
  // 1. Ensure we are on the task list.
  const taskList = this.page.locator('app-task-list')
  await expect(taskList).toBeAttached({ timeout: 10000 })

  // 2. Clear the object store without reloading.
  await clearTaskObjectStore(this.page)

  // Ask component to refresh its view.
  await this.page.evaluate(() => (document.querySelector<AppTaskList>('app-task-list'))?.loadTasks?.())

  // Ensure 'All' filter is selected to see everything we are adding.
  const allFilterButton = taskList.locator('.filter-group > button[data-filter="all"]')
  if (await allFilterButton.count() > 0) {
    await allFilterButton.click()
  }

  // 3. Add tasks via UI.
  const tasks = dataTable.hashes() as Record<'task' | 'status', string>[]
  const input = taskList.locator('input#new-task')
  for (const task of tasks) {
    await input.fill(task.task)
    await this.page.keyboard.press('Enter')
    // Wait for the input to be cleared.
    await expect(input).toHaveValue('', { timeout: 5000 })

    if (task.status === TaskStatus.COMPLETED) {
      const lastTask = taskList.locator('.task-item').last()
      await lastTask.locator('.toggle-completed').click()
      await expect(lastTask).toHaveClass(/completed/)
    }
  }
})

When('I add a task {string}', async function (this: CustomWorld, taskName: string) {
  const input = this.page.locator('app-task-list').locator('input#new-task')
  await input.waitFor({ state: 'visible', timeout: 5000 })
  await input.fill(taskName)
  await this.page.keyboard.press('Enter')
})

When('I mark the task {string} as completed', async function (this: CustomWorld, taskName: string) {
  const task = this.page.locator(`app-task-list .task-item:has-text("${taskName}")`)
  await expect(task).toBeVisible()
  await task.locator('.toggle-completed').click()
})

When('I mark the task {string} as active', async function (this: CustomWorld, taskName: string) {
  const task = this.page.locator(`app-task-list .task-item:has-text("${taskName}")`)
  await expect(task).toBeVisible()
  await task.locator('.toggle-completed').click()
})

When('I mark the completed task {string} as active', async function (this: CustomWorld, taskName: string) {
  const task = this.page.locator(`app-task-list .task-item.completed:has-text("${taskName}")`)
  await expect(task).toBeVisible()
  await task.locator('.toggle-completed').click()
})

When('I view the task list', async function (this: CustomWorld) {
  const taskList = this.page.locator('app-task-list')
  await expect(taskList).toBeVisible()

  // Reset to default filter (Active) if we were in another state.
  const activeFilterButton = taskList.locator('.filter-group > button[data-filter="active"]')
  if (await activeFilterButton.count() > 0) {
    await activeFilterButton.click()
  }
})

When('I filter by {string} tasks', async function (this: CustomWorld, filter: string) {
  const filterButton = this.page.locator(`app-task-list .filter-group > button[data-filter="${filter.toLowerCase()}"]`)
  await filterButton.click()
})

When('I try to add an empty task', async function (this: CustomWorld) {
  const taskList = this.page.locator('app-task-list')
  await expect(taskList).toBeAttached({ timeout: 10000 })
  const input = taskList.locator('input#new-task')
  await input.fill('')
  await this.page.keyboard.press('Enter')
})

Then(/^the task "([^"]*)" should (?:be marked as|still be) (active|completed)$/, async function (this: CustomWorld, taskName: string, status: string) {
  const task = this.page.locator(`app-task-list .task-item.${status}:has-text("${taskName}")`)
  await expect(task).toBeVisible()
})

Then('one {string} task should be {string}', async function (this: CustomWorld, taskName: string, status: TaskStatus) {
  const task = this.page.locator(`app-task-list .task-item.${status}:has-text("${taskName}")`)
  await expect(task).toBeVisible()
})

Then('the task list should contain {string} task/tasks', async function (this: CustomWorld, count: string) {
  const taskItems = this.page.locator('app-task-list .task-item')
  await expect(taskItems).toHaveCount(Number(count))
})

Given('the task {string} is marked as completed', async function (this: CustomWorld, taskName: string) {
  const taskList = this.page.locator('app-task-list')
  const task = taskList.locator(`.task-item:has-text("${taskName}")`)

  // If task doesn't exist, we might need to add it, but usually Background should have added it.
  // The feature says "Given the task 'Buy milk' is marked as completed"
  // If it's already in the list but active, we click it.
  await expect(task).toBeVisible()
  const isCompleted = await task.evaluate(el => el.classList.contains('completed'))
  if (!isCompleted) {
    await task.locator('.toggle-completed').click()
    await expect(task).toHaveClass(/completed/)
  }
})

Then('the task {string} should be visible in the list', async function (this: CustomWorld, taskName: string) {
  const task = this.page.locator(`app-task-list .task-item:has-text("${taskName}")`)
  await expect(task).toBeVisible()
})

Then('the task {string} should not be visible in the list', async function (this: CustomWorld, taskName: string) {
  const task = this.page.locator(`app-task-list .task-item:has-text("${taskName}")`)
  await expect(task).toHaveCount(0)
})

When('I rename the task {string} to {string}', async function (this: CustomWorld, from: string, to: string) {
  const task = this.page.locator(`app-task-list .task-item:has-text("${from}")`).first()
  await expect(task).toBeVisible()

  await task.locator('.edit-task').click()

  const renameDialog = this.page.locator('app-task-list').locator('#rename-dialog')
  await expect(renameDialog).toBeVisible()
  await renameDialog.locator('#rename-input').fill(to)
  await renameDialog.locator('#rename-confirm').click()
})

When('I try to rename the task {string} to {string}', async function (this: CustomWorld, from: string, to: string) {
  const task = this.page.locator(`app-task-list .task-item:has-text("${from}")`)
  await expect(task).toBeVisible()

  await task.locator('.edit-task').click()

  const renameDialog = this.page.locator('app-task-list').locator('#rename-dialog')
  await expect(renameDialog).toBeVisible()
  await renameDialog.locator('#rename-input').fill(to)
  await renameDialog.locator('#rename-confirm').click()
})

Then('the task {string} should still be visible in the list', async function (this: CustomWorld, taskName: string) {
  const task = this.page.locator(`app-task-list .task-item:has-text("${taskName}")`)
  await expect(task).toBeVisible()
})

Then('a task-related error message {string} is displayed', async function (this: CustomWorld, message: string) {
  const error = this.page.locator('app-toast').locator(`.toast.message:has-text("${message}")`)
  await expect(error).toBeVisible()
})

Then('the active tasks counter should display {string}', async function (this: CustomWorld, expectedCount: string) {
  const counter = this.page.locator('app-task-list .task-count')
  await expect(counter).toHaveText(expectedCount)
})

When('I attempt to delete the task {string} but cancel the confirmation', async function (this: CustomWorld, taskName: string) {
  const task = this.page.locator(`app-task-list .task-item:has-text("${taskName}")`)
  await expect(task).toBeVisible()

  const deleteButton = task.locator('.delete-task')
  await deleteButton.waitFor({ state: 'visible', timeout: 5000 })
  await deleteButton.click()

  const deleteDialog = this.page.locator('app-task-list').locator('#delete-dialog')
  await expect(deleteDialog).toBeVisible()
  await deleteDialog.locator('#delete-cancel').click()
})

When('I confirm deleting the task {string}', async function (this: CustomWorld, taskName: string) {
  const task = this.page.locator(`app-task-list .task-item:has-text("${taskName}")`)
  await expect(task).toBeVisible()

  const deleteButton = task.locator('.delete-task')
  await deleteButton.waitFor({ state: 'visible', timeout: 5000 })
  await deleteButton.click()

  const deleteDialog = this.page.locator('app-task-list').locator('#delete-dialog')
  await expect(deleteDialog).toBeVisible()
  await deleteDialog.locator('#delete-confirm').click()
})

When('I move the task {string} above the task {string}', async function (this: CustomWorld, taskName: string, targetName: string) {
  const task = this.page.locator('app-task-list .task-item').filter({ has: this.page.locator('.task-name', { hasText: taskName }) })
  await expect(task).toHaveCount(1)

  // Move the task up until it's above the target.
  let isAbove = false
  for (let tries = 0; tries < 10 && !isAbove; tries++) {
    const names = await this.page.locator('app-task-list .task-item .task-name').allTextContents()
    const taskIndex = names.indexOf(taskName)
    const targetIndex = names.indexOf(targetName)

    if (taskIndex !== -1 && targetIndex !== -1 && taskIndex < targetIndex) {
      isAbove = true
      break
    }

    await task.locator('.move-up').click()
    await this.page.waitForTimeout(50)
  }
})

Then('the active tasks should be ordered as:', async function (this: CustomWorld, dataTable: DataTable) {
  const expectedTasks = dataTable.hashes() as Record<'task', string>[]
  const activeTasks = this.page.locator('app-task-list .task-item:not(.completed) .task-name')

  for (let i = 0; i < expectedTasks.length; i++) {
    await expect(activeTasks.nth(i)).toHaveText(expectedTasks[i]!.task)
  }
})

Then('the completed task {string} should remain completed', async function (this: CustomWorld, taskName: string) {
  const task = this.page.locator(`app-task-list .task-item.completed:has-text("${taskName}")`)
  await expect(task).toBeVisible()
})
