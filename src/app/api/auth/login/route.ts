import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateOrigin } from '@/lib/csrf';

export async function POST(request: Request) {
  try {
    // Basic CSRF/Origin protection
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
    }

    // Basic rate limit: 5 requests per minute per IP
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    if (!checkRateLimit(`login_${ip}`, 5, 60 * 1000)) {
      return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 });
    }

    const { mobile, pin } = await request.json();

    if (!mobile || !pin) {
      return NextResponse.json({ error: 'Mobile and PIN required' }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { mobile } });

    // Auto-create Master Admin
    if (!user && mobile === '8744832318') {
      user = await prisma.user.create({
        data: { name: 'Master Admin', mobile: '8744832318', role: 'ADMIN', active: true }
      });
    }

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
