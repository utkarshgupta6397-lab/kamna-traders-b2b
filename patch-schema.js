const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'prisma/schema.prisma');
let content = fs.readFileSync(file, 'utf8');

const replacement = `  detailsFetchError     String?
  zohoLockStatus                 String?   @default("NOT_ATTEMPTED")
  zohoLockValue                  Boolean?
  zohoLockAttemptedAt            DateTime?
  zohoLockVerifiedAt             DateTime?
  zohoLockRequestJson            Json?
  zohoLockPutResponseJson        Json?
  zohoLockVerificationResponseJson Json?
  zohoLockHttpStatus             Int?
  zohoLockError                  String?`;

content = content.replace("  detailsFetchError     String?", replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('Schema patched.');
