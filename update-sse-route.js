const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/api/dispatch/incoming-queue/events/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// We need to add a listener for UPDATE_INCOMING_ORDER

const oldListener = `      // Listener for new orders
      const onNewOrder = (order: any) => {
        sendEvent({ type: 'new_order', order });
      };

      dispatchEventEmitter.on(DISPATCH_EVENTS.NEW_INCOMING_ORDER, onNewOrder);

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        dispatchEventEmitter.off(DISPATCH_EVENTS.NEW_INCOMING_ORDER, onNewOrder);
        controller.close();
      });`;

const newListener = `      // Listener for new orders
      const onNewOrder = (order: any) => {
        sendEvent({ type: 'new_order', order });
      };

      const onUpdateOrder = (order: any) => {
        sendEvent({ type: 'update_order', order });
      };

      dispatchEventEmitter.on(DISPATCH_EVENTS.NEW_INCOMING_ORDER, onNewOrder);
      dispatchEventEmitter.on(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, onUpdateOrder);

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        dispatchEventEmitter.off(DISPATCH_EVENTS.NEW_INCOMING_ORDER, onNewOrder);
        dispatchEventEmitter.off(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, onUpdateOrder);
        controller.close();
      });`;

content = content.replace(oldListener, newListener);

fs.writeFileSync(filePath, content, 'utf8');
console.log('SSE route updated.');
