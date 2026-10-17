# GrowPilot — Cost-Optimized GTM Engineering & Cached 24/7 AI Agent Suite

GrowPilot is a full-stack AI automation workbench and live work sample engineered for Abu Kawser's application to Growbig100 (`abukawser.xyz`). It demonstrates end-to-end GTM engineering (lead scraping/summarization, ICP scoring, grounded outbound & social post generation), a 24/7 cached FAQ & WhatsApp lead-qualification agent, and a zero-cost Ubuntu 24.04 Docker + open-source LLM (`Ollama` / `n8n` / Cloudflare Tunnel) deployment kit.

### User Review & Critical Decisions

> [!IMPORTANT]
> Review the confirmed architectural choices below. Click **Proceed** to build the full-stack application, or reply with any adjustments you would like to make first.

- **Confirmed Decision 1 — Core Task & GTM Engineering Alignment**: Combines Growbig100's two highest-value priorities into one unified agent: **(A) Autonomous GTM Pipeline** (scrapes and summarizes company pages/articles, scores Ideal Customer Profile fit, and drafts grounded cold emails, WhatsApp messages, and social media posts) and **(B) 24/7 Cached Niche FAQ & Appointment Booking Agent** (answers business FAQs from a zero-token cache, qualifies budget/timeline, and books calendar slots into a live CRM).
- **Confirmed Decision 2 — Smallest-Model Routing, Caching & Open-Source Support**: Implements a 3-layer execution pipeline: **Layer 0 Exact/Normalized Semantic Cache** (0 tokens, `$0.00` cost, `<5ms` response for repeated FAQs and URLs), **Layer 1 Smallest-Model Router** (`gemini-3.1-flash-lite` for fast classification/scoring and `gemini-3.8-flash` for grounded generation), plus full configuration and side-by-side benchmarking for local open-source models on Ubuntu 24.04 (`Ollama` running `llama3.2:3b` / `qwen2.5:7b` and `Groq` `llama-3.3-70b`).
- **Confirmed Decision 3 — Free `abukawser.xyz` + Ubuntu 24.04 Docker & VPS Deployment**: Generates a ready-to-run `docker-compose.yml` stack (Agent Service + self-hosted `n8n` + `Ollama` open-source model runner + free `cloudflared` tunnel to `abukawser.xyz`), an importable `n8n` workflow JSON, and concise operational documentation.

---

### 1. Overview & Core Concept

- **What It Does**: GrowPilot is an interactive AI Automation & GTM Engineering platform that executes real multi-stage agent workflows while measuring every prompt token, cache hit, groundedness check, and fraction of a cent spent. Users can prospect and enrich companies or articles, test a live 24/7 WhatsApp/Web FAQ & booking agent, inspect the exact system prompts and caching rules, and export the self-hosted Ubuntu 24.04 Docker + `n8n` deployment bundle.
- **Target Audience / Persona**: Built for **Saadi (Founder at Growbig100)** evaluating **Abu Kawser** for the AI Automation Engineer role, and for B2B growth teams who need reliable, low-cost AI agents that connect to real CRMs, webhooks, and calendars without burning tokens or hallucinating claims.
- **Key Value**: Proves mastery of every skill in the Growbig100 job brief—clear prompt engineering, picking the smallest model that works, aggressive caching, 5-layer hallucination prevention (inspired by `CareerPilot`), GTM outbound automation, and reproducible Docker + Linux documentation.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **GTM Engineering Pipeline (`Lead → Enrich & Summarize → ICP Score → Personalise → CRM`)**: The user inputs a company website URL, niche article, or business description (or selects from curated B2B/clinic prospects) and defines their Ideal Customer Profile (ICP) criteria. The agent strips HTML boilerplate (saving ~80% of input tokens), summarizes the business/article, computes a deterministic + LLM ICP fit score (`0–100`), skips expensive generation if `ICP < 60`, and generates a grounded cold email, WhatsApp opener, follow-up, and LinkedIn/social post—verifying every line through a 5-layer groundedness gate before syncing to the built-in CRM table.
  2. **24/7 Cached FAQ & Lead Qualification Agent (`WhatsApp / Web Simulator`)**: The user chats with the business agent or clicks quick-test scenarios (FAQ query, repeated cached FAQ query, high-budget hot lead, low-budget nurture lead, prompt-injection attempt). An adjacent **Live Prompt & Cost Inspector** reveals whether the response came from **Layer 0 Cache (`0 tokens / $0.00`)** or **Layer 1 Smallest Model**, displays structured JSON extraction (`intent`, `lead_score`, `budget_usd`, `next_action`), and triggers automated calendar slot booking and CRM row creation.
  3. **Prompt Engineering & Cost Efficiency Benchmark Lab**: Interactive calculator and prompt editor where users compare token costs across `Ollama (Llama 3.2 3B - Local $0.00)`, `Gemini 3.1 Flash-Lite`, `Gemini 3.8 Flash`, and frontier models, showing exact monthly savings from boilerplate stripping, sliding-window memory (capped at 6 turns), and FAQ caching.
  4. **Ubuntu 24.04 Docker, n8n Workflow & `abukawser.xyz` Deployment Hub**: Interactive documentation and one-click exporter providing the downloadable `n8n` workflow JSON, `docker-compose.yml` (with `Ollama` + `n8n` + `cloudflared` zero-cost custom domain tunnel for `abukawser.xyz`), short runbook documentation, and Abu Kawser's tailored Growbig100 application brief.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Precision Enterprise SaaS & Engineering Workbench (following SaaS & Dashboard architectural guidelines). Clean, high-signal, single-elevation surfaces with crisp hairline borders and zero visual clutter.
  - *Color Palette & Mood*: 60-30-10 light-first technical slate canvas (`--background: #F8FAFC`, structural surfaces `#FFFFFF` with `#E2E8F0` 1px borders, deep slate ink `#0F172A`, muted prose `#475569`, and a 10% high-intent emerald/teal engineering accent `#0D9488` for primary actions and active states). Semantic states always pair color with explicit text labels (`Nominal / Cached`, `Qualified / Booked`, `Skipped / Below ICP`).
  - *Typography & Hierarchy*:
    - **Display & Navigation**: `Plus Jakarta Sans` (SemiBold/Bold 600–700, tight tracking, `text-wrap: balance` on headings).
    - **Body Prose**: `DM Sans` (Regular 400 / Medium 500, 15px, comfortable 65ch measure).
    - **Data, Token Metrics, Cost Ledgers & Code**: `JetBrains Mono` with strict `font-variant-numeric: tabular-nums` so all token counts, latencies, and USD figures (`$0.00014`) align vertically.
  - *Component Styling & Layout*:
    - Full-viewport 1440px desktop layout featuring a strict 3-zone Top Bar Contract (`GrowPilot by Abu Kawser` wordmark — 4 single-line workspace navigation links — 1 primary `"Export n8n & Docker Kit"` action button).
    - Single-elevation flat panels with `1px solid` hairline dividers; zero nested card sandwiches, zero thick left accent borders, zero decorative pulsing dots, and unboxed metadata using `·` typographic separators.
