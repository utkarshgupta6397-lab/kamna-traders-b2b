import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable for initial generation
    }

    const { regenerate = false } = body;

    // Check if a key currently exists
    const existingConfig = await prisma.integrationConfig.findUnique({
      where: { key: 'INCOMING_SO_API_KEY' }
    });

    const hasExistingKey = Boolean(existingConfig?.value && existingConfig.value.trim() !== '');

    if (hasExistingKey && !regenerate) {
      return NextResponse.json(
        { error: 'An API key already exists. Explicit confirmation is required to regenerate.' },
        { status: 409 }
      );
    }

    // Generate 256 bits (32 bytes) of cryptographic entropy
    const generatedKey = crypto.randomBytes(32).toString('hex');

    // Store in IntegrationConfig
    await prisma.integrationConfig.upsert({
      where: { key: 'INCOMING_SO_API_KEY' },
      update: { value: generatedKey },
      create: { key: 'INCOMING_SO_API_KEY', value: generatedKey }
    });

    // Record in AuditLog without exposing the secret
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.id,
          action: hasExistingKey ? 'INCOMING_SO_API_KEY_REGENERATED' : 'INCOMING_SO_API_KEY_GENERATED',
          details: JSON.stringify({
            keyLength: generatedKey.length,
            targetKey: 'INCOMING_SO_API_KEY',
            performedAt: new Date().toISOString()
          })
        }
      });
    } catch (auditErr) {
      console.error('[Incoming SO Audit Log Failed]', auditErr);
      // Non-fatal for credential generation, but logged server-side
    }

    return NextResponse.json({
      success: true,
      key: generatedKey,
      message: hasExistingKey
        ? 'Incoming SO API key regenerated successfully'
        : 'Incoming SO API key generated successfully'
    });
  } catch (error: any) {
    console.error('[Incoming SO Generate Key Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
