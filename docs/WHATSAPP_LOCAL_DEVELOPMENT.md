# Local WhatsApp Webhook Development

To test incoming messages and delivery statuses locally, Meta needs a public URL to send webhook events to your local machine.

We use **Cloudflare Tunnels** (`cloudflared`) to achieve this securely without dealing with changing ngrok limits.

---

## 1. Prerequisites

### Install Cloudflared
On macOS:
```bash
brew install cloudflared
```
For Windows/Linux, download from the [Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

### Verify Installation
```bash
cloudflared --version
```

---

## 2. Start the Tunnel

In a new terminal, run the shortcut script from the ERP root:
```bash
npm run cloudflare
```
*(This is equivalent to running `cloudflared tunnel --url http://localhost:3002`)*

Cloudflare will generate a random URL, typically looking like:
`https://random-word-something.trycloudflare.com`

---

## 3. Update Environment Variables

Copy the generated `trycloudflare.com` URL.

Open your `.env` file and update the following lines:

```env
CLOUDFLARE_PUBLIC_URL=https://random-word-something.trycloudflare.com
WHATSAPP_WEBHOOK_URL=https://random-word-something.trycloudflare.com/api/webhooks/whatsapp
```

Restart your Next.js development server to pick up the new variables.

---

## 4. Update Meta Dashboard

1. Go to your [Meta App Dashboard](https://developers.facebook.com/apps).
2. Navigate to **WhatsApp -> Configuration**.
3. Under **Webhook**, click **Edit**.
4. Paste your `WHATSAPP_WEBHOOK_URL` as the **Callback URL**.
5. Paste your Verify Token (found in the ERP Admin panel) into the **Verify Token** field.
6. Click **Verify and Save**.

---

## 5. Verify & Test

1. Open the ERP and navigate to **Admin -> WhatsApp Integration -> Webhooks**.
2. You should see a green **Tunnel Active** badge.
3. Click **Test Webhook Endpoint** to verify the server is reachable.
4. Send a test template message from the ERP.
5. Watch the **Webhook Monitor** on the page. The delivery status should arrive within seconds and appear in the table.

### Local Simulation
If you want to simulate an incoming webhook without using the Meta Dashboard, run:
```bash
npm run whatsapp:webhook:test
```
This will send a mock payload to your local endpoint and it will immediately appear in the ERP Admin Monitor.
