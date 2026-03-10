import { MasterKey, PasswordWrappedKey, WebAuthnWrappedKey, WrappedKeyType } from '@app/core/master-key-types'

const WEB_AUTHN_USER_ID = 'user-id'
const WEB_AUTHN_USER_NAME = 'User'
/**  COSE Algorithm Identifiers */
const COSE_EDDSA: number = -8
const COSE_ES256: number = -7
const COSE_RS256: number = -257
/** Minimum recommended salt length for PBKDF2 (128 bits). */
const PBKDF2_SALT_LENGTH_BYTES = 16
/** Minimum recommended number of iterations, see: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2 */
const PBKDF2_DERIVATION_ITERATION_COUNT = 600000
/** Hash function used for HKDF (256 bits). */
const HKDF_HASH_ALGORITHM = 'SHA-256'
/** The recommended salt length for HKDF is to use the same length as hash (256 bits). */
export const HKDF_SALT_LENGTH_BYTES = 32
/** The minimum challenge length for WebAuthn is 16 bytes, use 32 bytes to align with the hash function. */
const WEB_AUTHN_CHALLENGE_LENGTH_BYTES = 32
/** Recommended Initialization Vector length for AES-GCM (96 bits). */
export const IV_LENGTH_BYTES = 12
/** AES-GCM key length (256 bits) */
export const AES_GCM_LENGTH_BITS = 256

export async function wrapKey(keyToWrap: CryptoKey, wrappingKey: CryptoKey): Promise<{ wrappedKey: ArrayBuffer; iv: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES))
  const wrappedKeyBuffer = await crypto.subtle.wrapKey(
    'raw',
    keyToWrap,
    wrappingKey,
    { name: 'AES-GCM', iv: iv },
  )

  return { wrappedKey: wrappedKeyBuffer, iv: iv.buffer }
}

export async function unwrapKey(unwrappingKey: CryptoKey, wrappedKey: ArrayBuffer, iv: ArrayBuffer): Promise<CryptoKey> {
  return await crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    unwrappingKey,
    { name: 'AES-GCM', iv: iv } as AesGcmParams,
    { name: 'AES-GCM', length: AES_GCM_LENGTH_BITS } as AesKeyAlgorithm,
    true,
    ['encrypt', 'decrypt'],
  )
}

export async function deriveKeyFromPassword(password: string, salt: ArrayBuffer, iterations: number, hash: string, keyUsages: KeyUsage[]): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: hash,
    },
    passwordKey,
    { name: 'AES-GCM', length: AES_GCM_LENGTH_BITS },
    false,
    keyUsages,
  )
}

export async function deriveKeyFromWebAuthn(prfKey: ArrayBuffer, prfSalt: ArrayBuffer, keyUsages: KeyUsage[]): Promise<CryptoKey> {
  // We use HKDF to derive a key from the PRF output to ensure high entropy and the right length.
  const baseKey = await crypto.subtle.importKey(
    'raw',
    prfKey,
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  )

  return await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      salt: prfSalt,
      info: new TextEncoder().encode('webauthn-prf-wrapping'),
      hash: HKDF_HASH_ALGORITHM,
    },
    baseKey,
    { name: 'AES-GCM', length: AES_GCM_LENGTH_BITS },
    false,
    keyUsages,
  )
}

export async function deriveAndWrapKeyWithPassword(password: string, keyToWrap: CryptoKey): Promise<PasswordWrappedKey> {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_LENGTH_BYTES))
  // 1. Derive a key from the password using PBKDF2.
  const derivedKey = await deriveKeyFromPassword(password, salt.buffer, PBKDF2_DERIVATION_ITERATION_COUNT, 'SHA-256', ['wrapKey'])

  // 2. Wrap the key with the derived key.
  const { wrappedKey, iv } = await wrapKey(keyToWrap, derivedKey)

  // 3. Create the password-wrapped key object.
  return {
    id: crypto.randomUUID(),
    type: 'password',
    algorithm: 'AES-GCM',
    wrappedKey: wrappedKey,
    iv: iv,
    createdAt: Date.now(),
    kdf: {
      name: 'PBKDF2',
      salt: salt.buffer,
      iterations: PBKDF2_DERIVATION_ITERATION_COUNT,
      hash: 'SHA-256',
    },
  }
}

export async function deriveAndWrapKeyWithWebAuthn(prfKey: ArrayBuffer, keyToWrap: CryptoKey, credentialId: ArrayBuffer, rpId: string, prfSalt: ArrayBuffer): Promise<WebAuthnWrappedKey> {
  // 1. Derive an AES key from the PRF key.
  const derivedKey = await deriveKeyFromWebAuthn(prfKey, prfSalt, ['wrapKey'])

  // 2. Wrap the key with the derived key.
  const { wrappedKey, iv } = await wrapKey(keyToWrap, derivedKey)

  return {
    id: crypto.randomUUID(),
    type: 'webauthn',
    algorithm: 'AES-GCM',
    wrappedKey: wrappedKey,
    iv: iv,
    createdAt: Date.now(),
    credentialId: credentialId,
    relyingPartyId: rpId,
    prfSalt: prfSalt,
    derivation: 'prf',
  }
}

