import fs from 'fs';

const filePath = 'src/app/staff/dashboard/accounts/dcr/customer-lookup/CustomerLookupClient.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add getActionLabel method right after getWorkflowBadge
const getActionLabelFunc = `  const getActionLabel = (inv: any) => {
    if (inv.displayStatus === 'UNPROCESSED') return 'Review Invoice';
    if (inv.displayStatus === 'SERIAL ENTRY PENDING') return 'Enter Serials';
    if (inv.displayStatus === 'VENDOR DCR PENDING') return 'Import DCR';
    if (inv.displayStatus === 'HOLD QUEUE') return 'Review Hold';
    if (inv.displayStatus === 'READY TO ISSUE') return 'Issue DCR';
    if (inv.displayStatus === 'FULLY ISSUED') return 'View Issued';
    if (inv.displayStatus === 'PROCESSED - NO DCR REQUIRED') return 'View Invoice';
    if (inv.displayStatus === 'DCR IDENTIFIED') return 'Review Invoice';
    return 'Open Workflow';
  };
`;

content = content.replace(
  `const getWorkflowBadge = (inv: any) => {`,
  getActionLabelFunc + '\n  const getWorkflowBadge = (inv: any) => {'
);

// 2. Add Actions header
const issuedHeader = `<th className="px-3 py-2 font-semibold uppercase text-center w-20">Issued</th>`;
const actionsHeader = `<th className="px-3 py-2 font-semibold uppercase text-center w-32">Actions</th>`;

content = content.replace(
  issuedHeader + `
                    
                    
                  </tr>`,
  issuedHeader + '\n                    ' + actionsHeader + `
                  </tr>`
);

// 3. Replace the duplicate status td with Action button td
const oldTd = `<td className="px-3 py-2 text-center align-middle whitespace-nowrap">
                        <span className={\`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border \${
                          inv.displayStatus === 'FULLY ISSUED' ? 'bg-green-50 text-green-600 border-green-200' :
                          inv.displayStatus === 'PROCESSED - NO DCR REQUIRED' ? 'bg-gray-100 text-gray-600 border-gray-300' :
                          inv.displayStatus === 'UNPROCESSED' ? 'bg-red-50 text-red-600 border-red-200' :
                          'bg-orange-50 text-orange-600 border-orange-200'
                        }\`}>
                          {inv.displayStatus}
                        </span>
                      </td>`;

const newTd = `<td className="px-3 py-2 text-center align-middle whitespace-nowrap">
                        <a 
                          href={getWorkflowUrl(inv)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded text-[11px] font-semibold shadow-sm transition-colors w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {getActionLabel(inv)}
                        </a>
                      </td>`;

content = content.replace(oldTd, newTd);

fs.writeFileSync(filePath, content);
console.log('Customer Lookup actions fixed successfully.');
