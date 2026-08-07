const http = require('http');
const options = { hostname: 'localhost', port: 3012, path: '/staff', method: 'GET', headers: { 'Host': 'localhost:3012' } };
const req = http.request(options, (res) => { console.log('STATUS:', res.statusCode); });
req.on('error', console.error); req.end();
