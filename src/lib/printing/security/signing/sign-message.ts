import crypto from 'crypto';

/**
 * Signs a message using the QZ private key.
 * This must ONLY be called server-side.
 */
export function signMessage(payload: string): string {
  let privateKey = process.env.QZ_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error('QZ_PRIVATE_KEY is not defined in environment variables');
  }

  // Robustly handle multiline keys from environment variables
  // Vercel often escapes newlines as \n or strips them.
  if (!privateKey.includes('\n') && privateKey.includes('-----BEGIN')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  try {
    // Standard QZ Tray Demo Certs use SHA1. 
    // If you switch to a production cert, this may need to be 'RSA-SHA256'.
    const algorithm = 'RSA-SHA1'; 
    
    const signer = crypto.createSign(algorithm);
    signer.update(payload);
    const signature = signer.sign(privateKey, 'base64');
    
    console.log(`[QZ_SIGN] Signed successfully using ${algorithm}`);
    return signature;
  } catch (err: any) {
    console.error('[QZ_SIGNING_ERROR] RSA signing failed:', err.message);
    throw new Error(`Failed to generate QZ signature: ${err.message}`);
  }
}
