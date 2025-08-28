import { describe, expect, it } from 'vitest'

import { WrappedKey } from '../../../src/core/master-key-types'
import { generateMasterKey, setPasswordWrapping, setWebAuthnWrapping } from '../../../src/core/master-key-utils'

describe('MasterKeyUtils', () => {
  it('should generate a master key correctly', async () => {
    const password = 'test-password'
    const id = 'generated-id'

    const masterKey = await generateMasterKey(id, password)

    expect(masterKey.id).toBe(id)
    expect(masterKey.wrappedKeys).toHaveLength(1)
    const wrappedKey = masterKey.wrappedKeys[0]
    expect(wrappedKey?.type).toBe('password')
    expect(wrappedKey?.algorithm).toBe('AES-GCM')
    expect(wrappedKey?.wrappedKey).toBeDefined()
    expect(wrappedKey?.iv).toBeDefined()
    if (wrappedKey?.type === 'password') {
      expect(wrappedKey.kdf.name).toBe('PBKDF2')
    }
  })

  it('should set password wrapping on a master key', async () => {
    const oldPassword = 'old-password'
    const newPassword = 'new-password'
    const id = 're-wrap-id'

    // 1. Generate initial master key.
    const masterKey = await generateMasterKey(id, oldPassword)
    const initialWrappedKeyId = masterKey.wrappedKeys[0]!.id

    // 2. We need a decrypted version of the master key to re-wrap it.
    // In a real scenario, this comes from unwrapKey.
    // For testing, we can just generate a new key as the "decrypted" one.
    const decryptedKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    )

    // 3. Wrap.
    const updatedMasterKey = await setPasswordWrapping(masterKey, decryptedKey, newPassword)

    expect(updatedMasterKey.id).toBe(id)
    expect(updatedMasterKey.wrappedKeys).toHaveLength(1)
    const newWrappedKey = updatedMasterKey.wrappedKeys[0]!
    expect(newWrappedKey.type).toBe('password')
    expect(newWrappedKey.id).not.toBe(initialWrappedKeyId)

    // 4. Verify the new wrapped key can be unwrapped (implicitly by checking structure)
    if (newWrappedKey.type === 'password') {
      expect(newWrappedKey.kdf.salt).toBeDefined()
      expect(newWrappedKey.kdf.salt.byteLength).toBe(16)
    }
  })

  it('should set webauthn wrapping on a master key', async () => {
    // Generate a master key with password first.
    const masterKey = await generateMasterKey('id', 'password')

    // Generate decrypted key.
    const decryptedKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])

    const prfKey = new Uint8Array(32).fill(1).buffer
    const credentialId = new Uint8Array(16).fill(2).buffer
    const rpId = 'localhost'
    const prfSalt = new Uint8Array(32).fill(3).buffer

    // Wrap.
    const updatedMasterKey = await setWebAuthnWrapping(masterKey, prfKey, decryptedKey, credentialId, rpId, prfSalt)

    expect(updatedMasterKey.wrappedKeys).toHaveLength(2)
    const webauthnKey = updatedMasterKey.wrappedKeys.find((k: WrappedKey) => k.type === 'webauthn')
    expect(webauthnKey).toBeDefined()
  })
})
