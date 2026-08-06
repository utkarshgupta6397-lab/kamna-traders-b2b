'use client';

import React, { use, useEffect, useState } from 'react';
import ProductDetailPageClient from './ProductDetailPageClient';
import ProductFamilyDetailPageClient from './ProductFamilyDetailPageClient';
import { Activity } from 'lucide-react';

export default function ProductDetailWrapper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [catalogType, setCatalogType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchType() {
      try {
        const res = await fetch(`/api/staff/catalog/products/${id}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setCatalogType(data.catalogType || 'PRODUCT');
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchType();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <Activity className="w-8 h-8 animate-spin text-indigo-500" />
          <p>Loading Product Workspace...</p>
        </div>
      </div>
    );
  }

  if (catalogType === 'PRODUCT_FAMILY') {
    return <ProductFamilyDetailPageClient params={params} />;
  }

  return <ProductDetailPageClient params={params} />;
}
