import {
  type FaqItem,
  type GroundednessReport,
  type CostMetrics,
  type GenerationSource,
} from '../utils/agentEngine';

export interface GtmProspectPreset {
  id: string;
  companyName: string;
  sourceUrl: string;
  industry: string;
  taskType: 'B2B_GTM_OUTBOUND' | 'ARTICLE_DIGEST' | 'LOW_FIT_TEST';
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
  /** Which code path actually wrote the copy — never report a template as model output. */
  generationSource?: GenerationSource;
  modelError?: string | null;
}

export type AutomationDeliveryStatus = 'delivered' | 'failed' | 'not_configured';

export interface CrmBookingRecord {
  id: string;
  leadName: string;
  businessType: string;
  channel: 'WhatsApp Business' | 'Website Widget';
  needSummary: string;
  monthlyBudgetUsd: number;
  leadScore: 'HOT_BOOKED' | 'WARM_NURTURE' | 'COLD_FAQ' | 'FAQ_ONLY';
  bookedSlot: string;
  modelUsed: string;
  tokensUsed: number;
  costUsd: number;
  createdAt?: string;
  timestamp?: string;
  /** Whether the downstream n8n automation actually received this lead. */
  automationStatus?: AutomationDeliveryStatus;
}

export const PRESET_PROSPECTS: GtmProspectPreset[] = [
  {
    id: 'preset-dentacare-clinic',
    companyName: 'DentaCare Aesthetic & Implant Center',
    sourceUrl: 'https://dentacare-clinic.example.com/services',
    industry: 'Healthcare & Dental Clinic',
    taskType: 'B2B_GTM_OUTBOUND',
    rawHtmlSample: `<!DOCTYPE html><html><head><title>DentaCare Aesthetic Clinic</title>
      <style>.navbar{display:flex;background:#111;padding:24px;} .footer-links{font-size:11px;color:#999;}</style>
      <script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date());</script>
      </head><body>
      <nav class="navbar"><ul><li>Home</li><li>About</li><li>Privacy Policy</li><li>Cookie Settings</li></ul></nav>
      <main>
        <h1>DentaCare Aesthetic & Implant Center</h1>
        <p>We operate a 12-chair specialist dental clinic serving 450 patients monthly for dental implants, aligners, and laser whitening.</p>
        <p>Our reception desk currently handles appointment booking manually via phone calls and WhatsApp messages between 10 AM and 8 PM. Inquiries received after 8 PM wait until the next afternoon for a reply.</p>
        <p>Consultation fee is 1,000 BDT and we spend $1,400 monthly on social and search ads to generate patient leads.</p>
      </main>
      <footer><p>Copyright 2026 DentaCare. All rights reserved. Terms of Service.</p></footer>
    </body></html>`,
  },
  {
    id: 'preset-cloudscale-saas',
    companyName: 'CloudScale B2B Commerce & Logistics',
    sourceUrl: 'https://cloudscale-b2b.example.io/growth',
    industry: 'B2B SaaS & E-Commerce Enablement',
    taskType: 'B2B_GTM_OUTBOUND',
    rawHtmlSample: `<html><head><script src="https://cdn.example.com/analytics.js"></script><style>body{margin:0;font-family:sans-serif;}</style></head>
      <body>
      <header>Navigation Menu | Login | Sign Up | Pricing | Careers</header>
      <article>
        <h1>CloudScale B2B Commerce Automation</h1>
        <p>CloudScale powers inventory syncing and WhatsApp order notifications for 320 retail merchants across South Asia.</p>
        <p>Our sales engineering team processes 90 inbound demo requests per week using manual Google Sheets spreadsheets and HubSpot CRM imports, leading to a 14-hour response delay.</p>
        <p>We are actively expanding our n8n webhook integrations and automated outbound lead enrichment workflows in Q4 2026 with a monthly software budget of $2,200.</p>
      </article>
      <footer>Privacy | Security | Status Page | Unsubscribe</footer>
      </body></html>`,
  },
  {
    id: 'preset-llm-caching-digest',
    companyName: 'Production LLM Cost & Caching Digest',
    sourceUrl: 'https://engineering.example.com/llm-token-optimization-2026',
    industry: 'AI Engineering Technical Article',
    taskType: 'ARTICLE_DIGEST',
    rawHtmlSample: `<html><head><style>.sidebar{width:280px;display:block;}</style><script>console.log("tracking");</script></head>
      <body>
      <nav>Blog | Docs | Tutorials | Newsletter</nav>
      <main>
        <h1>Cutting Production AI Agent Costs by 92% with Layer 0 Caching and Smallest-Model Routing</h1>
        <p>In production WhatsApp and web support agents, 64% of incoming user messages ask repetitive questions about pricing, working hours, integrations, and onboarding timelines.</p>
        <p>By placing a normalized Layer 0 semantic cache in front of Gemini 3.5 Flash-Lite and local Ollama Llama 3.2 3B models, engineering teams reduce median response latency from 1,450ms to 4ms while spending $0.00 on cached turns.</p>
        <p>Furthermore, stripping HTML DOM boilerplate before scraping prospect websites removes 78% of non-content tokens and prevents context window pollution during B2B lead enrichment.</p>
      </main>
      <footer>Subscribe to our RSS feed. Cookie preferences.</footer>
      </body></html>`,
  },
  {
    id: 'preset-low-icp-hobby',
    companyName: 'Vintage Postcard Collectors Archive',
    sourceUrl: 'https://postcards-hobby-archive.example.org',
    industry: 'Personal Hobby Blog (Low-ICP Test)',
    taskType: 'LOW_FIT_TEST',
    rawHtmlSample: `<html><head><style>body{background:#fafafa;}</style></head>
      <body>
      <nav>Home | My 1920s Postcards | Contact</nav>
      <main>
        <h1>Personal Archive of 1920s Railway Postcards</h1>
        <p>Welcome to my personal hobby blog where I scan and catalog vintage paper postcards from my grandfather's collection. I do not sell anything, offer no commercial services, and do not take bookings or ads.</p>
      </main>
      <footer>Personal non-commercial hobby site.</footer>
      </body></html>`,
  },
];

