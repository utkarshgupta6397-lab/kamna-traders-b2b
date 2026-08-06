'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ShieldAlert } from 'lucide-react';
import EditFamilyClient from './EditFamilyClient';
import toast from 'react-hot-toast';

export default function EditFamilyWrapper({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/staff/catalog/products/${id}`);
        if (!res.ok) throw new Error('Failed to fetch product family');
        const data = await res.json();
        
        if (data.catalogType !== 'PRODUCT_FAMILY') {
          toast.error('This product is not a Product Family. Redirecting...');
          router.replace(`/staff/dashboard/catalog-pricing/products/${id}`);
          return;
        }
        
        setProduct(data);
      } catch (err: any) {
        toast.error(err.message || 'Error loading product family');
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-gray-500">
          <Activity className="w-8 h-8 animate-spin text-indigo-500" />
          <p>Loading Product Family...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex flex-col items-center justify-center p-6">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Product Family Not Found</h2>
        <button onClick={() => router.push('/staff/dashboard/catalog-pricing/products')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Return to Catalog
        </button>
      </div>
    );
  }

  return <EditFamilyClient product={product} />;
}
