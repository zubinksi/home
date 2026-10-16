import { useEffect, useState } from 'react';

export const TABS = [
  { id: 'investments', label: 'INVESTMENTS' },
  { id: 'projects', label: 'PROJECTS' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

function fromHash(): TabId {
  const h = location.hash.replace(/^#\/?/, '');
  return TABS.some((t) => t.id === h) ? (h as TabId) : 'investments';
}

/** Current tab, kept in the URL hash so refresh and Back keep your place. */
export function useTab(): [TabId, (t: TabId) => void] {
  const [tab, setTab] = useState<TabId>(fromHash);
  useEffect(() => {
    const onHash = () => setTab(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (t: TabId) => {
    if (t === tab) return;
    location.hash = `/${t}`;
    window.scrollTo(0, 0);
  };
  return [tab, go];
}

export function NavBar({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      <div className="tabbar-inner">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'is-sel' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => onChange(t.id)}
          >
            <span className="tab-caret">&gt;</span>
            <span className="tab-name">{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
