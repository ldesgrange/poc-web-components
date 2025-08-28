import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest'

import { createTestDbInfo } from './test-utils'
import * as dbUtils from '../../../src/core/db-utils'
import { EncryptingStorageService } from '../../../src/core/storage-service'

describe('EncryptingStorageService', () => {
  let storageService: EncryptingStorageService
  let openDatabaseSpy: Mock<typeof dbUtils.openDatabase>
  let mockCryptoKey: CryptoKey

  beforeEach(async () => {
    storageService = new EncryptingStorageService()

    mockCryptoKey = {
      type: 'secret',
      algorithm: { name: 'AES-GCM' },
      extractable: false,
      usages: ['encrypt', 'decrypt'],
    } as CryptoKey

    // @ts-expect-error - access private for testing
    openDatabaseSpy = vi.spyOn(dbUtils, 'openDatabase').mockResolvedValue({ close: vi.fn() })
  })

  afterEach(() => {
    storageService.close()
  })

  describe('open and close', () => {
    it('should open with encryption key', () => {
      expect(storageService.isOpen()).toBe(false)

      storageService.open({ encryptionKey: mockCryptoKey })

      expect(storageService.isOpen()).toBe(true)
    })

    it('should close and clear encryption key', () => {
      storageService.open({ encryptionKey: mockCryptoKey })
      expect(storageService.isOpen()).toBe(true)

      storageService.close()

      expect(storageService.isOpen()).toBe(false)
      expect(storageService['encryptionKey']).toBeNull()
    })
  })

  describe('database caching', () => {
    it('should open database only once even if called with different DbInfo instances with same content', async () => {
      const dbInfo1 = createTestDbInfo({ storeName: 'test-store' })
      const dbInfo2 = createTestDbInfo({ storeName: 'test-store' })

      openDatabaseSpy.mockClear()
      await storageService['getDB'](dbInfo1)
      await storageService['getDB'](dbInfo2)
      await storageService['getDB'](dbInfo1)

      // It should now only be called once because the string key is the same.
      expect(openDatabaseSpy).toHaveBeenCalledExactlyOnceWith('test-db', 1, 'test-store')
    })
  })

  describe('put', () => {
    it('should encrypt and store record', async () => {
      const putRecordSpy = vi.spyOn(dbUtils, 'putRecord').mockResolvedValue()
      vi.spyOn(crypto.subtle, 'encrypt').mockResolvedValue(new ArrayBuffer(100))
      storageService.open({ encryptionKey: mockCryptoKey })

      const dbInfo = createTestDbInfo()
      const record = { id: '1', name: 'Test Task' }

      await storageService.put(dbInfo, record)

      expect(putRecordSpy).toHaveBeenCalled()
      const storedRecord = putRecordSpy.mock.calls[0]![2] as { id: string; data: ArrayBuffer; iv: ArrayBuffer }
      expect(storedRecord.id).toBe('1')
      expect(storedRecord.data).toBeDefined()
      expect(storedRecord.iv).toBeDefined()
    })

    it('should throw if storage is not open', async () => {
      const dbInfo = createTestDbInfo()
      const record = { id: '1', name: 'Test Task' }

      await expect(storageService.put(dbInfo, record)).rejects.toThrow('StorageService is locked')
    })
  })

  describe('get', () => {
    it('should retrieve and decrypt record', async () => {
      const encryptedRecord = {
        id: '1',
        data: new ArrayBuffer(100),
        iv: new ArrayBuffer(12),
      }
      const getRecordSpy = vi.spyOn(dbUtils, 'getRecord').mockResolvedValue(encryptedRecord)

      // Mock crypto.subtle.decrypt
      const decryptedData = new TextEncoder().encode(JSON.stringify({ id: '1', name: 'Decrypted Task' }))
      vi.spyOn(crypto.subtle, 'decrypt').mockResolvedValue(decryptedData.buffer)

      storageService.open({ encryptionKey: mockCryptoKey })

      const dbInfo = createTestDbInfo()
      const result = await storageService.get(dbInfo, '1')

      expect(getRecordSpy).toHaveBeenCalledWith(expect.anything(), 'tasks', '1')
      expect(result).toBeDefined()
    })

    it('should return undefined if record not found', async () => {
      vi.spyOn(dbUtils, 'getRecord').mockResolvedValue(undefined)
      storageService.open({ encryptionKey: mockCryptoKey })

      const dbInfo = createTestDbInfo()
      const result = await storageService.get(dbInfo, 'non-existent')

      expect(result).toBeUndefined()
    })

    it('should throw if storage is not open and record exists', async () => {
      const encryptedRecord = {
        id: '1',
        data: new ArrayBuffer(100),
        iv: new ArrayBuffer(12),
      }
      vi.spyOn(dbUtils, 'getRecord').mockResolvedValue(encryptedRecord as never)
      // Don't open storage

      const dbInfo = createTestDbInfo()

      await expect(storageService.get(dbInfo, '1')).rejects.toThrow('StorageService is locked')
    })
  })

  describe('getAll', () => {
    it('should retrieve and decrypt all records', async () => {
      const encryptedRecords = [
        { id: '1', data: new ArrayBuffer(100), iv: new ArrayBuffer(12) },
        { id: '2', data: new ArrayBuffer(100), iv: new ArrayBuffer(12) },
      ]
      const getAllRecordsSpy = vi.spyOn(dbUtils, 'getAllRecords').mockResolvedValue(encryptedRecords as never)

      // Mock crypto.subtle.decrypt.
      vi.spyOn(crypto.subtle, 'decrypt')
        .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify({ id: '1', name: 'Task 1' })).buffer)
        .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify({ id: '2', name: 'Task 2' })).buffer)

      storageService.open({ encryptionKey: mockCryptoKey })

      const dbInfo = createTestDbInfo()
      const result = await storageService.getAll(dbInfo)

      expect(getAllRecordsSpy).toHaveBeenCalled()
      expect(result).toHaveLength(2)
    })

    it('should return empty array if no records', async () => {
      vi.spyOn(dbUtils, 'getAllRecords').mockResolvedValue([])
      storageService.open({ encryptionKey: mockCryptoKey })

      const dbInfo = createTestDbInfo()
      const result = await storageService.getAll(dbInfo)

      expect(result).toEqual([])
    })

    it('should throw if storage is not open and records exist', async () => {
      const encryptedRecords = [
        { id: '1', data: new ArrayBuffer(100), iv: new ArrayBuffer(12) },
      ]
      vi.spyOn(dbUtils, 'getAllRecords').mockResolvedValue(encryptedRecords as never)
      // Don't open storage.

      const dbInfo = createTestDbInfo()

      await expect(storageService.getAll(dbInfo)).rejects.toThrow('StorageService is locked')
    })
  })

  describe('delete', () => {
    it('should delete record', async () => {
      const deleteRecordSpy = vi.spyOn(dbUtils, 'deleteRecord').mockResolvedValue()
      storageService.open({ encryptionKey: mockCryptoKey })

      const dbInfo = createTestDbInfo()
      await storageService.delete(dbInfo, '1')

      expect(deleteRecordSpy).toHaveBeenCalledWith(expect.anything(), 'tasks', '1')
    })
  })
})
