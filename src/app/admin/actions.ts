'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    throw new Error('Unauthorized');
  }
}

// ─── User Actions ────────────────────────────────────────────────────────────
export async function createUser(data: FormData) {
  await requireAdmin();
  const name = data.get('name') as string;
  const mobile = data.get('mobile') as string;
  const role = data.get('role') as string;
  const pin = data.get('pin') as string || undefined;
  const canManageCarts = data.get('canManageCarts') === 'true';
  await prisma.user.create({ data: { name, mobile, role, pin, canManageCarts } });
  revalidatePath('/admin/users');
}

export async function updateUser(data: FormData) {
  await requireAdmin();
  const id = data.get('id') as string;
  const name = data.get('name') as string;
  const mobile = data.get('mobile') as string;
  const role = data.get('role') as string;
  const pin = data.get('pin') as string || undefined;
  const active = data.get('active') === 'true';
  const canManageCarts = data.get('canManageCarts') === 'true';
  await prisma.user.update({ where: { id }, data: { name, mobile, role, pin, active, canManageCarts } });
  revalidatePath('/admin/users');
}

export async function deleteUser(id: string) {
  await requireAdmin();
  const cartCount = await prisma.cart.count({ where: { staffId: id } });
  if (cartCount > 0) throw new Error('Cannot delete user with existing carts');
  await prisma.user.delete({ where: { id } });
  revalidatePath('/admin/users');
}

// ─── Warehouse Actions ───────────────────────────────────────────────────────
export async function createWarehouse(data: FormData) {
  await requireAdmin();
  const name = data.get('name') as string;
  const address = data.get('address') as string;
  await prisma.warehouse.create({ data: { name, address } });
  revalidatePath('/admin/warehouses');
}

export async function updateWarehouse(data: FormData) {
  await requireAdmin();
  const id = data.get('id') as string;
  const name = data.get('name') as string;
  const address = data.get('address') as string;
  const active = data.get('active') === 'true';
  await prisma.warehouse.update({ where: { id }, data: { name, address, active } });
  revalidatePath('/admin/warehouses');
}

export async function deleteWarehouse(id: string) {
  await requireAdmin();
  const invCount = await prisma.warehouseInventory.count({ where: { warehouseId: id } });
  const cartCount = await prisma.cart.count({ where: { warehouseId: id } });
  if (invCount > 0 || cartCount > 0) throw new Error('Cannot delete warehouse with mapped inventory or carts');
  await prisma.warehouse.delete({ where: { id } });
  revalidatePath('/admin/warehouses');
}

// ─── Category Actions ────────────────────────────────────────────────────────
export async function createCategory(data: FormData) {
  await requireAdmin();
  const name = data.get('name') as string;
  await prisma.category.create({ data: { name } });
  revalidatePath('/admin/categories');
}

export async function updateCategory(data: FormData) {
  await requireAdmin();
  const id = data.get('id') as string;
  const name = data.get('name') as string;
  const active = data.get('active') === 'true';
  await prisma.category.update({ where: { id }, data: { name, active } });
  revalidatePath('/admin/categories');
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  const skuCount = await prisma.sku.count({ where: { categoryId: id } });
  if (skuCount > 0) throw new Error('Cannot delete category with mapped SKUs');
  await prisma.category.delete({ where: { id } });
  revalidatePath('/admin/categories');
}

// ─── Brand Actions ─────────────────────────────────────────────────────────────
export async function createBrand(data: FormData) {
  await requireAdmin();
  const name = data.get('name') as string;
  await prisma.brand.create({ data: { name } });
  revalidatePath('/admin/brands');
}

export async function updateBrand(data: FormData) {
  await requireAdmin();
  const id = data.get('id') as string;
  const name = data.get('name') as string;
  const active = data.get('active') === 'true';
  await prisma.brand.update({ where: { id }, data: { name, active } });
  revalidatePath('/admin/brands');
}

export async function deleteBrand(id: string) {
  await requireAdmin();
  const skuCount = await prisma.sku.count({ where: { brandId: id } });
  if (skuCount > 0) throw new Error('Cannot delete brand with mapped SKUs');
  await prisma.brand.delete({ where: { id } });
  revalidatePath('/admin/brands');
}

// ─── SKU Actions ─────────────────────────────────────────────────────────────
export async function createSku(data: FormData) {
  await requireAdmin();
  const id = data.get('id') as string;
  const existing = await prisma.sku.findUnique({ where: { id } });
  if (existing) throw new Error('SKU ID already exists');
  const name = data.get('name') as string;
  const categoryId = (data.get('categoryId') as string) || null;
  const brandId = (data.get('brandId') as string) || null;
  const price = Math.max(0, parseFloat(data.get('price') as string));
  const moq = Math.max(0, parseInt(data.get('moq') as string, 10));
  const stepQty = Math.max(1, parseInt(data.get('stepQty') as string, 10) || moq);
  const unit = data.get('unit') as string || undefined;
  const caseSize = Math.max(1, parseInt(data.get('caseSize') as string, 10) || 1);
  const zohoRaw = data.get('zohoBookItemId') as string;
  const zohoBookItemId = zohoRaw || null;
  const zohoBooksId2 = data.get('zohoBooksId2') as string || null;

  await prisma.sku.create({ data: { id, name, categoryId, brandId, price, moq, stepQty, unit, caseSize, zohoBookItemId, zohoBooksId2 } });
  revalidatePath('/admin/skus');
}

