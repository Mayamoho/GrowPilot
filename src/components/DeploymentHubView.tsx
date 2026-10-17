import React, { useState } from 'react';
import {
  DOCKER_COMPOSE_UBUNTU_YAML,
  N8N_WORKFLOW_EXPORT_JSON,
  UBUNTU_SHORT_RUNBOOK_MD,
  GROWBIG100_APPLICATION_EMAIL,
} from '../data/seedData';
import { Copy, Check, Download, Terminal, FileJson, Mail, BookOpen } from 'lucide-react';

export const DeploymentHubView: React.FC = () => {
  const [activeDocTab, setActiveDocTab] = useState<
    'docker-compose' | 'n8n-json' | 'short-docs' | 'application-email'
  >('docker-compose');
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
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            04. Self-Hosted Ubuntu 24.04 Docker Stack · Ollama Local Open-Source LLM · n8n Workflow · abukawser.xyz Tunnel
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Ubuntu 24.04 Docker, n8n & Zero-Cost Domain Kit
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 max-w-3xl">
            Everything needed to run this agent for $0.00 on Ubuntu 24.04 LTS using Docker Compose, Ollama (llama3.2:3b), self-hosted n8n, and a free Cloudflare Tunnel mapped to abukawser.xyz.
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
                'growbig100_n8n_workflow.json',
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

      {/* 3-Step Zero-Cost Domain Strategy Strip for abukawser.xyz */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
          <div className="text-xs font-mono font-semibold text-teal-800">
            Step 01 · Main Portfolio & Widget
          </div>
          <h2 className="font-display text-sm font-bold text-slate-900">
            abukawser.xyz → Portfolio + Live Link
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Point abukawser.xyz DNS to Cloudflare (Free Plan). Link your main portfolio on the root domain and embed or link this live GrowPilot GTM & 24/7 Agent workbench.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
          <div className="text-xs font-mono font-semibold text-teal-800">
            Step 02 · Local Ubuntu 24.04 Open-Source LLM
          </div>
          <h2 className="font-display text-sm font-bold text-slate-900">
            Docker Compose + Ollama (Llama 3.2 3B)
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Run docker compose up -d on your Ubuntu 24.04 laptop or VPS. Spins up GrowPilot, self-hosted n8n (port 5678), and Ollama running llama3.2:3b for $0.00 token cost.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
          <div className="text-xs font-mono font-semibold text-teal-800">
            Step 03 · Free HTTPS Subdomains via Cloudflared
          </div>
          <h2 className="font-display text-sm font-bold text-slate-900">
            gtm.abukawser.xyz & agent.abukawser.xyz
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Use the included cloudflared container to expose your local Ubuntu Docker services to gtm.abukawser.xyz and agent.abukawser.xyz with automatic HTTPS for $0.
          </p>
        </div>
      </div>

      {/* Tabbed Artifact & Documentation Viewer */}
      <section
        aria-label="Deployment Artifacts and Documentation"
        className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div
            role="tablist"
            aria-label="Deployment Files and Runbooks"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto"
          >
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
              docker-compose.yml (Ubuntu 24.04)
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

            <button
              role="tab"
              type="button"
              aria-selected={activeDocTab === 'short-docs'}
              onClick={() => setActiveDocTab('short-docs')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeDocTab === 'short-docs'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Short Docs / README.md
            </button>

            <button
              role="tab"
              type="button"
              aria-selected={activeDocTab === 'application-email'}
              onClick={() => setActiveDocTab('application-email')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeDocTab === 'application-email'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              Growbig100 Application Email
            </button>
          </div>

          <div>
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
            {activeDocTab === 'short-docs' && (
              <button
                type="button"
                onClick={() => handleCopy(UBUNTU_SHORT_RUNBOOK_MD, 'docs')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedKey === 'docs' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied Runbook
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy README.md
                  </>
                )}
              </button>
            )}
            {activeDocTab === 'application-email' && (
              <button
                type="button"
                onClick={() => handleCopy(GROWBIG100_APPLICATION_EMAIL, 'email-app')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedKey === 'email-app' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied Application Email
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Email to Saadi
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <pre className="p-4 text-xs font-mono bg-slate-900 text-slate-100 rounded-lg overflow-x-auto leading-relaxed max-h-[460px]">
          {activeDocTab === 'docker-compose' && DOCKER_COMPOSE_UBUNTU_YAML}
          {activeDocTab === 'n8n-json' && N8N_WORKFLOW_EXPORT_JSON}
          {activeDocTab === 'short-docs' && UBUNTU_SHORT_RUNBOOK_MD}
          {activeDocTab === 'application-email' && GROWBIG100_APPLICATION_EMAIL}
        </pre>
      </section>
    </div>
  );
};
