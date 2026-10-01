import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('CheckedUploadModal - Upload Metadata UI & Semantics', () => {
  const modalFilePath = path.join(process.cwd(), 'src/components/dispatch/post-dispatch/CheckedUploadModal.tsx');
  const modalContent = fs.readFileSync(modalFilePath, 'utf-8');

  it('1. Renames labels to UPLOADED BY and UPLOADED AT without required asterisks', () => {
    assert.match(modalContent, /Uploaded By/i, 'Must contain "Uploaded By" label');
    assert.match(modalContent, /Uploaded At/i, 'Must contain "Uploaded At" label');
    assert.doesNotMatch(modalContent, /Checked By \*/i, 'Must NOT contain "Checked By *"');
    assert.doesNotMatch(modalContent, /Checked At \*/i, 'Must NOT contain "Checked At *"');
    assert.doesNotMatch(modalContent, /Uploaded By \*/i, 'Must NOT contain "Uploaded By *" (asterisk removed)');
    assert.doesNotMatch(modalContent, /Uploaded At \*/i, 'Must NOT contain "Uploaded At *" (asterisk removed)');
  });

  it('2. Removes editable input boxes for Checked By and Checked At', () => {
    // Should NOT have an input for checkedBy
    assert.doesNotMatch(
      modalContent,
      /<input[^>]*value=\{checkedBy\}/i,
      'Must NOT have an editable input bound to checkedBy'
    );
    // Should NOT have datetime-local input
    assert.doesNotMatch(
      modalContent,
      /<input[^>]*type="datetime-local"/i,
      'Must NOT have datetime-local input'
    );
    // Should NOT have the old helper text prompting manual entry
    assert.doesNotMatch(
      modalContent,
      /Enter the name of the staff member who conducted the physical check/i,
      'Must NOT have helper text asking user to enter checker name'
    );
  });

  it('3. Renders a compact, secondary metadata section indicating automatic recording', () => {
    assert.match(
      modalContent,
      /Automatically recorded on submission/i,
      'Must indicate that metadata is automatically recorded on submission'
    );
    assert.match(
      modalContent,
      /uploaderName/,
      'Must display the uploader name'
    );
    assert.match(
      modalContent,
      /formattedUploadedAt/,
      'Must display formatted upload timestamp'
    );
  });

  it('4. Uses submission time for upload timestamp rather than modal opening time', () => {
    assert.match(
      modalContent,
      /const submissionTime = new Date\(\)/,
      'Must generate submissionTime when submitting'
    );
    assert.match(
      modalContent,
      /formData\.append\(['"]uploadedAt['"], submissionTime\.toISOString\(\)\)/,
      'Must append submissionTime as uploadedAt in formData'
    );
  });

  it('5. Modal header title focuses on Physical Check Evidence', () => {
    assert.match(
      modalContent,
      /<h3[^>]*>Physical Check Evidence<\/h3>/,
      'Modal header title must be Physical Check Evidence'
    );
  });

  it('6. Submit Evidence button is not blocked by manual text input', () => {
    assert.doesNotMatch(
      modalContent,
      /!checkedBy\.trim\(\)/,
      'Submit button disabled state must NOT depend on !checkedBy.trim()'
    );
  });
});
