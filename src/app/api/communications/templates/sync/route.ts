import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GatewayClient } from '@/lib/services/GatewayClient';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const response = await GatewayClient.listTemplates();

    if (!response.success || !response.templates) {
      return NextResponse.json({ success: false, error: response.error || 'Failed to fetch templates from Gateway' }, { status: 500 });
    }

    const templates = response.templates;

    let added = 0;
    let updated = 0;
    let disabled = 0;

    for (const t of templates) {
      // Find existing by name + language
      const existing = await prisma.whatsAppTemplate.findFirst({
        where: {
          name: t.name,
          language: t.language
        }
      });

      const headerComponent = t.components?.find((c: any) => c.type === 'HEADER');
      const bodyComponent = t.components?.find((c: any) => c.type === 'BODY');
      const footerComponent = t.components?.find((c: any) => c.type === 'FOOTER');
      const buttonsComponent = t.components?.find((c: any) => c.type === 'BUTTONS');

      const data = {
        metaTemplateId: t.id || t.metaTemplateId || `${t.name}_${t.language}`,
        name: t.name,
        category: t.category || 'MARKETING',
        status: t.status || 'APPROVED',
        language: t.language || 'en',
        headerType: headerComponent?.format || null,
        header: headerComponent?.text || null,
        body: bodyComponent?.text || '',
        footer: footerComponent?.text || null,
        buttons: buttonsComponent ? buttonsComponent.buttons : null,
        qualityRating: t.quality_score?.score || null,
        lastSyncedAt: new Date(),
      };

      if (existing) {
        await prisma.whatsAppTemplate.update({
          where: { id: existing.id },
          data
        });
        updated++;
      } else {
        await prisma.whatsAppTemplate.create({
          data
        });
        added++;
      }
    }

    return NextResponse.json({
      success: true,
      added,
      updated,
      disabled
    });
  } catch (error: any) {
    console.error('[Template Sync Error]', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
