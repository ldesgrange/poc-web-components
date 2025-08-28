import { Page } from '@playwright/test'

import { MasterKey } from '../../../src/core/master-key-types.js'
import { toArrayBuffer } from '../../../src/core/utils.js'

/**
 * Pre-processes masterKeyData to make it serializable for page.addInitScript.
 * Converts ArrayBuffers to regular Arrays.
 */
export function prepareMasterKeyForSerialization(masterKey: MasterKey): MasterKey {
  masterKey.wrappedKeys.forEach(wk => {
    wk.wrappedKey = Array.from(new Uint8Array(wk.wrappedKey)) as unknown as ArrayBuffer
    wk.iv = Array.from(new Uint8Array(wk.iv)) as unknown as ArrayBuffer
    if ('kdf' in wk && wk.kdf && wk.kdf.salt) {
      wk.kdf.salt = Array.from(new Uint8Array(wk.kdf.salt)) as unknown as ArrayBuffer
    }
    if ('credentialId' in wk && wk.credentialId) {
      wk.credentialId = Array.from(new Uint8Array(wk.credentialId)) as unknown as ArrayBuffer
    }
  })
  return masterKey
}

/**
 * Sets up a master key in IndexedDB within the browser context.
 * Also mocks navigator.storage persistence.
 */
export async function setupMasterKeyInPage(page: Page, masterKeyData?: MasterKey) {
  const serializableMasterKey = masterKeyData ? prepareMasterKeyForSerialization(masterKeyData) : undefined

  await page.addInitScript(({ masterKey, toArrayBufferFn }) => {
    // Helper to convert Arrays back to ArrayBuffers.
    const toArrayBuffer = eval(`(${toArrayBufferFn})`)

    // Mock navigator.storage to return true for persisted and persist by default for this feature.
    if (navigator.storage) {
      Object.defineProperty(navigator.storage, 'persisted', {
        configurable: true,
        writable: true,
        value: () => Promise.resolve(true),
      })
      Object.defineProperty(navigator.storage, 'persist', {
        configurable: true,
        writable: true,
        value: () => Promise.resolve(true),
      })
    }

    if (masterKey) {
      // Restore ArrayBuffers.
      masterKey.wrappedKeys.forEach((wk) => {
        wk.wrappedKey = toArrayBuffer(wk.wrappedKey)
        wk.iv = toArrayBuffer(wk.iv)
        if ('kdf' in wk && wk.kdf && wk.kdf.salt) {
          wk.kdf.salt = toArrayBuffer(wk.kdf.salt)
        }
        if ('credentialId' in wk && wk.credentialId) {
          wk.credentialId = toArrayBuffer(wk.credentialId)
        }
      })

      const request = indexedDB.open('master-key-db', 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('master-keys')) {
          db.createObjectStore('master-keys', { keyPath: 'id' })
        }
      }
      request.onsuccess = async () => {
        const db = request.result
        const tx = db.transaction('master-keys', 'readwrite')
        const store = tx.objectStore('master-keys')

        // Only seed the master key if it doesn't already exist (avoid overwriting changes made by the app).
        const getReq = store.get(masterKey.id)
        getReq.onsuccess = () => {
          const exists = !!getReq.result
          if (!exists) {
            store.put(masterKey)
          }
        }

        tx.oncomplete = () => db.close()
      }
    }
  }, { masterKey: serializableMasterKey, toArrayBufferFn: toArrayBuffer.toString() })
}