export const INITIAL_FAQS: FaqItem[] = [
  {
    id: 'faq-pricing',
    category: 'Pricing & Plans',
    question: 'How much does a 24/7 WhatsApp & Web AI Agent cost per month?',
    keywords: ['price', 'pricing', 'cost', 'monthly', 'budget', 'package', 'how much', 'rate', 'fee'],
    answer:
      'Our 24/7 AI Agent & n8n automation package starts at $500/month for full-stack GTM & WhatsApp automation. Because we use Layer 0 caching and smallest-model routing (Gemini Flash-Lite + local Ollama), API token overhead stays under $5/month for 25,000+ conversations.',
  },
  {
    id: 'faq-whatsapp-n8n',
    category: 'WhatsApp & n8n Integration',
    question: 'How do you connect the AI agent to WhatsApp Business, Google Sheets, and CRMs?',
    keywords: ['whatsapp', 'n8n', 'webhook', 'google sheets', 'crm', 'hubspot', 'connect', 'integration', 'meta'],
    answer:
      'We connect the official Meta WhatsApp Business Cloud API and website chat widgets to self-hosted n8n workflows via webhooks. Every qualified lead, budget score, and booked appointment is synced in real time to Google Sheets and your CRM with automatic follow-up triggers.',
  },
  {
    id: 'faq-caching-cost',
    category: 'Token Efficiency & Caching',
    question: 'How do you keep LLM API token costs so low without losing quality?',
    keywords: ['token', 'cache', 'caching', 'cheap', 'cost', 'efficient', 'smallest model', 'ollama', 'flash', 'save'],
    answer:
      'We use a 4-stage efficiency pipeline: (1) Layer 0 normalized FAQ & URL cache (0 tokens, <5ms latency), (2) HTML boilerplate stripping that cuts ~80% of scraped input tokens, (3) a 6-turn sliding conversation window, and (4) routing simple tasks to Ollama Llama 3.2 3B ($0.00) or Gemini 3.5 Flash-Lite ($0.30/1M tokens).',
  },
  {
    id: 'faq-docker-vps',
    category: 'Docker & Ubuntu Deployment',
    question: 'Can this agent and n8n stack run on our own Ubuntu VPS with Docker?',
    keywords: ['docker', 'vps', 'ubuntu', 'deploy', 'self-hosted', 'server', 'linux', 'container'],
    answer:
      'Yes! The entire stack—including the Node/TypeScript Agent API, self-hosted n8n workflow engine, and Ollama local open-source LLM—deploys via a single docker-compose.yml file on Ubuntu 24.04 LTS.',
  },
  {
    id: 'faq-groundedness',
    category: 'Anti-Hallucination & Groundedness',
    question: 'How do you prevent the AI agent from hallucinating prices or false facts?',
    keywords: ['hallucinate', 'hallucination', 'grounded', 'accuracy', 'truth', 'verify', 'fake', 'numbers'],
    answer:
      'Every generated response passes through a deterministic 5-layer groundedness verifier that cross-checks entity names, numerical claims, and key facts against your verified knowledge base before sending.',
  },
];

