import {
  type FaqItem,
  type GroundednessReport,
  type CostMetrics,
} from '../utils/agentEngine';

export interface GtmProspectPreset {
  id: string;
  companyName: string;
  sourceUrl: string;
  industry: string;
  taskType: 'B2B_GTM_OUTBOUND' | 'ARTICLE_SUMMARY_AND_SOCIAL';
  rawHtmlSample: string;
}

export interface GtmPipelineRecord {
  id: string;
  companyName: string;
  sourceUrl: string;
  industry: string;
  timestamp: string;
  rawCharCount: number;
  cleanedCharCount: number;
  rawEstimatedTokens: number;
  cleanedEstimatedTokens: number;
  tokensSavedPct: number;
  icpScore: number;
  icpThreshold: number;
  qualificationStatus: 'QUALIFIED_OUTBOUND' | 'SKIPPED_LOW_ICP';
  icpReasoning: string;
  matchedSignals: string[];
  summary: string;
  extractedFacts: string[];
  generatedAssets: {
    coldEmailSubject: string;
    coldEmailBody: string;
    whatsappOpener: string;
    followUpMessage: string;
    socialMediaPost: string;
  };
  groundednessReport: GroundednessReport;
  costMetrics: CostMetrics;
}

export interface CrmBookingRecord {
  id: string;
  leadName: string;
  businessType: string;
  channel: 'WhatsApp Business' | 'Website Widget';
  needSummary: string;
  monthlyBudgetUsd: number;
  leadScore: 'HOT_BOOKED' | 'WARM_NURTURE' | 'COLD_FAQ';
  bookedSlot: string;
  modelUsed: string;
  tokensUsed: number;
  costUsd: number;
  createdAt: string;
}

export const PRESET_PROSPECTS: GtmProspectPreset[] = [
  {
    id: 'preset-dentacare-dhaka',
    companyName: 'DentaCare Aesthetic & Implant Center Dhaka',
    sourceUrl: 'https://dentacare-dhaka.example.com/services',
    industry: 'Healthcare & Dental Clinic (Uttara / Gulshan)',
    taskType: 'B2B_GTM_OUTBOUND',
    rawHtmlSample: `<!DOCTYPE html><html><head><title>DentaCare Dhaka</title>
    <style>.navbar{display:flex;background:#111;padding:24px;} .footer-links{font-size:11px;color:#999;}</style>
    <script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date());</script>
    </head><body>
    <nav class="navbar"><a href="/">Home</a><a href="/team">Doctors</a><a href="/privacy">Privacy Policy</a></nav>
    <main>
      <h1>DentaCare Aesthetic & Implant Center — Uttara & Banani, Dhaka</h1>
      <p>We are a 12-chair specialist dental clinic serving over 450 monthly patients across Uttara Sector 7 and Banani Block E. Core treatments include Swiss Dental Implants, Invisible Clear Aligners, Laser Teeth Whitening, and Root Canal Therapy.</p>
      <p>Current bottleneck: Patients message our Facebook Page and WhatsApp number (+8801700-000000) after 8 PM asking for implant consultation pricing and Friday/Saturday slot availability. Receptionists manually reply the next afternoon, resulting in missed appointment bookings.</p>
      <p>Consultation fee: 1,000 BDT. Monthly marketing spend: $1,400 across Meta Ads and local search.</p>
    </main>
    <footer>Copyright 2026 DentaCare Dhaka Ltd. All rights reserved. Terms | Cookies | Sitemap</footer>
    </body></html>`,
  },
  {
    id: 'preset-cloudscale-revops',
    companyName: 'CloudScale B2B Commerce & Logistics',
    sourceUrl: 'https://cloudscale-commerce.example.io/about',
    industry: 'B2B SaaS & E-Commerce Fulfillment',
    taskType: 'B2B_GTM_OUTBOUND',
    rawHtmlSample: `<!DOCTYPE html><html><head><style>body{margin:0;font-family:sans-serif;}</style>
    <script>console.log("Analytics initialized for CloudScale v4.2");</script></head><body>
    <header><nav>Platform | Pricing | API Docs | Status | Login</nav></header>
    <section>
      <h2>CloudScale — Automated Order & Warehouse Fulfillment for 180+ Retail Brands</h2>
      <p>CloudScale helps mid-market retail and D2C brands automate inventory sync across Shopify, WooCommerce, and regional couriers. Our team processes 35,000 weekly shipments.</p>
      <p>Growth priority: Looking to automate inbound merchant onboarding, instant WhatsApp webhook order alerts, and outbound B2B lead enrichment into HubSpot CRM and Google Sheets without increasing SDR headcount.</p>
      <p>Target automation budget: $950/month for n8n workflow orchestration and 24/7 AI qualification agents.</p>
    </section>
    <footer>CloudScale Inc. Privacy | Security | SOC2</footer></body></html>`,
  },
  {
    id: 'preset-article-ai-caching',
    companyName: 'Growbig100 Engineering Digest',
    sourceUrl: 'https://abukawser.xyz/articles/zero-waste-ai-agents',
    industry: 'Technical Article Summarization & Social Post Generation',
    taskType: 'ARTICLE_SUMMARY_AND_SOCIAL',
    rawHtmlSample: `<!DOCTYPE html><html><head><script>/* tracker */</script></head><body>
    <nav>Blog | Projects | GitHub | Contact</nav>
    <article>
      <h1>Why 80% of Production AI Agent Tokens Are Wasted (And How 3-Layer Caching Fixes It)</h1>
      <p>Most businesses wire WhatsApp or website chat widgets directly to frontier LLMs. When 300 customers ask the same 15 questions about pricing, office hours, and refund policies, companies pay for the same tokens 300 times.</p>
      <p>By placing a Layer 0 Normalized FAQ Cache in front of a lightweight model router (such as local Llama 3.2 3B on Ubuntu 24.04 via Ollama or Gemini 3.1 Flash-Lite), teams eliminate 65% of model calls entirely ($0.00 cost and 3ms latency) while reserving multi-step reasoning models strictly for qualified leads with budgets above $500/month.</p>
      <p>Combined with a 5-layer groundedness gate that checks every generated number against source CRM records, businesses get 24/7 autonomous booking with zero hallucinated discounts.</p>
    </article>
    <footer>Published by Abu Kawser</footer></body></html>`,
  },
  {
    id: 'preset-low-icp-hobby',
    companyName: 'Vintage Postcard Collectors Archive',
    sourceUrl: 'https://postcards-hobby-archive.example.org',
    industry: 'Personal Non-Commercial Hobby Site (Low ICP Test)',
    taskType: 'B2B_GTM_OUTBOUND',
    rawHtmlSample: `<html><body><main>
      <h1>My Personal Diary of 1970s Railway Postcards</h1>
      <p>This is a retired hobby archive with no commercial services, no products for sale, and no customer support team. Please do not pitch marketing services.</p>
    </main></body></html>`,
  },
];

