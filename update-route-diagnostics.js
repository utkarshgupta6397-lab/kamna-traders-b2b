const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/api/dispatch/incoming-so/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// We will replace the entire POST function to add proper diagnostics.

const newPost = `
export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(2, 9);
  console.log(\`[Incoming SO API] [\${requestId}] Request received at \${new Date().toISOString()}\`);

  try {
    const apiKey = request.headers.get('x-api-key');
    
    // Check DB first
    const dbConfig = await prisma.integrationConfig.findUnique({
      where: { key: 'INCOMING_SO_API_KEY' }
    });
    
    const configuredKey = dbConfig?.value || process.env.INCOMING_SO_API_KEY;

    if (!configuredKey || apiKey !== configuredKey) {
      console.log(\`[Incoming SO API] [\${requestId}] Authentication failed. Key provided: \${apiKey ? 'Yes' : 'No'}\`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Invalid or missing API Key.', requestId },
        { status: 401 }
      );
    }

    console.log(\`[Incoming SO API] [\${requestId}] Authentication successful.\`);

    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.log(\`[Incoming SO API] [\${requestId}] JSON parse failed.\`);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body.', requestId },
        { status: 400 }
      );
    }

    if (body.test_connection === true) {
      console.log(\`[Incoming SO API] [\${requestId}] Test connection successful.\`);
      return NextResponse.json(
        { success: true, message: 'Connection test successful. API is reachable and authenticated.', requestId },
        { status: 200 }
      );
    }

    const { salesorder_id } = body;
    console.log(\`[Incoming SO API] [\${requestId}] Parsed salesorder_id: \${salesorder_id}\`);

    if (!salesorder_id || typeof salesorder_id !== 'string' || salesorder_id.trim() === '') {
      console.log(\`[Incoming SO API] [\${requestId}] Missing or invalid salesorder_id.\`);
      try {
        await prisma.incomingSoRequest.create({
          data: {
            salesorder_id: 'UNKNOWN',
            status: 'FAILED',
            error_message: 'Missing or invalid salesorder_id',
          },
        });
      } catch (dbErr) {
        console.error(\`[Incoming SO API] [\${requestId}] DB logging failed:\`, dbErr);
      }
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
    console.log(\`[Incoming SO API] [\${requestId}] Cleaned salesorder_id: \${cleanId}\`);

    // Check if it already exists
    const existingEntry = await prisma.dispatchIncomingOrder.findUnique({
      where: { zohoSalesorderId: cleanId }
    });

    let isNew = false;
    let dispatchOrder;

    if (!existingEntry) {
      isNew = true;
      console.log(\`[Incoming SO API] [\${requestId}] No existing DispatchIncomingOrder found. Creating new.\`);
      
      // Fetch details from Zoho
      let detailsJson = null;
      let customerName = null;
      let salesorderNumber = null;
      let total = null;
      let currencyCode = 'INR';

      try {
        const orgId = getZohoOrgId();
        const accessToken = await getZohoTokens();
        
        console.log(\`[Incoming SO API] [\${requestId}] Zoho OrgId: \${orgId ? 'Found' : 'Missing'}, AccessToken: \${accessToken ? 'Found' : 'Missing'}\`);
        
        if (orgId && accessToken) {
          const apiBase = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';
          const url = \`\${apiBase}/books/v3/salesorders/\${cleanId}?organization_id=\${orgId}\`;
          
          console.log(\`[Incoming SO API] [\${requestId}] Fetching Zoho Details from: \${url}\`);
          const response = await fetch(url, {
            headers: {
              'Authorization': \`Zoho-oauthtoken \${accessToken}\`,
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log(\`[Incoming SO API] [\${requestId}] Zoho fetch successful.\`);
            if (data.salesorder) {
              detailsJson = data.salesorder;
              customerName = data.salesorder.customer_name;
              salesorderNumber = data.salesorder.salesorder_number;
              total = data.salesorder.total;
              currencyCode = data.salesorder.currency_code || 'INR';
            }
          } else {
             console.log(\`[Incoming SO API] [\${requestId}] Zoho fetch failed with status: \${response.status}\`);
             const errorText = await response.text().catch(() => '');
             console.log(\`[Incoming SO API] [\${requestId}] Zoho fetch error text: \${errorText}\`);
          }
        }
      } catch (zohoErr) {
        console.error(\`[Incoming SO API] [\${requestId}] Failed to fetch Zoho details:\`, zohoErr);
      }

      console.log(\`[Incoming SO API] [\${requestId}] Creating DB record for \${cleanId}\`);
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
      console.log(\`[Incoming SO API] [\${requestId}] DB record created with ID \${dispatchOrder.id}\`);
      
      // Emit SSE event
      console.log(\`[Incoming SO API] [\${requestId}] Emitting NEW_INCOMING_ORDER event\`);
      dispatchEventEmitter.emit(DISPATCH_EVENTS.NEW_INCOMING_ORDER, dispatchOrder);
    } else {
      console.log(\`[Incoming SO API] [\${requestId}] Existing DispatchIncomingOrder found. Updating timestamp.\`);
      isNew = false;
      // Just update timestamp
      dispatchOrder = await prisma.dispatchIncomingOrder.update({
        where: { zohoSalesorderId: cleanId },
        data: { updatedAt: new Date() }
      });
      console.log(\`[Incoming SO API] [\${requestId}] DB record updated with ID \${dispatchOrder.id}\`);
    }

    console.log(\`[Incoming SO API] [\${requestId}] Request processing complete. Returning success.\`);
    return NextResponse.json(
      { 
        success: true, 
        isNew, 
        action: isNew ? 'created' : 'updated',
        dispatchEntryId: dispatchOrder.id,
        salesorderId: cleanId,
        requestId,
        message: 'Sales Order received successfully.' 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(\`[Incoming SO API] [\${requestId}] Unhandled error:\`, error);
    
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
      console.error(\`[Incoming SO API] [\${requestId}] Fatal DB logging failed:\`, dbErr);
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error.', requestId },
      { status: 500 }
    );
  }
}
`;

const postRegex = /export async function POST\(request: Request\) {[\s\S]*$/;
content = content.replace(postRegex, newPost.trim());

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated route.ts with diagnostics');
