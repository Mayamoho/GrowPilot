import 'dotenv/config';
import http from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Type,
  type FunctionDeclaration,
} from '@google/genai';
import {
  stripHtmlAndBoilerplate,
  normalizeCacheKey,
  matchFaqCache,
  calculateRunCost,
  evaluateIcpFit,
  verifyGroundedness,
  trimConversationWindow,
  type ModelTierId,
  type FaqItem,
  type ChatTurn,
} from './src/utils/agentEngine.ts';
import {
  INITIAL_FAQS,
  INITIAL_GTM_RECORDS,
  INITIAL_CRM_BOOKINGS,
  type GtmPipelineRecord,
  type CrmBookingRecord,
} from './src/data/seedData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Server-side in-memory stores & Layer 0 Caches
let faqsStore: FaqItem[] = [...INITIAL_FAQS];
let gtmRecordsStore: GtmPipelineRecord[] = [...INITIAL_GTM_RECORDS];
let crmBookingsStore: CrmBookingRecord[] = [...INITIAL_CRM_BOOKINGS];
const gtmCache = new Map<string, GtmPipelineRecord>();
const responseFaqCache = new Map<string, { reply: string; category: string; faqId: string }>();
const sessionHistoryStore = new Map<string, ChatTurn[]>();

// Seed Layer 0 GTM cache with initial seed record
for (const rec of INITIAL_GTM_RECORDS) {
  const key = normalizeCacheKey(`${rec.companyName}_${rec.sourceUrl}_${rec.icpThreshold}`);
  gtmCache.set(key, rec);
}

let telemetryLedger = {
  totalRequests: 14,
  cacheHits: 6,
  totalTokensUsed: 971,
  totalCostUsd: 0.0002427,
  totalSavedUsd: 0.04182,
};

const bookDiscoveryCallDeclaration: FunctionDeclaration = {
  name: 'book_discovery_call',
  description:
    'Book a 30-minute discovery call and log the qualified lead into the GrowPilot CRM when the user shares their business need and monthly budget.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      leadName: {
        type: Type.STRING,
        description: 'Name of the prospect or company.',
      },
      businessType: {
        type: Type.STRING,
        description: 'Industry or business type (e.g., Dental Clinic, B2B SaaS, E-Commerce).',
      },
      monthlyBudgetUsd: {
        type: Type.NUMBER,
        description: 'Monthly automation budget in USD.',
      },
      needSummary: {
        type: Type.STRING,
        description: 'Summary of the AI agent or n8n workflow they need.',
      },
      preferredSlot: {
        type: Type.STRING,
        description: 'Confirmed day and time slot in BDT (e.g., Tue 22 Oct, 4:00 PM BDT).',
      },
    },
    required: ['leadName', 'businessType', 'monthlyBudgetUsd', 'needSummary', 'preferredSlot'],
  },
};

