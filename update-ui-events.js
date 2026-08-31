const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Update UI fallback values (Unknown Customer, NaN -> -, etc.)
// First, let's fix the eventSource.onmessage block
const oldOnMessage = `      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'new_order') {
            const order: DispatchIncomingOrder = data.order;
            
            // Check for duplicates
            if (!knownIdsRef.current.has(order.zohoSalesorderId)) {
              knownIdsRef.current.add(order.zohoSalesorderId);
              
              // Add to state at the top
              setOrders(prev => [order, ...prev]);
              
              // Highlight animation
              setHighlightId(order.id);
              setTimeout(() => setHighlightId(null), 3000);
              
              // Show toast
              toast.success(\`New Order Received: \${order.salesorderNumber || order.zohoSalesorderId}\`);
              
              // Play bell sound once
              if (audioRef.current) {
                audioRef.current.play().catch(e => console.warn('Audio play blocked:', e));
              }
            }
          }
        } catch (e) {
          console.error('[SSE] JSON parse error', e);
        }
      };`;

const newOnMessage = `      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'new_order') {
            const order: DispatchIncomingOrder = data.order;
            
            // Check for duplicates
            if (!knownIdsRef.current.has(order.zohoSalesorderId)) {
              knownIdsRef.current.add(order.zohoSalesorderId);
              
              // Add to state at the top
              setOrders(prev => [order, ...prev]);
              
              // Highlight animation
              setHighlightId(order.id);
              setTimeout(() => setHighlightId(null), 3000);
              
              // Show toast
              toast.success(\`New Order Received: \${order.salesorderNumber || order.zohoSalesorderId}\`);
              
              // Play bell sound once
              if (audioRef.current) {
                audioRef.current.play().catch(e => console.warn('Audio play blocked:', e));
              }
            }
          } else if (data.type === 'update_order') {
            const order: DispatchIncomingOrder = data.order;
            // Update existing order in place
            setOrders(prev => prev.map(o => o.id === order.id ? order : o));
          }
        } catch (e) {
          console.error('[SSE] JSON parse error', e);
        }
      };`;

content = content.replace(oldOnMessage, newOnMessage);

// Update table render fallbacks
// Customer Name fallback
content = content.replace(/\{order\.customerName \|\| '-'\}/g, "{order.customerName || 'Unknown Customer'}");
// Sales Order Number fallback
content = content.replace(/\{order\.salesorderNumber \|\| '-'\}/g, "{order.salesorderNumber || `ID: ${order.zohoSalesorderId}`}");

// Replace previous rendering logic if it was using different fallbacks
fs.writeFileSync(filePath, content, 'utf8');
console.log('UI events updated.');
