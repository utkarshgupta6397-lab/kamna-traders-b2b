import { prisma } from '../lib/db';
import { buildAccessibleNotesWhere, isUserAuthorizedForNote } from '../lib/notes-auth';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function runIntegrationTests() {
  console.log('\n--- Notes Database Integration Tests ---');

  // Find or create 2 test users
  const userA = await prisma.user.upsert({
    where: { mobile: '9999900001' },
    update: { active: true, mobile_notes_view: true, mobile_notes_create: true, mobile_notes_edit: true, mobile_notes_archive: true },
    create: {
      name: 'Test Alice',
      mobile: '9999900001',
      role: 'STAFF',
      active: true,
      mobile_notes_view: true,
      mobile_notes_create: true,
      mobile_notes_edit: true,
      mobile_notes_archive: true,
    },
  });

  const userB = await prisma.user.upsert({
    where: { mobile: '9999900002' },
    update: { active: true, mobile_notes_view: true, mobile_notes_create: true, mobile_notes_edit: true, mobile_notes_archive: true },
    create: {
      name: 'Test Bob',
      mobile: '9999900002',
      role: 'STAFF',
      active: true,
      mobile_notes_view: true,
      mobile_notes_create: true,
      mobile_notes_edit: true,
      mobile_notes_archive: true,
    },
  });

  const userC = await prisma.user.upsert({
    where: { mobile: '9999900003' },
    update: { active: true, mobile_notes_view: true, mobile_notes_create: true, mobile_notes_edit: false, mobile_notes_archive: false },
    create: {
      name: 'Test Charlie',
      mobile: '9999900003',
      role: 'STAFF',
      active: true,
      mobile_notes_view: true,
      mobile_notes_create: true,
      mobile_notes_edit: false,
      mobile_notes_archive: false,
    },
  });

  let testNoteId = '';

  try {
    // 1. Create Note
    const createdNote = await prisma.$transaction(async (tx) => {
      const note = await tx.note.create({
        data: {
          title: 'Budh Vihar Stock Requirement',
          noteType: 'CHECKLIST',
          checklistItems: [
            { id: '1', text: '10 cartons', isChecked: false },
            { id: '2', text: '5 boxes', isChecked: false },
          ],
          color: 'soft_yellow',
          visibility: 'ONLY_ME',
          version: 1,
          createdById: userA.id,
          updatedById: userA.id,
        },
      });

      await tx.noteVersion.create({
        data: {
          noteId: note.id,
          versionNumber: 1,
          title: note.title,
          noteType: note.noteType,
          checklistItems: note.checklistItems || undefined,
          color: note.color,
          visibility: note.visibility,
          editedById: userA.id,
        },
      });

      await tx.noteAuditLog.create({
        data: {
          noteId: note.id,
          userId: userA.id,
          action: 'CREATED',
        },
      });

      return note;
    });

    testNoteId = createdNote.id;
    assert(!!createdNote.id, 'Note created in database with CUID');
    assert(createdNote.version === 1, 'Initial note version is 1');

    // Verify version 1 exists
    const v1 = await prisma.noteVersion.findUnique({
      where: {
        noteId_versionNumber: {
          noteId: testNoteId,
          versionNumber: 1,
        },
      },
    });
    assert(v1?.title === 'Budh Vihar Stock Requirement', 'Immutable Version 1 recorded in DB');

    // 2. Personal Pinning
    await prisma.notePin.create({
      data: {
        noteId: testNoteId,
        userId: userA.id,
      },
    });

    const userAPins = await prisma.notePin.findMany({ where: { userId: userA.id, noteId: testNoteId } });
    const userBPins = await prisma.notePin.findMany({ where: { userId: userB.id, noteId: testNoteId } });
    assert(userAPins.length === 1, 'Note is pinned for User A');
    assert(userBPins.length === 0, 'Note is NOT pinned for User B (Pinning is strictly user-specific)');

    // 3. Update Note -> Creates Version 2
    const updatedNote = await prisma.$transaction(async (tx) => {
      const updated = await tx.note.update({
        where: { id: testNoteId },
        data: {
          title: 'Budh Vihar Stock Requirement (Urgent)',
          version: 2,
          updatedById: userA.id,
        },
      });

      await tx.noteVersion.create({
        data: {
          noteId: testNoteId,
          versionNumber: 2,
          title: 'Budh Vihar Stock Requirement (Urgent)',
          noteType: 'CHECKLIST',
          color: 'soft_yellow',
          visibility: 'ONLY_ME',
          editedById: userA.id,
        },
      });

      return updated;
    });

    assert(updatedNote.version === 2, 'Note version incremented to 2');

    // Verify both versions exist
    const allVersions = await prisma.noteVersion.findMany({
      where: { noteId: testNoteId },
      orderBy: { versionNumber: 'desc' },
    });
    assert(allVersions.length === 2, 'Two immutable versions exist in DB');
    assert(allVersions[0].versionNumber === 2 && allVersions[0].title.includes('Urgent'), 'Version 2 is newest');
    assert(allVersions[1].versionNumber === 1 && !allVersions[1].title.includes('Urgent'), 'Version 1 remains unchanged (immutable)');

    // 4. Sharing: Share with User B
    await prisma.$transaction(async (tx) => {
      await tx.note.update({
        where: { id: testNoteId },
        data: { visibility: 'SELECTED_USERS' },
      });
      await tx.noteShare.create({
        data: {
          noteId: testNoteId,
          userId: userB.id,
        },
      });
    });

    const noteWithShares = await prisma.note.findUnique({
      where: { id: testNoteId },
      include: { shares: true },
    });

    assert(isUserAuthorizedForNote(userB.id, noteWithShares!), 'User B can now access shared note');
    assert(!isUserAuthorizedForNote(userC.id, noteWithShares!), 'User C cannot access note (not in shares)');

    // 5. Revocation: Remove User B from shares
    await prisma.noteShare.deleteMany({
      where: { noteId: testNoteId, userId: userB.id },
    });

    const revokedNote = await prisma.note.findUnique({
      where: { id: testNoteId },
      include: { shares: true },
    });

    assert(!isUserAuthorizedForNote(userB.id, revokedNote!), 'User B immediately loses access after revocation');
    const versionsAfterRevoke = await prisma.noteVersion.count({ where: { noteId: testNoteId } });
    assert(versionsAfterRevoke === 2, 'Version history preserved intact after share revocation');

    // 6. Archiving
    await prisma.note.update({
      where: { id: testNoteId },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedById: userA.id,
      },
    });

    // Check accessible query filters
    const activeNotesForA = await prisma.note.findMany({
      where: {
        ...buildAccessibleNotesWhere(userA.id),
        isArchived: false,
      },
    });
    assert(!activeNotesForA.some((n) => n.id === testNoteId), 'Archived note is excluded from active listings');

    const archivedNotesForA = await prisma.note.findMany({
      where: {
        ...buildAccessibleNotesWhere(userA.id),
        isArchived: true,
      },
    });
    assert(archivedNotesForA.some((n) => n.id === testNoteId), 'Archived note appears in archived listing');

  } finally {
    // Cleanup
    if (testNoteId) {
      await prisma.notification.deleteMany({ where: { referenceId: testNoteId } });
      await prisma.notePin.deleteMany({ where: { noteId: testNoteId } });
      await prisma.noteShare.deleteMany({ where: { noteId: testNoteId } });
      await prisma.noteVersion.deleteMany({ where: { noteId: testNoteId } });
      await prisma.noteAuditLog.deleteMany({ where: { noteId: testNoteId } });
      await prisma.note.deleteMany({ where: { id: testNoteId } });
    }
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id, userC.id] } },
    });
  }

  console.log('\n========================================');
  console.log(`Integration tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runIntegrationTests().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
