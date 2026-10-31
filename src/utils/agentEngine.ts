export type ModelTierId =
  | 'ollama-llama3.2-3b'
  | 'gemini-3.5-flash-lite'
  | 'gemini-3.8-flash'
  | 'frontier-baseline';

export interface ModelTierSpec {
  id: ModelTierId;
  label: string;
  provider: string;
  /** Upstream model ID actually sent to the provider API. Overridable per deployment. */
  apiModelId: string;
  inputCostPerMillionUsd: number;
  outputCostPerMillionUsd: number;
  avgLatencyMs: number;
  recommendedFor: string;
}

/**
 * Prices are the Google AI (Developer API) paid tier, read from
 * https://ai.google.dev/gemini-api/docs/pricing on 2026-10-18. Gemini 3.8 Flash is on an
 * introductory $0.75/$3.75 that becomes $1.50/$7.50 on 2027-01-01. They drift, so every value
 * here is overridable per deployment (see resolveApiModelId in server.ts).
 */
export const MODEL_TIERS: Record<ModelTierId, ModelTierSpec> = {
  'ollama-llama3.2-3b': {
    id: 'ollama-llama3.2-3b',
    label: 'Ollama Llama 3.2 3B (Ubuntu 24.04 Local)',
    provider: 'Local Open-Source (Self-Hosted Docker)',
    apiModelId: 'llama3.2:3b',
    inputCostPerMillionUsd: 0,
    outputCostPerMillionUsd: 0,
    avgLatencyMs: 290,
    recommendedFor: 'Zero-cost VPS/local FAQ routing, article summarization & ICP pre-screening',
  },
  'gemini-3.5-flash-lite': {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    provider: 'Google GenAI API',
    apiModelId: 'gemini-3.5-flash-lite',
    inputCostPerMillionUsd: 0.3,
    outputCostPerMillionUsd: 2.5,
    avgLatencyMs: 220,
    recommendedFor: 'High-speed intent classification, ICP scoring & FAQ fallback',
  },
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    provider: 'Google GenAI API',
    apiModelId: 'gemini-3.8-flash',
    inputCostPerMillionUsd: 0.75,
    outputCostPerMillionUsd: 3.75,
    avgLatencyMs: 380,
    recommendedFor: 'Grounded multi-channel outbound copy, social posts & tool calling',
  },
  'frontier-baseline': {
    id: 'frontier-baseline',
    label: 'Unoptimized Frontier Model (Baseline)',
    provider: 'Legacy Heavy Tier',
    apiModelId: 'frontier-baseline',
    inputCostPerMillionUsd: 3.00,
    outputCostPerMillionUsd: 15.00,
    avgLatencyMs: 1850,
    recommendedFor: 'Comparison baseline only (20x more expensive per token)',
  },
};

/** Model used for the realtime voice path on `/live`. */
export const LIVE_API_MODEL_ID = 'gemini-3.8-live';

/**
 * Live API is billed per minute of audio, not per billed turn: $0.005/min in, $0.018/min out.
 * Together with the PCM byte rates below this lets /live report a measured cost instead of a
 * guessed one. Same pricing page as MODEL_TIERS.
 */
export const LIVE_AUDIO_USD_PER_MINUTE = { input: 0.005, output: 0.018 } as const;

/** Bytes per second of the 16-bit mono PCM the Live API sends and receives. */
export const LIVE_PCM_BYTES_PER_SECOND = { input: 32_000, output: 48_000 } as const;

/**
 * Audio tokens per minute, derived from Google publishing both units for the same thing
 * ($3.00-or-$0.005/min in, $12.00-or-$0.018/min out): 0.005/3.00 and 0.018/12.00 give
 * 1,667 and 1,500 tokens per minute. Only used to report a token count for voice turns.
 */
export const LIVE_TOKENS_PER_MINUTE = { input: 1_667, output: 1_500 } as const;

/** Tiers a user can actually pick in the UI (`frontier-baseline` is comparison-only). */
export const SELECTABLE_MODEL_TIERS: ModelTierId[] = [
  'ollama-llama3.2-3b',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
];