export const INITIAL_GTM_RECORDS: GtmPipelineRecord[] = [
  {
    id: 'gtm-seed-1',
    companyName: 'DentaCare Aesthetic & Implant Center',
    sourceUrl: 'https://dentacare-clinic.example.com/services',
    industry: 'Healthcare & Dental Clinic',
    timestamp: '14:20',
    rawCharCount: 1094,
    cleanedCharCount: 682,
    rawEstimatedTokens: 274,
    cleanedEstimatedTokens: 171,
    tokensSavedPct: 37.6,
    icpScore: 96,
    icpThreshold: 60,
    qualificationStatus: 'QUALIFIED_OUTBOUND',
    icpReasoning:
      'Scored 96/100 (Threshold: 60). Strong alignment across 5 GTM signals. Cleared for grounded outbound & social generation.',
    matchedSignals: [
      'High-intent customer booking or appointment flow',
      'Active digital presence / inbound lead volume',
      'Automation or response-time bottleneck identified',
    ],
    summary:
      'DentaCare is a 12-chair dental clinic serving 450 monthly patients for implants and aligners, currently losing after-hours WhatsApp inquiries due to manual next-day receptionist replies.',
    extractedFacts: [
      '12-chair specialist clinic serving 450 monthly patients',
      'Core offers: Dental Implants, Clear Aligners, Laser Whitening (1,000 BDT consultation)',
      'Pain point: After-8 PM WhatsApp inquiries wait until next afternoon for manual reply',
      'Active paid acquisition: $1,400/month across social and search ads',
    ],
    generatedAssets: {
      coldEmailSubject: 'Fixing after-8 PM WhatsApp implant bookings for DentaCare',
      coldEmailBody: `Hi DentaCare team,\n\nNoticed your 12-chair clinic serves 450 patients monthly and invests $1,400/month on paid ads, but inquiries after 8 PM wait until the next afternoon for manual reception follow-up.\n\nWe deploy a cached 24/7 WhatsApp Business AI Agent connected to n8n and Google Sheets that answers implant & aligner FAQs (including your 1,000 BDT consultation fee) and books chair slots automatically in under 3 seconds.\n\nOpen to a 10-minute walkthrough this week?\n\nBest,\nGrowPilot Automation Team`,
      whatsappOpener: `Hello DentaCare team! We noticed your clinic runs $1,400/mo in ads for your 12-chair center, but after-8 PM WhatsApp leads wait until the next day. We built a 24/7 WhatsApp AI Agent + n8n booking workflow that qualifies implant patients and books your 1,000 BDT consultations automatically. Want me to send a 60-sec live demo link?`,
      followUpMessage: `Hi DentaCare team — following up in case after-hours WhatsApp booking automation is a priority this quarter. Happy to share a live sandbox tailored to your 12-chair implant clinic.`,
      socialMediaPost: `Why clinics lose 35%+ of paid ad leads after 8 PM (and how a $0.0002 AI agent fixes it):\n\nTake a 12-chair dental center serving 450 patients/month and spending $1,400/mo on ads. When a patient messages on WhatsApp at 9:30 PM asking about aligners or a 1,000 BDT consultation, waiting until the next afternoon kills conversion.\n\nBy pairing a Layer 0 FAQ cache with Gemini 3.5 Flash-Lite + n8n -> Google Sheets, every patient gets an instant, grounded reply and booked slot 24/7.`,
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
          detail: 'Target entity "DentaCare" accurately anchored in output.',
        },
        {
          layer: 2,
          name: 'Numerical & Metric Fidelity Gate',
          passed: true,
          detail: '0 fabricated numbers detected (all numeric tokens verified against source).',
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
      estimatedCostUsd: 0.000185,
      baselineFrontierCostUsd: 0.00854,
      costSavedUsd: 0.008355,
      latencyMs: 360,
    },
  },
];

export const INITIAL_CRM_BOOKINGS: CrmBookingRecord[] = [
  {
    id: 'crm-101',
    leadName: 'Dr. Rafiqul Islam (SmileCare Dental)',
    businessType: 'Healthcare Clinic',
    channel: 'WhatsApp Business',
    needSummary: '24/7 WhatsApp patient qualification + Google Sheets appointment sync',
    monthlyBudgetUsd: 650,
    leadScore: 'HOT_BOOKED',
    bookedSlot: 'Sun 19 Oct, 11:30 AM',
    modelUsed: 'Gemini 3.5 Flash-Lite',
    tokensUsed: 184,
    costUsd: 0.000038,
    createdAt: '11:15 AM',
  },
  {
    id: 'crm-102',
    leadName: 'Nadia Chowdhury (ScaleUp E-Commerce)',
    businessType: 'D2C Brand',
    channel: 'Website Widget',
    needSummary: 'Automated outbound lead enrichment + n8n CRM follow-up sequence',
    monthlyBudgetUsd: 900,
    leadScore: 'HOT_BOOKED',
    bookedSlot: 'Mon 20 Oct, 4:00 PM',
    modelUsed: 'Ollama Llama 3.2 3B (Local)',
    tokensUsed: 210,
    costUsd: 0.0,
    createdAt: '12:40 PM',
  },
];

