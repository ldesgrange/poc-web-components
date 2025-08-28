import { describe, expect, it, Mock, vi, beforeEach } from 'vitest'

import {
  areCryptoPrimitivesAvailable,
  isIndexedDbApiAvailable, isPersistentStorageAvailable, isPersistentStoragePermissionGranted,
  isSecureContextAvailable, isStorageApiAvailable, requestPersistentStoragePermission,
} from '../../../src/core/compatibility-utils'

function mockWindow(isSecureContext: boolean | undefined, indexedDb: boolean) {
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value: isSecureContext,
  })
  Object.defineProperty(window, 'indexedDB', {
    configurable: true,
    value: indexedDb ? {} : undefined,
  })
}

function mockNavigator(storage: boolean, persistent: boolean) {
  const persistValue = persistent ? { persist: () => true } : undefined
  const storageValue = storage ? persistValue ?? {} : undefined
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: storageValue,
  })
}

function mockStorageManager(persisted: boolean, persist: boolean): [Mock, Mock] {
  const persistedMock = vi.fn().mockResolvedValue(persisted)
  const persistMock = vi.fn().mockResolvedValue(persist)
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: {
      persisted: persistedMock,
      persist: persistMock,
    },
  })
  return [persistedMock, persistMock]
}

describe('compatibility', () => {
  it('checks is in secure context', async () => {
    mockWindow(true, false)
    expect(isSecureContextAvailable()).toBe(true)

    mockWindow(false, false)
    expect(isSecureContextAvailable()).toBe(false)

    mockWindow(undefined, false)
    expect(isSecureContextAvailable()).toBe(false)
  })

  it('checks Storage API availability', async () => {
    mockNavigator(true, false)
    expect(isStorageApiAvailable()).toBe(true)

    mockNavigator(false, false)
    expect(isStorageApiAvailable()).toBe(false)
  })

  it('checks persistent storage availability', async () => {
    mockNavigator(true, true)
    expect(isPersistentStorageAvailable()).toBe(true)

    mockNavigator(true, false)
    expect(isPersistentStorageAvailable()).toBe(false)
  })

  it('checks IndexedDB availability', async () => {
    mockWindow(false, true)
    expect(isIndexedDbApiAvailable()).toBe(true)

    mockWindow(false, false)
    expect(isIndexedDbApiAvailable()).toBe(false)
  })

  it('checks PersistentStorage permission', async () => {
    // Returns `true` if the permission has already been granted.
    let [persistedMock, persistMock] = mockStorageManager(true, false)
    expect(await isPersistentStoragePermissionGranted()).toBe(true)
    expect(persistedMock).toHaveBeenCalledOnce()
    expect(persistMock).not.toHaveBeenCalled();

    // Returns `true` if the permission was not previously granted but is now immediately granted.
    [persistedMock, persistMock] = mockStorageManager(false, true)
    expect(await isPersistentStoragePermissionGranted()).toBe(true)
    expect(persistedMock).toHaveBeenCalledOnce()
    expect(persistMock).toHaveBeenCalledOnce();

    // Returns `false` if the permission has not been granted and not immediately granted.
    [persistedMock, persistMock] = mockStorageManager(false, false)
    expect(await isPersistentStoragePermissionGranted()).toBe(false)
    expect(persistedMock).toHaveBeenCalledOnce()
    expect(persistMock).toHaveBeenCalled()
  })

  it('requests PersistentStorage', async () => {
    // Calling `persist()` successfully returns `true`.
    let [_persistedMock, persistMock] = mockStorageManager(false, true)
    expect(await requestPersistentStoragePermission()).toBeUndefined()
    expect(persistMock).toHaveBeenCalledOnce();

    // Calling `persist()` may return `false`.
    [_persistedMock, persistMock] = mockStorageManager(false, false)
    expect(await requestPersistentStoragePermission()).toBeUndefined()
    expect(persistMock).toHaveBeenCalledOnce()
  })

  describe('areCryptoPrimitivesAvailable', () => {
    beforeEach(() => {
      vi.stubGlobal('window', { crypto: undefined })
    })

    it('should return false if window.crypto is not available', async () => {
      const result = await areCryptoPrimitivesAvailable()
      expect(result).toBe(false)
    })

    it('should return true if all crypto primitives are available', async () => {
      vi.stubGlobal('window', {
        crypto: {
          randomUUID: vi.fn().mockReturnValue('uuid'),
          getRandomValues: vi.fn(),
          subtle: { digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)) },
        },
      })

      const result = await areCryptoPrimitivesAvailable()
      expect(result).toBe(true)
    })

    it('should return false if randomUUID is missing', async () => {
      vi.stubGlobal('window', {
        crypto: {
          randomUUID: undefined,
          getRandomValues: vi.fn(),
          subtle: {},
        },
      })

      const result = await areCryptoPrimitivesAvailable()
      expect(result).toBe(false)
    })

    it('should return false if getRandomValues is missing', async () => {
      vi.stubGlobal('window', {
        crypto: {
          randomUUID: vi.fn(),
          getRandomValues: undefined,
          subtle: {},
        },
      })

      const result = await areCryptoPrimitivesAvailable()
      expect(result).toBe(false)
    })

    it('should return false if subtle is missing', async () => {
      vi.stubGlobal('window', {
        crypto: {
          randomUUID: vi.fn(),
          getRandomValues: vi.fn(),
          subtle: undefined,
        },
      })

      const result = await areCryptoPrimitivesAvailable()
      expect(result).toBe(false)
    })

    it('should return false if SHA-256 digest is not supported', async () => {
      vi.stubGlobal('window', {
        crypto: {
          randomUUID: vi.fn(),
          getRandomValues: vi.fn(),
          subtle: { digest: vi.fn().mockRejectedValue(new Error('Not supported')) },
        },
      })

      const result = await areCryptoPrimitivesAvailable()
      expect(result).toBe(false)
    })
  })
})