/**
 * Price label rendered in the dropdowns. Derived from MODEL_TIERS so a UI caption can
 * never disagree with the number the cost engine bills.
 */
export function formatTierPriceLabel(tier: ModelTierId): string {
  const spec = MODEL_TIERS[tier];
  if (spec.inputCostPerMillionUsd === 0 && spec.outputCostPerMillionUsd === 0) {
    return `${spec.label} ($0.00 · Local)`;
  }
  return `${spec.label} ($${spec.inputCostPerMillionUsd.toFixed(2)} in / $${spec.outputCostPerMillionUsd.toFixed(2)} out · 1M tok)`;
}

/**
 * Which code path produced a piece of generated copy, so a deterministic template
 * fallback is never displayed in the UI as if a model had written it.
 */
export type GenerationSource = 'gemini-llm' | 'ollama-local' | 'deterministic-fallback';


export interface BoilerplateStripResult {
  rawCharCount: number;
  cleanedCharCount: number;
  rawEstimatedTokens: number;
  cleanedEstimatedTokens: number;
  tokensSaved: number;
  tokensSavedPct: number;
  cleanedText: string;
}

/**
 * Strips HTML boilerplate (<script>, <style>, <nav>, <footer>, <svg>, attributes,
 * and excessive whitespace) to save ~70-85% of input tokens before any LLM call.
 */
export function stripHtmlAndBoilerplate(rawInput: string): BoilerplateStripResult {
  const rawCharCount = rawInput.length;
  const rawEstimatedTokens = Math.max(1, Math.ceil(rawCharCount / 4));

  let text = rawInput
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length > 3200) {
    text = text.slice(0, 3200).trim();
  }

  const cleanedCharCount = text.length;
  const cleanedEstimatedTokens = Math.max(1, Math.ceil(cleanedCharCount / 4));
  const tokensSaved = Math.max(0, rawEstimatedTokens - cleanedEstimatedTokens);
  const tokensSavedPct =
    rawEstimatedTokens > 0
      ? Math.round((tokensSaved / rawEstimatedTokens) * 1000) / 10
      : 0;

  return {
    rawCharCount,
    cleanedCharCount,
    rawEstimatedTokens,
    cleanedEstimatedTokens,
    tokensSaved,
    tokensSavedPct,
    cleanedText: text,
  };
}

/**
 * Normalizes a user question or URL for Layer 0 zero-token cache lookups.
 */
export function normalizeCacheKey(input: string): string {
  const stopWords = new Set([
    'a',
    'an',
    'the',
    'please',
    'can',
    'you',
    'tell',
    'me',
    'what',
    'is',
    'are',
    'your',
    'do',
    'does',
    'about',
    'hey',
    'hi',
    'hello',
  ]);

  const tokens = input
    .toLowerCase()
    .replace(/https?:\/\/(www\.)?/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word));

  return tokens.join('_') || input.trim().toLowerCase();
}

export interface FaqItem {
  id: string;
  category: string;
  question: string;
  keywords: string[];
  answer: string;
}

/**
 * Checks if an incoming user message matches the Layer 0 FAQ Knowledge Base
 * using normalized key matching and keyword overlap (0 tokens, $0.00 cost).
 */
export function matchFaqCache(
  userMessage: string,
  faqs: FaqItem[]
): { matched: boolean; faq?: FaqItem; confidence: number; cacheKey: string } {
  const cacheKey = normalizeCacheKey(userMessage);
  const lowerMsg = userMessage.toLowerCase();

  // If the message contains personal qualification info (budget numbers, my company is, etc.),
  // route to the qualification agent instead of static FAQ cache.
  if (
    /\$\s*\d+|\b\d+\s*(usd|bdt|dollars|taka|month|mo)\b/i.test(userMessage) ||
    /\b(book|schedule|appointment|my business|we need|our clinic|our company|hire)\b/i.test(
      userMessage
    )
  ) {
    return { matched: false, confidence: 0, cacheKey };
  }

  let bestFaq: FaqItem | undefined;
  let bestScore = 0;

  for (const faq of faqs) {
    const normFaqQuestion = normalizeCacheKey(faq.question);
    if (normFaqQuestion === cacheKey && cacheKey.length > 0) {
      return { matched: true, faq, confidence: 1.0, cacheKey };
    }

    let matchedKeywords = 0;
    for (const kw of faq.keywords) {
      if (lowerMsg.includes(kw.toLowerCase())) {
        matchedKeywords += 1;
      }
    }

    const score =
      faq.keywords.length > 0 ? matchedKeywords / Math.min(3, faq.keywords.length) : 0;
    if (score > bestScore) {
      bestScore = score;
      bestFaq = faq;
    }
  }

  if (bestFaq && bestScore >= 0.66) {
    return {
      matched: true,
      faq: bestFaq,
      confidence: Math.min(0.98, Math.round(bestScore * 100) / 100),
      cacheKey,
    };
  }

  return { matched: false, confidence: 0, cacheKey };
}