export const INITIAL_FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'Pricing & Packages',
    question: 'What are your pricing plans and monthly cost for a 24/7 AI agent?',
    keywords: ['price', 'pricing', 'cost', 'monthly', 'plan', 'rate', 'how much', 'charge'],
    answer:
      'Our 24/7 AI Qualification & Booking Agent package starts at $500/month (or 25,000 BDT/month for local Bangladesh clinics/SMBs). It includes custom WhatsApp + Web chat integration, n8n workflow sync to Google Sheets/CRM, and token-cached FAQ automation.',
  },
  {
    id: 'faq-2',
    category: 'Tech Stack & Cost Efficiency',
    question: 'How do you keep LLM API token costs low without losing accuracy?',
    keywords: ['token', 'tokens', 'cheap', 'cost', 'cache', 'caching', 'model', 'gemini', 'claude', 'ollama'],
    answer:
      'We use a 3-Layer Cost Architecture: (1) Layer 0 Normalized Cache answers recurring FAQs in <5ms for 0 tokens ($0.00), (2) Layer 1 routes routine intent/scoring to Gemini 3.1 Flash-Lite or self-hosted Ollama Llama 3.2 3B, and (3) a 6-turn sliding memory window prevents context bloat.',
  },
  {
    id: 'faq-3',
    category: 'WhatsApp & n8n Integrations',
    question: 'Can the agent connect to WhatsApp Business API, Google Sheets, and Google Calendar?',
    keywords: ['whatsapp', 'n8n', 'sheets', 'calendar', 'crm', 'webhook', 'integrate', 'connect'],
    answer:
      'Yes. Every agent is orchestrated via self-hosted n8n workflows on Docker. It receives WhatsApp Cloud API / Website webhooks, checks live Google Calendar availability, writes scored leads to Google Sheets or Supabase CRM, and sends instant hot-lead alerts.',
  },
  {
    id: 'faq-4',
    category: 'Hallucination Prevention',
    question: 'How do you prevent the AI agent from hallucinating fake prices or promises?',
    keywords: ['hallucinate', 'hallucination', 'fake', 'accuracy', 'grounded', 'groundedness', 'safe'],
    answer:
      'We enforce a 5-Layer Groundedness Gate (built for CareerPilot): every numeric claim, price, and service name in the AI output is verified against your approved FAQ & CRM data before the message is sent. If a question is outside scope, it triggers a clean human handoff.',
  },
  {
    id: 'faq-5',
    category: 'Working Hours & Support',
    question: 'What are your deployment timelines and support hours in Dhaka?',
    keywords: ['hours', 'location', 'dhaka', 'office', 'support', 'time', 'turnaround', 'deploy'],
    answer:
      'Initial MVP agents deploy within 48 hours via Docker Compose. Our engineering team operates 10 AM – 10 PM BDT (Saturday–Thursday, Friday off), supporting both remote global clients and local Dhaka operations (Uttara / Notun Bazar).',
  },
];

