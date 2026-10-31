import 'dotenv/config';
import http from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
// `vite` is a dev-only dependency: importing it statically would drag it into the serverless
// bundle that Vercel builds, where the dev branch never runs. It is imported lazily below.
import path from 'path';
import fs from 'fs';
import dns from 'node:dns/promises';
import net from 'node:net';
import { fileURLToPath } from 'url';
import crypto from 'node:crypto';
import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Type,
  StartSensitivity,
  EndSensitivity,
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
  nextAvailableSlot,
  isPrivateOrLoopbackIp,
  MODEL_TIERS,
  LIVE_API_MODEL_ID,
  LIVE_AUDIO_USD_PER_MINUTE,
  LIVE_PCM_BYTES_PER_SECOND,
  LIVE_TOKENS_PER_MINUTE,
  type GenerationSource,
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
  type AutomationDeliveryStatus,
} from './src/data/seedData.ts';
import {
  checkRedisRateLimit,
  infrastructureStatus,
  loadSupabaseState,
  saveSupabaseState,
} from './src/utils/freeInfrastructure.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Model IDs and prices are deployment data, not source constants: Google ships new
 * preview IDs regularly. Env overrides win so a stale ID is a one-line fix, not a redeploy.
 */
function resolveApiModelId(tier: ModelTierId): string {
  const overrides: Partial<Record<ModelTierId, string | undefined>> = {
    'ollama-llama3.2-3b': process.env.OLLAMA_MODEL?.trim(),
    'gemini-3.5-flash-lite': process.env.GEMINI_MODEL_FLASH_LITE?.trim(),
    'gemini-3.8-flash': process.env.GEMINI_MODEL_FLASH?.trim(),
  };
  return overrides[tier] || MODEL_TIERS[tier].apiModelId;
}

const LIVE_MODEL_ID = process.env.GEMINI_MODEL_LIVE?.trim() || LIVE_API_MODEL_ID;
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(
  /\/+$/,
  ''
);
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL?.trim() || '';
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET?.trim() || '';
const WEBHOOK_MAX_ATTEMPTS = Math.max(1, Number(process.env.N8N_MAX_ATTEMPTS || 3));
// The Vercel-hosted UI calls this agent from a different origin, so the browser needs an
// explicit permit. Empty allowlist = any origin; pin it with ALLOWED_ORIGINS once the
// backend is public, because anyone who can reach this server can spend GEMINI_API_KEY.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const API_AUTH_TOKEN = process.env.GROWPILOT_API_KEY?.trim() || '';
const AUTH_REQUIRED = Boolean(API_AUTH_TOKEN) || process.env.VERCEL === '1';
const MAX_REQUESTS_PER_WINDOW = Math.max(30, Number(process.env.RATE_LIMIT_MAX || 120));
const RATE_LIMIT_WINDOW_MS = Math.max(10_000, Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000));
const requestBuckets = new Map<string, { startedAt: number; count: number }>();
const sessionTokens = new Map<string, { tenantId: string; expiresAt: number }>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const idempotencyResults = new Map<string, { expiresAt: number; result: unknown }>();
// Where the serverless deployment puts this same server. vercel.json rewrites /live onto it, and
// the upgrade handler takes either spelling because a rewrite may hand over the destination path.
const LIVE_FUNCTION_PATH = process.env.GROWPILOT_FUNCTION_PATH?.trim() || '/api/live';
// Ollama loads the model into RAM on the first call after being idle — 9s of the 21s a
// one-sentence request took on this laptop's CPU. A 25s ceiling therefore aborted every
// cold first run into the deterministic fallback, which is the tier local users hit most.
const OLLAMA_TIMEOUT_MS = Math.max(5_000, Number(process.env.OLLAMA_TIMEOUT_MS || 120_000));
const GEMINI_MAX_ATTEMPTS = Math.max(1, Number(process.env.GEMINI_MAX_ATTEMPTS || 4));
// Unset keeps the quota degrade on. An explicit empty value (or 0/false) makes a quota-blocked
// tier report the error instead of silently re-billing a cheaper model.
const rawQuotaFallback = process.env.GEMINI_QUOTA_FALLBACK;
const GEMINI_QUOTA_FALLBACK_ENABLED =
  rawQuotaFallback === undefined ? true : !/^(?:0|false|)$/i.test(rawQuotaFallback.trim());

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


// Server-side stores & Layer 0 Caches.
// Persisted to disk: a captured lead that disappears on restart is a lost sale, and the
// dashboard advertises a CRM log, so the store has to outlive the process.
const STATE_FILE = process.env.GROWPILOT_STATE_FILE
  ? path.resolve(process.env.GROWPILOT_STATE_FILE)
  : path.join(
      // A Vercel Function's working directory is read-only and its /tmp is per-instance, so hosted
      // leads only survive for that instance unless GROWPILOT_STATE_FILE points at real storage.
      process.env.VERCEL === '1' ? '/tmp' : __dirname,
      '.data',
      'growpilot-state.json'
    );

let faqsStore: FaqItem[] = [...INITIAL_FAQS];
let gtmRecordsStore: GtmPipelineRecord[] = [...INITIAL_GTM_RECORDS];
let crmBookingsStore: CrmBookingRecord[] = [...INITIAL_CRM_BOOKINGS];
const gtmCache = new Map<string, GtmPipelineRecord>();
const sessionHistoryStore = new Map<string, ChatTurn[]>();
type WebhookOutboxItem = {
  id: string;
  event: string;
  payload: Record<string, unknown>;
  attempts: number;
  nextAttemptAt: string;
  lastError?: string;
};
let webhookOutbox: WebhookOutboxItem[] = [];

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requestAuthToken(req: express.Request): string {
  const header = req.header('authorization') || '';
  return req.header('x-api-key') || (header.startsWith('Bearer ') ? header.slice(7) : '');
}

function authenticateRequest(req: express.Request, res: express.Response): boolean {
  if (!AUTH_REQUIRED) return true;
  const token = requestAuthToken(req);
  if (!API_AUTH_TOKEN || !constantTimeEqual(token, API_AUTH_TOKEN)) {
    res.status(401).json({ error: 'Authentication required. Provide the GrowPilot API key.' });
    return false;
  }
  return true;
}

function issueSessionId(tenantId: string): string {
  const id = `sess_${crypto.randomBytes(18).toString('hex')}`;
  sessionTokens.set(id, { tenantId, expiresAt: Date.now() + 30 * 60 * 1000 });
  return id;
}

function getSessionId(raw: unknown, tenantId: string): string {
  if (typeof raw === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(raw)) {
    const existing = sessionTokens.get(raw);
    if (existing && existing.expiresAt > Date.now() && existing.tenantId === tenantId) {
      existing.expiresAt = Date.now() + 30 * 60 * 1000;
      return raw;
    }
  }
  return issueSessionId(tenantId);
}

function requestTenantId(req: express.Request): string {
  return (req.header('x-tenant-id') || 'default').trim().slice(0, 80) || 'default';
}

function tenantOwns(record: { tenantId?: string }, tenantId: string): boolean {
  return (record.tenantId || 'default') === tenantId;
}

