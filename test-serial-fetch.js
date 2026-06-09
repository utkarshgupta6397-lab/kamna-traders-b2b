const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const serial = await prisma.dcrSerial.findFirst();
  console.log("Found serial:", serial.serialNumber);

  const http = require('http');
  const reqData = JSON.stringify({
    serialNumber: serial.serialNumber,
    correctionType: 'CHANGE_SERIAL',
    newValues: { serialNumber: serial.serialNumber + 'X' },
    reason: 'Testing change serial'
  });

  console.log("PAYLOAD:", reqData);

  const req = http.request('http://localhost:3000/api/admin/dcr/serial-corrections', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'session=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJjbXAybjRjNDUwMDAwanYwNHAyd2IwaHd4Iiwicm9sZSI6IkFETUlOIiwic2Vzc2lvblRva2VuIjoiZWFhODg3OTctN2EwZi00MGJjLTg5NWYtMGIxNzlhNTNkZmIzIiwiZGV2aWNlVHlwZSI6ImRlc2t0b3AiLCJleHBpcmVzIjoiMjAyNi0wNi0xMFQwNToxNDoxOC4zNDVaIiwiaWF0IjoxNzgwOTgyMDU4LCJleHAiOjE3ODEwNjg0NTh9.8cmgHocIQFoC902MPEaJHP5ev35UMS9EU_DkoESWkAU'
    }
  }, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      console.log('STATUS:', res.statusCode);
      console.log('RESPONSE:', data);
      process.exit(0);
    });
  });
  req.write(reqData);
  req.end();
}
main();
