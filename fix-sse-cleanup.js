const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldEffect = `  useEffect(() => {
    let eventSource: EventSource;

    const connectSSE = () => {
      eventSource = new EventSource('/api/dispatch/incoming-queue/events');
      
      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.onerror = (err) => {
        console.error('[SSE] Error:', err);
        setSseConnected(false);
        eventSource.close();
        // Reconnect after 5s
        setTimeout(connectSSE, 5000);
      };

      eventSource.onmessage = (event) => {`;

const newEffect = `  useEffect(() => {
    let eventSource: EventSource;
    let reconnectTimeout: NodeJS.Timeout;
    let isUnmounted = false;

    const connectSSE = () => {
      if (isUnmounted) return;
      
      eventSource = new EventSource('/api/dispatch/incoming-queue/events');
      
      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.onerror = (err) => {
        // Only log if it's not a generic disconnect
        if (eventSource.readyState === EventSource.CLOSED) {
          // Normal disconnect (e.g. server restart)
        } else {
          console.error('[SSE] Error:', err);
        }
        
        setSseConnected(false);
        eventSource.close();
        
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connectSSE, 5000);
        }
      };

      eventSource.onmessage = (event) => {`;

content = content.replace(oldEffect, newEffect);

const oldCleanup = `    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);`;

const newCleanup = `    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);`;

content = content.replace(oldCleanup, newCleanup);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Cleaned up SSE effect.');
