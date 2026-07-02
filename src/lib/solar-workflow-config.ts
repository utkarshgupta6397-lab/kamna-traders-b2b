export interface WorkflowStepConfig {
  id: string;
  title: string;
  type: 'WORKFLOW' | 'REVIEW';
  legacyKey?: string;
  sequence: number;
  permission?: string;
  reviewSteps?: string[];
}

export const DOCUMENTATION_STEPS_CONFIG: WorkflowStepConfig[] = [
  { id: 'document_upload', legacyKey: 'DOC_1', title: 'Document Upload', type: 'WORKFLOW', sequence: 1 },
  { id: 'customer_registration', legacyKey: 'DOC_2', title: 'Customer Registration', type: 'WORKFLOW', sequence: 2 },
  { id: 'vendor_portal', legacyKey: 'DOC_3', title: 'Vendor Portal Accepted', type: 'WORKFLOW', sequence: 3 },
  // Step 4 "Review & Approval" (legacyKey: DOC_4) is removed
  { id: 'notarised_pending', legacyKey: 'DOC_5', title: 'Notarised Pending', type: 'WORKFLOW', sequence: 4 },
  { id: 'customer_signature', legacyKey: 'DOC_6', title: 'Customer Signature Pending', type: 'WORKFLOW', sequence: 5 },
  { 
    id: 'documentation_review', 
    legacyKey: 'DOC_7', 
    title: 'Review Pending', 
    type: 'REVIEW', 
    sequence: 6,
    permission: 'solar_orders_approval',
    reviewSteps: [
      'document_upload',
      'customer_registration',
      'vendor_portal',
      'notarised_pending',
      'customer_signature'
    ]
  },
  { id: 'authority_signature', legacyKey: 'DOC_8', title: 'Authority Signature Pending', type: 'WORKFLOW', sequence: 7 },
  { id: 'company_stamp', legacyKey: 'DOC_9', title: 'Company Stamp Pending', type: 'WORKFLOW', sequence: 8 },
  { id: 'dcr_certificate', legacyKey: 'DOC_10', title: 'DCR Certificate Pending', type: 'WORKFLOW', sequence: 9 },
  { 
    id: 'file_upload_approval', 
    legacyKey: 'DOC_11', 
    title: 'File Upload Approval Pending', 
    type: 'REVIEW', 
    sequence: 10,
    permission: 'solar_orders_approval',
    reviewSteps: [
      'authority_signature',
      'company_stamp',
      'dcr_certificate'
    ]
  },
  { id: 'file_upload', legacyKey: 'DOC_12', title: 'File Upload Pending', type: 'WORKFLOW', sequence: 11 },
  { id: 'customer_portal_final', legacyKey: 'DOC_13', title: 'Customer Portal Final Submission', type: 'WORKFLOW', sequence: 12 },
  { id: 'electricity_dept', legacyKey: 'DOC_14', title: 'Electricity Department Submission', type: 'WORKFLOW', sequence: 13 },
  { id: 'central_subsidy_req', legacyKey: 'DOC_15', title: 'Central Subsidy Request', type: 'WORKFLOW', sequence: 14 },
  { id: 'central_subsidy_claimed', legacyKey: 'DOC_16', title: 'Central Subsidy Claimed', type: 'WORKFLOW', sequence: 15 },
  { id: 'central_subsidy_received', legacyKey: 'DOC_17', title: 'Central Subsidy Received', type: 'WORKFLOW', sequence: 16 },
  { id: 'state_subsidy_received', legacyKey: 'DOC_18', title: 'State Subsidy Received', type: 'WORKFLOW', sequence: 17 }
];

export const DOCUMENTATION_STEPS = DOCUMENTATION_STEPS_CONFIG.map(s => s.title);

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
  if (workflowType === 'DOCUMENTATION' || stepKey.startsWith('DOC_') || stepKey.match(/^[a-z_]+$/)) {
    const config = DOCUMENTATION_STEPS_CONFIG.find(c => c.id === stepKey || c.legacyKey === stepKey);
    if (config) return config.title;
    // Fallback for archived steps like DOC_4
    if (stepKey === 'DOC_4') return 'Review & Approval';
  }
  
  if (workflowType === 'INSTALLATION' || stepKey.startsWith('INST_')) {
    const parts = stepKey.split('_');
    if (parts.length === 2) {
      const index = parseInt(parts[1], 10) - 1;
      if (!isNaN(index) && index >= 0 && index < INSTALLATION_STEPS.length) {
         return INSTALLATION_STEPS[index];
      }
    }
  }
  
  throw new Error(`Workflow definition missing for ${stepKey} in ${workflowType}`);
}

export interface WorkflowState {
  currentStage: string;
  completedSteps: number;
  totalSteps: number;
  progressPercentage: number;
  isCompleted: boolean;
  isOverdue: boolean;
  nextStage?: string;
  stepsMap: Record<string, any>;
}

