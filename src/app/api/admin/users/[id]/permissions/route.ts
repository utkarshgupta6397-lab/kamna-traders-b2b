import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { ALL_PERMISSION_KEYS } from '@/lib/permissions';
import { clearUserSessionCache } from '@/lib/session';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { key, value } = body;

    // Validate permission key
    if (!ALL_PERMISSION_KEYS.includes(key)) {
      console.error('[API] Invalid permission key:', key);
      return NextResponse.json({ error: 'Invalid permission key' }, { status: 400 });
    }

    // Build update payload with parent/child hierarchy support
    const updateData: Record<string, boolean> = { [key]: Boolean(value) };
    const postDispatchChildren = [
      'mobile_dispatch_post_dispatch_receiving_upload',
      'mobile_dispatch_post_dispatch_checked_upload',
    ];

    if (Boolean(value)) {
      if (postDispatchChildren.includes(key)) {
        updateData.mobile_dispatch = true;
        updateData.mobile_dispatch_post_dispatch = true;
      } else if (key === 'mobile_dispatch_post_dispatch') {
        updateData.mobile_dispatch = true;
      } else if ([
        'dispatch_post_dispatch_receiving_verify',
        'dispatch_post_dispatch_checked_verify',
        'dispatch_force_archive'
      ].includes(key)) {
        updateData.dispatch_view = true;
        updateData.dispatch_post_dispatch = true;
      } else if ([
        'dispatch_post_dispatch',
        'dispatch_post_dispatch_review',
        'dispatch_receiving_upload',
        'dispatch_checked_by'
      ].includes(key)) {
        updateData.dispatch_view = true;
      }
    } else {
      if (key === 'mobile_dispatch') {
        updateData.mobile_dispatch_post_dispatch = false;
        postDispatchChildren.forEach((child) => {
          updateData[child] = false;
        });
      } else if (key === 'mobile_dispatch_post_dispatch') {
        postDispatchChildren.forEach((child) => {
          updateData[child] = false;
        });
      } else if (key === 'dispatch_view') {
        updateData.dispatch_post_dispatch = false;
        updateData.dispatch_post_dispatch_receiving_verify = false;
        updateData.dispatch_post_dispatch_checked_verify = false;
      } else if (key === 'dispatch_post_dispatch') {
        updateData.dispatch_post_dispatch_receiving_verify = false;
        updateData.dispatch_post_dispatch_checked_verify = false;
      }
    }

    // Update user permission in DB (with raw SQL fallback for dev server cached Prisma Client instances)
    let updatedUser: any = null;
    try {
      updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
      });
    } catch (dbErr: any) {
      console.warn(`[API] PATCH /api/admin/users/${id}/permissions update fallback (dev server DMMF):`, dbErr?.message || dbErr);
      for (const [col, val] of Object.entries(updateData)) {
        await prisma.$executeRawUnsafe(
          `UPDATE "User" SET "${col}" = $1 WHERE "id" = $2`,
          Boolean(val),
          id
        );
      }
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "User" WHERE "id" = $1`,
        id
      );
      updatedUser = rows[0] || null;
    }

    // Invalidate user session cache so new permission applies immediately without re-login
    clearUserSessionCache(id);

    return NextResponse.json({ success: true, userId: id, key, value, updatedUser });
  } catch (error: any) {
    console.error('[API] PATCH /api/admin/users/[id]/permissions error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