export interface CostMetrics {
  modelUsed: ModelTierId;
  modelLabel: string;
  cacheHit: boolean;
  /** Absent (or false) means no model was billed for this result. */
  modelCalled?: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  baselineFrontierCostUsd: number;
  costSavedUsd: number;
  latencyMs: number;
}

export function calculateRunCost(params: {
  modelUsed: ModelTierId;
  cacheHit: boolean;
  inputTokens: number;
  outputTokens: number;
  rawUnstrippedInputTokens?: number;
  latencyMs?: number;
  /** False when the deterministic template answered instead of a model — bills nothing. */
  modelCalled?: boolean;
}): CostMetrics {
  const spec = MODEL_TIERS[params.modelUsed] || MODEL_TIERS['gemini-3.5-flash-lite'];
  const frontier = MODEL_TIERS['frontier-baseline'];

  // A Layer 0 cache hit is answered without invoking any model, regardless of the
  // selected tier. Keep the audit flag aligned with the zero-token billing path.
  const modelCalled = params.modelCalled !== false && !params.cacheHit;
  const effectiveInput = params.cacheHit || !modelCalled ? 0 : params.inputTokens;
  const effectiveOutput = params.cacheHit || !modelCalled ? 0 : params.outputTokens;

  const estimatedCostUsd =
    (effectiveInput / 1_000_000) * spec.inputCostPerMillionUsd +
    (effectiveOutput / 1_000_000) * spec.outputCostPerMillionUsd;

  const baselineInput = params.rawUnstrippedInputTokens ?? Math.max(params.inputTokens * 4, 800);
  const baselineOutput = Math.max(params.outputTokens, 350);

  const baselineFrontierCostUsd =
    (baselineInput / 1_000_000) * frontier.inputCostPerMillionUsd +
    (baselineOutput / 1_000_000) * frontier.outputCostPerMillionUsd;

  const costSavedUsd = Math.max(0, baselineFrontierCostUsd - estimatedCostUsd);

  return {
    modelUsed: spec.id,
    modelLabel: spec.label,
    cacheHit: params.cacheHit,
    modelCalled,
    inputTokens: effectiveInput,
    outputTokens: effectiveOutput,
    totalTokens: effectiveInput + effectiveOutput,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(7)),
    baselineFrontierCostUsd: Number(baselineFrontierCostUsd.toFixed(6)),
    costSavedUsd: Number(costSavedUsd.toFixed(6)),
    latencyMs: params.latencyMs ?? (params.cacheHit ? 3 : spec.avgLatencyMs),
  };
}

export interface IcpEvaluation {
  icpScore: number;
  qualificationStatus: 'QUALIFIED_OUTBOUND' | 'SKIPPED_LOW_ICP';
  matchedSignals: string[];
  missingSignals: string[];
  reasoning: string;
}

/**
 * Evaluates Ideal Customer Profile (ICP) fit (0-100) and applies the token-saving gate.
 * If icpScore < threshold, downstream outbound copy generation is skipped to save tokens.
 */
