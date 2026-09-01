const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/lib/enrich-so.ts');
let content = fs.readFileSync(file, 'utf8');

// Add import
content = content.replace(
  "import { getZohoOrgId, getZohoTokens } from '@/lib/zoho-auth';",
  "import { getZohoOrgId, getZohoTokens } from '@/lib/zoho-auth';\nimport { buildZohoCustomFieldsPayload } from '@/lib/zoho-custom-fields';"
);

const putLogic = `
    console.log(\`[INCOMING SO][\${requestId}] Final database update successful.\`);
    
    // --- STEP 3-5: CUSTOM FIELD UPDATE PUT ---
    try {
      const customFieldsToUpdate = { cf_is_locked: true };
      const cfPayload = await buildZohoCustomFieldsPayload(customFieldsToUpdate);
      
      if (cfPayload.length > 0) {
        console.log(\`[INCOMING SO][\${requestId}] Updating custom fields... payload:\`, JSON.stringify(cfPayload));
        const putUrl = \`\${apiBase}/books/v3/salesorders/\${salesorderId}?organization_id=\${orgId}\`;
        
        const putResponse = await fetch(putUrl, {
          method: 'PUT',
          headers: {
            'Authorization': \`Zoho-oauthtoken \${accessToken}\`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ custom_fields: cfPayload })
        });
        
        if (!putResponse.ok) {
          const errText = await putResponse.text().catch(() => '');
          console.error(\`[INCOMING SO][\${requestId}] Zoho custom field update failed: \${putResponse.status} \${errText}\`);
        } else {
          console.log(\`[INCOMING SO][\${requestId}] Zoho custom field update SUCCESS.\`);
        }
      }
    } catch (putErr) {
      console.error(\`[INCOMING SO][\${requestId}] Error during custom field PUT update:\`, putErr);
    }
    // -----------------------------------------
    
    // Emit update event so UI re-renders with enriched data`;

content = content.replace(
  "    console.log(`[INCOMING SO][${requestId}] Final database update successful.`);\n    \n    // Emit update event so UI re-renders with enriched data",
  putLogic
);

fs.writeFileSync(file, content, 'utf8');
console.log('enrich-so.ts updated.');
