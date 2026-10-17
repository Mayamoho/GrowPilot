/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { TopNav, type ActiveTabId } from './components/TopNav';
import { GtmStudioView } from './components/GtmStudioView';
import { WhatsappAgentView, type AgentTrace } from './components/WhatsappAgentView';
import { CostBenchmarkView } from './components/CostBenchmarkView';
import { DeploymentHubView } from './components/DeploymentHubView';
import {
  INITIAL_FAQS,
  INITIAL_GTM_RECORDS,
  INITIAL_CRM_BOOKINGS,
  type GtmPipelineRecord,
  type CrmBookingRecord,
} from './data/seedData';
import {
  stripHtmlAndBoilerplate,
  normalizeCacheKey,
  matchFaqCache,
  calculateRunCost,
  evaluateIcpFit,
  verifyGroundedness,
  trimConversationWindow,
  type FaqItem,
  type ModelTierId,
  type ChatTurn,
} from './utils/agentEngine';

interface TelemetrySummary {
  totalRequests: number;
  cacheHits: number;
  cacheHitRatePct: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  totalSavedUsd: number;
}

function getInitialTabFromHostnameAndUrl(): ActiveTabId {
  if (typeof window === 'undefined') return 'gtm-studio';
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  if (
    tabParam === 'gtm-studio' ||
    tabParam === 'whatsapp-agent' ||
    tabParam === 'cost-lab' ||
    tabParam === 'ubuntu-deploy'
  ) {
    return tabParam;
  }
  if (window.location.hostname.toLowerCase().startsWith('agent.')) {
    return 'whatsapp-agent';
  }
  return 'gtm-studio';
}

