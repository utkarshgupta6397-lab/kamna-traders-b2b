const fs = require('fs');
const path = 'src/app/staff/dashboard/solar-orders/orders/[id]/components/WorkflowEngine.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import RollbackConfirmationModal')) {
    content = content.replace("import toast from 'react-hot-toast';", "import toast from 'react-hot-toast';\nimport RollbackConfirmationModal from './RollbackConfirmationModal';");
}

if (!content.includes('showRollbackModal')) {
    content = content.replace("const [isEditingStage, setIsEditingStage] = useState(false);", "const [isEditingStage, setIsEditingStage] = useState(false);\n  const [showRollbackModal, setShowRollbackModal] = useState(false);");
}

const handleRollbackString = `
  const handleRollback = async (reason: string, cascade: boolean) => {
    if (!selectedStep) return;
    try {
      const res = await fetch(\`/api/solar-orders/\${orderId}/workflow/\${selectedStep.id}/rollback\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, cascade })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(\`Rolled back \${data.rolledBackCount} stage(s) successfully\`);
        window.location.reload();
      } else {
        toast.error(data.error || 'Failed to rollback stage');
      }
    } catch (e) {
      toast.error('Network error during rollback');
    }
  };
`;

if (!content.includes('handleRollback')) {
    content = content.replace("const updateStep = async", handleRollbackString + "\n  const updateStep = async");
}

const hasSubsequentStr = `
  const hasSubsequentCompletedStages = selectedStep ? steps.some(s => s.stepIndex > selectedStep.stepIndex && s.status === 'COMPLETED') : false;
`;

if (!content.includes('hasSubsequentCompletedStages')) {
    content = content.replace("const completedCount = steps", hasSubsequentStr + "\n  const completedCount = steps");
}

const renderStageActionOld = `{canMasterEdit && (
                 <button
                   onClick={() => {
                     if (confirm(\`Reopen Stage: You are about to enter Master Edit Mode. This allows you to override previously recorded values. All changes will be strictly audited. Continue?\`)) {
                       setIsEditingStage(true);
                     }
                   }}
                   className="absolute top-4 right-4 text-xs font-bold px-3 py-1.5 bg-white border border-gray-200 shadow-sm rounded-lg hover:bg-gray-50 hover:text-purple-700 transition-colors"
                 >
                   Edit Stage
                 </button>
               )}`;
               
const renderStageActionNew = `               {canManageWorkflowEdits && (
                 <div className="absolute top-4 right-4 flex flex-col md:flex-row gap-2">
                   <button
                     onClick={() => setIsEditingStage(true)}
                     className="text-xs font-bold px-4 py-2 bg-purple-600 text-white shadow-sm rounded-lg hover:bg-purple-700 transition-colors"
                   >
                     Edit
                   </button>
                   <button
                     onClick={() => setShowRollbackModal(true)}
                     className="text-xs font-bold px-4 py-2 bg-white text-red-600 border-2 border-red-200 shadow-sm rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
                   >
                     Rollback
                   </button>
                 </div>
               )}`;

content = content.replace(renderStageActionOld, renderStageActionNew);

const modalRender = `
      <RollbackConfirmationModal 
        isOpen={showRollbackModal}
        onClose={() => setShowRollbackModal(false)}
        onConfirm={handleRollback}
        stageName={selectedStep?.metadata?.name || selectedStep?.stepKey || ''}
        hasSubsequentCompletedStages={hasSubsequentCompletedStages}
      />
`;

if (!content.includes('<RollbackConfirmationModal')) {
    content = content.replace("</WorkflowEngineContext.Provider>", modalRender + "\n    </WorkflowEngineContext.Provider>");
    if (!content.includes('<RollbackConfirmationModal')) { // fallback if context doesn't exist
       content = content.replace("return (", "return (\n    <>");
       content = content.replace(/(?<=^\s*)(\)\s*;\s*}$)/gm, `      ${modalRender}\n    </>\n$1`);
       // Alternative fallback: replace final div
       content = content.replace(/<\/div>\n\s*\);\n}/, modalRender + "\n    </div>\n  );\n}");
    }
}

fs.writeFileSync(path, content);
