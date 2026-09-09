export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { prisma, initializeDatabase } = await import('@/lib/db');
      await initializeDatabase();
      const config = await prisma.whatsAppConfiguration.findUnique({
        where: { id: 'singleton' }
      });

      console.log('\n=====================================');
      console.log('WhatsApp Webhook Configuration');
      console.log('=====================================\n');
      console.log('Environment:\n');
      console.log(`${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}\n`);
      console.log('Webhook URL:\n');
      console.log(`${process.env.WHATSAPP_WEBHOOK_URL || 'NOT SET'}\n`);
      console.log('Tunnel URL:\n');
      console.log(`${process.env.CLOUDFLARE_PUBLIC_URL || 'NOT SET'}\n`);
      console.log('Verify Token:\n');
      console.log(`${config?.webhookVerifyToken || 'NOT SET'}\n`);
      console.log('Meta App ID:\n');
      console.log(`${config?.appId || 'NOT SET'}\n`);
      console.log('Phone Number ID:\n');
      console.log(`${config?.phoneNumberId || 'NOT SET'}\n`);
      console.log('=====================================\n');
      // Initialize background schedules for Post Dispatch:
      // 1. 15-minute lightweight invoice sync within working hours (09:00 - 20:00 IST)
      // 2. Daily 7:00 PM IST E-Invoice status reconciliation (max 100 calls)
      if (!(globalThis as any).__post_dispatch_sync_interval_started) {
        (globalThis as any).__post_dispatch_sync_interval_started = true;
        const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
        setInterval(async () => {
          try {
            const { isWithinIstWorkingHours, isIst7PmWindow, runPostDispatchSync, runEInvoiceStatusCheck } = await import('@/lib/post-dispatch-sync');
            if (isWithinIstWorkingHours()) {
              console.log('[Scheduler] Triggering 15-min Post Dispatch Sync...');
              await runPostDispatchSync({ trigger: 'CRON' });
            }

            // Daily 7:00 PM IST E-Invoice Reconciliation check
            if (isIst7PmWindow()) {
              console.log('[Scheduler] Triggering Daily 7 PM E-Invoice Check...');
              await runEInvoiceStatusCheck({ trigger: 'CRON_7PM', maxCalls: 100 });
            }
          } catch (err) {
            console.error('[Scheduler] Post Dispatch Sync interval error:', err);
          }
        }, FIFTEEN_MINUTES_MS);
      }
    } catch (e) {
      // Ignore DB connection errors during initial build/schema prep
    }
  }
}
