// Versioned on-disk/vault-file format. Everything that leaves memory —
// localStorage blob and export file alike — is exactly this shape.

export interface VaultEntry {
  id: string
  label: string
  site?: string
  username?: string
  password: string
  notes?: string
  createdAt: number
  updatedAt: number
}

export interface VaultPayload {
  entries: VaultEntry[]
}

export interface EncryptedVaultFile {
  version: 1
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

export class VaultFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultFormatError'
  }
}

const CHUNK = 0x8000

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function fromBase64(s: string): Uint8Array {
  const binary = atob(s)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function serializeVault(file: EncryptedVaultFile): string {
  return JSON.stringify(file, null, 2)
}

export function parseVaultFile(json: string): EncryptedVaultFile {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new VaultFormatError('Not valid JSON.')
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new VaultFormatError('Vault file must be a JSON object.')
  }
  const obj = raw as Record<string, unknown>
  if (obj.version !== 1) throw new VaultFormatError(`Unsupported vault version: ${String(obj.version)}`)
  if (obj.kdf !== 'PBKDF2-SHA256') throw new VaultFormatError(`Unsupported KDF: ${String(obj.kdf)}`)
  if (typeof obj.iterations !== 'number' || !Number.isInteger(obj.iterations) || obj.iterations < 1) {
    throw new VaultFormatError('Invalid iterations.')
  }
  for (const field of ['salt', 'iv', 'ciphertext'] as const) {
    if (typeof obj[field] !== 'string' || obj[field].length === 0) {
      throw new VaultFormatError(`Missing or invalid field: ${field}`)
    }
  }
  return {
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: obj.iterations,
    salt: obj.salt as string,
    iv: obj.iv as string,
    ciphertext: obj.ciphertext as string,
  }
}
