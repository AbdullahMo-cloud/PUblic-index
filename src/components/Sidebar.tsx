import React, { useState, useEffect, useRef } from 'react';
import { NavTab } from '../types/ccf';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  count2026?: number;
  countBacklog?: number;
  countOnTarget?: number;
  countCompiled?: number;
  countExternal?: number;
}

interface MenuItem {
  id: NavTab;
  t: string;
  i: 'trend' | 'globe' | 'layers' | 'box' | 'chip' | 'users' | 'db' | 'sheet' | 'calc' | 'target' | 'compiled' | 'diagram' | 'presentation';
  badgeKey?: '2026' | 'backlog' | 'external' | 'on-target' | 'compiled';
  isMutedBadge?: boolean;
}

interface MenuSection {
  s: string;
  items: MenuItem[];
}

const MENU: MenuSection[] = [
  {
    s: 'KPIS & METHODOLOGY',
    items: [
      { id: 'internal-kpi', t: 'Internal CCF KPI', i: 'trend' },
      { id: 'external-kpi', t: 'External CCF KPI', i: 'globe' },
      { id: 'weekly-review', t: 'Weekly Review', i: 'presentation' },
    ],
  },
  {
    s: 'TRACKERS',
    items: [
      { id: 'tracker-2026', t: '2026 CCF Tracker', i: 'layers', badgeKey: '2026' },
      { id: 'tracker-backlog', t: 'Backlog CCF Tracker', i: 'box', badgeKey: 'backlog', isMutedBadge: true },
      { id: 'tracker-on-target', t: 'On-Target CCF Tracker', i: 'target', badgeKey: 'on-target' },
      { id: 'tracker-compiled', t: 'Compiled Cases (3 Sources)', i: 'compiled', badgeKey: 'compiled' },
      { id: 'tracker-external', t: 'External CCF Tracker', i: 'chip', badgeKey: 'external' },
    ],
  },
  {
    s: 'ADMIN & SYSTEM',
    items: [
      { id: 'user-allocations', t: 'User Allocations & HOD', i: 'users' },
      { id: 'database-engine', t: 'Storage & Database', i: 'db' },
      { id: 'sheet-engine', t: 'Spreadsheet Engine', i: 'sheet' },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  count2026 = 0,
  countBacklog = 0,
  countOnTarget = 0,
  countCompiled = 0,
  countExternal = 0,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ccf-collapsed') === '1' || window.innerWidth < 800;
    } catch {
      return false;
    }
  });

  const sideRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  // Spotlight light-follow effect
  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!sideRef.current) return;
    const r = sideRef.current.getBoundingClientRect();
    sideRef.current.style.setProperty('--mx', `${e.clientX - r.left}px`);
    sideRef.current.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync collapsed state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ccf-collapsed', isCollapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [isCollapsed]);

  // Update sliding pill position
  useEffect(() => {
    const updatePill = () => {
      if (!navRef.current || !pillRef.current) return;
      const activeEl = navRef.current.querySelector<HTMLButtonElement>(`button[data-id="${currentTab}"]`);
      if (activeEl && activeEl.style.display !== 'none') {
        pillRef.current.style.opacity = '1';
        pillRef.current.style.transform = `translateY(${activeEl.offsetTop}px)`;
      } else {
        pillRef.current.style.opacity = '0';
      }
    };

    updatePill();
    const timer = setTimeout(updatePill, 100);
    const timer2 = setTimeout(updatePill, 380); // After collapse transition
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [currentTab, isCollapsed]);

  const getBadgeValue = (badgeKey?: '2026' | 'backlog' | 'external' | 'on-target' | 'compiled') => {
    if (!badgeKey) return null;
    let val = 0;
    if (badgeKey === '2026') val = count2026;
    if (badgeKey === 'backlog') val = countBacklog;
    if (badgeKey === 'on-target') val = countOnTarget;
    if (badgeKey === 'compiled') val = countCompiled;
    if (badgeKey === 'external') val = countExternal;
    return val > 0 ? val : null;
  };

  const renderIconSvg = (iconType: MenuItem['i']) => {
    switch (iconType) {
      case 'trend':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17l6-6 4 4 8-8" />
            <path d="M15 7h6v6" />
          </svg>
        );
      case 'globe':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
          </svg>
        );
      case 'layers':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l9 5-9 5-9-5 9-5z" />
            <path d="M3 13l9 5 9-5" />
          </svg>
        );
      case 'box':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="5" rx="1.5" />
            <path d="M5 9v10h14V9M10 13h4" />
          </svg>
        );
      case 'target':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1.5" />
          </svg>
        );
      case 'compiled':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="5" rx="1" />
            <rect x="3" y="10" width="18" height="5" rx="1" />
            <rect x="3" y="17" width="18" height="5" rx="1" />
          </svg>
        );
      case 'chip':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="7" y="7" width="10" height="10" rx="2" />
            <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
          </svg>
        );
      case 'users':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6" />
          </svg>
        );
      case 'db':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5.5" rx="8" ry="3" />
            <path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
          </svg>
        );
      case 'sheet':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
            <path d="M14 3v5h5M9 13h6M9 17h6" />
          </svg>
        );
      case 'calc':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="3" width="14" height="18" rx="2.5" />
            <path d="M9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" />
          </svg>
        );
      case 'diagram':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="6" height="6" rx="1.5" />
            <rect x="15" y="3" width="6" height="6" rx="1.5" />
            <rect x="9" y="15" width="6" height="6" rx="1.5" />
            <path d="M6 9v3a1 1 0 001 1h10a1 1 0 001-1V9M12 13v2" />
          </svg>
        );
      case 'presentation':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h20" />
            <path d="M21 3v11a2 2 0 01-2 2H5a2 2 0 01-2-2V3" />
            <path d="M7 21l5-5 5 5" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <aside
      ref={sideRef}
      className={`side ${isCollapsed ? 'collapsed' : ''}`}
      id="side"
      onPointerMove={handlePointerMove}
    >
      {/* Top Header: Official Etisalat Swirl vector emblem and wordmark */}
      <div className="head">
        <div className="logo" title="etisalat">
          {/* Authentic Etisalat Emblem matching image.png */}
          <svg
            width="28"
            height="21"
            viewBox="82 -1 108 82"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0"
          >
            <path
              d="M188.26,12.95c-2.32-8.25-16.14-14.83-34.51-12.47-27.09,3.5-49.39,19.09-52.97,37.64,8.6-11.89,24.54-19.55,43.69-23.33,13.48-2.66,19.04.21,19.87,3.23,1.87,6.7-11.18,16.29-40.43,23.85-14.22,3.67-31.41,5.6-41.47,5.96,10.6,8.75,32.56,9.47,56.51,3.27,30.67-7.93,53.28-24.03,49.32-38.13h0Z"
              fill="#E30613"
            />
            <path
              d="M147.87,65.37c-14.95,1.92-29.58.56-43.14-3.53,10.64,12.69,27.31,19.87,44.94,17.6,17.65-2.26,31.95-13.42,39.03-28.38-12.08,7.38-25.89,12.39-40.85,14.32h.01Z"
              fill="#E30613"
            />
          </svg>
        </div>
        <div className="brand">
          <span className="font-black text-[#E30613] text-[20px] tracking-tight leading-none select-none block">
            etisalat
          </span>
          <span style={{ display: 'block', marginTop: '4px' }}>Change Factory Index</span>
        </div>
        <button
          className="iconbtn tog"
          id="tog"
          aria-label="Collapse sidebar"
          title="Collapse sidebar (Ctrl+B)"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      {/* Navigation Menu with Dynamic Smooth Pill */}
      <nav ref={navRef} id="nav" aria-label="Main Navigation">
        <div ref={pillRef} className="pill" id="pill" />

        {MENU.map((section) => (
          <React.Fragment key={section.s}>
            <div className="sec">
              <i />
              <span>{section.s}</span>
            </div>

            {section.items.map((item) => {
              const isSelected = currentTab === item.id;
              const badgeVal = getBadgeValue(item.badgeKey);

              return (
                <button
                  key={item.id}
                  className={`item ${isSelected ? 'on' : ''}`}
                  data-id={item.id}
                  data-tip={item.t}
                  data-sec={section.s}
                  onClick={() => onTabChange(item.id)}
                  aria-current={isSelected ? 'page' : undefined}
                >
                  <span className="ico">{renderIconSvg(item.i)}</span>
                  <span className="lbl">{item.t}</span>
                  {badgeVal !== null && badgeVal !== undefined && (
                    <span className={`badge ${item.isMutedBadge ? 'n' : ''}`}>{badgeVal}</span>
                  )}
                  <svg
                    className="chev"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      {/* Footer: Workspace Status & Active Badge */}
      <div className="foot">
        <div className="av" title="etisalat">
          <svg width="18" height="14" viewBox="82 -1 108 82" fill="none">
            <path d="M188.26,12.95c-2.32-8.25-16.14-14.83-34.51-12.47-27.09,3.5-49.39,19.09-52.97,37.64,8.6-11.89,24.54-19.55,43.69-23.33,13.48-2.66,19.04.21,19.87,3.23,1.87,6.7-11.18,16.29-40.43,23.85-14.22,3.67-31.41,5.6-41.47,5.96,10.6,8.75,32.56,9.47,56.51,3.27,30.67-7.93,53.28-24.03,49.32-38.13h0Z" fill="#E30613" />
            <path d="M147.87,65.37c-14.95,1.92-29.58.56-43.14-3.53,10.64,12.69,27.31,19.87,44.94,17.6,17.65-2.26,31.95-13.42,39.03-28.38-12.08,7.38-25.89,12.39-40.85,14.32h.01Z" fill="#E30613" />
          </svg>
        </div>
        <div className="who">
          etisalat CCF
          <small>Workspace</small>
        </div>
        <div className="live">
          <i />
          <span>Active</span>
        </div>
      </div>
    </aside>
  );
};
