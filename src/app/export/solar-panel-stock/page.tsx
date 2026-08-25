import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ExportSolarPanelStockPage() {
  const session = await getSession();
  if (!session) return <div>Unauthorized</div>;

  const productSearchOptions = { categoryName: 'Solar Panel' };

  const [warehouses, categories, brands, items] = await Promise.all([
    prisma.warehouse.findMany({ 
      where: { active: true }, 
      select: { id: true, name: true, isSystemWarehouse: true },
      orderBy: { name: 'asc' }
    }),
    prisma.category.findMany({ 
      where: { active: true, status: 'Active' }, 
      select: { id: true, name: true, parentId: true },
      orderBy: { name: 'asc' }
    }),
    prisma.brand.findMany({
      where: { active: true, status: 'Active' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    import('@/lib/services/ProductLookupService').then(m => m.ProductLookupService.search('inventory', productSearchOptions))
  ]);

  const SolarPanelStockClient = (await import('@/components/SolarPanelStockClient')).default;

  return (
    <div style={{ backgroundColor: '#fff', width: '100%', height: '100%', margin: 0, padding: 0 }}>
      <SolarPanelStockClient 
        warehouses={warehouses} 
        categories={categories} 
        brands={brands}
        items={items}
        canSync={false}
        isExportMode={true}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: A4 landscape;
          margin: 15mm;
        }
        body {
          margin: 0;
          padding: 0;
          background: white !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-page-break-after {
          page-break-after: always;
        }
        table.export-table {
          page-break-inside: auto;
          width: 100% !important;
          table-layout: fixed !important;
        }
        .export-container {
          box-sizing: border-box;
          max-width: 100%;
          overflow: visible !important;
        }
        
        /* Product Series - Natural height but keep on one page */
        .print-page-break-after {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .print-page-break-after .export-container {
          margin-bottom: 0 !important;
        }

        .print-page-break-after .export-table th,
        .print-page-break-after .export-table td {
          padding-top: 8px !important;
          padding-bottom: 8px !important;
          font-size: 1.05em !important;
        }

        /* Prevent word breaks mid-word, allow wrapping only where natural */
        .export-table th, .export-table td {
          white-space: normal;
          word-break: normal;
          word-wrap: normal;
        }
        
        .export-table th {
          /* Allow header wrapping but prevent mid-word break */
          word-break: normal;
          white-space: normal;
        }

        /* Sub-headers like DCR / Non-DCR */
        .export-table thead tr:nth-child(2) th {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: clip !important;
        }

        /* Data cells like numbers */
        .export-table td:not(:first-child) {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: clip !important;
          text-align: center;
        }

        /* Product Series specific (First column) */
        .export-table td:first-child, .export-table th:first-child {
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
          white-space: normal !important;
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        thead {
          display: table-header-group;
        }
        tfoot {
          display: table-footer-group;
        }
      `}} />
    </div>
  );
}
