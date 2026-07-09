import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { InvoiceProcessorService } from '@/lib/services/invoice-processor.service';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    
    if (!session || (session.role !== 'ADMIN' && !session.accounts_invoice_processor)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.xlsx') && 
        file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return NextResponse.json({ success: false, error: 'Invalid file format. Only .xlsx is supported.' }, { status: 400 });
    }

    // Convert Web File to Node Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process File
    const result = await InvoiceProcessorService.processFile(buffer, file.name, session.userId);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[InvoiceProcessorAPI] Unexpected Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process file: ' + error.message },
      { status: 500 }
    );
  }
}