let telemetryLedger = {
  totalRequests: 0,
  cacheHits: 0,
  totalTokensUsed: 0,
  totalCostUsd: 0,
  totalSavedUsd: 0,
};

function loadPersistedState(): void {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as {
      faqs?: FaqItem[];
      gtmRecords?: GtmPipelineRecord[];
      crmBookings?: CrmBookingRecord[];
      telemetry?: Partial<typeof telemetryLedger>;
      webhookOutbox?: WebhookOutboxItem[];
    };
    if (Array.isArray(parsed.faqs) && parsed.faqs.length > 0) faqsStore = parsed.faqs;
    if (Array.isArray(parsed.gtmRecords) && parsed.gtmRecords.length > 0) {
      gtmRecordsStore = parsed.gtmRecords;
    }
    if (Array.isArray(parsed.crmBookings)) crmBookingsStore = parsed.crmBookings;
    if (parsed.telemetry) telemetryLedger = { ...telemetryLedger, ...parsed.telemetry };
    if (Array.isArray(parsed.webhookOutbox)) webhookOutbox = parsed.webhookOutbox.slice(0, 500);

    for (const rec of gtmRecordsStore) {
      if (rec.qualificationStatus === 'QUALIFIED_OUTBOUND' || rec.qualificationStatus === 'SKIPPED_LOW_ICP') {
        const key = `${rec.tenantId || 'default'}::${normalizeCacheKey(`${rec.companyName}_${rec.sourceUrl}_${rec.icpThreshold}`)}`;
        gtmCache.set(key, rec);
      }
    }
    console.log(`[state] restored ${gtmRecordsStore.length} GTM records and ${crmBookingsStore.length} CRM bookings from ${STATE_FILE}`);
  } catch (err) {
    console.warn('[state] could not restore persisted state, starting fresh:', err);
  }
}

async function hydrateSupabaseState(): Promise<void> {
  const remote = await loadSupabaseState<{
    faqs?: FaqItem[];
    gtmRecords?: GtmPipelineRecord[];
    crmBookings?: CrmBookingRecord[];
    telemetry?: Partial<typeof telemetryLedger>;
    webhookOutbox?: WebhookOutboxItem[];
  }>();
  if (!remote) return;
  if (Array.isArray(remote.faqs) && remote.faqs.length) faqsStore = remote.faqs;
  if (Array.isArray(remote.gtmRecords)) gtmRecordsStore = remote.gtmRecords;
  if (Array.isArray(remote.crmBookings)) crmBookingsStore = remote.crmBookings;
  if (remote.telemetry) telemetryLedger = { ...telemetryLedger, ...remote.telemetry };
  if (Array.isArray(remote.webhookOutbox)) webhookOutbox = remote.webhookOutbox.slice(0, 500);
  console.log(`[state] hydrated Supabase snapshot (${gtmRecordsStore.length} GTM records, ${crmBookingsStore.length} bookings)`);
}

let persistTimer: NodeJS.Timeout | null = null;
function persistState(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
      fs.writeFileSync(
        STATE_FILE,
        JSON.stringify(
          {
            faqs: faqsStore,
            gtmRecords: gtmRecordsStore.slice(0, 200),
            crmBookings: crmBookingsStore.slice(0, 200),
            telemetry: telemetryLedger,
            webhookOutbox: webhookOutbox.slice(0, 500),
          },
          null,
          2
        )
      );
      void saveSupabaseState({
        faqs: faqsStore,
        gtmRecords: gtmRecordsStore.slice(0, 200),
        crmBookings: crmBookingsStore.slice(0, 200),
        telemetry: telemetryLedger,
        webhookOutbox: webhookOutbox.slice(0, 500),
      });
    } catch (err) {
      console.warn('[state] persist failed:', err);
    }
  }, 250);
  persistTimer.unref?.();
}

loadPersistedState();

// Seed Layer 0 GTM cache with initial seed records not already restored.
for (const rec of INITIAL_GTM_RECORDS) {
  const key = `${rec.tenantId || 'default'}::${normalizeCacheKey(`${rec.companyName}_${rec.sourceUrl}_${rec.icpThreshold}`)}`;
  if (!gtmCache.has(key)) gtmCache.set(key, rec);
}


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
    // preferredSlot and needSummary stay optional on purpose: resolveLiveBooking falls back to
    // the next free slot, so requiring them forces one more question and the call often ends
    // before the lead is ever written to the CRM.
    required: ['leadName', 'businessType', 'monthlyBudgetUsd'],
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
    coldEmailBody: `Hi ${params.companyName} team,\n\nI was reviewing your operations (${primaryHook}) and noticed a strong opportunity to streamline customer response and lead capture.\n\nWe build 24/7 AI agents connected via n8n to WhatsApp, Google Sheets, and Google Calendar—using a Layer 0 FAQ cache so recurring inquiries cost $0.00 in tokens and book qualified leads automatically.\n\nWould you be open to a short live walkthrough of an agent configured for ${params.companyName}?`,
    whatsappOpener: `Assalamu Alaikum ${params.companyName} team! Noticed your work in ${params.industry} (${primaryHook.slice(0, 95)}). We built a 24/7 WhatsApp + n8n AI agent that answers FAQs for $0.00 in cached tokens and books qualified leads straight into Google Sheets. Can I share a quick test link?`,
    followUpMessage: `Quick follow-up for ${params.companyName} — I prepared a zero-cost cached FAQ & booking workflow tailored to your ${params.industry} services. Let me know if you'd like to test it live!`,
    socialMediaPost: `How ${params.companyName} (${params.industry}) can turn inbound traffic into booked appointments 24/7 without wasting LLM tokens:\n\n• Strip HTML boilerplate before the model ever sees it\n• Answer top FAQs from the Layer 0 cache at 0 tokens\n• Route high-intent leads via n8n to Google Calendar & CRM with a five-layer groundedness check.`,
  };
}

interface WebhookDelivery {
  configured: boolean;
  delivered: boolean;
  statusCode?: number;
  error?: string;
  attemptedAt: string;
  attempts?: number;
}

const webhookLedger: { last: WebhookDelivery | null; delivered: number; failed: number } = {
  last: null,
  delivered: 0,
  failed: 0,
};

/**
 * Pushes a normalized lead/booking event to the self-hosted n8n webhook configured by
 * N8N_WEBHOOK_URL. Never throws: an unreachable automation must not fail the chat turn
 * the customer is waiting on, but the outcome is surfaced so the UI can be truthful.
 */
