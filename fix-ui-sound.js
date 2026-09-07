const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldSoundLogic = `              if (audioRef.current) {
                audioRef.current.play().catch(e => {
                  console.warn('Audio play restricted by browser:', e);
                });
              }`;

const newSoundLogic = `              if (audioRef.current) {
                audioRef.current.play().catch(e => {
                  console.warn('Audio play restricted by browser:', e);
                });
                
                // Play second time after a short natural gap
                setTimeout(() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(e => console.warn('Second audio play restricted:', e));
                  }
                }, 800); // 800ms gap
              }`;

content = content.replace(oldSoundLogic, newSoundLogic);

fs.writeFileSync(filePath, content, 'utf8');
console.log('UI sound fixed to play twice.');
