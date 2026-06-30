import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const files = await prisma.solarOrderFile.findMany({
      where: { solarOrderId: id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: { name: true } }
      }
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Failed to fetch files:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await request.json();
    const { 
      documentType, 
      fileUrl, 
      metadata, 
      fileCategory,
      fileName,
      fileType,
      fileSizeBytes
    } = body;

    if (!fileUrl || !fileCategory || !fileName || !fileType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upsert logic based on documentType per order
    // If it's a DOCUMENTATION category, we might want to replace existing of the same documentType
    if (documentType) {
      const existing = await prisma.solarOrderFile.findFirst({
        where: { solarOrderId: id, documentType, isDeleted: false }
      });

      if (existing) {
        const updated = await prisma.solarOrderFile.update({
          where: { id: existing.id },
          data: {
            fileUrl,
            fileName,
            fileType,
            fileSizeBytes,
            metadata: metadata || existing.metadata,
          }
        });
        return NextResponse.json({ file: updated });
      }
    }

    const created = await prisma.solarOrderFile.create({
      data: {
        solarOrderId: id,
        documentType,
        fileCategory,
        fileName,
        fileUrl,
        fileType,
        fileSizeBytes,
        metadata,
        uploadedById: session.userId,
      }
    });
    
    return NextResponse.json({ file: created });

  } catch (error) {
    console.error('Failed to create/update file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
       return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
    }

    const existing = await prisma.solarOrderFile.findUnique({
      where: { id: fileId }
    });

    if (!existing || existing.solarOrderId !== id) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    await prisma.solarOrderFile.update({
      where: { id: fileId },
      data: {
        isDeleted: true,
        deletedById: session.userId,
        deletedAt: new Date()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