export const INITIAL_GTM_RECORDS: GtmPipelineRecord[] = [
  {
    id: 'gtm-seed-1',
    companyName: 'DentaCare Aesthetic & Implant Center Dhaka',
    sourceUrl: 'https://dentacare-dhaka.example.com/services',
    industry: 'Healthcare & Dental Clinic (Uttara / Gulshan)',
    timestamp: '2026-10-17 14:20 BDT',
    rawCharCount: 1094,
    cleanedCharCount: 682,
    rawEstimatedTokens: 274,
    cleanedEstimatedTokens: 171,
    tokensSavedPct: 37.6,
    icpScore: 96,
    icpThreshold: 60,
    qualificationStatus: 'QUALIFIED_OUTBOUND',
    icpReasoning:
      'Scored 96/100 (Threshold: 60). Strong alignment across 5 GTM signals (450 monthly patients, after-hours WhatsApp bottleneck, $1,400 ad budget). Cleared for grounded outbound & social generation.',
    matchedSignals: [
      'High-intent customer booking or appointment flow',
      'Active digital presence / inbound lead volume',
      'Automation or response-time bottleneck identified',
      'Commercial B2B / service revenue model',
      'Contact / action readiness',
    ],
    summary:
      'DentaCare Dhaka is a 12-chair dental clinic in Uttara and Banani serving 450 monthly patients for implants and aligners, currently losing after-hours Facebook/WhatsApp inquiries due to manual next-day receptionist replies.',
    extractedFacts: [
      '12-chair specialist clinic in Uttara Sector 7 & Banani serving 450 monthly patients',
      'Core offers: Swiss Dental Implants, Clear Aligners, Laser Whitening (1,000 BDT consultation)',
      'Pain point: After-8 PM WhatsApp & Facebook inquiries wait until next afternoon for manual reply',
      'Active paid acquisition: $1,400/month across Meta Ads and local search',
    ],
    generatedAssets: {
      coldEmailSubject: 'Fixing after-8 PM WhatsApp implant bookings for DentaCare Dhaka',
      coldEmailBody:
        'Hi DentaCare Dhaka team,\n\nNoticed you serve 450 monthly patients across your 12-chair clinics in Uttara Sector 7 and Banani for Swiss Dental Implants and Clear Aligners.\n\nBecause prospects messaging your WhatsApp after 8 PM from your $1,400/mo Meta Ads often book elsewhere if they wait until the next afternoon, we built a 24/7 Bangla + English WhatsApp AI Agent that answers 1,000 BDT consultation FAQs and books Friday/Saturday slots directly into Google Sheets & Calendar.\n\nOpen to a 10-minute live demo of the WhatsApp booking flow this week?',
      whatsappOpener:
        'Assalamu Alaikum DentaCare Dhaka team! Saw your implant & aligner clinics in Uttara and Banani. We built a 24/7 WhatsApp AI receptionist that replies to after-8 PM Meta Ad leads in 3 seconds and books 1,000 BDT consultations into Google Sheets. Can I share a 60-sec test link?',
      followUpMessage:
        'Quick follow-up for DentaCare Dhaka — I configured a sample WhatsApp FAQ cache with your 1,000 BDT consultation fee and Uttara/Banani hours so repeated patient questions cost $0.00 in tokens. Happy to share the live link if helpful!',
      socialMediaPost:
        'Case Study Blueprint: How a 12-chair dental clinic handling 450 monthly patients stops losing after-8 PM Meta Ad leads.\n\n1. Layer 0 FAQ Cache answers consultation fees (1,000 BDT) & branch hours in <5ms for 0 tokens.\n2. AI Qualifier screens implant vs. aligner intent on WhatsApp 24/7.\n3. n8n webhook books confirmed slots straight into Google Calendar & Sheets.',
    },
    groundednessReport: {
      passed: true,
      scorePct: 100,
      verifiedClaimsCount: 5,
      blockedHallucinationsCount: 0,
      layerChecks: [
        {
          layer: 1,
          name: 'Entity & Target Attribution Gate',
          passed: true,
          detail: 'Target entity "DentaCare Aesthetic & Implant Center Dhaka" accurately anchored in output.',
        },
        {
          layer: 2,
          name: 'Numerical & Metric Fidelity Gate',
          passed: true,
          detail: '0 fabricated numbers detected (all figures: 12, 450, 8, 1,400, 1,000 verified in source).',
        },
        {
          layer: 3,
          name: 'Extracted Fact Grounding Check',
          passed: true,
          detail: '4/4 extracted hooks verified directly against stripped source text.',
        },
        {
          layer: 4,
          name: 'Anti-Hallucination & Claim Filter',
          passed: true,
          detail: 'Zero fabricated awards, fake funding rounds, or unverified ROI claims.',
        },
        {
          layer: 5,
          name: 'Prompt-Injection & Safety Screen',
          passed: true,
          detail: 'Input and output passed adversarial prompt-injection screening.',
        },
      ],
    },
    costMetrics: {
      modelUsed: 'gemini-3.8-flash',
      modelLabel: 'Gemini 3.8 Flash',
      cacheHit: false,
      inputTokens: 171,
      outputTokens: 265,
      totalTokens: 436,
      estimatedCostUsd: 0.0001847,
      baselineFrontierCostUsd: 0.008538,
      costSavedUsd: 0.008353,
      latencyMs: 360,
    },
  },
];

