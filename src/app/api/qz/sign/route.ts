import { NextRequest, NextResponse } from 'next/server';
import { signMessage } from '@/lib/printing/security/signing/sign-message';

export async function POST(req: NextRequest) {
  try {
    const { payload } = await req.json();

    if (!payload) {
      return NextResponse.json({ error: 'Missing payload' }, { status: 400 });
    }

    const signature = signMessage(payload);
    
    return NextResponse.json({ signature });
  } catch (err: any) {
    console.error('[QZ_API_SIGN_ERROR]', err.message);
    return NextResponse.json({ error: 'Internal server error during signing' }, { status: 500 });
  }
}
