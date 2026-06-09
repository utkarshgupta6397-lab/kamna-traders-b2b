import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { serialNumbers, tag } = body;

    if (!Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      return NextResponse.json({ error: 'No serial numbers provided' }, { status: 400 });
    }

    if (tag && tag.length > 256) {
      return NextResponse.json({ error: 'Tag cannot exceed 256 characters' }, { status: 400 });
    }

    // Fetch serial IDs
    const serials = await prisma.dcrSerial.findMany({
      where: { serialNumber: { in: serialNumbers } },
      select: { id: true, serialNumber: true }
    });

    if (serials.length === 0) {
      return NextResponse.json({ error: 'No matching serials found' }, { status: 404 });
    }

    const serialIds = serials.map(s => s.id);
    const userId = session.userId || 'Unknown';
    const userName = session.name || session.userId || 'Unknown';

    await prisma.$transaction(async (tx) => {
      if (!tag || tag.trim() === '') {
        // Clear tags
        await tx.serialTag.deleteMany({
          where: { serialId: { in: serialIds } }
        });

        // Add history records
        await tx.dcrSerialHistory.createMany({
          data: serials.map(s => ({
            serialId: s.id,
            eventType: 'TAG_CLEARED',
            eventDescription: 'Serial tag was cleared',
            userId: userId
          }))
        });

      } else {
        // Upsert tags (since there's no upsertMany, we delete existing and createMany, or loop)
        await tx.serialTag.deleteMany({
          where: { serialId: { in: serialIds } }
        });

        await tx.serialTag.createMany({
          data: serialIds.map(id => ({
            serialId: id,
            tag: tag.trim(),
            createdBy: userName
          }))
        });

        // Add history records
        await tx.dcrSerialHistory.createMany({
          data: serials.map(s => ({
            serialId: s.id,
            eventType: 'TAG_ADDED',
            eventDescription: `Tag added: ${tag.trim()}`,
            userId: userId
          }))
        });
      }

      // Add audit log
      await tx.dcrAuditLog.create({
        data: {
          entityType: 'SERIAL_BATCH',
          entityId: 'BATCH',
          action: tag && tag.trim() !== '' ? 'TAG_ADDED' : 'TAG_CLEARED',
          userId: userId,
          metadata: {
            serialNumbers,
            tag: tag ? tag.trim() : null
          }
        }
      });
    });

    return NextResponse.json({ success: true, message: 'Tags updated successfully' });
  } catch (error: any) {
    console.error('[DCR Serial Tags POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update tags' }, { status: 500 });
  }
}
