const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/api/dispatch/incoming-so/route.ts');

const routeContent = `import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { dispatchEventEmitter, DISPATCH_EVENTS } from '@/lib/dispatch-events';
import { getZohoOrgId, getZohoTokens } from '@/lib/zoho-auth';

// Helper function to enrich data asynchronously
async function enrichSalesOrder(salesorderId: string, dbId: string, requestId: string) {
  try {
    const orgId = getZohoOrgId();
    const accessToken = await getZohoTokens();
    
    console.log(\`[INCOMING SO][\${requestId}] Fetching Zoho Sales Order details...\`);
    
    if (!orgId || !accessToken) {
      throw new Error('Missing Zoho credentials');
    }

    const apiBase = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';
    const url = \`\${apiBase}/books/v3/salesorders/\${salesorderId}?organization_id=\${orgId}\`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': \`Zoho-oauthtoken \${accessToken}\`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
       const errorText = await response.text().catch(() => '');
       throw new Error(\`Zoho fetch failed: \${response.status} \${errorText}\`);
    }

    const data = await response.json();
    if (!data.salesorder) {
       throw new Error('Sales Order not found in Zoho response');
    }

    console.log(\`[INCOMING SO][\${requestId}] Zoho fetch: SUCCESS\`);

    const so = data.salesorder;
    const totalTax = so.tax_total !== undefined ? so.tax_total : (so.total_tax || 0);
    
    let totalItems = 0;
    if (Array.isArray(so.line_items)) {
      totalItems = so.line_items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
    }

    const updated = await prisma.dispatchIncomingOrder.update({
      where: { id: dbId },
      data: {
        salesorderNumber: so.salesorder_number,
        customerName: so.customer_name,
        total: so.total,
        currencyCode: so.currency_code || 'INR',
        totalItems,
        totalTax,
        zohoDetailsJson: so
      }
    });

    console.log(\`[INCOMING SO][\${requestId}] Final database update successful.\`);
    
    // Emit update event so UI re-renders with enriched data
    dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, updated);

  } catch (err: any) {
    console.error(\`[INCOMING SO][\${requestId}] Zoho fetch failed or DB update failed:\`, err);
    await prisma.incomingSoRequest.create({
      data: {
        salesorder_id: salesorderId,
        status: 'FAILED',
        error_message: err.message || 'Failed to enrich Sales Order from Zoho',
      },
    });
  }
}

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(2, 9);
  console.log(\`[INCOMING SO][\${requestId}] Incoming request received\`);

  try {
    const apiKey = request.headers.get('x-api-key');
    
    // Check DB first
    const dbConfig = await prisma.integrationConfig.findUnique({
      where: { key: 'INCOMING_SO_API_KEY' }
    });
    
    const configuredKey = dbConfig?.value || process.env.INCOMING_SO_API_KEY;

    if (!configuredKey || apiKey !== configuredKey) {
      console.log(\`[INCOMING SO][\${requestId}] Request validation result: FAILED (Auth)\`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Invalid or missing API Key.', requestId },
        { status: 401 }
      );
    }

    console.log(\`[INCOMING SO][\${requestId}] Request validation result: SUCCESS\`);

    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.log(\`[INCOMING SO][\${requestId}] JSON parse failed.\`);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body.', requestId },
        { status: 400 }
      );
    }

    if (body.test_connection === true) {
      console.log(\`[INCOMING SO][\${requestId}] Test connection successful.\`);
      return NextResponse.json(
        { success: true, message: 'Connection test successful. API is reachable and authenticated.', requestId },
        { status: 200 }
      );
    }

    const { salesorder_id } = body;
    console.log(\`[INCOMING SO][\${requestId}] salesorder_id received: \${salesorder_id}\`);

    if (!salesorder_id || typeof salesorder_id !== 'string' || salesorder_id.trim() === '') {
      console.log(\`[INCOMING SO][\${requestId}] Missing or invalid salesorder_id.\`);
      await prisma.incomingSoRequest.create({
        data: {
          salesorder_id: 'UNKNOWN',
          status: 'FAILED',
          error_message: 'Missing or invalid salesorder_id',
        },
      });
      return NextResponse.json(
        { success: false, error: 'Missing or invalid salesorder_id.', requestId },
        { status: 400 }
      );
    }

    // Save raw request
    await prisma.incomingSoRequest.create({
      data: {
        salesorder_id: salesorder_id.trim(),
        status: 'RECEIVED',
      },
    });

    const cleanId = salesorder_id.trim();

    // Check if it already exists
    let dispatchOrder = await prisma.dispatchIncomingOrder.findUnique({
      where: { zohoSalesorderId: cleanId }
    });

    if (!dispatchOrder) {
      console.log(\`[INCOMING SO][\${requestId}] Incoming record created\`);
      
      // PERSIST FIRST
      dispatchOrder = await prisma.dispatchIncomingOrder.create({
        data: {
          zohoSalesorderId: cleanId,
          status: 'NEW'
        }
      });
      
      // Emit initial creation SSE event
      dispatchEventEmitter.emit(DISPATCH_EVENTS.NEW_INCOMING_ORDER, dispatchOrder);

      // FIRE AND FORGET ENRICHMENT
      enrichSalesOrder(cleanId, dispatchOrder.id, requestId).catch(console.error);

      // Return immediately per requirements
      return NextResponse.json(
        { 
          success: true, 
          message: 'Sales Order accepted for Dispatch',
          salesOrderId: cleanId,
          incomingOrderId: dispatchOrder.id,
          created: true
        },
        { status: 200 }
      );
      
    } else {
      console.log(\`[INCOMING SO][\${requestId}] Existing record updated\`);
      
      // Just update timestamp
      dispatchOrder = await prisma.dispatchIncomingOrder.update({
        where: { zohoSalesorderId: cleanId },
        data: { updatedAt: new Date() }
      });
      
      // Optional: Re-trigger enrichment if it was incomplete before? 
      // For now, idempotency just returns success.
      return NextResponse.json(
        { 
          success: true, 
          message: 'Sales Order already exists and was updated',
          salesOrderId: cleanId,
          incomingOrderId: dispatchOrder.id,
          created: false
        },
        { status: 200 }
      );
    }

  } catch (error: any) {
    console.error(\`[INCOMING SO][\${requestId}] Unhandled error:\`, error);
    
    // Attempt to log failure safely
    try {
      await prisma.incomingSoRequest.create({
        data: {
          salesorder_id: 'UNKNOWN',
          status: 'FAILED',
          error_message: error?.message?.substring(0, 500) || 'Internal Server Error',
        },
      });
    } catch (dbErr) {
      console.error(\`[INCOMING SO][\${requestId}] Fatal DB logging failed:\`, dbErr);
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error.', requestId },
      { status: 500 }
    );
  }
}
`;

fs.writeFileSync(filePath, routeContent, 'utf8');
console.log('Route rewritten with Persist First strategy.');
