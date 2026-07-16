const http = require('http');
const crypto = require('crypto');

const PORT = 3002;
const ENDPOINT = '/api/webhooks/whatsapp';

const payload = {
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "12345",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "16505551111",
              "phone_number_id": "123456123"
            },
            "statuses": [
              {
                "id": `wamid.mock-${Date.now()}`,
                "status": "delivered",
                "timestamp": Math.floor(Date.now() / 1000).toString(),
                "recipient_id": "16505551111"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
};

const payloadString = JSON.stringify(payload);

// Usually, Meta calculates sha256 of the payload using the App Secret. 
// For our test script, we just send a mock signature, as our webhook currently doesn't 
// strictly validate the signature in dev mode (it just logs it).
const mockSignature = "sha256=" + crypto.createHmac('sha256', 'mock_secret').update(payloadString).digest('hex');

const options = {
  hostname: 'localhost',
  port: PORT,
  path: ENDPOINT,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payloadString),
    'x-hub-signature-256': mockSignature
  }
};

const req = http.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  res.on('end', () => {
    console.log('\n====================================');
    console.log(`TEST WEBHOOK SENT TO ${ENDPOINT}`);
    console.log('====================================');
    console.log(`Response Status : ${res.statusCode}`);
    console.log(`Response Body   : ${responseData}`);
    console.log('====================================\n');
  });
});

req.on('error', (e) => {
  console.error(`\n[ERROR] Problem with request: ${e.message}`);
  console.log('Is the local server running on port 3002?');
});

req.write(payloadString);
req.end();