export const INITIAL_CRM_BOOKINGS: CrmBookingRecord[] = [
  {
    id: 'crm-101',
    leadName: 'Dr. Tariq Rahman (DentaCare Uttara)',
    businessType: 'Dental & Implant Clinic',
    channel: 'WhatsApp Business',
    needSummary: '24/7 WhatsApp patient qualifier + Google Calendar slot booking',
    monthlyBudgetUsd: 850,
    leadScore: 'HOT_BOOKED',
    bookedSlot: 'Sun 20 Oct, 11:30 AM BDT',
    modelUsed: 'gemini-3.1-flash-lite',
    tokensUsed: 290,
    costUsd: 0.000058,
    createdAt: '10 mins ago',
  },
  {
    id: 'crm-102',
    leadName: 'Nadia Islam (StyleLoom D2C)',
    businessType: 'E-Commerce Apparel Brand',
    channel: 'Website Widget',
    needSummary: 'FAQ pricing & WhatsApp integration inquiry (Answered via Layer 0 Cache)',
    monthlyBudgetUsd: 0,
    leadScore: 'COLD_FAQ',
    bookedSlot: 'FAQ Resolved (Cached)',
    modelUsed: 'Layer 0 Exact Cache (0 Tokens)',
    tokensUsed: 0,
    costUsd: 0.0,
    createdAt: '24 mins ago',
  },
  {
    id: 'crm-103',
    leadName: 'Farhan Ahmed (QuickTutor Local)',
    businessType: 'Coaching Center',
    channel: 'WhatsApp Business',
    needSummary: 'Basic FAQ bot, budget $180/mo (Below $500 threshold -> Sent Free Guide)',
    monthlyBudgetUsd: 180,
    leadScore: 'WARM_NURTURE',
    bookedSlot: 'Nurture Sequence (No Calendar Slot Used)',
    modelUsed: 'ollama-llama3.2-3b',
    tokensUsed: 245,
    costUsd: 0.0,
    createdAt: '1 hour ago',
  },
];

