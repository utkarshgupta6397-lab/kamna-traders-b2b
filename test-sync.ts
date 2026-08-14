import { PrismaClient } from '@prisma/client';
import { ZohoProductService } from './src/lib/services/zoho-books/ZohoProductService';
import { DevLogger } from './src/lib/utils/DevLogger';

const prisma = new PrismaClient();

async function main() {
  const variantId = 'cmsq64uc7000bua5hb4fs9j57';
  console.log('Running sync for variant:', variantId);
  const runId = 'test-run-123';
  
  try {
    const result = await ZohoProductService.syncVariant(variantId, 'MANUAL_SYNC', runId);
    console.log('Sync Result:', result.success);
    
    // Print all ZOHO-FORENSIC logs
    const runs = DevLogger.getRuns();
    const ourRun = runs.find(r => r.runId === runId);
    if (ourRun) {
      console.log('FORENSIC EVENTS:');
      ourRun.entries.filter(e => e.event.includes('[ZOHO-FORENSIC]')).forEach(e => {
        console.log(`\n--- ${e.event} ---`);
        if (e.input) console.log('INPUT:', JSON.stringify(e.input, null, 2));
        if (e.output) console.log('OUTPUT:', JSON.stringify(e.output, null, 2));
      });
    } else {
      console.log('No logs found for runId', runId);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
