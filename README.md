# GrowPilot

**A GTM outbound and 24/7 lead-qualification agent that will not spend a token on a question it has already answered, a lead below your ICP threshold, or a claim the source text cannot prove.**

It takes raw HTML from a prospect's site or an industry article, strips the DOM clutter in code before any model sees it, scores whether the prospect is worth an outbound sequence at all, and drafts the cold email, WhatsApp opener, and social post only when the score clears your gate. Every generated sentence has to survive five deterministic groundedness checks against the stripped source text — and on the inbound side, recurring customer FAQs are answered from a normalized Layer 0 cache in under five milliseconds for zero tokens.

**Built for lean automation teams.** Outbound pipelines and 24/7 WhatsApp/web agents fail in two predictable ways: they burn 80% of their token budget feeding `<script>`, `<style>`, and `<nav>` tags or low-fit hobby sites into a frontier model, and they invent metrics or pricing when a customer asks a direct question. `Layer 0 Cache`, `Boilerplate Stripper`, `ICP Gate`, and the `5-Layer Groundedness Gate` are those four problems solved in TypeScript before and after the model call.

## Live deployments

Three live entry points serve the application:

| URL | What it is and what it does |
|---|---|
| **[https://growpilot-ashy.vercel.app/](https://growpilot-ashy.vercel.app/)** | The full GrowPilot workbench on Vercel — includes all four modules (`GTM Pipeline`, `24/7 FAQ & Booking Agent`, `Token & Cost Lab`, and `Architecture & Setup`). |
| **[https://gtm.abukawser.xyz](https://gtm.abukawser.xyz)** | Dedicated GTM Engineering entry point. Opens directly into the **Autonomous GTM Scraper, ICP Gate & Grounded Outbound Agent** for stripping prospect HTML, scoring ICP fit (`0–100`), auditing grounded outbound copy, and exporting analyzed leads to CSV. |
| **[https://agent.abukawser.xyz](https://agent.abukawser.xyz)** | Dedicated Customer Agent entry point. Opens directly into the **24/7 Cached FAQ & Autonomous Lead Booking Agent** with the live execution trace inspector, 6-turn sliding memory window, Layer 0 FAQ rule editor, and CRM booking ledger. |

## What the agent is

One rule shapes the whole design: **code handles caching, compression, scoring, and verification; the model only writes language when the gate says the call is worth making.**

```text
strip HTML → check Layer 0 cache → score ICP fit → route smallest model → 5-layer gate → artefacts + CRM
   code             code               code               model            code+model         code
```

| Stage | Who does it | What it can and cannot do |
|---|---|---|
| Strip HTML boilerplate | code | Removes `<script>`, `<style>`, `<svg>`, `<nav>`, `<footer>`, `<header>`, comments, and whitespace. Cuts ~70–80% of raw input tokens. No model call. |
| Check Layer 0 cache | code | Normalizes the query or URL + threshold key (`stopWords` removed, token overlap scored). Returns cached FAQ or GTM runs in `<5ms` for `0` tokens. |
| Score ICP fit (`0–100`) | code | Weighted regex arithmetic over B2B buying signals, booking flows, and non-commercial penalties. If `icpScore < threshold`, halts the pipeline before generation. |
| Trim chat memory | code | Caps 24/7 WhatsApp/web threads at the last `6` turns (`trimConversationWindow`) so long threads never bloat the prompt. |
| Draft outbound copy or qualify lead | model | Routes to `Ollama Llama 3.2 3B` (`$0.00` local), `gemini-3.1-flash-lite` (`$0.075/1M`), or `gemini-3.8-flash` (`$0.15/1M`) with a strict JSON `responseSchema`. |
| Verify groundedness (5 layers) | code | Checks target entity attribution, numerical claim veracity against source digits, extracted fact overlap, anti-slop patterns, and prompt-injection rules. |
| Book calendar slot & export CSV | code | Reserves discovery slots when extracted monthly budget `>= $500` and formats RFC-4180 CSV exports (`Company Name`, `Industry`, `ICP Match Score`, `Cost USD`). |

The failure mode is deliberately one-sided. A prospect that scores below your ICP gate (`default: 60/100`) is logged as `SKIPPED_LOW_ICP` and spends zero generation tokens. A number invented by a model that does not appear in the source text is flagged by Layer 2 (`Numerical & Metric Fidelity Gate`) before the copy is marked verified.

## Install

### 0. Prerequisites: Node.js 20+ (and optionally Docker)

```bash
node --version         # v20.x or v22.x recommended
npm --version
docker compose version # optional, only for containerized Agent + Ollama + n8n stack
```

### 1. Get the code

```bash
git clone https://github.com/Mayamoho/GrowPilot.git
cd GrowPilot
```

### 2. Install dependencies

Run this inside the `GrowPilot` project folder:

```bash
npm install --legacy-peer-deps
```

*(Note: `.npmrc` in the repository sets `legacy-peer-deps=true` automatically, and `esbuild` is pinned to `^0.28.0` to match `vite@8.3.x`. Passing `--legacy-peer-deps` guarantees clean resolution across all npm 10/11/12 environments).*

### 3. Check it installed and run the unit test suite

```bash
npm test
```

You should see all 7 pure-logic unit tests pass in under a second with no network calls and no API key required:

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

### 4. Add a model key — only when you want live Gemini cloud calls

The boilerplate stripper, Layer 0 FAQ cache, ICP scorer, 5-layer groundedness verifier, cost calculator, CSV exporter, and deterministic synthesis fallback all run in code with **no API key**. You only need a key when you want live cloud generation from `gemini-3.1-flash-lite`, `gemini-3.8-flash`, or real-time voice streaming over `gemini-3.8-live`.

```bash
cp .env.example .env
```

Open `.env` and set your key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey):

```dotenv
GEMINI_API_KEY="AIzaSy..."
PORT=3000
OLLAMA_MODEL="llama3.2:3b"
```

| Tier | Model ID | Free Tier Quota (`aistudio.google.com`) | Paid Rate | Role in GrowPilot |
|---|---|---|---|---|
| Tier 0 | `ollama-llama3.2-3b` | Unlimited (runs locally in Docker) | `$0.00` | Zero-cost local FAQ routing, summarization & ICP pre-screening |
| Tier 1 | `gemini-3.1-flash-lite` | 15–30 RPM · 1,500 RPD (`$0.00`) | `$0.075 / 1M` input | High-speed intent classification, ICP scoring & FAQ fallback |
| Tier 2 | `gemini-3.8-flash` | 10–15 RPM · 500–1,500 RPD (`$0.00`) | `$0.15 / 1M` input | Structured JSON outbound copy (Cold Email, WhatsApp, Social Post) |
| Live | `gemini-3.8-live` | 3 concurrent WebSocket sessions | Pay-as-you-go | Bidirectional 16kHz/24kHz PCM voice qualification (`/live`) |

If `GEMINI_API_KEY` is omitted or reaches its daily free-tier window, the server does not crash: it falls back to deterministic grounded synthesis derived directly from the stripped source sentences and still runs all five groundedness checks.

### 5. Run the agent (Node.js or Docker Compose)

**Option A — Node.js full-stack server (Express + Vite on Port 3000):**

```bash
npm run dev
```

Open `http://localhost:3000`.

**Option B — Ubuntu 24.04 Docker Compose (`growpilot-agent` + `ollama` + `n8n`):**

```bash
docker compose up -d --build
docker compose ps
```

| Container | Local URL | What it runs |
|---|---|---|
| `growpilot-agent` | `http://localhost:3000` | Full-stack Express API + React workbench + `/live` WebSocket server |
| `growpilot-n8n` | `http://localhost:5678` | Self-hosted n8n workflow engine for webhook → Google Sheets / CRM sync |
| `growpilot-ollama` | `http://localhost:11434` | Local Ollama server pulling and serving `llama3.2:3b` at `$0.00/token` |

## Every route and action, and what it costs

| Route / Action | Takes | Cost | What it does |
|---|---|---|---|
| `GET /api/state` | — | free | Returns current Layer 0 FAQ rules, GTM pipeline records, CRM bookings, and cumulative token ledger. |
| `POST /api/gtm/analyze` | `companyName`, `sourceUrl`, `industry`, `rawContent`, `icpThreshold`, `modelPreference` | `0` tokens on cache hit; `~45` tokens if skipped by ICP gate; `~400` tokens on full pass | Strips HTML boilerplate, evaluates ICP score (`0–100`), generates Cold Email + WhatsApp + Social Post if `score >= threshold`, and runs the 5-layer groundedness gate. |
| `POST /api/agent/chat` | `message`, `sessionId`, `modelPreference`, `channel` | `0` tokens on FAQ cache hit; `~180` tokens on novel qualification turn | Checks Layer 0 FAQ cache first; otherwise trims memory to last 6 turns, extracts budget/intent, and books a calendar slot into CRM when `budget >= $500/mo`. |
| `POST /api/faq/add` | `category`, `question`, `keywords`, `answer` | free | Adds a new FAQ rule into the Layer 0 normalized cache for immediate `0`-token hits. |
| `POST /api/cache/clear` | — | free | Flushes Layer 0 GTM and FAQ caches so the next request forces a cold model pass. |
| `WS /live` | 16kHz PCM audio chunks or text prompts | 1 Live session | Streams real-time voice qualification via `gemini-3.8-live` and triggers `book_discovery_call` tool calls into the CRM ledger. |
| `Download CSV` (UI) | current or filtered GTM records | free | Exports RFC-4180 `growpilot_gtm_leads.csv` with `Company Name`, `Industry`, `ICP Match Score`, `Qualification Status`, `Tokens Saved %`, `Model Used`, `Cost USD`, and `Cold Email Subject`. |

## Use it, step by step

### 1. Run a high-fit prospect through the GTM Pipeline (`gtm.abukawser.xyz`)

Pick the **DentaCare Aesthetic & Implant Center** preset (or paste any prospect's raw HTML) with `Minimum ICP Score Gate = 60` and click **Run GTM Pipeline**:

```text
Boilerplate Stripped: -37.6% Tokens (274 → 171 tok)
ICP Fit Score:        96/100 (QUALIFIED_OUTBOUND)
Groundedness Gate:    100% Verified (0 Fabrications across 5 layers)
Run Cost (USD):       $0.000185 (Saved +$0.00835 vs Frontier Baseline)
```

Click **Run GTM Pipeline** a second time on the same prospect without changing the threshold:

```text
Execution Path:       Layer 0 Cache Hit (0 Tokens · $0.000000 · 3ms)
```

### 2. Test the ICP token-saving gate on a low-fit page

Select the **Vintage Postcard Collectors Archive** preset (a non-commercial hobby site) and click **Run GTM Pipeline**:

```text
ICP Fit Score:        5/100 (Below 60 ICP threshold)
Qualification Status: SKIPPED_LOW_ICP
Cold Email Subject:   [SKIPPED BY ICP GATE — 0 OUTBOUND TOKENS SPENT]
```

The scorer catches the non-commercial signal in code and halts outbound generation before calling `gemini-3.8-flash`.

### 3. Test Layer 0 FAQ caching vs. lead booking (`agent.abukawser.xyz`)

In **24/7 FAQ & Booking Agent**, click the **Pricing FAQ (0 Tokens Cache Hit)** scenario chip:

```json
{
  "intent": "FAQ_CACHE_HIT",
  "lead_score": "COLD_FAQ",
  "extracted_budget_usd": 0,
  "cache_hit": true,
  "tokens_used": 0,
  "next_action": "SERVED_ZERO_TOKENS",
  "booked_slot": null
}
```

Now click **Qualify $1,200/mo Lead (Books Slot)**:

```json
{
  "intent": "QUALIFIED_BOOKING",
  "lead_score": "HOT_BOOKED",
  "extracted_budget_usd": 1200,
  "cache_hit": false,
  "tokens_used": 184,
  "next_action": "BOOK_CALENDAR_AND_CRM",
  "booked_slot": "Tue 22 Oct, 4:00 PM BDT"
}
```

Because `extracted_budget_usd` (`1200`) clears the `$500/mo` threshold, the agent books a slot and appends the lead to the **Live Google Sheets / CRM Qualification & Booking Log** table.

## The 5-layer groundedness gate

Nothing generated in the GTM pipeline is marked verified unless it passes five deterministic checks in `src/utils/agentEngine.ts` (`verifyGroundedness`):

| # | Check | Who runs it | What it enforces |
|---|---|---|---|
| 1 | `Entity & Target Attribution Gate` | code | The target company or article entity name must be explicitly anchored in the generated output. |
| 2 | `Numerical & Metric Fidelity Gate` | code | Every number in the generated email, WhatsApp script, and social post is cross-checked against numbers present in the source text (`allowedNumbers`). Any unverified digit fails the check. |
| 3 | `Extracted Fact Grounding Check` | code | At least 75% of extracted hooks must share lexical roots (`length > 4`) with the stripped source text. |
| 4 | `Anti-Hallucination & Claim Filter` | code | Blocks fabricated awards, fake funding rounds, and unverified ROI claims (`guaranteed 10,000% roi`, `recent $50m series c`). |
| 5 | `Prompt-Injection & Safety Screen` | code | Screens both the scraped input HTML and generated output for adversarial instruction-override patterns (`ignore previous instructions`, `system prompt leaked`). |

## Troubleshooting

| What you see | What it means and what to do |
|---|---|
| `npm error code ERESOLVE` on `vite@8.3.x` and `esbuild` | Pull the latest `package.json` and `.npmrc` (`git pull origin main`), or run `npm install --legacy-peer-deps`. The root `package.json` now pins `esbuild` to `^0.28.0` and `.npmrc` enables `legacy-peer-deps=true`. |
| `sh: 1: tsx: not found` when running `npm run dev` | `node_modules` was not installed because the previous `npm install` exited early. Run `npm install --legacy-peer-deps`, then `npm run dev`. |
| `no configuration file provided: not found` from `docker compose up -d` | You ran `docker compose` outside the folder containing `docker-compose.yml`, or before pulling the latest commit. Run `cd ~/Documents/GrowPilot && git pull origin main && ls -la docker-compose.yml`, then `docker compose up -d --build`. |
| `Failed to load resource: 404 (/api/state)` on static hosting | Expected when served from a static CDN without the Express backend. `src/App.tsx` catches this automatically and switches to the built-in client-side `agentEngine` so all GTM runs, FAQ cache hits, lead bookings, and CSV downloads still execute in the browser. |
| `GEMINI_API_KEY is not configured` in Live Voice mode | Real-time WebSocket audio streaming (`gemini-3.8-live`) requires a valid `GEMINI_API_KEY` in `.env` and the Node/Docker server (`npm run dev` or `docker compose up -d`). Text chat and GTM analysis work with or without a key. |

## Tests

```bash
npm test          # runs all 7 unit tests in src/utils/agentEngine.test.ts via node:test
npm run lint      # strict TypeScript typecheck (tsc --noEmit)
npm run build     # production Vite bundle verification
```

All three run locally with no API key and no network dependency.

## What this is not

- Not a headless browser farm. The GTM pipeline strips raw HTML and fetches public URLs directly; it does not bypass logins, solve CAPTCHAs, or scrape private LinkedIn profiles.
- Not an unguarded text generator. Every numeric claim in outbound copy is checked against the digits in the source text (`verifyGroundedness`), and leads scoring below the ICP threshold are dropped before generation.
- Not dependent on paid API tiers. Layer 0 caching, boilerplate stripping, ICP scoring, and local Ollama (`llama3.2:3b`) allow the full workflow to run at `$0.00` token cost.
