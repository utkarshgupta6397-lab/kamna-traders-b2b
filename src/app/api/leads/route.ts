import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items data' }, { status: 400 });
    }

    const lead = await prisma.customerLead.create({
      data: {
        items: JSON.stringify(items),
        sourceChannel: 'whatsapp',
      }
    });

    return NextResponse.json({ success: true, leadId: lead.id }, { status: 200 });
  } catch (error) {
    console.error('Error saving lead:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