export function resolveWorkflowState(steps: any[], workflowType: 'DOCUMENTATION' | 'INSTALLATION'): WorkflowState {
  const isDoc = workflowType === 'DOCUMENTATION';
  const allStepTitles = isDoc ? DOCUMENTATION_STEPS : INSTALLATION_STEPS;
  const configList = isDoc ? DOCUMENTATION_STEPS_CONFIG : null;
  
  let completedSteps = 0;
  let currentStage = allStepTitles[0];
  let isOverdue = false;
  const now = Date.now();
  const stepsMap: Record<string, any> = {};

  for (let i = 0; i < allStepTitles.length; i++) {
    const stepName = allStepTitles[i];
    let step = undefined;
    
    if (isDoc && configList) {
       const config = configList[i];
       step = steps.find(s => s.stepKey === config.id || s.stepKey === config.legacyKey);
    } else {
       const expectedKey = `INST_${i + 1}`;
       step = steps.find(s => s.stepKey === expectedKey);
    }

    if (step) {
      stepsMap[stepName] = {
        status: step.status,
        updatedAt: step.updatedAt,
        completedAt: step.completedAt,
        startedAt: step.startedAt,
        completedByName: step.completedBy?.name,
        notes: step.notes,
        id: step.id
      };

      if (step.status === 'COMPLETED' || step.status === 'NOT_APPLICABLE') {
        completedSteps++;
        currentStage = allStepTitles[i + 1] || 'Completed';
      } else {
        currentStage = stepName;
        
        // Overdue check
        const referenceDate = step.startedAt || step.updatedAt;
        if (referenceDate && (step.status === 'PENDING' || step.status === 'IN_PROGRESS')) {
          const diffDays = (now - new Date(referenceDate).getTime()) / (1000 * 3600 * 24);
          if (diffDays > WORKFLOW_CONFIG.OVERDUE_THRESHOLD_DAYS) {
            isOverdue = true;
          }
        }
        
        // Populate remaining stepsMap as PENDING but don't count them
        for (let j = i + 1; j < allStepTitles.length; j++) {
           let futureStep = undefined;
           if (isDoc && configList) {
             const futureConfig = configList[j];
             futureStep = steps.find(s => s.stepKey === futureConfig.id || s.stepKey === futureConfig.legacyKey);
           } else {
             futureStep = steps.find(s => s.stepKey === `INST_${j + 1}`);
           }
          stepsMap[allStepTitles[j]] = futureStep ? {
            status: futureStep.status,
            updatedAt: futureStep.updatedAt,
            completedAt: futureStep.completedAt,
            startedAt: futureStep.startedAt,
            completedByName: futureStep.completedBy?.name,
            notes: futureStep.notes,
            id: futureStep.id
          } : { status: 'PENDING' };
        }
        
        break; // Stop at first non-completed step
      }
    } else {
      stepsMap[stepName] = { status: 'PENDING' };
      currentStage = stepName;
      
      // Populate remaining steps as pending
      for (let j = i + 1; j < allStepTitles.length; j++) {
        stepsMap[allStepTitles[j]] = { status: 'PENDING' };
      }
      
      break;
    }
  }

  const isCompleted = completedSteps === allStepTitles.length;
  if (isCompleted) {
    currentStage = 'Completed';
  }

  const progressPercentage = allStepTitles.length === 0 ? 0 : Math.round((completedSteps / allStepTitles.length) * 100);

  return {
    currentStage,
    completedSteps,
    totalSteps: allStepTitles.length,
    progressPercentage,
    isCompleted,
    isOverdue,
    nextStage: isCompleted ? undefined : allStepTitles[allStepTitles.indexOf(currentStage) + 1],
    stepsMap
  };
}

export const SOLAR_ORDER_STATUS_GROUPS: Record<string, string[]> = {
  PENDING_APPROVAL: ['PENDING_APPROVAL'],
  EXECUTION: ['APPROVED', 'EXECUTION', 'INSTALLATION_IN_PROGRESS'],
  COMPLETED: ['COMPLETED'],
  REJECTED: ['REJECTED'],
  CANCELLED: ['CANCELLED'],
  DRAFT: ['DRAFT'],
  ARCHIVED: ['ARCHIVED']
};

export const SOLAR_ORDER_STATUS_UI: Record<string, { bg: string, text: string, dot: string, progress: number, label: string }> = {
  PENDING_APPROVAL: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', progress: 15, label: 'APPROVAL PENDING' },
  APPROVED: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', progress: 25, label: 'APPROVED' },
  EXECUTION: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', progress: 65, label: 'EXECUTION' },
  DOCUMENTATION_IN_PROGRESS: { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500', progress: 40, label: 'DOCUMENTATION' },
  INSTALLATION_READY: { bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500', progress: 60, label: 'INSTALLATION READY' },
  INSTALLATION_IN_PROGRESS: { bg: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-500', progress: 75, label: 'INSTALLATION IN PROGRESS' },
  COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', progress: 100, label: 'COMPLETED' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', progress: 100, label: 'REJECTED' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500', progress: 0, label: 'CANCELLED' },
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500', progress: 0, label: 'DRAFT' },
  ARCHIVED: { bg: 'bg-slate-200', text: 'text-slate-800', dot: 'bg-slate-600', progress: 0, label: 'ARCHIVED' }
};

export function getLogicalStatusGroup(status: string): string {
  for (const [group, statuses] of Object.entries(SOLAR_ORDER_STATUS_GROUPS)) {
    if (statuses.includes(status)) {
      return group;
    }
  }
  return status;
}

export function getNextStepConfig(currentStepId: string): WorkflowStepConfig | undefined {
  const currentIndex = DOCUMENTATION_STEPS_CONFIG.findIndex(c => c.id === currentStepId || c.legacyKey === currentStepId);
  if (currentIndex >= 0 && currentIndex < DOCUMENTATION_STEPS_CONFIG.length - 1) {
    return DOCUMENTATION_STEPS_CONFIG[currentIndex + 1];
  }
  return undefined;
}
