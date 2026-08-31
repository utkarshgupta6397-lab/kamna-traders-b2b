const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove audioRef
content = content.replace(/const audioRef = useRef<HTMLAudioElement \| null>\(null\);\n/, '');
content = content.replace(/audioRef\.current = new Audio\('\/sounds\/dispatch-bell\.wav'\);\n\s*audioRef\.current\.load\(\);\n/, '');

// 2. Remove the notification and audio playing logic inside onmessage
content = content.replace(/\/\/ Notification[\s\S]*?\/\/ Play second time after a short natural gap[\s\S]*?}, 800\); \/\/ 800ms gap\n\s*\}\n/g, '');

fs.writeFileSync(file, content, 'utf8');
console.log('Cleaned up IncomingQueueClient.');