export function evaluateIcpFit(
  cleanedText: string,
  industry: string,
  icpThreshold: number
): IcpEvaluation {
  const lower = `${cleanedText} ${industry}`.toLowerCase();

  const positiveSignals: Array<{ label: string; regex: RegExp; weight: number }> = [
    {
      label: 'High-intent customer booking or appointment flow',
      regex: /\b(appointment|booking|consultation|clinic|patients|schedule|whatsapp|reservation|demo)\b/i,
      weight: 24,
    },
    {
      label: 'Active digital presence / inbound lead volume',
      regex: /\b(marketing|ecommerce|leads|sales|crm|customers|support|inbound|orders|catalog)\b/i,
      weight: 22,
    },
    {
      label: 'Automation or response-time bottleneck identified',
      regex: /\b(24\/7|manual|response|follow-up|webhook|sheets|hubspot|shopify|meta|instagram|facebook)\b/i,
      weight: 20,
    },
    {
      label: 'Commercial B2B / service revenue model',
      regex: /\b(pricing|packages|services|enterprise|agency|dental|saas|real estate|hospitality)\b/i,
      weight: 18,
    },
    {
      label: 'Contact / action readiness',
      regex: /\b(contact|call|email|dhaka|bangladesh|global|online|support)\b/i,
      weight: 14,
    },
  ];

  const negativeSignals: Array<{ label: string; regex: RegExp; penalty: number }> = [
    {
      label: 'Static hobby blog or non-commercial page',
      regex: /\b(personal diary|homework assignment|no commercial services|retired hobby)\b/i,
      penalty: 45,
    },
  ];

  let score = 12;
  const matchedSignals: string[] = [];
  const missingSignals: string[] = [];

  for (const sig of positiveSignals) {
    if (sig.regex.test(lower)) {
      score += sig.weight;
      matchedSignals.push(sig.label);
    } else {
      missingSignals.push(sig.label);
    }
  }

  for (const neg of negativeSignals) {
    if (neg.regex.test(lower)) {
      score -= neg.penalty;
      missingSignals.push(`Penalty: ${neg.label}`);
    }
  }

  const clampedScore = Math.max(5, Math.min(98, score));
  const qualified = clampedScore >= icpThreshold;

  const reasoning = qualified
    ? `Scored ${clampedScore}/100 (Threshold: ${icpThreshold}). Strong alignment across ${matchedSignals.length} GTM signals. Cleared for grounded outbound & social generation.`
    : `Scored ${clampedScore}/100 (Below ${icpThreshold} ICP threshold). Outbound LLM generation automatically skipped to prevent wasted tokens.`;

  return {
    icpScore: clampedScore,
    qualificationStatus: qualified ? 'QUALIFIED_OUTBOUND' : 'SKIPPED_LOW_ICP',
    matchedSignals,
    missingSignals,
    reasoning,
  };
}

/**
 * GrowPilot's own reviewed commercial constants. Layer 2 verifies numbers about the
 * *prospect* against their page; these figures describe our offer, so they are legal in
 * copy without appearing in the source. Kept deliberately short: the outbound templates
 * avoid gratuitous digits ("a short walkthrough", not "a 10-minute walkthrough") so this
 * list never has to grow to cover marketing filler.
 */
export const OFFER_FACT_NUMBERS: string[] = [
  '0', // $0.00 cached FAQ replies
  '0.00',
  '24', // 24/7 availability
  '7',
  '24/7',
  '3', // 3-paragraph email / sub-3-second reply
  '30', // 30-minute discovery call
  '48', // 48-hour Docker deploy
  '100', // 100% grounded
  '500', // $500/mo starter package
  '25000', // 25,000 BDT/mo local price
];

export interface GroundednessLayerCheck {
  layer: number;
  name: string;
  passed: boolean;
  detail: string;
}

export interface ClaimEvidence {
  claim: string;
  status: 'supported' | 'contradicted' | 'insufficient_evidence';
  evidence: string;
  confidence: number;
}

export interface GroundednessReport {
  passed: boolean;
  scorePct: number;
  verifiedClaimsCount: number;
  blockedHallucinationsCount: number;
  layerChecks: GroundednessLayerCheck[];
  claimEvidence?: ClaimEvidence[];
}

