import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { publicCert, privateKey } = await request.json();

    if (!publicCert || typeof publicCert !== 'string' || !privateKey || typeof privateKey !== 'string') {
      return NextResponse.json({ error: 'Both public certificate and private key are required' }, { status: 400 });
    }

    try {
      // 1. Verify private key syntax
      const privateKeyObj = crypto.createPrivateKey(privateKey);

      // 2. Load public certificate using X509Certificate parser to extract metadata
      const certObj = new crypto.X509Certificate(publicCert);
      
      const expiry = certObj.validTo;
      const subject = certObj.subject;
      const issuer = certObj.issuer;

      // Extract SHA-256 fingerprint from X509 certificate
      const fingerprint = certObj.fingerprint256;

      // 3. Cryptographically check public/private key matching
      const publicKeyObj = certObj.publicKey;
      const data = Buffer.from('qz-tray-cryptographic-validation-challenge');
      const signature = crypto.sign('sha512', data, privateKeyObj);
      const isMatch = crypto.verify('sha512', data, publicKeyObj, signature);

      if (!isMatch) {
        return NextResponse.json({
          valid: false,
          reason: 'Keypair mismatch: The private key does not match this public certificate.',
        });
      }

      return NextResponse.json({
        valid: true,
        fingerprint,
        expiry,
        subject,
        issuer,
      });
    } catch (err: any) {
      return NextResponse.json({
        valid: false,
        reason: `Cryptographic validation failed: ${err.message}`,
      });
    }
  } catch (error) {
    console.error('[API] POST /api/staff/qz-certs/verify error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
