const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ── helpers ──────────────────────────────────────────────────────────────────
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function genPin() { return String(rnd(100000, 999999)) }

// ── categories ───────────────────────────────────────────────────────────────
const CATEGORY_NAMES = [
  'Solar Panels', 'Solar Inverters', 'Lithium Batteries', 'MC4 Connectors', 'Solar Cables', 'Structure'
]

// ── product pool per category ────────────────────────────────────────────────
const PRODUCT_POOLS = {
  'Solar Panels': [
    ['Tata Power 550W Mono PERC','SOL1001',22000,10],['Adani 450W Poly','SOL1002',15000,20],
    ['Waaree 540W Bifacial','SOL1003',24500,10],['Loom Solar 400W','SOL1004',18000,5],
  ],
  'Solar Inverters': [
    ['Sungrow 50kW On-Grid','INV1001',125000,1],['Luminous 5kVA Hybrid','INV1002',45000,2],
    ['Microtek 2.5kVA SW','INV1003',18000,5],['Delta 100kW String','INV1004',280000,1],
  ],
  'Lithium Batteries': [
    ['Okaya 48V 100Ah LFP','BAT1001',95000,2],['Livguard 5kWh Wall Mount','BAT1002',145000,1],
    ['Exide 12V 150Ah Li-ion','BAT1003',28000,10],
  ],
  'MC4 Connectors': [
    ['MC4 Pair (Male/Female)','CON1001',45,100],['MC4 Y Branch 2-to-1','CON1002',180,50],
  ],
  'Solar Cables': [
    ['4sqmm DC Cable (Red) 100m','CAB1001',4500,5],['6sqmm DC Cable (Black) 100m','CAB1002',6500,5],
  ],
  'Structure': [
    ['Aluminum Rail 4m','STR1001',1200,20],['L-Foot mounting kit','STR1002',85,200],
  ],
}

const ZONES = ['A1','A2','B1','B2','C1','C2','D1']

async function main() {
  console.log('🌱 Seeding Kamna Traders (Solar Edition)...')

  // ── Users ──────────────────────────────────────────────────────────────────
  const isProd = process.env.NODE_ENV === 'production'
  
  // Ensure Admin (Both envs)
  await prisma.user.upsert({
    where: { mobile: '8744832318' },
    update: { 
      role: 'ADMIN',
      ...(isProd ? {} : { pin: '000000' })
    }, // Ensure role is ADMIN and PIN is reset in local
    create: { 
      name: 'Master Admin', 
      mobile: '8744832318', 
      role: 'ADMIN', 
      pin: isProd ? (process.env.ADMIN_PIN || null) : '000000' 
    },
  })

  // Ensure Dummy Staff (Local only)
  if (!isProd) {
    await prisma.user.upsert({
      where: { mobile: '1234567890' },
      update: { 
        role: 'STAFF',
        pin: '000000'
      },
      create: { name: 'Dummy Staff', mobile: '1234567890', role: 'STAFF', pin: '000000' },
    })
  }
  console.log('✅ Users setup complete')

  // ── Warehouse ──────────────────────────────────────────────────────────────
  const warehouse = await prisma.warehouse.upsert({
    where: { id: 'WH001' },
    update: {},
    create: { id: 'WH001', name: 'Main Solar Warehouse', address: 'Sector 62, Noida' },
  })
  console.log('✅ Warehouse seeded')

  const brand = await prisma.brand.upsert({
    where: { id: 'BR_GENERIC' },
    update: {},
    create: { id: 'BR_GENERIC', name: 'Generic' },
  })

  // ── Categories ─────────────────────────────────────────────────────────────
  const catMap = {}
  for (const name of CATEGORY_NAMES) {
    const cat = await prisma.category.upsert({
      where: { id: `CAT_${name.replace(/\s+/g, '_').toUpperCase()}` },
      update: {},
      create: { id: `CAT_${name.replace(/\s+/g, '_').toUpperCase()}`, name },
    })
    catMap[name] = cat.id
  }
  console.log('✅ Categories seeded')

  // ── SKUs + Inventory ───────────────────────────────────────────────────────
  let totalSkus = 0
  for (const [catName, products] of Object.entries(PRODUCT_POOLS)) {
    const catId = catMap[catName]
    if (!catId) continue

    for (const [prodName, skuId, price, moq] of products) {
      await prisma.sku.upsert({
        where: { id: skuId },
        update: { name: prodName, price, moq, categoryId: catId },
        create: {
          id: skuId,
          name: prodName,
          brandId: brand.id,
          unit: catName === 'MC4 Connectors' ? 'pair' : 'unit',
          moq,
          price,
          categoryId: catId,
          isActive: true,
        },
      })

      const qty = pick([0, rnd(10, 50), rnd(50, 200)])
      const isOos = qty === 0
      await prisma.warehouseInventory.upsert({
        where: { warehouseId_skuId: { warehouseId: warehouse.id, skuId } },
        update: { qty, isOos },
        create: {
          warehouseId: warehouse.id,
          skuId,
          qty,
          isOos,
          zone: pick(ZONES),
        },
      })
      totalSkus++
    }
  }
  console.log(`✅ ${totalSkus} Solar SKUs seeded with inventory`)
  console.log('\n🚀 Seed complete!')
  console.log('   Admin → mobile: 8744832318 | PIN: 000000')
  console.log('   Staff → mobile: 1234567890 | PIN: 000000')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
