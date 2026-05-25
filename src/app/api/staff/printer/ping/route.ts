import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import net from 'net';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { printerIp, printerPort } = await request.json();

    if (!printerIp || typeof printerIp !== 'string') {
      return NextResponse.json({ error: 'Printer IP is required' }, { status: 400 });
    }

    const port = Number(printerPort) || 9100;

    const reachable = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(3000); // 3 seconds timeout

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      const handleError = () => {
        socket.destroy();
        resolve(false);
      };

      socket.on('timeout', handleError);
      socket.on('error', handleError);

      socket.connect(port, printerIp);
    });

    return NextResponse.json({ success: true, reachable });
  } catch (error) {
    console.error('[API] POST /api/staff/printer/ping error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
