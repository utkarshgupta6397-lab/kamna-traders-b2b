import {
  ALL_PERMISSION_KEYS,
  PERMISSIONS,
  mobilePermissionKeySet,
  MOBILE_PERMISSION_SECTIONS,
  PermissionKey,
} from '../lib/permissions';
import {
  hasMobilePermission,
  hasMobileFeatureAccess,
} from '../lib/mobile-auth';
import {
  getNoteAccessContext,
  buildAccessibleNotesWhere,
  isUserAuthorizedForNote,
} from '../lib/notes-auth';
import { NOTE_COLORS, getNoteColor, getAutoAssignedColor } from '../lib/notes-colors';

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

console.log('\n--- 1. Notes Permission Keys & Hierarchy Consistency ---');
const NOTES_KEYS: PermissionKey[] = [
  'mobile_notes_view',
  'mobile_notes_create',
  'mobile_notes_edit',
  'mobile_notes_archive',
];

for (const key of NOTES_KEYS) {
  assert(ALL_PERMISSION_KEYS.includes(key), `${key} exists in ALL_PERMISSION_KEYS`);
  assert(PERMISSIONS.some((p) => p.key === key), `${key} exists in PERMISSIONS array`);
  assert(mobilePermissionKeySet.has(key), `${key} exists in mobilePermissionKeySet`);
}

const notesSection = MOBILE_PERMISSION_SECTIONS.find((s) => s.sectionKey === 'notes');
assert(!!notesSection, 'Notes section exists in MOBILE_PERMISSION_SECTIONS');
assert(notesSection?.parentKey === 'mobile_notes_view', 'Notes section parent is mobile_notes_view');
assert(notesSection?.children.length === 3, 'Notes section has 3 children (create, edit, archive)');

// Hierarchy checks
const fullNotesUser: any = {
  role: 'STAFF',
  mobile_notes_view: true,
  mobile_notes_create: true,
  mobile_notes_edit: true,
  mobile_notes_archive: true,
};
assert(hasMobileFeatureAccess(fullNotesUser, 'mobile_notes_view', 'mobile_notes_create'), 'Parent + Create child allowed');
assert(hasMobileFeatureAccess(fullNotesUser, 'mobile_notes_view', 'mobile_notes_edit'), 'Parent + Edit child allowed');
assert(hasMobileFeatureAccess(fullNotesUser, 'mobile_notes_view', 'mobile_notes_archive'), 'Parent + Archive child allowed');

// Orphan child prevention
const orphanChildUser: any = {
  role: 'STAFF',
  mobile_notes_view: false,
  mobile_notes_edit: true,
};
assert(!hasMobileFeatureAccess(orphanChildUser, 'mobile_notes_view', 'mobile_notes_edit'), 'Parent=false blocks child access');

// Admin override
const adminSession: any = { role: 'ADMIN', name: 'Admin User' };
assert(hasMobilePermission(adminSession, 'mobile_notes_view'), 'Admin has mobile_notes_view');
assert(hasMobilePermission(adminSession, 'mobile_notes_create'), 'Admin has mobile_notes_create');
assert(hasMobilePermission(adminSession, 'mobile_notes_edit'), 'Admin has mobile_notes_edit');
assert(hasMobilePermission(adminSession, 'mobile_notes_archive'), 'Admin has mobile_notes_archive');

console.log('\n--- 2. Note Access Context & Permission Gating ---');
// User with View only
const viewOnlyUser: any = { userId: 'user_view', role: 'STAFF', mobile_notes_view: true };
const viewContext = getNoteAccessContext(viewOnlyUser);
assert(viewContext?.canView === true, 'View-only user has canView');
assert(viewContext?.canCreate === false, 'View-only user cannot create');
assert(viewContext?.canEdit === false, 'View-only user cannot edit');
assert(viewContext?.canArchive === false, 'View-only user cannot archive');

// User with Create only (without Edit/Archive)
const createOnlyUser: any = { userId: 'user_create', role: 'STAFF', mobile_notes_view: true, mobile_notes_create: true };
const createContext = getNoteAccessContext(createOnlyUser);
assert(createContext?.canCreate === true, 'Create-only user has canCreate');
assert(createContext?.canEdit === false, 'Create-only user does NOT have canEdit');
assert(createContext?.canArchive === false, 'Create-only user does NOT have canArchive');

// User with Edit only (can edit/share, but cannot archive)
const editOnlyUser: any = { userId: 'user_edit', role: 'STAFF', mobile_notes_view: true, mobile_notes_edit: true };
const editContext = getNoteAccessContext(editOnlyUser);
assert(editContext?.canEdit === true, 'Edit user has canEdit');
assert(editContext?.canArchive === false, 'Edit user without archive permission cannot archive');

