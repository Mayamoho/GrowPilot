import React from 'react';

export type ActiveTabId = 'gtm-studio' | 'whatsapp-agent' | 'cost-lab' | 'ubuntu-deploy';

interface TopNavProps {
  activeTab: ActiveTabId;
  onSelectTab: (tab: ActiveTabId) => void;
  onExportKitClick: () => void;
}

/**
 * Enforces the strict 3-zone Top Bar Contract:
 * Zone 1: Single text element wordmark (whitespace-nowrap shrink-0)
 * Zone 2: 4 concise single-line text navigation links
 * Zone 3: 1 primary action button
 */
export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onSelectTab,
  onExportKitClick,
}) => {
  const navItems: Array<{ id: ActiveTabId; label: string }> = [
    { id: 'gtm-studio', label: 'GTM Pipeline' },
    { id: 'whatsapp-agent', label: '24/7 FAQ & Qualifier' },
    { id: 'cost-lab', label: 'Prompt & Cost Lab' },
    { id: 'ubuntu-deploy', label: 'Ubuntu & n8n Kit' },
  ];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 md:gap-8 px-4 md:px-6 py-3 bg-white border-b border-slate-200">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onSelectTab('gtm-studio');
        }}
        className="font-display text-base md:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
      >
        GrowPilot
      </a>

      {/* Zone 2: 4 concise single-line text navigation links */}
      <nav
        aria-label="Workspace Navigation"
        className="hidden md:flex items-center gap-6 overflow-x-auto"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 cursor-pointer ${
                isActive
                  ? 'text-teal-700 border-teal-600 font-semibold'
                  : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onExportKitClick}
          className="px-3.5 md:px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Export n8n & Docker Kit
        </button>
      </div>
    </header>
  );
};
