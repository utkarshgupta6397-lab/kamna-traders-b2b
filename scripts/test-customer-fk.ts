import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('Truncating tables...')
  await prisma.dcrSerialHistory.deleteMany()
  await prisma.dcrSerialAllocation.deleteMany()
  await prisma.dcrSerial.deleteMany()
  await prisma.dcrAuditLog.deleteMany()
  await prisma.dcrInvoiceItem.deleteMany()
  await prisma.dcrInvoice.deleteMany()
  await prisma.customer.deleteMany()
  
  const count = await prisma.customer.count()
  console.log(`Customer count: ${count}`)
  
  // We need to trigger the sync API. Since we don't have auth headers handy, we'll import the POST handler directly
  // or simulate what sync route does locally.
  console.log('We will test it by starting next dev and sending a fetch request to backfill or sync.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
