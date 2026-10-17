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
} from 'lucide-react';

const LOCAL_AND_VERCEL_SETUP_GUIDE = `# 1. Clone the repository & enter the project directory
git clone https://github.com/Mayamoho/GrowPilot.git
cd GrowPilot

# 2. Configure environment variables
cp .env.example .env
# Edit .env and add GEMINI_API_KEY="AIzaSy..." (optional: runs with built-in engine if omitted)

# ---------------------------------------------------------
# OPTION A: Run Locally with Node.js (Port 3000)
# ---------------------------------------------------------
npm install
npm test
npm run dev

# ---------------------------------------------------------
# OPTION B: Run with Docker Compose on Ubuntu 24.04 LTS
# (Starts GrowPilot on :3000, Ollama llama3.2:3b on :11434, and n8n on :5678)
# ---------------------------------------------------------
docker compose up -d --build
docker compose ps`;

const SUBDOMAIN_VERCEL_GUIDE = `# Subdomain Routing Configuration (Vercel + DNS)
# Primary Vercel Deployment: https://growpilot-ashy.vercel.app/

# 1. In Vercel Dashboard -> Project -> Settings -> Domains, add:
#    - gtm.abukawser.xyz   (Automatically opens 01. GTM Pipeline)
#    - agent.abukawser.xyz (Automatically opens 02. 24/7 FAQ & Booking Agent)

# 2. In your DNS Provider (Cloudflare / Registrar) -> DNS Records, add:
#    Type: CNAME | Name: gtm   | Target: cname.vercel-dns.com | Proxy: DNS Only
#    Type: CNAME | Name: agent | Target: cname.vercel-dns.com | Proxy: DNS Only`;

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
            Architecture &amp; Deployment
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Agent Workflow, Docker Compose &amp; Vercel Setup
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 max-w-3xl">
            Technical overview of the 5-stage cost-optimized agent pipeline and ready-to-run configuration files for Ubuntu 24.04 Docker Compose, n8n, and Vercel subdomain routing.
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

      {/* 5-Stage Technical Architecture Pipeline */}
      <section aria-label="Technical Workflow Overview" className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-700" />
          <h2 className="font-display text-base font-bold text-slate-900">
            End-to-End Agent Workflow (5-Stage Cost &amp; Groundedness Pipeline)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[
            {
              step: 'Stage 01',
              title: 'Layer 0 Cache',
              metric: '0 Tokens · <5ms',
              desc: 'Normalizes incoming FAQ queries and scraped URLs. Exact or Jaccard keyword matches (>=62%) return immediately at $0.00 cost.',
            },
            {
              step: 'Stage 02',
              title: 'Input Compression',
              metric: '-80% Prompt Tokens',
              desc: 'Strips HTML <script>, <style>, <nav>, and <footer> tags from scraped pages and caps chat context to a 6-turn sliding window.',
            },
            {
              step: 'Stage 03',
              title: 'ICP Score Gate',
              metric: '0–100 Fit Filter',
              desc: 'Scores prospect buying signals before calling generation models. Leads below threshold (<60) are skipped to prevent wasted tokens.',
            },
            {
              step: 'Stage 04',
              title: 'Smallest-Model Router',
              metric: 'Ollama / Flash-Lite',
              desc: 'Routes classification and generation to local Ollama Llama 3.2 3B ($0.00), Gemini 3.1 Flash-Lite ($0.075/1M), or Gemini 3.8 Flash.',
            },
            {
              step: 'Stage 05',
              title: '5-Layer Groundedness',
              metric: 'Zero Hallucinations',
              desc: 'Verifies target entities, numerical claims, and source fact overlap before syncing qualified leads and calendar slots to CRM.',
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
              Local, Docker &amp; Subdomain Setup
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
                onClick={() => handleCopy(LOCAL_AND_VERCEL_SETUP_GUIDE, 'setup-cmd')}
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
                Ubuntu 24.04 Local &amp; Docker Compose Setup
              </div>
              <pre className="p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed rounded-xl overflow-x-auto">
                {LOCAL_AND_VERCEL_SETUP_GUIDE}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-800">
                Vercel Deployment &amp; Subdomain Routing (gtm / agent)
              </div>
              <pre className="p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed rounded-xl overflow-x-auto">
                {SUBDOMAIN_VERCEL_GUIDE}
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
                Dockerfile (Root Repository File)
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
