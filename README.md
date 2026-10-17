# GrowPilot

**An outbound GTM pipeline and 24/7 customer booking agent designed to keep your AI token bill near zero — and never make up a single fact.**

---

## Why we built this (in plain English)

When teams try to use AI to find leads or answer customer messages on WhatsApp and their website, they almost always run into two frustrating problems:

1. **They burn money on things that shouldn't cost tokens at all.**
   - On the **outbound sales side**, standard scrapers grab a prospect's entire webpage — including `<script>` tags, CSS styles, navigation bars, and cookie footers — and dump all of it into an expensive model. Worse, they pay the model to write cold emails to websites that aren't even real prospects (like a personal blog or an unrelated directory).
   - On the **inbound support side**, 60% to 70% of customer messages ask the exact same ten questions (*"How much does this cost?"*, *"How fast can you set it up?"*, *"Do you work with WhatsApp?"*). Calling an LLM from scratch every single time someone asks your price is slow and wasteful.

2. **The AI invents numbers, awards, or promises you never made.**
   - Left unchecked, language models love to "hallucinate" — congratulating a prospect on a funding round that never happened, inventing a statistic that wasn't in their article, or quoting the wrong price to a customer.

**GrowPilot solves both problems by putting plain, deterministic TypeScript code in front of and behind the AI model.** Code strips the HTML junk, code checks a fast local cache before spending a single token, code scores whether a prospect is worth emailing, and code verifies every number in the final output against the source text. The AI model is only called when you genuinely need fresh writing or live lead qualification — and even then, it uses small, fast models (`Gemini 3.1 Flash-Lite`, `Gemini 3.8 Flash`, or a free local `Ollama Llama 3.2 3B` container).

---

## Try it live right now

You don't need to install anything to test the full workbench. We host three live entry points on Vercel:

