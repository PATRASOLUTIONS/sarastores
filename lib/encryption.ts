import crypto from 'crypto'

const ALGO = 'aes-256-gcm'
const KEY = process.env.API_KEY_ENCRYPTION_SECRET || process.env.PARTNER_API_KEY_SECRET || ''

if (!KEY || KEY.length < 32) {
  // do not throw in production; encryption will be a no-op if key missing, but log warning
  if (process.env.NODE_ENV === 'development') {
    console.warn('[encryption] Warning: API_KEY_ENCRYPTION_SECRET not set or too short (32 bytes recommended)')
  }
}

function getKey() {
  // Ensure 32-byte key (derive if necessary)
  if (KEY.length === 32) return Buffer.from(KEY)
  // Derive 32-byte key from secret using SHA256
  return crypto.createHash('sha256').update(KEY).digest()
}

export function encrypt(text: string) {
  if (!KEY || KEY.length < 16) {
    // Fail closed: never silently store secrets unencrypted.
    throw new Error('Encryption key (API_KEY_ENCRYPTION_SECRET) is not configured.')
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
}

export function decrypt(ciphertext: string, ivB64: string, tagB64: string) {
  if (!KEY || !ciphertext) return ''
  try {
    const iv = Buffer.from(ivB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()])
    return decrypted.toString('utf8')
  } catch (e) {
    console.error('[encryption] decrypt error', e)
    return ''
  }
}

export default { encrypt, decrypt }
