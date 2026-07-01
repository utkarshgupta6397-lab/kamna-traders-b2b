const http = require('http');
const req = http.request('http://localhost:3002/api/admin/dcr/serial-registry?page=1&limit=50&q=&status=ALL&vendorDcrStatus=ALL', {
  headers: {
    'Cookie': 'session=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJjbXAybjRjNDUwMDAwanYwNHAyd2IwaHd4Iiwicm9sZSI6IkFETUlOIiwic2Vzc2lvblRva2VuIjoiZWFhODg3OTctN2EwZi00MGJjLTg5NWYtMGIxNzlhNTNkZmIzIiwiZGV2aWNlVHlwZSI6ImRlc2t0b3AiLCJleHBpcmVzIjoiMjAyNi0wNi0xMFQwNToxNDoxOC4zNDVaIiwiaWF0IjoxNzgwOTgyMDU4LCJleHAiOjE3ODEwNjg0NTh9.8cmgHocIQFoC902MPEaJHP5ev35UMS9EU_DkoESWkAU'
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', data.substring(0, 200));
  });
});
req.end();
