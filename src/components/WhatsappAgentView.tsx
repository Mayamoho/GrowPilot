import React, { useState } from 'react';
import { type CrmBookingRecord, type AutomationDeliveryStatus } from '../data/seedData';
import {
  MODEL_TIERS,
  SELECTABLE_MODEL_TIERS,
  type FaqItem,
  type ModelTierId,
  type CostMetrics,
  type GenerationSource,
} from '../utils/agentEngine';
import { LiveVoiceAgentPanel } from './LiveVoiceAgentPanel';
import { Send, Plus, Zap, Calendar, ShieldAlert } from 'lucide-react';

export interface AgentTrace {
  layerTriggered: string;
  cacheKey?: string;
  confidence?: number;
  intent: string;
  leadScore: 'HOT_BOOKED' | 'WARM_NURTURE' | 'COLD_FAQ';
  budgetUsd: number;
  nextAction: string;
  bookedSlot: string | null;
  slidingWindowTurns: number;
  droppedTurns: number;
  costMetrics: CostMetrics;
  generationSource?: GenerationSource;
  modelError?: string | null;
  automationStatus?: AutomationDeliveryStatus;
}

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  trace?: AgentTrace;
}

interface WhatsappAgentViewProps {
  faqs: FaqItem[];
  crmBookings: CrmBookingRecord[];
  onSendMessage: (payload: {
    message: string;
    sessionId: string;
    modelPreference: ModelTierId;
    channel: string;
  }) => Promise<{ reply: string; trace: AgentTrace } | null>;
  onAddFaq: (payload: {
    category: string;
    question: string;
    keywords: string;
    answer: string;
  }) => Promise<boolean>;
  onNewVoiceBooking: (bookings: CrmBookingRecord[]) => void;
  isLoading: boolean;
}

