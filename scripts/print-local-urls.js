const os = require('os');

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const ip = getLanIp();

console.log(`
\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAMNA ERP — LOCAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m

\x1b[1mDesktop:\x1b[0m
http://${ip}:3000

\x1b[1mMobile:\x1b[0m
http://${ip}:3000/mobile

\x1b[36mPhone + Mac must be on the same Wi-Fi
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m
`);