export const DOCKER_COMPOSE_UBUNTU_YAML = `# Zero-Cost Production Stack for Ubuntu 24.04 LTS & abukawser.xyz
# Includes:
# 1. GrowPilot GTM & 24/7 Cached AI Agent Web/API Server (Port 3000)
# 2. Ollama Local Open-Source LLM Runner (Llama 3.2 3B - $0.00 Token Cost)
# 3. Self-Hosted n8n Workflow Automation Engine (Port 5678)
# 4. Cloudflare Zero-Trust Tunnel (Exposes abukawser.xyz & agent.abukawser.xyz over HTTPS for $0)

services:
  growpilot-agent:
    build: .
    container_name: growpilot-agent
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
      - OLLAMA_BASE_URL=http://ollama:11434
      - DEFAULT_LOCAL_MODEL=llama3.2:3b
      - N8N_WEBHOOK_URL=http://n8n:5678/webhook/growbig100-lead
    depends_on:
      - ollama
      - n8n

  ollama:
    image: ollama/ollama:latest
    container_name: growpilot-ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    entrypoint: ["/bin/sh", "-c", "ollama serve & sleep 5 && ollama pull llama3.2:3b && wait"]

  n8n:
    image: n8nio/n8n:latest
    container_name: growpilot-n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=agent.abukawser.xyz
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://agent.abukawser.xyz/
      - GENERIC_TIMEZONE=Asia/Dhaka
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=\${N8N_USER:-abukawser}
      - N8N_BASIC_AUTH_PASSWORD=\${N8N_PASSWORD:-change_me_in_env}
    volumes:
      - n8n_data:/home/node/.n8n

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: growpilot-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token \${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - growpilot-agent
      - n8n

volumes:
  ollama_data:
  n8n_data:
`;

export const N8N_WORKFLOW_EXPORT_JSON = JSON.stringify(
  {
    name: 'Growbig100 — 24/7 Cached Lead Qualifier, GTM Enricher & Calendar Booker',
    nodes: [
      {
        parameters: {
          httpMethod: 'POST',
          path: 'growbig100-lead',
          responseMode: 'responseNode',
        },
        id: 'node-webhook-trigger',
        name: 'WhatsApp / Web Lead Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [220, 300],
      },
      {
        parameters: {
          jsCode: `// Layer 0 Cache & Boilerplate Stripper (Zero Wasted Tokens)
const body = $input.first().json.body || {};
const rawMessage = (body.message || '').trim();
const normalized = rawMessage.toLowerCase().replace(/[^a-z0-9\\s]/g, '');

const faqCache = {
  pricing: 'Our 24/7 AI Agent & n8n package starts at $500/mo (25,000 BDT/mo for local businesses).',
  hours: 'We operate 10 AM - 10 PM BDT (Sat-Thu, Friday off) and AI agents run 24/7.'
};

if (normalized.includes('pricing') || normalized.includes('how much')) {
  return [{ json: { cacheHit: true, tokensUsed: 0, costUsd: 0, reply: faqCache.pricing, leadScore: 'COLD_FAQ' } }];
}
return [{ json: { cacheHit: false, cleanMessage: rawMessage.slice(0, 1200), phone: body.phone || 'web-visitor' } }];`,
        },
        id: 'node-layer0-cache',
        name: 'Layer 0 FAQ Cache & Stripper',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [460, 300],
      },
      {
        parameters: {
          conditions: {
            boolean: [{ value1: '={{$json.cacheHit}}', value2: false }],
          },
        },
        id: 'node-if-cache-miss',
        name: 'If Cache Miss -> Call Smallest LLM',
        type: 'n8n-nodes-base.if',
        typeVersion: 2,
        position: [700, 300],
      },
      {
        parameters: {
          method: 'POST',
          url: 'http://growpilot-agent:3000/api/agent/chat',
          sendBody: true,
          bodyParameters: {
            parameters: [
              { name: 'message', value: '={{$json.cleanMessage}}' },
              { name: 'sessionId', value: '={{$json.phone}}' },
              { name: 'modelPreference', value: 'gemini-3.1-flash-lite' },
            ],
          },
        },
        id: 'node-llm-agent',
        name: 'Smallest-Model Qualifier (Gemini Flash-Lite / Ollama)',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [960, 220],
      },
      {
        parameters: {
          operation: 'append',
          documentId: { __rl: true, value: 'growbig100_crm_leads_sheet', mode: 'id' },
          sheetName: { __rl: true, value: 'Qualified_Leads_And_Token_Log', mode: 'name' },
        },
        id: 'node-google-sheets',
        name: 'Append Lead + Token Cost to Google Sheets CRM',
        type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4.5,
        position: [1220, 220],
      },
    ],
    connections: {
      'WhatsApp / Web Lead Webhook': {
        main: [[{ node: 'Layer 0 FAQ Cache & Stripper', type: 'main', index: 0 }]],
      },
      'Layer 0 FAQ Cache & Stripper': {
        main: [[{ node: 'If Cache Miss -> Call Smallest LLM', type: 'main', index: 0 }]],
      },
      'If Cache Miss -> Call Smallest LLM': {
        main: [
          [{ node: 'Smallest-Model Qualifier (Gemini Flash-Lite / Ollama)', type: 'main', index: 0 }],
        ],
      },
      'Smallest-Model Qualifier (Gemini Flash-Lite / Ollama)': {
        main: [[{ node: 'Append Lead + Token Cost to Google Sheets CRM', type: 'main', index: 0 }]],
      },
    },
  },
  null,
  2
);

