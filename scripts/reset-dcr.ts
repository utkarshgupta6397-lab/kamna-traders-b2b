import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.dcrSerialHistory.deleteMany({})
  await prisma.dcrSerialAllocation.deleteMany({})
  await prisma.dcrSerial.deleteMany({})
  await prisma.dcrAuditLog.deleteMany({})
  await prisma.dcrInvoiceItem.deleteMany({})
  await prisma.dcrInvoice.deleteMany({})
  console.log('Deleted all DCR data')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
