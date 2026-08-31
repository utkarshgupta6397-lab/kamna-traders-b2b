const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(file, 'utf8');

const handler = `
  const handleManualFetch = async (id: string) => {
    try {
      setFetchingIds(prev => new Set(prev).add(id));
      const response = await fetch(\`/api/dispatch/incoming-queue/\${id}/fetch\`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to fetch details');
      
      const updatedOrder = await response.json();
      setOrders(prev => prev.map(o => o.id === id ? updatedOrder : o));
      toast.success('Order details fetched successfully');
    } catch (err: any) {
      toast.error(err.message || 'Fetch failed');
    } finally {
      setFetchingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (`;

content = content.replace('  return (', handler);
fs.writeFileSync(file, content, 'utf8');
console.log('Added handleManualFetch');
