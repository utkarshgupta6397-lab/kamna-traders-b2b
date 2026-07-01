const fs = require('fs');
const http = require('http');

const run = async () => {
  const req = http.request({
    hostname: 'localhost',
    port: 3002,
    path: '/fonts/Inter-Bold.ttf?v=4',
    method: 'GET'
  }, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    let data = [];
    res.on('data', (chunk) => {
      data.push(chunk);
    });
    res.on('end', () => {
      const buffer = Buffer.concat(data);
      console.log(`BODY LENGTH: ${buffer.length}`);
      if (buffer.length < 1000) {
        console.log(`BODY: ${buffer.toString()}`);
      }
    });
  });
  req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
  });
  req.end();
};

run();
