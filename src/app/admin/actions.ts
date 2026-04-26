'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';


// ─── User Actions ────────────────────────────────────────────────────────────
export async function createUser(data: FormData) {
  const name = data.get('name') as string;
  const mobile = data.get('mobile') as string;
  const role = data.get('role') as string;
  const pin = data.get('pin') as string || undefined;
  await prisma.user.create({ data: { name, mobile, role, pin } });
  revalidatePath('/admin/users');
}

export async function updateUser(data: FormData) {
  const id = data.get('id') as string;
  const name = data.get('name') as string;
  const mobile = data.get('mobile') as string;
  const role = data.get('role') as string;
  const pin = data.get('pin') as string || undefined;
  const active = data.get('active') === 'true';
  await prisma.user.update({ where: { id }, data: { name, mobile, role, pin, active } });
  revalidatePath('/admin/users');
}

export async function deleteUser(id: string) {
  const cartCount = await prisma.cart.count({ where: { staffId: id } });
  if (cartCount > 0) throw new Error('Cannot delete user with existing carts');
  await prisma.user.delete({ where: { id } });
  revalidatePath('/admin/users');
}

// ─── Warehouse Actions ───────────────────────────────────────────────────────
export async function createWarehouse(data: FormData) {
  const name = data.get('name') as string;
  const address = data.get('address') as string;
  await prisma.warehouse.create({ data: { name, address } });
  revalidatePath('/admin/warehouses');
}

export async function updateWarehouse(data: FormData) {
  const id = data.get('id') as string;
  const name = data.get('name') as string;
  const address = data.get('address') as string;
  const active = data.get('active') === 'true';
  await prisma.warehouse.update({ where: { id }, data: { name, address, active } });
  revalidatePath('/admin/warehouses');
}

export async function deleteWarehouse(id: string) {
  const invCount = await prisma.warehouseInventory.count({ where: { warehouseId: id } });
  const cartCount = await prisma.cart.count({ where: { warehouseId: id } });
  if (invCount > 0 || cartCount > 0) throw new Error('Cannot delete warehouse with mapped inventory or carts');
  await prisma.warehouse.delete({ where: { id } });
  revalidatePath('/admin/warehouses');
}

// ─── Category Actions ────────────────────────────────────────────────────────
export async function createCategory(data: FormData) {
  const name = data.get('name') as string;
  await prisma.category.create({ data: { name } });
  revalidatePath('/admin/categories');
}

export async function updateCategory(data: FormData) {
  const id = data.get('id') as string;
  const name = data.get('name') as string;
  const active = data.get('active') === 'true';
  await prisma.category.update({ where: { id }, data: { name, active } });
  revalidatePath('/admin/categories');
}

export async function deleteCategory(id: string) {
  const skuCount = await prisma.sku.count({ where: { categoryId: id } });
  if (skuCount > 0) throw new Error('Cannot delete category with mapped SKUs');
  await prisma.category.delete({ where: { id } });
  revalidatePath('/admin/categories');
}

// ─── Brand Actions ─────────────────────────────────────────────────────────────
export async function createBrand(data: FormData) {
  const name = data.get('name') as string;
  await prisma.brand.create({ data: { name } });
  revalidatePath('/admin/brands');
}

export async function updateBrand(data: FormData) {
  const id = data.get('id') as string;
  const name = data.get('name') as string;
  const active = data.get('active') === 'true';
  await prisma.brand.update({ where: { id }, data: { name, active } });
  revalidatePath('/admin/brands');
}

export async function deleteBrand(id: string) {
  const skuCount = await prisma.sku.count({ where: { brandId: id } });
  if (skuCount > 0) throw new Error('Cannot delete brand with mapped SKUs');
  await prisma.brand.delete({ where: { id } });
  revalidatePath('/admin/brands');
}

// ─── SKU Actions ─────────────────────────────────────────────────────────────
export async function createSku(data: FormData) {
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
  const imageUrl = data.get('imageUrl') as string || undefined;
  await prisma.sku.create({ data: { id, name, categoryId, brandId, price, moq, stepQty, unit, imageUrl } });
  revalidatePath('/admin/skus');
}

export async function updateSku(data: FormData) {
  const id = data.get('id') as string;
  const name = data.get('name') as string;
  const categoryId = (data.get('categoryId') as string) || null;
  const brandId = (data.get('brandId') as string) || null;
  const price = Math.max(0, parseFloat(data.get('price') as string));
  const moq = Math.max(0, parseInt(data.get('moq') as string, 10));
  const stepQty = Math.max(1, parseInt(data.get('stepQty') as string, 10) || moq);
  const unit = data.get('unit') as string || undefined;
  const imageUrl = data.get('imageUrl') as string || undefined;
  const isActive = data.get('isActive') === 'true';
  await prisma.sku.update({ where: { id }, data: { name, categoryId, brandId, price, moq, stepQty, unit, imageUrl, isActive } });
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
  const warehouseId = data.get('warehouseId') as string;
  const skuId = data.get('skuId') as string;
  const qty = Math.max(0, parseInt(data.get('qty') as string, 10));
  const zone = data.get('zone') as string;
  await prisma.warehouseInventory.upsert({
    where: { warehouseId_skuId: { warehouseId, skuId } },
    update: { qty, zone, isOos: qty <= 0 },
    create: { warehouseId, skuId, qty, zone, isOos: qty <= 0 },
  });
  revalidatePath('/admin/inventory');
}
