import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { uploadId } = await params;
  if (!uploadId) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  try {
    const upload = await prisma.dispatchTruckUpload.findUnique({
      where: { id: uploadId },
      select: {
        imagePath: true,
        imageMimeType: true,
        imageSizeBytes: true,
      },
    });

    if (!upload) {
      return new NextResponse('Not Found', { status: 404 });
    }

    // Safety check: ensure file exists strictly within storage/dispatch-trucks
    const filename = path.basename(upload.imagePath);
    const fullPath = path.join(process.cwd(), 'storage', 'dispatch-trucks', filename);

    if (!existsSync(fullPath)) {
      return new NextResponse('Image file missing on server', { status: 404 });
    }

    const fileBuffer = await readFile(fullPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': upload.imageMimeType || 'image/jpeg',
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, max-age=86400, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('[Truck Image Serve Error]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
