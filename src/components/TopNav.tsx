import React from 'react';

export type ActiveTabId = 'gtm-studio' | 'whatsapp-agent' | 'cost-lab';

interface TopNavProps {
  activeTab: ActiveTabId;
  onSelectTab: (tab: ActiveTabId) => void;
}

const NAV_ITEMS: { id: ActiveTabId; label: string }[] = [
  { id: 'gtm-studio', label: 'GTM Pipeline' },
  { id: 'whatsapp-agent', label: '24/7 FAQ & Booking Agent' },
  { id: 'cost-lab', label: 'Token & Cost Lab' },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const isOnAgentTab = activeTab === 'whatsapp-agent';

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6">
      <div className="max-w-[1360px] mx-auto h-full flex items-center justify-between gap-4">
        {/* Zone 1: Brand Identity */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('gtm-studio');
          }}
          className="flex items-center gap-2.5 text-slate-900 hover:opacity-90 transition-opacity shrink-0"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
          <span className="font-display text-lg font-bold tracking-tight">
            GrowPilot
          </span>
          <span className="hidden sm:inline-block text-xs font-medium text-slate-400 border-l border-slate-200 pl-2.5">
            AI Agent &amp; GTM Engine
          </span>
        </a>

        {/* Zone 2: Primary 3-Tab View Switcher */}
        <nav
          role="tablist"
          aria-label="Primary Workspace Views"
          className="hidden md:flex items-center gap-6"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => onSelectTab(item.id)}
                className={`py-5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-teal-700 text-teal-800 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Quick Agent / Pipeline Action Switch */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() =>
              onSelectTab(isOnAgentTab ? 'gtm-studio' : 'whatsapp-agent')
            }
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-teal-700 text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isOnAgentTab ? 'Open GTM Pipeline' : 'Open 24/7 Agent'}
          </button>
        </div>
      </div>
    </header>
  );
};