- **Interactive Feedback & Motion**:
  - Fast `150ms` transitions on tab switches, filter controls, and pipeline stage progression.
  - Real-time skeleton placeholders during live URL scraping and model execution, deterministic empty states with quick-seed buttons, and explicit error banners if an external URL blocks scraping.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: 3-Layer Cost-First Execution Pipeline (Cache → Smallest Model → Grounded Output)**
  - *Chosen Approach*: Check a normalized SHA-256 / token-similarity cache first (`0 tokens`), route classification and ICP scoring to `gemini-3.1-flash-lite` (or local `Ollama llama3.2:3b` when self-hosted), and only invoke `gemini-3.8-flash` when an ICP threshold (`>= 60`) is met.
  - *Why*: Directly proves the core Growbig100 requirement: *"Pick the right AI model for each job and use it efficiently: clear prompts, the smallest model that does the job well, caching and no wasted tokens."*
  - *Alternatives Considered*: Sending every raw HTML page and every FAQ question directly to a large frontier model was rejected because it wastes 80%+ of tokens on boilerplate and repeated questions.
- **Decision 2: 5-Layer Groundedness Gate on Generated Outbound & Summaries**
  - *Chosen Approach*: Before displaying or saving any generated cold email, social post, or FAQ reply, run a deterministic + structured verification check that confirms every cited company service, metric, or policy exists in the scraped source text or FAQ knowledge base.
  - *Why*: Leverages Abu Kawser's signature `CareerPilot` engineering strength and prevents embarrassing hallucinations in automated B2B outreach.
  - *Alternatives Considered*: Unchecked free-form text generation was rejected because hallucinated cold emails destroy sender reputation.
- **Decision 3: Dual-Mode LLM Backend (Cloud Gemini SDK + Local Ubuntu 24.04 Ollama Compatible)**
  - *Chosen Approach*: The Express backend uses `@google/genai` (`gemini-3.1-flash-lite` and `gemini-3.8-flash`) out of the box in the live cloud preview while exposing an OpenAI/Ollama-compatible local adapter and Docker Compose configuration for `llama3.2:3b` on Ubuntu 24.04.
  - *Why*: Ensures the hosted demo on `abukawser.xyz` works instantaneously for the hiring manager with zero setup, while allowing 100% free offline/VPS execution with open-source models on Ubuntu 24.04.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                   TOP BAR CONTRACT (3 Zones: Brand · 4 Nav Links · CTA)              │
└──────────────────────────────────────────┬───────────────────────────────────────────┘
                                           │
       ┌───────────────────────────────────┼───────────────────────────────────┐
       ▼                                   ▼                                   ▼
