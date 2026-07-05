const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/solar-orders/documentation-dashboard',
  method: 'GET',
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.items) {
      console.log(`Documentation Queue items length: ${json.items.length}`);
    } else {
      console.log('Error or no items', json);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
