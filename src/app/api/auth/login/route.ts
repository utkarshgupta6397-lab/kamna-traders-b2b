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

    const user = await prisma.user.findUnique({ where: { mobile } });

    if (!user || !user.active) {
      return NextResponse.json({ error: 'Account not found or inactive.' }, { status: 404 });
    }

    if (user.pin !== pin) {
      return NextResponse.json({ error: 'Incorrect PIN. Try again or reset via WhatsApp.' }, { status: 401 });
    }

    const userAgent = request.headers.get('user-agent');
    const { detectDeviceType } = await import('@/lib/session');
    const deviceType = detectDeviceType(userAgent);

    console.log(`[LOGIN_SUCCESS] User: ${user.mobile}, Role: ${user.role}, Device: ${deviceType}`);

    await createSession({
      userId: user.id,
      role: user.role,
      deviceType,
      userAgent,
      ipAddress: ip
    });

    try {
      await prisma.auditLog.create({
        data: { userId: user.id, action: 'LOGIN', details: `PIN login via ${deviceType}` },
      });
    } catch (err) {
      console.error('[LOGIN] Audit log failed:', err);
    }

    // Return explicit redirect target based on role
    const redirectUrl = user.role === 'ADMIN' ? '/admin' : '/staff/dashboard';
    return NextResponse.json({ success: true, role: user.role, redirectTo: redirectUrl });
  } catch (error) {
    console.error('[LOGIN_FATAL]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
