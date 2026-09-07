const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/api/dispatch/incoming-so/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Imports
const newImports = `
import { dispatchEventEmitter, DISPATCH_EVENTS } from '@/lib/dispatch-events';
import { getZohoOrgId, getZohoTokens } from '@/lib/zoho-auth';
`;
content = content.replace("import { prisma } from '@/lib/db';", "import { prisma } from '@/lib/db';\n" + newImports);

// Inside the successful processing block
const replaceBlock = `
    // Save successful request
    await prisma.incomingSoRequest.create({
      data: {
        salesorder_id: salesorder_id.trim(),
        status: 'RECEIVED',
      },
    });

    return NextResponse.json(
      { success: true, message: 'Sales Order received successfully.' },
      { status: 200 }
    );
`;

const newBlock = `
    // Save raw request
    await prisma.incomingSoRequest.create({
      data: {
        salesorder_id: salesorder_id.trim(),
        status: 'RECEIVED',
      },
    });

    const cleanId = salesorder_id.trim();

    // Check if it already exists
    const existingEntry = await prisma.dispatchIncomingOrder.findUnique({
      where: { zohoSalesorderId: cleanId }
    });

    let isNew = false;
    let dispatchOrder;

    if (!existingEntry) {
      isNew = true;
      // Fetch details from Zoho
      let detailsJson = null;
      let customerName = null;
      let salesorderNumber = null;
      let total = null;
      let currencyCode = 'INR';

      try {
        const orgId = getZohoOrgId();
        const accessToken = await getZohoTokens();
        if (orgId && accessToken) {
          const apiBase = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';
          const url = \`\${apiBase}/books/v3/salesorders/\${cleanId}?organization_id=\${orgId}\`;
          
          const response = await fetch(url, {
            headers: {
              'Authorization': \`Zoho-oauthtoken \${accessToken}\`,
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.salesorder) {
              detailsJson = data.salesorder;
              customerName = data.salesorder.customer_name;
              salesorderNumber = data.salesorder.salesorder_number;
              total = data.salesorder.total;
              currencyCode = data.salesorder.currency_code || 'INR';
            }
          }
        }
      } catch (zohoErr) {
        console.error('[Incoming SO API] Failed to fetch Zoho details:', zohoErr);
      }

      dispatchOrder = await prisma.dispatchIncomingOrder.create({
        data: {
          zohoSalesorderId: cleanId,
          salesorderNumber,
          customerName,
          total,
          currencyCode,
          zohoDetailsJson: detailsJson ? detailsJson : undefined
        }
      });
      
      // Emit SSE event
      dispatchEventEmitter.emit(DISPATCH_EVENTS.NEW_INCOMING_ORDER, dispatchOrder);
    } else {
      // Just update timestamp
      dispatchOrder = await prisma.dispatchIncomingOrder.update({
        where: { zohoSalesorderId: cleanId },
        data: { updatedAt: new Date() }
      });
    }

    return NextResponse.json(
      { success: true, isNew, message: 'Sales Order received successfully.' },
      { status: 200 }
    );
`;

content = content.replace(replaceBlock.trim(), newBlock.trim());

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated route.ts');
