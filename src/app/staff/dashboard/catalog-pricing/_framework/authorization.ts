import { MasterRecord } from './types';

export interface WorkflowPermissions {
  canCreate: boolean;
  canModify: boolean;
  canApprove: boolean;
}

export function getRecordAuthorization(record: MasterRecord | null, perms: WorkflowPermissions) {
  if (!record) {
    return {
      canEdit: false,
      canSubmit: false,
      canApproveAction: false,
      isReadOnly: true,
    };
  }

  let canEdit = false;
  let canSubmit = false;
  let canApproveAction = false;
  let canArchive = false;

  switch (record.status) {
    case 'Draft':
      canEdit = perms.canCreate || perms.canModify;
      canSubmit = perms.canCreate || perms.canModify;
      canArchive = perms.canModify;
      break;
    case 'Approval Pending':
      canApproveAction = perms.canApprove;
      break;
    case 'Active':
      canEdit = perms.canModify;
      break;
    case 'Inactive':
      canArchive = perms.canModify;
      break;
    case 'Archived':
    default:
      break;
  }

  return {
    canEdit,
    canSubmit,
    canApproveAction,
    canArchive,
    isReadOnly: !canEdit,
  };
}
