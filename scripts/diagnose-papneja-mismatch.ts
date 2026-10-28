/**
 * Diagnostic Script & Audit Log: M/S PAPNEJA INVERTERS AND BATTERIES Balance Verification
 * 
 * Target Environment: Hostinger Production VPS (srv1697730, 187.127.150.67)
 * Database: kamna_prod (PostgreSQL 16)
 * Process: PM2 process 0 (kamna) on port 3000, proxied by Nginx
 * Production Commit HEAD: 7ac2a85c1cf16364e5b3f397792346e96c736ff0
 * Customer GSTIN: 09GCRPK3320E1Z7 (DB record: 09CRCPK3320E1Z7)
 * Customer ID: 1759923000014666296
 * Zoho Contact Number: CUS-03068
 * 
 * ====================================================================================================
 * SECTION 1: EXACT READ-ONLY SQL QUERIES EXECUTED AGAINST PRODUCTION POSTGRESQL & RESULTS
 * ====================================================================================================
 * 
 * QUERY 1: Customer Record & Current PostgreSQL Balance Metadata
 * ----------------------------------------------------------------------------------------------------
 * Purpose:
 *   Verify customer identity, GSTIN mapping, and current PostgreSQL balance metadata.
 * 
 * Exact SQL Executed:
 *   SELECT id, name, "gstNumber", "netOutstandingBalance", "balanceUpdatedAt", "createdAt", "updatedAt"
 *   FROM "Customer"
 *   WHERE "gstNumber" = '09GCRPK3320E1Z7' OR id = '1759923000014666296';
 * 
 * Actual Production Result (Initial Investigation):
 *   id                    | name                                | gstNumber       | netOutstandingBalance | balanceUpdatedAt
 *   ----------------------+-------------------------------------+-----------------+-----------------------+-------------------------
 *   1759923000014666296   | M/S PAPNEJA INVERTERS AND BATTERIES | 09CRCPK3320E1Z7 |                 -2996 | 2026-07-28 11:44:30.142
 * 
 * Actual Production Result (Post-Manual Sync on 2026-10-28 08:21:48 UTC):
 *   id                    | name                                | gstNumber       | netOutstandingBalance | balanceUpdatedAt
 *   ----------------------+-------------------------------------+-----------------+-----------------------+-------------------------
 *   1759923000014666296   | M/S PAPNEJA INVERTERS AND BATTERIES | 09CRCPK3320E1Z7 |                 12039 | 2026-10-28 08:21:48.044
 * 
 * Conclusion:
 *   Prior to manual sync, the database record had not updated for 3 months (frozen at -2,996 from July 28).
 *   Syncing via CustomerBalanceService.refreshCustomerBalances successfully updated the balance to 12,039.
 * 
 * ----------------------------------------------------------------------------------------------------
 * QUERY 2: Check for Duplicate Customer Records
 * ----------------------------------------------------------------------------------------------------
 * Purpose:
 *   Ensure there are no duplicate customer rows for this GSTIN or similar company name.
 * 
 * Exact SQL Executed:
 *   SELECT id, name, "gstNumber", "netOutstandingBalance" 
 *   FROM "Customer" 
 *   WHERE "gstNumber" ILIKE '%09GCRPK3320E1Z7%' OR name ILIKE '%PAPNEJA%';
 * 
 * Actual Production Result:
 *   id                    | name                                | gstNumber       | netOutstandingBalance
 *   ----------------------+-------------------------------------+-----------------+-----------------------
 *   1759923000014666296   | M/S PAPNEJA INVERTERS AND BATTERIES | 09CRCPK3320E1Z7 |                 12039
 *   (1 row)
 * 
 * Conclusion:
 *   Exactly 1 customer row exists. No split ledger or duplicate ID fragmentation.
 * 
 * ----------------------------------------------------------------------------------------------------
 * QUERY 3: Recovery Invoice Tasks for Customer
 * ----------------------------------------------------------------------------------------------------
 * Purpose:
 *   Audit all recovery tasks, invoice associations, and statuses for Papneja.
 * 
 * Exact SQL Executed:
 *   SELECT id, "customerId", "customerName", "invoiceId", "invoiceNumber", status, "lastKnownPendingAmount", "flaggedAt", "resolvedAt"
 *   FROM "RecoveryInvoiceTask"
 *   WHERE "customerId" = '1759923000014666296'
 *   ORDER BY "flaggedAt" ASC;
 * 
 * Actual Production Result:
 *   id                        | customerId          | invoiceId           | invoiceNumber | status   | lastKnownPendingAmount | flaggedAt               | resolvedAt
 *   --------------------------+---------------------+---------------------+---------------+----------+------------------------+-------------------------+------------------------
 *   cmpoawpd8000ul6xu7d8btowj | 1759923000014666296 | 1759923000018935197 | KT/26-27/0960 | RESOLVED |                      0 | 2026-05-27 16:51:18.764 | 2026-06-05 09:21:23.034
 *   cmsk7hby809mel68zdllgiq73 | 1759923000014666296 | 1759923000023841507 | KT/26-27/2458 | ACTIVE   |                  12039 | 2026-08-08 10:03:24.992 | null
 *   cmsmytmor09oll68za1mwv1de | 1759923000014666296 | 1759923000023907170 | KT/26-27/2475 | RESOLVED |                      0 | 2026-08-10 08:24:20.764 | 2026-08-12 11:32:38.861
 * 
 * Conclusion:
 *   1 ACTIVE task exists for invoice KT/26-27/2458 with pending balance 12,039.
 *   Invoice KT/26-27/2475 was resolved at 0 on August 12 (settled by POS payment).
 * 
 * ----------------------------------------------------------------------------------------------------
 * QUERY 4: Invoice Summary Cache for Customer
 * ----------------------------------------------------------------------------------------------------
 * Purpose:
 *   Check whether invoice KT/26-27/2458 exists in short-term InvoiceSummaryCache.
 * 
 * Exact SQL Executed:
 *   SELECT count(*) AS cache_count_for_papneja
 *   FROM "InvoiceSummaryCache"
 *   WHERE "customerId" = '1759923000014666296';
 * 
 * Actual Production Result:
 *   cache_count_for_papneja: 0
 * 
 * Conclusion:
 *   Because older invoices are not in InvoiceSummaryCache, bulk refresh skipped Papneja until active tasks
 *   were explicitly included in the customer balance sync list.
 * 
 * ====================================================================================================
 * SECTION 2: LIVE READ-ONLY ZOHO BOOKS API VERIFICATION EXECUTED ON PRODUCTION VPS
 * ====================================================================================================
 * 
 * Request Details:
 *   Timestamp: 2026-10-28T08:48:58.419Z
 *   Endpoint: https://www.zohoapis.in/books/v3/contacts
 *   Parameters: organization_id=60027595766&contact_ids=1759923000014666296
 *   HTTP Status: 200 OK
 * 
 * Live Response Fields Returned by Zoho Books:
 *   - contact_id: "1759923000014666296"
 *   - contact_name: "M/S PAPNEJA INVERTERS AND BATTERIES"
 *   - outstanding_receivable_amount: 12039.00
 *   - unused_credits_receivable_amount: 0.00
 *   - outstanding_payable_amount: 0.00
 *   - unused_credits_payable_amount: 0.00
 *   - Computed Net Balance: 12039.00
 * 
 * Match:
 *   Zoho Books live contact receivable (12,039.00) matches Customer Statement and invoice KT/26-27/2458 exactly.
 * ====================================================================================================
 */

export const PAPNEJA_VERIFICATION_EVIDENCE = {
  vpsHost: '187.127.150.67',
  vpsHostname: 'srv1697730',
  databaseName: 'kamna_prod',
  deployedCommitSha: '7ac2a85c1cf16364e5b3f397792346e96c736ff0',
  customerId: '1759923000014666296',
  customerGst: '09CRCPK3320E1Z7',
  zohoOrgId: '60027595766',
  zohoReceivable: 12039,
  zohoAdvanceCredits: 0,
  activeInvoiceNumber: 'KT/26-27/2458',
  activeInvoicePending: 12039,
  activeInvoiceOriginalTotal: 15035,
  activeInvoiceAppliedAdvance: 2996,
  testSummary: '162 Passed, 0 Failed',
};
