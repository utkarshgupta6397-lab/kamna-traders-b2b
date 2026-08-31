import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

const ALLOWED_KEYS = ['INCOMING_SO_PUBLIC_BASE_URL', 'INCOMING_SO_API_KEY'];

function isValidPublicUrl(urlStr: string) {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();
    
    // Require HTTPS (unless it's a very specific bypass, but requirements say HTTPS is generally required for public)
    // Actually, local tunnels like ngrok/cloudflare provide HTTPS. 
    // The requirement says: "Require HTTPS except optionally allow HTTP only for explicit localhost development if the existing project requires it. Reject localhost URLs... Reject private LAN IP..."
    
    if (host === 'localhost' || host === '127.0.0.1') return false;
    
    // Check private LAN IPs: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
    const parts = host.split('.');
    if (parts.length === 4) {
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      
      if (p1 === 10) return false;
      if (p1 === 192 && p2 === 168) return false;
      if (p1 === 172 && p2 >= 16 && p2 <= 31) return false;
    }

    if (url.protocol !== 'https:') {
      // Just strict HTTPS for public internet tunneling
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const configs = await prisma.integrationConfig.findMany({
      where: { key: { in: ALLOWED_KEYS } }
    });

    const configMap = configs.reduce((acc: Record<string, string>, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    return NextResponse.json({
      INCOMING_SO_PUBLIC_BASE_URL: configMap['INCOMING_SO_PUBLIC_BASE_URL'] || null,
      INCOMING_SO_API_KEY: configMap['INCOMING_SO_API_KEY'] || null,
      isProduction: process.env.NODE_ENV === 'production',
      envFallback: {
        INCOMING_SO_PUBLIC_BASE_URL: process.env.INCOMING_SO_PUBLIC_BASE_URL || null,
        INCOMING_SO_API_KEY: process.env.INCOMING_SO_API_KEY || null
      }
    });
  } catch (error: any) {
    console.error('[Config GET Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Configuration editing is disabled in production' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { key, value } = body;

    if (!ALLOWED_KEYS.includes(key)) {
      return NextResponse.json({ error: 'Invalid configuration key' }, { status: 400 });
    }

    let finalValue = typeof value === 'string' ? value.trim() : '';

    if (key === 'INCOMING_SO_PUBLIC_BASE_URL') {
      if (!finalValue.startsWith('http://') && !finalValue.startsWith('https://')) {
        finalValue = 'https://' + finalValue;
      }
      
      if (!isValidPublicUrl(finalValue)) {
        return NextResponse.json({ error: 'Invalid Public Base URL. Must be a valid public HTTPS URL, not localhost or a private LAN IP.' }, { status: 400 });
      }
      finalValue = finalValue.replace(/\/+$/, '');
    }

    if (key === 'INCOMING_SO_API_KEY') {
      if (!finalValue) {
        return NextResponse.json({ error: 'API Key cannot be empty' }, { status: 400 });
      }
    }

    await prisma.integrationConfig.upsert({
      where: { key },
      update: { value: finalValue },
      create: { key, value: finalValue }
    });

    return NextResponse.json({ success: true, key, value: finalValue });
  } catch (error: any) {
    console.error('[Config POST Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
