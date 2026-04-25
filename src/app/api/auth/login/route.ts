import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { mobile, pin } = await request.json();

    if (!mobile || !pin) {
      return NextResponse.json({ error: 'Mobile and PIN required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { mobile } });

    if (!user) {
      return NextResponse.json({ error: 'No account found for this number. Contact admin.' }, { status: 404 });
    }
    if (!user.active) {
      return NextResponse.json({ error: 'Account is deactivated. Contact admin.' }, { status: 403 });
    }

    // First-time login: no PIN set yet — auto-assign the typed one
    if (!user.pin) {
      await prisma.user.update({ where: { id: user.id }, data: { pin } });
    } else if (user.pin !== pin) {
      return NextResponse.json({ error: 'Incorrect PIN. Try again or reset via WhatsApp.' }, { status: 401 });
    }

    await createSession(user.id, user.role);

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'LOGIN', details: 'PIN login' },
    });

    return NextResponse.json({ success: true, role: user.role });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
