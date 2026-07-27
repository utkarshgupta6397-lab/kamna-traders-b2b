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
    } catch (e) {
      // Ignore DB connection errors during initial build/schema prep
    }
  }
}
