import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { mobile, otp } = await request.json();

    // Bypass OTP for dev
    if (otp !== '123456') {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { mobile }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found. Please contact admin.' }, { status: 404 });
    }

    if (!user.active) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    // Create Session Cookie
    await createSession(user.id, user.role);

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
      }
    });

    return NextResponse.json({ success: true, role: user.role });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
