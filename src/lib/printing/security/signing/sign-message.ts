import crypto from 'crypto';

/**
 * Signs a message using the QZ private key (SHA512).
 * This must ONLY be called server-side.
 */
export function signMessage(payload: string): string {
  const privateKey = process.env.QZ_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error('QZ_PRIVATE_KEY is not defined in environment variables');
  }

  try {
    const signer = crypto.createSign('RSA-SHA1');
    signer.update(payload);
    const signature = signer.sign(privateKey, 'base64');
    console.log('[QZ_SIGN] Signature generated successfully using RSA-SHA1');
    return signature;
  } catch (err: any) {
    console.error('[QZ_SIGNING_ERROR]', err.message);
    throw new Error('Failed to generate QZ signature');
  }
}
