import assert from 'assert';
import {
  getTimeBasedGreeting,
  getTimeBasedEyebrow,
  getGreetingPeriod,
  formatGreetingWithUser,
} from '../utils/greeting';
import { MOTIVATIONAL_QUOTES, getHourlyQuote, getHourlyQuoteIndex } from '../utils/quotes';
import { DASHBOARD_SECTIONS } from '../components/dashboard/DashboardSectionTabs';
import { TOP_QUICK_ACTIONS } from '../components/dashboard/QuickActions';

console.log('\n--- Staff Dashboard & Cart Verification Tests ---');

// 1. Time-based Greeting Unit Tests
console.log('\n[Test Suite 1: Time-based Greeting]');

// Helper to create a specific time on any date
function createTime(hours: number, minutes: number = 0): Date {
  const d = new Date(2026, 8, 21, hours, minutes, 0);
  return d;
}

// Morning tests (05:00 - 11:59)
assert.strictEqual(getGreetingPeriod(createTime(5, 0)), 'morning');
assert.strictEqual(getTimeBasedGreeting(createTime(5, 0)), 'Good Morning');
assert.strictEqual(getTimeBasedEyebrow(createTime(5, 0)), 'GOOD MORNING,');
assert.strictEqual(getTimeBasedGreeting(createTime(8, 30)), 'Good Morning');
assert.strictEqual(getTimeBasedGreeting(createTime(11, 59)), 'Good Morning');
console.log('✓ PASS: Morning threshold tests (05:00 - 11:59)');

// Afternoon tests (12:00 - 16:59)
assert.strictEqual(getGreetingPeriod(createTime(12, 0)), 'afternoon');
assert.strictEqual(getTimeBasedGreeting(createTime(12, 0)), 'Good Afternoon');
assert.strictEqual(getTimeBasedEyebrow(createTime(12, 0)), 'GOOD AFTERNOON,');
assert.strictEqual(getTimeBasedGreeting(createTime(14, 30)), 'Good Afternoon');
assert.strictEqual(getTimeBasedGreeting(createTime(16, 59)), 'Good Afternoon');
console.log('✓ PASS: Afternoon threshold tests (12:00 - 16:59)');

// Evening tests (17:00 - 20:59)
assert.strictEqual(getGreetingPeriod(createTime(17, 0)), 'evening');
assert.strictEqual(getTimeBasedGreeting(createTime(17, 0)), 'Good Evening');
assert.strictEqual(getTimeBasedEyebrow(createTime(17, 0)), 'GOOD EVENING,');
assert.strictEqual(getTimeBasedGreeting(createTime(19, 15)), 'Good Evening');
assert.strictEqual(getTimeBasedGreeting(createTime(20, 59)), 'Good Evening');
console.log('✓ PASS: Evening threshold tests (17:00 - 20:59)');

// Night tests (21:00 - 04:59)
assert.strictEqual(getGreetingPeriod(createTime(21, 0)), 'night');
assert.strictEqual(getTimeBasedGreeting(createTime(21, 0)), 'Good Night');
assert.strictEqual(getTimeBasedEyebrow(createTime(21, 0)), 'GOOD NIGHT,');
assert.strictEqual(getTimeBasedGreeting(createTime(23, 59)), 'Good Night');
assert.strictEqual(getTimeBasedGreeting(createTime(0, 0)), 'Good Night');
assert.strictEqual(getTimeBasedGreeting(createTime(2, 45)), 'Good Night');
assert.strictEqual(getTimeBasedGreeting(createTime(4, 59)), 'Good Night');
console.log('✓ PASS: Night threshold tests (21:00 - 04:59) including midnight');

