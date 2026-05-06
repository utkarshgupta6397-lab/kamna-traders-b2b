import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { validateOrigin } from '@/lib/csrf';

export async function POST(request: Request) {
  try {
    // Basic CSRF/Origin protection
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
    }
    const { mobile } = await request.json();

    if (!mobile) {
      return NextResponse.json({ error: 'Mobile required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { mobile } });

    if (!user) {
      return NextResponse.json({ error: 'No account found for this number.' }, { status: 404 });
    }

    if (!user.active) {
      return NextResponse.json({ error: 'Account is deactivated. Contact admin.' }, { status: 403 });
    }

    const aisensyApiKey = process.env.WHATSAPP_API_KEY || process.env.AISENSY_API_KEY;
    const aisensyApiUrl = process.env.WHATSAPP_API_URL || 'https://backend.aisensy.com/campaign/t1/api/v2';

    // Generate a new 6-digit PIN
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();

    // 1. Update the PIN in the database FIRST
    // This ensures the reset works even if the messaging flow is broken.
    await prisma.user.update({
      where: { id: user.id },
      data: { pin: newPin }
    });

    // 2. Attempt Messaging Flow
    if (!aisensyApiKey) {
      console.warn(`[Messaging] Skipping WhatsApp for ${mobile}: WHATSAPP_API_KEY not configured.`);
      return NextResponse.json({ 
        success: true, 
        message: 'PIN updated successfully. (WhatsApp messaging not configured)',
        pin: process.env.NODE_ENV !== 'production' ? newPin : undefined 
      });
    }

    // Aisensy WhatsApp Integration
    const destination = mobile.startsWith('91') ? mobile : `91${mobile}`;

    try {
      const payload = {
        apiKey: aisensyApiKey,
        campaignName: "kamna_b2b_pin",
        destination: destination,
        userName: "Anmak Solar",
        templateParams: [newPin],
        source: "kamna-staff-portal",
        media: {},
        buttons: [
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [{ type: "text", text: newPin }]
          }
        ],
        carouselCards: [],
        location: {},
        attributes: {},
        paramsFallbackValue: {
          FirstName: user.name.split(' ')[0]
        }
      };

      console.log(`[Messaging] Sending WhatsApp PIN reset to ${destination} via ${aisensyApiUrl}`);
      
      const response = await fetch(aisensyApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Aisensy API Error Status:', response.status);
        console.error('Aisensy API Error Body:', errorText);
        return NextResponse.json({ 
          success: true, 
          message: 'PIN updated, but WhatsApp message failed to send. Please contact Admin.' 
        });
      }

      console.log(`[Messaging] WhatsApp PIN reset sent successfully to ${destination}`);
      return NextResponse.json({ success: true, message: 'PIN reset and sent to WhatsApp' });
    } catch (msgError) {
      console.error('Messaging delivery error:', msgError);
      return NextResponse.json({ 
        success: true, 
        message: 'PIN updated, but encountered a network error while sending WhatsApp.' 
      });
    }

  } catch (error) {
    console.error('Reset PIN fatal error:', error);
    return NextResponse.json({ error: 'Internal server error during PIN reset' }, { status: 500 });
  }
}
