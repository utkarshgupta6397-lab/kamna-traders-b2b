import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.communications_templates) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await prisma.whatsAppTemplate.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const total = templates.length;
    const approved = templates.filter(t => t.status === 'APPROVED').length;
    const pending = templates.filter(t => t.status === 'PENDING').length;
    const rejected = templates.filter(t => t.status === 'REJECTED').length;
    
    // Calculate unique languages
    const languages = new Set(templates.map(t => t.language)).size;

    const config = await prisma.whatsAppConfiguration.findUnique({
      where: { id: 'singleton' },
      select: { testPhoneNumber: true }
    });

    return NextResponse.json({
      templates,
      stats: {
        total,
        approved,
        pending,
        rejected,
        languages
      },
      testPhoneNumber: config?.testPhoneNumber || null
    });

  } catch (error: any) {
    console.error('[Templates API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
