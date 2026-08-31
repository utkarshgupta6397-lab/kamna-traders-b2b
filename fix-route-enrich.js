const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/api/dispatch/incoming-so/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Modify the 'else' block for existing records
const oldElse = `    } else {
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
    }`;

const newElse = `    } else {
      console.log(\`[INCOMING SO][\${requestId}] Existing record found. Retrying enrichment.\`);
      
      dispatchOrder = await prisma.dispatchIncomingOrder.update({
        where: { zohoSalesorderId: cleanId },
        data: { updatedAt: new Date() }
      });
      
      // Always re-trigger enrichment to heal incomplete records or refresh data
      enrichSalesOrder(cleanId, dispatchOrder.id, requestId).catch(console.error);

      return NextResponse.json(
        { 
          success: true, 
          message: 'Sales Order already exists. Details are being refreshed.',
          salesOrderId: cleanId,
          incomingOrderId: dispatchOrder.id,
          created: false
        },
        { status: 200 }
      );
    }`;

content = content.replace(oldElse, newElse);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Route fixed to retry enrichment.');
