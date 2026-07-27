import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import * as XLSX from 'xlsx';
import { getNextMasterId } from '@/lib/master-data-service';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN' && !session.catalog_hsncodes_create)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }

    // Process rows
    const validRows = [];
    for (const row of rows) {
      const code = (row['HSN_CD'] || row['HSN Code'] || '').toString().trim();
      const name = (row['HSN_Description'] || row['Description'] || '').toString().trim();

      if (code.length >= 2 && name.length > 0) {
        validRows.push({ code, name });
      }
    }

    if (validRows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found. Ensure HSN_CD and HSN_Description columns exist.' }, { status: 400 });
    }

    // Sort by length to ensure parents are inserted before children
    validRows.sort((a, b) => a.code.length - b.code.length);

    let inserted = 0;
    
    // Chunking to avoid massive transactions
    const chunkSize = 200;
    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize);
      
      await prisma.$transaction(async (tx: any) => {
        for (const item of chunk) {
          const { code, name } = item;
          // Determine Level
          const len = code.length;
          let level = 'Tariff Item';
          if (len === 2) level = 'Chapter';
          else if (len === 4) level = 'Heading';
          else if (len === 6) level = 'Sub-heading';

          await tx.governmentHsnHelper.upsert({
            where: { code },
            update: { description: name, level },
            create: { code, description: name, level }
          });
          inserted++;
        }
      });
    }

    return NextResponse.json({ 
      message: `Successfully imported ${inserted} new HSN records out of ${validRows.length} valid rows.`
    });
  } catch (error: any) {
    console.error('[API] POST /api/staff/catalog/hsn-codes/import error:', error);
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
}
