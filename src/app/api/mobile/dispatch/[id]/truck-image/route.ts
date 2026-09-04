import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { dispatchEventEmitter, DISPATCH_EVENTS } from '@/lib/dispatch-events';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const maxDuration = 60;

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 600 * 1024; // 600 KB server hard ceiling

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: 'Sales Order ID is required' }, { status: 400 });
  }

  try {
    // 1. Authoritative verification of Sales Order existence and eligibility
    let order = await prisma.dispatchIncomingOrder.findUnique({
      where: { id: orderId },
      include: {
        truckUpload: true,
        preDispatchWorkflow: true,
      },
    });

    if (!order) {
      order = await prisma.dispatchIncomingOrder.findUnique({
        where: { zohoSalesorderId: orderId },
        include: {
          truckUpload: true,
          preDispatchWorkflow: true,
        },
      });
    }

    if (!order) {
      return NextResponse.json({ error: 'Sales Order not found' }, { status: 404 });
    }

    if (order.status !== 'NEW') {
      return NextResponse.json(
        { error: `Sales Order is not active in Dispatch (current status: ${order.status})` },
        { status: 400 }
      );
    }

    if (order.total === null || order.total <= 50000) {
      return NextResponse.json(
        { error: 'Sales Order invoice value must be strictly greater than ₹50,000' },
        { status: 400 }
      );
    }

    // 2. Check duplicate upload
    if (order.truckUpload || order.preDispatchWorkflow?.truckPhotoUrl) {
      return NextResponse.json(
        { error: 'Truck image has already been uploaded for this Sales Order.' },
        { status: 409 }
      );
    }

    // 3. Extract and validate file
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No truck image file provided' }, { status: 400 });
    }

    const mimeType = file.type?.toLowerCase() || 'image/jpeg';
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: 'Invalid image format. Allowed formats: JPEG, PNG, WebP.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Image size (${Math.round(buffer.length / 1024)} KB) exceeds maximum limit of 600 KB. Please retake photo.` },
        { status: 400 }
      );
    }

    // 4. Save to private server storage outside Next.js public/
    const storageDir = path.join(process.cwd(), 'storage', 'dispatch-trucks');
    await mkdir(storageDir, { recursive: true });

    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const filename = `truck_${order.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(storageDir, filename);

    await writeFile(filePath, buffer);

    // Relative storage reference
    const relativeImagePath = path.join('storage', 'dispatch-trucks', filename);

    const userName = session.name || (session.role === 'ADMIN' ? 'Admin' : 'Staff');

    // 5. Transactional persistence: DispatchTruckUpload + PreDispatchWorkflow synchronization
    const result = await prisma.$transaction(async (tx) => {
      // Re-verify inside transaction to guarantee race protection
      const existing = await tx.dispatchTruckUpload.findUnique({
        where: { salesOrderId: order.id },
      });

      if (existing) {
        throw new Error('DUPLICATE_UPLOAD');
      }

      const upload = await tx.dispatchTruckUpload.create({
        data: {
          salesOrderId: order.id,
          salesOrderNumber: order.salesorderNumber || order.zohoSalesorderId,
          imagePath: relativeImagePath,
          imageFilename: filename,
          imageMimeType: mimeType,
          imageSizeBytes: buffer.length,
          uploadedByUserId: session.userId,
          uploadedByUserName: userName,
          uploadedAt: new Date(),
        },
      });

      // Update or create PreDispatchWorkflow for workflow compatibility
      let wf;
      if (order.preDispatchWorkflow) {
        wf = await tx.preDispatchWorkflow.update({
          where: { id: order.preDispatchWorkflow.id },
          data: {
            truckDetailsStatus: 'COMPLETED',
            truckPhotoUrl: `/api/dispatch/truck-image/${upload.id}`,
            truckUploadedBy: session.userId,
            truckUploadedAt: new Date(),
            overallStatus: 'IN_PROGRESS',
          },
        });
      } else {
        wf = await tx.preDispatchWorkflow.create({
          data: {
            dispatchOrderId: order.id,
            salesorderId: order.zohoSalesorderId,
            truckDetailsStatus: 'COMPLETED',
            truckPhotoUrl: `/api/dispatch/truck-image/${upload.id}`,
            truckUploadedBy: session.userId,
            truckUploadedAt: new Date(),
            overallStatus: 'IN_PROGRESS',
          },
        });
      }

      const freshOrder = await tx.dispatchIncomingOrder.update({
        where: { id: order.id },
        data: { updatedAt: new Date() },
      });

      return { upload, wf, freshOrder };
    });

    // 6. Broadcast Realtime Event to Desktop Clients
    const eventPayload = {
      uploadId: result.upload.id,
      salesOrderId: order.id,
      salesOrderNumber: order.salesorderNumber || order.zohoSalesorderId,
      customerName: order.customerName || 'Customer',
      total: order.total,
      imageUrl: `/api/dispatch/truck-image/${result.upload.id}`,
      uploadedAt: result.upload.uploadedAt,
      uploadedByUserName: userName,
    };

    dispatchEventEmitter.emit(DISPATCH_EVENTS.TRUCK_IMAGE_UPLOADED, eventPayload);
    dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, {
      ...result.freshOrder,
      preDispatchWorkflow: result.wf,
      truckUpload: result.upload,
    });

    return NextResponse.json({
      success: true,
      message: 'Truck image uploaded successfully.',
      data: {
        id: result.upload.id,
        salesOrderId: result.upload.salesOrderId,
        salesOrderNumber: result.upload.salesOrderNumber,
        imageUrl: `/api/dispatch/truck-image/${result.upload.id}`,
        uploadedAt: result.upload.uploadedAt,
      },
    });
  } catch (error: any) {
    if (error.message === 'DUPLICATE_UPLOAD' || error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Truck image has already been uploaded for this Sales Order.' },
        { status: 409 }
      );
    }
    console.error('[Truck Image Upload Error]', error);
    return NextResponse.json({ error: error.message || 'Server error uploading truck image' }, { status: 500 });
  }
}
