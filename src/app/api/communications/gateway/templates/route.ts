import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { GatewayClient } from '@/lib/services/GatewayClient';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    // Assuming ADMIN or specific permissions required, checking session is enough for dev-tools
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await GatewayClient.listTemplates();

    if (!response.success) {
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    return NextResponse.json({ templates: response.templates });
  } catch (error: any) {
    console.error('[Gateway Templates Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
