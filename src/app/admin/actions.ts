'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

// User Actions
export async function createUser(data: FormData) {
  const name = data.get('name') as string;
  const mobile = data.get('mobile') as string;
  const role = data.get('role') as string;

  await prisma.user.create({
    data: { name, mobile, role },
  });
  revalidatePath('/admin/users');
}

export async function deleteUser(id: string) {
  await prisma.user.delete({ where: { id } });
  revalidatePath('/admin/users');
}

// Warehouse Actions
export async function createWarehouse(data: FormData) {
  const name = data.get('name') as string;
  const address = data.get('address') as string;

  await prisma.warehouse.create({
    data: { name, address },
  });
  revalidatePath('/admin/warehouses');
}

export async function deleteWarehouse(id: string) {
  await prisma.warehouse.delete({ where: { id } });
  revalidatePath('/admin/warehouses');
}

// Category Actions
export async function createCategory(data: FormData) {
  const name = data.get('name') as string;

  await prisma.category.create({
    data: { name },
  });
  revalidatePath('/admin/categories');
}

export async function deleteCategory(id: string) {
  await prisma.category.delete({ where: { id } });
  revalidatePath('/admin/categories');
}

// SKU Actions
export async function createSku(data: FormData) {
  const id = data.get('id') as string;
  const name = data.get('name') as string;
  const categoryId = data.get('categoryId') as string;
  const price = parseFloat(data.get('price') as string);
  const moq = parseInt(data.get('moq') as string, 10);

  await prisma.sku.create({
    data: { id, name, categoryId, price, moq },
  });
  revalidatePath('/admin/skus');
}

export async function deleteSku(id: string) {
  await prisma.sku.delete({ where: { id } });
  revalidatePath('/admin/skus');
}

// Inventory Actions
export async function updateInventory(data: FormData) {
  const warehouseId = data.get('warehouseId') as string;
  const skuId = data.get('skuId') as string;
  const qty = parseInt(data.get('qty') as string, 10);
  const zone = data.get('zone') as string;

  await prisma.warehouseInventory.upsert({
    where: { warehouseId_skuId: { warehouseId, skuId } },
    update: { qty, zone, isOos: qty <= 0 },
    create: { warehouseId, skuId, qty, zone, isOos: qty <= 0 },
  });
  revalidatePath('/admin/inventory');
}
