import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const certPath = path.join(process.cwd(), 'src/lib/printing/security/certificates/qz-cert.pem');
    const cert = fs.readFileSync(certPath, 'utf8');
    
    return new NextResponse(cert, {
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (err: any) {
    console.error('[QZ_API_CERT_ERROR]', err.message);
    return NextResponse.json({ error: 'Failed to load certificate' }, { status: 500 });
  }
}
