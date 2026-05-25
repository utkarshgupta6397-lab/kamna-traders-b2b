import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const qzRequest = body.request;
    if (typeof qzRequest !== 'string') {
      return new Response('request must be a string', { status: 400 });
    }

    const cert = await prisma.qzCertificate.findUnique({
      where: { userId: session.userId },
      select: { privateKey: true },
    });

    if (!cert?.privateKey) {
      console.warn(`[QZ SIGN API] No private key configured for user ${session.userId}`);
      return new Response('QZ private key not configured for your account', { status: 404 });
    }

    const payloadHash = crypto.createHash('sha256').update(qzRequest).digest('hex');

    console.log(`[QZ SIGN API] --- START SIGNING ---`);
    console.log(`[QZ SIGN API] request SHA256: ${payloadHash}`);
    console.log(`[QZ SIGN API] request Length: ${qzRequest.length}`);
    console.log(`[QZ SIGN API] request Preview: ${qzRequest.substring(0, 100)}`);

    const sign = crypto.createSign('RSA-SHA512');
    sign.update(qzRequest, 'utf8');
    const signature = sign.sign(cert.privateKey, 'base64');

    console.log(`[QZ SIGN API] Generated Signature Length: ${signature.length}`);
    console.log(`[QZ SIGN API] --- END SIGNING ---`);

    return new Response(signature, { 
      status: 200, 
      headers: { 'Content-Type': 'text/plain' } 
    });
  } catch (error) {
    console.error('[API] POST /api/qz/sign error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
