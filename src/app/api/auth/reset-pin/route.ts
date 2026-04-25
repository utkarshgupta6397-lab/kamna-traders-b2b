import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { mobile } = await request.json();
    const user = await prisma.user.findUnique({ where: { mobile } });

    if (!user) {
      return NextResponse.json({ error: 'No account found' }, { status: 404 });
    }

    // Generate new 6-digit PIN
    const newPin = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.user.update({ where: { id: user.id }, data: { pin: newPin } });

    // TODO: Send via Aisensy WhatsApp API
    // For now, log to console in dev
    console.log(`[PIN RESET] ${user.name} (${mobile}) → New PIN: ${newPin}`);

    return NextResponse.json({ success: true, message: 'New PIN sent to WhatsApp' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
