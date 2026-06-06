export function isVoidInvoice(invoice: any): boolean {
  if (!invoice) return false;
  const status = invoice.status || invoice.invoiceStatus || invoice.invoice_status;
  if (!status) return false;
  return status.toLowerCase() === 'void' || status.toLowerCase() === 'voided';
}
