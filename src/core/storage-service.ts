import { openDatabase, putRecord, getRecord, deleteRecord, getAllRecords } from './db-utils'

export interface DbInfo {
  name: string
  version: number
  storeName: string
}

export type StorageRecord = { id: string }

export interface EncryptedRecord {
  id: string
  data: ArrayBuffer
  iv: ArrayBuffer
}

export type StorageOption = object

export abstract class StorageService<T extends StorageOption> {
  abstract open(options: T): void
  abstract close(): void
  abstract isOpen(): boolean
  abstract put<U extends StorageRecord>(dbInfo: DbInfo, record: U): Promise<void>
  abstract get<U extends StorageRecord>(dbInfo: DbInfo, id: string): Promise<U | undefined>
  abstract getAll<U extends StorageRecord>(dbInfo: DbInfo): Promise<U[]>
  abstract delete(dbInfo: DbInfo, id: string): Promise<void>
}

export interface EncryptingStorageOptions {
  encryptionKey: CryptoKey
}

export class EncryptingStorageService extends StorageService<EncryptingStorageOptions> {
  private encryptionKey: CryptoKey | null = null
  private databases: Map<string, IDBDatabase> = new Map<string, IDBDatabase>()

  private async getDB(dbInfo: DbInfo): Promise<IDBDatabase> {
    const key = `${dbInfo.name}-${dbInfo.version}-${dbInfo.storeName}`
    let database = this.databases.get(key)
    if (!database) {
      database = await openDatabase(dbInfo.name, dbInfo.version, dbInfo.storeName)
      this.databases.set(key, database)
    }
    return database
  }

  override open(options: EncryptingStorageOptions) {
    this.encryptionKey = options.encryptionKey
  }

  override close() {
    this.databases.forEach(db => db.close())
    this.encryptionKey = null
  }

  override isOpen(): boolean {
    return this.encryptionKey !== null
  }

  async put<T extends StorageRecord>(dbInfo: DbInfo, record: T): Promise<void> {
    const encryptedRecord = await this.encrypt(record.id, record)
    const db = await this.getDB(dbInfo)
    await putRecord(db, dbInfo.storeName, encryptedRecord)
  }

  async get<T extends StorageRecord>(dbInfo: DbInfo, id: string): Promise<T | undefined> {
    const db = await this.getDB(dbInfo)
    const encryptedRecord = await getRecord<EncryptedRecord>(db, dbInfo.storeName, id)
    return !encryptedRecord ? undefined : this.decrypt<T>(encryptedRecord)
  }

  async getAll<T extends StorageRecord>(dbInfo: DbInfo): Promise<T[]> {
    const db = await this.getDB(dbInfo)
    const encryptedRecords = await getAllRecords<EncryptedRecord>(db, dbInfo.storeName)

    return Promise.all(
      encryptedRecords.map(encryptedRecord => this.decrypt<T>(encryptedRecord)),
    )
  }

  async delete(dbInfo: DbInfo, id: string): Promise<void> {
    const db = await this.getDB(dbInfo)
    await deleteRecord(db, dbInfo.storeName, id)
  }

  private async encrypt<T>(id: string, data: T): Promise<EncryptedRecord> {
    if (!this.encryptionKey) {
      throw new Error('StorageService is locked.')
    }

    const encodedData = new TextEncoder().encode(JSON.stringify(data))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      this.encryptionKey,
      encodedData,
    )

    return {
      id: id,
      data: encryptedData,
      iv: iv.buffer,
    }
  }

  private async decrypt<T>(encryptedRecord: EncryptedRecord): Promise<T> {
    if (!this.encryptionKey) {
      throw new Error('StorageService is locked.')
    }

    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: encryptedRecord.iv },
      this.encryptionKey,
      encryptedRecord.data,
    )

    return JSON.parse(new TextDecoder().decode(decryptedData)) as T
  }
}
