import { vi } from 'vitest'
import { MasterKey } from '../../../src/core/master-key-types'
import { DbInfo } from '../../../src/core/storage-service'

/**
 * Minimal mock for IndexedDB for unit testing services.
 * It simulates basic CRUD operations using a Map-based store.
 */
export const mockIndexedDB = () => {
  const stores = new Map<string, Map<string, unknown>>()

  return {
    open: vi.fn().mockImplementation((name: string, _version: number) => {
      if (!stores.has(name)) {
        stores.set(name, new Map())
      }
      const dbStore = stores.get(name)!

      const createReq = (result?: unknown): IDBRequest => {
        const request = { result: result, onsuccess: null } as Partial<IDBRequest> as IDBRequest
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess!(new Event('success'))
        }, 0)
        return request
      }

      const db = {
        objectStoreNames: {
          contains: vi.fn().mockReturnValue(true),
        } as Partial<DOMStringList>,
        transaction: vi.fn().mockImplementation(() => ({
          objectStore: vi.fn().mockImplementation(() => ({
            put: vi.fn().mockImplementation((data: { id: string }) => {
              dbStore.set(data.id, data)
              return createReq()
            }),
            get: vi.fn().mockImplementation((id: string) => createReq(dbStore.get(id))),
            delete: vi.fn().mockImplementation((id: string) => {
              dbStore.delete(id)
              return createReq()
            }),
            getAll: vi.fn().mockImplementation(() => createReq(Array.from(dbStore.values()))),
          } as Partial<IDBObjectStore> as IDBObjectStore)),
        } as Partial<IDBTransaction> as IDBTransaction)),
        close: vi.fn(),
      } as Partial<IDBDatabase> as IDBDatabase

      const request = { result: db, onsuccess: null } as Partial<IDBOpenDBRequest> as IDBOpenDBRequest
      setTimeout(() => {
        if (request.onsuccess) request.onsuccess!(new Event('success'))
      }, 0)
      return request
    }),
  }
}

export const setupIndexedDB = () => {
  vi.stubGlobal('indexedDB', mockIndexedDB())
}

export const teardownIndexedDB = () => {
  vi.unstubAllGlobals()
}

export const createTestDbInfo = (overrides?: Partial<DbInfo>): DbInfo => ({
  name: 'test-db',
  version: 1,
  storeName: 'tasks',
  ...overrides,
})

export const createTestMasterKey = (id = 'test-id'): MasterKey => ({
  id: id,
  version: 1,
  createdAt: Date.now(),
  wrappedKeys: [{
    id: 'w1',
    type: 'password',
    algorithm: 'AES-GCM',
    wrappedKey: new Uint8Array([1, 2, 3]).buffer,
    iv: new Uint8Array([4, 5, 6]).buffer,
    createdAt: Date.now(),
    kdf: {
      name: 'PBKDF2',
      salt: new Uint8Array([7, 8, 9]).buffer,
      iterations: 1000,
      hash: 'SHA-256',
    },
  }],
})

export const createWebAuthnMasterKey = (id = 'webauthn-id'): MasterKey => ({
  id: id,
  version: 1,
  createdAt: Date.now(),
  wrappedKeys: [{
    id: 'w2',
    type: 'webauthn',
    algorithm: 'AES-GCM',
    wrappedKey: new Uint8Array([10]).buffer,
    iv: new Uint8Array([11]).buffer,
    createdAt: Date.now(),
    credentialId: new Uint8Array([12]).buffer,
    relyingPartyId: 'localhost',
    prfSalt: new Uint8Array([13]).buffer,
    derivation: 'hmac-secret',
  }],
})
