# Solar Orders Permission Model

## 1. Current Permission Matrix

| Permission Name | Purpose | Pages Affected | Actions Controlled | Current Usage | Overlaps With |
|-----------------|---------|----------------|--------------------|---------------|---------------|
| `solar_orders_view` | Grants visibility into the Solar Orders module | Sidebar, Listing, Details | Navigation, API fetch | Controls primary access | - |
| `solar_orders_create` | Allows creating new Solar Orders | Orders Listing | `+ New Order` button, POST API | Order instantiation | - |
| `solar_orders_edit` | (Legacy) General edit capability | Order Details | Saving forms | Redundant | `solar_orders_edit_draft` |
| `solar_orders_edit_draft` | Allows modifying orders specifically in DRAFT status | Order Details | Save button (when Draft) | Refining new orders | `solar_orders_edit` |
| `solar_orders_submit` | Allows sending a draft for approval | Order Details | `Submit For Approval` button | Transitions status to PENDING_APPROVAL | - |
| `solar_orders_approve` | Allows approving a pending order | Order Details | `Approve` button | Transitions status to EXECUTION | - |
| `solar_orders_reject` | Allows rejecting a pending order | Order Details | `Reject` button | Transitions status to REJECTED | - |
| `solar_orders_delete` | Allows deleting/cancelling an order | Order Details | `Delete`/`Cancel` button | Destructive action | (Business Rule) |
| `solar_orders_view_rejected` | Visibility into rejected orders | Orders Listing | Status Filters | UI Filtering | `solar_orders_view` |
| `solar_documentation_view` | Visibility into Documentation module/tabs | Order Details (Docs) | Viewing uploaded documents | Workflow separation | - |
| `solar_documentation_edit` | Uploading and editing documentation | Order Details (Docs) | Upload, Delete, Edit docs | Workflow separation | `solar_upload_documents` |
| `solar_documentation_approve` | Marking documentation step as complete | Order Details (Docs) | `Approve Documentation` button | Workflow step | - |
| `solar_installation_view` | Visibility into Installation module/tabs | Order Details (Install) | Viewing installation details | Workflow separation | - |
| `solar_installation_complete` | Marking installation as complete | Order Details (Install) | `Complete Installation` button | Transitions status to COMPLETED | - |
| `solar_upload_documents` | (Legacy) Ability to upload files | Order Details | Upload button | Redundant | `solar_documentation_edit` |

## 2. Current Workflow Mapping

```
Draft
    ↓  (Requires: solar_orders_submit)
Pending Approval
    ↓  (Requires: solar_orders_approve)
Approved / Execution
    ↓  (Requires: solar_installation_complete)
Completed
```
OR
```
Pending Approval
    ↓  (Requires: solar_orders_reject)
Rejected
```

## 3. Existing Permission Analysis

### `solar_orders_edit`
- **What it currently allows**: General edit capability on any order.
- **Required?**: No, it's too broad.
- **Overlaps**: `solar_orders_edit_draft`.
- **Remain?**: No.
- **Reasoning**: Editing should be strictly tied to the DRAFT state or specific workflow stages (like documentation).

### `solar_orders_delete`
- **What it currently allows**: Deleting or cancelling an order.
- **Required?**: No.
- **Overlaps**: N/A
- **Remain?**: No.
- **Reasoning**: Deletion/Cancellation is a business rule (e.g., Master Admin only, or system-level rules based on state), not a general user permission.

### `solar_orders_view_rejected`
- **What it currently allows**: Seeing rejected orders in the table.
- **Required?**: No.
- **Overlaps**: `solar_orders_view` + `solar_orders_reject`.
- **Remain?**: No.
- **Reasoning**: If a user has `View Orders`, they should see the status of orders. Rejected is just a status.

### `solar_upload_documents`
- **What it currently allows**: Uploading files generically.
- **Required?**: No.
- **Overlaps**: `solar_documentation_edit`.
- **Remain?**: No.
- **Reasoning**: This is entirely covered by the structured documentation workflow.

## 4. Redundant Permissions

1. **Solar Orders Edit (Legacy)**: Too broad. Editing should be restricted by order status (Draft).
2. **Solar Orders Cancel/Delete**: Should be a business rule (Admin only) rather than a toggleable matrix permission.
3. **View Rejected Orders**: Redundant. `Solar Orders View` should cover all statuses.
4. **Upload Documents**: Replaced by structured `Solar Documentation Edit`.

