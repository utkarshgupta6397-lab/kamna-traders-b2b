import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getNoteAccessContext, buildAccessibleNotesWhere } from '@/lib/notes-auth';
import { getAutoAssignedColor, getNoteColor, getRandomNoteColor } from '@/lib/notes-colors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  const auth = getNoteAccessContext(session);

  if (!auth || !auth.canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // 'all' | 'my' | 'shared' | 'archived'
    const query = searchParams.get('q')?.trim() || '';

    // Base accessibility condition
    const accessibleCondition = buildAccessibleNotesWhere(auth.userId);

    // Apply view filter
    let whereCondition: any = {
      ...accessibleCondition,
    };

    if (filter === 'archived') {
      whereCondition.isArchived = true;
    } else {
      whereCondition.isArchived = false;

      if (filter === 'my') {
        whereCondition.createdById = auth.userId;
      } else if (filter === 'shared') {
        // Created by someone else and accessible to user
        whereCondition.createdById = { not: auth.userId };
      }
    }

    // Apply search query if present
    // Notice: checklistItems is JSONB, so in addition to title, content, createdBy.name,
    // we also filter checklist item text in memory or query
    const notes = await prisma.note.findMany({
      where: whereCondition,
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        updatedBy: {
          select: { id: true, name: true },
        },
        pins: {
          where: { userId: auth.userId },
          select: { id: true },
        },
        shares: {
          select: { userId: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const lowerQuery = query.toLowerCase();

    // Filter notes matching query (including checklist item text)
    const matchingNotes = query
      ? notes.filter((note) => {
          if (note.title.toLowerCase().includes(lowerQuery)) return true;
          if (note.content && note.content.toLowerCase().includes(lowerQuery)) return true;
          if (note.createdBy.name.toLowerCase().includes(lowerQuery)) return true;
          if (note.noteType === 'CHECKLIST' && Array.isArray(note.checklistItems)) {
            const hasMatch = (note.checklistItems as any[]).some(
              (item) => item && typeof item.text === 'string' && item.text.toLowerCase().includes(lowerQuery)
            );
            if (hasMatch) return true;
          }
          return false;
        })
      : notes;

    // Transform notes with preview, current user pin status, and share count
    const formattedNotes = matchingNotes.map((note) => {
      const isPinned = note.pins.length > 0 && !note.isArchived;
      const shareCount = note.shares.length;

      // Extract preview items for checklist
      let checklistPreview: Array<{ id: string; text: string; isChecked: boolean }> = [];
      if (note.noteType === 'CHECKLIST' && Array.isArray(note.checklistItems)) {
        checklistPreview = (note.checklistItems as any[]).slice(0, 5).map((item) => ({
          id: item.id || '',
          text: item.text || '',
          isChecked: Boolean(item.isChecked),
        }));
      }

      return {
        id: note.id,
        title: note.title,
        noteType: note.noteType,
        contentPreview: note.content ? note.content.slice(0, 200) : '',
        checklistPreview,
        totalChecklistItems: Array.isArray(note.checklistItems) ? note.checklistItems.length : 0,
        color: note.color,
        visibility: note.visibility,
        isArchived: note.isArchived,
        isPinned,
        version: note.version,
        shareCount,
        createdById: note.createdById,
        createdByName: note.createdBy.name,
        createdAt: note.createdAt,
        updatedById: note.updatedById,
        updatedByName: note.updatedBy.name,
        updatedAt: note.updatedAt,
      };
    });

    // If active view, separate pinned vs others
    let pinnedNotes: typeof formattedNotes = [];
    let otherNotes: typeof formattedNotes = [];

    if (filter === 'archived') {
      otherNotes = formattedNotes;
    } else {
      pinnedNotes = formattedNotes.filter((n) => n.isPinned);
      otherNotes = formattedNotes.filter((n) => !n.isPinned);
    }

    return NextResponse.json({
      success: true,
      data: otherNotes,
      pinnedNotes,
      totalCount: formattedNotes.length,
    });
  } catch (error: any) {
    console.error('[Notes Listing API]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  const auth = getNoteAccessContext(session);

  if (!auth || !auth.canView || !auth.canCreate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    let { title, noteType, content, checklistItems, color, visibility, selectedUserIds } = body;

    title = (title || '').trim();
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ error: 'Title cannot exceed 200 characters' }, { status: 400 });
    }

    noteType = noteType === 'CHECKLIST' ? 'CHECKLIST' : 'TEXT';

    let cleanContent: string | null = null;
    let cleanChecklist: any = null;

    if (noteType === 'TEXT') {
      cleanContent = (content || '').trim();
      if (!cleanContent) {
        return NextResponse.json({ error: 'Note content cannot be empty' }, { status: 400 });
      }
    } else {
      // Validate and clean checklist items
      if (!Array.isArray(checklistItems)) {
        checklistItems = [];
      }
      cleanChecklist = checklistItems
        .filter((item: any) => item && typeof item.text === 'string' && item.text.trim().length > 0)
        .map((item: any, index: number) => ({
          id: item.id || `chk_${Date.now()}_${index}`,
          text: item.text.trim(),
          isChecked: Boolean(item.isChecked),
        }));

      if (cleanChecklist.length === 0) {
        return NextResponse.json({ error: 'Checklist must have at least one valid item' }, { status: 400 });
      }
    }

    // Determine color
    if (!color) {
      const latestNote = await prisma.note.findFirst({
        where: { createdById: auth.userId },
        orderBy: { createdAt: 'desc' },
        select: { color: true },
      });
      color = getRandomNoteColor(latestNote?.color).id;
    } else {
      color = getNoteColor(color).id;
    }

    // Validate visibility
    const validVisibilities = ['ONLY_ME', 'SELECTED_USERS', 'ALL_USERS'];
    if (!validVisibilities.includes(visibility)) {
      visibility = 'ONLY_ME';
    }

    // Filter valid recipient user IDs for SELECTED_USERS
    let validShareUserIds: string[] = [];
    if (visibility === 'SELECTED_USERS' && Array.isArray(selectedUserIds)) {
      const candidateIds = Array.from(new Set(selectedUserIds)).filter(
        (id): id is string => typeof id === 'string' && id !== auth.userId
      );
      if (candidateIds.length > 0) {
        const eligibleUsers = await prisma.user.findMany({
          where: {
            id: { in: candidateIds },
            active: true,
            mobile_notes_view: true,
          },
          select: { id: true },
        });
        validShareUserIds = eligibleUsers.map((u) => u.id);
      }
    }

    // Transactional creation
    const created = await prisma.$transaction(async (tx) => {
      const newNote = await tx.note.create({
        data: {
          title,
          noteType,
          content: cleanContent,
          checklistItems: cleanChecklist ? cleanChecklist : undefined,
          color,
          visibility,
          version: 1,
          createdById: auth.userId,
          updatedById: auth.userId,
          shares:
            visibility === 'SELECTED_USERS' && validShareUserIds.length > 0
              ? {
                  createMany: {
                    data: validShareUserIds.map((uid) => ({ userId: uid })),
                  },
                }
              : undefined,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
          shares: { select: { userId: true } },
        },
      });

      // 1. Create immutable initial version (Version 1)
      await tx.noteVersion.create({
        data: {
          noteId: newNote.id,
          versionNumber: 1,
          title,
          noteType,
          content: cleanContent,
          checklistItems: cleanChecklist ? cleanChecklist : undefined,
          color,
          visibility,
          editedById: auth.userId,
        },
      });

      // 2. Create Audit Log
      await tx.noteAuditLog.create({
        data: {
          noteId: newNote.id,
          userId: auth.userId,
          action: 'CREATED',
          details: JSON.stringify({
            title,
            noteType,
            visibility,
            sharedWithCount: validShareUserIds.length,
          }),
        },
      });

      // 3. Create Notifications if shared with selected users
      if (visibility === 'SELECTED_USERS' && validShareUserIds.length > 0) {
        await tx.notification.createMany({
          data: validShareUserIds.map((recipientId) => ({
            userId: recipientId,
            type: 'NOTE_SHARED',
            title: 'New Note Shared With You',
            message: `${newNote.createdBy.name} shared "${title}" with you.`,
            referenceId: newNote.id,
          })),
        });
      }

      return newNote;
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    console.error('[Create Note API]', error);
    return NextResponse.json({ error: 'Couldn\'t save note. Please try again.' }, { status: 500 });
  }
}
