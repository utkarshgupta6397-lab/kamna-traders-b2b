import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getSession();
  if (!session || !session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { printer: true },
    });
    return NextResponse.json(user?.printer || null);
  } catch (error) {
    console.error('[API] GET /api/staff/printer error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { printerId } = await request.json();

    if (printerId !== null && typeof printerId !== 'string') {
      return NextResponse.json({ error: 'printerId must be a string or null' }, { status: 400 });
    }

    // Verify printer exists and is active if mapping it
    if (printerId) {
      const printerExists = await prisma.printer.findFirst({
        where: { id: printerId, isActive: true },
      });
      if (!printerExists) {
        return NextResponse.json({ error: 'Selected printer does not exist or is inactive' }, { status: 400 });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: { printerId },
      include: { printer: true },
    });

    return NextResponse.json(updatedUser.printer || null);
  } catch (error) {
    console.error('[API] POST /api/staff/printer error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