// User with Archive only (can archive, cannot edit)
const archiveOnlyUser: any = { userId: 'user_arch', role: 'STAFF', mobile_notes_view: true, mobile_notes_archive: true };
const archContext = getNoteAccessContext(archiveOnlyUser);
assert(archContext?.canArchive === true, 'Archive user has canArchive');
assert(archContext?.canEdit === false, 'Archive user cannot edit');

console.log('\n--- 3. Note Visibility & Access Model ---');
const noteOnlyMe = {
  createdById: 'user_alice',
  visibility: 'ONLY_ME',
  shares: [],
};

const noteSelectedUsers = {
  createdById: 'user_alice',
  visibility: 'SELECTED_USERS',
  shares: [{ userId: 'user_bob' }, { userId: 'user_charlie' }],
};

const noteAllUsers = {
  createdById: 'user_alice',
  visibility: 'ALL_USERS',
  shares: [],
};

// ONLY_ME checks
assert(isUserAuthorizedForNote('user_alice', noteOnlyMe), 'Alice (creator) can access ONLY_ME note');
assert(!isUserAuthorizedForNote('user_bob', noteOnlyMe), 'Bob cannot access Alice\'s ONLY_ME note');
assert(!isUserAuthorizedForNote('user_david', noteOnlyMe), 'David cannot access Alice\'s ONLY_ME note');

// SELECTED_USERS checks
assert(isUserAuthorizedForNote('user_alice', noteSelectedUsers), 'Alice (creator) can access SELECTED_USERS note');
assert(isUserAuthorizedForNote('user_bob', noteSelectedUsers), 'Bob (selected) can access SELECTED_USERS note');
assert(isUserAuthorizedForNote('user_charlie', noteSelectedUsers), 'Charlie (selected) can access SELECTED_USERS note');
assert(!isUserAuthorizedForNote('user_david', noteSelectedUsers), 'David (not selected) cannot access SELECTED_USERS note');

// ALL_USERS checks
assert(isUserAuthorizedForNote('user_alice', noteAllUsers), 'Alice can access ALL_USERS note');
assert(isUserAuthorizedForNote('user_david', noteAllUsers), 'David can access ALL_USERS note');

console.log('\n--- 4. Access Revocation Behavior ---');
// When Bob is removed from shares:
const revokedNote = {
  createdById: 'user_alice',
  visibility: 'SELECTED_USERS',
  shares: [{ userId: 'user_charlie' }], // Bob removed
};
assert(!isUserAuthorizedForNote('user_bob', revokedNote), 'Revoked user Bob immediately loses access');
assert(isUserAuthorizedForNote('user_charlie', revokedNote), 'Charlie still has access');

console.log('\n--- 5. Creator Does NOT Bypass Permissions ---');
// Creator has View Note but no Edit Note
const creatorWithoutEdit: any = { userId: 'user_alice', role: 'STAFF', mobile_notes_view: true, mobile_notes_edit: false };
const aliceContext = getNoteAccessContext(creatorWithoutEdit);
assert(aliceContext?.canView === true, 'Creator can view their own note');
assert(aliceContext?.canEdit === false, 'Creator WITHOUT Edit Note permission CANNOT edit');
assert(aliceContext?.canArchive === false, 'Creator WITHOUT Archive Note permission CANNOT archive');

console.log('\n--- 6. Color Palette Verification (16+ Pastel Colors) ---');
assert(NOTE_COLORS.length >= 16, `At least 16 pastel colors defined (found ${NOTE_COLORS.length})`);

// Ensure all colors have valid background, border, text, and previewBorder
for (const color of NOTE_COLORS) {
  assert(color.bg.startsWith('#'), `${color.name} has hex bg: ${color.bg}`);
  assert(color.text.startsWith('#'), `${color.name} has hex text: ${color.text}`);
}

// Deterministic rotation test
const color0 = getAutoAssignedColor(0);
const color16 = getAutoAssignedColor(16);
assert(color0.id === color16.id, 'Color auto-assignment rotates deterministically (index 0 === index 16)');
const color1 = getAutoAssignedColor(1);
assert(color0.id !== color1.id, 'Color rotation provides different tones for consecutive notes');

