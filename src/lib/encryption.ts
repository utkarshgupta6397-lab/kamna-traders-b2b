import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getKey(): Buffer {
  let keyStr = process.env.ENCRYPTION_KEY;
  if (!keyStr) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    // Fallback for development
    keyStr = '00000000000000000000000000000000';
  }
  
  if (keyStr.length !== 32) {
    // Hash it to ensure it's exactly 32 bytes for aes-256
    return crypto.createHash('sha256').update(String(keyStr)).digest();
  }
  return Buffer.from(keyStr, 'utf-8');
}

/**
 * Encrypts a string using AES-256-GCM
 */
export function encryptString(text: string): string {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    // Format: iv:authTag:encryptedText
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('[Encryption] Failed to encrypt string:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypts a string previously encrypted with encryptString
 */
export function decryptString(text: string): string {
  if (!text) return text;
  
  try {
    const parts = text.split(':');
    // If it's not in the expected format, it might be legacy unencrypted data or invalid.
    if (parts.length !== 3) {
      console.warn('[Encryption] Invalid encrypted text format. Returning as is (might be plain text).');
      return text;
    }
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[Encryption] Failed to decrypt string:', error);
    throw new Error('Decryption failed');
  }
}
