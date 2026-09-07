const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/admin/incoming-so/IncomingSOClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldScriptEnd = `response = invokeurl
[
    url :"\\\${currentEndpoint}"
    type :POST
    parameters: payload.toString()
    headers: headerMap
    detailed: true
];

info response;
result.put("success", true);
result.put("response", response);
return result;\`;`;

const newScriptEnd = `response = invokeurl
[
    url :"\\\${currentEndpoint}"
    type :POST
    parameters: payload.toString()
    headers: headerMap
    detailed: true
];

info response;

responseCode = response.get("responseCode");
responseText = response.get("responseText");

if (responseCode == 200 || responseCode == 201) {
    // Check if the ERP explicitly returned { "success": true }
    // Optional depending on Zoho's JSON parsing, but checking HTTP 200 is a minimum safe assumption
    result.put("success", true);
    result.put("message", "Sales Order pushed to Dispatch");
} else {
    result.put("success", false);
    result.put("message", "Dispatch failed (HTTP " + responseCode + "): " + responseText);
}

return result;\`;`;

// Using replace with careful string matching
if (content.includes('result.put("success", true);')) {
  // Regex to replace the end of the deluge script safely
  const regex = /response = invokeurl[\s\S]*?return result;`;/;
  content = content.replace(regex, newScriptEnd.replace(/\\\$/g, '$'));
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed deluge script');
} else {
  console.log('Could not find the script to replace');
}
