const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/lib/zoho-sales-order-lock.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  `    if (!putResponse.ok) {
      updatedRecord = await prisma.dispatchIncomingOrder.update({
        where: { id: dbId },
        data: {
          zohoLockStatus: 'FAILED',
          zohoLockError: putError || 'PUT operation failed.'
        }
      });
      dispatchEventEmitter.emit(DISPATCH_EVENTS.UPDATE_INCOMING_ORDER, updatedRecord);
      return updatedRecord;
    }`,
  `    let lockStatusBeforeVerification = 'PENDING';
    if (!putResponse.ok) {
      lockStatusBeforeVerification = 'FAILED';
      updatedRecord = await prisma.dispatchIncomingOrder.update({
        where: { id: dbId },
        data: {
          zohoLockError: putError || 'PUT operation failed.'
        }
      });
    }`
);

fs.writeFileSync(file, content, 'utf8');
console.log('zoho-sales-order-lock.ts patched');
