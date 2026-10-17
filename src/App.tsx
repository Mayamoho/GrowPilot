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
import { type FaqItem, type ModelTierId } from './utils/agentEngine';

interface TelemetrySummary {
  totalRequests: number;
  cacheHits: number;
  cacheHitRatePct: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  totalSavedUsd: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTabId>('gtm-studio');
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (
      tabParam === 'gtm-studio' ||
      tabParam === 'whatsapp-agent' ||
      tabParam === 'cost-lab' ||
      tabParam === 'ubuntu-deploy'
    ) {
      setActiveTab(tabParam);
    }

    fetch('/api/state')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          if (data.faqs) setFaqs(data.faqs);
          if (data.gtmRecords) setGtmRecords(data.gtmRecords);
          if (data.crmBookings) setCrmBookings(data.crmBookings);
          if (data.telemetry) setTelemetry(data.telemetry);
        }
      })
      .catch(() => {
        // Initial deterministic seed state already loaded
      });
  }, []);

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
      if (!res.ok) return null;
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
      return data.record || null;
    } catch {
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = async () => {
    try {
      await fetch('/api/cache/clear', { method: 'POST' });
    } catch {
      // ignore
    }
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
      if (!res.ok) return null;
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
      return null;
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
    try {
      const res = await fetch('/api/faq/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.faqs) {
        setFaqs(data.faqs);
      }
      return true;
    } catch {
      return false;
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
