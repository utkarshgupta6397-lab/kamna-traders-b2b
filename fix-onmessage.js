const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /eventSource\.onmessage = \(event\) => \{[\s\S]*?\} catch \(e\) \{[\s\S]*?\}\s*\};/;

const newOnMessage = `eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'new_order') {
            const order: DispatchIncomingOrder = data.order;
            
            if (!knownIdsRef.current.has(order.zohoSalesorderId)) {
              knownIdsRef.current.add(order.zohoSalesorderId);
              
              setOrders(prev => [order, ...prev]);
              
              setHighlightedRow(order.id);
              setTimeout(() => setHighlightedRow(null), 3000);

              const soNum = order.salesorderNumber || order.zohoSalesorderId;
              toast.success(\`New Sales Order Received\\n\${soNum} has been pushed to Dispatch.\`, {
                duration: 5000,
                icon: '📥',
              });

              if (audioRef.current) {
                audioRef.current.play().catch(e => {
                  console.warn('Audio play restricted by browser:', e);
                });
              }
            }
          } else if (data.type === 'update_order') {
            const order: DispatchIncomingOrder = data.order;
            setOrders(prev => prev.map(o => o.id === order.id ? order : o));
          }
        } catch (e) {
          console.error('[SSE] JSON parse error', e);
        }
      };`;

content = content.replace(regex, newOnMessage);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed onmessage');
