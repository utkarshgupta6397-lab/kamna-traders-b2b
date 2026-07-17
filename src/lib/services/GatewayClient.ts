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

  private static buildUrl(baseUrl: string, endpoint: string): string {
    // Ensure baseUrl doesn't have trailing slash
    const sanitizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    // Ensure endpoint starts with slash
    const sanitizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    // Prevent duplicate /api/v1 if the user managed to bypass validation
    if (sanitizedBase.endsWith('/api/v1') && sanitizedEndpoint.startsWith('/api/v1')) {
      return `${sanitizedBase.slice(0, -7)}${sanitizedEndpoint}`;
    }
    
    return `${sanitizedBase}${sanitizedEndpoint}`;
  }

  static async health() {
    let finalUrl = '';
    try {
      const config = await this.getConfig();
      finalUrl = this.buildUrl(config.url, '/health');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const startTime = Date.now();
      
      console.log('[Gateway Diagnostics] Request:', { method: 'GET', url: finalUrl, headers: { 'Authorization': `Bearer ***` } });
      
      const response = await fetch(finalUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.token}`,
        },
        signal: controller.signal,
      });
      const latency = Date.now() - startTime;
      clearTimeout(timeoutId);
      
      const responseText = await response.text();
      console.log('[Gateway Diagnostics] Response:', { status: response.status, body: responseText });

      if (!response.ok) {
        if (response.status === 401) return { success: false, error: 'Invalid API Key' };
        if (response.status === 403) return { success: false, error: 'API Key Disabled' };
        if (response.status === 404) return { success: false, error: `Endpoint Not Found at ${finalUrl}. Response: ${responseText}` };
        return { success: false, error: `Gateway returned HTTP ${response.status} at ${finalUrl}` };
      }

      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch (e) {}
      
      return { 
        success: true, 
        latency, 
        version: data.version || 'Unknown', 
        environment: data.environment || 'Unknown' 
      };
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message.includes('fetch')) {
        return { success: false, error: `Gateway Unreachable at ${finalUrl}` };
      }
      return { success: false, error: error.message };
    }
  }

  static async listTemplates() {
    let finalUrl = '';
    try {
      const config = await this.getConfig();
      finalUrl = this.buildUrl(config.url, '/api/v1/providers/whatsapp/templates');
      
      console.log('[Gateway Diagnostics] Request:', { method: 'GET', url: finalUrl, headers: { 'Authorization': `Bearer ***` } });
      
      const response = await fetch(finalUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.token}`,
        },
      });

      const responseText = await response.text();
      console.log('[Gateway Diagnostics] Response:', { status: response.status, body: responseText });

      if (!response.ok) {
        if (response.status === 401) throw new Error('Invalid API Key');
        if (response.status === 403) throw new Error('API Key Disabled');
        throw new Error(`Gateway returned HTTP ${response.status} at ${finalUrl}`);
      }

      const data = JSON.parse(responseText);
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

    const finalUrl = this.buildUrl(config.url, '/api/v1/messages/send');
    
    let attempt = 0;
    while (attempt <= retries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        console.log(`[Gateway Diagnostics] Request (Attempt ${attempt+1}):`, { method: 'POST', url: finalUrl, headers: { 'Authorization': `Bearer ***` }, body: payload });
        
        const response = await fetch(finalUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.token}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        
        const responseText = await response.text();
        console.log(`[Gateway Diagnostics] Response (Attempt ${attempt+1}):`, { status: response.status, body: responseText });

        if (!response.ok) {
          // Handle specific HTTP errors
          if (response.status === 401) {
            throw new Error('Invalid API Key');
          }
          if (response.status === 403) {
            throw new Error('API Key Disabled');
          }
          if (response.status === 400) {
            let data: any = {};
            try { data = JSON.parse(responseText); } catch (e) {}
            throw new Error(`Validation error: ${data.error || 'Invalid payload'}`);
          }
          
          throw new Error(`Gateway returned HTTP ${response.status} at ${finalUrl}`);
        }

        const data = JSON.parse(responseText);
        return {
          success: true,
          eventId: data.eventId || data.id,
          messageId: data.messageId || data.providerMessageId,
        };
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        const isTimeout = error.name === 'AbortError' || (error.message && error.message.includes('fetch'));
        const errorMessage = isTimeout ? `Gateway Unreachable at ${finalUrl}` : error.message;

        // If it's the last attempt or it's a fatal error (401/403/400), don't retry
        if (attempt === retries || errorMessage === 'Invalid API Key' || errorMessage === 'API Key Disabled' || errorMessage.includes('Validation error')) {
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
    let finalUrl = '';
    try {
      const config = await this.getConfig();
      finalUrl = this.buildUrl(config.url, '/api/v1/messages');
      
      console.log('[Gateway Diagnostics] Request:', { method: 'GET', url: finalUrl, headers: { 'Authorization': `Bearer ***` } });
      
      const response = await fetch(finalUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.token}`,
        },
        cache: 'no-store'
      });

      const responseText = await response.text();
      console.log('[Gateway Diagnostics] Response:', { status: response.status, body: responseText });

      if (!response.ok) {
        throw new Error(`Gateway returned HTTP ${response.status} at ${finalUrl}`);
      }

      const data = JSON.parse(responseText);
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
    let finalUrl = '';
    try {
      const config = await this.getConfig();
      finalUrl = this.buildUrl(config.url, `/api/v1/messages/${messageId}`);
      
      console.log('[Gateway Diagnostics] Request:', { method: 'GET', url: finalUrl, headers: { 'Authorization': `Bearer ***` } });
      
      const response = await fetch(finalUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.token}`,
        },
        cache: 'no-store'
      });

      const responseText = await response.text();
      console.log('[Gateway Diagnostics] Response:', { status: response.status, body: responseText });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Gateway returned HTTP ${response.status} at ${finalUrl}`);
      }

      const data = JSON.parse(responseText);
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