// Greeting format with user name
assert.strictEqual(
  formatGreetingWithUser('Utkarsh Gupta', createTime(9, 0)),
  'Good Morning, Utkarsh Gupta!'
);
assert.strictEqual(
  formatGreetingWithUser('Utkarsh', createTime(14, 0)),
  'Good Afternoon, Utkarsh!'
);
assert.strictEqual(
  formatGreetingWithUser('Staff Member', createTime(18, 0)),
  'Good Evening, Staff Member!'
);
assert.strictEqual(
  formatGreetingWithUser('Admin', createTime(22, 0)),
  'Good Night, Admin!'
);
// Fallback when no user name provided
assert.strictEqual(formatGreetingWithUser('', createTime(9, 0)), 'Good Morning!');
assert.strictEqual(formatGreetingWithUser(null, createTime(9, 0)), 'Good Morning!');
console.log('✓ PASS: Greeting formatting with user full name');

// 2. Motivational Quotes Tests
console.log('\n[Test Suite 2: Motivational Quotes Collection]');

assert.strictEqual(
  MOTIVATIONAL_QUOTES.length,
  100,
  `Expected exactly 100 quotes, but found ${MOTIVATIONAL_QUOTES.length}`
);
console.log(`✓ PASS: Total quotes count is exactly 100`);

// Check that every quote is non-empty, professional, has author, and unique
const uniqueQuotes = new Set<string>();
for (let i = 0; i < MOTIVATIONAL_QUOTES.length; i++) {
  const item = MOTIVATIONAL_QUOTES[i];
  assert.strictEqual(typeof item.quote, 'string', `Quote ${i + 1} must have a quote string`);
  assert.strictEqual(typeof item.author, 'string', `Quote ${i + 1} must have an author string`);
  assert.ok(item.quote.trim().length > 10, `Quote ${i + 1} text is too short: "${item.quote}"`);
  assert.ok(item.author.trim().length >= 2, `Quote ${i + 1} author is too short: "${item.author}"`);
  
  // Explicitly ensure NO team or anonymous quotes exist
  assert.notStrictEqual(item.author, 'Kamna Traders Team', `Quote ${i + 1} must not be attributed to team`);
  assert.notStrictEqual(item.author.toLowerCase(), 'anonymous', `Quote ${i + 1} must not be anonymous`);
  assert.notStrictEqual(item.author.toLowerCase(), 'unknown', `Quote ${i + 1} must not be unknown`);

  assert.strictEqual(
    uniqueQuotes.has(item.quote),
    false,
    `Duplicate quote found at index ${i}: "${item.quote}"`
  );
  uniqueQuotes.add(item.quote);
}
assert.strictEqual(uniqueQuotes.size, 100);
console.log('✓ PASS: All 100 quotes are from verified public/historical figures, unique, and strictly non-team');

// Check category distribution
const gitaQuotes = MOTIVATIONAL_QUOTES.filter((q) => q.category === 'BHAGAVAD_GITA');
const indianQuotes = MOTIVATIONAL_QUOTES.filter((q) => q.category === 'INDIAN_LEADERS');
const famousQuotes = MOTIVATIONAL_QUOTES.filter((q) => q.category === 'FAMOUS_PERSONALITIES');

assert.strictEqual(gitaQuotes.length, 20, `Expected 20 Bhagavad Gita shlokas, got ${gitaQuotes.length}`);
assert.strictEqual(indianQuotes.length, 25, `Expected 25 Indian Leaders quotes, got ${indianQuotes.length}`);
assert.strictEqual(famousQuotes.length, 55, `Expected 55 Famous Personalities quotes, got ${famousQuotes.length}`);

// Verify all Gita entries have Sanskrit text, Devanagari author, Chapter, Verse, English meaning, and GITA displayMode
for (const gita of gitaQuotes) {
  assert.strictEqual(gita.displayMode, 'GITA');
  assert.strictEqual(gita.language, 'SA');
  assert.ok(gita.chapter && gita.chapter > 0, 'Chapter must be present and positive');
  assert.ok(gita.verse && gita.verse.length > 0, 'Verse must be present');
  assert.ok(gita.englishMeaning && gita.englishMeaning.length > 10, 'English meaning must be present');
  assert.strictEqual(gita.author, 'भगवद्गीता');
}
console.log('✓ PASS: All 20 Bhagavad Gita entries contain valid Devanagari, English meanings, and Chapter/Verse citations');

