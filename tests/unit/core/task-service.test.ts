import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { setupIndexedDB, teardownIndexedDB } from './test-utils'
import { MasterKeyService, IndexedDBMasterKeyService } from '../../../src/core/master-key-service'
import { generateMasterKey } from '../../../src/core/master-key-utils'
import { serviceRegistry } from '../../../src/core/service-registry'
import { StorageOption, StorageService, EncryptingStorageService } from '../../../src/core/storage-service'
import { TaskService, PersistedTaskService } from '../../../src/core/task-service'
import { MoveDirection, TaskStatus } from '../../../src/core/task-types'

describe('TaskService', () => {
  let taskService: TaskService
  let storageService: StorageService<StorageOption>
  let masterKeyService: MasterKeyService
  let encryptionKey: CryptoKey

  beforeEach(async () => {
    setupIndexedDB()
    masterKeyService = new IndexedDBMasterKeyService()
    storageService = new EncryptingStorageService()

    // Setup a master key for encryption
    const id = 'default'
    const password = 'test-password'
    const mk = await generateMasterKey(id, password)
    await masterKeyService.saveMasterKey(mk)
    encryptionKey = await masterKeyService.getMasterKeyFromPassword(id, password)

    storageService.open({ encryptionKey: encryptionKey })

    // Register services
    serviceRegistry.set(StorageService, storageService)
    taskService = new PersistedTaskService()
    serviceRegistry.set(TaskService, taskService)
  })

  afterEach(() => {
    masterKeyService.close()
    teardownIndexedDB()
  })

  it('should add a task and retrieve it', async () => {
    const taskName = 'Buy milk'
    const task = await taskService.addTask(taskName)

    expect(task.task).toBe(taskName)
    expect(task.status).toBe(TaskStatus.ACTIVE)
    expect(task.id).toBeDefined()

    const allTasks = await taskService.getTasks()
    expect(allTasks).toBeDefined()
    expect(allTasks).toHaveLength(1)
    expect(allTasks?.[0]?.task).toBe(taskName)
  })

  it('should prevent adding an empty task', async () => {
    await expect(taskService.addTask('')).rejects.toThrow('Task name is required')
    await expect(taskService.addTask('   ')).rejects.toThrow('Task name is required')
  })

  it('should prevent adding a duplicate active task', async () => {
    await taskService.addTask('Buy milk')
    await expect(taskService.addTask('Buy milk')).rejects.toThrow('Task already exists')
  })

  it('should allow adding a duplicate task if the existing one is completed', async () => {
    const task = await taskService.addTask('Buy milk')
    // Simulate marking as completed (we'll need a toggle method)
    await taskService.updateTaskStatus(task.id, TaskStatus.COMPLETED)

    const newTask = await taskService.addTask('Buy milk')
    expect(newTask.id).not.toBe(task.id)

    const allTasks = await taskService.getTasks()
    expect(allTasks).toHaveLength(2)
  })

  it('should be case-insensitive and ignore whitespace when checking for duplicates', async () => {
    await taskService.addTask('Buy milk')
    await expect(taskService.addTask('  BUY MILK  ')).rejects.toThrow('Task already exists')
  })

  it('should filter out tasks with invalid IDs from getTasks', async () => {
    // 1. Add a valid task
    await taskService.addTask('Valid Task')

    // 2. Manually inject malformed tasks into the storage
    const malformedTasks = [
      { id: '', task: 'Empty ID Task', status: TaskStatus.ACTIVE, createdAt: Date.now(), position: 2000 },
      { id: undefined, task: 'Undefined ID Task', status: TaskStatus.ACTIVE, createdAt: Date.now(), position: 2100 },
      { id: null, task: 'Null ID Task', status: TaskStatus.ACTIVE, createdAt: Date.now(), position: 2200 },
      { id: 123, task: 'Number ID Task', status: TaskStatus.ACTIVE, createdAt: Date.now(), position: 2300 },
      { task: 'Missing ID Task', status: TaskStatus.ACTIVE, createdAt: Date.now(), position: 2400 },
    ]

    for (const malformed of malformedTasks) {
      // Use unknown to bypass type checking for invalid data injection
      await storageService.put({ name: 'task-db', version: 1, storeName: 'tasks' }, malformed as unknown as { id: string })
    }

    // 3. Retrieve tasks
    const tasks = await taskService.getTasks()

    // 4. Verify that only the valid task is returned
    expect(tasks).toHaveLength(1)
    expect(tasks?.[0]?.task).toBe('Valid Task')
  })

  it('should move a task below another and update only its position', async () => {
    const t1 = await taskService.addTask('Task 1') // Position: 1000.
    const t2 = await taskService.addTask('Task 2') // Position: 2000.
    const t3 = await taskService.addTask('Task 3') // Position: 3000.

    // Spy on storageService.put to see how many updates are made during moveTask
    const putSpy = vi.spyOn(storageService, 'put')

    // Move t1 below t2
    await taskService.moveTask(t1.id, t2.id, MoveDirection.BELOW)

    // Verify positions: t2(2000) < t1(new) < t3(3000)
    // New position = (2000 + 3000) / 2 = 2500.
    const tasks = await taskService.getTasks()
    expect(tasks[0]?.id).toBe(t2.id)
    expect(tasks[1]?.id).toBe(t1.id)
    expect(tasks[2]?.id).toBe(t3.id)
    expect(tasks[1]?.position).toBe(2500)
    // Check number of put calls during moveTask (should be exactly 1).
    expect(putSpy).toHaveBeenCalledTimes(1)
  })

  it('should move a task above another and update only its position', async () => {
    const t1 = await taskService.addTask('Task 1') // Position: 1000.
    const t2 = await taskService.addTask('Task 2') // Position: 2000.
    const putSpy = vi.spyOn(storageService, 'put')

    // Move t2 above t1
    await taskService.moveTask(t2.id, t1.id, MoveDirection.ABOVE)

    // New position = 1000 / 2 = 500.
    const tasks = await taskService.getTasks()
    expect(tasks[0]?.id).toBe(t2.id)
    expect(tasks[0]?.position).toBe(500)
    // Check number of put calls during moveTask (should be exactly 1).
    expect(putSpy).toHaveBeenCalledTimes(1)
  })

  it('should fallback to re-indexing if the gap is too small', async () => {
    // Create two tasks very close to each other
    const t1 = await taskService.addTask('Task 1')
    t1.position = 1000
    await storageService.put({ name: 'task-db', version: 1, storeName: 'tasks' }, t1)
    const t2 = await taskService.addTask('Task 2')
    t2.position = 1000.001
    await storageService.put({ name: 'task-db', version: 1, storeName: 'tasks' }, t2)
    const t3 = await taskService.addTask('Task 3')
    t3.position = 3000
    await storageService.put({ name: 'task-db', version: 1, storeName: 'tasks' }, t3)

    // Move t3 between t1 and t2. Gap is 0.001. Midpoint is 1000.0005.
    // Difference from 1000 is 0.0005 which is < 0.001. Should trigger re-index.
    const putSpy = vi.spyOn(storageService, 'put')

    await taskService.moveTask(t3.id, t1.id, MoveDirection.BELOW)

    const tasks = await taskService.getTasks()
    expect(tasks[0]?.position).toBe(1000)
    expect(tasks[1]?.position).toBe(2000)
    expect(tasks[2]?.position).toBe(3000)
    expect(putSpy).toHaveBeenCalledTimes(3)
  })
})
