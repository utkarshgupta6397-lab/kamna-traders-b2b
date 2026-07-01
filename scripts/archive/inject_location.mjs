import fs from 'fs';

const dcrClientPath = 'src/app/staff/dashboard/accounts/dcr/DcrClient.tsx';
let dcrContent = fs.readFileSync(dcrClientPath, 'utf8');

const dateHeaderEnd = `                    </div>
                  </th>`;
const customerHeader = `<th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider border-b border-gray-200">Customer</th>`;

dcrContent = dcrContent.replace(
  dateHeaderEnd + '\n                  ' + customerHeader,
  dateHeaderEnd + '\n                  <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider border-b border-gray-200 w-28">Location</th>\n                  ' + customerHeader
);

const dateCell = `<td className="px-4 py-3 text-gray-600 text-xs align-middle">{new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>`;
const customerCell = `<td className="px-4 py-3 text-gray-800 text-xs align-middle leading-snug whitespace-normal break-words">{inv.customerName}</td>`;
const locationCell = `<td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-gray-50 text-gray-600 border-gray-200">
                            {inv.location || inv.branch || inv.placeOfSupply || 'N/A'}
                          </span>
                        </td>`;

dcrContent = dcrContent.replace(
  dateCell + '\n                        ' + customerCell,
  dateCell + '\n                        ' + locationCell + '\n                        ' + customerCell
);

// Also update the skeleton colSpan if necessary. Wait, skeleton has 7 columns currently. We need to add one.
dcrContent = dcrContent.replace(
  `<td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>\n                        <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>`,
  `<td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>\n                        <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-12 mx-auto"></div></td>\n                        <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>`
);

// update colspan
dcrContent = dcrContent.replace(`colSpan={7}`, `colSpan={8}`);

fs.writeFileSync(dcrClientPath, dcrContent);

const reviewPath = 'src/app/staff/dashboard/accounts/dcr/review/[id]/ReviewClient.tsx';
let reviewContent = fs.readFileSync(reviewPath, 'utf8');

// Modify ReviewClient grid from grid-cols-2 md:grid-cols-4 to grid-cols-2 md:grid-cols-5
reviewContent = reviewContent.replace(
  `grid grid-cols-2 md:grid-cols-4 gap-6`,
  `grid grid-cols-2 md:grid-cols-5 gap-6`
);

const customerReviewDiv = `<div>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Customer Name</span>
            <span className="text-sm font-medium text-gray-900">{invoice.customerName}</span>
          </div>`;

const locationReviewDiv = `<div>
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Location</span>
            <span className="text-sm font-medium text-gray-900">{invoice.location || invoice.branch || invoice.placeOfSupply || 'N/A'}</span>
          </div>`;

reviewContent = reviewContent.replace(
  customerReviewDiv,
  customerReviewDiv + '\n          ' + locationReviewDiv
);

fs.writeFileSync(reviewPath, reviewContent);
console.log('Location column injected.');
