# GrowPilot n8n setup

The repository includes `growpilot-workflow.json`, a working webhook intake workflow:

`GrowPilot Webhook (POST /webhook/growpilot-lead) -> Normalize Lead -> Acknowledge`

It accepts the normalized payload emitted by the agent and returns a small JSON acknowledgement. It does not silently pretend to write Google Sheets: add a Google Sheets node after `Normalize Lead` and connect your own credential before using that destination.

## Local Docker setup

From the repository root:

```bash
docker compose up -d n8n
```

The easiest route is importing through the n8n UI:

1. Open `http://localhost:5680`.
2. Create the local owner account.
3. Choose **Import from File** and select `n8n/growpilot-workflow.json`.
4. Open the workflow and click **Activate**.
5. Open the Webhook node and copy its **Production URL**. It should end in `/webhook/growpilot-lead`.
6. Set the agent's webhook target in `.env`:

```dotenv
N8N_WEBHOOK_URL=http://127.0.0.1:5680/webhook/growpilot-lead
```

Restart the agent after changing `.env`:

```bash
npm run dev
```

With Docker Compose, the agent is already configured to reach n8n by the service name:

```dotenv
CONTAINER_N8N_WEBHOOK_URL=http://n8n:5678/webhook/growpilot-lead
```

Start the stack with `docker compose up -d --build`, then pull the local model separately if you want the Ollama tier:

```bash
docker compose exec ollama ollama pull llama3.2:3b
```

## Google Sheets delivery

After `Normalize Lead`, add **Google Sheets -> Append Row**. Create or select a spreadsheet, create a header row with these fields, and map the node from the normalized `$json` values:

`received_at`, `event`, `lead_name`, `business_type`, `channel`, `need_summary`, `extracted_budget_usd`, `lead_score`, `intent`, `booked_slot`, `tokens_used`, `cost_usd`, `source`

Create an OAuth2 Google credential in n8n, select the spreadsheet and sheet, save, and run **Execute Workflow** once with the webhook test URL. Then activate the workflow and switch the agent back to the production URL. Never commit credentials or a public spreadsheet link.

## Verify the handoff

Run this from the host after the workflow is active:

```bash
curl -i -X POST http://127.0.0.1:5680/webhook/growpilot-lead \\
  -H 'content-type: application/json' \\
  -d '{"event":"test","lead_name":"Demo Lead","lead_score":"HOT_BOOKED","tokens_used":0,"cost_usd":0}'
```

The response should be JSON with `received: true`. Then send a high-budget message in the agent UI and confirm that the resulting CRM/booking event appears in the n8n execution log and, if configured, as a new Google Sheets row. The hosted Vercel demo cannot reach a laptop's `127.0.0.1`; use a public HTTPS n8n URL or connect the UI to your own backend origin for hosted delivery.
