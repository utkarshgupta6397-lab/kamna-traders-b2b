import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const q = "";
    const status = "ALL";
    const vendorDcrStatus = "ALL";
    
    const whereClause: any = {};
    if (status && status !== 'ALL') whereClause.status = status;
    if (vendorDcrStatus && vendorDcrStatus !== 'ALL') whereClause.vendorDcrStatus = vendorDcrStatus;

    if (q.trim().length > 0) {
      // simulate my exact route.ts
    }

    const queryArgs: any = {
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        tag: true
      },
      skip: 0,
      take: 50
    };

    const serials = await prisma.dcrSerial.findMany(queryArgs);
    console.log("Serials loaded:", serials.length);
  } finally {
    await prisma.$disconnect();
  }
}
main();
