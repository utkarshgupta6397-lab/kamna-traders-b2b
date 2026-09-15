import { Prisma } from '@prisma/client';
import { hasMobilePermission } from './mobile-auth';

export interface NoteAccessContext {
  userId: string;
  role: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canArchive: boolean;
}

export function getNoteAccessContext(session: any): NoteAccessContext | null {
  if (!session || !session.userId) return null;
  const canView = hasMobilePermission(session, 'mobile_notes_view');
  const canCreate = hasMobilePermission(session, 'mobile_notes_create');
  const canEdit = hasMobilePermission(session, 'mobile_notes_edit');
  const canArchive = hasMobilePermission(session, 'mobile_notes_archive');

  return {
    userId: session.userId,
    role: session.role || 'STAFF',
    canView,
    canCreate,
    canEdit,
    canArchive,
  };
}

/**
 * Builds Prisma `where` filter for notes accessible by a specific user.
 * - Must have `mobile_notes_view`
 * - Must be:
 *   1. Created by user
 *   2. Or visibility = 'ALL_USERS'
 *   3. Or visibility = 'SELECTED_USERS' and user exists in NoteShare
 */
export function buildAccessibleNotesWhere(userId: string): Prisma.NoteWhereInput {
  return {
    OR: [
      { createdById: userId },
      { visibility: 'ALL_USERS' },
      {
        visibility: 'SELECTED_USERS',
        shares: {
          some: {
            userId: userId,
          },
        },
      },
    ],
  };
}

/**
 * Validates whether a user can access a specific fetched Note
 */
export function isUserAuthorizedForNote(
  userId: string,
  note: {
    createdById: string;
    visibility: string;
    shares?: Array<{ userId: string }>;
  }
): boolean {
  if (note.createdById === userId) {
    return true;
  }
  if (note.visibility === 'ALL_USERS') {
    return true;
  }
  if (note.visibility === 'SELECTED_USERS' && note.shares) {
    return note.shares.some((s) => s.userId === userId);
  }
  return false;
}
