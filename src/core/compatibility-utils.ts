export function isSecureContextAvailable(): boolean {
  // Spec: https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
  return typeof window !== 'undefined'
    && typeof window.isSecureContext !== 'undefined'
    && window.isSecureContext
}

export function isStorageApiAvailable(): boolean {
  // Spec: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API
  return typeof navigator !== 'undefined'
    && typeof navigator.storage !== 'undefined'
}

export function isPersistentStorageAvailable(): boolean {
  // Spec: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persisted
  return typeof navigator !== 'undefined'
    && typeof navigator.storage !== 'undefined'
    && typeof navigator.storage.persist === 'function'
}

export function isIndexedDbApiAvailable(): boolean {
  // Spec: https://developer.mozilla.org/en-US/docs/Web/API/Window/indexedDB
  return typeof window !== 'undefined'
    && typeof window.indexedDB !== 'undefined'
    && typeof window.indexedDB === 'object'
}

export async function isPersistentStoragePermissionGranted(): Promise<boolean> {
  // Check the permission api: https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API
  // Try to silently request permission if not already granted.
  return await navigator.storage.persisted() || await navigator.storage.persist()
}

export async function requestPersistentStoragePermission(): Promise<void> {
  return await navigator.storage.persist().then(() => {})
}

async function supportsDigest(algorithm: string) {
  try {
    await window.crypto.subtle.digest(algorithm, new Uint8Array([0]))
    return true
  } catch {
    return false
  }
}

export async function areCryptoPrimitivesAvailable(): Promise<boolean> {
  const hasCrypto = typeof window !== 'undefined' && typeof window.crypto !== 'undefined'
  if (!hasCrypto) return false

  const cryptoObject = window.crypto
  const hasRandomUUID = typeof cryptoObject.randomUUID === 'function'
  const hasGetRandomValues = typeof cryptoObject.getRandomValues === 'function'
  const hasSubtle = typeof cryptoObject.subtle === 'object'
  if (!hasRandomUUID || !hasGetRandomValues || !hasSubtle) return false

  // SHA-256 check.
  return await supportsDigest('SHA-256')
}
