import fs from 'fs';

const filePath = 'src/app/staff/dashboard/accounts/dcr/review/[id]/ReviewClient.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add ChevronRight import
content = content.replace(/import \{ ([^}]+) \} from 'lucide-react';/, "import { $1, ChevronRight } from 'lucide-react';");

// 2. Add skip mode to submissionMode type
content = content.replace(/setSubmissionMode\] = useState<'save' \| 'saveNext' \| 'noDcr' \| null>\(null\);/, "setSubmissionMode] = useState<'save' | 'saveNext' | 'noDcr' | 'skip' | null>(null);");

// 3. Inject executeSkipInvoice method
const executeSkipDcrMethod = `  const executeSkipDcr = async () => {`;
const skipInvoiceMethod = `  const executeSkipInvoice = async () => {
    try {
      setSubmissionMode('skip');
      
      const queueRes = await fetch(\`/api/admin/dcr/invoices?\${currentParamsString}\`);
      const queueData = await queueRes.json();
      
      let nextInvoiceId = null;
      if (queueData.invoices && queueData.invoices.length > 0) {
        const nextInvoice = queueData.invoices.find((inv: any) => inv.id !== invoiceId && ['NEW', 'UNDER_REVIEW'].includes(inv.dcrStatus));
        if (nextInvoice) {
          nextInvoiceId = nextInvoice.id;
        }
      }

      if (nextInvoiceId) {
        router.replace(\`/staff/dashboard/accounts/dcr/review/\${nextInvoiceId}?\${currentParamsString}\`);
      } else {
        toast.success('No more invoices in queue');
        if (searchParams.get('source') === 'customer_lookup') {
          window.close();
        } else {
          router.push(\`/staff/dashboard/accounts/dcr?\${currentParamsString}\`);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to skip invoice');
    } finally {
      if (submissionMode === 'skip') {
        setSubmissionMode(null);
      }
    }
  };

  const executeSkipDcr = async () => {`;
content = content.replace(executeSkipDcrMethod, skipInvoiceMethod);

// 4. Inject Skip Invoice button into the UI
const noDcrButton = `<button
              onClick={() => setShowSkipModal(true)}
              disabled={submissionMode !== null}
              className="bg-white border-2 border-red-500 text-red-600 px-8 py-3 rounded-lg font-bold shadow-sm hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center gap-2"
            >`;
const skipInvoiceButton = `<button
              onClick={() => setShowSkipModal(true)}
              disabled={submissionMode !== null}
              className="bg-white border-2 border-red-500 text-red-600 px-8 py-3 rounded-lg font-bold shadow-sm hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center gap-2"
            >`;

// Wait, the button block is in a flex container. I can replace the `<button ... setShowSkipModal(true)...` with `[SKIP BUTTON] \n [NO DCR BUTTON]`.
const skipBtnStr = `            <button
              onClick={executeSkipInvoice}
              disabled={submissionMode !== null}
              className="bg-amber-500 text-white px-8 py-3 rounded-lg font-bold shadow-md hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center gap-2"
            >
              {submissionMode === 'skip' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Skipping...</span>
                </>
              ) : (
                <>
                  <span>Skip Invoice</span>
                  <ChevronRight size={18} className="-mr-1" />
                </>
              )}
            </button>
            <button
              onClick={() => setShowSkipModal(true)}
              disabled={submissionMode !== null}
              className="bg-white border-2 border-red-500 text-red-600 px-8 py-3 rounded-lg font-bold shadow-sm hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center gap-2"
            >`;

content = content.replace(noDcrButton, skipBtnStr);

fs.writeFileSync(filePath, content);
console.log('Skip Invoice implemented successfully.');