export async function updateSku(data: FormData) {
  await requireAdmin();
  // `id` = original/current SKU id (the WHERE key)
  // `newId` = desired SKU id (may differ for a rename)
  const id = data.get('id') as string;
  const newId = (data.get('newId') as string)?.trim() || id;
  const name = data.get('name') as string;
  const categoryId = (data.get('categoryId') as string) || null;
  const brandId = (data.get('brandId') as string) || null;
  const price = Math.max(0, parseFloat(data.get('price') as string));
  const moq = Math.max(0, parseInt(data.get('moq') as string, 10));
  const stepQty = Math.max(1, parseInt(data.get('stepQty') as string, 10) || moq);
  const unit = data.get('unit') as string || undefined;
  const isActive = data.get('isActive') === 'true';
  const caseSize = Math.max(1, parseInt(data.get('caseSize') as string, 10) || 1);
  const zohoRaw = data.get('zohoBookItemId') as string;
  const zohoBookItemId = zohoRaw || null;
  const zohoBooksId2 = data.get('zohoBooksId2') as string || null;

  // If SKU ID is being renamed, verify the new ID is not already taken
  if (newId !== id) {
    const conflict = await prisma.sku.findUnique({ where: { id: newId } });
    if (conflict) throw new Error(`SKU ID "${newId}" is already in use`);
  }

  await prisma.sku.update({
    where: { id },
    data: { id: newId, name, categoryId, brandId, price, moq, stepQty, unit, isActive, caseSize, zohoBookItemId, zohoBooksId2 },
  });
  revalidatePath('/admin/skus');
}

export async function deleteSku(id: string) {
  const cartItemCount = await prisma.cartItem.count({ where: { skuId: id } });
  if (cartItemCount > 0) throw new Error('Cannot delete SKU used in carts');
  await prisma.warehouseInventory.deleteMany({ where: { skuId: id } });
  await prisma.sku.delete({ where: { id } });
  revalidatePath('/admin/skus');
}

// ─── Inventory Actions ───────────────────────────────────────────────────────
export async function updateInventory(data: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  
  if (!session.canAdjustInventory) {
    throw new Error('Permission Denied: You do not have rights to adjust inventory.');
  }
  
  const warehouseId = data.get('warehouseId') as string;
  const skuId = data.get('skuId') as string;
  const qty = parseInt(data.get('qty') as string, 10);
  const zone = data.get('zone') as string;
  const remarks = data.get('remarks') as string;

  if (!remarks || remarks.trim().length < 3) {
    throw new Error('Remarks are mandatory for inventory adjustments (min 3 chars)');
  }

  const sku = await prisma.sku.findUnique({ where: { id: skuId } });
  if (!sku) throw new Error('SKU not found');

  await prisma.$transaction(async (tx) => {
    const currentInv = await tx.warehouseInventory.findUnique({
      where: { warehouseId_skuId: { warehouseId, skuId } }
    });

    const beforeQty = currentInv?.qty ?? 0;
    const afterQty = qty; // Manual adjustment sets the absolute value
    const qtyChange = afterQty - beforeQty;

    await tx.warehouseInventory.upsert({
      where: { warehouseId_skuId: { warehouseId, skuId } },
      update: { qty, zone, isOos: qty <= 0 },
      create: { warehouseId, skuId, qty, zone, isOos: qty <= 0 },
    });

    await tx.inventoryHistory.create({
      data: {
        warehouseId,
        skuId,
        productName: sku.name,
        beforeQty,
        afterQty,
        qtyChange,
        remarks: `Manual Adjustment | ${remarks.trim()}`,
        createdBy: session.userId as string,
      }
    });
  });

  revalidatePath('/admin/inventory');
  revalidatePath('/staff/dashboard/inventory/history');
}

export async function adjustInventory(data: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  if (!session.canAdjustInventory) {
    throw new Error('Permission Denied: You do not have rights to adjust inventory.');
  }
  
  const warehouseId = data.get('warehouseId') as string;
  const skuId = data.get('skuId') as string;
  const delta = parseInt(data.get('delta') as string, 10);
  const remarks = data.get('remarks') as string;

  if (isNaN(delta)) throw new Error('Invalid adjustment quantity');
  if (!remarks || remarks.trim().length < 3) {
    throw new Error('Remarks are mandatory (min 3 chars)');
  }

  const sku = await prisma.sku.findUnique({ where: { id: skuId } });
  if (!sku) throw new Error('SKU not found');

  await prisma.$transaction(async (tx) => {
    // 1. Get current stock
    const currentInv = await tx.warehouseInventory.findUnique({
      where: { warehouseId_skuId: { warehouseId, skuId } }
    });

    const beforeQty = currentInv?.qty ?? 0;
    const afterQty = beforeQty + delta;

    // 2. Update/Create inventory
    await tx.warehouseInventory.upsert({
      where: { warehouseId_skuId: { warehouseId, skuId } },
      update: { qty: { increment: delta }, isOos: afterQty <= 0 },
      create: { warehouseId, skuId, qty: afterQty, isOos: afterQty <= 0 },
    });

    // 3. Log History
    await tx.inventoryHistory.create({
      data: {
        warehouseId,
        skuId,
        productName: sku.name,
        beforeQty,
        afterQty,
        qtyChange: delta,
        remarks: `Manual Adjustment | ${remarks.trim()}`,
        createdBy: session.userId as string,
      }
    });
  });

  revalidatePath('/admin/inventory');
  revalidatePath('/staff/dashboard/inventory/history');
}
