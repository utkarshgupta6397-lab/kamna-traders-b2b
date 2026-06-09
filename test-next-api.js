const http = require('http');
http.get('http://localhost:3000/api/admin/dcr/serial-registry?page=1&limit=50&q=&status=ALL&vendorDcrStatus=ALL', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});
