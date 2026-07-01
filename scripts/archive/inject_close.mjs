import fs from 'fs';

function applyCloseLogic(filePath, pattern, replacement) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(pattern, replacement);
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath}`);
}

// 1. Pending Serials [id] (AllocateSerialsClient.tsx)
const pendingSerialsClient = 'src/app/staff/dashboard/accounts/dcr/pending-serials/[id]/AllocateSerialsClient.tsx';
let pcContent = fs.readFileSync(pendingSerialsClient, 'utf8');
// find the toast.success('Serials successfully allocated!'); block
pcContent = pcContent.replace(
  /toast\.success\('Serials successfully allocated!'\);\s*router\.push\('\/staff\/dashboard\/accounts\/dcr\/pending-serials'\);/,
  `toast.success('Serials successfully allocated!');
      if (searchParams.get('source') === 'customer_lookup') {
        window.close();
      } else {
        router.push('/staff/dashboard/accounts/dcr/pending-serials');
      }`
);
fs.writeFileSync(pendingSerialsClient, pcContent);
console.log('Updated AllocateSerialsClient.tsx');


// 2. Pending Serials List (PendingSerialsClient.tsx)
// No need to close the list, user clicks into it... wait.
// If the user goes to `/staff/dashboard/accounts/dcr/pending-serials/123`, the AllocateSerialsClient is used. So that's handled.


// 3. Hold Queue (HoldQueueClient.tsx)
const holdQueueClient = 'src/app/staff/dashboard/accounts/dcr/hold-queue/HoldQueueClient.tsx';
let hqContent = fs.readFileSync(holdQueueClient, 'utf8');
hqContent = hqContent.replace(
  /toast\.success\(`\$\{successCount\} serial\(s\) released successfully!`\);([\s\S]*?)fetchSerials\(\);/m,
  `toast.success(\`\${successCount} serial(s) released successfully!\`);$1fetchSerials();
      if (searchParams.get('source') === 'customer_lookup') {
        setTimeout(() => window.close(), 1000);
      }`
);
fs.writeFileSync(holdQueueClient, hqContent);
console.log('Updated HoldQueueClient.tsx');


// 4. Ready To Issue (ReadyToIssueClient.tsx)
const readyToIssueClient = 'src/app/staff/dashboard/accounts/dcr/ready-to-issue/ReadyToIssueClient.tsx';
let riContent = fs.readFileSync(readyToIssueClient, 'utf8');
riContent = riContent.replace(
  /toast\.success\(`\$\{selectedSerials\.size\} serial\(s\) issued successfully!`\);([\s\S]*?)fetchSerials\(\);/m,
  `toast.success(\`\${selectedSerials.size} serial(s) issued successfully!\`);$1fetchSerials();
      if (searchParams.get('source') === 'customer_lookup') {
        setTimeout(() => window.close(), 1000);
      }`
);
fs.writeFileSync(readyToIssueClient, riContent);
console.log('Updated ReadyToIssueClient.tsx');


// 5. Review Invoice (ReviewClient.tsx)
const reviewClient = 'src/app/staff/dashboard/accounts/dcr/review/[id]/ReviewClient.tsx';
let rContent = fs.readFileSync(reviewClient, 'utf8');
// For save
rContent = rContent.replace(
  /\} else \{\s*router\.push\(`\/staff\/dashboard\/accounts\/dcr\?\$\{currentParamsString\}`\);\s*\}/g,
  `} else {
        if (searchParams.get('source') === 'customer_lookup') {
          window.close();
        } else {
          router.push(\`/staff/dashboard/accounts/dcr?\${currentParamsString}\`);
        }
      }`
);
// For save next no-more
rContent = rContent.replace(
  /toast\.success\('No more invoices pending review'\);\s*router\.push\(`\/staff\/dashboard\/accounts\/dcr\?\$\{currentParamsString\}`\);/g,
  `toast.success('No more invoices pending review');
          if (searchParams.get('source') === 'customer_lookup') {
            window.close();
          } else {
            router.push(\`/staff/dashboard/accounts/dcr?\${currentParamsString}\`);
          }`
);
fs.writeFileSync(reviewClient, rContent);
console.log('Updated ReviewClient.tsx');

