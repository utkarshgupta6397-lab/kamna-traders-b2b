import fs from 'fs';

const filePath = 'src/app/staff/dashboard/accounts/dcr/customer-lookup/CustomerLookupClient.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace getProcessingStatusBadge definition
const oldBadgeDef = `  const getProcessingStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-green-50 text-green-700 border-green-200">COMPLETED</span>;
      case 'NO_DCR_REQUIRED': return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-gray-100 text-gray-600 border-gray-300">NO DCR REQUIRED</span>;
      case 'DCR_IDENTIFIED': return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-700 border-blue-200">DCR IDENTIFIED</span>;
      case 'IN_PROGRESS': return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-orange-50 text-orange-700 border-orange-200">IN PROGRESS</span>;
      case 'NOT_REVIEWED': return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-red-50 text-red-700 border-red-200">NOT REVIEWED</span>;
      default: return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-gray-50 text-gray-700 border-gray-200">{status}</span>;
    }
  };`;

const newBadgeDef = `  const getWorkflowUrl = (inv: any) => {
    if (inv.displayStatus === 'FULLY ISSUED') return \`/staff/dashboard/accounts/dcr/serial-registry?source=customer_lookup\`;
    if (inv.displayStatus === 'READY TO ISSUE') return \`/staff/dashboard/accounts/dcr/ready-to-issue?source=customer_lookup\`;
    if (inv.displayStatus === 'HOLD QUEUE') return \`/staff/dashboard/accounts/dcr/hold-queue?source=customer_lookup\`;
    if (inv.displayStatus === 'SERIAL ENTRY PENDING' || inv.displayStatus === 'VENDOR DCR PENDING') return \`/staff/dashboard/accounts/dcr/pending-serials/\${inv.id}?source=customer_lookup\`;
    return \`/staff/dashboard/accounts/dcr/review/\${inv.zohoInvoiceId}?source=customer_lookup\`;
  };

  const getWorkflowBadge = (inv: any) => {
    let colorClass = 'bg-gray-50 text-gray-700 border-gray-200';
    if (inv.displayStatus === 'FULLY ISSUED') colorClass = 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100';
    else if (inv.displayStatus === 'READY TO ISSUE') colorClass = 'bg-teal-50 text-teal-600 border-teal-200 hover:bg-teal-100';
    else if (inv.displayStatus === 'HOLD QUEUE') colorClass = 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100';
    else if (inv.displayStatus === 'SERIAL ENTRY PENDING' || inv.displayStatus === 'VENDOR DCR PENDING') colorClass = 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100';
    else if (inv.displayStatus === 'UNPROCESSED') colorClass = 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100';
    else if (inv.displayStatus === 'PROCESSED - NO DCR REQUIRED') colorClass = 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200';
    else if (inv.displayStatus === 'DCR IDENTIFIED') colorClass = 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100';

    return (
      <a 
        href={getWorkflowUrl(inv)}
        target="_blank"
        rel="noopener noreferrer"
        title="Open workflow"
        className={\`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-colors inline-block text-center whitespace-nowrap \${colorClass}\`}
        onClick={(e) => e.stopPropagation()}
      >
        {inv.displayStatus}
      </a>
    );
  };`;
content = content.replace(oldBadgeDef, newBadgeDef);

// 2. Remove "Status" & "Actions" from table headers
content = content.replace(/<th[^>]*>Status<\/th>/g, '');
content = content.replace(/<th[^>]*>Actions<\/th>/g, '');

// 3. Update Invoice Number to be clickable
content = content.replace(/<td className="px-3 py-2 font-bold text-\[\#1A2766\] align-middle whitespace-nowrap sticky left-0 bg-white group-hover:bg-\[\#f0f4fa\] transition-colors z-10 border-r border-gray-200 shadow-\[2px_0_5px_rgba\(0,0,0,0\.05\)\]">\{inv\.invoiceNumber\}<\/td>/g, 
  `<td className="px-3 py-2 font-bold text-[#1A2766] align-middle whitespace-nowrap sticky left-0 bg-white group-hover:bg-[#f0f4fa] transition-colors z-10 border-r border-gray-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)]"><a href={getWorkflowUrl(inv)} target="_blank" rel="noopener noreferrer" className="hover:underline" title="Open workflow" onClick={e => e.stopPropagation()}>{inv.invoiceNumber}</a></td>`);

// 4. Update the processing status render to getWorkflowBadge
content = content.replace(/\{getProcessingStatusBadge\(inv\.processingStatus\)\}/g, '{getWorkflowBadge(inv)}');

// 5. Remove the "Status" column render
const statusColumnRegex = /<td className="px-3 py-2 text-center align-middle whitespace-nowrap">\s*<span className=\{\`px-1\.5 py-0\.5 rounded text-\[9px\] font-bold uppercase tracking-wider border[^{]*\`\}>\s*\{inv\.displayStatus\}\s*<\/span>\s*<\/td>/g;
content = content.replace(statusColumnRegex, '');

// 6. Remove the "Actions" column render (View button)
const actionsColumnRegex = /<td className="px-3 py-2 text-center align-middle sticky right-0 z-10 bg-white group-hover:bg-\[\#f0f4fa\] transition-colors border-l border-gray-100 shadow-\[-4px_0_6px_-1px_rgba\(0,0,0,0\.05\)\]">\s*<button onClick=\{[^}]+\} className="text-\[\#1A2766\] bg-blue-50 px-2 py-1 rounded text-xs font-semibold hover:bg-blue-100 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100">View<\/button>\s*<\/td>/g;
content = content.replace(actionsColumnRegex, '');

// 7. Update Modal header badge
content = content.replace(/\{getProcessingStatusBadge\(activeInvoice\.processingStatus\)\}/g, '{getWorkflowBadge(activeInvoice)}');

fs.writeFileSync(filePath, content);
console.log('CustomerLookupClient refactored!');