## 5. Proposed Final Permission Model

### Solar Orders
- **View**: Master visibility switch. If false, the entire module is inaccessible.
- **Create**: Allows creating new orders (defaults to Draft).
- **Edit Draft**: Allows modifying details of an order while it is in Draft status.
- **Submit For Approval**: Allows pushing a Draft to Pending Approval.
- **Approve Orders**: Allows pushing Pending Approval to Execution.
- **Reject Orders**: Allows rejecting Pending Approval orders (requires remarks).

### Documentation
- **View**: Can see the documentation tab and files.
- **Edit**: Can upload and remove documentation files.
- **Approve**: Can mark the documentation workflow stage as verified/approved.

### Installation
- **View**: Can see the installation tab.
- **Complete**: Can log installation details and transition the order to Completed.

## 6. Permission Dependency Rules

- **Solar Orders View = False**:
  - Module hidden from sidebar.
  - All `/staff/dashboard/solar-orders/*` routes redirect or 403.
  - All `/api/solar-orders/*` endpoints return 403.
  - ALL OTHER Solar Order permissions are rendered moot (ignored).
  
- **Documentation/Installation Dependencies**:
  - A user cannot have `Documentation Edit` if they do not have `Documentation View`.
  - A user cannot have `Installation Complete` if they do not have `Installation View`.
  - These tabs are hidden entirely if their respective View permission is false.

- **Approval Dependencies**:
  - `Submit For Approval` inherently requires `View`.
  - `Approve` / `Reject` inherently require `View`.

## 7. Business Rules

- Draft orders can only be edited. Once submitted, core details are locked.
- Only Pending Approval orders can be approved or rejected.
- Rejecting an order strictly requires a "Remarks" reason to be supplied.
- Cancel/Delete is Admin-only business logic. It is not managed via the dynamic permission matrix.
- `Solar Orders View` controls visibility of ALL orders, regardless of status (including Rejected).

## 8. UI Impact

- **Sidebar**: Entire Solar Orders menu group hidden if View is missing.
- **Solar Orders List**: `+ New Order` button disabled/hidden if Create is missing.
- **Order Details (Header)**: Submit, Approve, Reject buttons shown conditionally based on permissions AND order status.
- **Order Details (Forms)**: Form fields disabled/read-only if order is not Draft OR user lacks Edit Draft permission.
- **Tabs**: Documentation and Installation tabs hidden if their View permissions are missing.
- **Documentation Tab**: Upload/Delete buttons hidden if Edit is missing. Approve button hidden if Approve is missing.
- **Installation Tab**: Complete button hidden if Complete is missing.
- **APIs**: Middleware/Route guards must enforce matrix checks before performing database operations.

## 9. Migration Plan

1. **Database Schema**:
   - Drop the boolean columns for `solar_orders_edit`, `solar_orders_delete`, `solar_orders_view_rejected`, and `solar_upload_documents`.
2. **Permission Mapping (Deployment)**:
   - Run a migration script: If a user had `solar_orders_edit`, grant them `solar_orders_edit_draft`.
   - If they had `solar_upload_documents`, grant `solar_documentation_edit`.
3. **Backward Compatibility**:
   - The UI will be updated simultaneously with the schema. Since this is an internal ERP, simultaneous rollout is safe.
4. **Rollback Strategy**:
   - Keep the dropped columns in a backup table temporarily, or simply use Prisma down migrations if needed, but primarily relying on the script.

## 10. Testing Checklist

- [ ] **View-Only User**: Can see sidebar, list, and details, but cannot edit, create, submit, or see docs/install tabs.
- [ ] **Creator User**: Can click `+ New Order`, can see the draft, but cannot submit (unless granted).
- [ ] **Drafter User**: Can edit a draft order. Once submitted by someone else, forms become disabled.
- [ ] **Approver**: Sees Approve/Reject buttons ONLY on Pending orders. Rejection prompt requires remarks.
- [ ] **Documentation Exec**: Can only see and interact with the Documentation tab.
- [ ] **Installation Exec**: Can only see and interact with the Installation tab.
- [ ] **Master Admin**: Has bypass capability for Cancel/Delete.
