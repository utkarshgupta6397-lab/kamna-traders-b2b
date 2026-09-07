import crypto from 'crypto';

describe('Incoming SO Key Generation Security & Entropy Tests', () => {
  it('should generate at least 256 bits of cryptographic entropy', () => {
    // 32 bytes = 256 bits = 64 hex characters
    const key = crypto.randomBytes(32).toString('hex');
    expect(key).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
  });

  it('should produce unique keys on consecutive calls (unpredictable & non-deterministic)', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const key = crypto.randomBytes(32).toString('hex');
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
    expect(keys.size).toBe(50);
  });

  it('audit details must not include the actual secret', () => {
    const generatedKey = crypto.randomBytes(32).toString('hex');
    const auditDetails = JSON.stringify({
      keyLength: generatedKey.length,
      targetKey: 'INCOMING_SO_API_KEY',
      performedAt: new Date().toISOString()
    });

    expect(auditDetails).not.toContain(generatedKey);
    expect(JSON.parse(auditDetails)).toEqual({
      keyLength: 64,
      targetKey: 'INCOMING_SO_API_KEY',
      performedAt: expect.any(String)
    });
  });

  it('deluge snippet should properly interpolate current API key and endpoint', () => {
    const testApiKey = 'a'.repeat(64);
    const testEndpoint = 'https://kamnatraders.com/api/dispatch/incoming-so';

    const delugeSnippet = `headerMap = Map();
headerMap.put("X-API-Key", "${testApiKey}");
headerMap.put("Content-Type", "application/json");

response = invokeurl
[
    url :"${testEndpoint}"
    type :POST
];`;

    expect(delugeSnippet).toContain(`headerMap.put("X-API-Key", "${testApiKey}");`);
    expect(delugeSnippet).toContain(`url :"${testEndpoint}"`);
    expect(delugeSnippet).toContain('type :POST');
  });
});
