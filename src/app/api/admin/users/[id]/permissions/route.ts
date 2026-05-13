import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { ALL_PERMISSION_KEYS } from '@/lib/permissions';

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
      return NextResponse.json({ error: 'Invalid permission key' }, { status: 400 });
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { [key]: value },
    });

    return NextResponse.json({ success: true, userId: id, key, value });
  } catch (error) {
    console.error('[API] PATCH /api/admin/users/[id]/permissions error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
