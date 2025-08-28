export type WrappedKeyType = 'password' | 'webauthn'

export interface WrappedKeyBase {
  id: string // Unique per wrapping.
  type: WrappedKeyType // Discriminator.
  algorithm: string // E.g. "AES-GCM".
  wrappedKey: ArrayBuffer // Ciphertext.
  iv: ArrayBuffer
  createdAt: number
}

export interface PasswordWrappedKey extends WrappedKeyBase {
  type: 'password'

  kdf: {
    name: 'PBKDF2' | 'scrypt' | 'argon2id'
    salt: ArrayBuffer
    iterations: number
    hash: string
  }
}

export interface WebAuthnWrappedKey extends WrappedKeyBase {
  type: 'webauthn'

  credentialId: ArrayBuffer
  relyingPartyId: string
  prfSalt: ArrayBuffer

  // How the symmetric wrapping key was derived.
  derivation: 'hmac-secret' | 'prf' | 'other'
}

export type WrappedKey = PasswordWrappedKey | WebAuthnWrappedKey

export interface MasterKey {
  id: string // Stable identifier.
  version: number // For future migrations / rotations.
  createdAt: number

  wrappedKeys: WrappedKey[]
}
