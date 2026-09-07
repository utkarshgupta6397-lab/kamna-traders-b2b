const fs = require('fs');
const path = require('path');

// 1. Fix IncomingQueueClient.tsx
const clientFile = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let clientContent = fs.readFileSync(clientFile, 'utf8');

clientContent = clientContent.replace(
  /eventSource\.onerror = \(err\) => \{[\s\S]*?reconnectTimeout = setTimeout\(connectSSE, 5000\);\n\s*\};/,
  `eventSource.onerror = () => {
        setSseConnected(false);
        eventSource.close();
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connectSSE, 5000);
        }
      };`
);
fs.writeFileSync(clientFile, clientContent, 'utf8');

// 2. Fix GlobalDispatchNotifier.tsx
const notifierFile = path.join(__dirname, 'src/components/GlobalDispatchNotifier.tsx');
let notifierContent = fs.readFileSync(notifierFile, 'utf8');

notifierContent = notifierContent.replace(
  /eventSource\.onerror = \(err\) => \{[\s\S]*?if \(!isUnmounted\) \{\n\s*reconnectTimeout = setTimeout\(connectSSE, 5000\);\n\s*\}\n\s*\};/,
  `eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
        }
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connectSSE, 5000);
        }
      };`
);
fs.writeFileSync(notifierFile, notifierContent, 'utf8');

console.log('Fixed SSE error handling.');
