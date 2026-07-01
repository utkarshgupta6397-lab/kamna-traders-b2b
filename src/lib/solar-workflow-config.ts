export const DOCUMENTATION_STEPS = [
  'Document Upload',
  'Customer Registration',
  'Vendor Portal Accepted',
  'Review & Approval',
  'Notarised Pending',
  'Customer Signature Pending',
  'Review Pending',
  'Authority Signature Pending',
  'Company Stamp Pending',
  'DCR Certificate Pending',
  'File Upload Approval Pending',
  'File Upload Pending',
  'Customer Portal Final Submission',
  'Electricity Department Submission',
  'Central Subsidy Request',
  'Central Subsidy Claimed',
  'Central Subsidy Received',
  'State Subsidy Received'
];

export const INSTALLATION_STEPS = [
  'Ready to Install',
  'Physical Installation Completed',
  'Installation Checklist',
  'Net Metering Done',
  'System Start Done',
  'System WiFi Setup Done',
  'Installation Completed'
];

export const WORKFLOW_CONFIG = {
  // A documentation step is considered overdue if it's pending/in_progress for more than 3 days
  OVERDUE_THRESHOLD_DAYS: 3
};

export function getWorkflowStageName(workflowType: string, stepKey: string): string {
  const parts = stepKey.split('_');
  if (parts.length !== 2) throw new Error(`Invalid stepKey format: ${stepKey}`);
  
  const index = parseInt(parts[1], 10) - 1;
  if (isNaN(index) || index < 0) throw new Error(`Invalid stepKey index: ${stepKey}`);
  
  let name: string | undefined;
  if (workflowType === 'DOCUMENTATION' || stepKey.startsWith('DOC_')) {
    name = DOCUMENTATION_STEPS[index];
  } else if (workflowType === 'INSTALLATION' || stepKey.startsWith('INST_')) {
    name = INSTALLATION_STEPS[index];
  }
  
  if (!name) throw new Error(`Workflow definition missing for ${stepKey} in ${workflowType}`);
  
  return name;
}
