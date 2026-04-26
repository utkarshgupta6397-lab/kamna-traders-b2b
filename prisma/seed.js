const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ── helpers ──────────────────────────────────────────────────────────────────
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function genPin() { return String(rnd(100000, 999999)) }

// ── categories ───────────────────────────────────────────────────────────────
const CATEGORY_NAMES = [
  'Rice','Atta','Flour','Sugar','Pulses','Dry Fruits',
  'Spices','Cooking Oil','Grains','Besan','Salt','Tea','Packaging'
]

// ── product pool per category ────────────────────────────────────────────────
const PRODUCT_POOLS = {
  Rice: [
    ['Premium Basmati Rice','KT1001',150,10],['Sharbati Rice','KT1002',90,25],
    ['Sona Masoori Rice','KT1003',72,25],['Brown Rice','KT1004',110,10],
    ['Idli Rice','KT1005',65,50],['Broken Rice','KT1006',40,50],
    ['Kolam Rice','KT1007',58,25],['Parboiled Rice','KT1008',62,25],
    ['Ponni Rice','KT1009',68,25],['Jeera Rice','KT1010',130,10],
  ],
  Atta: [
    ['Sharbati Atta','KT1011',42,25],['Whole Wheat Atta','KT1012',38,25],
    ['MP Chakki Atta','KT1013',40,25],['Multigrain Atta','KT1014',55,10],
    ['Maida','KT1015',36,25],['Suji Rava','KT1016',44,25],
  ],
  Flour: [
    ['Maize Flour','KT1021',34,25],['Bajra Flour','KT1022',30,25],
    ['Jowar Flour','KT1023',32,25],['Ragi Flour','KT1024',55,10],
    ['Gram Flour (Besan)','KT1025',68,25],['Rice Flour','KT1026',42,25],
  ],
  Sugar: [
    ['Refined Sugar M30','KT1031',44,50],['Raw Sugar','KT1032',38,50],
    ['Powdered Sugar','KT1033',50,25],['Brown Sugar','KT1034',75,10],
    ['Organic Jaggery','KT1035',80,25],['Mishri','KT1036',95,10],
  ],
  Pulses: [
    ['Chana Dal','KT1041',78,25],['Moong Dal','KT1042',92,25],
    ['Urad Dal','KT1043',88,25],['Toor Dal','KT1044',110,25],
    ['Masoor Dal','KT1045',75,25],['Rajma','KT1046',120,10],
    ['Chole (White)','KT1047',85,25],['Matar (Green)','KT1048',70,25],
    ['Moth Dal','KT1049',68,25],['Kulthi Dal','KT1050',65,25],
  ],
  'Dry Fruits': [
    ['Cashew W240','KT1051',750,5],['Almonds California','KT1052',680,5],
    ['Pistachios Roasted','KT1053',900,5],['Raisins Green','KT1054',180,10],
    ['Walnuts Halves','KT1055',600,5],['Dates Medjool','KT1056',350,10],
    ['Apricots Dried','KT1057',280,10],['Figs Dried','KT1058',260,10],
  ],
  Spices: [
    ['Turmeric Powder','KT1061',95,10],['Red Chilli Powder','KT1062',110,10],
    ['Coriander Powder','KT1063',85,10],['Cumin Whole','KT1064',140,10],
    ['Black Pepper','KT1065',350,5],['Cardamom Green','KT1066',1200,1],
    ['Cloves','KT1067',800,1],['Bay Leaf','KT1068',60,10],
    ['Garam Masala','KT1069',130,10],['Hing Premium','KT1070',220,5],
    ['Saunf (Fennel)','KT1071',90,10],['Ajwain','KT1072',80,10],
  ],
  'Cooking Oil': [
    ['Soyabean Oil Refined','KT1081',135,15],['Mustard Oil Kachi Ghani','KT1082',165,10],
    ['Sunflower Oil','KT1083',128,15],['Groundnut Oil','KT1084',175,10],
    ['Palm Oil Refined','KT1085',110,25],['Rice Bran Oil','KT1086',145,10],
    ['Coconut Oil','KT1087',190,5],['Desi Ghee','KT1088',550,5],
  ],
  Grains: [
    ['Barley (Jau)','KT1091',35,25],['Oats Rolled','KT1092',85,10],
    ['Corn Maize','KT1093',28,50],['Millets Mixed','KT1094',60,25],
    ['Foxtail Millet','KT1095',65,25],['Pearl Millet (Bajra)','KT1096',30,50],
  ],
  Besan: [
    ['Fine Besan Grade A','KT1101',75,25],['Coarse Besan','KT1102',68,25],
    ['Roasted Besan','KT1103',82,10],
  ],
  Salt: [
    ['Iodised Table Salt','KT1111',18,50],['Rock Salt (Sendha)','KT1112',45,25],
    ['Black Salt','KT1113',55,10],['Sea Salt Fine','KT1114',60,10],
  ],
  Tea: [
    ['CTC Assam Tea','KT1121',220,10],['Darjeeling Leaf Tea','KT1122',380,5],
    ['Green Tea Leaves','KT1123',300,5],['Masala Tea Premix','KT1124',250,10],
    ['Ginger Tea Powder','KT1125',280,5],
  ],
  Packaging: [
    ['HDPE Bags 1kg','KT1131',8,500],['PP Woven Bags 25kg','KT1132',22,100],
    ['Food Grade Labels','KT1133',2,1000],['Stretch Wrap Roll','KT1134',180,10],
    ['Corrugated Boxes Std','KT1135',45,50],
  ],
}

const ZONES = ['A1','A2','B1','B2','C1','C2','D1']

async function main() {
  console.log('🌱 Seeding Kamna Traders...')

  // ── Users ──────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { mobile: '1234567890' },
    update: { pin: '123456', name: 'Super Admin' },
    create: { name: 'Super Admin', mobile: '1234567890', role: 'ADMIN', pin: '123456' },
  })
  const staff1 = await prisma.user.upsert({
    where: { mobile: '9876543210' },
    update: { pin: '654321', name: 'Ravi Kumar' },
    create: { name: 'Ravi Kumar', mobile: '9876543210', role: 'STAFF', pin: '654321' },
  })
  console.log('✅ Users seeded (Admin PIN: 123456 | Staff PIN: 654321)')

  // ── Warehouse ──────────────────────────────────────────────────────────────
  const warehouse = await prisma.warehouse.upsert({
    where: { id: 'WH001' },
    update: {},
    create: { id: 'WH001', name: 'Main Warehouse', address: 'Sector 14, Delhi NCR' },
  })
  const warehouse2 = await prisma.warehouse.upsert({
    where: { id: 'WH002' },
    update: {},
    create: { id: 'WH002', name: 'Gurgaon Branch', address: 'HSIIDC, Gurgaon' },
  })
  console.log('✅ Warehouses seeded')

  const brand = await prisma.brand.upsert({
    where: { name: 'Kamna' },
    update: {},
    create: { name: 'Kamna' },
  })
  console.log('✅ Brand seeded')

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
          unit: catName === 'Cooking Oil' ? 'L' : catName === 'Packaging' ? 'pcs' : 'kg',
          moq,
          price,
          categoryId: catId,
          isActive: true,
        },
      })

      const qty = pick([0, rnd(50, 200), rnd(200, 1000), rnd(100, 500)])
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
  console.log(`✅ ${totalSkus} SKUs seeded with inventory`)
  console.log('\n🚀 Seed complete!')
  console.log('   Admin → mobile: 1234567890 | PIN: 123456')
  console.log('   Staff → mobile: 9876543210 | PIN: 654321')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
