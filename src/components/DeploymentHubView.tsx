import React, { useState } from 'react';
import {
  DOCKER_COMPOSE_UBUNTU_YAML,
  N8N_WORKFLOW_EXPORT_JSON,
  UBUNTU_SHORT_RUNBOOK_MD,
  GROWBIG100_APPLICATION_EMAIL,
} from '../data/seedData';
import { Copy, Check, Download, Terminal, FileJson, Mail, BookOpen, Globe } from 'lucide-react';

export const DeploymentHubView: React.FC = () => {
  const [activeDocTab, setActiveDocTab] = useState<
    'cloudflare-tunnel' | 'docker-compose' | 'n8n-json' | 'short-docs' | 'application-email'
  >('cloudflare-tunnel');
  const [tunnelMode, setTunnelMode] = useState<'ubuntu-native' | 'docker'>('ubuntu-native');
  const [tunnelTokenInput, setTunnelTokenInput] = useState<string>('eyJhIjoi**********************MyJ9');
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

  const cleanToken = tunnelTokenInput.trim() || 'eyJhIjoi**********************MyJ9';

  const ubuntuNativeCommands = `# Step 1: Install cloudflared on Ubuntu 24.04 (Debian 64-bit from your screenshot)
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared

# Step 2: Connect your "GrowPilot" Tunnel (ID: 8f0db1e0-1a9b-4d7b-9bcc-bc314a1c880e)
# Option 2A — Run as background systemd service (recommended):
sudo cloudflared service install ${cleanToken}

# Option 2B — Or run manually in terminal to watch live logs:
cloudflared tunnel run --token ${cleanToken}`;

  const dockerEnvContent = `# .env for Ubuntu 24.04 Docker Compose + Cloudflare Tunnel "GrowPilot"
# Tunnel ID: 8f0db1e0-1a9b-4d7b-9bcc-bc314a1c880e
GEMINI_API_KEY=your_gemini_api_key_here
OLLAMA_MODEL=llama3.2:3b
CLOUDFLARE_TUNNEL_TOKEN=${cleanToken}
N8N_USER=abukawser
N8N_PASSWORD=growbig100_secure_pass`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            04. Self-Hosted Ubuntu 24.04 Docker Stack · Ollama Local Open-Source LLM · n8n Workflow · abukawser.xyz Tunnel
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Ubuntu 24.04 Docker, n8n & Cloudflare Tunnel Kit
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 max-w-3xl">
            Configured for your Cloudflare Tunnel GrowPilot (ID: 8f0db1e0-1a9b-4d7b-9bcc-bc314a1c880e) on Ubuntu 24.04 LTS (64-bit) with Ollama (llama3.2:3b) and self-hosted n8n.
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
            Step 01 · Your Tunnel Is Created
          </div>
          <h2 className="font-display text-sm font-bold text-slate-900">
            GrowPilot · 8f0db1e0-1a9b-4d7b-9bcc-bc314a1c880e
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your Cloudflare screenshot shows Debian 64-bit selected—which works natively on Ubuntu 24.04 LTS. Run the 2 commands shown on your screen so Connection Status turns green.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
          <div className="text-xs font-mono font-semibold text-teal-800">
            Step 02 · Start GrowPilot + n8n Locally
          </div>
          <h2 className="font-display text-sm font-bold text-slate-900">
            Port 3000 (Agent) & Port 5678 (n8n)
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Run npm run dev (or docker compose up -d) on your Ubuntu 24.04 machine so GrowPilot listens on localhost:3000 and n8n listens on localhost:5678.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
          <div className="text-xs font-mono font-semibold text-teal-800">
            Step 03 · Map Public Hostnames Next
          </div>
          <h2 className="font-display text-sm font-bold text-slate-900">
            abukawser.xyz → HTTP://localhost:3000
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Click Next at the bottom of the Cloudflare screen to open Public Hostnames, then point abukawser.xyz (or gtm.abukawser.xyz) to HTTP localhost:3000.
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
              aria-selected={activeDocTab === 'cloudflare-tunnel'}
              onClick={() => setActiveDocTab('cloudflare-tunnel')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeDocTab === 'cloudflare-tunnel'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Cloudflare Tunnel (GrowPilot)
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

        {activeDocTab === 'cloudflare-tunnel' ? (
          <div className="space-y-5">
            {/* Tunnel Identity Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div>
                <div className="text-[11px] font-medium text-slate-500">Tunnel Name</div>
                <div className="text-sm font-mono font-bold text-slate-900 mt-0.5">GrowPilot</div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-500">Tunnel ID</div>
                <div className="text-sm font-mono font-bold text-teal-800 mt-0.5">
                  8f0db1e0-1a9b-4d7b-9bcc-bc314a1c880e
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-500">Ubuntu 24.04 Target</div>
                <div className="text-sm font-mono font-semibold text-slate-900 mt-0.5">
                  Debian 64-bit / Docker
                </div>
              </div>
            </div>

            {/* Mode Selector & Token Input */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              <div className="lg:col-span-5">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1. Choose How to Run cloudflared on Ubuntu 24.04
                </label>
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTunnelMode('ubuntu-native')}
                    className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      tunnelMode === 'ubuntu-native'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Debian 64-bit (Matches Screenshot)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTunnelMode('docker')}
                    className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      tunnelMode === 'docker'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Inside Docker Compose
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7">
                <label
                  htmlFor="cf-tunnel-token"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  2. Optional: Paste Your Tunnel Token (eyJhIjoi...MyJ9) to Pre-Fill Commands Locally
                </label>
                <input
                  id="cf-tunnel-token"
                  type="text"
                  value={tunnelTokenInput}
                  onChange={(e) => setTunnelTokenInput(e.target.value)}
                  placeholder="eyJhIjoi**********************MyJ9"
                  className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            {tunnelMode === 'ubuntu-native' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    Ubuntu 24.04 Terminal Commands (Debian 64-bit Service or Manual Run)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(ubuntuNativeCommands, 'cf-native')}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                  >
                    {copiedKey === 'cf-native' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Copied Commands
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Ubuntu Commands
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed rounded-xl overflow-x-auto">
                  {ubuntuNativeCommands}
                </pre>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    Generated .env File for docker compose up -d
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(dockerEnvContent, 'cf-docker-env')}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                  >
                    {copiedKey === 'cf-docker-env' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Copied .env
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy .env Content
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed rounded-xl overflow-x-auto">
                  {dockerEnvContent}
                </pre>
              </div>
            )}

            {/* Next Screen in Cloudflare: Public Hostname Routing Table */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  3. What to Enter on the Next Screen in Cloudflare (&ldquo;Route Tunnel / Public Hostnames&rdquo;)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Once Connection Status at the bottom of your Cloudflare page shows Connected, click Next and add these Public Hostname routes for abukawser.xyz:
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                      <th className="py-2 pr-4">Subdomain</th>
                      <th className="py-2 px-3">Domain</th>
                      <th className="py-2 px-3">Service Type</th>
                      <th className="py-2 px-3">
                        URL ({tunnelMode === 'ubuntu-native' ? 'Ubuntu Native' : 'Docker Network'})
                      </th>
                      <th className="py-2 pl-3">What It Serves</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    <tr>
                      <td className="py-2.5 pr-4 font-semibold text-slate-900">
                        @ (leave blank) or gtm
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">abukawser.xyz</td>
                      <td className="py-2.5 px-3 text-teal-800 font-semibold">HTTP</td>
                      <td className="py-2.5 px-3 text-slate-900 font-semibold">
                        {tunnelMode === 'ubuntu-native'
                          ? 'localhost:3000'
                          : 'growpilot-agent:3000'}
                      </td>
                      <td className="py-2.5 pl-3 font-sans text-slate-600">
                        GrowPilot GTM Pipeline & 24/7 AI Agent Workbench
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-4 font-semibold text-slate-900">agent</td>
                      <td className="py-2.5 px-3 text-slate-700">abukawser.xyz</td>
                      <td className="py-2.5 px-3 text-teal-800 font-semibold">HTTP</td>
                      <td className="py-2.5 px-3 text-slate-900 font-semibold">
                        {tunnelMode === 'ubuntu-native' ? 'localhost:5678' : 'n8n:5678'}
                      </td>
                      <td className="py-2.5 pl-3 font-sans text-slate-600">
                        Self-Hosted n8n Webhook & Automation Builder
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Permanent Fix for 404 DEPLOYMENT_NOT_FOUND (bom1:: Vercel DNS Conflict) */}
            <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-900">
                    Troubleshooting · 404 DEPLOYMENT_NOT_FOUND (bom1::...)
                  </span>
                  <h3 className="font-display text-sm font-bold text-slate-900 mt-0.5">
                    Why agent.abukawser.xyz &amp; gtm.abukawser.xyz Show Vercel&rsquo;s 404 Error (And How to Fix Permanently)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      '8f0db1e0-1a9b-4d7b-9bcc-bc314a1c880e.cfargotunnel.com',
                      'cf-cname-target'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-950 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedKey === 'cf-cname-target' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Copied Tunnel CNAME Target
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Tunnel CNAME Target
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                The error <span className="font-mono font-semibold text-slate-900">404 DEPLOYMENT_NOT_FOUND (bom1::...)</span> comes from <strong>Vercel&rsquo;s Mumbai server</strong>, not Cloudflare or Ubuntu. It happens because a wildcard <span className="font-mono font-semibold">*</span> record or Vercel nameserver is still routing <span className="font-mono">*.abukawser.xyz</span> to Vercel instead of your Cloudflare Tunnel. Follow these 3 steps to fix it permanently:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-1">
                  <div className="font-mono font-bold text-slate-900">
                    Fix 1 · Check Nameservers
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    If your domain registrar uses <span className="font-mono">ns1.vercel-dns.com</span>, change Nameservers to your 2 Cloudflare nameservers (<span className="font-mono">*.ns.cloudflare.com</span>) so Cloudflare controls DNS.
                  </p>
                </div>

                <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-1">
                  <div className="font-mono font-bold text-slate-900">
                    Fix 2 · Delete Wildcard (*) to Vercel
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    In Cloudflare <strong>DNS &rarr; Records</strong>, delete any <span className="font-mono">*</span>, <span className="font-mono">agent</span>, or <span className="font-mono">gtm</span> record pointing to <span className="font-mono">cname.vercel-dns.com</span> or <span className="font-mono">76.76.21.21</span>. Keep only <span className="font-mono">@</span> and <span className="font-mono">www</span> on Vercel for your portfolio.
                  </p>
                </div>

                <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-1">
                  <div className="font-mono font-bold text-slate-900">
                    Fix 3 · Point CNAME to Your Tunnel
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    In Cloudflare Tunnel <strong>Public Hostnames</strong> (or DNS Records), set <span className="font-mono">gtm</span> and <span className="font-mono">agent</span> as Proxied CNAMEs to <span className="font-mono font-semibold text-teal-800">8f0db1e0-1a9b-4d7b-9bcc-bc314a1c880e.cfargotunnel.com</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 overflow-x-auto max-h-[540px]">
            <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {activeDocTab === 'docker-compose' && DOCKER_COMPOSE_UBUNTU_YAML}
              {activeDocTab === 'n8n-json' && N8N_WORKFLOW_EXPORT_JSON}
              {activeDocTab === 'short-docs' && UBUNTU_SHORT_RUNBOOK_MD}
              {activeDocTab === 'application-email' && GROWBIG100_APPLICATION_EMAIL}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
};
