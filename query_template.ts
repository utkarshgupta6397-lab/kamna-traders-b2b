import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const t = await prisma.whatsAppTemplate.findFirst({ where: { name: 'dcr_issued_v1' } })
  console.log(JSON.stringify(t, null, 2))
}
main()
