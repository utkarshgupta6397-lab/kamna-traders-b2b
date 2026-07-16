const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const body = {
    appId: "27437923032515686",
    encryptedAccessToken: "••••••••••••••••••••••••••••••••••••••••",
    phoneNumberId: "1241422605717695",
    businessAccountId: "909950158799498",
    apiVersion: "v25.0",
    webhookVerifyToken: "ryt43dw9c1tfhzuomm33jg",
    integrationEnabled: true
  };
  
  const { 
      appId, 
      encryptedAccessToken: incomingToken, 
      phoneNumberId, 
      businessAccountId, 
      apiVersion, 
      webhookVerifyToken, 
      integrationEnabled 
    } = body;
    
  console.log("Parsed integrationEnabled:", integrationEnabled);
  console.log("Boolean(integrationEnabled):", Boolean(integrationEnabled));
}
main().catch(console.error);
