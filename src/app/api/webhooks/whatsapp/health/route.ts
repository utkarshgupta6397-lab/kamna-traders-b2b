import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const config = await prisma.whatsAppConfiguration.findUnique({
      where: { id: 'singleton' }
    });

    const env = process.env.NODE_ENV || 'development';
    const publicUrl = process.env.CLOUDFLARE_PUBLIC_URL || null;
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL || null;

    return NextResponse.json({
      status: "ok",
      environment: env,
      webhookUrl: webhookUrl,
      verifyToken: config?.webhookVerifyToken || null,
      publicUrl: publicUrl,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Webhook Health Error]', error);
    return NextResponse.json({ status: "error", message: "Failed to fetch health info" }, { status: 500 });
  }
}
