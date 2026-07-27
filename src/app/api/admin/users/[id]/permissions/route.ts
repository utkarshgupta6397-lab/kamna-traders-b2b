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

    // Update user permission in DB (with raw SQL fallback for dev server cached Prisma Client instances)
    let updatedUser: any = null;
    try {
      updatedUser = await prisma.user.update({
        where: { id },
        data: { [key]: value },
      });
    } catch (dbErr: any) {
      console.warn(`[API] PATCH /api/admin/users/${id}/permissions update fallback (dev server DMMF):`, dbErr?.message || dbErr);
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET "${key}" = $1 WHERE "id" = $2`,
        Boolean(value),
        id
      );
      updatedUser = await prisma.user.findUnique({ where: { id } });
    }

    // Invalidate user session cache so new permission applies immediately without re-login
    clearUserSessionCache(id);

    return NextResponse.json({ success: true, userId: id, key, value, updatedUser });
  } catch (error: any) {
    console.error('[API] PATCH /api/admin/users/[id]/permissions error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