export const WhatsappAgentView: React.FC<WhatsappAgentViewProps> = ({
  faqs,
  crmBookings,
  onSendMessage,
  onAddFaq,
  onNewVoiceBooking,
  isLoading,
}) => {
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        'Hello! I am the GrowPilot 24/7 AI Qualification & Booking Agent. Ask me any FAQ about pricing, WhatsApp/n8n setup, or token caching—or share your business need and monthly budget to book a discovery call.',
      timestamp: '10:00 AM',
      trace: {
        layerTriggered: 'Layer 0 System Greeting (0 Tokens)',
        cacheKey: 'greeting_init',
        confidence: 1,
        intent: 'GREETING_INIT',
        leadScore: 'COLD_FAQ',
        budgetUsd: 0,
        nextAction: 'AWAIT_USER_QUERY',
        bookedSlot: null,
        slidingWindowTurns: 1,
        droppedTurns: 0,
        costMetrics: {
          modelUsed: 'gemini-3.5-flash-lite',
          modelLabel: 'Layer 0 Cache (0 Tokens)',
          cacheHit: true,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
          baselineFrontierCostUsd: 0.0042,
          costSavedUsd: 0.0042,
          latencyMs: 1,
        },
      },
    },
  ]);

  const [inputMessage, setInputMessage] = useState<string>('');
  const [modelPreference, setModelPreference] = useState<ModelTierId>('gemini-3.5-flash-lite');
  const [channel, setChannel] = useState<'WhatsApp Business' | 'Website Widget'>(
    'WhatsApp Business'
  );
  const [showAddFaqForm, setShowAddFaqForm] = useState<boolean>(false);
  const [newFaqCategory, setNewFaqCategory] = useState<string>('Custom Niche FAQ');
  const [newFaqQuestion, setNewFaqQuestion] = useState<string>('');
  const [newFaqKeywords, setNewFaqKeywords] = useState<string>('');
  const [newFaqAnswer, setNewFaqAnswer] = useState<string>('');
  const [faqError, setFaqError] = useState<string | null>(null);

  const latestTrace =
    [...messages].reverse().find((m) => m.trace)?.trace || messages[0].trace!;

  const triggerMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;
    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');

    const res = await onSendMessage({
      message: textToSend.trim(),
      sessionId: 'growpilot-live-session',
      modelPreference,
      channel,
    });

    if (res) {
      const botMsg: ChatMessageItem = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        trace: res.trace,
      };
      setMessages((prev) => [...prev, botMsg]);
    }
  };

  const handleCreateFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFaqQuestion.trim() || !newFaqAnswer.trim()) {
      setFaqError('Both FAQ question and answer are required.');
      return;
    }
    setFaqError(null);
    const ok = await onAddFaq({
      category: newFaqCategory,
      question: newFaqQuestion,
      keywords: newFaqKeywords,
      answer: newFaqAnswer,
    });
    if (ok) {
      setNewFaqQuestion('');
      setNewFaqKeywords('');
      setNewFaqAnswer('');
      setShowAddFaqForm(false);
    }
  };

  const [showVoicePanel, setShowVoicePanel] = useState<boolean>(false);

  const quickScenarios = [
    {
      label: 'Pricing FAQ (0 Tokens Cache Hit)',
      text: 'What are your pricing plans and monthly cost for a 24/7 AI agent?',
    },
    {
      label: 'Hallucination Gate FAQ (Cached)',
      text: 'How do you prevent the AI agent from hallucinating fake prices or promises?',
    },
    {
      label: 'Qualify $1,200/mo Lead (Books Slot)',
      text: 'We run a dental clinic and have a $1,200/month budget to automate WhatsApp patient booking.',
    },
    {
      label: 'Qualify $200/mo Lead (Nurture Gate)',
      text: 'We are a small local shop with a $200/month budget looking for an automation bot.',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
            24/7 Customer &amp; Lead Qualification Agent
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Cached FAQ Answering &amp; Autonomous Booking Agent
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 max-w-3xl">
            Answers recurring FAQs in &lt;5ms for 0 tokens ($0.00) via Layer 0 caching. Novel messages route through a 6-turn sliding memory window and automatically book discovery slots when budget ≥ $500/mo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowVoicePanel((prev) => !prev)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              showVoicePanel
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {showVoicePanel ? 'Hide Live Voice Agent' : 'Open Live Voice Call (Gemini Live)'}
          </button>

          <div>
            <label htmlFor="agent-channel-select" className="sr-only">
              Channel
            </label>
            <select
              id="agent-channel-select"
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value as 'WhatsApp Business' | 'Website Widget')
              }
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg"
            >
              <option value="WhatsApp Business">Channel: WhatsApp Business API</option>
              <option value="Website Widget">Channel: Embedded Website Widget</option>
            </select>
          </div>

          <div>
            <label htmlFor="agent-model-select" className="sr-only">
              Fallback LLM Tier
            </label>
            <select
              id="agent-model-select"
              value={modelPreference}
              onChange={(e) => setModelPreference(e.target.value as ModelTierId)}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg"
            >
              {SELECTABLE_MODEL_TIERS.map((tierId) => (
                <option key={tierId} value={tierId}>
                  Model: {MODEL_TIERS[tierId].label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Collapsible Real-Time Voice Qualification & Booking Call */}
      {showVoicePanel && <LiveVoiceAgentPanel onNewVoiceBooking={onNewVoiceBooking} />}

      {/* 2-Column Split: Left = WhatsApp/Web Chat Simulator, Right = Live Prompt & Token Cost Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Chat Simulator (7 cols) */}
        <section
          aria-label="24/7 Agent Conversation Simulator"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Live {channel} Conversation
                </h2>
                <p className="text-xs text-slate-500">
                  Sliding Window Memory capped at 6 turns · Automatic Calendar & CRM tool calls
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-teal-800 font-semibold">
                Active Window: {latestTrace.slidingWindowTurns}/6 turns
              </span>
            </div>

            {/* One-Click Test Scenarios */}
            <div className="mt-3">
              <div className="text-[11px] font-medium text-slate-500 mb-1.5">
                One-Click Evaluation Scenarios (Test Cache Hits, Qualification & Safety):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickScenarios.map((sc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isLoading}
                    onClick={() => triggerMessage(sc.text)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-teal-50 hover:text-teal-900 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Thread */}
            <div className="mt-4 h-80 overflow-y-auto space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                    <span className="font-medium">
                      {m.role === 'user' ? 'Prospect' : 'GrowPilot Agent'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{m.timestamp}</span>
                    {m.trace && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-teal-800 font-medium">
                          {m.trace.costMetrics.cacheHit
                            ? '0 tok ($0.00 Cache Hit)'
                            : `${m.trace.costMetrics.totalTokens} tok ($${m.trace.costMetrics.estimatedCostUsd.toFixed(6)})`}
                        </span>
                      </>
                    )}
                  </div>
                  <div
                    className={`max-w-xl px-3.5 py-2.5 rounded-lg text-xs sm:text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-teal-700 text-white'
                        : 'bg-white text-slate-800 border border-slate-200'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              triggerMessage(inputMessage);
            }}
            className="mt-4 flex items-center gap-2"
          >
            <label htmlFor="agent-chat-input" className="sr-only">
              Type a customer question or lead qualification message
            </label>
            <input
              id="agent-chat-input"
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask an FAQ (e.g., pricing, n8n, hours) or share your budget ($800/mo)..."
              className="flex-1 px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Send Message
            </button>
          </form>
        </section>

        {/* Right: Live Prompt & Token Cost Inspector (5 cols) */}
        <section
          aria-label="Live Prompt and Token Cost Telemetry Inspector"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="pb-3 border-b border-slate-200">
              <h2 className="font-display text-base font-bold text-slate-900">
                Live Execution & Token Cost Inspector
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time trace of the latest agent turn showing caching, model routing, and structured JSON output.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500">Execution Layer</div>
                <div className="text-xs font-semibold text-slate-900 mt-1">
                  {latestTrace.layerTriggered}
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500">Turn Token Cost</div>
                <div className="text-sm font-mono font-bold tabular-nums text-teal-800 mt-0.5">
                  ${latestTrace.costMetrics.estimatedCostUsd.toFixed(7)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-500">
                  {latestTrace.costMetrics.totalTokens} tokens · {latestTrace.costMetrics.latencyMs}ms
                </div>
              </div>
            </div>

            {/* Structured JSON Output Preview */}
            <div>
              <div className="text-xs font-semibold text-slate-800 mb-1.5">
                Structured Agent State Extraction (n8n Webhook Payload)
              </div>
              <pre className="p-3 text-xs font-mono tabular-nums bg-slate-900 text-slate-100 rounded-lg overflow-x-auto leading-relaxed">
                {JSON.stringify(
                  {
                    intent: latestTrace.intent,
                    lead_score: latestTrace.leadScore,
                    extracted_budget_usd: latestTrace.budgetUsd,
                    cache_hit: latestTrace.costMetrics.cacheHit,
                    tokens_used: latestTrace.costMetrics.totalTokens,
                    next_action: latestTrace.nextAction,
                    booked_slot: latestTrace.bookedSlot,
                  },
                  null,
                  2
                )}
              </pre>
              <div className="mt-2 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Replied by</span>
                  <span
                    className={`font-mono font-semibold ${
                      latestTrace.generationSource === 'deterministic-fallback' ||
                      !latestTrace.generationSource
                        ? 'text-amber-700'
                        : 'text-teal-800'
                    }`}
                  >
                    {latestTrace.generationSource === 'gemini-llm'
                      ? 'Gemini LLM'
                      : latestTrace.generationSource === 'ollama-local'
                        ? 'Local Ollama'
                        : latestTrace.costMetrics.cacheHit
                          ? 'Layer 0 Cache (0 tokens)'
                          : 'Deterministic template'}
                  </span>
                </div>
                {latestTrace.modelError ? (
                  <div className="rounded-md bg-amber-50 border border-amber-200 px-2 py-1.5 text-amber-800 leading-snug">
                    Model not used: {latestTrace.modelError}
                  </div>
                ) : null}
                {latestTrace.automationStatus ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">n8n automation</span>
                    <span
                      className={`font-mono font-semibold ${
                        latestTrace.automationStatus === 'delivered'
                          ? 'text-emerald-700'
                          : latestTrace.automationStatus === 'failed'
                            ? 'text-rose-700'
                            : 'text-slate-500'
                      }`}
                    >
                      {latestTrace.automationStatus === 'delivered'
                        ? 'LEAD PUSHED TO WEBHOOK'
                        : latestTrace.automationStatus === 'failed'
                          ? 'WEBHOOK DELIVERY FAILED'
                          : 'N8N_WEBHOOK_URL NOT CONFIGURED'}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Cost-Control Guardrails Summary */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="font-semibold text-slate-900">
                Active Cost & Token Optimization Rules
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>1. Layer 0 FAQ Normalized Cache</span>
                <span className="font-mono font-semibold text-emerald-700">
                  0 Tokens ($0.00)
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>2. Sliding-Window Memory Cap</span>
                <span className="font-mono font-semibold text-slate-900">
                  Last 6 Turns ({latestTrace.droppedTurns} dropped)
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>3. Calendar Booking Threshold</span>
                <span className="font-mono font-semibold text-slate-900">
                  Budget ≥ $500/mo
                </span>
              </div>
            </div>
          </div>

          {latestTrace.bookedSlot && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-950">
              <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
              <div>
                <span className="font-semibold">Calendar Slot Reserved: </span>
                {latestTrace.bookedSlot}
              </div>
            </div>
          )}

          {latestTrace.intent === 'PROMPT_INJECTION_BLOCKED' && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2.5 text-xs text-amber-950">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
              <div>
                <span className="font-semibold">Adversarial Input Blocked: </span>
                Zero LLM tokens spent.
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Bottom Split: Editable Layer 0 FAQ Knowledge Base & CRM Bookings Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Editable Niche FAQ Cache (5 cols) */}
        <section
          aria-label="Layer 0 Niche FAQ Knowledge Base"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Layer 0 FAQ Cache ({faqs.length} Entries)
                </h2>
                <p className="text-xs text-slate-500">
                  Questions matching these entries resolve in &lt;5ms for 0 tokens.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFaqForm((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {showAddFaqForm ? 'Cancel' : 'Add FAQ Rule'}
              </button>
            </div>

            {showAddFaqForm && (
              <form
                onSubmit={handleCreateFaq}
                className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5"
              >
                {faqError && (
                  <p className="text-xs font-medium text-red-700">{faqError}</p>
                )}
                <div>
                  <label
                    htmlFor="faq-question-input"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Customer FAQ Question
                  </label>
                  <input
                    id="faq-question-input"
                    type="text"
                    value={newFaqQuestion}
                    onChange={(e) => setNewFaqQuestion(e.target.value)}
                    placeholder="e.g., Do you support Bangla language on WhatsApp?"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label
                    htmlFor="faq-keywords-input"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Trigger Keywords (comma-separated)
                  </label>
                  <input
                    id="faq-keywords-input"
                    type="text"
                    value={newFaqKeywords}
                    onChange={(e) => setNewFaqKeywords(e.target.value)}
                    placeholder="bangla, bengali, language, translate"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label
                    htmlFor="faq-answer-input"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Grounded Cached Answer
                  </label>
                  <textarea
                    id="faq-answer-input"
                    rows={2}
                    value={newFaqAnswer}
                    onChange={(e) => setNewFaqAnswer(e.target.value)}
                    placeholder="Yes, our agents reply fluently in both Bangla and English..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 text-xs font-semibold text-white bg-teal-700 rounded hover:bg-teal-800 cursor-pointer"
                >
                  Save to Layer 0 Cache
                </button>
              </form>
            )}

            <div className="divide-y divide-slate-200 mt-2 max-h-80 overflow-y-auto">
              {faqs.map((faq) => (
                <div key={faq.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      {faq.question}
                    </span>
                    <button
                      type="button"
                      onClick={() => triggerMessage(faq.question)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-teal-800 bg-teal-50 rounded hover:bg-teal-100 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Zap className="w-3 h-3" />
                      Test 0-Token Hit
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{faq.answer}</p>
                  <div className="text-[11px] text-slate-400">
                    Category: {faq.category} · Keywords: {faq.keywords.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live Google Sheets / CRM Bookings Table (7 cols) */}
        <section
          aria-label="Google Sheets and CRM Bookings Ledger"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
        >
          <div>
            <div className="pb-3 border-b border-slate-200">
              <h2 className="font-display text-base font-bold text-slate-900">
                Live Google Sheets / CRM Qualification & Booking Log ({crmBookings.length})
              </h2>
              <p className="text-xs text-slate-500">
                Automatically populated when leads interact with the 24/7 WhatsApp or Website agent.
              </p>
            </div>

            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2 pr-3">Lead / Business</th>
                    <th className="py-2 px-3">Need Summary</th>
                    <th className="py-2 px-3 text-right">Budget</th>
                    <th className="py-2 px-3">Qualification</th>
                    <th className="py-2 px-3">Calendar Slot</th>
                    <th className="py-2 pl-3 text-right">Tokens / Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {crmBookings.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-slate-900">{row.leadName}</div>
                        <div className="text-[11px] text-slate-500">
                          {row.businessType} · {row.channel}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs">
                        {row.needSummary}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {row.monthlyBudgetUsd > 0 ? `$${row.monthlyBudgetUsd}/mo` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold">
                        <span
                          className={
                            row.leadScore === 'HOT_BOOKED'
                              ? 'text-emerald-700'
                              : row.leadScore === 'WARM_NURTURE'
                              ? 'text-amber-700'
                              : 'text-slate-600'
                          }
                        >
                          {row.leadScore}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{row.bookedSlot}</td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-800">
                        <div>{row.tokensUsed} tok</div>
                        <div className="text-[11px] text-slate-500">
                          ${row.costUsd.toFixed(6)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