function replaceWrappedKey(type: WrappedKeyType, masterKey: MasterKey, newWrappedKey: PasswordWrappedKey | WebAuthnWrappedKey): MasterKey {
  return {
    ...masterKey,
    wrappedKeys: [
      ...masterKey.wrappedKeys.filter(k => k.type !== type),
      newWrappedKey,
    ],
  }
}

export async function setPasswordWrapping(masterKey: MasterKey, decryptedKey: CryptoKey, newPassword: string): Promise<MasterKey> {
  // 1. Wrap the existing decrypted master key with the NEW password.
  const newWrappedKey = await deriveAndWrapKeyWithPassword(newPassword, decryptedKey)
  // 2. Return the updated master key (replacing existing password-wrapped keys).
  return replaceWrappedKey('password', masterKey, newWrappedKey)
}

export async function setWebAuthnWrapping(masterKey: MasterKey, prfKey: ArrayBuffer, decryptedKey: CryptoKey, credentialId: ArrayBuffer, rpId: string, prfSalt: ArrayBuffer): Promise<MasterKey> {
  // 1. Wrap the existing decrypted master key with the NEW webauthn key.
  const newWrappedKey = await deriveAndWrapKeyWithWebAuthn(prfKey, decryptedKey, credentialId, rpId, prfSalt)
  // 2. Return the updated master key (replacing existing password-wrapped keys).
  return replaceWrappedKey('webauthn', masterKey, newWrappedKey)
}

export function newMasterKey(overrides?: Partial<MasterKey>): MasterKey {
  return {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: Date.now(),
    wrappedKeys: [],
    ...overrides,
  }
}

export async function generateMasterKey(id: string, password: string): Promise<MasterKey> {
  // Generate a random 256-bit master key.
  const masterKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: AES_GCM_LENGTH_BITS },
    true,
    ['encrypt', 'decrypt'],
  )

  return setPasswordWrapping(newMasterKey({ id: id }), masterKey, password)
}

export async function isWebAuthnPRFSupported(): Promise<boolean> {
  if (!window.PublicKeyCredential || typeof PublicKeyCredential.getClientCapabilities !== 'function') {
    return false
  }

  const caps = await PublicKeyCredential.getClientCapabilities()
  return !!caps['extension:prf']
}

/**
 * Register a new WebAuthn credential.
 */
export async function registerWebAuthn(rpId: string): Promise<ArrayBuffer> {
  const challenge = crypto.getRandomValues(new Uint8Array(WEB_AUTHN_CHALLENGE_LENGTH_BYTES))
  const salt = crypto.getRandomValues(new Uint8Array(HKDF_SALT_LENGTH_BYTES))
  const userHandle = new TextEncoder().encode(WEB_AUTHN_USER_ID)

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: challenge,
    rp: { name: 'TASK App', id: rpId },
    user: { id: userHandle, name: WEB_AUTHN_USER_NAME, displayName: WEB_AUTHN_USER_NAME },
    pubKeyCredParams: [
      { alg: COSE_EDDSA, type: 'public-key' },
      { alg: COSE_ES256, type: 'public-key' },
      { alg: COSE_RS256, type: 'public-key' },
    ],
    authenticatorSelection: {
      userVerification: 'required',
      residentKey: 'preferred',
      requireResidentKey: false,
    },
    extensions: {
      // Request PRF support.
      prf: {
        eval: {
          first: salt,
        },
      },
    } as AuthenticationExtensionsClientInputs,
  }

  const credential = (await navigator.credentials.create({ publicKey: publicKey })) as PublicKeyCredential
  if (!credential) {
    throw new Error('Failed to create WebAuthn credential.')
  }

  const prfResults = credential.getClientExtensionResults()?.prf as { enabled: boolean } | undefined
  if (!prfResults || !prfResults.enabled) {
    throw new Error('WebAuthn PRF extension not supported or not enabled by authenticator.')
  }

  return credential.rawId
}

/**
 * Evaluate the PRF extension for a specific credential and salt.
 */
export async function getWebAuthnPRF(rpId: string, credentialId: ArrayBuffer, salt: ArrayBuffer): Promise<ArrayBuffer> {
  const challenge = crypto.getRandomValues(new Uint8Array(WEB_AUTHN_CHALLENGE_LENGTH_BYTES))

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: challenge,
    rpId: rpId,
    allowCredentials: [{
      id: credentialId,
      type: 'public-key',
    }],
    userVerification: 'required',
    extensions: {
      prf: {
        eval: {
          first: new Uint8Array(salt),
        },
      },
    } as AuthenticationExtensionsClientInputs,
  }

  const authCredentials = (await navigator.credentials.get({ publicKey: publicKey })) as PublicKeyCredential
  if (!authCredentials) {
    throw new Error('Failed to get WebAuthn assertion.')
  }

  const prfResults = authCredentials.getClientExtensionResults()?.prf as { results: { first: ArrayBuffer } } | undefined
  const prfKey = prfResults?.results?.first

  if (!prfKey) {
    throw new Error('WebAuthn PRF extension did not return a key.')
  }

  return prfKey
}