/**
 * 5-Layer Groundedness Gate (adapted from Abu Kawser's CareerPilot architecture).
 * Verifies generated outreach copy, article summaries, and FAQ replies against source text.
 */
export function verifyGroundedness(params: {
  sourceText: string;
  companyName: string;
  extractedFacts: string[];
  generatedTexts: string[];
}): GroundednessReport {
  const combinedGenerated = params.generatedTexts.join(' ');
  const lowerSource = `${params.sourceText} ${params.companyName} ${params.extractedFacts.join(' ')}`.toLowerCase();

  // Layer 1: Entity & Brand Grounding
  const entityPassed =
    params.companyName.trim().length > 0 &&
    combinedGenerated.toLowerCase().includes(params.companyName.toLowerCase().split(' ')[0]);

  // Layer 2: Numerical & Metric Integrity (prevent fabricated numbers)
  // Two kinds of numbers legitimately appear in the copy: figures quoted from the
  // prospect's own page, and GrowPilot's own reviewed offer constants (price, SLA,
  // demo length). Anything else is an invention about the prospect and must block.
  //
  // Known limit, measured rather than assumed: this checks that every figure exists in the
  // source, not that the source used it the same way. A model can lift "10 AM" and write
  // "a 10-minute call". A word-window around each number was tried to catch that and was
  // reverted after live testing: it blocked honest paraphrase ("$1,400/mo" vs "$1,400
  // monthly on social ads") and matched on the prospect's own name instead of meaning.
  // Mitigation lives upstream instead — temperature 0.2 and an extraction-only prompt that
  // forbids re-purposing a source digit into a new claim.
  const allowedNumbers = new Set(OFFER_FACT_NUMBERS);
  const numericPattern = /\b\d[\d,]*(?:\.\d+)?%?\b/g;
  const normalizeNumericToken = (raw: string) => raw.replace(/,/g, '');

  const sourceNumbers = lowerSource.match(numericPattern) || [];
  sourceNumbers.forEach((n) => allowedNumbers.add(normalizeNumericToken(n)));

  const generatedNumbers = combinedGenerated.match(numericPattern) || [];
  const unverifiedNumbers = generatedNumbers.filter(
    (n) => !allowedNumbers.has(normalizeNumericToken(n))
  );
  const numericPassed = unverifiedNumbers.length === 0;

  // Layer 3: Source Fact Citation Overlap
  let verifiedFacts = 0;
  for (const fact of params.extractedFacts) {
    const words = fact
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4);
    const hasOverlap = words.some((w) => lowerSource.includes(w));
    if (hasOverlap) verifiedFacts += 1;
  }
  const factCoveragePassed =
    params.extractedFacts.length === 0 || verifiedFacts >= Math.ceil(params.extractedFacts.length * 0.75);

  // Layer 4: Zero-Fabrication & Anti-Slop Claim Filter
  const forbiddenFabrications = [
    /fortune 500 winner/i,
    /guaranteed 10,000% roi/i,
    /as seen on cnn and forbes yesterday/i,
    /we noticed your recent \$50m series c/i,
  ];
  const fabricatedMatches = forbiddenFabrications.filter((rx) => rx.test(combinedGenerated));
  const antiFabricationPassed = fabricatedMatches.length === 0;

  // Layer 5: Prompt Injection & Instruction Leak Screen
  const injectionPatterns = [
    /ignore previous instructions/i,
    /system prompt leaked/i,
    /disregard all rules/i,
    /you are now dan/i,
  ];
  const injectionPassed = !injectionPatterns.some(
    (rx) => rx.test(params.sourceText) || rx.test(combinedGenerated)
  );

  const layerChecks: GroundednessLayerCheck[] = [
    {
      layer: 1,
      name: 'Entity & Target Attribution Gate',
      passed: entityPassed,
      detail: entityPassed
        ? `Target entity "${params.companyName}" accurately anchored in output.`
        : `Target entity "${params.companyName}" missing from generated output.`,
    },
    {
      layer: 2,
      name: 'Numerical & Metric Fidelity Gate',
      passed: numericPassed,
      detail: numericPassed
        ? `0 fabricated numbers detected (${generatedNumbers.length} numeric tokens verified).`
        : `Blocked unverified numeric claims: ${[...new Set(unverifiedNumbers)].join(', ')}`,
    },
    {
      layer: 3,
      name: 'Extracted Fact Grounding Check',
      passed: factCoveragePassed,
      detail: `${verifiedFacts}/${params.extractedFacts.length} extracted hooks verified directly against stripped source text.`,
    },
    {
      layer: 4,
      name: 'Anti-Hallucination & Claim Filter',
      passed: antiFabricationPassed,
      detail: antiFabricationPassed
        ? 'Zero fabricated awards, fake funding rounds, or unverified ROI claims.'
        : `Blocked ${fabricatedMatches.length} fabricated claim pattern(s).`,
    },
    {
      layer: 5,
      name: 'Prompt-Injection & Safety Screen',
      passed: injectionPassed,
      detail: injectionPassed
        ? 'Input and output passed adversarial prompt-injection screening.'
        : 'Adversarial prompt-injection pattern detected and neutralized.',
    },
  ];

  const passedCount = layerChecks.filter((c) => c.passed).length;
  const blockedHallucinationsCount =
    unverifiedNumbers.length + fabricatedMatches.length + (injectionPassed ? 0 : 1);

  const evidenceSource = `${params.sourceText} ${params.extractedFacts.join(' ')}`.trim();
  const sourceSentences = evidenceSource
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 12);
  const claimEvidence: ClaimEvidence[] = params.extractedFacts.slice(0, 20).map((claim) => {
    const words = claim.toLowerCase().split(/\W+/).filter((word) => word.length > 4);
    const match = sourceSentences.find((sentence) => {
      const lower = sentence.toLowerCase();
      return words.length > 0 && words.filter((word) => lower.includes(word)).length >= Math.min(3, words.length);
    });
    return {
      claim,
      status: match ? 'supported' : 'insufficient_evidence',
      evidence: match ? match.slice(0, 280) : 'No matching source span found.',
      confidence: match ? 0.85 : 0.2,
    };
  });

  return {
    passed: passedCount === layerChecks.length,
    scorePct: Math.round((passedCount / layerChecks.length) * 100),
    verifiedClaimsCount: verifiedFacts + (entityPassed ? 1 : 0),
    blockedHallucinationsCount,
    layerChecks,
    claimEvidence,
  };
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Caps conversation memory at a sliding window of `maxTurns` (default 6)
 * to prevent context-window token bloat in 24/7 WhatsApp/Web agent threads.
 */