| Live Link | What it opens |
|---|---|
| **[https://growpilot-ashy.vercel.app/](https://growpilot-ashy.vercel.app/)** | **Full GrowPilot Workbench** — gives you access to all four tabs (`GTM Pipeline`, `24/7 FAQ & Booking Agent`, `Token & Cost Lab`, and `Architecture & Setup`). |
| **[https://gtm.abukawser.xyz](https://gtm.abukawser.xyz)** | **Direct GTM Pipeline View** — opens straight into the outbound scraper, HTML boilerplate stripper, ICP fit scorer (`0–100`), 5-layer fact checker, and one-click CSV lead exporter. |
| **[https://agent.abukawser.xyz](https://agent.abukawser.xyz)** | **Direct 24/7 Customer Agent View** — opens straight into the WhatsApp/Web FAQ & lead-qualification simulator, live token trace inspector, custom FAQ rule editor, and CRM booking log. |

> **How the two subdomains work:** Both `gtm.abukawser.xyz` and `agent.abukawser.xyz` point to the same deployment (`src/App.tsx` checks `window.location.hostname` on load). If the hostname starts with `agent.`, it opens the **24/7 FAQ & Booking Agent** tab automatically; otherwise it opens the **GTM Pipeline** tab. You can also deep-link to any tab using `?tab=gtm-studio`, `?tab=whatsapp-agent`, `?tab=cost-lab`, or `?tab=ubuntu-deploy`.

---

## How the agent works (Step-by-Step Walkthrough)

GrowPilot is split into four clean workspaces inside the app. Here is what happens under the hood in each one.

### 1. Outbound GTM Pipeline (`gtm.abukawser.xyz`)

When you paste a prospect's webpage HTML (or pick one of the built-in presets like *DentaCare Aesthetic & Implant Center* or *CloudScale B2B Commerce*) and click **Run GTM Pipeline**, the request goes through six steps in order:

```text
[Raw Webpage HTML]
       │
       ▼
1. HTML Boilerplate Stripper (Code) ──► Strips <script>, <style>, <nav>, <footer> (saves ~70–80% input tokens)
       │
       ▼
2. Layer 0 Cache Check (Code)       ──► Already analyzed this URL + threshold? Return in <5ms for 0 tokens ($0.00)
       │
       ▼
3. ICP Fit Score Gate (Code, 0–100) ──► Score below your slider (e.g. <60)? Stop here & spend 0 outbound tokens
       │
       ▼
4. Smallest-Model Router (AI Model) ──► Drafts Summary + Cold Email + WhatsApp Opener + LinkedIn Post
       │
       ▼
5. 5-Layer Fact & Groundedness Gate ──► Checks every number & claim against the stripped source text
       │
       ▼
6. Synced CRM & CSV Export (Code)   ──► Saves to the CRM table and exports clean rows via "Download CSV"
```

* **What happens when a lead is a bad fit?** Try clicking the **Vintage Postcard Collectors Archive** preset (a personal hobby site that doesn't sell anything) and hit **Run GTM Pipeline**. The scorer gives it `5/100`, sees that `5` is below your `60/100` gate, marks it as `SKIPPED_LOW_ICP`, and refuses to call the outbound writing model. You don't waste a penny on bad leads.
* **How does the 5-Layer Fact Check stop hallucinations?** Before any generated email or social post is marked verified, `verifyGroundedness()` in `src/utils/agentEngine.ts` runs five checks in code:
  1. **Target Name Check:** Confirms the prospect's actual company name is anchored in the message.
  2. **Number & Metric Check:** Extracts every number in the generated email/post and checks that those numbers actually existed in the prospect's source text. If the model invents `"87 branches"` or `"942% growth"` out of thin air, Layer 2 flags and blocks it immediately.
  3. **Source Fact Overlap:** Verifies that at least 75% of the extracted bullet points share real words with the stripped webpage text.
  4. **Anti-Hype Filter:** Blocks fake awards, made-up funding rounds, or unrealistic ROI promises.
  5. **Prompt-Injection Screen:** Ensures scraped websites can't sneak hidden `"ignore previous instructions"` commands into your pipeline.

---

### 2. 24/7 FAQ & Lead Booking Agent (`agent.abukawser.xyz`)

This workspace runs the inbound customer side — designed for WhatsApp Business and website chat widgets where prospects ask questions at all hours and want to book consultations.

Every time a customer sends a message, here is what happens:

1. **Safety Screen First:** It checks the message for prompt-injection attempts (`ignore previous instructions`, etc.). If someone tries to trick the bot, it blocks the message in code for `0` tokens.
2. **Layer 0 FAQ Cache (`0 Tokens · <5ms`):** It normalizes the customer's question and compares it against your **Layer 0 FAQ Cache** (which you can edit live in the UI by clicking **+ Add FAQ Rule**).
   - If the customer is asking a standard question like *"What are your pricing plans and monthly cost?"*, it answers immediately from cache in `2–4ms` for **0 tokens ($0.00)**.
   - However, if the customer mentions their own business or a budget number (like *"We run a dental clinic and have a $1,200/month budget"*), the cache intentionally steps aside and hands the message to the qualification engine.
3. **6-Turn Sliding Memory Window:** Long chat threads are one of the biggest hidden costs in AI apps. `trimConversationWindow()` keeps only the **last 6 messages** in context so a 40-message conversation never bloats your prompt bill.
4. **Budget Qualification & Automatic Calendar Booking:**
   - **High-Fit Lead (`Budget >= $500/mo`):** The agent marks the lead as `HOT_BOOKED`, reserves a discovery call slot on the calendar, and adds a new row to the **Live Google Sheets / CRM Qualification & Booking Log** table at the bottom of the screen.
   - **Lower-Budget Lead (`Budget < $500/mo`):** The agent marks the lead as `WARM_NURTURE`, logs them in the CRM without taking up a live calendar slot, and shares a self-serve starter guide.
5. **Live Voice Call (`Gemini 3.8 Live`):** Click **Open Live Voice Call** in the top right of the agent tab to talk to the agent over WebSockets (`/live`). It streams `16kHz` microphone audio in, replies with natural `24kHz` voice audio, and triggers the `book_discovery_call` tool in real time when you share your budget.

---

### 3. Token & Cost Lab

An interactive calculator where you can drag sliders for your **Monthly Customer Queries / GTM Leads** (`1,000` to `100,000/mo`), **Layer 0 Cache Hit Ratio** (`0%` to `90%`), and **Low-ICP Skip Rate** (`0%` to `75%`). It compares four model setups side by side:
- **Ollama Llama 3.2 3B (Local Docker on Ubuntu):** `$0.00 / month` in API fees.
- **Gemini 3.1 Flash-Lite:** `$0.075 / 1M` input tokens (about `$0.44 / month` for 15,000 conversations with caching).
- **Gemini 3.8 Flash:** `$0.15 / 1M` input tokens.
- **Unoptimized Frontier Model Baseline:** What you would pay if you sent raw unstripped HTML and uncached FAQs to a heavy frontier model (`$94+ / month` for the same volume).

---

### 4. Architecture & Setup

Gives you one-click copy and download buttons for the `docker-compose.yml` file, `Dockerfile`, and the `growpilot_n8n_workflow.json` file (which you can import directly into self-hosted n8n to connect WhatsApp webhooks to Google Sheets).

---

## Step-by-Step Local Setup & Installation

You can run GrowPilot locally on **Ubuntu 24.04 LTS**, **macOS**, or **Windows (WSL2)** either directly with Node.js or inside Docker containers alongside local **Ollama** and **n8n**.

### Prerequisites

- **Node.js 20 or 22+** (`node -v`) and **npm** (`npm -v`)
- **Git** (`git --version`)
- *(Optional)* **Docker & Docker Compose** (`docker compose version`) if you want to run the containerized `growpilot-agent` + `ollama` + `n8n` stack.

---

### Option A: Run Directly with Node.js (Fastest Local Setup)

#### Step 1: Clone the repository and open the folder

```bash
git clone https://github.com/Mayamoho/GrowPilot.git
cd GrowPilot
```

*(If you already cloned the repo earlier, run `git pull origin main` inside `~/Documents/GrowPilot` so you have the latest `package.json`, `.npmrc`, `Dockerfile`, and `docker-compose.yml`).*

#### Step 2: Install dependencies

```bash
npm install --legacy-peer-deps
```

> **Why `--legacy-peer-deps`?** We include an `.npmrc` file with `legacy-peer-deps=true` and pin `esbuild` to `^0.28.0` so `vite@8.3.x` installs cleanly. Adding `--legacy-peer-deps` ensures npm 10/11/12 never trips over optional peer dependencies.

#### Step 3: Run the unit test suite to verify everything works

```bash
npm test
```

All 7 unit tests in `src/utils/agentEngine.test.ts` run in under half a second with no API key or internet connection required:

```text
✔ stripHtmlAndBoilerplate removes scripts, styles, nav, footer and saves tokens
✔ matchFaqCache hits Layer 0 zero-token cache for FAQ questions and bypasses qualification messages
✔ calculateRunCost returns $0.00 for Layer 0 cache hits and Ollama local models
✔ evaluateIcpFit scores high-fit leads above threshold and skips low-fit leads
✔ verifyGroundedness 5-layer gate passes truthful claims and catches fabricated numbers
✔ trimConversationWindow caps memory at 6 messages and reports saved tokens
✔ formatGtmLeadsCsv exports company name, industry, and ICP match score properly
ℹ tests 7 | pass 7 | fail 0
```

#### Step 4: (Optional) Add a free Gemini API key

GrowPilot's HTML stripper, Layer 0 FAQ cache, ICP scorer, 5-layer groundedness verifier, CSV exporter, and deterministic fallback engine all work **100% offline with no API key**.

If you want live cloud generation from `gemini-3.1-flash-lite`, `gemini-3.8-flash`, or real-time voice calls via `gemini-3.8-live`:

```bash
cp .env.example .env
```

Open `.env` and paste a free API key from [Google AI Studio (`aistudio.google.com/apikey`)](https://aistudio.google.com/apikey):

```dotenv
GEMINI_API_KEY="AIzaSyYourKeyHere"
PORT=3000
OLLAMA_MODEL="llama3.2:3b"
```

#### Step 5: Start the full-stack server on Port 3000

```bash
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

### Option B: Run on Ubuntu 24.04 with Docker Compose (Agent + Local Ollama + n8n)

If you want to self-host the entire stack in background containers — including the GrowPilot full-stack server (`:3000`), a local **Ollama** server running `llama3.2:3b` for `$0.00/token` (`:11434`), and self-hosted **n8n** (`:5678`) — use the root `docker-compose.yml`:

```bash
# 1. Make sure you are inside the GrowPilot project folder and have the latest files
cd ~/Documents/GrowPilot
git pull origin main

# 2. Confirm docker-compose.yml and Dockerfile are present
ls -la docker-compose.yml Dockerfile

# 3. Build and start all three containers in the background
docker compose up -d --build

# 4. Check that all containers are running
docker compose ps
```

Once started, you have three local services running:

| Service | Local URL | Purpose |
|---|---|---|
| `growpilot-agent` | `http://localhost:3000` | GrowPilot web app, Express REST API (`/api/*`), and `/live` voice WebSocket server |
| `growpilot-n8n` | `http://localhost:5678` | Self-hosted n8n workflow automation (import `growpilot_n8n_workflow.json` from the app) |
| `growpilot-ollama` | `http://localhost:11434` | Local open-source LLM (`llama3.2:3b`) for zero-cost local inference |

To view live container logs or stop the stack:

```bash
docker compose logs -f growpilot-agent
docker compose down
```

---

## Deploying Your Own Copy on Vercel

GrowPilot is designed so the frontend works both when connected to the Node/Docker Express server **and** when deployed as a static app on Vercel (if `/api/*` is not present on a static host, `src/App.tsx` automatically executes the same `agentEngine` functions right in the browser).

1. Push your fork of this repository to GitHub.
2. Import the repository into **[Vercel](https://vercel.com/new)** with:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install --legacy-peer-deps`
3. *(Optional)* If you connect custom subdomains in Vercel (under **Project → Settings → Domains**):
   - Any domain starting with `gtm.` (like `gtm.abukawser.xyz`) opens directly into the **GTM Pipeline** view.
   - Any domain starting with `agent.` (like `agent.abukawser.xyz`) opens directly into the **24/7 FAQ & Booking Agent** view.

---

## Project Structure & Key Files

```text
GrowPilot/
├── src/
│   ├── utils/
│   │   ├── agentEngine.ts        # Core pure logic: HTML stripper, Layer 0 cache, ICP scorer, 5-layer fact check, CSV formatter
│   │   └── agentEngine.test.ts   # 7 Node.js unit tests verifying all core rules and calculations
│   ├── data/
│   │   └── seedData.ts           # Sample prospects, initial FAQs, CRM seed records, Docker & n8n templates
│   ├── components/
│   │   ├── TopNav.tsx            # Top navigation bar and workspace switcher
│   │   ├── GtmStudioView.tsx     # 01. Outbound GTM scraper, ICP gate, 5-layer audit & CSV export
│   │   ├── WhatsappAgentView.tsx # 02. 24/7 FAQ cache, 6-turn chat simulator, trace inspector & CRM log
│   │   ├── LiveVoiceAgentPanel.tsx # Real-time WebSocket voice call panel (gemini-3.8-live)
│   │   ├── CostBenchmarkView.tsx # 03. Interactive token & monthly cost comparison calculator
│   │   └── DeploymentHubView.tsx # 04. Plain-English workflow guide, Docker Compose & n8n JSON downloads
│   └── App.tsx                   # Subdomain routing, live telemetry bar & automatic client-side fallback
├── server.ts                     # Full-stack Express API (/api/*) + Vite middleware + /live WebSocket server
├── Dockerfile                    # Production Node 22 Alpine container build (uses npm install --legacy-peer-deps)
├── docker-compose.yml            # Multi-container stack: growpilot-agent (:3000) + ollama (:11434) + n8n (:5678)
├── .npmrc                        # Sets legacy-peer-deps=true for clean npm installs everywhere
└── package.json                  # Scripts: dev, start, build, lint, test
```

---

## Troubleshooting Common Terminal Errors

| Error Message | Why it happens & how to fix it in 10 seconds |
|---|---|
| `npm error code ERESOLVE` (`While resolving: vite@8.3.4 ... Found: esbuild@0.25.12`) | Your local folder still has the older `package.json` or `Dockerfile` before `esbuild` was updated to `^0.28.0`. Run `git pull origin main` (or push the updated `package.json`, `.npmrc`, and `Dockerfile` to GitHub first), then run `npm install --legacy-peer-deps`. |
| `sh: 1: tsx: not found` when running `npm run dev` | `tsx` wasn't installed because `npm install` failed on the step before it. Run `npm install --legacy-peer-deps` first, let it finish, and then run `npm run dev`. |
| `no configuration file provided: not found` when running `docker compose up -d` | Either you are in a different terminal folder, or `docker-compose.yml` hasn't been pulled from GitHub yet. Run `cd ~/Documents/GrowPilot && git pull origin main && ls -la docker-compose.yml`, then run `docker compose up -d --build`. |
| `docker compose up -d --build` fails at `RUN npm install` (`exit code: 1`) | Make sure your local `Dockerfile` has `RUN npm install --legacy-peer-deps` on line 9 and your `package.json` has `"esbuild": "^0.28.0"`. Run `git pull origin main`, then re-run `docker compose up -d --build`. |
