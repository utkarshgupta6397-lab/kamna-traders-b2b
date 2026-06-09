import fs from 'fs';

function addSearchParams(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  // 1. Add import if missing
  if (!content.includes('useSearchParams')) {
    if (content.includes("from 'next/navigation'")) {
      content = content.replace(/import\s+\{([^}]+)\}\s+from\s+'next\/navigation';/, "import { $1, useSearchParams } from 'next/navigation';");
    } else {
      content = content.replace(/import\s+[^;]+;/, "$&\nimport { useSearchParams } from 'next/navigation';");
    }
  }

  // 2. Add const searchParams = useSearchParams(); inside the component
  const compRegex = /export\s+default\s+function\s+\w+\([^)]*\)\s*\{/;
  if (compRegex.test(content) && !content.includes('const searchParams = useSearchParams()')) {
    content = content.replace(compRegex, "$&\n  const searchParams = useSearchParams();");
  }

  fs.writeFileSync(file, content);
  console.log(`Fixed ${file}`);
}

addSearchParams('src/app/staff/dashboard/accounts/dcr/pending-serials/[id]/AllocateSerialsClient.tsx');
addSearchParams('src/app/staff/dashboard/accounts/dcr/hold-queue/HoldQueueClient.tsx');
addSearchParams('src/app/staff/dashboard/accounts/dcr/ready-to-issue/ReadyToIssueClient.tsx');
addSearchParams('src/app/staff/dashboard/accounts/dcr/review/[id]/ReviewClient.tsx');
