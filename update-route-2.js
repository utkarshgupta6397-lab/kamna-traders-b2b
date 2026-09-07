const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/api/dispatch/incoming-so/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the entire if (!existingEntry) block with the updated logic

const oldBlockRegex = /if \(!existingEntry\) \{[\s\S]*?\} else \{[\s\S]*?console\.log\(\`\[Incoming SO API\] \[\$\{requestId\}\] DB record updated with ID \$\{dispatchOrder\.id\}\`\);\s*\}/;

const newBlock = `if (!existingEntry) {
      isNew = true;
      console.log(\`[Incoming SO API] [\${requestId}] No existing DispatchIncomingOrder found. Fetching from Zoho.\`);
      
      let detailsJson = null;
      let customerName = null;
      let salesorderNumber = null;
      let total = null;
      let currencyCode = 'INR';
      let totalItems = 0;
      let totalTax = 0;

      try {
        const orgId = getZohoOrgId();
        const accessToken = await getZohoTokens();
        
        console.log(\`[Incoming SO API] [\${requestId}] Zoho OrgId: \${orgId ? 'Found' : 'Missing'}, AccessToken: \${accessToken ? 'Found' : 'Missing'}\`);
        
        if (!orgId || !accessToken) {
          throw new Error('Missing Zoho credentials');
        }

        const apiBase = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';
        const url = \`\${apiBase}/books/v3/salesorders/\${cleanId}?organization_id=\${orgId}\`;
        
        console.log(\`[Incoming SO API] [\${requestId}] Fetching Zoho Details from: \${url}\`);
        const response = await fetch(url, {
          headers: {
            'Authorization': \`Zoho-oauthtoken \${accessToken}\`,
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
           console.log(\`[Incoming SO API] [\${requestId}] Zoho fetch failed with status: \${response.status}\`);
           const errorText = await response.text().catch(() => '');
           throw new Error(\`Zoho fetch failed: \${response.status} \${errorText}\`);
        }

        const data = await response.json();
        console.log(\`[Incoming SO API] [\${requestId}] Zoho fetch successful.\`);
        if (!data.salesorder) {
           throw new Error('Sales Order not found in Zoho response');
        }

        detailsJson = data.salesorder;
        customerName = data.salesorder.customer_name;
        salesorderNumber = data.salesorder.salesorder_number;
        total = data.salesorder.total;
        currencyCode = data.salesorder.currency_code || 'INR';
        
        // Calculate Total Items and Total Tax
        totalTax = data.salesorder.tax_total !== undefined ? data.salesorder.tax_total : (data.salesorder.total_tax || 0);
        
        if (Array.isArray(data.salesorder.line_items)) {
          totalItems = data.salesorder.line_items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        }

      } catch (zohoErr) {
        console.error(\`[Incoming SO API] [\${requestId}] Failed to fetch Zoho details:\`, zohoErr);
        
        // Log failure to incoming logs
        await prisma.incomingSoRequest.create({
          data: {
            salesorder_id: cleanId,
            status: 'FAILED',
            error_message: zohoErr.message || 'Failed to enrich Sales Order from Zoho',
          },
        });

        // Fail hard. Do not create a fake/empty record.
        return NextResponse.json(
          { success: false, error: 'Failed to enrich Sales Order from Zoho Books', requestId },
          { status: 502 }
        );
      }

      console.log(\`[Incoming SO API] [\${requestId}] Creating DB record for \${cleanId}\`);
      dispatchOrder = await prisma.dispatchIncomingOrder.create({
        data: {
          zohoSalesorderId: cleanId,
          salesorderNumber,
          customerName,
          total,
          currencyCode,
          totalItems,
          totalTax,
          status: 'NEW',
          zohoDetailsJson: detailsJson ? detailsJson : undefined
        }
      });
      console.log(\`[Incoming SO API] [\${requestId}] DB record created with ID \${dispatchOrder.id}\`);
      
      // Emit SSE event
      console.log(\`[Incoming SO API] [\${requestId}] Emitting NEW_INCOMING_ORDER event\`);
      dispatchEventEmitter.emit(DISPATCH_EVENTS.NEW_INCOMING_ORDER, dispatchOrder);
      
      console.log(\`[Incoming SO API] [\${requestId}] Request processing complete. Returning success.\`);
      return NextResponse.json(
        { 
          success: true, 
          isNew: true, 
          action: 'created',
          dispatchEntryId: dispatchOrder.id,
          salesorderId: cleanId,
          requestId,
          message: 'Sales Order received and enriched successfully.' 
        },
        { status: 200 }
      );
      
    } else {
      console.log(\`[Incoming SO API] [\${requestId}] Existing DispatchIncomingOrder found. Updating timestamp.\`);
      isNew = false;
      // Just update timestamp
      dispatchOrder = await prisma.dispatchIncomingOrder.update({
        where: { zohoSalesorderId: cleanId },
        data: { updatedAt: new Date() }
      });
      console.log(\`[Incoming SO API] [\${requestId}] DB record updated with ID \${dispatchOrder.id}\`);
      
      // Return a specific idempotent success response for duplicates
      return NextResponse.json(
        { 
          success: true, 
          isNew: false, 
          action: 'existing',
          dispatchEntryId: dispatchOrder.id,
          salesorderId: cleanId,
          requestId,
          message: 'Sales Order already exists in Incoming Dispatch queue.' 
        },
        { status: 200 }
      );
    }`;

content = content.replace(oldBlockRegex, newBlock);

// Remove the old return NextResponse.json at the bottom since we moved it into the if/else blocks
const trailingReturnRegex = /return NextResponse\.json\(\s*\{\s*success: true,[\s\S]*?\{\s*status: 200\s*\}\s*\);/;
content = content.replace(trailingReturnRegex, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Route updated.');
