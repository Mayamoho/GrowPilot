import React, { useState } from 'react';
import {
  PRESET_PROSPECTS,
  type GtmPipelineRecord,
  type GtmProspectPreset,
} from '../data/seedData';
import {
  MODEL_TIERS,
  SELECTABLE_MODEL_TIERS,
  formatTierPriceLabel,
  formatGtmLeadsCsv,
  type ModelTierId,
} from '../utils/agentEngine';
import {
  Play,
  RotateCcw,
  Copy,
  Check,
  Download,
  ShieldCheck,
  Search,
} from 'lucide-react';

interface GtmStudioViewProps {
  records: GtmPipelineRecord[];
  onRunPipeline: (payload: {
    companyName: string;
    sourceUrl: string;
    industry: string;
    rawContent: string;
    icpThreshold: number;
    modelPreference: ModelTierId;
    bypassCache: boolean;
  }) => Promise<GtmPipelineRecord | null>;
  onClearCache: () => Promise<void>;
  isLoading: boolean;
}

export const GtmStudioView: React.FC<GtmStudioViewProps> = ({
  records,
  onRunPipeline,
  onClearCache,
  isLoading,
}) => {
  const defaultPreset = PRESET_PROSPECTS[0];
  const [selectedPresetId, setSelectedPresetId] = useState<string>(defaultPreset.id);
  const [companyName, setCompanyName] = useState<string>(defaultPreset.companyName);
  const [sourceUrl, setSourceUrl] = useState<string>(defaultPreset.sourceUrl);
  const [industry, setIndustry] = useState<string>(defaultPreset.industry);
  const [rawContent, setRawContent] = useState<string>(defaultPreset.rawHtmlSample);
  const [icpThreshold, setIcpThreshold] = useState<number>(60);
  const [modelPreference, setModelPreference] = useState<ModelTierId>('gemini-3.8-flash');
  const [activeOutputTab, setActiveOutputTab] = useState<
    'cold-email' | 'whatsapp' | 'social-post' | 'groundedness'
  >('cold-email');
  const [activeRecordId, setActiveRecordId] = useState<string>(
    records[0]?.id || 'gtm-seed-1'
  );
  const [crmFilter, setCrmFilter] = useState<'ALL' | 'QUALIFIED_OUTBOUND' | 'SKIPPED_LOW_ICP'>(
    'ALL'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);

  const activeRecord =
    records.find((r) => r.id === activeRecordId) || records[0] || null;

  const handleSelectPreset = (preset: GtmProspectPreset) => {
    setSelectedPresetId(preset.id);
    setCompanyName(preset.companyName);
    setSourceUrl(preset.sourceUrl);
    setIndustry(preset.industry);
    setRawContent(preset.rawHtmlSample);
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent, bypassCache = false) => {
    e.preventDefault();
    if (!companyName.trim() || (!rawContent.trim() && !sourceUrl.trim())) {
      setValidationError(
        'Company or Article Name and either a URL or raw HTML/text content are required.'
      );
      return;
    }
    setValidationError(null);
    setCacheNotice(null);

    const result = await onRunPipeline({
      companyName,
      sourceUrl,
      industry,
      rawContent,
      icpThreshold,
      modelPreference,
      bypassCache,
    });

    if (result) {
      setActiveRecordId(result.id);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const filteredRecords = records.filter((rec) => {
    const matchesStatus =
      crmFilter === 'ALL' || rec.qualificationStatus === crmFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      rec.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.industry.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleDownloadCsv = () => {
    const rowsToExport = filteredRecords.length > 0 ? filteredRecords : records;
    const csv = formatGtmLeadsCsv(
      rowsToExport.map((r) => ({
        companyName: r.companyName,
        industry: r.industry,
        icpScore: r.icpScore,
        qualificationStatus: r.qualificationStatus,
        sourceUrl: r.sourceUrl,
        tokensSavedPct: r.tokensSavedPct,
        modelLabel: r.costMetrics.modelLabel,
        cacheHit: r.costMetrics.cacheHit,
        estimatedCostUsd: r.costMetrics.estimatedCostUsd,
        summary: r.summary,
        coldEmailSubject: r.generatedAssets.coldEmailSubject,
      }))
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'growpilot_gtm_leads.csv';
    link.click();
    URL.revokeObjectURL(url);
    setCacheNotice(
      `Exported ${rowsToExport.length} analyzed lead(s) to growpilot_gtm_leads.csv (Company Name, Industry, ICP Match Score).`
    );
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
            Autonomous GTM Engineering &amp; Content Pipeline
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            GTM Scraper, ICP Gate &amp; Grounded Outbound Agent
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 max-w-3xl">
            Strips HTML boilerplate to cut ~80% of input tokens, scores ICP fit (0–100) before calling generation models, and verifies every cold email, WhatsApp opener, and social post through a 5-layer groundedness gate.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={async () => {
              await onClearCache();
              setCacheNotice('Layer 0 Cache cleared — next run will invoke the LLM fresh.');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Layer 0 Cache
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download CSV
          </button>
        </div>
      </div>

      {cacheNotice && (
        <div
          role="status"
          className="px-4 py-2.5 text-xs font-medium text-teal-900 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between"
        >
          <span>{cacheNotice}</span>
          <button
            type="button"
            onClick={() => setCacheNotice(null)}
            className="text-teal-700 underline ml-4 whitespace-nowrap shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main 2-Column Split: Left = Prospect Input & Token Gate Config, Right = Active Pipeline Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Prospect & ICP Configuration (5 cols) */}
        <section
          aria-label="Prospect and ICP Configuration"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
        >
          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Target Prospect or Article Input
                </h2>
                <span className="text-xs text-slate-500">
                  Presets & Live URLs
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose a preset sample (Dhaka Clinic, B2B SaaS, Technical Article, or Low-ICP test) or paste your own HTML/text.
              </p>

              {/* Preset Selector */}
              <div className="grid grid-cols-2 gap-1.5 mt-3">
                {PRESET_PROSPECTS.map((preset) => {
                  const selected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`px-3 py-2 text-left text-xs font-medium rounded-lg border transition-colors truncate cursor-pointer ${
                        selected
                          ? 'bg-teal-50/70 border-teal-600 text-teal-950 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {preset.companyName}
                    </button>
                  );
                })}
              </div>
            </div>

            {validationError && (
              <div
                role="alert"
                className="p-3 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg"
              >
                {validationError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="gtm-company-name"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Company or Article Title
                </label>
                <input
                  id="gtm-company-name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g., DentaCare Dhaka"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label
                  htmlFor="gtm-industry"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Vertical / Task Context
                </label>
                <input
                  id="gtm-industry"
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g., Dental Clinic / B2B SaaS"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="gtm-source-url"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Target Website or Article URL
              </label>
              <input
                id="gtm-source-url"
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="gtm-raw-content"
                  className="block text-xs font-medium text-slate-700"
                >
                  Scraped HTML / Source Text (Boilerplate Stripper Input)
                </label>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {rawContent.length} chars (~{Math.ceil(rawContent.length / 4)} raw tokens)
                </span>
              </div>
              <textarea
                id="gtm-raw-content"
                rows={5}
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                placeholder="Paste raw webpage HTML, business bio, or article text..."
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label
                  htmlFor="gtm-model-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Execution Model Tier
                </label>
                <select
                  id="gtm-model-select"
                  value={modelPreference}
                  onChange={(e) => setModelPreference(e.target.value as ModelTierId)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {SELECTABLE_MODEL_TIERS.map((tierId) => (
                    <option key={tierId} value={tierId}>
                      {formatTierPriceLabel(tierId)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="gtm-icp-slider"
                    className="text-xs font-medium text-slate-700"
                  >
                    Minimum ICP Score Gate
                  </label>
                  <span className="text-xs font-mono font-semibold tabular-nums text-teal-800">
                    {icpThreshold} / 100
                  </span>
                </div>
                <input
                  id="gtm-icp-slider"
                  type="range"
                  min={35}
                  max={85}
                  step={5}
                  value={icpThreshold}
                  onChange={(e) => setIcpThreshold(Number(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer mt-1.5"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Skips LLM generation if score &lt; {icpThreshold}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                {isLoading ? 'Running GTM Pipeline...' : 'Run GTM Pipeline'}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={(e) => handleSubmit(e, true)}
                className="px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Force Fresh LLM Run
              </button>
            </div>
          </form>
        </section>

        {/* Right Column: Live Pipeline Inspection & Generated Outbound Assets (7 cols) */}
        <section
          aria-label="GTM Pipeline Output and Groundedness Verification"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
        >
          {activeRecord ? (
            <div className="space-y-5">
              {/* Top Result Header & Unboxed Metadata */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{activeRecord.industry}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{activeRecord.timestamp}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold ${
                        !activeRecord.costMetrics.cacheHit &&
                        activeRecord.generationSource === 'deterministic-fallback'
                          ? 'text-amber-700'
                          : 'text-teal-800'
                      }`}
                    >
                      {activeRecord.costMetrics.cacheHit
                        ? 'Layer 0 Cache Hit (0 Tokens · $0.00)'
                        : activeRecord.generationSource === 'deterministic-fallback'
                          ? 'Deterministic template (no model billed)'
                          : activeRecord.generationSource === 'ollama-local'
                            ? `Local Ollama · ${activeRecord.costMetrics.modelLabel}`
                            : `${activeRecord.costMetrics.modelLabel}`}
                    </span>
                  </div>
                  <h2 className="font-display text-lg font-bold text-slate-900 mt-1">
                    {activeRecord.companyName}
                  </h2>
                </div>

                <div className="flex items-center gap-4 text-right shrink-0">
                  <div>
                    <div className="text-[11px] text-slate-500">ICP Fit Score</div>
                    <div
                      className={`text-lg font-mono font-bold tabular-nums ${
                        activeRecord.qualificationStatus === 'QUALIFIED_OUTBOUND'
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {activeRecord.icpScore}/100
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div>
                    <div className="text-[11px] text-slate-500">
                      Run Cost ({activeRecord.costMetrics.usageSource === 'provider' ? 'provider-reported' : activeRecord.costMetrics.usageSource === 'none' ? 'no model billed' : 'estimated'} USD)
                    </div>
                    <div className="text-lg font-mono font-bold tabular-nums text-slate-900">
                      ${activeRecord.costMetrics.estimatedCostUsd.toFixed(6)}
                    </div>
                  </div>
                </div>
              </div>

              {activeRecord.modelError && (
                <div className="mt-2.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                  {activeRecord.modelError}
                </div>
              )}

              {/* 4-Column Pipeline Efficiency Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2.5 px-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <div className="text-[11px] text-slate-500">Boilerplate Stripped</div>
                  <div className="text-sm font-mono font-semibold tabular-nums text-slate-900 mt-0.5">
                    -{activeRecord.tokensSavedPct}% Tokens
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500">
                    {activeRecord.rawEstimatedTokens} → {activeRecord.cleanedEstimatedTokens} tok
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Cache & Token Status</div>
                  <div className="text-sm font-mono font-semibold tabular-nums text-teal-800 mt-0.5">
                    {activeRecord.costMetrics.cacheHit
                      ? '0 Tokens (Cached)'
                      : `${activeRecord.costMetrics.totalTokens} Tokens`}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500">
                    Latency: {activeRecord.costMetrics.latencyMs}ms
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Groundedness Gate</div>
                  <div className="text-sm font-mono font-semibold tabular-nums text-emerald-700 mt-0.5">
                    {activeRecord.groundednessReport.scorePct}% Verified
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500">
                    {activeRecord.groundednessReport.blockedHallucinationsCount} Fabrications
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Saved vs Frontier</div>
                  <div className="text-sm font-mono font-semibold tabular-nums text-emerald-700 mt-0.5">
                    +${activeRecord.costMetrics.costSavedUsd.toFixed(5)}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500">
                    vs ${activeRecord.costMetrics.baselineFrontierCostUsd.toFixed(5)}
                  </div>
                </div>
              </div>

              {/* Extracted Summary & Facts */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-800">
                  Executive Summary & Extracted Grounding Facts
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {activeRecord.summary}
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  {activeRecord.extractedFacts.map((fact, i) => (
                    <li
                      key={i}
                      className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200/80"
                    >
                      <span className="font-mono font-semibold text-teal-700 mr-1.5">
                        [{i + 1}]
                      </span>
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Segmented Output Tabs */}
              <div>
                <div
                  role="tablist"
                  aria-label="Generated Outbound Channels"
                  className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto"
                >
                  {[
                    { id: 'cold-email', label: 'Cold Email + Follow-Up' },
                    { id: 'whatsapp', label: 'WhatsApp Script' },
                    { id: 'social-post', label: 'LinkedIn / Social Post' },
                    { id: 'groundedness', label: '5-Layer Groundedness Audit' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      role="tab"
                      type="button"
                      aria-selected={activeOutputTab === tab.id}
                      onClick={() =>
                        setActiveOutputTab(
                          tab.id as 'cold-email' | 'whatsapp' | 'social-post' | 'groundedness'
                        )
                      }
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeOutputTab === tab.id
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  {activeOutputTab === 'cold-email' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                        <div className="text-xs text-slate-700">
                          <span className="font-semibold text-slate-900">Subject: </span>
                          {activeRecord.generatedAssets.coldEmailSubject}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              `Subject: ${activeRecord.generatedAssets.coldEmailSubject}\n\n${activeRecord.generatedAssets.coldEmailBody}`,
                              'email'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {copiedField === 'email' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy Email
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="text-xs sm:text-sm font-sans text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {activeRecord.generatedAssets.coldEmailBody}
                      </pre>
                      <div className="pt-2 border-t border-slate-200">
                        <div className="text-xs font-semibold text-slate-700 mb-1">
                          Day-3 Automated Follow-Up:
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {activeRecord.generatedAssets.followUpMessage}
                        </p>
                      </div>
                    </div>
                  )}

                  {activeOutputTab === 'whatsapp' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800">
                          WhatsApp Cloud API Outbound Opener
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              activeRecord.generatedAssets.whatsappOpener,
                              'whatsapp'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {copiedField === 'whatsapp' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy WhatsApp
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-slate-800 leading-relaxed">
                        {activeRecord.generatedAssets.whatsappOpener}
                      </p>
                    </div>
                  )}

                  {activeOutputTab === 'social-post' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800">
                          Generated LinkedIn / Social Media Post (Grounded in Article/Company)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              activeRecord.generatedAssets.socialMediaPost,
                              'social'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {copiedField === 'social' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy Social Post
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="text-xs sm:text-sm font-sans text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {activeRecord.generatedAssets.socialMediaPost}
                      </pre>
                    </div>
                  )}

                  {activeOutputTab === 'groundedness' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                          <ShieldCheck className="w-4 h-4 text-teal-700" />
                          5-Layer Source Fact &amp; Groundedness Check
                        </div>
                        <span className="text-xs font-mono font-semibold text-emerald-700">
                          {activeRecord.groundednessReport.passed
                            ? 'ALL 5 GATES PASSED'
                            : 'REVIEW FLAGGED CLAIMS'}
                        </span>
                      </div>
                      <div className="divide-y divide-slate-200">
                        {activeRecord.groundednessReport.layerChecks.map((chk) => (
                          <div
                            key={chk.layer}
                            className="py-2 flex items-start justify-between gap-4 text-xs"
                          >
                            <div>
                              <span className="font-mono font-semibold text-slate-800">
                                Layer {chk.layer} · {chk.name}
                              </span>
                              <p className="text-slate-600 mt-0.5">{chk.detail}</p>
                            </div>
                            <span
                              className={`font-mono font-semibold shrink-0 ${
                                chk.passed ? 'text-emerald-700' : 'text-red-700'
                              }`}
                            >
                              {chk.passed ? 'PASS' : 'BLOCKED'}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-3 mt-2 border-t border-slate-200">
                        <div className="text-xs font-semibold text-slate-800 mb-2">
                          Claim-level evidence map
                        </div>
                        {activeRecord.groundednessReport.claimEvidence?.length ? (
                          <div className="space-y-2">
                            {activeRecord.groundednessReport.claimEvidence.map((claim, index) => (
                              <div key={`${claim.claim}-${index}`} className="rounded border border-slate-200 bg-white p-2 text-xs">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-medium text-slate-800">{claim.claim}</span>
                                  <span className={`shrink-0 font-mono font-semibold ${claim.status === 'supported' ? 'text-emerald-700' : claim.status === 'contradicted' ? 'text-red-700' : 'text-amber-700'}`}>
                                    {claim.status.replace('_', ' ').toUpperCase()}
                                  </span>
                                </div>
                                <div className="mt-1 text-slate-600">Evidence: {claim.evidence}</div>
                                <div className="mt-1 font-mono text-slate-500">confidence {Math.round(claim.confidence * 100)}%</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">No claim-level evidence was returned for this run.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {/* Bottom Full-Width Synced GTM CRM Pipeline Table */}
      <section
        aria-label="Synced GTM Outbound CRM Pipeline"
        className="bg-white border border-slate-200 rounded-xl p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Synced GTM CRM & Token Ledger ({filteredRecords.length} Records)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any prospect row to inspect its boilerplate savings, ICP reasoning, grounded outbound copy, and token cost.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Filter CRM records by company or vertical"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search company or vertical..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {/* Segmented filter buttons */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {[
                { id: 'ALL', label: 'All Runs' },
                { id: 'QUALIFIED_OUTBOUND', label: 'Qualified (ICP ≥ Gate)' },
                { id: 'SKIPPED_LOW_ICP', label: 'Skipped (Tokens Saved)' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() =>
                    setCrmFilter(
                      btn.id as 'ALL' | 'QUALIFIED_OUTBOUND' | 'SKIPPED_LOW_ICP'
                    )
                  }
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    crmFilter === btn.id
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-300 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 pr-4">Company / Article</th>
                <th className="py-2.5 px-3">Vertical</th>
                <th className="py-2.5 px-3 text-right">ICP Score</th>
                <th className="py-2.5 px-3">Gate Status</th>
                <th className="py-2.5 px-3 text-right">Boilerplate Saved</th>
                <th className="py-2.5 px-3">Model / Cache</th>
                <th className="py-2.5 px-3 text-right">Tokens</th>
                <th className="py-2.5 pl-3 text-right">Cost (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredRecords.map((rec) => {
                const isSelected = rec.id === activeRecord?.id;
                return (
                  <tr
                    key={rec.id}
                    onClick={() => setActiveRecordId(rec.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 pr-4 font-semibold text-slate-900">
                      {rec.companyName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{rec.industry}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {rec.icpScore}/100
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-medium ${
                          rec.qualificationStatus === 'QUALIFIED_OUTBOUND'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {rec.qualificationStatus === 'QUALIFIED_OUTBOUND'
                          ? 'Qualified Outbound'
                          : 'Skipped (Below ICP)'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                      -{rec.tokensSavedPct}%
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {rec.costMetrics.cacheHit
                        ? 'Layer 0 Cache Hit'
                        : rec.costMetrics.modelLabel}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                      {rec.costMetrics.totalTokens}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                      ${rec.costMetrics.estimatedCostUsd.toFixed(6)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
