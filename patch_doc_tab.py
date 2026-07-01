import re

with open('src/app/staff/dashboard/solar-orders/orders/[id]/documentation/DocumentationTabClient.tsx', 'r') as f:
    content = f.read()

# 1. Add import
if 'DocumentationApprovalStage' not in content:
    content = content.replace("import VendorPortalAcceptedStep from './VendorPortalAcceptedStep';", "import VendorPortalAcceptedStep from './VendorPortalAcceptedStep';\nimport DocumentationApprovalStage from './DocumentationApprovalStage';")

# 2. Add render hook in renderStageAction
hook_code = """        if (reviewSteps.includes(stepName) && selectedStep.status !== 'COMPLETED') {
          return (
            <DocumentationApprovalStage
              order={order}
              steps={steps}
              selectedStep={selectedStep}
              onApprove={() => updateStep('COMPLETED', undefined, undefined, isEditMode)}
              onRequestCorrections={async (targetStepId, correctionRemarks) => {
                try {
                  const res = await fetch(`/api/solar-orders/${order.id}/workflow/${selectedStep.id}/corrections`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetStepId, notes: correctionRemarks })
                  });
                  if (res.ok) {
                    window.location.reload();
                  } else {
                    const data = await res.json();
                    alert(data.error || 'Failed to request corrections');
                  }
                } catch (e) {
                  alert('Network error');
                }
              }}
              canApprove={canApprove}
              loadingStep={loadingStep}
            />
          );
        }
"""

if "<DocumentationApprovalStage" not in content:
    content = content.replace("        if (stepName === 'Document Upload') {", hook_code + "\n        if (stepName === 'Document Upload') {")

# 3. Remove the old reviewSteps rendering block inside the generic Action UI
# Since we now intercept `reviewSteps` entirely, we don't need the `reviewSteps.includes(stepName)` check in the generic block.
# Let's find the old block.
old_review_block = """              {reviewSteps.includes(stepName) ? (
                canApprove ? (
                  <button
                    onClick={() => updateStep('COMPLETED')}
                    disabled={loadingStep === selectedStep.id}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 border border-green-700 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-md disabled:opacity-50"
                  >
                    {loadingStep === selectedStep.id ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                    Approve Stage
                  </button>
                ) : (
                  <button disabled className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-200 text-gray-500 font-bold rounded-xl cursor-not-allowed border border-gray-300" title="You don't have permission to progress this workflow.">
                    <Lock size={18} />
                    Waiting for Administrator
                  </button>
                )
              ) : ("""

if old_review_block in content:
    # We replace it with nothing, meaning the generic block is only for non-review steps.
    # Wait, the ternary structure means we need to just leave the false branch!
    # The false branch is the `<button onClick={() => updateStep...`
    # Let's write a regex or just replace the whole ternary.

    old_full_block = """              {reviewSteps.includes(stepName) ? (
                canApprove ? (
                  <button
                    onClick={() => updateStep('COMPLETED')}
                    disabled={loadingStep === selectedStep.id}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 border border-green-700 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-md disabled:opacity-50"
                  >
                    {loadingStep === selectedStep.id ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                    Approve Stage
                  </button>
                ) : (
                  <button disabled className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-200 text-gray-500 font-bold rounded-xl cursor-not-allowed border border-gray-300" title="You don't have permission to progress this workflow.">
                    <Lock size={18} />
                    Waiting for Administrator
                  </button>
                )
              ) : (
                <button
                  onClick={() => updateStep(selectedStep.status === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED', remarks)}
                  disabled={loadingStep === selectedStep.id || !canProgress || selectedStep.status === 'REJECTED'}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${canProgress ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'}`}
                  title={!canProgress ? "You don't have permission to progress this documentation workflow." : undefined}
                >
                  {loadingStep === selectedStep.id ? <Loader2 size={22} className="animate-spin" /> : (canProgress && <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />)}
                  {selectedStep.status === 'PENDING' ? `Start: ${stepName}` : `Complete: ${stepName}`}
                </button>
              )}"""

    new_full_block = """              <button
                onClick={() => updateStep(selectedStep.status === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED', remarks)}
                disabled={loadingStep === selectedStep.id || !canProgress || selectedStep.status === 'REJECTED'}
                className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${canProgress ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'}`}
                title={!canProgress ? "You don't have permission to progress this documentation workflow." : undefined}
              >
                {loadingStep === selectedStep.id ? <Loader2 size={22} className="animate-spin" /> : (canProgress && <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />)}
                {selectedStep.status === 'PENDING' ? `Start: ${stepName}` : `Complete: ${stepName}`}
              </button>"""
    
    content = content.replace(old_full_block, new_full_block)

    # Also remove `!reviewSteps.includes(stepName) && ` from the textarea block, since we already early return for review steps.
    content = content.replace("{!reviewSteps.includes(stepName) && canProgress && (", "{canProgress && (")


with open('src/app/staff/dashboard/solar-orders/orders/[id]/documentation/DocumentationTabClient.tsx', 'w') as f:
    f.write(content)

