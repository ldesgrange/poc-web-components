import { describe, expect, it, beforeEach, afterEach } from 'vitest'

import { setupIndexedDB, teardownIndexedDB } from './test-utils'
import { openDatabase } from '../../../src/core/db-utils'

describe('db-utils', () => {
  beforeEach(() => {
    setupIndexedDB()
  })

  afterEach(() => {
    teardownIndexedDB()
  })

  describe('openDatabase', () => {
    it('should open database', async () => {
      const db = await openDatabase('test-db', 1, 'test-store')

      expect(db).toBeDefined()
      expect(indexedDB.open).toHaveBeenCalledWith('test-db', 1)
      expect(db.objectStoreNames.contains('test-store')).toBe(true)
    })
  })
})
