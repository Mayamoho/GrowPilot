# GrowPilot — Cost-Optimized GTM Engineering & 24/7 Cached AI Agent Suite

**Live Deployment (Vercel):** [https://growpilot-ashy.vercel.app/](https://growpilot-ashy.vercel.app/)  
**GTM Pipeline Subdomain:** [https://gtm.abukawser.xyz](https://gtm.abukawser.xyz)  
**24/7 FAQ & Booking Agent Subdomain:** [https://agent.abukawser.xyz](https://agent.abukawser.xyz)  
**GitHub Repository:** [https://github.com/Mayamoho/GrowPilot](https://github.com/Mayamoho/GrowPilot)

GrowPilot is an end-to-end AI automation and Go-To-Market (GTM) engineering platform designed to run customer-facing qualification agents and outbound pipelines at **near-zero token cost**. It combines **Layer 0 deterministic caching**, **HTML boilerplate stripping**, **ICP score gating**, **smallest-model routing** (`Gemini 3.1 Flash-Lite`, `Gemini 3.8 Flash`, and local open-source `Ollama Llama 3.2 3B`), and a **5-layer groundedness verifier** to eliminate hallucinated claims.

---

## 1. Detailed Technical Overview & Agent Workflow

```text
Incoming Request (Scraped Web Page / WhatsApp Message / Website Chat)
   │
   ├──► [Stage 1: Layer 0 Normalized Cache]
   │       ├── Exact or Jaccard keyword/token similarity >= 62%?
   │       └── YES ──► Return cached response in <5ms (0 Tokens, $0.000000)
   │
   ├──► [Stage 2: Input Compression & Sliding Window]
   │       ├── GTM Pipeline: Strip <script>, <style>, <nav>, <footer>, SVG (~80% token reduction)
   │       └── Chat Agent: Trim conversation history to last 6 turns (prevents context bloat)
   │
   ├──► [Stage 3: ICP Fit Score Gate (0–100)]
   │       ├── Evaluates B2B/automation buying signals & pain points before LLM generation
   │       └── Score < Threshold (e.g., < 60) ──► Halt LLM call & log as Skipped (saves 100% generation tokens)
   │
   ├──► [Stage 4: Smallest-Model Router]
   │       ├── Tier 0 (Local Open-Source): Ollama `llama3.2:3b` ($0.00 / 1M tokens)
   │       ├── Tier 1 (Fast Cloud Router): `gemini-3.1-flash-lite` ($0.075 / 1M input tokens)
   │       └── Tier 2 (Structured Generation): `gemini-3.8-flash` ($0.15 / 1M input tokens, strict JSON schema)
   │
   └──► [Stage 5: 5-Layer Groundedness Verification & CRM Sync]
           ├── Layer 1: Target entity presence check
           ├── Layer 2: Numerical claim cross-check against source text (zero fabricated numbers)
           ├── Layer 3: Key fact overlap validation
           ├── Layer 4: Anti-injection & placeholder sanitization
           └── Layer 5: Channel length & CTA compliance ──► Sync qualified lead to CRM / n8n Webhook
```

### Core Modules
1. **Autonomous GTM Pipeline (`gtm.abukawser.xyz`)**:
   - Accepts raw HTML or text from prospect websites and industry articles.
   - Strips DOM boilerplate to reduce prompt tokens by up to 80%.
   - Computes an ICP Match Score (`0–100`) and blocks low-fit prospects before invoking generation models.
   - Generates grounded Cold Emails, WhatsApp Business openers, and LinkedIn posts verified by the 5-layer groundedness gate.
   - Exports analyzed leads (`Company Name`, `Industry`, `ICP Match Score`, `Tokens Saved %`, `Cost USD`) to CSV.
2. **24/7 FAQ & Lead Qualification Agent (`agent.abukawser.xyz`)**:
   - Answers recurring product/service FAQs instantly via the Layer 0 cache at `$0.00` token cost.
   - Routes novel lead messages through a 6-turn sliding context window to extract monthly budget, business vertical, and timeline.
   - Automatically books discovery call slots for qualified leads (`Budget >= $500/mo`) and logs records to the CRM table.
   - Includes a real-time **Gemini Live API (`/live` WebSocket)** voice qualification mode (`gemini-3.8-live`) with function calling (`book_discovery_call`).
3. **Token & Cost Benchmark Lab**:
   - Interactive simulator comparing monthly token spend across `Ollama Llama 3.2 3B ($0.00)`, `Gemini 3.1 Flash-Lite ($0.075/1M)`, `Gemini 3.8 Flash ($0.15/1M)`, and `Frontier Baseline ($3.00/1M)`.
4. **Docker & n8n Setup Hub**:
   - Provides ready-to-run `docker-compose.yml`, `Dockerfile`, and importable `n8n` workflow JSON.

---

## 2. Local Setup & Running on Ubuntu 24.04 LTS

### Prerequisites
- **Ubuntu 24.04 LTS** (or any Linux / macOS / Windows WSL2 system)
- **Node.js 20+** and **npm** (for running directly)
- **Docker** and **Docker Compose v2** (`docker compose` plugin, for containerized deployment)

### Step 1: Clone the Repository
```bash
git clone https://github.com/Mayamoho/GrowPilot.git
cd GrowPilot
```
*(Note: If you previously got `no configuration file provided: not found` when running `docker compose up -d`, pull the latest commit (`git pull origin main`) which includes `docker-compose.yml` and `Dockerfile` in the root folder).*

### Step 2: Configure Environment Variables
```bash
cp .env.example .env
```
Open `.env` and add your free Google AI Studio Gemini API Key (get one in 15 seconds at [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)):
```env
GEMINI_API_KEY="AIzaSy_YOUR_GEMINI_API_KEY"
PORT=3000
OLLAMA_MODEL="llama3.2:3b"
```
*(Note: Even without a `GEMINI_API_KEY`, GrowPilot automatically falls back to its built-in deterministic engine and local Ollama model so every feature works out of the box).*

---

### Option A: Run Directly with Node.js (Fastest for Development)
```bash
# 1. Install dependencies
npm install

# 2. Run unit tests (verifies boilerplate stripper, cache, ICP gate, and 5-layer groundedness)
npm test

# 3. Start the full-stack Express + Vite server on port 3000
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

### Option B: Run with Docker Compose on Ubuntu 24.04 (Agent + Ollama + n8n)
Make sure you are inside the root `GrowPilot` directory where `docker-compose.yml` is located:
```bash
# Verify docker-compose.yml exists in your current folder
ls -la docker-compose.yml

# Build and start GrowPilot Agent (port 3000), Ollama (port 11434), and n8n (port 5678)
docker compose up -d --build

# Check container status
docker compose ps

# View live logs
docker compose logs -f growpilot-agent
```
Once running:
- **GrowPilot Web & API**: `http://localhost:3000`
- **Self-Hosted n8n Automation Editor**: `http://localhost:5678`
- **Local Ollama LLM API (`llama3.2:3b`)**: `http://localhost:11434`

To stop all containers:
```bash
docker compose down
```

---

## 3. Deploying to Vercel (`https://growpilot-ashy.vercel.app/`)

GrowPilot includes a built-in client-side execution fallback and `vercel.json` configuration so it runs seamlessly on Vercel with zero configuration:

1. Push this repository to GitHub (`https://github.com/Mayamoho/GrowPilot`).
2. Go to **[vercel.com/new](https://vercel.com/new)** and import your `Mayamoho/GrowPilot` repository.
3. Use the default Vite settings:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Click **Deploy**. Your app will be live at `https://growpilot-ashy.vercel.app/`.

---

## 4. Linking Subdomains (`gtm.abukawser.xyz` & `agent.abukawser.xyz`) with Vercel

GrowPilot automatically detects the subdomain in `src/App.tsx`:
- Visiting **`gtm.<your-domain>`** (`https://gtm.abukawser.xyz`) opens **01. GTM Pipeline** by default.
- Visiting **`agent.<your-domain>`** (`https://agent.abukawser.xyz`) opens **02. 24/7 FAQ & Booking Agent** by default.

### Step-by-Step Subdomain Setup (Vercel + Cloudflare / DNS Registrar)

#### Step 1: Add Both Subdomains in Vercel
1. Open your project in the **Vercel Dashboard** (`growpilot-ashy`).
2. Go to **Settings → Domains**.
3. Type `gtm.abukawser.xyz` and click **Add**.
4. Type `agent.abukawser.xyz` and click **Add**.
5. Vercel will show the required `CNAME` target (typically `cname.vercel-dns.com`).

#### Step 2: Add the CNAME Records in Your DNS Provider (Cloudflare / Namecheap / etc.)
1. Open your DNS dashboard for `abukawser.xyz` (e.g., **Cloudflare → `abukawser.xyz` → DNS → Records**).
2. Remove any conflicting wildcard (`*`) records or old tunnel records for `gtm` and `agent`.
3. Add two `CNAME` records:

| Type | Name (Subdomain) | Target | Proxy Status (if using Cloudflare) |
| :--- | :--- | :--- | :--- |
| `CNAME` | `gtm` | `cname.vercel-dns.com` | **DNS Only (Grey Cloud)** *(recommended during SSL issuance)* |
| `CNAME` | `agent` | `cname.vercel-dns.com` | **DNS Only (Grey Cloud)** *(recommended during SSL issuance)* |

4. Wait 1–2 minutes for Vercel to issue the Let's Encrypt SSL certificates. Both **[https://gtm.abukawser.xyz](https://gtm.abukawser.xyz)** and **[https://agent.abukawser.xyz](https://agent.abukawser.xyz)** will be live over HTTPS.

---

## 5. API Endpoints Reference (Full-Stack / Docker Mode)

| Method & Endpoint | Description |
| :--- | :--- |
| `GET /api/state` | Returns current FAQ knowledge base, analyzed GTM records, CRM bookings, and token telemetry. |
| `POST /api/gtm/analyze` | Runs the GTM pipeline: checks Layer 0 cache, strips HTML boilerplate, scores ICP fit, routes to selected LLM, and runs the 5-layer groundedness check. |
| `POST /api/agent/chat` | Processes 24/7 WhatsApp/Web messages via Layer 0 FAQ cache (`0 tokens`) or 6-turn sliding-window LLM router and books qualified leads. |
| `POST /api/faq/add` | Adds a new FAQ entry to the Layer 0 cache for instant zero-token responses. |
| `POST /api/cache/clear` | Clears the Layer 0 in-memory cache to benchmark cold LLM inference. |
| `WS /live` | Bidirectional WebSocket endpoint for real-time voice qualification via `gemini-3.8-live`. |

---

## 6. Running Unit Tests

```bash
npm test
```
Runs the Node.js native test suite (`src/utils/agentEngine.test.ts`) validating:
1. HTML & boilerplate stripping token reduction (`stripHtmlAndBoilerplate`)
2. Layer 0 exact and semantic FAQ cache matching (`matchFaqCache`)
3. Token cost calculation across Ollama, Gemini Flash-Lite, Gemini Flash, and Frontier models (`calculateRunCost`)
4. ICP fit score calculation and low-ICP token gate (`evaluateIcpFit`)
5. 5-layer groundedness verification against fabricated numbers and entities (`verifyGroundedness`)
6. Sliding conversation window memory trimming (`trimConversationWindow`)
7. CSV lead export formatting (`formatGtmLeadsCsv`)
