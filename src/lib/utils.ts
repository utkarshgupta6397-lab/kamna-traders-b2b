/**
 * Formats a number as Indian Currency (INR)
 * Example: 100000 -> ₹1,00,000
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Resolves the product image, falling back to the parent family image if the variant does not have one.
 */
export function resolveProductImage(product: any): string | null {
  if (!product) return null;
  
  // 1. Variant specific image (if present)
  if (product.thumbnailBase64) {
    return product.thumbnailBase64;
  }
  
  // 2. Family fallback image (if present)
  if (product.parentProduct && product.parentProduct.thumbnailBase64) {
    return product.parentProduct.thumbnailBase64;
  }
  
  return null;
}
