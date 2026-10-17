import React, { useState } from 'react';
import {
  DOCKER_COMPOSE_UBUNTU_YAML,
  DOCKERFILE_CONTENT,
  N8N_WORKFLOW_EXPORT_JSON,
} from '../data/seedData';
import {
  Copy,
  Check,
  Download,
  Terminal,
  FileJson,
  Layers,
  Globe,
  ExternalLink,
} from 'lucide-react';

const LOCAL_AND_DOCKER_SETUP_COMMANDS = `# 1. Clone the repository & enter the project folder
git clone https://github.com/Mayamoho/GrowPilot.git
cd GrowPilot

# 2. Install dependencies cleanly (no peer conflicts)
npm install --legacy-peer-deps

# 3. Run the 7 pure-logic unit tests (runs offline in <1s)
npm test

# 4. Optional: Add a free Gemini API key for live cloud calls
cp .env.example .env

# ---------------------------------------------------------
# OPTION A: Run Directly with Node.js (Port 3000)
# ---------------------------------------------------------
npm run dev

# ---------------------------------------------------------
# OPTION B: Run with Docker Compose on Ubuntu 24.04 LTS
# (Starts GrowPilot on :3000, Ollama llama3.2:3b on :11434, and n8n on :5678)
# ---------------------------------------------------------
docker compose up -d --build
docker compose ps`;

const PLAIN_ENGLISH_HOW_IT_WORKS = `# How GrowPilot Works (Plain-English Summary)

1. Outbound GTM Pipeline (https://gtm.abukawser.xyz)
   - Strips <script>, <style>, <nav>, and <footer> clutter from scraped HTML first, cutting ~70-80% of input tokens before any model runs.
   - Scores whether the company is actually a match (0-100 ICP Fit Score). If the score is below your slider threshold (default 60), it stops right there and spends 0 outbound tokens.
   - Drafts a Cold Email, WhatsApp opener, and LinkedIn post using small, fast models (Gemini 3.8 Flash, Gemini 3.1 Flash-Lite, or local Ollama Llama 3.2 3B).
   - Verifies every number and fact against the source webpage through a 5-layer check so the AI never invents fake stats.
   - Exports all analyzed leads to CSV with one click ("Download CSV").

2. 24/7 FAQ & Lead Booking Agent (https://agent.abukawser.xyz)
   - Checks a normalized Layer 0 FAQ Cache first. Common questions about pricing, WhatsApp setup, or hours are answered in <5ms for 0 tokens ($0.00).
   - Caps chat history at the last 6 messages so long WhatsApp threads never get expensive.
   - When a lead shares a monthly budget >= $500/mo, the agent automatically reserves a discovery call slot and logs the lead into the CRM table.

3. Full Workbench on Vercel (https://growpilot-ashy.vercel.app/)
   - Hosts all four modules in one place, with automatic subdomain routing for gtm.abukawser.xyz and agent.abukawser.xyz.`;

