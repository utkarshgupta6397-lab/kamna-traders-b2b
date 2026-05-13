import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sampleToken = 'any-token-here';
  console.log('Running EXPLAIN ANALYZE for session token lookup...');
  
  try {
    const result = await prisma.$queryRawUnsafe(`
      EXPLAIN ANALYZE
      SELECT "id", "userId", "deviceType"
      FROM "ActiveSession"
      WHERE "sessionToken" = $1
      LIMIT 1;
    `, sampleToken);

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Analysis failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