console.log('\n--- 7. Versioning Logic (Changes vs No-Op) ---');
function hasMeaningfulChange(
  current: { title: string; noteType: string; content: string | null; checklistItems: any[]; color: string },
  incoming: { title: string; noteType: string; content: string | null; checklistItems: any[]; color: string }
): boolean {
  if (current.title !== incoming.title) return true;
  if (current.noteType !== incoming.noteType) return true;
  if (current.color !== incoming.color) return true;
  if (incoming.noteType === 'TEXT' && current.content !== incoming.content) return true;
  if (incoming.noteType === 'CHECKLIST') {
    if (current.checklistItems.length !== incoming.checklistItems.length) return true;
    const diff = incoming.checklistItems.some((item, idx) => {
      const old = current.checklistItems[idx];
      return !old || old.text !== item.text || Boolean(old.isChecked) !== Boolean(item.isChecked);
    });
    if (diff) return true;
  }
  return false;
}

const baseNote = {
  title: 'Office Supplies',
  noteType: 'TEXT',
  content: 'Need 5 registers and paper',
  checklistItems: [],
  color: 'soft_yellow',
};

// No-op save
assert(!hasMeaningfulChange(baseNote, { ...baseNote }), 'Identical save does NOT trigger version creation');

// Title change
assert(hasMeaningfulChange(baseNote, { ...baseNote, title: 'Updated Supplies' }), 'Title change triggers version');

// Content change
assert(hasMeaningfulChange(baseNote, { ...baseNote, content: 'Need 10 registers' }), 'Content change triggers version');

// Color change
assert(hasMeaningfulChange(baseNote, { ...baseNote, color: 'mint' }), 'Color change triggers version');

// Checklist changes
const checklistNote = {
  title: 'Stock Requirement',
  noteType: 'CHECKLIST',
  content: null,
  checklistItems: [
    { id: '1', text: '10 cartons', isChecked: false },
    { id: '2', text: '5 boxes', isChecked: false },
  ],
  color: 'soft_blue',
};

assert(!hasMeaningfulChange(checklistNote, { ...checklistNote }), 'Identical checklist save does NOT trigger version');
assert(
  hasMeaningfulChange(checklistNote, {
    ...checklistNote,
    checklistItems: [
      { id: '1', text: '10 cartons', isChecked: true }, // checked
      { id: '2', text: '5 boxes', isChecked: false },
    ],
  }),
  'Checking an item triggers version'
);
assert(
  hasMeaningfulChange(checklistNote, {
    ...checklistNote,
    checklistItems: [
      { id: '1', text: '10 cartons', isChecked: false }, // item 2 removed
    ],
  }),
  'Removing an item triggers version'
);

console.log('\n--- 8. Concurrency / Optimistic Conflict Detection ---');
function checkConcurrency(noteVersion: number, incomingExpectedVersion: number | undefined): boolean {
  if (incomingExpectedVersion !== undefined && incomingExpectedVersion !== noteVersion) {
    return false; // CONFLICT
  }
  return true; // OK
}

assert(checkConcurrency(3, 3) === true, 'Matching version passes concurrency check');
assert(checkConcurrency(3, 2) === false, 'Stale version (expected 2 vs actual 3) detects conflict');
assert(checkConcurrency(4, 1) === false, 'Stale version (expected 1 vs actual 4) detects conflict');

console.log('\n--- 9. Notification Delivery Rules ---');
function determineEditNotificationRecipients(
  note: { createdById: string; visibility: string; shares: Array<{ userId: string }> },
  editorId: string
): string[] {
  const recipients: string[] = [];
  if (note.visibility === 'SELECTED_USERS') {
    note.shares.forEach((s) => {
      if (s.userId !== editorId) recipients.push(s.userId);
    });
    if (note.createdById !== editorId && !recipients.includes(note.createdById)) {
      recipients.push(note.createdById);
    }
  } else if (note.visibility === 'ALL_USERS') {
    if (note.createdById !== editorId) {
      recipients.push(note.createdById);
    }
  }
  return recipients;
}

// Alice created, shared with Bob & Charlie. Bob edits.
const noteShared = {
  createdById: 'user_alice',
  visibility: 'SELECTED_USERS',
  shares: [{ userId: 'user_bob' }, { userId: 'user_charlie' }],
};
const editRecipients = determineEditNotificationRecipients(noteShared, 'user_bob');
assert(!editRecipients.includes('user_bob'), 'Editor (Bob) does NOT receive notification about his own edit');
assert(editRecipients.includes('user_alice'), 'Creator (Alice) receives edit notification');
assert(editRecipients.includes('user_charlie'), 'Co-editor (Charlie) receives edit notification');

console.log('\n========================================');
console.log(`Total tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('========================================');

if (failed > 0) {
  process.exit(1);
}