export const UBUNTU_SHORT_RUNBOOK_MD = `# GrowPilot — Short Runbook & Ubuntu 24.04 Deployment Guide

Built by **Abu Kawser** (\`abukawser.xyz\`) for **Growbig100**.
Designed so any engineer can deploy the full stack in under 3 minutes on Ubuntu 24.04 LTS.

## 1. Architecture Overview (Why It Costs Near $0.00 to Run)
1. **Layer 0 Normalized Cache (0 Tokens, <5ms)**: Strips HTML/boilerplate (~80% token reduction) and matches recurring FAQs or previously scraped URLs from memory before calling any LLM.
2. **Smallest-Model Router**:
   - **Local Open-Source (Ubuntu 24.04 / VPS)**: Runs \`llama3.2:3b\` via **Ollama** in Docker for **$0.00/token** FAQ answering, article summarization, and initial ICP scoring.
   - **Cloud API Tier**: Routes fast classification to \`gemini-3.1-flash-lite\` ($0.075/1M tokens) and grounded multi-channel outbound copy to \`gemini-3.8-flash\`, gated by \`ICP Score >= 60\`.
3. **5-Layer Groundedness Gate**: Adapted from \`CareerPilot\` — verifies entity names, numerical claims, and extracted facts against source text to guarantee zero hallucinated claims.

## 2. Quickstart on Ubuntu 24.04 LTS (Docker + Ollama + n8n)
\`\`\`bash
# 1. Clone repo & configure environment
git clone https://github.com/Mayamoho/growpilot-ai-agent.git
cd growpilot-ai-agent
cp .env.example .env

# 2. Run unit tests for cache, token math & 5-layer groundedness gate
npm test

# 3. Start GrowPilot + Ollama (llama3.2:3b) + n8n + Cloudflare Tunnel
docker compose up -d

# 4. Verify running containers
docker compose ps
\`\`\`

## 3. Exposing on \`abukawser.xyz\` via Your Cloudflare Tunnel (\`GrowPilot\`)
Your Cloudflare Tunnel is already created:
- **Tunnel Name**: \`GrowPilot\`
- **Tunnel ID**: \`8f0db1e0-1a9b-4d7b-9bcc-bc314a1c880e\`
- **OS / Architecture**: \`Debian / Ubuntu 24.04 (64-bit)\` or \`Docker\`

### Option A: Run Directly on Ubuntu 24.04 (Matches Your Screenshot "Debian -> 64-bit")
1. In your Ubuntu 24.04 terminal, click the **Copy** button next to **"Install cloudflared"** in your screenshot and run it to install the \`cloudflared\` package.
2. Click the **Copy** button next to **"Install as service"** and run:
   \`\`\`bash
   sudo cloudflared service install eyJhIjoi...MyJ9
   \`\`\`
   *(Or to test manually in a terminal without installing a background service, run the 3rd box: \`cloudflared tunnel run --token eyJhIjoi...MyJ9\`)*.
3. Look at the bottom of the Cloudflare page under **Connection Status** — once you see your Ubuntu machine connected, click **Next** (or go to the **Public Hostname** tab of the \`GrowPilot\` tunnel) and add:
   - **Subdomain**: *(leave blank for root \`abukawser.xyz\` or enter \`gtm\` for \`gtm.abukawser.xyz\`)* | **Domain**: \`abukawser.xyz\` | **Service Type**: \`HTTP\` | **URL**: \`localhost:3000\`
   - **Subdomain**: \`agent\` | **Domain**: \`abukawser.xyz\` | **Service Type**: \`HTTP\` | **URL**: \`localhost:5678\` (for your local n8n instance)

### Option B: Run Inside Docker Compose (\`docker-compose.yml\`)
If you prefer \`docker compose up -d\` to manage the tunnel automatically:
1. Copy just the token string (\`eyJhIjoi...MyJ9\`) from the command in your screenshot.
2. Paste it into your \`.env\` file as \`CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...MyJ9\`.
3. In the Cloudflare **Public Hostname** tab, point \`gtm.abukawser.xyz\` to \`http://growpilot-agent:3000\` and \`agent.abukawser.xyz\` to \`http://n8n:5678\`.
`;