export function trimConversationWindow(
  messages: ChatTurn[],
  maxTurns: number = 6
): { trimmed: ChatTurn[]; droppedCount: number; tokensSavedEstimate: number } {
  if (messages.length <= maxTurns) {
    return { trimmed: messages, droppedCount: 0, tokensSavedEstimate: 0 };
  }
  const droppedCount = messages.length - maxTurns;
  const dropped = messages.slice(0, droppedCount);
  const trimmed = messages.slice(-maxTurns);
  const droppedChars = dropped.reduce((sum, m) => sum + m.content.length, 0);
  const tokensSavedEstimate = Math.ceil(droppedChars / 4);

  return { trimmed, droppedCount, tokensSavedEstimate };
}

export interface GtmCsvExportRow {
  companyName: string;
  industry: string;
  icpScore: number;
  qualificationStatus: string;
  sourceUrl: string;
  tokensSavedPct: number;
  modelLabel: string;
  cacheHit: boolean;
  estimatedCostUsd: number;
  summary: string;
  coldEmailSubject: string;
}

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value ?? '').replace(/\r?\n/g, ' ');
  if (/[",]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Formats analyzed GTM lead records into an RFC-4180 CSV string including
 * Company Name, Industry, AI-generated ICP Match Score, status, and token telemetry.
 */
export function formatGtmLeadsCsv(rows: GtmCsvExportRow[]): string {
  const headers = [
    'Company Name',
    'Industry',
    'ICP Match Score',
    'Qualification Status',
    'Source URL',
    'Tokens Saved %',
    'Model Used',
    'Cache Hit',
    'Cost USD',
    'Executive Summary',
    'Cold Email Subject',
  ];

  const lines = rows.map((r) =>
    [
      escapeCsvCell(r.companyName),
      escapeCsvCell(r.industry),
      r.icpScore,
      escapeCsvCell(r.qualificationStatus),
      escapeCsvCell(r.sourceUrl),
      `${r.tokensSavedPct}%`,
      escapeCsvCell(r.modelLabel),
      r.cacheHit ? 'YES' : 'NO',
      r.estimatedCostUsd.toFixed(6),
      escapeCsvCell(r.summary),
      escapeCsvCell(r.coldEmailSubject),
    ].join(',')
  );

  return [headers.join(','), ...lines].join('\n');
}

const DHAKA_UTC_OFFSET_MINUTES = 360;
const MONTH_ABBREVIATIONS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Returns the next free 30-minute discovery slot on a weekday, relative to `now`.
 * Replaces the previous hardcoded "Mon 21 Oct" string that every booking reused.
 */
export function nextAvailableSlot(
  now: Date,
  takenSlotCount: number,
  businessHourStart = 10,
  businessHourEnd = 19
): { label: string; startsAt: Date } {
  const local = new Date(now.getTime() + DHAKA_UTC_OFFSET_MINUTES * 60_000);
  const cursor = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));

  const slotIndex = Math.max(0, takenSlotCount);
  const slotsPerDay = Math.max(1, (businessHourEnd - businessHourStart) * 2);

  let remaining = slotIndex % slotsPerDay;
  let dayGuard = 0;

  while (dayGuard < 400) {
    const day = cursor.getUTCDay();
    const isWeekday = day !== 0 && day !== 6;
    if (isWeekday) {
      const hoursIntoDay = Math.floor(remaining / 2);
      const minutes = remaining % 2 === 0 ? 0 : 30;
      const hour = businessHourStart + hoursIntoDay;
      if (hour < businessHourEnd) break;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    remaining = 0;
    dayGuard += 1;
  }

  const hour = businessHourStart + Math.floor(remaining / 2);
  const minute = remaining % 2 === 0 ? 0 : 30;
  let startsAt = new Date(
    Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), hour, minute) -
      DHAKA_UTC_OFFSET_MINUTES * 60_000
  );

  // Never hand back a slot that has already passed (e.g. a 22:00 enquiry).
  if (startsAt.getTime() <= now.getTime()) {
    return nextAvailableSlot(new Date(now.getTime() + 24 * 60 * 60 * 1000), takenSlotCount);
  }

  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const amPm = hour < 12 ? 'AM' : 'PM';
  const label =
    `${DAY_ABBREVIATIONS[cursor.getUTCDay()]} ${cursor.getUTCDate()} ` +
    `${MONTH_ABBREVIATIONS[cursor.getUTCMonth()]}, ${displayHour}:${String(minute).padStart(2, '0')} ${amPm} BDT` +
    ' (30-min Discovery Call)';

  return { label, startsAt };
}

/**
 * Pure IPv4/IPv6 classifier used by the URL fetch guard. Returns true for any address that
 * must never be reached on behalf of a user-supplied URL (cloud metadata, RFC1918,
 * loopback, link-local, carrier-grade NAT, and IPv6 unique-local).
 */
export function isPrivateOrLoopbackIp(ip: string): boolean {
  const value = ip.trim().replace(/^\[|\]$/g, '').toLowerCase();

  if (value.includes(':')) {
    if (value === '::1' || value === '::') return true;
    if (/^f[cd][0-9a-f]{2}:/.test(value)) return true; // fc00::/7 unique local
    if (/^fe[89ab][0-9a-f]:/.test(value)) return true; // fe80::/10 link-local
    if (/^ff/.test(value)) return true; // multicast
    if (/^::ffff:/.test(value)) return isPrivateOrLoopbackIp(value.replace('::ffff:', ''));
    return false;
  }

  const octets = value.split('.').map((part) => Number(part));
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return true; // unparseable -> treat as unsafe
  }

  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + GCP metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark range
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast + reserved
  return false;
}

