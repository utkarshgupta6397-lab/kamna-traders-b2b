import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasPostDispatchAccess } from '@/lib/post-dispatch-auth';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Verification of access: Admin or staff with post-dispatch permission
  if (!hasPostDispatchAccess(session) && session.role !== 'ADMIN' && !session.dispatch_view) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { fileId } = await params;
  if (!fileId) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  try {
    const fileRecord = await prisma.postDispatchFile.findUnique({
      where: { id: fileId },
      select: {
        filePath: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
      },
    });

    if (!fileRecord) {
      return new NextResponse('File record not found', { status: 404 });
    }

    const storageBase = path.join(process.cwd(), 'storage', 'post-dispatch');
    const resolvedPath = path.resolve(fileRecord.filePath);

    // Path traversal safety check: must reside inside storage/post-dispatch
    if (!resolvedPath.startsWith(storageBase) || !existsSync(resolvedPath)) {
      return new NextResponse('File missing on server', { status: 404 });
    }

    const fileBuffer = await readFile(resolvedPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': fileRecord.mimeType || 'image/jpeg',
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, max-age=86400, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('[Post Dispatch File Serve Error]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