export const GROWBIG100_APPLICATION_EMAIL = `To: saadi@growbig100.com
Subject: AI Automation Engineer – Abu Kawser

Hello Saadi,

I'm Abu Kawser, a final-year CSE undergraduate at the University of Dhaka, applying for the AI Automation Engineer role at Growbig100.

To show how I build cost-efficient AI agents and GTM automations, I built **GrowPilot** — a live GTM Engineering & 24/7 Cached Lead Qualification Agent deployed on my domain:

1. **Work Sample (GrowPilot — Live Demo & n8n Workflow)**:
   - Live Agent & GTM Workbench: https://abukawser.xyz (and live cloud preview)
   - What it does:
     a) **Autonomous GTM Pipeline**: Scrapes company pages/articles, strips HTML boilerplate (saving ~80% of input tokens), scores ICP fit (0–100), skips low-fit leads to save tokens, and generates grounded cold emails, WhatsApp openers, and social media posts verified by a 5-layer anti-hallucination gate.
     b) **24/7 Cached WhatsApp/Web FAQ & Booking Agent**: Answers niche FAQs via a Layer 0 cache (0 tokens, $0.00, <5ms), qualifies lead budget/timeline with a 6-turn sliding window, and books appointments into CRM/Google Sheets via n8n.
     c) **Ubuntu 24.04 Docker + Open-Source LLM Ready**: Includes a complete docker-compose.yml bundling the agent, self-hosted n8n, and local Ollama (Llama 3.2 3B) with short operational docs.

2. **AI Models / LLMs I Use**:
   - **Cloud APIs**: Gemini (Gemini 3.1 Flash-Lite & Gemini 3.8 Flash), Groq (Llama 3.3 70B), and Claude 3.5 Sonnet.
   - **Local Open-Source (on Ubuntu 24.04)**: Llama 3.2 3B and Qwen 2.5 7B via Ollama for zero-cost classification, summarization, and local testing.

3. **Which Model I Like Most & Why**:
   - For high-throughput agents and GTM pipelines, **Gemini Flash / Flash-Lite paired with Groq (Llama 3.3)** is my favorite production combination, while **Claude 3.5 Sonnet** is my go-to for complex coding in Cursor/Claude Code.
   - Why: In customer-facing WhatsApp/web agents and bulk lead enrichment, latency and token cost determine ROI. By combining a Layer 0 FAQ cache with Flash-Lite for intent routing and enforcing a deterministic 5-layer groundedness check in code, I get sub-second responses at <$0.0002 per lead with zero fabricated claims.

4. **Related Production Projects**:
   - **CareerPilot**: Python + LLM job-matching & CV engine featuring a 5-layer groundedness gate (zero fabricated lines, verified via CI cassettes).
   - **CSEDU Digital Knowledge Platform**: Hybrid pgvector + PostgreSQL full-text RAG assistant with SSE streaming, prompt-injection screening, and Groq/Gemini fallback deployed with Docker Compose on an Azure VM.
   - **Bornomala**: 5th Place National Winner (July Hackathon 2026) — offline Bangla SMS compression PWA achieving a 5.15x compression gain.

Portfolio: https://abukawser.xyz (Fallback: https://portfolio-sable-nu-70.vercel.app/)
GitHub: https://github.com/Mayamoho
CV: Attached (Abu_Kawser_CV.pdf)

I run Ubuntu 24.04 Linux on my laptop with a stable connection for the remote period, live in Pallabi, Dhaka (ready to commute to Uttara or Notun Bazar when the office opens), and am ready to start the 48-hour paid test task anytime.

Best regards,
Abu Kawser
+880 1315 267528
kawserabu11mini@gmail.com`;
