import fs from 'fs';

const filePath = 'src/app/staff/dashboard/accounts/dcr/customer-lookup/CustomerLookupClient.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// CHANGE 1 & 4: Simplify Customer Header KPIs
const oldKpiRow = `<div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">DCR Panels:</span>
                    <span className="font-bold text-gray-900">{summary?.summary?.kpis?.dcrPanels || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">Vendor Pending:</span>
                    <span className="font-bold text-orange-600">{summary?.summary?.kpis?.vendorDcrPending || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">On Hold:</span>
                    <span className="font-bold text-red-600">{summary?.summary?.kpis?.onHold || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">Ready:</span>
                    <span className="font-bold text-teal-600">{summary?.summary?.kpis?.readyToIssue || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">Issued:</span>
                    <span className="font-bold text-green-600">{summary?.summary?.kpis?.issued || 0}</span>
                  </div>`;

const newKpiRow = `<div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">DCR Invoices:</span>
                    <span className="font-bold text-[#1A2766]">{summary?.dcrRequiredInvoices?.length || 0}</span>
                  </div>`;

content = content.replace(oldKpiRow, newKpiRow);

// CHANGE 3: Hide DCR Required Summary if filteredDcrRequired.length === 0
const oldSectionA = `<div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h3 className="font-bold text-[#1A2766] text-sm mb-3 flex items-center gap-2">
              DCR Required Summary (Filtered)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg shadow-sm">
                <div className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">DCR Panels</div>
                <div className="text-lg font-extrabold text-blue-900 mt-1">{dynamicTotals.dcrPanels}</div>
              </div>
              <div className="bg-orange-50/50 border border-orange-100 p-3 rounded-lg shadow-sm">
                <div className="text-[10px] uppercase font-bold text-orange-700 tracking-wider">Serial Pending</div>
                <div className="text-lg font-extrabold text-orange-950 mt-1">{dynamicTotals.serialEntryPending}</div>
              </div>
              <div className="bg-yellow-50/50 border border-yellow-100 p-3 rounded-lg shadow-sm">
                <div className="text-[10px] uppercase font-bold text-yellow-700 tracking-wider">Vendor Pending</div>
                <div className="text-lg font-extrabold text-yellow-950 mt-1">{dynamicTotals.vendorDcrPending}</div>
              </div>
              <div className="bg-red-50/50 border border-red-100 p-3 rounded-lg shadow-sm">
                <div className="text-[10px] uppercase font-bold text-red-700 tracking-wider">On Hold</div>
                <div className="text-lg font-extrabold text-red-950 mt-1">{dynamicTotals.onHold}</div>
              </div>
              <div className="bg-teal-50/50 border border-teal-100 p-3 rounded-lg shadow-sm">
                <div className="text-[10px] uppercase font-bold text-teal-700 tracking-wider">Ready to Issue</div>
                <div className="text-lg font-extrabold text-teal-950 mt-1">{dynamicTotals.readyToIssue}</div>
              </div>
              <div className="bg-green-50/50 border border-green-100 p-3 rounded-lg shadow-sm">
                <div className="text-[10px] uppercase font-bold text-green-700 tracking-wider">Issued</div>
                <div className="text-lg font-extrabold text-green-950 mt-1">{dynamicTotals.issued}</div>
              </div>
            </div>
          </div>`;

const newSectionA = `<div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h3 className="font-bold text-[#1A2766] text-sm mb-3 flex items-center gap-2">
              DCR Required Summary (Filtered)
            </h3>
            {filteredDcrRequired.length === 0 ? (
              <div className="py-6 text-center text-gray-500 italic bg-gray-50 rounded-lg border border-gray-100">
                No DCR-required invoices found for current filters.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg shadow-sm">
                  <div className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">DCR Panels</div>
                  <div className="text-lg font-extrabold text-blue-900 mt-1">{dynamicTotals.dcrPanels}</div>
                </div>
                <div className="bg-orange-50/50 border border-orange-100 p-3 rounded-lg shadow-sm">
                  <div className="text-[10px] uppercase font-bold text-orange-700 tracking-wider">Serial Pending</div>
                  <div className="text-lg font-extrabold text-orange-950 mt-1">{dynamicTotals.serialEntryPending}</div>
                </div>
                <div className="bg-yellow-50/50 border border-yellow-100 p-3 rounded-lg shadow-sm">
                  <div className="text-[10px] uppercase font-bold text-yellow-700 tracking-wider">Vendor Pending</div>
                  <div className="text-lg font-extrabold text-yellow-950 mt-1">{dynamicTotals.vendorDcrPending}</div>
                </div>
                <div className="bg-red-50/50 border border-red-100 p-3 rounded-lg shadow-sm">
                  <div className="text-[10px] uppercase font-bold text-red-700 tracking-wider">On Hold</div>
                  <div className="text-lg font-extrabold text-red-950 mt-1">{dynamicTotals.onHold}</div>
                </div>
                <div className="bg-teal-50/50 border border-teal-100 p-3 rounded-lg shadow-sm">
                  <div className="text-[10px] uppercase font-bold text-teal-700 tracking-wider">Ready to Issue</div>
                  <div className="text-lg font-extrabold text-teal-950 mt-1">{dynamicTotals.readyToIssue}</div>
                </div>
                <div className="bg-green-50/50 border border-green-100 p-3 rounded-lg shadow-sm">
                  <div className="text-[10px] uppercase font-bold text-green-700 tracking-wider">Issued</div>
                  <div className="text-lg font-extrabold text-green-950 mt-1">{dynamicTotals.issued}</div>
                </div>
              </div>
            )}
          </div>`;

content = content.replace(oldSectionA, newSectionA);

fs.writeFileSync(filePath, content);
console.log('Successfully updated KPIs!');
