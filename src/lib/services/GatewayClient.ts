import { prisma } from '@/lib/db';

export interface GatewayCommunicationPayload {
  channel: 'whatsapp' | 'sms' | 'email';
  recipient: string;
  template: string;
  variables: Record<string, any>;
  metadata: Record<string, any>;
  requestedBy: string;
  source: string;
  language?: string;
}

export interface GatewayCommunicationResponse {
  success: boolean;
  eventId?: string;
  messageId?: string;
  error?: string;
  details?: any;
}

export class GatewayClient {
  private static configCache: { url: string; token: string; expiresAt: number } | null = null;

  private static async getConfig() {
    if (this.configCache && this.configCache.expiresAt > Date.now()) {
      return this.configCache;
    }

    const config = await prisma.gatewayConfiguration.findUnique({
      where: { id: 'singleton' }
    });

    if (!config || !config.gatewayUrl || !config.apiToken) {
      throw new Error('Gateway is not configured');
    }

    this.configCache = {
      url: config.gatewayUrl,
      token: config.apiToken,
      expiresAt: Date.now() + 60000, // cache for 1 minute
    };

    return this.configCache;
  }

  static async health() {
    try {
      const config = await this.getConfig();
      // Using generic health endpoint if it exists, otherwise list providers
      const url = `${config.url}/api/v1/health`; // Assuming gateway has this
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.token}`,
        },
      });
      return { success: response.ok, status: response.status };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async listTemplates() {
    try {
      const config = await this.getConfig();
      const url = `${config.url}/api/v1/providers/whatsapp/templates`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Gateway returned HTTP ${response.status}`);
      }

      const data = await response.json();
      return { success: true, templates: data.templates || data.data || [] };
    } catch (error: any) {
      console.error('[GatewayClient] Failed to list templates:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Centralized method to send communications via the Event Gateway.
   * Includes timeout and basic retry logic.
   */
  static async sendCommunication(payload: GatewayCommunicationPayload, retries = 2): Promise<GatewayCommunicationResponse> {
    let config;
    try {
      config = await this.getConfig();
    } catch (e: any) {
      return { success: false, error: e.message };
    }

    const url = `${config.url}/api/v1/messages/send`;
    
    let attempt = 0;
    while (attempt <= retries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.token}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Handle specific HTTP errors
          if (response.status === 401 || response.status === 403) {
            throw new Error('Unauthorized: Gateway token is invalid or expired.');
          }
          if (response.status === 400) {
            const data = await response.json().catch(() => ({}));
            throw new Error(`Validation error: ${data.error || 'Invalid payload'}`);
          }
          
          throw new Error(`Gateway returned HTTP ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          eventId: data.eventId || data.id,
          messageId: data.messageId || data.providerMessageId,
        };
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        const isTimeout = error.name === 'AbortError';
        const errorMessage = isTimeout ? 'Gateway request timed out' : error.message;

        // If it's the last attempt or it's a fatal error (401/400), don't retry
        if (attempt === retries || errorMessage.includes('Unauthorized') || errorMessage.includes('Validation error')) {
          console.error('[GatewayClient] Final attempt failed:', errorMessage);
          return {
            success: false,
            error: errorMessage,
            details: error
          };
        }

        console.warn(`[GatewayClient] Attempt ${attempt + 1} failed, retrying... (${errorMessage})`);
        attempt++;
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }

    return { success: false, error: 'Unexpected error in retry loop' };
  }

  /**
   * Fetches the latest communication events from the Gateway and filters them in-memory
   * to find the most recent event matching the provided metadata IDs.
   */
  static async getLatestCommunication(filters: { customerId?: string; orderId?: string; invoiceId?: string }) {
    try {
      const config = await this.getConfig();
      const url = `${config.url}/api/v1/messages`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.token}`,
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Gateway returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !Array.isArray(data.messages)) {
        return null;
      }

      // Filter in memory (MVP approach)
      for (const msg of data.messages) {
        const metadata = msg.metadata || {};
        
        let match = false;
        if (filters.invoiceId && metadata.invoiceId === filters.invoiceId) match = true;
        else if (filters.orderId && metadata.orderId === filters.orderId) match = true;
        else if (filters.customerId && metadata.customerId === filters.customerId) match = true;

        if (match) {
          return msg;
        }
      }

      return null;
    } catch (error) {
      console.error('[GatewayClient] Failed to fetch latest communication:', error);
      return null;
    }
  }

  /**
   * Fetches the specific status and timeline of a communication message.
   */
  static async getCommunicationStatus(messageId: string) {
    try {
      const config = await this.getConfig();
      const url = `${config.url}/api/v1/messages/${messageId}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.token}`,
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Gateway returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.message) {
        return null;
      }

      return data.message;
    } catch (error) {
      console.error(`[GatewayClient] Failed to fetch status for message ${messageId}:`, error);
      return null;
    }
  }
}