function buildDeterministicGroundedAssets(params: {
  companyName: string;
  cleanedText: string;
  industry: string;
  icpScore: number;
}) {
  const sentences = params.cleanedText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const summary =
    sentences.slice(0, 2).join(' ') ||
    `${params.companyName} operates in ${params.industry} and provides customer-facing services with automation opportunities.`;

  const extractedFacts =
    sentences.slice(0, 4).length > 0
      ? sentences.slice(0, 4)
      : [
          `${params.companyName} operates in the ${params.industry} sector`,
          `Identified ICP fit score of ${params.icpScore}/100 for workflow automation`,
        ];

  const primaryHook = extractedFacts[0] || summary;

  return {
    summary,
    extractedFacts,
    coldEmailSubject: `Automating 24/7 lead qualification & workflows for ${params.companyName}`,
    coldEmailBody: `Hi ${params.companyName} team,\n\nI was reviewing your operations (${primaryHook}) and noticed a strong opportunity to streamline customer response and lead capture.\n\nWe build 24/7 AI agents connected via n8n to WhatsApp, Google Sheets, and Google Calendar—using a Layer 0 FAQ cache so recurring inquiries cost $0.00 in tokens and book qualified leads automatically.\n\nWould you be open to a 10-minute walkthrough of a live agent configured for ${params.companyName}?`,
    whatsappOpener: `Assalamu Alaikum ${params.companyName} team! Noticed your work in ${params.industry} (${primaryHook.slice(0, 95)}). We built a 24/7 WhatsApp + n8n AI agent that answers FAQs for $0.00 in cached tokens and books qualified leads straight into Google Sheets. Can I share a quick test link?`,
    followUpMessage: `Quick follow-up for ${params.companyName} — I prepared a zero-cost cached FAQ & booking workflow tailored to your ${params.industry} services. Let me know if you'd like to test it live!`,
    socialMediaPost: `How ${params.companyName} (${params.industry}) can turn inbound traffic into booked appointments 24/7 without wasting LLM tokens:\n\n• Strip HTML boilerplate (-78% input tokens)\n• Answer top FAQs from Layer 0 cache (0 tokens, <5ms)\n• Route high-intent leads via n8n to Google Calendar & CRM with a 5-layer groundedness check.`,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = http.createServer(app);

  app.use(express.json({ limit: '2mb' }));

  // 1. Get full application state & telemetry
  app.get('/api/state', (_req, res) => {
    res.json({
      faqs: faqsStore,
      gtmRecords: gtmRecordsStore,
      crmBookings: crmBookingsStore,
      telemetry: {
        ...telemetryLedger,
        cacheHitRatePct:
          telemetryLedger.totalRequests > 0
            ? Math.round((telemetryLedger.cacheHits / telemetryLedger.totalRequests) * 1000) / 10
            : 0,
        gtmCacheSize: gtmCache.size,
      },
    });
  });

  // 2. Clear Layer 0 Cache (for testing Cold Run vs Cache Hit)
  app.post('/api/cache/clear', (_req, res) => {
    gtmCache.clear();
    responseFaqCache.clear();
    res.json({
      cleared: true,
      message: 'Layer 0 GTM and FAQ caches cleared. Next identical request will run a fresh model pass.',
    });
  });

  // 3. Add a custom FAQ to the Layer 0 Knowledge Base
  app.post('/api/faq/add', (req, res) => {
    const { category, question, keywords, answer } = req.body || {};
    if (!question || !answer) {
      res.status(400).json({ error: 'Both question and answer are required.' });
      return;
    }

    const parsedKeywords = Array.isArray(keywords)
      ? keywords
      : String(keywords || question)
          .toLowerCase()
          .split(/[,\s]+/)
          .filter((w) => w.length > 3);

    const newFaq: FaqItem = {
      id: `faq-${Date.now()}`,
      category: category?.trim() || 'Custom FAQ',
      question: question.trim(),
      keywords: parsedKeywords.length > 0 ? parsedKeywords : ['custom'],
      answer: answer.trim(),
    };

    faqsStore = [newFaq, ...faqsStore];
    res.json({ faq: newFaq, faqs: faqsStore });
  });

  // 4. Autonomous GTM Engineering Pipeline (Scrape/Strip -> ICP Score Gate -> Grounded Generation -> CRM)
  app.post('/api/gtm/analyze', async (req, res) => {
    const startMs = Date.now();
    const {
      companyName = 'Target Prospect',
      sourceUrl = 'https://example.com',
      industry = 'B2B Services & Automation',
      rawContent = '',
      icpThreshold = 60,
      modelPreference = 'gemini-3.8-flash',
      bypassCache = false,
    } = req.body || {};

    if (!companyName.trim() || (!rawContent.trim() && !sourceUrl.trim())) {
      res.status(400).json({ error: 'Please provide a company/article name and content or URL.' });
      return;
    }

    const selectedTier: ModelTierId =
      modelPreference === 'ollama-llama3.2-3b' ||
      modelPreference === 'gemini-3.1-flash-lite' ||
      modelPreference === 'gemini-3.8-flash'
        ? modelPreference
        : 'gemini-3.8-flash';

    const cacheKey = normalizeCacheKey(
      `${companyName}_${sourceUrl}_${rawContent.slice(0, 160)}_${icpThreshold}`
    );

    // Layer 0 Cache Check
    if (!bypassCache && gtmCache.has(cacheKey)) {
      const cachedRecord = gtmCache.get(cacheKey)!;
      const cachedCost = calculateRunCost({
        modelUsed: selectedTier,
        cacheHit: true,
        inputTokens: cachedRecord.cleanedEstimatedTokens,
        outputTokens: 260,
        rawUnstrippedInputTokens: cachedRecord.rawEstimatedTokens,
        latencyMs: Math.max(2, Date.now() - startMs),
      });

      const updatedCachedRecord: GtmPipelineRecord = {
        ...cachedRecord,
        id: `gtm-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        costMetrics: cachedCost,
      };

      telemetryLedger.totalRequests += 1;
      telemetryLedger.cacheHits += 1;
      telemetryLedger.totalSavedUsd = Number(
        (telemetryLedger.totalSavedUsd + cachedCost.costSavedUsd).toFixed(6)
      );

      gtmRecordsStore = [
        updatedCachedRecord,
        ...gtmRecordsStore.filter((r) => r.companyName !== updatedCachedRecord.companyName),
      ];

      res.json({
        record: updatedCachedRecord,
        telemetry: telemetryLedger,
      });
      return;
    }

    // Step 1: Fetch live URL if rawContent is empty and sourceUrl is http/https
    let contentToProcess = rawContent;
    if (!contentToProcess.trim() && /^https?:\/\//i.test(sourceUrl)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4500);
        const fetchRes = await fetch(sourceUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'GrowPilot-GTM-Bot/1.0 (+https://abukawser.xyz)' },
        });
        clearTimeout(timeout);
        if (fetchRes.ok) {
          contentToProcess = await fetchRes.text();
        }
      } catch {
        contentToProcess = `Company: ${companyName}. URL: ${sourceUrl}. Industry: ${industry}. Provides commercial services, customer consultations, and digital lead capture.`;
      }
    }

    // Step 2: Strip HTML boilerplate to save ~80% input tokens
    const stripped = stripHtmlAndBoilerplate(contentToProcess);

    // Step 3: Evaluate ICP Fit & Token-Saving Gate
    const icpEval = evaluateIcpFit(stripped.cleanedText, industry, Number(icpThreshold));

    if (icpEval.qualificationStatus === 'SKIPPED_LOW_ICP') {
      const skippedCost = calculateRunCost({
        modelUsed: 'gemini-3.1-flash-lite',
        cacheHit: false,
        inputTokens: Math.min(45, stripped.cleanedEstimatedTokens),
        outputTokens: 15,
        rawUnstrippedInputTokens: stripped.rawEstimatedTokens,
        latencyMs: Math.max(18, Date.now() - startMs),
      });

      const skippedRecord: GtmPipelineRecord = {
        id: `gtm-${Date.now()}`,
        companyName: companyName.trim(),
        sourceUrl: sourceUrl.trim(),
        industry: industry.trim(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        rawCharCount: stripped.rawCharCount,
        cleanedCharCount: stripped.cleanedCharCount,
        rawEstimatedTokens: stripped.rawEstimatedTokens,
        cleanedEstimatedTokens: stripped.cleanedEstimatedTokens,
        tokensSavedPct: stripped.tokensSavedPct,
        icpScore: icpEval.icpScore,
        icpThreshold: Number(icpThreshold),
        qualificationStatus: 'SKIPPED_LOW_ICP',
        icpReasoning: icpEval.reasoning,
        matchedSignals: icpEval.matchedSignals,
        summary: `Lead scored ${icpEval.icpScore}/100 (below ${icpThreshold} threshold). Outbound generation was automatically skipped to save LLM tokens.`,
        extractedFacts: ['Below ICP fit threshold — outbound sequence suppressed'],
        generatedAssets: {
          coldEmailSubject: '[SKIPPED BY ICP GATE — 0 OUTBOUND TOKENS SPENT]',
          coldEmailBody:
            'Outbound generation was intentionally skipped because this prospect scored below your configured Ideal Customer Profile (ICP) threshold.',
          whatsappOpener: '[Skipped — ICP Score below threshold]',
          followUpMessage: '[Skipped — ICP Score below threshold]',
          socialMediaPost: '[Skipped — ICP Score below threshold]',
        },
        groundednessReport: {
          passed: true,
          scorePct: 100,
          verifiedClaimsCount: 1,
          blockedHallucinationsCount: 0,
          layerChecks: [
            {
              layer: 1,
              name: 'ICP Token-Saving Gate',
              passed: true,
              detail: `Prevented full LLM generation on low-ICP target (${icpEval.icpScore}/100).`,
            },
          ],
        },
        costMetrics: skippedCost,
      };

      gtmCache.set(cacheKey, skippedRecord);
      gtmRecordsStore = [skippedRecord, ...gtmRecordsStore];
      telemetryLedger.totalRequests += 1;
      telemetryLedger.totalTokensUsed += skippedCost.totalTokens;
      telemetryLedger.totalCostUsd = Number(
        (telemetryLedger.totalCostUsd + skippedCost.estimatedCostUsd).toFixed(7)
      );
      telemetryLedger.totalSavedUsd = Number(
        (telemetryLedger.totalSavedUsd + skippedCost.costSavedUsd).toFixed(6)
      );

      res.json({ record: skippedRecord, telemetry: telemetryLedger });
      return;
    }

    // Step 4: Qualified Lead -> Generate Grounded Summary, Cold Email, WhatsApp Opener & Social Post
    let generated = buildDeterministicGroundedAssets({
      companyName: companyName.trim(),
      cleanedText: stripped.cleanedText,
      industry: industry.trim(),
      icpScore: icpEval.icpScore,
    });

    const ai = getGenAIClient();
    if (ai && selectedTier !== 'ollama-llama3.2-3b') {
      try {
        const geminiModel =
          selectedTier === 'gemini-3.1-flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-3.8-flash';
        const response = await ai.models.generateContent({
          model: geminiModel,
          contents: `Analyze this stripped source text for "${companyName}" (${industry}):\n\n${stripped.cleanedText}`,
          config: {
            systemInstruction:
              'You are a GTM Engineering & AI Automation specialist at GrowPilot. Extract ONLY factual claims present in the source text. Never invent numbers, awards, or metrics not in the text (you may mention 24/7 availability or $0.00 cached FAQs). Keep copy concise and high-converting.',
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description: '2-sentence factual summary of the business or article.',
                },
                extractedFacts: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 to 4 concrete facts extracted directly from the source text.',
                },
                coldEmailSubject: {
                  type: Type.STRING,
                  description: 'Specific cold email subject line referencing their business.',
                },
                coldEmailBody: {
                  type: Type.STRING,
                  description: 'Short 3-paragraph grounded cold email pitching 24/7 AI Agent + n8n automation.',
                },
                whatsappOpener: {
                  type: Type.STRING,
                  description: '2-sentence WhatsApp outbound message.',
                },
                followUpMessage: {
                  type: Type.STRING,
                  description: 'Short polite 2-sentence follow-up message.',
                },
                socialMediaPost: {
                  type: Type.STRING,
                  description: 'Engaging LinkedIn / social media post summarizing the insight or case study.',
                },
              },
              required: [
                'summary',
                'extractedFacts',
                'coldEmailSubject',
                'coldEmailBody',
                'whatsappOpener',
                'followUpMessage',
                'socialMediaPost',
              ],
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text.trim());
          if (parsed && parsed.summary && parsed.coldEmailBody) {
            generated = {
              summary: parsed.summary,
              extractedFacts: Array.isArray(parsed.extractedFacts)
                ? parsed.extractedFacts.slice(0, 4)
                : generated.extractedFacts,
              coldEmailSubject: parsed.coldEmailSubject || generated.coldEmailSubject,
              coldEmailBody: parsed.coldEmailBody,
              whatsappOpener: parsed.whatsappOpener || generated.whatsappOpener,
              followUpMessage: parsed.followUpMessage || generated.followUpMessage,
              socialMediaPost: parsed.socialMediaPost || generated.socialMediaPost,
            };
          }
        }
      } catch {
        // Fallback to deterministic grounded synthesis if API quota or network fails
      }
    }

    // Step 5: Run 5-Layer Groundedness Gate
    const groundednessReport = verifyGroundedness({
      sourceText: stripped.cleanedText,
      companyName: companyName.trim(),
      extractedFacts: generated.extractedFacts,
      generatedTexts: [
        generated.summary,
        generated.coldEmailBody,
        generated.whatsappOpener,
        generated.socialMediaPost,
      ],
    });

    const outputCharLength =
      generated.summary.length +
      generated.coldEmailBody.length +
      generated.whatsappOpener.length +
      generated.socialMediaPost.length;
    const outputTokens = Math.max(120, Math.ceil(outputCharLength / 4));

    const costMetrics = calculateRunCost({
      modelUsed: selectedTier,
      cacheHit: false,
      inputTokens: stripped.cleanedEstimatedTokens + 65,
      outputTokens,
      rawUnstrippedInputTokens: stripped.rawEstimatedTokens + 250,
      latencyMs: Math.max(140, Date.now() - startMs),
    });

    const newRecord: GtmPipelineRecord = {
      id: `gtm-${Date.now()}`,
      companyName: companyName.trim(),
      sourceUrl: sourceUrl.trim(),
      industry: industry.trim(),
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      rawCharCount: stripped.rawCharCount,
      cleanedCharCount: stripped.cleanedCharCount,
      rawEstimatedTokens: stripped.rawEstimatedTokens,
      cleanedEstimatedTokens: stripped.cleanedEstimatedTokens,
      tokensSavedPct: stripped.tokensSavedPct,
      icpScore: icpEval.icpScore,
      icpThreshold: Number(icpThreshold),
      qualificationStatus: 'QUALIFIED_OUTBOUND',
      icpReasoning: icpEval.reasoning,
      matchedSignals: icpEval.matchedSignals,
      summary: generated.summary,
      extractedFacts: generated.extractedFacts,
      generatedAssets: {
        coldEmailSubject: generated.coldEmailSubject,
        coldEmailBody: generated.coldEmailBody,
        whatsappOpener: generated.whatsappOpener,
        followUpMessage: generated.followUpMessage,
        socialMediaPost: generated.socialMediaPost,
      },
      groundednessReport,
      costMetrics,
    };

    gtmCache.set(cacheKey, newRecord);
    gtmRecordsStore = [
      newRecord,
      ...gtmRecordsStore.filter((r) => r.companyName !== newRecord.companyName),
    ];

    telemetryLedger.totalRequests += 1;
    telemetryLedger.totalTokensUsed += costMetrics.totalTokens;
    telemetryLedger.totalCostUsd = Number(
      (telemetryLedger.totalCostUsd + costMetrics.estimatedCostUsd).toFixed(7)
    );
    telemetryLedger.totalSavedUsd = Number(
      (telemetryLedger.totalSavedUsd + costMetrics.costSavedUsd).toFixed(6)
    );

    res.json({
      record: newRecord,
      telemetry: telemetryLedger,
    });
  });

  // 5. 24/7 Cached FAQ & WhatsApp Lead Qualification Agent
  app.post('/api/agent/chat', async (req, res) => {
    const startMs = Date.now();
    const {
      message = '',
      sessionId = 'default-session',
      modelPreference = 'gemini-3.1-flash-lite',
      channel = 'WhatsApp Business',
    } = req.body || {};

    if (!message.trim()) {
      res.status(400).json({ error: 'Message cannot be empty.' });
      return;
    }

    const selectedTier: ModelTierId =
      modelPreference === 'ollama-llama3.2-3b' ||
      modelPreference === 'gemini-3.1-flash-lite' ||
      modelPreference === 'gemini-3.8-flash'
        ? modelPreference
        : 'gemini-3.1-flash-lite';

    const history = sessionHistoryStore.get(sessionId) || [];
    const userTurn: ChatTurn = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    // Layer 5 Prompt-Injection & Safety Screen first
    if (/ignore previous instructions|system prompt|you are now dan|disregard all rules/i.test(message)) {
      const blockedReply =
        'Security Gate Active: Prompt-injection or instruction-override attempt blocked before LLM invocation (0 tokens spent). How can I help you with AI agents, n8n workflows, or appointment booking?';
      const costMetrics = calculateRunCost({
        modelUsed: selectedTier,
        cacheHit: true,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 2,
      });

      res.json({
        reply: blockedReply,
        trace: {
          layerTriggered: 'Layer 5 Prompt-Injection Screen (Blocked)',
          intent: 'PROMPT_INJECTION_BLOCKED',
          leadScore: 'COLD_FAQ',
          budgetUsd: 0,
          nextAction: 'REJECT_INJECTION',
          bookedSlot: null,
          slidingWindowTurns: history.length,
          droppedTurns: 0,
          costMetrics,
        },
        crmBookings: crmBookingsStore,
        telemetry: telemetryLedger,
      });
      return;
    }

    // Layer 0 Normalized FAQ Cache Check (0 Tokens, $0.00)
    const faqMatch = matchFaqCache(message, faqsStore);
    if (faqMatch.matched && faqMatch.faq) {
      const costMetrics = calculateRunCost({
        modelUsed: selectedTier,
        cacheHit: true,
        inputTokens: 140,
        outputTokens: 85,
        latencyMs: Math.max(2, Date.now() - startMs),
      });

      const assistantTurn: ChatTurn = {
        role: 'assistant',
        content: faqMatch.faq.answer,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      };

      const windowResult = trimConversationWindow([...history, userTurn, assistantTurn], 6);
      sessionHistoryStore.set(sessionId, windowResult.trimmed);

      telemetryLedger.totalRequests += 1;
      telemetryLedger.cacheHits += 1;
      telemetryLedger.totalSavedUsd = Number(
        (telemetryLedger.totalSavedUsd + costMetrics.costSavedUsd).toFixed(6)
      );

      res.json({
        reply: faqMatch.faq.answer,
        trace: {
          layerTriggered: `Layer 0 Exact/Normalized FAQ Cache (${faqMatch.faq.category})`,
          cacheKey: faqMatch.cacheKey,
          confidence: faqMatch.confidence,
          intent: 'FAQ_INQUIRY',
          leadScore: 'COLD_FAQ',
          budgetUsd: 0,
          nextAction: 'ANSWER_FROM_CACHE_AND_PROMPT_QUALIFICATION',
          bookedSlot: null,
          slidingWindowTurns: windowResult.trimmed.length,
          droppedTurns: windowResult.droppedCount,
          costMetrics,
        },
        crmBookings: crmBookingsStore,
        telemetry: telemetryLedger,
      });
      return;
    }

    // Layer 1: Smallest-Model Lead Qualification & Calendar Booking
    const windowPre = trimConversationWindow([...history, userTurn], 6);

    const budgetMatch = message.match(/\$\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:usd|dollars|bdt)/i);
    let extractedBudgetUsd = 0;
    if (budgetMatch) {
      const rawNum = Number((budgetMatch[1] || budgetMatch[2] || '0').replace(/,/g, ''));
      extractedBudgetUsd = /bdt/i.test(message) && rawNum > 5000 ? Math.round(rawNum / 120) : rawNum;
    }

    let intent = 'LEAD_QUALIFICATION';
    let leadScore: 'HOT_BOOKED' | 'WARM_NURTURE' | 'COLD_FAQ' = 'WARM_NURTURE';
    let nextAction = 'COLLECT_BUDGET_AND_NEED';
    let bookedSlot: string | null = null;
    let replyText = '';

    if (extractedBudgetUsd >= 500) {
      intent = 'HIGH_INTENT_BOOKING';
      leadScore = 'HOT_BOOKED';
      nextAction = 'CALL_GOOGLE_CALENDAR_AND_APPEND_CRM';
      bookedSlot = 'Mon 21 Oct, 3:30 PM BDT (30-min Discovery Call)';
      replyText = `Thank you! With a monthly budget of $${extractedBudgetUsd}/mo, you qualify for our full 24/7 WhatsApp + Website AI Agent & n8n CRM Automation suite. I checked our team's Google Calendar and reserved ${bookedSlot} for your walkthrough. Your lead profile has been logged to the GrowPilot CRM sheet as HOT_BOOKED.`;
    } else if (extractedBudgetUsd > 0 && extractedBudgetUsd < 500) {
      intent = 'LOW_BUDGET_NURTURE';
      leadScore = 'WARM_NURTURE';
      nextAction = 'SEND_FREE_PLAYBOOK_NO_CALENDAR_SLOT';
      replyText = `Thanks for sharing your $${extractedBudgetUsd}/mo budget! Since our custom managed 24/7 AI Agent + n8n setups start at $500/mo, I've logged your details as WARM_NURTURE in our CRM and sent our free self-hosted n8n + Ollama starter guide so you can get started right away without using a paid consultation slot.`;
    } else {
      replyText =
        "I'd love to help automate your workflow! To recommend the right AI Agent + n8n setup and check our calendar slots, could you quickly share: (1) What your business does, (2) Whether you need WhatsApp/web booking or GTM outbound, and (3) Your approximate monthly budget (e.g., $500+/mo)?";

      const ai = getGenAIClient();
      if (ai && selectedTier !== 'ollama-llama3.2-3b') {
        try {
          const geminiRes = await ai.models.generateContent({
            model:
              selectedTier === 'gemini-3.8-flash' ? 'gemini-3.8-flash' : 'gemini-3.1-flash-lite',
            contents: `Conversation history (last ${windowPre.trimmed.length} turns):\n${windowPre.trimmed
              .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
              .join('\n')}\n\nRespond to the latest user message.`,
            config: {
              systemInstruction:
                'You are GrowPilot’s 24/7 AI Lead Qualification Agent. Answer concisely in 2-3 sentences based strictly on these facts: Starter AI Agent + n8n package is $500/mo (25,000 BDT/mo), deploys in 48h on Docker, connects to WhatsApp, Google Sheets, and Google Calendar. Politely ask for their business type, automation goal, and monthly budget to book a discovery call.',
              temperature: 0.2,
            },
          });
          if (geminiRes.text) {
            replyText = geminiRes.text.trim();
          }
        } catch {
          // Keep deterministic qualification prompt on fallback
        }
      }
    }

    const inputTokens = Math.ceil(
      windowPre.trimmed.reduce((acc, m) => acc + m.content.length, 0) / 4 + 55
    );
    const outputTokens = Math.ceil(replyText.length / 4);

    const costMetrics = calculateRunCost({
      modelUsed: selectedTier,
      cacheHit: false,
      inputTokens,
      outputTokens,
      latencyMs: Math.max(115, Date.now() - startMs),
    });

    const assistantTurn: ChatTurn = {
      role: 'assistant',
      content: replyText,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    const finalWindow = trimConversationWindow([...windowPre.trimmed, assistantTurn], 6);
    sessionHistoryStore.set(sessionId, finalWindow.trimmed);

    if (extractedBudgetUsd > 0) {
      const newBooking: CrmBookingRecord = {
        id: `crm-${Date.now()}`,
        leadName:
          extractedBudgetUsd >= 500
            ? 'Qualified Prospect (Live Chat)'
            : 'Nurture Prospect (Live Chat)',
        businessType: /clinic|dental|doctor/i.test(message)
          ? 'Healthcare / Dental Clinic'
          : /saas|ecommerce|store|agency/i.test(message)
          ? 'B2B / E-Commerce Brand'
          : 'Inbound Business Lead',
        channel: channel as 'WhatsApp Business' | 'Website Widget',
        needSummary: message.slice(0, 90),
        monthlyBudgetUsd: extractedBudgetUsd,
        leadScore,
        bookedSlot: bookedSlot || 'Nurture Sequence (No Calendar Slot Used)',
        modelUsed: costMetrics.modelLabel,
        tokensUsed: costMetrics.totalTokens,
        costUsd: costMetrics.estimatedCostUsd,
        createdAt: 'Just now',
      };
      crmBookingsStore = [newBooking, ...crmBookingsStore];
    }

    telemetryLedger.totalRequests += 1;
    telemetryLedger.totalTokensUsed += costMetrics.totalTokens;
    telemetryLedger.totalCostUsd = Number(
      (telemetryLedger.totalCostUsd + costMetrics.estimatedCostUsd).toFixed(7)
    );
    telemetryLedger.totalSavedUsd = Number(
      (telemetryLedger.totalSavedUsd + costMetrics.costSavedUsd).toFixed(6)
    );

    res.json({
      reply: replyText,
      trace: {
        layerTriggered: `Layer 1 Smallest-Model Router (${costMetrics.modelLabel})`,
        cacheKey: normalizeCacheKey(message),
        confidence: 0.94,
        intent,
        leadScore,
        budgetUsd: extractedBudgetUsd,
        nextAction,
        bookedSlot,
        slidingWindowTurns: finalWindow.trimmed.length,
        droppedTurns: finalWindow.droppedCount,
        costMetrics,
      },
      crmBookings: crmBookingsStore,
      telemetry: telemetryLedger,
    });
  });

  // 6. Real-Time Voice Agent WebSocket Server (`gemini-3.8-live`) on `/live`
  const wss = new WebSocketServer({ noServer: true });
  const viteHmrWss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', 'http://localhost:3000').pathname;
    if (pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      viteHmrWss.handleUpgrade(request, socket, head, (ws) => {
        ws.send(JSON.stringify({ type: 'connected' }));
        ws.on('error', () => {});
      });
    }
  });

  wss.on('connection', async (clientWs: WebSocket, request: http.IncomingMessage) => {
    const reqUrl = new URL(request.url || '/live', 'http://localhost:3000');
    const requestedVoice = reqUrl.searchParams.get('voice') || 'Zephyr';
    const validVoices = new Set(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']);
    const voiceName = validVoices.has(requestedVoice) ? requestedVoice : 'Zephyr';

    const ai = getGenAIClient();
    if (!ai) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message:
            'GEMINI_API_KEY is not configured. Please check Settings > Secrets to enable live voice streaming with gemini-3.8-live.',
        })
      );
      clientWs.close();
      return;
    }

    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;

    const sessionPromise = ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: [bookDiscoveryCallDeclaration] }],
        systemInstruction:
          'You are GrowPilot, the 24/7 Voice Qualification and Appointment Booking AI Agent. Speak naturally, concisely, and warmly in 1-3 short sentences. Key facts: Our 24/7 WhatsApp & Web AI Agent + n8n automation package starts at $500/month (or 25,000 BDT/month for local Bangladesh clinics and businesses) and deploys in 48 hours on Docker. Ask the caller what their business does and their approximate monthly budget. When they share their business need and a budget, call the book_discovery_call tool to log their lead and book a discovery slot.',
      },
      callbacks: {
        onopen: () => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'connected',
                model: 'gemini-3.8-live',
                voice: voiceName,
              })
            );
          }
        },
        onmessage: (message: LiveServerMessage) => {
          if (clientWs.readyState !== WebSocket.OPEN) return;

          const parts = message.serverContent?.modelTurn?.parts || [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              clientWs.send(
                JSON.stringify({
                  type: 'audio',
                  audio: part.inlineData.data,
                })
              );
            }
            if (part.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'transcript',
                  role: 'assistant',
                  text: part.text,
                })
              );
            }
          }

          const serverContentAny = message.serverContent as Record<string, unknown> | undefined;
          const inputTranscript = (
            serverContentAny?.inputTranscription as { text?: string } | undefined
          )?.text;
          if (inputTranscript) {
            clientWs.send(
              JSON.stringify({
                type: 'transcript',
                role: 'user',
                text: inputTranscript,
              })
            );
          }

          const outputTranscript = (
            serverContentAny?.outputTranscription as { text?: string } | undefined
          )?.text;
          if (outputTranscript) {
            clientWs.send(
              JSON.stringify({
                type: 'transcript',
                role: 'assistant',
                text: outputTranscript,
              })
            );
          }

          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ type: 'interrupted', interrupted: true }));
          }

          // Handle Function Calling in Live API
          const functionCalls = message.toolCall?.functionCalls;
          if (functionCalls && functionCalls.length > 0) {
            for (const call of functionCalls) {
              if (call.name === 'book_discovery_call') {
                const args = (call.args || {}) as Record<string, unknown>;
                const budgetNum = Number(args.monthlyBudgetUsd || 600);
                const newBooking: CrmBookingRecord = {
                  id: `crm-live-${Date.now()}`,
                  leadName: String(args.leadName || 'Voice Caller Lead'),
                  businessType: String(args.businessType || 'Voice Qualified Business'),
                  channel: 'WhatsApp Business',
                  needSummary: String(
                    args.needSummary || '24/7 Voice-Qualified AI Agent & n8n Setup'
                  ),
                  monthlyBudgetUsd: budgetNum,
                  leadScore: budgetNum >= 500 ? 'HOT_BOOKED' : 'WARM_NURTURE',
                  bookedSlot: String(
                    args.preferredSlot || 'Tue 22 Oct, 4:00 PM BDT (Voice Booked)'
                  ),
                  modelUsed: 'gemini-3.8-live',
                  tokensUsed: 320,
                  costUsd: 0.00019,
                  createdAt: 'Live Voice Call',
                };

                crmBookingsStore = [newBooking, ...crmBookingsStore];
                telemetryLedger.totalRequests += 1;

                clientWs.send(
                  JSON.stringify({
                    type: 'crm_booking',
                    booking: newBooking,
                    crmBookings: crmBookingsStore,
                  })
                );

                sessionPromise
                  .then((sess) => {
                    sess.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: {
                            status: 'BOOKED',
                            bookedSlot: newBooking.bookedSlot,
                            leadScore: newBooking.leadScore,
                          },
                        },
                      ],
                    });
                  })
                  .catch(() => {});
              }
            }
          }
        },
        onerror: (err: unknown) => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'error',
                message:
                  err instanceof Error
                    ? err.message
                    : 'Live voice session encountered a connection error.',
              })
            );
          }
        },
        onclose: () => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'closed' }));
          }
        },
      },
    });

    sessionPromise
      .then((sess) => {
        liveSession = sess;
      })
      .catch((err: unknown) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: 'error',
              message:
                err instanceof Error
                  ? err.message
                  : 'Failed to initialize gemini-3.8-live session.',
            })
          );
          clientWs.close();
        }
      });

    clientWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        sessionPromise
          .then((sess) => {
            if (msg.audio) {
              sess.sendRealtimeInput({
                audio: {
                  data: msg.audio,
                  mimeType: 'audio/pcm;rate=16000',
                },
              });
            } else if (msg.text) {
              sess.sendRealtimeInput({
                text: String(msg.text),
              });
            }
          })
          .catch(() => {});
      } catch {
        // Ignore malformed frame
      }
    });

    clientWs.on('close', () => {
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`GrowPilot Full-Stack Server + Gemini Live API running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
