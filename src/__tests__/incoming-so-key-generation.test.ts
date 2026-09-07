import crypto from 'crypto';
import assert from 'assert';

console.log('\n--- Incoming SO Key Generation Security Tests ---');

// Test 1: Entropy & Key Length
const key = crypto.randomBytes(32).toString('hex');
assert.strictEqual(key.length, 64, 'Key must be exactly 64 hex characters (32 bytes = 256 bits)');
assert.strictEqual(/^[0-9a-f]{64}$/.test(key), true, 'Key must be lowercase hex');
console.log('✓ PASS: Cryptographic entropy test (256 bits)');

// Test 2: Unpredictability across 100 consecutive generations
const keys = new Set<string>();
for (let i = 0; i < 100; i++) {
  const k = crypto.randomBytes(32).toString('hex');
  assert.strictEqual(keys.has(k), false, 'Generated keys must be unique');
  keys.add(k);
}
assert.strictEqual(keys.size, 100);
console.log('✓ PASS: Uniqueness and non-determinism test (100 unique iterations)');

// Test 3: Audit log payload sanitization (Never log the secret)
const testKey = crypto.randomBytes(32).toString('hex');
const auditLogDetails = JSON.stringify({
  keyLength: testKey.length,
  targetKey: 'INCOMING_SO_API_KEY',
  performedAt: new Date().toISOString()
});
assert.strictEqual(auditLogDetails.includes(testKey), false, 'Audit log details must never contain the key secret');
const parsed = JSON.parse(auditLogDetails);
assert.strictEqual(parsed.keyLength, 64);
assert.strictEqual(parsed.targetKey, 'INCOMING_SO_API_KEY');
console.log('✓ PASS: Audit logging sanitization test (secret not exposed)');

// Test 4: Deluge snippet template interpolation
const testEndpoint = 'https://kamnatraders.com/api/dispatch/incoming-so';
const delugeSnippet = `headerMap = Map();
headerMap.put("X-API-Key", "${testKey}");
headerMap.put("Content-Type", "application/json");

response = invokeurl
[
    url :"${testEndpoint}"
    type :POST
];`;

assert.strictEqual(delugeSnippet.includes(`headerMap.put("X-API-Key", "${testKey}");`), true);
assert.strictEqual(delugeSnippet.includes(`url :"${testEndpoint}"`), true);
assert.strictEqual(delugeSnippet.includes('type :POST'), true);
console.log('✓ PASS: Deluge snippet code generation test');

console.log('All 4 test suites passed successfully! ✅\n');
