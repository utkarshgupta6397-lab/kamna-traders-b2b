import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const tokenRecord = await prisma.zohoToken.findFirst({
    where: { service: 'books' },
    orderBy: { createdAt: 'desc' }
  });
  if (!tokenRecord) {
    console.log("No token in DB");
    return;
  }
  const token = tokenRecord.accessToken;
  const org = process.env.ZOHO_BOOKS_ORG_ID || "60027595766";
  const API_BASE_URL = 'https://www.zohoapis.in';

  const res = await fetch(`${API_BASE_URL}/books/v3/journals?organization_id=${org}&page=1`, { 
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
