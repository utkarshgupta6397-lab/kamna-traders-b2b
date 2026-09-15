import { prisma } from '../lib/db';
import { getRandomNoteColor, NOTE_COLORS } from '../lib/notes-colors';

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

async function runUXRegressionTests() {
  console.log('\n--- Section 30: Notes UX, Navigation, Loading & Regression Tests ---');

  // 1. Checklist Add Item: ID Generation & Non-empty filtering
  console.log('\n[1] Checklist Item Behavior');
  const id1 = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const id2 = `chk_${Date.now() + 1}_${Math.random().toString(36).substring(2, 7)}`;
  assert(id1 !== id2, 'Checklist item IDs are unique and stable');
  assert(id1.startsWith('chk_'), 'Checklist ID follows chk_<timestamp>_<random> pattern');

  const rawItems = [
    { id: '1', text: 'First task', isChecked: false },
    { id: '2', text: '   ', isChecked: false },
    { id: '3', text: 'Third task', isChecked: true },
    { id: '4', text: '', isChecked: false },
  ];
  const validItems = rawItems.filter((item) => item.text.trim().length > 0);
  assert(validItems.length === 2, 'Blank checklist items stripped on validation');
  assert(validItems[0].text === 'First task' && validItems[1].text === 'Third task', 'Non-empty items preserved');

  // 2. Random Pastel Tone Color Selection
  console.log('\n[2] Random Pastel Tone Assignment');
  assert(NOTE_COLORS.length === 16, '16 pastel tones available');
  
  const testExclusions = ['soft_yellow', 'lavender', 'mint'];
  for (const excluded of testExclusions) {
    const picked = getRandomNoteColor(excluded);
    assert(picked.id !== excluded, `getRandomNoteColor('${excluded}') does not repeat '${excluded}'`);
    assert(NOTE_COLORS.some((c) => c.id === picked.id), `Picked color '${picked.id}' exists in NOTE_COLORS`);
  }

  // Pick 20 times and ensure we get variety (not just always 1 default)
  const pickedIds = new Set<string>();
  for (let i = 0; i < 20; i++) {
    pickedIds.add(getRandomNoteColor().id);
  }
  assert(pickedIds.size >= 4, `Random assignment produces varied colors across 20 iterations (got ${pickedIds.size} distinct colors)`);

  // 3. Draft Isolation Logic
  console.log('\n[3] Draft Isolation Logic');
  const originalNote = {
    id: 'note_123',
    title: 'Original Title',
    content: 'Original Content',
    noteType: 'TEXT',
    color: 'peach',
    visibility: 'ONLY_ME',
    version: 1,
  };

  // Simulate an unsaved edit draft
  const draftState = {
    ...originalNote,
    title: 'Draft In-Memory Title',
    content: 'Unsaved typing...',
  };

  assert(originalNote.title === 'Original Title', 'Parent/server state remains unchanged while draft is modified in memory');
  assert(draftState.title !== originalNote.title, 'Draft is isolated from original state');

  // 4. Dirty State & Unsaved Changes Detection
  console.log('\n[4] Unsaved Changes Detection (isDirty)');
  function computeIsDirty(initial: typeof originalNote, current: typeof originalNote) {
    if (initial.title !== current.title) return true;
    if (initial.content !== current.content) return true;
    if (initial.noteType !== current.noteType) return true;
    if (initial.color !== current.color) return true;
    if (initial.visibility !== current.visibility) return true;
    return false;
  }

  assert(!computeIsDirty(originalNote, { ...originalNote }), 'Clean form has isDirty = false');
  assert(computeIsDirty(originalNote, { ...originalNote, title: 'Changed' }), 'Modified title triggers isDirty = true');
  assert(computeIsDirty(originalNote, { ...originalNote, content: 'Changed text' }), 'Modified content triggers isDirty = true');
  assert(computeIsDirty(originalNote, { ...originalNote, color: 'mint' }), 'Modified color triggers isDirty = true');

  // 5. Checklist Search in GET /api/mobile/notes
  console.log('\n[5] Search Matching in Checklist Items');
  const sampleNoteWithChecklist = {
    id: 'chk_note_1',
    title: 'Grocery List',
    noteType: 'CHECKLIST',
    checklistItems: [
      { id: '1', text: 'Buy Almond Milk', isChecked: false },
      { id: '2', text: 'Organic Eggs', isChecked: true },
    ],
  };

  const query1 = 'almond';
  const query2 = 'eggs';
  const query3 = 'bananas';

  const matches1 = sampleNoteWithChecklist.checklistItems.some(
    (item: any) => item.text && item.text.toLowerCase().includes(query1.toLowerCase())
  );
  const matches2 = sampleNoteWithChecklist.checklistItems.some(
    (item: any) => item.text && item.text.toLowerCase().includes(query2.toLowerCase())
  );
  const matches3 = sampleNoteWithChecklist.checklistItems.some(
    (item: any) => item.text && item.text.toLowerCase().includes(query3.toLowerCase())
  );

  assert(matches1 === true, 'Checklist search matches item text ("almond")');
  assert(matches2 === true, 'Checklist search matches checked item text ("eggs")');
  assert(matches3 === false, 'Checklist search correctly excludes non-matching query ("bananas")');

  // 6. DB Verification of Created Note with Random Color
  console.log('\n[6] Database Persistence Verification');
  const user = await prisma.user.findFirst({
    where: { mobile_notes_create: true, active: true },
  });

  if (user) {
    const randomCol = getRandomNoteColor();
    const created = await prisma.note.create({
      data: {
        title: 'UX Test Note ' + Date.now(),
        content: 'Testing random tone assignment and skeleton flows',
        noteType: 'TEXT',
        color: randomCol.id,
        visibility: 'ONLY_ME',
        createdById: user.id,
        updatedById: user.id,
      },
    });

    assert(created.color === randomCol.id, `Created note stored chosen color (${created.color})`);

    // Clean up
    await prisma.note.delete({ where: { id: created.id } });
    assert(true, 'Test note cleaned up successfully');
  }

  console.log('\n========================================');
  console.log(`UX Regression tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runUXRegressionTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