function buildClientSideGroundedAssets(params: {
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

  const keyFacts = sentences.slice(0, 4);
  while (keyFacts.length < 3) {
    keyFacts.push(`Verified prospect entity: ${params.companyName} (${params.industry})`);
  }

  const firstFact = keyFacts[0] || summary;

  return {
    summary,
    keyFacts,
    coldEmailSubject: `Automating 24/7 lead capture & workflows for ${params.companyName}`,
    coldEmailBody: `Hi ${params.companyName} team,\n\nI reviewed your operations in ${params.industry} — specifically noting: "${firstFact}".\n\nAt Growbig100, we deploy cached 24/7 WhatsApp & web qualification agents connected to n8n and Google Sheets CRM so after-hours inquiries are answered and booked automatically in under 3 seconds.\n\nWould you be open to a 10-minute walkthrough this week?\n\nBest,\nAbu Kawser\nAI Automation & GTM Engineering`,
    whatsappScript: `Assalamu Alaikum ${params.companyName} team! Saw your ${params.industry} services ("${firstFact.slice(0, 85)}..."). We built a 24/7 WhatsApp + n8n booking agent that qualifies leads and logs to Google Sheets at near-zero token cost. Want a 60-sec live demo link?`,
    socialPost: `How GTM Engineering + Smallest-Model Routing cuts outbound AI costs by 90%:\n\nWhile analyzing ${params.companyName} (${params.industry}, ICP Score ${params.icpScore}/100), our GrowPilot pipeline stripped HTML boilerplate before inference, verified every claim through a 5-layer groundedness gate, and generated multi-channel outbound copy in one pass.\n\n#AIAutomation #GTMEngineering #n8n #Docker #Growbig100`,
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTabId>(getInitialTabFromHostnameAndUrl);
  const [faqs, setFaqs] = useState<FaqItem[]>(INITIAL_FAQS);
  const [gtmRecords, setGtmRecords] = useState<GtmPipelineRecord[]>(INITIAL_GTM_RECORDS);
  const [crmBookings, setCrmBookings] = useState<CrmBookingRecord[]>(INITIAL_CRM_BOOKINGS);
  const [telemetry, setTelemetry] = useState<TelemetrySummary>({
    totalRequests: 14,
    cacheHits: 6,
    cacheHitRatePct: 42.9,
    totalTokensUsed: 971,
    totalCostUsd: 0.0002427,
    totalSavedUsd: 0.04182,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [clientGtmCache, setClientGtmCache] = useState<Record<string, GtmPipelineRecord>>(() => {
    const initial: Record<string, GtmPipelineRecord> = {};
    for (const rec of INITIAL_GTM_RECORDS) {
      const k = normalizeCacheKey(`${rec.companyName}_${rec.sourceUrl}_${rec.icpThreshold}`);
      initial[k] = rec;
    }
    return initial;
  });
  const [clientSessionTurns, setClientSessionTurns] = useState<Record<string, ChatTurn[]>>({});

  useEffect(() => {
    fetch('/api/state')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data === 'object') {
          if (data.faqs) setFaqs(data.faqs);
          if (data.gtmRecords) setGtmRecords(data.gtmRecords);
          if (data.crmBookings) setCrmBookings(data.crmBookings);
          if (data.telemetry) setTelemetry(data.telemetry);
        }
      })
      .catch(() => {
        // Static deployment fallback uses in-memory deterministic engine
      });
  }, []);

  const runClientSideGtmFallback = (payload: {
    companyName: string;
    sourceUrl: string;
    industry: string;
    rawContent: string;
    icpThreshold: number;
    modelPreference: ModelTierId;
    bypassCache: boolean;
  }): GtmPipelineRecord => {
    const cacheKey = normalizeCacheKey(
      `${payload.companyName}_${payload.sourceUrl}_${payload.icpThreshold}`
    );

    if (!payload.bypassCache && clientGtmCache[cacheKey]) {
      const cached = clientGtmCache[cacheKey];
      const cachedMetrics = calculateRunCost({
        modelId: payload.modelPreference,
        inputTokens: cached.cleanedTokenEstimate,
        outputTokens: 165,
        cacheHit: true,
        cachedLatencyMs: 3,
      });
      const cachedRecord: GtmPipelineRecord = {
        ...cached,
        id: `gtm-cache-${Date.now()}`,
        costMetrics: cachedMetrics,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setGtmRecords((prev) => [
        cachedRecord,
        ...prev.filter((r) => r.companyName !== cachedRecord.companyName),
      ]);
      setTelemetry((prev) => {
        const nextReq = prev.totalRequests + 1;
        const nextHits = prev.cacheHits + 1;
        return {
          totalRequests: nextReq,
          cacheHits: nextHits,
          cacheHitRatePct: Math.round((nextHits / nextReq) * 1000) / 10,
          totalTokensUsed: prev.totalTokensUsed,
          totalCostUsd: prev.totalCostUsd,
          totalSavedUsd: prev.totalSavedUsd + cachedMetrics.savedVsFrontierUsd,
        };
      });
      return cachedRecord;
    }

    const stripped = stripHtmlAndBoilerplate(payload.rawContent || payload.companyName);
    const icpEval = evaluateIcpFit(
      `${payload.companyName} ${payload.industry} ${stripped.cleanedText}`,
      payload.icpThreshold
    );

    if (icpEval.qualificationStatus === 'SKIPPED_LOW_ICP') {
      const lowCostMetrics = calculateRunCost({
        modelId: 'gemini-3.1-flash-lite',
        inputTokens: Math.min(80, stripped.cleanedTokens),
        outputTokens: 18,
        cacheHit: false,
      });
      const skippedRecord: GtmPipelineRecord = {
        id: `gtm-skip-${Date.now()}`,
        companyName: payload.companyName,
        sourceUrl: payload.sourceUrl || 'https://example.com',
        industry: payload.industry || 'General',
        rawCharCount: stripped.rawChars,
        cleanedCharCount: stripped.cleanedChars,
        rawTokenEstimate: stripped.rawTokens,
        cleanedTokenEstimate: stripped.cleanedTokens,
        tokensSavedByStrip: stripped.tokensSaved,
        tokensSavedPct: stripped.tokensSavedPct,
        icpScore: icpEval.score,
        icpThreshold: payload.icpThreshold,
        qualificationStatus: 'SKIPPED_LOW_ICP',
        icpReasons: icpEval.reasons,
        summary: `Skipped outbound copy generation: ICP score (${icpEval.score}/100) is below the configured ${payload.icpThreshold}/100 token-saving gate.`,
        keyFacts: icpEval.reasons,
        generatedAssets: {
          coldEmailSubject: '[SKIPPED BY ICP GATE — 0 GENERATION TOKENS USED]',
          coldEmailBody: `Prospect "${payload.companyName}" scored ${icpEval.score}/100 (Threshold: ${payload.icpThreshold}/100). Generation was halted before calling ${payload.modelPreference} to prevent wasted tokens.`,
          whatsappScript: '[SKIPPED BY ICP GATE]',
          socialPost: '[SKIPPED BY ICP GATE]',
        },
        groundedness: verifyGroundedness(
          stripped.cleanedText,
          payload.companyName,
          payload.companyName
        ),
        costMetrics: lowCostMetrics,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setGtmRecords((prev) => [
        skippedRecord,
        ...prev.filter((r) => r.companyName !== skippedRecord.companyName),
      ]);
      return skippedRecord;
    }

    const generated = buildClientSideGroundedAssets({
      companyName: payload.companyName,
      cleanedText: stripped.cleanedText,
      industry: payload.industry || 'B2B & Automation',
      icpScore: icpEval.score,
    });
    const combinedOutput = `${generated.summary}\n${generated.coldEmailBody}\n${generated.whatsappScript}\n${generated.socialPost}`;
    const groundedness = verifyGroundedness(
      `${payload.companyName} ${payload.industry} ${stripped.cleanedText}`,
      combinedOutput,
      payload.companyName
    );
    const outTokens = Math.max(45, Math.ceil(combinedOutput.length / 4));
    const costMetrics = calculateRunCost({
      modelId: payload.modelPreference,
      inputTokens: stripped.cleanedTokens,
      outputTokens: outTokens,
      cacheHit: false,
    });

    const record: GtmPipelineRecord = {
      id: `gtm-${Date.now()}`,
      companyName: payload.companyName,
      sourceUrl: payload.sourceUrl || 'https://abukawser.xyz',
      industry: payload.industry || 'Digital Marketing & Automation',
      rawCharCount: stripped.rawChars,
      cleanedCharCount: stripped.cleanedChars,
      rawTokenEstimate: stripped.rawTokens,
      cleanedTokenEstimate: stripped.cleanedTokens,
      tokensSavedByStrip: stripped.tokensSaved,
      tokensSavedPct: stripped.tokensSavedPct,
      icpScore: icpEval.score,
      icpThreshold: payload.icpThreshold,
      qualificationStatus: 'QUALIFIED_OUTBOUND',
      icpReasons: icpEval.reasons,
      summary: generated.summary,
      keyFacts: generated.keyFacts,
      generatedAssets: {
        coldEmailSubject: generated.coldEmailSubject,
        coldEmailBody: generated.coldEmailBody,
        whatsappScript: generated.whatsappScript,
        socialPost: generated.socialPost,
      },
      groundedness,
      costMetrics,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setClientGtmCache((prev) => ({ ...prev, [cacheKey]: record }));
    setGtmRecords((prev) => [
      record,
      ...prev.filter((r) => r.companyName !== record.companyName),
    ]);
    setTelemetry((prev) => {
      const nextReq = prev.totalRequests + 1;
      return {
        totalRequests: nextReq,
        cacheHits: prev.cacheHits,
        cacheHitRatePct: Math.round((prev.cacheHits / nextReq) * 1000) / 10,
        totalTokensUsed: prev.totalTokensUsed + costMetrics.totalTokens,
        totalCostUsd: prev.totalCostUsd + costMetrics.estimatedCostUsd,
        totalSavedUsd: prev.totalSavedUsd + costMetrics.savedVsFrontierUsd,
      };
    });
    return record;
  };

  const handleRunGtmPipeline = async (payload: {
    companyName: string;
    sourceUrl: string;
    industry: string;
    rawContent: string;
    icpThreshold: number;
    modelPreference: ModelTierId;
    bypassCache: boolean;
  }): Promise<GtmPipelineRecord | null> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/gtm/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        return runClientSideGtmFallback(payload);
      }
      const data = await res.json();
      if (data.record) {
        setGtmRecords((prev) => [
          data.record,
          ...prev.filter((r) => r.companyName !== data.record.companyName),
        ]);
      }
      if (data.telemetry) {
        setTelemetry({
          ...data.telemetry,
          cacheHitRatePct:
            data.telemetry.totalRequests > 0
              ? Math.round((data.telemetry.cacheHits / data.telemetry.totalRequests) * 1000) / 10
              : 0,
        });
      }
      return data.record || runClientSideGtmFallback(payload);
    } catch {
      return runClientSideGtmFallback(payload);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = async () => {
    setClientGtmCache({});
    try {
      await fetch('/api/cache/clear', { method: 'POST' });
    } catch {
      // ignore on static host
    }
  };

  const runClientSideAgentFallback = (payload: {
    message: string;
    sessionId: string;
    modelPreference: ModelTierId;
    channel: string;
  }): { reply: string; trace: AgentTrace } => {
    const existingTurns = clientSessionTurns[payload.sessionId] || [];
    const updatedTurns: ChatTurn[] = [
      ...existingTurns,
      { role: 'user', content: payload.message },
    ];
    const windowResult = trimConversationWindow(updatedTurns, 6);

    const faqMatch = matchFaqCache(payload.message, faqs);
    if (faqMatch.hit && faqMatch.matchedFaq) {
      const costMetrics = calculateRunCost({
        modelId: payload.modelPreference,
        inputTokens: Math.ceil(payload.message.length / 4),
        outputTokens: Math.ceil(faqMatch.matchedFaq.answer.length / 4),
        cacheHit: true,
        cachedLatencyMs: 2,
      });

      const finalTurns = trimConversationWindow(
        [...windowResult.trimmed, { role: 'agent', content: faqMatch.matchedFaq.answer }],
        6
      );
      setClientSessionTurns((prev) => ({ ...prev, [payload.sessionId]: finalTurns.trimmed }));
      setTelemetry((prev) => {
        const nextReq = prev.totalRequests + 1;
        const nextHits = prev.cacheHits + 1;
        return {
          totalRequests: nextReq,
          cacheHits: nextHits,
          cacheHitRatePct: Math.round((nextHits / nextReq) * 1000) / 10,
          totalTokensUsed: prev.totalTokensUsed,
          totalCostUsd: prev.totalCostUsd,
          totalSavedUsd: prev.totalSavedUsd + costMetrics.savedVsFrontierUsd,
        };
      });

      return {
        reply: faqMatch.matchedFaq.answer,
        trace: {
          executionPath: 'LAYER_0_EXACT_OR_SEMANTIC_CACHE',
          cacheSimilarity: faqMatch.similarity,
          matchedFaqCategory: faqMatch.matchedFaq.category,
          leadIntent: 'FAQ_INQUIRY',
          leadScore: 'FAQ_RESOLVED',
          budgetUsd: null,
          nextAction: 'ANSWERED_ZERO_TOKENS',
          bookedSlot: null,
          slidingWindowTurns: finalTurns.trimmed.length,
          droppedTurns: finalTurns.droppedCount,
          costMetrics,
        },
      };
    }

    const usdMatch =
      payload.message.match(/\$\s*(\d[\d,]*)/i) ||
      payload.message.match(/(\d[\d,]*)\s*(?:usd|dollars)/i);
    const bdtMatch = payload.message.match(/(\d[\d,]*)\s*(?:bdt|taka|tk)/i);
    let extractedBudgetUsd: number | null = null;
    if (usdMatch) {
      extractedBudgetUsd = parseInt(usdMatch[1].replace(/,/g, ''), 10);
    } else if (bdtMatch) {
      const bdt = parseInt(bdtMatch[1].replace(/,/g, ''), 10);
      extractedBudgetUsd = Math.round(bdt / 120);
    }

    const isQualified =
      (extractedBudgetUsd !== null && extractedBudgetUsd >= 300) ||
      /book|appointment|schedule|call|clinic|saas|agency|whatsapp/i.test(payload.message);

    const bookedSlot = isQualified ? 'Thu 24 Oct, 4:30 PM BDT' : null;
    const reply = isQualified
      ? `Great fit! Based on your requirements${
          extractedBudgetUsd ? ` and ~$${extractedBudgetUsd}/mo budget` : ''
        }, I have provisionally booked a 30-minute GTM & AI Agent architecture call for **${bookedSlot}** and synced your lead record to the Growbig100 n8n CRM.`
      : `Thanks for sharing! Could you let me know your approximate monthly automation budget (or patient/lead volume) and whether you prefer WhatsApp Business API or web chat so I can book the right discovery slot?`;

    const inputTokens = Math.max(28, Math.ceil(payload.message.length / 4) + 36);
    const outputTokens = Math.max(24, Math.ceil(reply.length / 4));
    const costMetrics = calculateRunCost({
      modelId: payload.modelPreference,
      inputTokens,
      outputTokens,
      cacheHit: false,
    });

    if (isQualified && bookedSlot) {
      const newBooking: CrmBookingRecord = {
        id: `crm-${Date.now()}`,
        leadName:
          payload.message.length > 34
            ? `${payload.message.slice(0, 32)}...`
            : payload.message,
        businessType: /clinic|dental|doctor/i.test(payload.message)
          ? 'Healthcare / Clinic'
          : 'B2B / Growth Automation',
        channel:
          payload.channel === 'WhatsApp Business' ? 'WhatsApp Business' : 'Website Widget',
        needSummary: payload.message.slice(0, 90),
        monthlyBudgetUsd: extractedBudgetUsd || 550,
        leadScore: 'HOT_BOOKED',
        bookedSlot,
        modelUsed: costMetrics.modelLabel,
        tokensUsed: costMetrics.totalTokens,
        costUsd: costMetrics.estimatedCostUsd,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setCrmBookings((prev) => [newBooking, ...prev]);
    }

    const finalTurns = trimConversationWindow(
      [...windowResult.trimmed, { role: 'agent', content: reply }],
      6
    );
    setClientSessionTurns((prev) => ({ ...prev, [payload.sessionId]: finalTurns.trimmed }));
    setTelemetry((prev) => {
      const nextReq = prev.totalRequests + 1;
      return {
        totalRequests: nextReq,
        cacheHits: prev.cacheHits,
        cacheHitRatePct: Math.round((prev.cacheHits / nextReq) * 1000) / 10,
        totalTokensUsed: prev.totalTokensUsed + costMetrics.totalTokens,
        totalCostUsd: prev.totalCostUsd + costMetrics.estimatedCostUsd,
        totalSavedUsd: prev.totalSavedUsd + costMetrics.savedVsFrontierUsd,
      };
    });

    return {
      reply,
      trace: {
        executionPath: 'SMALLEST_MODEL_ROUTER_LLM',
        cacheSimilarity: faqMatch.similarity,
        matchedFaqCategory: null,
        leadIntent: isQualified ? 'HIGH_INTENT_BOOKING' : 'DISCOVERY_QUALIFICATION',
        leadScore: isQualified ? 'HOT_BOOKED' : 'WARM_NURTURE',
        budgetUsd: extractedBudgetUsd,
        nextAction: isQualified ? 'CALENDAR_BOOKED_CRM_SYNCED' : 'ASK_QUALIFYING_BUDGET',
        bookedSlot,
        slidingWindowTurns: finalTurns.trimmed.length,
        droppedTurns: finalTurns.droppedCount,
        costMetrics,
      },
    };
  };

  const handleSendAgentMessage = async (payload: {
    message: string;
    sessionId: string;
    modelPreference: ModelTierId;
    channel: string;
  }): Promise<{ reply: string; trace: AgentTrace } | null> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        return runClientSideAgentFallback(payload);
      }
      const data = await res.json();
      if (data.crmBookings) {
        setCrmBookings(data.crmBookings);
      }
      if (data.telemetry) {
        setTelemetry({
          ...data.telemetry,
          cacheHitRatePct:
            data.telemetry.totalRequests > 0
              ? Math.round((data.telemetry.cacheHits / data.telemetry.totalRequests) * 1000) / 10
              : 0,
        });
      }
      return { reply: data.reply, trace: data.trace };
    } catch {
      return runClientSideAgentFallback(payload);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFaq = async (payload: {
    category: string;
    question: string;
    keywords: string;
    answer: string;
  }): Promise<boolean> => {
    const newFaq: FaqItem = {
      id: `faq-custom-${Date.now()}`,
      category: payload.category || 'Custom FAQ',
      question: payload.question,
      keywords: payload.keywords
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
      answer: payload.answer,
    };

    try {
      const res = await fetch('/api/faq/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setFaqs((prev) => [newFaq, ...prev]);
        return true;
      }
      const data = await res.json();
      if (data.faqs) {
        setFaqs(data.faqs);
      } else {
        setFaqs((prev) => [newFaq, ...prev]);
      }
      return true;
    } catch {
      setFaqs((prev) => [newFaq, ...prev]);
      return true;
    }
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Strict 3-Zone Top Bar Contract */}
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onExportKitClick={() => setActiveTab('ubuntu-deploy')}
      />

      {/* Contextual Telemetry & Candidate Identity Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5">
        <div className="max-w-[1380px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span className="font-semibold text-slate-900">
              Abu Kawser (abukawser.xyz)
            </span>
            <span aria-hidden="true">·</span>
            <span>Growbig100 AI Automation & GTM Engineering Work Sample</span>
            <span aria-hidden="true">·</span>
            <span>Ubuntu 24.04 Docker + n8n + Ollama Ready</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums text-xs">
            <div>
              <span className="text-slate-500">Queries: </span>
              <span className="font-semibold text-slate-900">{telemetry.totalRequests}</span>
            </div>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <div>
              <span className="text-slate-500">Layer 0 Cache Hits: </span>
              <span className="font-semibold text-teal-800">
                {telemetry.cacheHits} ({telemetry.cacheHitRatePct}%)
              </span>
            </div>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <div>
              <span className="text-slate-500">Total Spend: </span>
              <span className="font-semibold text-slate-900">
                ${telemetry.totalCostUsd.toFixed(6)}
              </span>
            </div>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <div>
              <span className="text-slate-500">Saved vs Frontier: </span>
              <span className="font-semibold text-emerald-700">
                +${telemetry.totalSavedUsd.toFixed(5)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Viewport */}
      <main className="flex-1 w-full max-w-[1380px] mx-auto px-4 sm:px-6 py-6 sm:py-7">
        {/* Mobile Workspace Switcher (visible on <768px viewports) */}
        <div
          role="tablist"
          aria-label="Mobile Workspace Switcher"
          className="grid grid-cols-2 gap-1.5 p-1.5 mb-6 bg-slate-200/70 rounded-xl md:hidden"
        >
          {[
            { id: 'gtm-studio', label: '01. GTM Pipeline' },
            { id: 'whatsapp-agent', label: '02. 24/7 FAQ Agent' },
            { id: 'cost-lab', label: '03. Prompt & Cost' },
            { id: 'ubuntu-deploy', label: '04. Ubuntu & n8n' },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTabId)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap truncate ${
                activeTab === tab.id
                  ? 'bg-white text-teal-800 font-semibold shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'gtm-studio' && (
          <GtmStudioView
            records={gtmRecords}
            onRunPipeline={handleRunGtmPipeline}
            onClearCache={handleClearCache}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'whatsapp-agent' && (
          <WhatsappAgentView
            faqs={faqs}
            crmBookings={crmBookings}
            onSendMessage={handleSendAgentMessage}
            onAddFaq={handleAddFaq}
            onNewVoiceBooking={setCrmBookings}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'cost-lab' && <CostBenchmarkView />}

        {activeTab === 'ubuntu-deploy' && <DeploymentHubView />}
      </main>

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 mt-12">
        <div className="max-w-[1380px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            GrowPilot · Built by Abu Kawser (CSE, University of Dhaka) · Domain: abukawser.xyz
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('gtm-studio')}
              className="hover:text-slate-900 cursor-pointer"
            >
              GTM Pipeline
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('whatsapp-agent')}
              className="hover:text-slate-900 cursor-pointer"
            >
              24/7 FAQ & Booking Agent
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ubuntu-deploy')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Ubuntu 24.04 Docker & n8n Kit
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
