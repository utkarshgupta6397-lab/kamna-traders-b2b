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
  const allSteps = workflowType === 'DOCUMENTATION' ? DOCUMENTATION_STEPS : INSTALLATION_STEPS;
  let completedSteps = 0;
  let currentStage = allSteps[0];
  let isOverdue = false;
  const now = Date.now();
  const stepsMap: Record<string, any> = {};

  for (let i = 0; i < allSteps.length; i++) {
    const stepName = allSteps[i];
    const expectedKey = workflowType === 'DOCUMENTATION' ? `DOC_${i + 1}` : `INST_${i + 1}`;
    
    // Find step by expected stepKey (e.g., DOC_1, DOC_2) instead of metadata name
    const step = steps.find(s => s.stepKey === expectedKey);

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
        currentStage = allSteps[i + 1] || 'Completed';
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
        for (let j = i + 1; j < allSteps.length; j++) {
          const futureStepKey = workflowType === 'DOCUMENTATION' ? `DOC_${j + 1}` : `INST_${j + 1}`;
          const futureStep = steps.find(s => s.stepKey === futureStepKey);
          stepsMap[allSteps[j]] = futureStep ? {
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
      for (let j = i + 1; j < allSteps.length; j++) {
        stepsMap[allSteps[j]] = { status: 'PENDING' };
      }
      
      break;
    }
  }

  const isCompleted = completedSteps === allSteps.length;
  if (isCompleted) {
    currentStage = 'Completed';
  }

  const progressPercentage = allSteps.length === 0 ? 0 : Math.round((completedSteps / allSteps.length) * 100);

  return {
    currentStage,
    completedSteps,
    totalSteps: allSteps.length,
    progressPercentage,
    isCompleted,
    isOverdue,
    nextStage: isCompleted ? undefined : allSteps[allSteps.indexOf(currentStage) + 1],
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
