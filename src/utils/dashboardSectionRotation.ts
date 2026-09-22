import { DashboardSectionId, DASHBOARD_SECTIONS } from '@/components/dashboard/DashboardSectionTabs';

export interface StaffSessionUser {
  role?: string;
  accountsAccess?: boolean;
  accounts_customer_statement?: boolean;
  accounts_transactions?: boolean;
  accounts_summary_view?: boolean;
  manage_payments_view_own?: boolean;
  manage_payments_view_all?: boolean;
  canManageTransfers?: boolean;
  dispatch_stock_approval_view?: boolean;
  [key: string]: any;
}

/**
 * Checks whether a given user session can access a Dashboard section workspace.
 * Reuses canonical permission checks from StaffTopNav, AccountsLayout, OperationsLayout.
 */
export function canAccessDashboardSection(
  sectionId: DashboardSectionId,
  session?: StaffSessionUser | null
): boolean {
  // If no session provided (e.g. initial render or public), default to general staff view
  if (!session) return true;

  const isAdmin = session.role === 'ADMIN';
  if (isAdmin) return true;

  switch (sectionId) {
    case 'overview':
    case 'sales':
      // General staff workspaces accessible by default to all authenticated staff
      return true;

    case 'operations':
      // From OperationsLayout & Dispatch: role === 'ADMIN' || canManageTransfers || dispatch_stock_approval_view || dispatch_post_dispatch || dispatch_view
      return (
        !!session.canManageTransfers ||
        !!session.dispatch_stock_approval_view ||
        !!session.dispatch_post_dispatch ||
        !!session.dispatch_view
      );

    case 'accounts':
      // From AccountsLayout & StaffTopNav: accounts permissions
      return (
        !!session.accounts_customer_statement ||
        !!session.accounts_transactions ||
        !!session.accounts_summary_view ||
        !!session.manage_payments_view_own ||
        !!session.manage_payments_view_all ||
        !!session.dcr_management ||
        !!session.accounts_invoice_processor ||
        !!session.accounts_reports_salesman
      );

    default:
      return true;
  }
}

/**
 * Returns the array of accessible Dashboard section IDs for a session,
 * strictly maintaining the canonical sequence:
 * Overview -> Sales -> Operations -> Accounts
 */
export function getAccessibleDashboardSections(
  session?: StaffSessionUser | null
): DashboardSectionId[] {
  const canonicalOrder: DashboardSectionId[] = DASHBOARD_SECTIONS.map((s) => s.id);
  const accessible = canonicalOrder.filter((id) => canAccessDashboardSection(id, session));

  // Fallback: Overview is always accessible
  return accessible.length > 0 ? accessible : ['overview'];
}

/**
 * Finds the next section in the sequence after currentSection.
 * If currentSection is not found or is the last item, wraps around to index 0.
 */
export function getNextRotatingSection(
  currentSection: DashboardSectionId,
  accessibleSections: DashboardSectionId[]
): DashboardSectionId {
  if (accessibleSections.length === 0) return 'overview';
  if (accessibleSections.length === 1) return accessibleSections[0];

  const currentIndex = accessibleSections.indexOf(currentSection);
  if (currentIndex === -1 || currentIndex === accessibleSections.length - 1) {
    return accessibleSections[0];
  }

  return accessibleSections[currentIndex + 1];
}
