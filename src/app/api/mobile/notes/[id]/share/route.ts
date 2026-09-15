import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getNoteAccessContext, isUserAuthorizedForNote } from '@/lib/notes-auth';

export const dynamic = 'force-dynamic';

export async function PUT(
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
    let { visibility, selectedUserIds } = body;

    const note = await prisma.note.findUnique({
      where: { id },
      include: {
        shares: { select: { userId: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (!isUserAuthorizedForNote(auth.userId, note)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const validVisibilities = ['ONLY_ME', 'SELECTED_USERS', 'ALL_USERS'];
    if (!validVisibilities.includes(visibility)) {
      visibility = note.visibility;
    }

    // Filter valid recipient user IDs
    let validShareUserIds: string[] = [];
    if (visibility === 'SELECTED_USERS' && Array.isArray(selectedUserIds)) {
      const candidateIds = Array.from(new Set(selectedUserIds)).filter(
        (uid): uid is string => typeof uid === 'string' && uid !== note.createdById
      );
      if (candidateIds.length > 0) {
        const eligibleUsers = await prisma.user.findMany({
          where: {
            id: { in: candidateIds },
            active: true,
            mobile_notes_view: true,
          },
          select: { id: true, name: true },
        });
        validShareUserIds = eligibleUsers.map((u) => u.id);
      }
    }

    const currentShareUserIds = note.shares.map((s) => s.userId);
    const newlyAddedUserIds = validShareUserIds.filter((uid) => !currentShareUserIds.includes(uid));
    const removedUserIds = currentShareUserIds.filter((uid) => !validShareUserIds.includes(uid));

    await prisma.$transaction(async (tx) => {
      // 1. Update Note visibility
      await tx.note.update({
        where: { id },
        data: {
          visibility,
          updatedById: auth.userId,
        },
      });

      // 2. Update NoteShare entries
      if (visibility === 'SELECTED_USERS') {
        // Remove users no longer in list
        if (removedUserIds.length > 0) {
          await tx.noteShare.deleteMany({
            where: {
              noteId: id,
              userId: { in: removedUserIds },
            },
          });
        }
        // Add new users
        if (newlyAddedUserIds.length > 0) {
          await tx.noteShare.createMany({
            data: newlyAddedUserIds.map((uid) => ({
              noteId: id,
              userId: uid,
            })),
            skipDuplicates: true,
          });
        }
      } else {
        // If changed to ONLY_ME or ALL_USERS, clean up existing shares
        await tx.noteShare.deleteMany({
          where: { noteId: id },
        });
      }

      // 3. Create Audit Logs
      if (note.visibility !== visibility) {
        await tx.noteAuditLog.create({
          data: {
            noteId: id,
            userId: auth.userId,
            action: 'VISIBILITY_CHANGED',
            details: JSON.stringify({
              from: note.visibility,
              to: visibility,
            }),
          },
        });
      }

      if (newlyAddedUserIds.length > 0) {
        await tx.noteAuditLog.create({
          data: {
            noteId: id,
            userId: auth.userId,
            action: 'SHARED',
            details: JSON.stringify({
              addedUserIds: newlyAddedUserIds,
            }),
          },
        });
      }

      if (removedUserIds.length > 0) {
        await tx.noteAuditLog.create({
          data: {
            noteId: id,
            userId: auth.userId,
            action: 'UNSHARED',
            details: JSON.stringify({
              removedUserIds: removedUserIds,
            }),
          },
        });
      }

      // 4. Send notifications to newly added users
      if (newlyAddedUserIds.length > 0) {
        const actorName = session?.name || 'Staff';
        await tx.notification.createMany({
          data: newlyAddedUserIds.map((recipientId) => ({
            userId: recipientId,
            type: 'NOTE_SHARED',
            title: 'New Note Shared With You',
            message: `${actorName} shared "${note.title}" with you.`,
            referenceId: id,
          })),
        });
      }
    });

    // Return updated note with shares
    const updatedNote = await prisma.note.findUnique({
      where: { id },
      include: {
        shares: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedNote,
    });
  } catch (error: any) {
    console.error('[Share Note API]', error);
    return NextResponse.json({ error: 'Couldn\'t update sharing. Please try again.' }, { status: 500 });
  }
}
