import { DISPATCH_STEP_PERMISSION_MAP, PermissionKey } from './permissions';

type Session = Record<string, any> | null | undefined;

/**
 * Checks if user has overall Dispatch module access.
 * Admin always has access. Staff must have dispatch_view === true.
 */
export function hasDispatchAccess(session: Session): boolean {
  if (!session) return false;
  return session.role === 'ADMIN' || !!session.dispatch_view;
}

/**
 * Checks if user has a specific granular dispatch permission.
 * Admin always has access. Staff must have both dispatch_view and the specific permission.
 */
export function hasDispatchPermission(session: Session, permissionKey: PermissionKey | string): boolean {
  if (!session) return false;
  if (session.role === 'ADMIN') return true;
  if (!session.dispatch_view) return false;
  return !!session[permissionKey];
}

/**
 * Checks if user can complete a specific workflow step.
 * Step is one of: 'rate-review', 'payment-verification', 'truck-details', 'ready-for-invoice', 'invoice-confirmation'
 * Admin always has access. Staff must have dispatch_view and the step's specific permission.
 * Note: Workflow state (currentStep, previous step completion) is checked independently.
 */
export function canCompleteDispatchStep(session: Session, step: string): boolean {
  if (!session) return false;
  if (session.role === 'ADMIN') return true;
  if (!session.dispatch_view) return false;
  const requiredKey = DISPATCH_STEP_PERMISSION_MAP[step];
  if (!requiredKey) return false;
  return !!session[requiredKey];
}

/**
 * Checks if user can override or reopen completed dispatch workflow steps.
 * Admin always has access. Staff must have dispatch_view and dispatch_workflow_override.
 */
export function canOverrideDispatchWorkflow(session: Session): boolean {
  if (!session) return false;
  if (session.role === 'ADMIN') return true;
  if (!session.dispatch_view) return false;
  return !!session.dispatch_workflow_override;
}

/**
 * Checks if user can force archive dispatch orders from any workflow stage.
 * Admin always has access. Staff must have dispatch_view and dispatch_force_archive.
 */
export function canForceArchiveDispatch(session: Session): boolean {
  if (!session) return false;
  if (session.role === 'ADMIN') return true;
  if (!session.dispatch_view) return false;
  return !!session.dispatch_force_archive;
}

/**
 * Helper to generate a standardized 403 Forbidden error response payload.
 */
export function dispatchForbiddenResponse(stepName?: string) {
  const message = stepName
    ? `You do not have permission to perform ${stepName}.`
    : 'You do not have permission to perform this dispatch action.';
  return { error: message, code: 'FORBIDDEN_DISPATCH_STEP' };
}
