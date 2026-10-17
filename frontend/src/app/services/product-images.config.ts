export const PRODUCT_IMAGE_FALLBACK = '/assets/images/products/product-placeholder.svg';

export const PRODUCT_IMAGE_BY_SKU: Readonly<Record<string, string>> = {
  'TM-AIRPODS-001':
    'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?auto=format&fit=crop&w=800&q=80',
  'TM-GPRO-001':
    'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
  'TM-IPHONE-001':
    'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80',
  'TM-MACBOOK-001':
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
  'TM-MXMASTER-001':
    'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80',
  'TM-ROG-001':
    'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80',
  'TM-RTX4090-001':
    'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=800&q=80',
  'TM-S24-001':
    'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80',
  'TM-KEYBOARD-001':
    'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
  'TM-GALAXYTAB-001':
    'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=80',
  'TM-HEADSET-001':
    'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80',
  'TM-MONITOR-001':
    'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80',
};

export function getProductImage(sku: string): string {
  return PRODUCT_IMAGE_BY_SKU[sku.trim().toUpperCase()] ?? PRODUCT_IMAGE_FALLBACK;
}
