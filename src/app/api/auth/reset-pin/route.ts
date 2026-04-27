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

    const aisensyApiKey = process.env.AISENSY_API_KEY;
    if (!aisensyApiKey) {
      return NextResponse.json({ error: 'PIN reset messaging is not configured.' }, { status: 500 });
    }

    // Generate a new 6-digit PIN
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();

    // Update the PIN in the database
    await prisma.user.update({
      where: { id: user.id },
      data: { pin: newPin }
    });

    // Aisensy WhatsApp Integration
    // Aisensy expects destination with country code (91)
    const destination = mobile.startsWith('91') ? mobile : `91${mobile}`;

    const payload = {
      apiKey: aisensyApiKey,
      campaignName: "kamna_b2b_pin",
      destination: destination,
      userName: "Anmak Solar", // Note: Ensure this matches the approved business name in Aisensy
      templateParams: [
        newPin
      ],
      source: "kamna-staff-portal",
      media: {},
      buttons: [
        {
          type: "button",
          sub_type: "url",
          index: 0,
          parameters: [
            {
              type: "text",
              text: newPin
            }
          ]
        }
      ],
      carouselCards: [],
      location: {},
      attributes: {},
      paramsFallbackValue: {
        FirstName: user.name.split(' ')[0]
      }
    };

    // Make the API call to Aisensy
    const response = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Aisensy API Error:', errorText);
      // We still updated the DB, but the WhatsApp message failed.
      return NextResponse.json({ error: 'PIN generated but failed to send WhatsApp message. Contact Admin.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'PIN reset sent to WhatsApp' });

  } catch (error) {
    console.error('Reset PIN error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
