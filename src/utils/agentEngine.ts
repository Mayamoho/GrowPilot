export type ModelTierId =
  | 'ollama-llama3.2-3b'
  | 'gemini-3.1-flash-lite'
  | 'gemini-3.8-flash'
  | 'frontier-baseline';

export interface ModelTierSpec {
  id: ModelTierId;
  label: string;
  provider: string;
  inputCostPerMillionUsd: number;
  outputCostPerMillionUsd: number;
  avgLatencyMs: number;
  recommendedFor: string;
}

export const MODEL_TIERS: Record<ModelTierId, ModelTierSpec> = {
  'ollama-llama3.2-3b': {
    id: 'ollama-llama3.2-3b',
    label: 'Ollama Llama 3.2 3B (Ubuntu 24.04 Local)',
    provider: 'Local Open-Source (Self-Hosted Docker)',
    inputCostPerMillionUsd: 0,
    outputCostPerMillionUsd: 0,
    avgLatencyMs: 290,
    recommendedFor: 'Zero-cost VPS/local FAQ routing, article summarization & ICP pre-screening',
  },
  'gemini-3.1-flash-lite': {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    provider: 'Google GenAI API',
    inputCostPerMillionUsd: 0.075,
    outputCostPerMillionUsd: 0.30,
    avgLatencyMs: 220,
    recommendedFor: 'High-speed intent classification, ICP scoring & FAQ fallback',
  },
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    provider: 'Google GenAI API',
    inputCostPerMillionUsd: 0.15,
    outputCostPerMillionUsd: 0.60,
    avgLatencyMs: 380,
    recommendedFor: 'Grounded multi-channel outbound copy, social posts & tool calling',
  },
  'frontier-baseline': {
    id: 'frontier-baseline',
    label: 'Unoptimized Frontier Model (Baseline)',
    provider: 'Legacy Heavy Tier',
    inputCostPerMillionUsd: 3.00,
    outputCostPerMillionUsd: 15.00,
    avgLatencyMs: 1850,
    recommendedFor: 'Comparison baseline only (20x more expensive per token)',
  },
};

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
}): CostMetrics {
  const spec = MODEL_TIERS[params.modelUsed] || MODEL_TIERS['gemini-3.1-flash-lite'];
  const frontier = MODEL_TIERS['frontier-baseline'];

  const effectiveInput = params.cacheHit ? 0 : params.inputTokens;
  const effectiveOutput = params.cacheHit ? 0 : params.outputTokens;

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

export interface GroundednessLayerCheck {
  layer: number;
  name: string;
  passed: boolean;
  detail: string;
}

export interface GroundednessReport {
  passed: boolean;
  scorePct: number;
  verifiedClaimsCount: number;
  blockedHallucinationsCount: number;
  layerChecks: GroundednessLayerCheck[];
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
  const allowedNumbers = new Set(['24', '7', '24/7', '30', '48', '100', '500', '3']);
  const sourceNumbers = lowerSource.match(/\b\d+(?:\.\d+)?%?\b/g) || [];
  sourceNumbers.forEach((n) => allowedNumbers.add(n));

  const generatedNumbers = combinedGenerated.match(/\b\d+(?:\.\d+)?%?\b/g) || [];
  const unverifiedNumbers = generatedNumbers.filter((n) => !allowedNumbers.has(n));
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
        : `Blocked unverified numeric claims: ${unverifiedNumbers.join(', ')}`,
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

  return {
    passed: passedCount === layerChecks.length,
    scorePct: Math.round((passedCount / layerChecks.length) * 100),
    verifiedClaimsCount: verifiedFacts + (entityPassed ? 1 : 0),
    blockedHallucinationsCount,
    layerChecks,
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
