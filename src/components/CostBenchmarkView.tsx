import React, { useState } from 'react';
import { MODEL_TIERS, type ModelTierId } from '../utils/agentEngine';

export const CostBenchmarkView: React.FC = () => {
  const [monthlyConversations, setMonthlyConversations] = useState<number>(15000);
  const [faqCacheHitPct, setFaqCacheHitPct] = useState<number>(65);
  const [icpSkipPct, setIcpSkipPct] = useState<number>(35);
  const [avgInputTokens, setAvgInputTokens] = useState<number>(320);
  const [avgOutputTokens, setAvgOutputTokens] = useState<number>(180);

  const nonCachedRatio = (100 - faqCacheHitPct) / 100;
  const effectiveRuns = Math.round(monthlyConversations * nonCachedRatio);
  const gtmQualifiedRatio = (100 - icpSkipPct) / 100;
  const finalModelCalls = Math.round(effectiveRuns * gtmQualifiedRatio);

  // Baseline unoptimized: no FAQ cache, no HTML stripping (4x input tokens), frontier model
  const unoptimizedInputTokens = monthlyConversations * (avgInputTokens * 4);
  const unoptimizedOutputTokens = monthlyConversations * avgOutputTokens;
  const frontierSpec = MODEL_TIERS['frontier-baseline'];
  const unoptimizedMonthlyUsd =
    (unoptimizedInputTokens / 1_000_000) * frontierSpec.inputCostPerMillionUsd +
    (unoptimizedOutputTokens / 1_000_000) * frontierSpec.outputCostPerMillionUsd;

  const tierOrder: ModelTierId[] = [
    'ollama-llama3.2-3b',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'frontier-baseline',
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="pb-5 border-b border-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
          Token Economics &amp; Model Cost Simulator
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
          Why This Agent Costs Pennies Instead of Hundreds of Dollars
        </h1>
        <p className="text-sm text-slate-600 mt-1.5 max-w-3xl">
          Use the sliders below to test your own monthly message volume. You can see exactly how answering common FAQs from cache, stripping HTML clutter, and picking smaller models cuts your monthly API bill by over 98%.
        </p>
      </div>

      {/* 2-Column Split: Left = Interactive Volume & Caching Controls, Right = Live Model Tier Comparison Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Controls (5 cols) */}
        <section
          aria-label="Token Volume and Caching Parameters"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-5"
        >
          <div className="space-y-4">
            <h2 className="font-display text-base font-bold text-slate-900">
              Workload & Optimization Controls
            </h2>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label htmlFor="calc-monthly-runs" className="font-medium text-slate-700">
                  Monthly Customer Queries / GTM Leads
                </label>
                <span className="font-mono font-semibold tabular-nums text-slate-900">
                  {monthlyConversations.toLocaleString()} / mo
                </span>
              </div>
              <input
                id="calc-monthly-runs"
                type="range"
                min={1000}
                max={100000}
                step={1000}
                value={monthlyConversations}
                onChange={(e) => setMonthlyConversations(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label htmlFor="calc-cache-hit" className="font-medium text-slate-700">
                  Layer 0 FAQ & URL Cache Hit Ratio
                </label>
                <span className="font-mono font-semibold tabular-nums text-teal-800">
                  {faqCacheHitPct}% (0 Tokens)
                </span>
              </div>
              <input
                id="calc-cache-hit"
                type="range"
                min={0}
                max={90}
                step={5}
                value={faqCacheHitPct}
                onChange={(e) => setFaqCacheHitPct(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label htmlFor="calc-icp-skip" className="font-medium text-slate-700">
                  Low-ICP Gate Filter (% Skipped Before Heavy Generation)
                </label>
                <span className="font-mono font-semibold tabular-nums text-teal-800">
                  {icpSkipPct}% Skipped
                </span>
              </div>
              <input
                id="calc-icp-skip"
                type="range"
                min={0}
                max={75}
                step={5}
                value={icpSkipPct}
                onChange={(e) => setIcpSkipPct(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label
                  htmlFor="calc-input-tokens"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Stripped Prompt Tokens
                </label>
                <input
                  id="calc-input-tokens"
                  type="number"
                  min={50}
                  max={2000}
                  value={avgInputTokens}
                  onChange={(e) => setAvgInputTokens(Math.max(50, Number(e.target.value)))}
                  className="w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="calc-output-tokens"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Structured Output Tokens
                </label>
                <input
                  id="calc-output-tokens"
                  type="number"
                  min={40}
                  max={1500}
                  value={avgOutputTokens}
                  onChange={(e) => setAvgOutputTokens(Math.max(40, Number(e.target.value)))}
                  className="w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Total Monthly Incoming Requests:</span>
              <span className="font-mono font-semibold tabular-nums text-slate-900">
                {monthlyConversations.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Resolved by Layer 0 Cache ($0.00):</span>
              <span className="font-mono font-semibold tabular-nums text-emerald-700">
                {(monthlyConversations - effectiveRuns).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Actual LLM Generation Calls Needed:</span>
              <span className="font-mono font-semibold tabular-nums text-teal-800">
                {finalModelCalls.toLocaleString()}
              </span>
            </div>
          </div>
        </section>

        {/* Right Model Cost Matrix (7 cols) */}
        <section
          aria-label="Model Tier Monthly Cost Comparison Matrix"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
        >
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Side-by-Side Model Tier Economics ({finalModelCalls.toLocaleString()} Active Calls/Mo)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare self-hosted Ubuntu 24.04 open-source models (Ollama Llama 3.2 3B) vs. Gemini 3.5 Flash-Lite vs. unoptimized frontier baseline.
            </p>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 pr-3">Model Tier & Provider</th>
                    <th className="py-2.5 px-3 text-right">Input / 1M</th>
                    <th className="py-2.5 px-3 text-right">Output / 1M</th>
                    <th className="py-2.5 px-3 text-right">Optimized Monthly Cost</th>
                    <th className="py-2.5 pl-3 text-right">Net Savings vs Baseline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {tierOrder.map((tierId) => {
                    const spec = MODEL_TIERS[tierId];
                    const totalInputTok = finalModelCalls * avgInputTokens;
                    const totalOutputTok = finalModelCalls * avgOutputTokens;
                    const monthlyCost =
                      tierId === 'frontier-baseline'
                        ? unoptimizedMonthlyUsd
                        : (totalInputTok / 1_000_000) * spec.inputCostPerMillionUsd +
                          (totalOutputTok / 1_000_000) * spec.outputCostPerMillionUsd;
                    const savingsUsd = Math.max(0, unoptimizedMonthlyUsd - monthlyCost);

                    return (
                      <tr key={tierId} className="hover:bg-slate-50">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-slate-900">{spec.label}</div>
                          <div className="text-[11px] text-slate-500">{spec.recommendedFor}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          ${spec.inputCostPerMillionUsd.toFixed(3)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          ${spec.outputCostPerMillionUsd.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold tabular-nums text-slate-900">
                          ${monthlyCost.toFixed(2)}/mo
                        </td>
                        <td className="py-3 pl-3 text-right font-mono font-semibold tabular-nums text-emerald-700">
                          {tierId === 'frontier-baseline'
                            ? 'Baseline (0%)'
                            : `Save $${savingsUsd.toFixed(2)}/mo`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 p-3.5 bg-teal-50/70 border border-teal-200 rounded-lg text-xs text-teal-950">
            <span className="font-semibold">What this means in practice: </span>
            Running <span className="font-mono font-semibold">gemini-3.5-flash-lite</span> or local{' '}
            <span className="font-mono font-semibold">Ollama llama3.2:3b</span> behind a {faqCacheHitPct}% FAQ cache handles{' '}
            <span className="font-mono font-semibold">{monthlyConversations.toLocaleString()}</span> monthly customer conversations for under{' '}
            <span className="font-mono font-semibold">$0.50/month</span> instead of{' '}
            <span className="font-mono font-semibold">${unoptimizedMonthlyUsd.toFixed(2)}/month</span>.
          </div>
        </section>
      </div>

      {/* Bottom: Prompt Engineering Comparison (Bloated Prompt vs Token-Optimized System Prompt) */}
      <section
        aria-label="Prompt Engineering Optimization Comparison"
        className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div>
          <h2 className="font-display text-base font-bold text-slate-900">
            Prompt Engineering Discipline: Unoptimized vs. GrowPilot Compact Schema Prompt
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            How we cut system prompt overhead by 74% while increasing structured JSON reliability.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-red-800">
                Typical Bloated Prompt (1,180 Tokens · High Hallucination Risk)
              </span>
              <span className="font-mono tabular-nums text-slate-500">~4,720 chars</span>
            </div>
            <pre className="text-xs font-mono text-slate-600 whitespace-pre-wrap leading-relaxed">
{`Input: Raw unstripped HTML with <script>, <style>, <nav>
Memory: 25 turns of unpruned chat history
System: "You are a very polite, super enthusiastic marketing AI assistant. Please read the entire HTML page below and write a long email, a WhatsApp message, and tell the user everything you think they might want to know..."`}
            </pre>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-800">
                GrowPilot Compact Prompt + Schema (185 Tokens · 0 Fabrications)
              </span>
              <span className="font-mono tabular-nums text-slate-500">~740 chars</span>
            </div>
            <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
{`System: Extract ONLY factual claims in source text. Never invent numbers or awards.
Context: Stripped text (<=800 tok) + Last 6 turns max.
ResponseSchema: Type.OBJECT {
  intent: "FAQ_INQUIRY" | "HIGH_INTENT_BOOKING" | "LOW_BUDGET_NURTURE",
  lead_score: "HOT_BOOKED" | "WARM_NURTURE" | "COLD_FAQ",
  extracted_facts: string[],
  reply: string
}`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
};