export const DeploymentHubView: React.FC = () => {
  const [activeDocTab, setActiveDocTab] = useState<
    'setup-guide' | 'docker-compose' | 'n8n-json'
  >('setup-guide');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (content: string, key: string) => {
    navigator.clipboard?.writeText(content);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDownloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Clean Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
            How It Works &amp; Local Setup
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Plain-English Workflow, Docker Compose &amp; Live Links
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 max-w-3xl">
            A clear walkthrough of how GrowPilot keeps token costs near zero while preventing AI hallucinations, plus copy-paste commands to run the full stack locally on Node.js or Ubuntu 24.04 Docker Compose.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              handleDownloadFile(
                DOCKER_COMPOSE_UBUNTU_YAML,
                'docker-compose.yml',
                'text/yaml;charset=utf-8;'
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download docker-compose.yml
          </button>
          <button
            type="button"
            onClick={() =>
              handleDownloadFile(
                N8N_WORKFLOW_EXPORT_JSON,
                'growpilot_n8n_workflow.json',
                'application/json;charset=utf-8;'
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download n8n Workflow JSON
          </button>
        </div>
      </div>

      {/* Live Deployments Strip */}
      <section
        aria-label="Live Production Entry Points"
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {[
          {
            title: 'Full GrowPilot Workbench (Vercel)',
            url: 'https://growpilot-ashy.vercel.app/',
            badge: 'All 4 Modules',
            desc: 'Main production deployment hosting the GTM Pipeline, 24/7 FAQ & Booking Agent, Token Cost Lab, and Setup Guide.',
          },
          {
            title: 'Dedicated GTM Pipeline Link',
            url: 'https://gtm.abukawser.xyz',
            badge: 'Opens GTM Studio',
            desc: 'Opens directly into the outbound HTML stripper, ICP fit scorer (0–100), 5-layer fact checker, and CSV lead exporter.',
          },
          {
            title: 'Dedicated 24/7 Customer Agent Link',
            url: 'https://agent.abukawser.xyz',
            badge: 'Opens 24/7 Agent',
            desc: 'Opens directly into the 0-token cached FAQ responder, 6-turn lead qualifier, voice call agent, and CRM booking table.',
          },
        ].map((item) => (
          <a
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-slate-200 hover:border-teal-600 rounded-xl p-4 flex flex-col justify-between transition-colors group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                  {item.badge}
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700 transition-colors" />
              </div>
              <h2 className="font-display text-sm font-bold text-slate-900 mt-2">
                {item.title}
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.desc}</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-xs font-mono text-teal-700 truncate">
              {item.url}
            </div>
          </a>
        ))}
      </section>

      {/* 5-Stage Plain-English Architecture Pipeline */}
      <section aria-label="Technical Workflow Overview" className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-700" />
          <h2 className="font-display text-base font-bold text-slate-900">
            How the Agent Saves Tokens &amp; Stops Hallucinations (5 Steps)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[
            {
              step: 'Step 01',
              title: 'Layer 0 Cache First',
              metric: '0 Tokens · <5ms',
              desc: 'Before calling any AI model, code checks if this FAQ question or webpage was already answered. Repeat hits return in under 5ms for $0.00.',
            },
            {
              step: 'Step 02',
              title: 'Strip HTML Clutter',
              metric: '-80% Input Size',
              desc: 'Removes <script>, <style>, <nav>, and <footer> tags from scraped pages, and keeps only the last 6 chat messages in memory.',
            },
            {
              step: 'Step 03',
              title: 'Score Lead Fit (ICP)',
              metric: '0–100 Gate',
              desc: 'Scores whether a website is actually a commercial prospect. If it scores below your slider (e.g. <60), we skip outbound writing to save tokens.',
            },
            {
              step: 'Step 04',
              title: 'Pick Smallest Model',
              metric: 'Ollama / Flash-Lite',
              desc: 'Uses local Ollama Llama 3.2 3B ($0.00), Gemini 3.1 Flash-Lite ($0.075/1M), or Gemini 3.8 Flash instead of overpaying for heavy models.',
            },
            {
              step: 'Step 05',
              title: '5-Layer Fact Check',
              metric: 'No Fake Numbers',
              desc: 'Cross-checks every number and fact in the generated email against the source webpage before logging leads or booking calendar calls.',
            },
          ].map((stage) => (
            <div
              key={stage.step}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-2"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-teal-700">{stage.step}</span>
                  <span className="text-slate-500">{stage.metric}</span>
                </div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  {stage.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">{stage.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Clean 3-Tab Setup & Configuration Viewer */}
      <section
        aria-label="Setup and Deployment Files"
        className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div
            role="tablist"
            aria-label="Configuration Files"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto"
          >
            <button
              role="tab"
              type="button"
              aria-selected={activeDocTab === 'setup-guide'}
              onClick={() => setActiveDocTab('setup-guide')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeDocTab === 'setup-guide'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Quick Start &amp; Plain-English Guide
            </button>

            <button
              role="tab"
              type="button"
              aria-selected={activeDocTab === 'docker-compose'}
              onClick={() => setActiveDocTab('docker-compose')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeDocTab === 'docker-compose'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              docker-compose.yml &amp; Dockerfile
            </button>

            <button
              role="tab"
              type="button"
              aria-selected={activeDocTab === 'n8n-json'}
              onClick={() => setActiveDocTab('n8n-json')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeDocTab === 'n8n-json'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileJson className="w-3.5 h-3.5" />
              n8n Workflow JSON
            </button>
          </div>

          <div>
            {activeDocTab === 'setup-guide' && (
              <button
                type="button"
                onClick={() => handleCopy(LOCAL_AND_DOCKER_SETUP_COMMANDS, 'setup-cmd')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedKey === 'setup-cmd' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied Commands
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Setup Commands
                  </>
                )}
              </button>
            )}
            {activeDocTab === 'docker-compose' && (
              <button
                type="button"
                onClick={() => handleCopy(DOCKER_COMPOSE_UBUNTU_YAML, 'docker')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedKey === 'docker' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied YAML
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy docker-compose.yml
                  </>
                )}
              </button>
            )}
            {activeDocTab === 'n8n-json' && (
              <button
                type="button"
                onClick={() => handleCopy(N8N_WORKFLOW_EXPORT_JSON, 'n8n')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedKey === 'n8n' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied JSON
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy n8n JSON
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {activeDocTab === 'setup-guide' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-800">
                Step-by-Step Local &amp; Ubuntu 24.04 Docker Commands
              </div>
              <pre className="p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed rounded-xl overflow-x-auto">
                {LOCAL_AND_DOCKER_SETUP_COMMANDS}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-800">
                What Each Part of GrowPilot Does
              </div>
              <pre className="p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed rounded-xl overflow-x-auto whitespace-pre-wrap">
                {PLAIN_ENGLISH_HOW_IT_WORKS}
              </pre>
            </div>
          </div>
        )}

        {activeDocTab === 'docker-compose' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 space-y-2">
              <div className="text-xs font-semibold text-slate-800">
                docker-compose.yml (Root Repository File)
              </div>
              <pre className="p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed rounded-xl overflow-x-auto max-h-[460px]">
                {DOCKER_COMPOSE_UBUNTU_YAML}
              </pre>
            </div>
            <div className="lg:col-span-5 space-y-2">
              <div className="text-xs font-semibold text-slate-800">
                Dockerfile (Uses npm install --legacy-peer-deps)
              </div>
              <pre className="p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed rounded-xl overflow-x-auto max-h-[460px]">
                {DOCKERFILE_CONTENT}
              </pre>
            </div>
          </div>
        )}

        {activeDocTab === 'n8n-json' && (
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 overflow-x-auto max-h-[460px]">
            <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {N8N_WORKFLOW_EXPORT_JSON}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
};