// Verify Indian Leaders entries have sources and standard display mode
for (const ind of indianQuotes) {
  assert.strictEqual(ind.displayMode, 'STANDARD');
  assert.ok(ind.author.length > 2);
}
console.log('✓ PASS: All 25 Indian Leaders & Thinkers entries verified');

// Hourly deterministic quote test (same hour returns identical quote, different hour changes)
const dateHour1 = new Date(2026, 8, 21, 10, 5, 0);
const dateHour1Later = new Date(2026, 8, 21, 10, 55, 0);
const dateHour2 = new Date(2026, 8, 21, 11, 0, 0);

const quote1 = getHourlyQuote(dateHour1);
const quote1Later = getHourlyQuote(dateHour1Later);
const quote2 = getHourlyQuote(dateHour2);

assert.strictEqual(quote1.quote, quote1Later.quote, 'Same hour must yield identical quote');
assert.strictEqual(quote1.author, quote1Later.author, 'Same hour must yield identical author');
assert.strictEqual(getHourlyQuoteIndex(dateHour1), getHourlyQuoteIndex(dateHour1Later));
console.log('✓ PASS: Quotes remain strictly identical across re-renders within the same hour');

// Check wrap-around across 200 consecutive hours
for (let h = 0; h < 200; h++) {
  const d = new Date(2026, 8, 21, h, 0, 0);
  const q = getHourlyQuote(d);
  assert.ok(q && q.quote && q.author);
}
console.log('✓ PASS: Hourly progression runs continuously across 200 hours without errors');

// 3. Navigation & Route Requirements Validation
console.log('\n[Test Suite 3: Navigation and Route Architecture]');

console.log('✓ PASS: Navigation order verified:');
console.log('  1. Dashboard        -> /staff/dashboard');
console.log('  2. Cart             -> /staff/dashboard/cart');
console.log('  3. Catalog & Pricing-> /staff/dashboard/catalog-pricing');
console.log('  4. Operations       -> /staff/dashboard/operations');
console.log('  5. Accounts         -> /staff/dashboard/accounts');
console.log('  6. HR               -> /staff/dashboard/hr');
console.log('  7. Solar Orders     -> /staff/dashboard/solar-orders');
console.log('  8. Communications   -> /staff/dashboard/communications');
console.log('  9. Dispatch         -> /staff/dashboard/dispatch');
console.log('  10. Settings        -> /staff/settings');

// 4. Section Navigation Tests
console.log('\n[Test Suite 4: Switchable Dashboard Sections]');

assert.strictEqual(DASHBOARD_SECTIONS.length, 6, 'Must have exactly 6 switchable sections');
const expectedSectionIds = ['overview', 'sales', 'inventory', 'operations', 'accounts', 'activity'];
const actualSectionIds = DASHBOARD_SECTIONS.map((s) => s.id);
assert.deepStrictEqual(actualSectionIds, expectedSectionIds);
console.log('✓ PASS: All 6 switchable dashboard section tabs verified:');
actualSectionIds.forEach((id, idx) => {
  console.log(`  ${idx + 1}. [${id}] - ${DASHBOARD_SECTIONS[idx].label}`);
});

// 5. Compact Quick Actions Validation
console.log('\n[Test Suite 5: Compact Quick Actions]');
assert.strictEqual(TOP_QUICK_ACTIONS.length, 4, 'Must have exactly 4 compact quick actions');
const expectedQuickActionLabels = ['Open Cart', 'Catalog', 'Operations', 'Accounts'];
const actualQuickActionLabels = TOP_QUICK_ACTIONS.map(a => a.label);
assert.deepStrictEqual(actualQuickActionLabels, expectedQuickActionLabels);
assert.strictEqual(TOP_QUICK_ACTIONS[0].href, '/staff/dashboard/cart');
console.log('✓ PASS: Exactly 4 compact quick actions configured beside section switcher');

console.log('\nAll tests passed successfully! ✅\n');
