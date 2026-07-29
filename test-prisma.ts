import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const id = 'cmpwc0fb50001uafnpj6hvd6z';
  const user = await prisma.user.findUnique({ where: { id } });
  console.log(user ? "Found" : "Not Found");
}
main().catch(console.error).finally(() => prisma.$disconnect());
