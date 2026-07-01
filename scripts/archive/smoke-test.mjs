import { SignJWT } from 'jose';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const secretKey = process.env.SESSION_SECRET || 'local-dev-secret-1234567890';
const key = new TextEncoder().encode(secretKey);

async function encrypt(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(key);
}

async function run() {
  const session = await encrypt({ userId: 'cmov5eeij0001znrrij7cpzcs', role: 'STAFF' });
  
  // 1. Get current sequence
  const datePart = new Date().toLocaleDateString('en-GB', { 
    day: '2-digit', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' 
  }).replace(/ /g, '/');
  
  console.log('Current Date Part:', datePart);

  // 2. Create a dispatch with OOS item (large quantity)
  const payload = {
    "warehouseId": "WH001",
    "customerName": "Smoke Test Customer",
    "notes": "Testing sequential numbering and negative inventory",
    "staffId": "cmov5eeij0001znrrij7cpzcs",
    "items": [
      { "skuId": "SOL1002", "qty": 100 }
    ]
  };

  const res = await fetch('http://localhost:3000/api/staff/cart', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session=${session}`
    },
    body: JSON.stringify(payload)
  });
  
  const data = await res.json();
  console.log('API Status:', res.status);
  console.log('API Response:', data);

  if (data.success) {
    const cart = await prisma.cart.findUnique({
      where: { id: data.cartId },
      include: { items: true }
    });
    console.log('Generated Slip Number:', cart.dispatchSlipNumber);
    
    // Check inventory for SOL1002 in WH001
    const inv = await prisma.warehouseInventory.findFirst({
      where: { warehouseId: 'WH001', skuId: 'SOL1002' }
    });
    console.log('Inventory after dispatch:', inv.qty);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
