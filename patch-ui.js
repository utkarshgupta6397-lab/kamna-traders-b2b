const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports
content = content.replace(
  "import { Search, RefreshCw, Inbox, FileDown, AlertTriangle } from 'lucide-react';",
  "import { Search, RefreshCw, Inbox, FileDown, AlertTriangle, Lock, Unlock, AlertCircle, Loader2, X } from 'lucide-react';"
);

// 2. Add interface fields
content = content.replace(
  "  status: string;",
  `  status: string;
  zohoLockStatus?: string;
  zohoLockValue?: boolean;
  zohoLockAttemptedAt?: string;
  zohoLockVerifiedAt?: string;
  zohoLockHttpStatus?: number;
  zohoLockError?: string;`
);

fs.writeFileSync(file, content, 'utf8');
console.log('UI Patched step 1');
