import { setWebAuthnWrapping, deriveKeyFromPassword, deriveKeyFromWebAuthn, setPasswordWrapping, unwrapKey } from '@app/core/master-key-utils'
import { deleteRecord, getAllRecords, getRecord, openDatabase, putRecord } from './db-utils'
import { MasterKey, PasswordWrappedKey, WebAuthnWrappedKey, WrappedKey, WrappedKeyType } from './master-key-types'

const DB_NAME = 'master-key-db'
const DB_VERSION = 1
const STORE_NAME = 'master-keys'
export const DEFAULT_MASTER_KEY_ID = 'default'

export abstract class MasterKeyService {
  abstract saveMasterKey(masterKey: MasterKey): Promise<void>
  abstract getMasterKey(id?: string): Promise<MasterKey | undefined>
  abstract deleteMasterKey(id: string): Promise<void>
  abstract listMasterKeys(): Promise<MasterKey[]>
  abstract getMasterKeyFromPassword(id: string, password: string): Promise<CryptoKey>
  abstract getMasterKeyFromWebAuthn(id: string, prfKey: ArrayBuffer): Promise<CryptoKey>
  abstract resetMasterKeyWrappingWithPassword(id: string, decryptedKey: CryptoKey, newPassword: string): Promise<void>
  abstract resetMasterKeyWrappingWithWebAuthn(id: string, decryptedKey: CryptoKey, prfKey: ArrayBuffer, credentialId: ArrayBuffer, rpId: string, prfSalt: ArrayBuffer): Promise<void>
  abstract close(): void
}

export class IndexedDBMasterKeyService extends MasterKeyService {
  private db: IDBDatabase | null = null

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db
    this.db = await openDatabase(DB_NAME, DB_VERSION, STORE_NAME)
    return this.db
  }

  override async saveMasterKey(masterKey: MasterKey): Promise<void> {
    const db = await this.getDB()
    return putRecord(db, STORE_NAME, masterKey)
  }

  override async getMasterKey(id: string = DEFAULT_MASTER_KEY_ID): Promise<MasterKey | undefined> {
    const db = await this.getDB()
    return getRecord<MasterKey>(db, STORE_NAME, id)
  }

  override async deleteMasterKey(id: string): Promise<void> {
    const db = await this.getDB()
    return deleteRecord(db, STORE_NAME, id)
  }

  override async listMasterKeys(): Promise<MasterKey[]> {
    const db = await this.getDB()
    return getAllRecords<MasterKey>(db, STORE_NAME)
  }

  override async getMasterKeyFromPassword(id: string, password: string): Promise<CryptoKey> {
    const passwordWrappedKey = await this.getWrappedKey(id, 'password') as PasswordWrappedKey

    const kdf = passwordWrappedKey.kdf
    const derivedKey = await deriveKeyFromPassword(password, kdf.salt, kdf.iterations, kdf.hash, ['unwrapKey'])
    return await unwrapKey(derivedKey, passwordWrappedKey.wrappedKey, passwordWrappedKey.iv)
  }

  override async getMasterKeyFromWebAuthn(id: string, prfKey: ArrayBuffer): Promise<CryptoKey> {
    const webauthnWrappedKey = await this.getWrappedKey(id, 'webauthn') as WebAuthnWrappedKey

    const derivedKey = await deriveKeyFromWebAuthn(prfKey, webauthnWrappedKey.prfSalt, ['unwrapKey'])
    return await unwrapKey(derivedKey, webauthnWrappedKey.wrappedKey, webauthnWrappedKey.iv)
  }

  override async resetMasterKeyWrappingWithPassword(id: string, decryptedKey: CryptoKey, newPassword: string): Promise<void> {
    const masterKey = await this.getMasterKey(id)
    if (!masterKey) {
      throw new Error(`Master key with id ${id} not found`)
    }

    const updatedMasterKey = await setPasswordWrapping(masterKey, decryptedKey, newPassword)
    await this.saveMasterKey(updatedMasterKey)
  }

  override async resetMasterKeyWrappingWithWebAuthn(id: string, decryptedKey: CryptoKey, prfKey: ArrayBuffer, credentialId: ArrayBuffer, rpId: string, prfSalt: ArrayBuffer): Promise<void> {
    const masterKey = await this.getMasterKey(id)
    if (!masterKey) {
      throw new Error(`Master key with id ${id} not found`)
    }

    const updatedMasterKey = await setWebAuthnWrapping(masterKey, prfKey, decryptedKey, credentialId, rpId, prfSalt)
    await this.saveMasterKey(updatedMasterKey)
  }

  override close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  private async getWrappedKey(id: string, type: WrappedKeyType): Promise<WrappedKey> {
    const storedMasterKey = await this.getMasterKey(id)
    if (!storedMasterKey) {
      throw new Error(`Master key with id ${id} not found`)
    }

    const wrappedKey = storedMasterKey.wrappedKeys.find(k => k.type === type)
    if (!wrappedKey) {
      throw new Error(`No ${type}-wrapped key found for master key ${id}`)
    }
    return wrappedKey
  }
}