┌────────────────────────────┐  ┌────────────────────────────┐  ┌────────────────────────────┐
│  1. GTM Engineering Studio │  │ 2. 24/7 Cached FAQ & Lead  │  │ 3. Ubuntu 24.04 Docker,    │
│  • URL / Article Scraper   │  │    Qualifier Agent         │  │    Ollama & n8n Exporter   │
│  • Boilerplate Stripper    │  │  • WhatsApp/Web Chat UI    │  │  • docker-compose.yml      │
│  • ICP Scorer (0-100 Gate) │  │  • Prompt & Token Inspector│  │  • n8n Workflow JSON       │
│  • Email, WhatsApp &       │  │  • Calendar Slot Booker    │  │  • abukawser.xyz Tunnel    │
│    Social Post Generator   │  │  • 5-Layer Grounded Check  │  │  • Short Runbook Docs      │
└──────────────┬─────────────┘  └──────────────┬─────────────┘  └──────────────┬─────────────┘
               │                               │                               │
               └───────────────────────────────┼───────────────────────────────┘
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                   EXPRESS BACKEND API & COST-OPTIMIZED AGENT ENGINE                  │
│                                                                                      │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌──────────────────────┐  │
│  │ Layer 0: Semantic/Exact │  │ Layer 1: Smallest-Model │  │ Layer 2: 5-Layer     │  │
│  │ Cache Store (0 Tokens)  │─▶│ Router (Flash-Lite /    │─▶│ Groundedness Gate &  │  │
│  │ • FAQ Hash & Norm Match │  │ Ollama Llama-3.2-3B)    │  │ CRM / Calendar Sync  │  │
│  │ • Scraped URL Cache     │  │ • ICP Gate (<60 Skips)  │  │ • Zero-Fabrication   │  │
│  └─────────────────────────┘  └─────────────────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **GTM Lead & Content Record**: `id`, `companyName`, `sourceUrl`, `rawCharCount`, `cleanedTokenCount`, `tokensSavedPct`, `summary`, `extractedFacts[]`, `icpScore` (`0–100`), `icpReasoning`, `qualificationStatus` (`QUALIFIED_OUTBOUND` | `SKIPPED_LOW_ICP`), `generatedAssets` (`coldEmail`, `whatsappMessage`, `socialPost`, `followUp`), `groundednessReport` (`passed`, `verifiedClaimsCount`, `blockedHallucinationsCount`, `layerChecks[]`), `costMetrics` (`modelUsed`, `cacheHit`, `inputTokens`, `outputTokens`, `estimatedCostUsd`, `latencyMs`).
  - **24/7 Agent Conversation & CRM Booking State**: `sessionId`, `messages[]` (capped at 6-turn sliding window for token efficiency), `leadProfile` (`name`, `businessType`, `need`, `monthlyBudgetUsd`, `timeline`, `leadScore`, `status`), `bookedSlot`, `knowledgeBaseFaqs[]`, and `telemetryLedger` (total queries, cache hit rate %, cumulative tokens, cumulative USD cost vs. unoptimized baseline).
- **Interactive Component & State Mapping**:
  - **GTM Pipeline Controls**: URL/text input with validation, preset prospect selector (Dhaka Dental Clinic, B2B Ecommerce Brand, SaaS Agency, Tech Article), ICP threshold slider (`40–85`), and `"Run GTM Pipeline"` button that calls `POST /api/gtm/analyze`, updates the live CRM table, and unlocks tabs for Cold Email, WhatsApp Script, Social Media Post, and Groundedness Audit.
  - **24/7 Agent Controls**: Message input, 1-click test scenario buttons (`"Ask Pricing FAQ (1st Time)"`, `"Ask Pricing FAQ (Cache Hit 0 Tokens)"`, `"Qualify $1,200/mo Hot Lead"`, `"Test Low-Budget Lead"`, `"Test Out-of-Scope Hallucination Guard"`), live FAQ Knowledge Base editor, and CRM Bookings table with status filters (`All`, `Qualified Booked`, `Nurture`, `FAQ Only`) and CSV export.
  - **Deployment & Docs Controls**: Interactive switcher for Ubuntu 24.04 commands (`Docker + n8n + Ollama`, `Cloudflare Tunnel for abukawser.xyz`, `n8n JSON Download`, `Growbig100 Application Email Copy`), with one-click copy and `.json` / `.yml` file download handlers.
- **Key Sequences & Integrations**:
  - Server-side `@google/genai` integration using `gemini-3.1-flash-lite` for rapid classification/ICP scoring and `gemini-3.8-flash` with `responseSchema` (`Type.OBJECT`) for deterministic JSON output and tool execution.
  - Pure, decoupled logic module (`src/utils/agentEngine.ts`) verified by Node's native test runner (`node --test`) covering HTML boilerplate stripping, token & cost math, Layer 0 cache normalization, ICP threshold gating, and the 5-layer groundedness verifier.
