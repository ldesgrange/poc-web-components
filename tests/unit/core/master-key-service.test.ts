import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { setupIndexedDB, teardownIndexedDB, createTestMasterKey, createWebAuthnMasterKey } from './test-utils'
import { MasterKeyService, IndexedDBMasterKeyService, DEFAULT_MASTER_KEY_ID } from '../../../src/core/master-key-service'
import { generateMasterKey, newMasterKey } from '../../../src/core/master-key-utils'

describe('MasterKeyService', () => {
  let masterKeyService: MasterKeyService

  beforeEach(() => {
    setupIndexedDB()
    masterKeyService = new IndexedDBMasterKeyService()
  })

  afterEach(() => {
    masterKeyService.close()
    teardownIndexedDB()
  })

  it('should save and retrieve a master key', async () => {
    const masterKey = createTestMasterKey()

    await masterKeyService.saveMasterKey(masterKey)
    const retrieved = await masterKeyService.getMasterKey('test-id')

    expect(retrieved).toEqual(masterKey)
  })

  it('should return undefined for non-existent key', async () => {
    const retrieved = await masterKeyService.getMasterKey('non-existent')
    expect(retrieved).toBeUndefined()
  })

  it('should list all master keys', async () => {
    const mk1 = newMasterKey({ id:'mk1' })
    const mk2 = newMasterKey({ id:'mk2' })

    await masterKeyService.saveMasterKey(mk1)
    await masterKeyService.saveMasterKey(mk2)

    const list = await masterKeyService.listMasterKeys()
    expect(list).toHaveLength(2)
    expect(list).toContainEqual(mk1)
    expect(list).toContainEqual(mk2)
  })

  it('should delete a master key', async () => {
    const mk = newMasterKey({ id:'to-delete' })

    await masterKeyService.saveMasterKey(mk)
    await masterKeyService.deleteMasterKey('to-delete')
    const retrieved = await masterKeyService.getMasterKey('to-delete')
    expect(retrieved).toBeUndefined()
  })

  it('should support WebAuthn wrapped keys', async () => {
    const masterKey = createWebAuthnMasterKey()

    await masterKeyService.saveMasterKey(masterKey)
    const retrieved = await masterKeyService.getMasterKey('webauthn-id')
    expect(retrieved).toEqual(masterKey)
  })

  it('should retrieve a master key from password and use it for encryption/decryption', async () => {
    const password = 'test-password'
    const id = 'crypto-test-id'

    // 1. Generate master key.
    await generateMasterKey(id, password).then((mk) => masterKeyService.saveMasterKey(mk))

    // 2. Retrieve master key using password.
    const masterKey = await masterKeyService.getMasterKeyFromPassword(id, password)

    expect(masterKey).toBeDefined()
    expect(masterKey.type).toBe('secret')
    expect(masterKey.algorithm.name).toBe('AES-GCM')

    // 3. Prove it can encrypt and decrypt.
    const data = new TextEncoder().encode('secret message')
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      masterKey,
      data,
    )

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      masterKey,
      encrypted,
    )

    expect(new TextDecoder().decode(decrypted)).toBe('secret message')
  })

  it('should throw error if master key not found when retrieving from password', async () => {
    await expect(masterKeyService.getMasterKeyFromPassword('unknown', 'any-password'))
      .rejects.toThrow('Master key with id unknown not found')
  })

  it('should throw error if no password-wrapped key is available', async () => {
    const id = 'empty-mk'
    const mk = newMasterKey({ id: id })
    await masterKeyService.saveMasterKey(mk)

    await expect(masterKeyService.getMasterKeyFromPassword(id, 'password'))
      .rejects.toThrow(`No password-wrapped key found for master key ${id}`)
  })

  it('should re-wrap a master key with a new password', async () => {
    const oldPassword = 'old-password'
    const newPassword = 'new-password'
    const id = 're-wrap-service-id'

    // 1. Generate and save initial master key.
    const mk = await generateMasterKey(id, oldPassword)
    await masterKeyService.saveMasterKey(mk)

    // 2. Get decrypted key.
    const decryptedKey = await masterKeyService.getMasterKeyFromPassword(id, oldPassword)

    // 3. Re-wrap.
    await masterKeyService.resetMasterKeyWrappingWithPassword(id, decryptedKey, newPassword)

    // 4. Verify we can now unlock with the NEW password.
    const reUnlockedKey = await masterKeyService.getMasterKeyFromPassword(id, newPassword)
    expect(reUnlockedKey).toBeDefined()

    // 5. Verify we CANNOT unlock with the OLD password anymore.
    await expect(masterKeyService.getMasterKeyFromPassword(id, oldPassword)).rejects.toThrow()
  })

  it('should add a webauthn wrapping and retrieve the master key with it', async () => {
    const password = 'my-password'
    const masterKey = await generateMasterKey(DEFAULT_MASTER_KEY_ID, password)
    await masterKeyService.saveMasterKey(masterKey)

    const decryptedKey = await masterKeyService.getMasterKeyFromPassword(DEFAULT_MASTER_KEY_ID, password)

    const prfKey = new Uint8Array(32).fill(2).buffer
    const credentialId = new Uint8Array(16).fill(3).buffer
    const rpId = 'localhost'
    const prfSalt = new Uint8Array(32).fill(4).buffer

    await masterKeyService.resetMasterKeyWrappingWithWebAuthn(DEFAULT_MASTER_KEY_ID, decryptedKey, prfKey, credentialId, rpId, prfSalt)

    const updatedMasterKey = await masterKeyService.getMasterKey(DEFAULT_MASTER_KEY_ID)
    expect(updatedMasterKey?.wrappedKeys).toHaveLength(2)
    expect(updatedMasterKey?.wrappedKeys.some(k => k.type === 'webauthn')).toBe(true)

    const unlockedWithWebAuthn = await masterKeyService.getMasterKeyFromWebAuthn(DEFAULT_MASTER_KEY_ID, prfKey)
    expect(unlockedWithWebAuthn).toBeDefined()

    // Test that we can still unlock with password.
    const unlockedWithPassword = await masterKeyService.getMasterKeyFromPassword(DEFAULT_MASTER_KEY_ID, password)
    expect(unlockedWithPassword).toBeDefined()
  })

  it('should throw error if webauthn wrapping is missing', async () => {
    const password = 'my-password'
    const masterKey = await generateMasterKey(DEFAULT_MASTER_KEY_ID, password)
    await masterKeyService.saveMasterKey(masterKey)

    const prfKey = new Uint8Array(32).fill(2).buffer
    await expect(masterKeyService.getMasterKeyFromWebAuthn(DEFAULT_MASTER_KEY_ID, prfKey))
      .rejects.toThrow('No webauthn-wrapped key found')
  })
})
