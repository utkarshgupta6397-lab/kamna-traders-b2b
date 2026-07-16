'use server';

import { GatewayClient, GatewayCommunicationPayload } from '@/lib/services/GatewayClient';
import { getSession } from '@/lib/auth';

export async function sendTestCommunication(payload: GatewayCommunicationPayload) {
  const session = await getSession();
  
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'Unauthorized. Admin access required.' };
  }

  try {
    const response = await GatewayClient.sendCommunication(payload);
    return response;
  } catch (error: any) {
    console.error('[sendTestCommunication] Action error:', error);
    return { success: false, error: error.message || 'Internal server error' };
  }
}
