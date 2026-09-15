import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getNoteAccessContext, isUserAuthorizedForNote } from '@/lib/notes-auth';
import { getNoteColor } from '@/lib/notes-colors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const auth = getNoteAccessContext(session);

  if (!auth || !auth.canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const note = await prisma.note.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        updatedBy: { select: { id: true, name: true, role: true } },
        archivedBy: { select: { id: true, name: true } },
        shares: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        pins: {
          where: { userId: auth.userId },
          select: { id: true },
        },
      },
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (!isUserAuthorizedForNote(auth.userId, note)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isPinned = note.pins.length > 0 && !note.isArchived;

    return NextResponse.json({
      success: true,
      data: {
        id: note.id,
        title: note.title,
        noteType: note.noteType,
        content: note.content,
        checklistItems: note.checklistItems || [],
        color: note.color,
        visibility: note.visibility,
        isArchived: note.isArchived,
        archivedAt: note.archivedAt,
        archivedByName: note.archivedBy?.name || null,
        version: note.version,
        isPinned,
        createdById: note.createdById,
        createdByName: note.createdBy.name,
        createdAt: note.createdAt,
        updatedById: note.updatedById,
        updatedByName: note.updatedBy.name,
        updatedAt: note.updatedAt,
        shares: note.shares.map((s) => ({
          userId: s.userId,
          name: s.user.name,
        })),
      },
    });
  } catch (error: any) {
    console.error('[Get Note API]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const auth = getNoteAccessContext(session);

  if (!auth || !auth.canView || !auth.canEdit) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { expectedVersion } = body;
    let { title, noteType, content, checklistItems, color } = body;

    const existingNote = await prisma.note.findUnique({
      where: { id },
      include: {
        shares: { select: { userId: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (!isUserAuthorizedForNote(auth.userId, existingNote)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (existingNote.isArchived) {
      return NextResponse.json({ error: 'Archived notes cannot be edited.' }, { status: 400 });
    }

    // Concurrency Check (Optimistic Locking)
    if (expectedVersion !== undefined && expectedVersion !== existingNote.version) {
      return NextResponse.json(
        {
          error: 'This note was updated by another user. Please reload the latest version before saving your changes.',
          code: 'CONCURRENCY_CONFLICT',
          currentVersion: existingNote.version,
        },
        { status: 409 }
      );
    }

    // Validate inputs
    const newTitle = title !== undefined ? String(title).trim() : existingNote.title;
    if (!newTitle) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (newTitle.length > 200) {
      return NextResponse.json({ error: 'Title cannot exceed 200 characters' }, { status: 400 });
    }

    const newNoteType = noteType ? (noteType === 'CHECKLIST' ? 'CHECKLIST' : 'TEXT') : existingNote.noteType;
    let newContent = existingNote.content;
    let newChecklist = existingNote.checklistItems;

    if (newNoteType === 'TEXT') {
      if (content !== undefined) {
        newContent = String(content).trim();
        if (!newContent) {
          return NextResponse.json({ error: 'Note content cannot be empty' }, { status: 400 });
        }
      }
      newChecklist = null;
    } else {
      if (checklistItems !== undefined) {
        if (!Array.isArray(checklistItems)) {
          checklistItems = [];
        }
        newChecklist = checklistItems
          .filter((item: any) => item && typeof item.text === 'string' && item.text.trim().length > 0)
          .map((item: any, index: number) => ({
            id: item.id || `chk_${Date.now()}_${index}`,
            text: item.text.trim(),
            isChecked: Boolean(item.isChecked),
          }));

        if ((newChecklist as any[]).length === 0) {
          return NextResponse.json({ error: 'Checklist must have at least one valid item' }, { status: 400 });
        }
      }
      newContent = null;
    }

    const newColor = color !== undefined ? getNoteColor(color).id : existingNote.color;

    // Detect if versioned fields actually changed
    const titleChanged = newTitle !== existingNote.title;
    const typeChanged = newNoteType !== existingNote.noteType;
    const colorChanged = newColor !== existingNote.color;
    const contentChanged = newNoteType === 'TEXT' && newContent !== existingNote.content;

    let checklistChanged = false;
    if (newNoteType === 'CHECKLIST') {
      const oldChecklist = (existingNote.checklistItems as any[]) || [];
      const currentList = (newChecklist as any[]) || [];
      if (oldChecklist.length !== currentList.length) {
        checklistChanged = true;
      } else {
        checklistChanged = currentList.some((item, idx) => {
          const oldItem = oldChecklist[idx];
          return !oldItem || oldItem.text !== item.text || Boolean(oldItem.isChecked) !== Boolean(item.isChecked);
        });
      }
    }

    const hasMeaningfulChange = titleChanged || typeChanged || colorChanged || contentChanged || checklistChanged;

    if (!hasMeaningfulChange) {
      // No change made - return existing without creating a version
      return NextResponse.json({
        success: true,
        data: existingNote,
        versionCreated: false,
      });
    }

    const newVersionNumber = existingNote.version + 1;

    // Transactional save + new immutable version creation
    const updated = await prisma.$transaction(async (tx) => {
      const noteUpdate = await tx.note.update({
        where: { id },
        data: {
          title: newTitle,
          noteType: newNoteType,
          content: newContent,
          checklistItems: newChecklist ? newChecklist : undefined,
          color: newColor,
          version: newVersionNumber,
          updatedById: auth.userId,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
          shares: { select: { userId: true } },
        },
      });

      // Create immutable Version record
      await tx.noteVersion.create({
        data: {
          noteId: id,
          versionNumber: newVersionNumber,
          title: newTitle,
          noteType: newNoteType,
          content: newContent,
          checklistItems: newChecklist ? newChecklist : undefined,
          color: newColor,
          visibility: existingNote.visibility,
          editedById: auth.userId,
        },
      });

      // Create Audit Log
      await tx.noteAuditLog.create({
        data: {
          noteId: id,
          userId: auth.userId,
          action: 'EDITED',
          details: JSON.stringify({
            versionNumber: newVersionNumber,
            titleChanged,
            typeChanged,
            colorChanged,
            contentChanged,
            checklistChanged,
          }),
        },
      });

      // Trigger notifications for other current viewers
      // Exclude the current editor!
      const recipientUserIds: string[] = [];

      if (existingNote.visibility === 'SELECTED_USERS') {
        // Shared users excluding editor
        existingNote.shares.forEach((s) => {
          if (s.userId !== auth.userId) recipientUserIds.push(s.userId);
        });
        // Also if creator is not the editor
        if (existingNote.createdById !== auth.userId && !recipientUserIds.includes(existingNote.createdById)) {
          recipientUserIds.push(existingNote.createdById);
        }
      } else if (existingNote.visibility === 'ALL_USERS') {
        // If creator is not the editor
        if (existingNote.createdById !== auth.userId) {
          recipientUserIds.push(existingNote.createdById);
        }
      }

      if (recipientUserIds.length > 0) {
        await tx.notification.createMany({
          data: recipientUserIds.map((uid) => ({
            userId: uid,
            type: 'NOTE_EDITED',
            title: 'Note Updated',
            message: `"${newTitle}" was updated by ${noteUpdate.updatedBy.name}.`,
            referenceId: id,
          })),
        });
      }

      return noteUpdate;
    });

    return NextResponse.json({
      success: true,
      data: updated,
      versionCreated: true,
      newVersionNumber,
    });
  } catch (error: any) {
    console.error('[Update Note API]', error);
    return NextResponse.json({ error: 'Couldn\'t save note. Please try again.' }, { status: 500 });
  }
}