async function dispatchToN8n(
  event: string,
  payload: Record<string, unknown>,
  options: { enqueueOnFailure?: boolean } = {}
): Promise<WebhookDelivery> {
  const attemptedAt = new Date().toISOString();
  if (!N8N_WEBHOOK_URL) {
    return { configured: false, delivered: false, error: 'N8N_WEBHOOK_URL not set', attemptedAt };
  }

  let lastDelivery: WebhookDelivery | null = null;
  for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const user = process.env.N8N_USER?.trim();
    const password = process.env.N8N_PASSWORD?.trim();
    if (user && password) {
      headers.Authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
    }

    const body = JSON.stringify({ event, source: 'growpilot', timestamp: attemptedAt, ...payload });
    if (N8N_WEBHOOK_SECRET) {
      headers['X-GrowPilot-Signature'] = `sha256=${crypto.createHmac('sha256', N8N_WEBHOOK_SECRET).update(body).digest('hex')}`;
    }
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    // n8n answers an unregistered path with 404 plus the actually actionable sentence
    // ("The workflow must be active…"), so carry that text into the log and the UI instead
    // of leaving the operator with a bare status code to guess at.
    let errorText: string | undefined = `n8n responded ${res.status}`;
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let reasoned = '';
      try {
        const parsed = JSON.parse(body) as { message?: string; hint?: string };
        reasoned = [parsed.message, parsed.hint].filter(Boolean).join(' — ');
      } catch {
        reasoned = body.trim().slice(0, 200);
      }
      if (reasoned) errorText = `n8n responded ${res.status}: ${reasoned}`;
    }

    const delivery: WebhookDelivery = {
      configured: true,
      delivered: res.ok,
      statusCode: res.status,
      error: res.ok ? undefined : errorText,
      attemptedAt,
      attempts: attempt,
    };
    lastDelivery = delivery;
    webhookLedger.last = delivery;
    if (delivery.delivered) {
      webhookLedger.delivered += 1;
      return delivery;
    }
    if (attempt < WEBHOOK_MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
  } catch (err) {
    lastDelivery = {
      configured: true,
      delivered: false,
      error: err instanceof Error ? err.message : String(err),
      attemptedAt,
      attempts: attempt,
    };
    if (attempt < WEBHOOK_MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
  } finally {
    clearTimeout(timer);
  }
  }
  const delivery = lastDelivery || { configured: true, delivered: false, error: 'No delivery attempt completed', attemptedAt };
  webhookLedger.last = delivery;
  webhookLedger.failed += 1;
  if (options.enqueueOnFailure !== false) {
    webhookOutbox = [...webhookOutbox, {
      id: `outbox-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      event,
      payload,
      attempts: delivery.attempts || WEBHOOK_MAX_ATTEMPTS,
      nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
      lastError: delivery.error,
    }].slice(-500);
    persistState();
  }
  console.warn('[n8n] webhook delivery failed:', delivery.error);
  return delivery;
}

/** Shared shape every downstream n8n flow can rely on. */
function buildLeadWebhookPayload(fields: {
  event: string;
  leadName: string;
  businessType: string;
  channel: string;
  needSummary: string;
  monthlyBudgetUsd: number;
  leadScore: string;
  bookedSlot: string | null;
  intent: string;
  tokensUsed: number;
  costUsd: number;
}): Record<string, unknown> {
  return {
    event: fields.event,
    lead_name: fields.leadName,
    business_type: fields.businessType,
    channel: fields.channel,
    need_summary: fields.needSummary,
    extracted_budget_usd: fields.monthlyBudgetUsd,
    lead_score: fields.leadScore,
    intent: fields.intent,
    booked_slot: fields.bookedSlot,
    tokens_used: fields.tokensUsed,
    cost_usd: fields.costUsd,
  };
}

const MAX_FETCH_BYTES = 400_000;
const MAX_REDIRECT_HOPS = 4;

/**
 * Fetches a prospect page for the GTM scraper without letting a user-supplied URL reach
 * internal infrastructure. Without the IP check, `http://169.254.169.254/` or
 * `http://n8n:5678/` would be proxied straight back to the caller through this endpoint.
 */
async function fetchProspectPageSafely(targetUrl: string): Promise<string> {
  let current = targetUrl;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      throw new Error('Malformed URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${parsed.protocol}`);
    }

    const host = parsed.hostname;
    if (!host) throw new Error('URL has no hostname');

    if (net.isIP(host) && isPrivateOrLoopbackIp(host)) {
      throw new Error('Refusing to fetch a private or link-local address');
    }

    const resolved = await dns.lookup(host, { all: true, verbatim: true });
    if (resolved.some((entry) => isPrivateOrLoopbackIp(entry.address))) {
      throw new Error(`Hostname "${host}" resolves to a private or internal address`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'GrowPilot-GTM-Bot/1.0 (+https://abukawser.xyz)' },
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error(`Redirect ${res.status} without a Location header`);
      current = new URL(location, current).toString();
      continue;
    }

    if (!res.ok) throw new Error(`Upstream responded ${res.status}`);

    const declaredLength = Number(res.headers.get('content-length') || 0);
    if (declaredLength > MAX_FETCH_BYTES) throw new Error('Page too large to analyze');

    const chunks: Buffer[] = [];
    let received = 0;
    if (res.body) {
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        received += chunk.byteLength;
        chunks.push(Buffer.from(chunk));
        if (received > MAX_FETCH_BYTES) break;
      }
    }
    return Buffer.concat(chunks).toString('utf8').slice(0, MAX_FETCH_BYTES);
  }

  throw new Error('Too many redirects');
}

/**
 * Gemini returns throttling 503 ("This model is currently experiencing high demand... try
 * again with exponential backoff") and 429 quota errors. Backoff clears the 503 blips; a quota
 * 429 ("check your plan and billing") is permanent for that model and is what a free-tier key
 * hits on the bigger tier first. That is this project's own thesis in practice, so the helper
 * degrades to the smallest model that answers instead of degrading to a template — and returns
 * which model actually replied so billing and the UI label follow the truth.
 */
type GeminiResult = { text: string | null; model: string; degraded: boolean };

async function generateWithGemini(
  ai: GoogleGenAI,
  request: { model: string; contents: string; config: Record<string, unknown> },
  logTag: string,
  options: { maxAttempts?: number; fallbackModel?: string } = {}
): Promise<GeminiResult> {
  const maxAttempts = options.maxAttempts ?? GEMINI_MAX_ATTEMPTS;
  const fallbackModel = GEMINI_QUOTA_FALLBACK_ENABLED ? options.fallbackModel : undefined;

  const attempt = async (model: string): Promise<GeminiResult> => {
    for (let tryNo = 1; ; tryNo++) {
      try {
        const res = await ai.models.generateContent({
          ...request,
          model,
        } as Parameters<GoogleGenAI['models']['generateContent']>[0]);
        return { text: res.text ?? null, model, degraded: model !== request.model };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const quota = /exceeded your current quota|billing/i.test(message);
        const transient =
          !quota &&
          /"(?:code|status)"\s*:\s*"?(429|500|503)|high demand|rate limit|unavailable|timed? ?out/i.test(
            message
          );
        if (tryNo < maxAttempts && transient) {
          const backoffMs = Math.min(12_000, 800 * 2 ** (tryNo - 1));
          console.warn(
            `[${logTag}] transient Gemini error on ${model} (attempt ${tryNo}/${maxAttempts}): ${message.slice(0, 120)} — retrying in ${backoffMs}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs + Math.floor(Math.random() * 250)));
          continue;
        }
        if (quota && fallbackModel && fallbackModel !== model) {
          console.warn(`[${logTag}] ${model} is out of quota for this key — falling back to ${fallbackModel}`);
          return attempt(fallbackModel);
        }
        throw err instanceof Error ? err : new Error(message);
      }
    }
  };

  return attempt(request.model);
}

/**
 * Calls the local Ollama container. Previously the "Ollama $0.00" tier only *skipped* the
 * Gemini branch and silently returned a template, so no local inference ever ran.
 */
async function generateWithOllama(
  systemInstruction: string,
  userContent: string,
  options: { json: boolean; model?: string }
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model || resolveApiModelId('ollama-llama3.2-3b'),
        stream: false,
        ...(options.json ? { format: 'json' } : {}),
        options: { temperature: 0.2 },
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userContent },
        ],
      }),
    });
    if (!res.ok) {
      console.warn(`[ollama] /api/chat responded ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { message?: { content?: string } };
    const text = data.message?.content?.trim();
    return text || null;
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    console.warn(
      `[ollama] local inference ${timedOut ? `timed out after ${OLLAMA_TIMEOUT_MS}ms` : 'unavailable'}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Created at module scope: a serverless host imports this instance instead of binding a port.
const app = express();
const httpServer = http.createServer(app);

async function startServer() {
  const PORT = Number(process.env.PORT || 3000);
  await hydrateSupabaseState();

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const devOrigin = /^https?:\/\/localhost(?::\d+)?$/i.test(origin || '') || /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin || '');
    if (origin && (ALLOWED_ORIGINS.includes(origin) || (!AUTH_REQUIRED && ALLOWED_ORIGINS.length === 0 && devOrigin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, Idempotency-Key, X-Tenant-ID');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '2mb' }));
  app.use((req, res, next) => {
    const requestId = req.header('x-request-id')?.trim() || `req_${crypto.randomBytes(8).toString('hex')}`;
    const incomingTrace = req.header('traceparent')?.match(/^00-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$/i);
    const traceId = incomingTrace?.[1] || crypto.randomBytes(16).toString('hex');
    const spanId = crypto.randomBytes(8).toString('hex');
    const startedAt = Date.now();
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('traceparent', `00-${traceId}-${spanId}-01`);
    res.locals.requestId = requestId;
    res.locals.traceId = traceId;
    res.on('finish', () => {
      console.log(JSON.stringify({
        type: 'http_span',
        traceId,
        spanId,
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      }));
    });
    next();
  });
  app.use(async (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip}:${requestAuthToken(req).slice(0, 16)}`;
    const distributedAllowed = await checkRedisRateLimit(key, MAX_REQUESTS_PER_WINDOW, RATE_LIMIT_WINDOW_MS);
    if (distributedAllowed === false) {
      res.setHeader('Retry-After', String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
      res.status(429).json({ error: 'Distributed rate limit exceeded. Please retry shortly.' });
      return;
    }
    const bucket = requestBuckets.get(key);
    if (!bucket || now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) {
      requestBuckets.set(key, { startedAt: now, count: 1 });
    } else if (++bucket.count > MAX_REQUESTS_PER_WINDOW) {
      res.setHeader('Retry-After', String(Math.ceil((RATE_LIMIT_WINDOW_MS - (now - bucket.startedAt)) / 1000)));
      res.status(429).json({ error: 'Rate limit exceeded. Please retry shortly.' });
      return;
    }
    if (requestBuckets.size > 10_000) {
      for (const [bucketKey, value] of requestBuckets) if (now - value.startedAt >= RATE_LIMIT_WINDOW_MS) requestBuckets.delete(bucketKey);
    }
    next();
  });

  // 1. Get full application state & telemetry
  app.get('/api/state', (req, res) => {
    if (!authenticateRequest(req, res)) return;
    const tenantId = requestTenantId(req);
    res.json({
      // CRM and prospect content is private. It is returned only to an authenticated operator.
      faqs: faqsStore,
      gtmRecords: gtmRecordsStore.filter((record) => tenantOwns(record, tenantId)),
      crmBookings: crmBookingsStore.filter((record) => tenantOwns(record, tenantId)),
      automation: {
        n8nConfigured: Boolean(N8N_WEBHOOK_URL),
        delivered: webhookLedger.delivered,
        failed: webhookLedger.failed,
        last: webhookLedger.last,
        pendingOutbox: webhookOutbox.length,
        tenantId,
      },
      engine: {
        geminiConfigured: Boolean(getGenAIClient()),
        ollamaBaseUrl: OLLAMA_BASE_URL,
        liveModel: LIVE_MODEL_ID,
        infrastructure: infrastructureStatus(),
      },
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
    if (!authenticateRequest(_req, res)) return;
    gtmCache.clear();
    res.json({
      cleared: true,
      message: 'Layer 0 GTM cache cleared. Next identical request will run a fresh model pass.',
    });
  });

  app.post('/api/automation/retry', async (req, res) => {
    if (!authenticateRequest(req, res)) return;
    const now = Date.now();
    const due = webhookOutbox.filter((item) => Date.parse(item.nextAttemptAt) <= now).slice(0, 20);
    const remaining: WebhookOutboxItem[] = [];
    let delivered = 0;
    for (const item of webhookOutbox) {
      if (!due.includes(item)) {
        remaining.push(item);
        continue;
      }
      const result = await dispatchToN8n(item.event, item.payload, { enqueueOnFailure: false });
      if (result.delivered) delivered += 1;
      else remaining.push({ ...item, attempts: item.attempts + 1, nextAttemptAt: new Date(Date.now() + Math.min(3_600_000, 60_000 * 2 ** Math.min(item.attempts, 6))).toISOString(), lastError: result.error });
    }
    webhookOutbox = remaining;
    persistState();
    res.json({ retried: due.length, delivered, pendingOutbox: webhookOutbox.length });
  });

  // 3. Add a custom FAQ to the Layer 0 Knowledge Base
  app.post('/api/faq/add', (req, res) => {
    if (!authenticateRequest(req, res)) return;
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
    persistState();
    res.json({ faq: newFaq, faqs: faqsStore });
  });

  // 4. Autonomous GTM Engineering Pipeline (Scrape/Strip -> ICP Score Gate -> Grounded Generation -> CRM)
  app.post('/api/gtm/analyze', async (req, res) => {
    if (!authenticateRequest(req, res)) return;
    const startMs = Date.now();
    const tenantId = requestTenantId(req);
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const companyName = body.companyName === undefined ? 'Target Prospect' : body.companyName;
    const sourceUrl = body.sourceUrl === undefined ? 'https://example.com' : body.sourceUrl;
    const industry = body.industry === undefined ? 'B2B Services & Automation' : body.industry;
    const rawContent = body.rawContent === undefined ? '' : body.rawContent;
    const modelPreference = body.modelPreference === undefined ? 'gemini-3.8-flash' : body.modelPreference;
    const bypassCache = body.bypassCache === true;
    const parsedThreshold = body.icpThreshold === undefined ? 60 : Number(body.icpThreshold);

    if (
      typeof companyName !== 'string' ||
      typeof sourceUrl !== 'string' ||
      typeof industry !== 'string' ||
      typeof rawContent !== 'string' ||
      !Number.isFinite(parsedThreshold)
    ) {
      res.status(400).json({ error: 'companyName, sourceUrl, industry and rawContent must be strings; icpThreshold must be a number.' });
      return;
    }
    const icpThreshold = Math.max(0, Math.min(100, parsedThreshold));

    if (!companyName.trim() || (!rawContent.trim() && !sourceUrl.trim())) {
      res.status(400).json({ error: 'Please provide a company/article name and content or URL.' });
      return;
    }

    const selectedTier: ModelTierId =
      modelPreference === 'ollama-llama3.2-3b' ||
      modelPreference === 'gemini-3.5-flash-lite' ||
      modelPreference === 'gemini-3.8-flash'
        ? modelPreference
        : 'gemini-3.8-flash';

    const cacheKey = `${tenantId}::${normalizeCacheKey(`${companyName}_${sourceUrl}_${rawContent.slice(0, 160)}_${icpThreshold}`)}`;

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
      persistState();

      res.json({
        record: updatedCachedRecord,
        telemetry: telemetryLedger,
      });
      return;
    }

    // Step 1: Fetch live URL if rawContent is empty and sourceUrl is http/https
    let contentToProcess = rawContent;
    let fetchNote: string | null = null;
    if (!contentToProcess.trim() && /^https?:\/\//i.test(sourceUrl)) {
      try {
        contentToProcess = await fetchProspectPageSafely(sourceUrl);
      } catch (err) {
        fetchNote = err instanceof Error ? err.message : String(err);
        console.warn(`[gtm] fetch blocked/failed for ${sourceUrl}: ${fetchNote}`);
        contentToProcess = `Company: ${companyName}. URL: ${sourceUrl}. Industry: ${industry}. Provides commercial services, customer consultations, and digital lead capture.`;
      }
    }

    // Step 2: Strip HTML boilerplate to save ~80% input tokens
    const stripped = stripHtmlAndBoilerplate(contentToProcess);

    // Step 3: Evaluate ICP Fit & Token-Saving Gate
    const icpEval = evaluateIcpFit(stripped.cleanedText, industry, Number(icpThreshold));

    if (icpEval.qualificationStatus === 'SKIPPED_LOW_ICP') {
      const skippedCost = calculateRunCost({
        modelUsed: 'gemini-3.5-flash-lite',
        cacheHit: false,
        inputTokens: Math.min(45, stripped.cleanedEstimatedTokens),
        outputTokens: 15,
        rawUnstrippedInputTokens: stripped.rawEstimatedTokens,
        latencyMs: Math.max(18, Date.now() - startMs),
        modelCalled: false,
      });

      const skippedRecord: GtmPipelineRecord = {
        id: `gtm-${Date.now()}`,
        tenantId,
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
        generationSource: 'deterministic-fallback',
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
      persistState();
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
    let generationSource: GenerationSource = 'deterministic-fallback';
    // Tier that is actually billed. Differs from the requested tier only when Gemini answered
    // on the quota fallback, so cost and the UI label never claim a pricier model than ran.
    let billedTier: ModelTierId = selectedTier;
    const notes: string[] = [];
    if (fetchNote) notes.push(`Source fetch: ${fetchNote}`);

    const generatorSystemInstruction =
      'You are a GTM Engineering & AI Automation specialist at GrowPilot. Extract ONLY factual claims present in the source text. Never invent numbers, awards, or metrics not in the text (you may mention 24/7 availability or $0.00 cached FAQs). When you restate a figure that IS on the page, keep its original unit and meaning ("10 AM" is a time, not a duration; never turn a source number into a different claim). If a duration, discount, fee or percentage is not stated in the source, write no number for it. Keep copy concise and high-converting. Reply as a single JSON object.';
    const generatorUserContent = `Analyze this stripped source text for "${companyName}" (${industry}):\n\n${stripped.cleanedText}`;
    const generatorSchema = {
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
          description: 'Short grounded cold email in three paragraphs pitching a 24/7 AI Agent plus n8n automation.',
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
    };

    function adoptGeneratedCopy(raw: string | null): boolean {
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw.trim());
        if (!parsed || !parsed.summary || !parsed.coldEmailBody) return false;
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
        return true;
      } catch {
        return false;
      }
    }

    if (selectedTier === 'ollama-llama3.2-3b') {
      const ollamaText = await generateWithOllama(
        `${generatorSystemInstruction}\nReturn JSON with keys: summary, extractedFacts, coldEmailSubject, coldEmailBody, whatsappOpener, followUpMessage, socialMediaPost.`,
        generatorUserContent,
        { json: true }
      );
      if (adoptGeneratedCopy(ollamaText)) {
        generationSource = 'ollama-local';
      } else {
        notes.push(
          ollamaText
            ? 'Local Ollama returned a response that did not match the expected JSON shape.'
            : `Local Ollama at ${OLLAMA_BASE_URL} did not answer; deterministic fallback used.`
        );
      }
    } else {
      const ai = getGenAIClient();
      if (!ai) {
        notes.push('GEMINI_API_KEY is not configured; deterministic fallback used.');
      } else {
        try {
          const result = await generateWithGemini(
            ai,
            {
              model: resolveApiModelId(selectedTier),
              contents: generatorUserContent,
              config: {
                systemInstruction: generatorSystemInstruction,
                temperature: 0.2,
                responseMimeType: 'application/json',
                responseSchema: generatorSchema,
              },
            },
            'gtm',
            { fallbackModel: resolveApiModelId('gemini-3.5-flash-lite') }
          );

          if (result.degraded) {
            billedTier = 'gemini-3.5-flash-lite';
            notes.push(
              `${resolveApiModelId(selectedTier)} is out of quota for this key; copy was generated and billed by ${result.model}.`
            );
          }

          if (adoptGeneratedCopy(result.text)) {
            generationSource = 'gemini-llm';
          } else {
            notes.push('Model returned no usable JSON; deterministic fallback used.');
            console.warn('[gtm] empty/invalid generation for', companyName);
          }
        } catch (err) {
          notes.push(
            `Generation failed on ${resolveApiModelId(selectedTier)} after ${GEMINI_MAX_ATTEMPTS} attempt(s): ` +
              (err instanceof Error ? err.message : String(err))
          );
          console.error(`[gtm] ${resolveApiModelId(selectedTier)} generation failed:`, err);
        }
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
      modelUsed: billedTier,
      cacheHit: false,
      inputTokens: stripped.cleanedEstimatedTokens + 65,
      outputTokens,
      rawUnstrippedInputTokens: stripped.rawEstimatedTokens + 250,
      latencyMs: Math.max(140, Date.now() - startMs),
      modelCalled: generationSource !== 'deterministic-fallback',
    });

    const newRecord: GtmPipelineRecord = {
      id: `gtm-${Date.now()}`,
      tenantId,
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
      generationSource,
      modelError: notes.length > 0 ? notes.join(' | ') : null,
    };

    gtmCache.set(cacheKey, newRecord);
    gtmRecordsStore = [
      newRecord,
      ...gtmRecordsStore.filter((r) => r.companyName !== newRecord.companyName),
    ];
    persistState();

    telemetryLedger.totalRequests += 1;
    telemetryLedger.totalTokensUsed += costMetrics.totalTokens;
    telemetryLedger.totalCostUsd = Number(
      (telemetryLedger.totalCostUsd + costMetrics.estimatedCostUsd).toFixed(7)
    );
    telemetryLedger.totalSavedUsd = Number(
      (telemetryLedger.totalSavedUsd + costMetrics.costSavedUsd).toFixed(6)
    );

    const delivery = await dispatchToN8n(
      'gtm.lead_generated',
      buildLeadWebhookPayload({
        event: 'gtm.lead_generated',
        leadName: newRecord.companyName,
        businessType: newRecord.industry,
        channel: 'GTM Outbound',
        needSummary: newRecord.summary.slice(0, 200),
        monthlyBudgetUsd: 0,
        leadScore: newRecord.qualificationStatus,
        bookedSlot: null,
        intent: 'GTM_OUTBOUND_READY',
        tokensUsed: costMetrics.totalTokens,
        costUsd: costMetrics.estimatedCostUsd,
      })
    );

    res.json({
      record: newRecord,
      telemetry: telemetryLedger,
      automation: {
        configured: delivery.configured,
        delivered: delivery.delivered,
        error: delivery.error,
      },
    });
  });

  // 5. 24/7 Cached FAQ & WhatsApp Lead Qualification Agent
  app.post('/api/agent/chat', async (req, res) => {
    if (!authenticateRequest(req, res)) return;
    const startMs = Date.now();
    const idempotencyKey = req.header('idempotency-key')?.trim() || '';
    if (idempotencyKey) {
      const cached = idempotencyResults.get(idempotencyKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.setHeader('X-Idempotent-Replay', 'true');
        res.json(cached.result);
        return;
      }
      if (cached) idempotencyResults.delete(idempotencyKey);
    }
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const message = body.message === undefined ? '' : body.message;
    const tenantId = requestTenantId(req);
    const sessionId = getSessionId(body.sessionId, tenantId);
    const modelPreference = body.modelPreference === undefined ? 'gemini-3.5-flash-lite' : body.modelPreference;
    const channel = body.channel === undefined ? 'WhatsApp Business' : body.channel;

    if (typeof message !== 'string' || typeof sessionId !== 'string' || typeof channel !== 'string') {
      res.status(400).json({ error: 'message, sessionId and channel must be strings.' });
      return;
    }

    if (!message.trim()) {
      res.status(400).json({ error: 'Message cannot be empty.' });
      return;
    }

    const selectedTier: ModelTierId =
      modelPreference === 'ollama-llama3.2-3b' ||
      modelPreference === 'gemini-3.5-flash-lite' ||
      modelPreference === 'gemini-3.8-flash'
        ? modelPreference
        : 'gemini-3.5-flash-lite';

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

      const blockedPayload = {
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
        crmBookings: crmBookingsStore.filter((record) => tenantOwns(record, tenantId)),
        telemetry: telemetryLedger,
      };
      if (idempotencyKey) idempotencyResults.set(idempotencyKey, { expiresAt: Date.now() + IDEMPOTENCY_TTL_MS, result: blockedPayload });
      res.json(blockedPayload);
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
      persistState();

      const faqPayload = {
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
        crmBookings: crmBookingsStore.filter((record) => tenantOwns(record, tenantId)),
        telemetry: telemetryLedger,
      };
      if (idempotencyKey) idempotencyResults.set(idempotencyKey, { expiresAt: Date.now() + IDEMPOTENCY_TTL_MS, result: faqPayload });
      res.json(faqPayload);
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
    let generationSource: GenerationSource = 'deterministic-fallback';
    let billedTier: ModelTierId = selectedTier;
    let modelError: string | null = null;

    const qualificationSystemInstruction =
      'You are GrowPilot’s 24/7 AI Lead Qualification Agent. Answer concisely in 2-3 sentences based strictly on these facts: Starter AI Agent + n8n package is $500/mo (25,000 BDT/mo), deploys in 48h on Docker, connects to WhatsApp, Google Sheets, and Google Calendar. Politely ask for their business type, automation goal, and monthly budget to book a discovery call.';
    const qualificationContents = `Conversation history (last ${windowPre.trimmed.length} turns):\n${windowPre.trimmed
      .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
      .join('\n')}\n\nRespond to the latest user message.`;

    if (extractedBudgetUsd >= 500) {
      intent = 'HIGH_INTENT_BOOKING';
      leadScore = 'HOT_BOOKED';
      nextAction = 'BOOK_CALENDAR_SLOT_AND_PUSH_TO_N8N';
      const slot = nextAvailableSlot(new Date(), crmBookingsStore.filter((b) => b.leadScore === 'HOT_BOOKED').length);
      bookedSlot = slot.label;
      replyText = `Thank you! With a monthly budget of $${extractedBudgetUsd}/mo, you qualify for our full 24/7 WhatsApp + Website AI Agent & n8n CRM Automation suite. I reserved ${bookedSlot} for your walkthrough and queued your lead for the CRM automation.`;
    } else if (extractedBudgetUsd > 0 && extractedBudgetUsd < 500) {
      intent = 'LOW_BUDGET_NURTURE';
      leadScore = 'WARM_NURTURE';
      nextAction = 'SEND_FREE_PLAYBOOK_NO_CALENDAR_SLOT';
      replyText = `Thanks for sharing your $${extractedBudgetUsd}/mo budget! Since our custom managed 24/7 AI Agent + n8n setups start at $500/mo, I've logged your details as WARM_NURTURE in our CRM and sent our free self-hosted n8n + Ollama starter guide so you can get started right away without using a paid consultation slot.`;
    } else {
      replyText =
        "I'd love to help automate your workflow! To recommend the right AI Agent + n8n setup and check our calendar slots, could you quickly share: (1) What your business does, (2) Whether you need WhatsApp/web booking or GTM outbound, and (3) Your approximate monthly budget (e.g., $500+/mo)?";

      if (selectedTier === 'ollama-llama3.2-3b') {
        const ollamaReply = await generateWithOllama(qualificationSystemInstruction, qualificationContents, {
          json: false,
        });
        if (ollamaReply) {
          replyText = ollamaReply;
          generationSource = 'ollama-local';
        } else {
          modelError = `Local Ollama at ${OLLAMA_BASE_URL} did not answer; deterministic prompt used.`;
        }
      } else {
        const ai = getGenAIClient();
        if (!ai) {
          modelError = 'GEMINI_API_KEY is not configured; deterministic prompt used.';
        } else {
          try {
            const result = await generateWithGemini(
              ai,
              {
                model: resolveApiModelId(selectedTier),
                contents: qualificationContents,
                config: {
                  systemInstruction: qualificationSystemInstruction,
                  temperature: 0.2,
                },
              },
              'agent',
              { fallbackModel: resolveApiModelId('gemini-3.5-flash-lite') }
            );
            if (result.degraded) {
              billedTier = 'gemini-3.5-flash-lite';
              modelError = `${resolveApiModelId(selectedTier)} is out of quota for this key; reply generated and billed by ${result.model}.`;
            }
            if (result.text) {
              replyText = result.text.trim();
              generationSource = 'gemini-llm';
            } else if (!modelError) {
              modelError = 'Model returned an empty reply; deterministic prompt used.';
            }
          } catch (err) {
            modelError = err instanceof Error ? err.message : String(err);
            console.error(`[agent] ${resolveApiModelId(selectedTier)} reply failed:`, err);
          }
        }
      }
    }

    const modelCalled = generationSource !== 'deterministic-fallback';
    const inputTokens = Math.ceil(
      windowPre.trimmed.reduce((acc, m) => acc + m.content.length, 0) / 4 + 55
    );
    const outputTokens = Math.ceil(replyText.length / 4);

    const costMetrics = calculateRunCost({
      modelUsed: billedTier,
      cacheHit: false,
      inputTokens,
      outputTokens,
      latencyMs: Math.max(115, Date.now() - startMs),
      modelCalled,
    });

    const assistantTurn: ChatTurn = {
      role: 'assistant',
      content: replyText,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    const finalWindow = trimConversationWindow([...windowPre.trimmed, assistantTurn], 6);
    sessionHistoryStore.set(sessionId, finalWindow.trimmed);

    let automationStatus: AutomationDeliveryStatus = 'not_configured';
    if (extractedBudgetUsd > 0) {
      const newBooking: CrmBookingRecord = {
        id: `crm-${Date.now()}`,
        tenantId,
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

      const delivery = await dispatchToN8n(
        'lead.qualified',
        buildLeadWebhookPayload({
          event: 'lead.qualified',
          leadName: newBooking.leadName,
          businessType: newBooking.businessType,
          channel: newBooking.channel,
          needSummary: newBooking.needSummary,
          monthlyBudgetUsd: newBooking.monthlyBudgetUsd,
          leadScore: newBooking.leadScore,
          bookedSlot: bookedSlot,
          intent,
          tokensUsed: newBooking.tokensUsed,
          costUsd: newBooking.costUsd,
        })
      );
      automationStatus = !delivery.configured
        ? 'not_configured'
        : delivery.delivered
          ? 'delivered'
          : 'failed';
      newBooking.automationStatus = automationStatus;

      crmBookingsStore = [newBooking, ...crmBookingsStore];
      persistState();
    }

    telemetryLedger.totalRequests += 1;
    telemetryLedger.totalTokensUsed += costMetrics.totalTokens;
    telemetryLedger.totalCostUsd = Number(
      (telemetryLedger.totalCostUsd + costMetrics.estimatedCostUsd).toFixed(7)
    );
    telemetryLedger.totalSavedUsd = Number(
      (telemetryLedger.totalSavedUsd + costMetrics.costSavedUsd).toFixed(6)
    );
    persistState();

    const responsePayload = {
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
        generationSource,
        modelError,
        automationStatus,
        slidingWindowTurns: finalWindow.trimmed.length,
        droppedTurns: finalWindow.droppedCount,
        costMetrics,
      },
      crmBookings: crmBookingsStore.filter((record) => tenantOwns(record, tenantId)),
      telemetry: telemetryLedger,
    };
    if (idempotencyKey) {
      idempotencyResults.set(idempotencyKey, { expiresAt: Date.now() + IDEMPOTENCY_TTL_MS, result: responsePayload });
      if (idempotencyResults.size > 10_000) {
        for (const [key, value] of idempotencyResults) if (value.expiresAt <= Date.now()) idempotencyResults.delete(key);
      }
    }
    res.json(responsePayload);
  });

  // 6. Real-Time Voice Agent WebSocket Server on `/live`
  const wss = new WebSocketServer({ noServer: true });
  const viteHmrWss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const upgradeUrl = new URL(request.url || '/', 'http://localhost:3000');
    const pathname = upgradeUrl.pathname;
    // `/live` is the public path; the serverless rewrite may hand over the destination instead.
    if (pathname === '/live' || pathname === LIVE_FUNCTION_PATH) {
      const origin = request.headers.origin || '';
      const originAllowed = !AUTH_REQUIRED
        ? (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin))
        : ALLOWED_ORIGINS.includes(origin);
      const queryToken = upgradeUrl.searchParams.get('apiKey') || '';
      if (!originAllowed || (AUTH_REQUIRED && (!API_AUTH_TOKEN || !constantTimeEqual(queryToken, API_AUTH_TOKEN)))) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
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
    const tenantId = String(request.headers['x-tenant-id'] || 'default').trim().slice(0, 80) || 'default';
    const requestedVoice = reqUrl.searchParams.get('voice') || 'Zephyr';
    const validVoices = new Set(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']);
    const voiceName = validVoices.has(requestedVoice) ? requestedVoice : 'Zephyr';

    const ai = getGenAIClient();
    if (!ai) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message:
            `GEMINI_API_KEY is not configured. Please set it in .env to enable live voice streaming with ${LIVE_MODEL_ID}.`,
        })
      );
      clientWs.close();
      return;
    }

    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;

    // Live audio is billed per minute, so the session counts bytes in both directions and
    // prices them with the published rates instead of the old hardcoded per-call guess.
    const base64Bytes = (s: string) =>
      Math.floor((s.length * 3) / 4) - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0);
    let outAudioBytes = 0;
    let inAudioBytes = 0;
    const audioSecondsOut = () => outAudioBytes / LIVE_PCM_BYTES_PER_SECOND.output;
    const audioSecondsIn = () => inAudioBytes / LIVE_PCM_BYTES_PER_SECOND.input;
    const measuredLiveCostUsd = () =>
      Math.round(
        ((audioSecondsOut() / 60) * LIVE_AUDIO_USD_PER_MINUTE.output +
          (audioSecondsIn() / 60) * LIVE_AUDIO_USD_PER_MINUTE.input) *
          1e7
      ) / 1e7;
    const measuredLiveTokens = () =>
      Math.round(
        (audioSecondsIn() / 60) * LIVE_TOKENS_PER_MINUTE.input +
          (audioSecondsOut() / 60) * LIVE_TOKENS_PER_MINUTE.output
      );

    const sessionPromise = ai.live.connect({
      model: LIVE_MODEL_ID,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
        // Callers speak Banglish as often as English; without the hint the recognizer
        // returns noise like "Dicky" for a Bengali sentence, and the agent answers a
        // question that was never asked.
        inputAudioTranscription: { languageCodes: ['en', 'bn-BD'] },
        outputAudioTranscription: {},
        // Laptop speakers are picked up by the mic. Default VAD is HIGH sensitivity, so the
        // agent's own voice is read back as the caller speaking, which interrupts the reply
        // mid-sentence. Lowering start sensitivity and lengthening the silence window makes
        // real barge-in still work while residual echo mostly does not.
        realtimeInputConfig: {
          automaticActivityDetection: {
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            prefixPaddingMs: 300,
            silenceDurationMs: 800,
          },
        },
        tools: [{ functionDeclarations: [bookDiscoveryCallDeclaration] }],
        systemInstruction:
          'You are GrowPilot, the 24/7 Voice Qualification and Appointment Booking AI Agent. ' +
          'Speak naturally and warmly. Keep every reply to ONE short sentence of at most 14 words, ' +
          'because long replies get cut off. Ask for only the single piece of information that is ' +
          'still missing, and NEVER re-ask something the caller already answered earlier in this call. ' +
          'If the caller speaks Bengali or Banglish, reply in the language they used. ' +
          'Key facts: Our 24/7 WhatsApp & Web AI Agent + n8n automation package starts at $500/month ' +
          '(or 25,000 BDT/month for local Bangladesh clinics and businesses) and deploys in 48 hours on Docker. ' +
          'First find out what the caller\'s business does, then their approximate monthly budget. ' +
          'As soon as you know the business and a budget, call book_discovery_call immediately — omit ' +
          'preferredSlot if no time was mentioned, the CRM will take the next free slot and you will ' +
          'read the booked time back to the caller.',
      },
      callbacks: {
        onopen: () => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'connected',
                model: LIVE_MODEL_ID,
                voice: voiceName,
              })
            );
          }
        },
        onmessage: (message: LiveServerMessage) => {
          if (clientWs.readyState !== WebSocket.OPEN) return;

          // With responseModalities:[AUDIO] the spoken words never arrive in
          // modelTurn.parts[].text (probed against the API: 0 characters, everything in
          // outputTranscription), so this loop forwards audio only and the transcript keeps
          // a single source instead of risking a doubled-up caption.
          const parts = message.serverContent?.modelTurn?.parts || [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              outAudioBytes += base64Bytes(part.inlineData.data);
              clientWs.send(
                JSON.stringify({
                  type: 'audio',
                  audio: part.inlineData.data,
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

          // turnComplete closes the response turn (observed on the wire right after the last
          // audio chunk), so the UI starts a fresh assistant bubble for the next reply.
          // Cumulative audio usage rides along to make the call cost visible during the call.
          if (message.serverContent?.turnComplete) {
            clientWs.send(
              JSON.stringify({
                type: 'usage',
                audioSecondsIn: Math.round(audioSecondsIn()),
                audioSecondsOut: Math.round(audioSecondsOut()),
                tokensUsed: measuredLiveTokens(),
                costUsd: measuredLiveCostUsd(),
              })
            );
            clientWs.send(JSON.stringify({ type: 'turn_complete' }));
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
                const preferredSlot = String(args.preferredSlot || '').trim();
                const resolvedSlot =
                  preferredSlot ||
                  nextAvailableSlot(
                    new Date(),
                    crmBookingsStore.filter((b) => b.leadScore === 'HOT_BOOKED').length
                  ).label;

                const newBooking: CrmBookingRecord = {
                  id: `crm-live-${Date.now()}`,
                  tenantId,
                  leadName: String(args.leadName || 'Voice Caller Lead'),
                  businessType: String(args.businessType || 'Voice Qualified Business'),
                  channel: 'WhatsApp Business',
                  needSummary: String(
                    args.needSummary || '24/7 Voice-Qualified AI Agent & n8n Setup'
                  ),
                  monthlyBudgetUsd: budgetNum,
                  leadScore: budgetNum >= 500 ? 'HOT_BOOKED' : 'WARM_NURTURE',
                  bookedSlot: resolvedSlot,
                  modelUsed: LIVE_MODEL_ID,
                  tokensUsed: measuredLiveTokens(),
                  costUsd: measuredLiveCostUsd(),
                  createdAt: 'Live Voice Call',
                };

                crmBookingsStore = [newBooking, ...crmBookingsStore];
                telemetryLedger.totalRequests += 1;
                persistState();

                clientWs.send(
                  JSON.stringify({
                    type: 'crm_booking',
                    booking: newBooking,
                    crmBookings: crmBookingsStore.filter((record) => tenantOwns(record, tenantId)),
                  })
                );

                // Voice callbacks are synchronous, so CRM sync settles after the booking is shown.
                dispatchToN8n(
                  'lead.qualified',
                  buildLeadWebhookPayload({
                    event: 'lead.qualified',
                    leadName: newBooking.leadName,
                    businessType: newBooking.businessType,
                    channel: 'Voice Call',
                    needSummary: newBooking.needSummary,
                    monthlyBudgetUsd: newBooking.monthlyBudgetUsd,
                    leadScore: newBooking.leadScore,
                    bookedSlot: newBooking.bookedSlot,
                    intent: 'VOICE_BOOKING',
                    tokensUsed: newBooking.tokensUsed,
                    costUsd: newBooking.costUsd,
                  })
                ).then((delivery) => {
                  newBooking.automationStatus = !delivery.configured
                    ? 'not_configured'
                    : delivery.delivered
                      ? 'delivered'
                      : 'failed';
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'crm_booking',
                        booking: newBooking,
                        crmBookings: crmBookingsStore.filter((record) => tenantOwns(record, tenantId)),
                      })
                    );
                  }
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
                              crmSync: newBooking.automationStatus,
                            },
                          },
                        ],
                      });
                    })
                    .catch((err: unknown) => {
                      console.error('[live] failed to send tool response:', err);
                    });
                });
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
          // One voice call, one metering entry: seconds actually streamed in both directions.
          const callCostUsd = measuredLiveCostUsd();
          const callTokens = measuredLiveTokens();
          if (callCostUsd > 0) {
            telemetryLedger.totalTokensUsed += callTokens;
            telemetryLedger.totalCostUsd = Number(
              (telemetryLedger.totalCostUsd + callCostUsd).toFixed(7)
            );
            persistState();
          }
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'usage',
                audioSecondsIn: Math.round(audioSecondsIn()),
                audioSecondsOut: Math.round(audioSecondsOut()),
                tokensUsed: callTokens,
                costUsd: callCostUsd,
              })
            );
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
                  : `Failed to initialize ${LIVE_MODEL_ID} session.`,
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
              inAudioBytes += base64Bytes(String(msg.audio));
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
          .catch((err: unknown) => {
            console.error('[live] failed to forward client frame to Gemini Live:', err);
          });
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
    const { createServer: createViteServer } = await import('vite');
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

  // A serverless host owns the socket and dispatches requests into this instance itself, so
  // binding a port would both fail and be pointless. Only the standalone/container path listens.
  if (process.env.VERCEL !== '1') {
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`GrowPilot Full-Stack Server + Gemini Live API running on http://0.0.0.0:${PORT}`);
      const loopbackInContainer =
        fs.existsSync('/.dockerenv') &&
        /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(N8N_WEBHOOK_URL);
      console.log(
        `[n8n] webhook target: ${N8N_WEBHOOK_URL || 'NOT CONFIGURED — set N8N_WEBHOOK_URL in .env'}` +
          (loopbackInContainer
            ? ' — loopback inside a container is the container itself; use http://n8n:5678/webhook/growpilot-lead'
            : '')
      );
    });
  }
}

// Awaited so every route is registered before a serverless invocation can reach the app.
await startServer();

export default httpServer;
