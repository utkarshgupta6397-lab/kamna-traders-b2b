import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GatewayClient } from '@/lib/services/GatewayClient';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: templateId } = await context.params;
    const existingTemplate = await prisma.whatsAppTemplate.findUnique({
      where: { id: templateId }
    });

    if (!existingTemplate) {
      return NextResponse.json({ success: false, error: 'Template not found locally' }, { status: 404 });
    }

    const response = await GatewayClient.listTemplates();

    if (!response.success || !response.templates) {
      return NextResponse.json({ success: false, error: response.error || 'Failed to fetch templates from Gateway' }, { status: 500 });
    }

    const metaTemplate = response.templates.find((t: any) => t.name === existingTemplate.name && t.language === existingTemplate.language);

    if (!metaTemplate) {
      // If it's not returned by gateway anymore, mark as disabled/deleted
      await prisma.whatsAppTemplate.update({
        where: { id: templateId },
        data: { status: 'DISABLED', lastSyncedAt: new Date() }
      });
      return NextResponse.json({ success: true, status: 'DISABLED' });
    }

    const headerComponent = metaTemplate.components?.find((c: any) => c.type === 'HEADER');
    const bodyComponent = metaTemplate.components?.find((c: any) => c.type === 'BODY');
    const footerComponent = metaTemplate.components?.find((c: any) => c.type === 'FOOTER');
    const buttonsComponent = metaTemplate.components?.find((c: any) => c.type === 'BUTTONS');

    await prisma.whatsAppTemplate.update({
      where: { id: templateId },
      data: {
        metaTemplateId: metaTemplate.id || metaTemplate.metaTemplateId || existingTemplate.metaTemplateId,
        category: metaTemplate.category || 'MARKETING',
        status: metaTemplate.status || 'APPROVED',
        headerType: headerComponent?.format || null,
        header: headerComponent?.text || null,
        body: bodyComponent?.text || '',
        footer: footerComponent?.text || null,
        buttons: buttonsComponent ? buttonsComponent.buttons : null,
        qualityRating: metaTemplate.quality_score?.score || null,
        lastSyncedAt: new Date(),
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Single Template Sync Error]', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
