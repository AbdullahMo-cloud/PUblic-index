import React, { useState, useMemo } from 'react';
import { CcfAggregateStats, OwnerIndexSummary } from '../types/ccf';
import { KpiCards } from './KpiCards';
import { ExecutiveAnalyticsCharts } from './ExecutiveAnalyticsCharts';
import { HodAnalyticsGraph } from './HodAnalyticsGraph';
import { ChangeFactoryIndexTable } from './ChangeFactoryIndexTable';
import {
  Layers,
  Archive,
  Sparkles,
  ArrowRight,
  Download,
  Filter,
  Users,
  User,
  X,
  Camera,
  CheckCircle2,
  Building,
  RotateCcw,
} from 'lucide-react';
import { exportInternalCfiReport, captureElementToPng } from '../utils/reportExport';
import { calculateChangeFactoryIndex } from '../utils/dataParser';
import { EtisalatLogo } from './EtisalatLogo';

interface InternalKpiDashboardProps {
  stats: CcfAggregateStats;
  summaries: OwnerIndexSummary[];
  onSelectOwner: (owner: string, tracker?: '2026' | 'backlog' | 'compiled' | 'on-target', onlyEligible?: boolean) => void;
  onSelectHod?: (hod: string, onlyEligible?: boolean) => void;
  onNavigateTo2026Tracker: (onlyEligible?: boolean) => void;
  onNavigateToBacklogTracker: (onlyEligible?: boolean) => void;
  onNavigateToCompiledTracker?: (onlyEligible?: boolean) => void;
  onNavigateToOnTargetTracker?: () => void;
  onFilterNewCases?: () => void;
  onFilterOldCases?: () => void;
}

export const InternalKpiDashboard: React.FC<InternalKpiDashboardProps> = ({
  stats,
  summaries,
  onSelectOwner,
  onSelectHod,
  onNavigateTo2026Tracker,
  onNavigateToBacklogTracker,
  onNavigateToCompiledTracker,
  onNavigateToOnTargetTracker,
  onFilterNewCases,
  onFilterOldCases,
}) => {
  // Filter states for HOD and Owner above KPI Cards
  const [selectedHod, setSelectedHod] = useState<string>('ALL');
  const [selectedOwner, setSelectedOwner] = useState<string>('ALL');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Unique sorted list of HODs from summaries
  const hodList = useMemo(() => {
    const set = new Set<string>();
    summaries.forEach((s) => {
      if (s.hod && s.hod.trim()) {
        set.add(s.hod.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [summaries]);

  // List of owners available, scoped to selected HOD if chosen
  const ownerList = useMemo(() => {
    const list = selectedHod === 'ALL'
      ? summaries
      : summaries.filter((s) => s.hod?.toLowerCase() === selectedHod.toLowerCase());

    return list
      .map((s) => ({ owner: s.owner, hod: s.hod }))
      .sort((a, b) => a.owner.localeCompare(b.owner));
  }, [summaries, selectedHod]);

  // Handle HOD Dropdown Change
  const handleHodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHod = e.target.value;
    setSelectedHod(newHod);

    // If a specific owner was selected that does not belong to the newly selected HOD, reset owner to ALL
    if (newHod !== 'ALL' && selectedOwner !== 'ALL') {
      const isOwnerInNewHod = summaries.some(
        (s) => s.owner.toLowerCase() === selectedOwner.toLowerCase() && s.hod?.toLowerCase() === newHod.toLowerCase()
      );
      if (!isOwnerInNewHod) {
        setSelectedOwner('ALL');
      }
    }
  };

  // Handle Owner Dropdown Change
  const handleOwnerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOwner = e.target.value;
    setSelectedOwner(newOwner);

    // If an owner was picked, auto-sync the HOD dropdown to that owner's HOD
    if (newOwner !== 'ALL') {
      const found = summaries.find((s) => s.owner.toLowerCase() === newOwner.toLowerCase());
      if (found && found.hod) {
        setSelectedHod(found.hod);
      }
    }
  };

  // Reset filter back to organisation-wide
  const handleResetFilters = () => {
    setSelectedHod('ALL');
    setSelectedOwner('ALL');
  };

  // Calculate dynamic stats for the KPI Cards based on HOD / Owner selection
  const activeStats: CcfAggregateStats = useMemo(() => {
    // 1. SPECIFIC OWNER FILTERED
    if (selectedOwner !== 'ALL') {
      const ownerSummary = summaries.find(
        (s) => s.owner.toLowerCase() === selectedOwner.toLowerCase()
      );
      if (ownerSummary) {
        return {
          totalCases: ownerSummary.newCasesCount + ownerSummary.oldCasesCount + ownerSummary.onTargetCount,
          newCasesTotal: ownerSummary.newCasesCount,
          newCasesDenominator: ownerSummary.newCasesDenominator,
          newCasesWithinSla: ownerSummary.newCasesWithinSla,
          newCasesSlaPct: ownerSummary.newCasesPct,
          oldCasesTotal: ownerSummary.oldCasesCount,
          oldCasesWithinSla: ownerSummary.oldCasesWithinSla,
          oldCasesSlaPct: ownerSummary.oldCasesPct,
          onTargetCompletionCount: ownerSummary.onTargetCompleted,
          onTargetTotal: ownerSummary.onTargetCount,
          onTargetCompletionPct: ownerSummary.onTargetPct,
          completedCount: ownerSummary.newCasesWithinSla + ownerSummary.oldCasesWithinSla,
          forMonitoringCount: 0,
          overallIndex: ownerSummary.changeFactoryIndex,
          targetIndex: 80,
        };
      }
    }

    // 2. SPECIFIC HOD FILTERED (ALL OWNERS UNDER HOD)
    if (selectedHod !== 'ALL') {
      const hodSummaries = summaries.filter(
        (s) => s.hod?.toLowerCase() === selectedHod.toLowerCase()
      );

      let newCount = 0;
      let newDenom = 0;
      let newWithin = 0;
      let oldCount = 0;
      let oldWithin = 0;
      let onTargetCount = 0;
      let onTargetDone = 0;

      hodSummaries.forEach((s) => {
        newCount += s.newCasesCount;
        newDenom += s.newCasesDenominator;
        newWithin += s.newCasesWithinSla;
        oldCount += s.oldCasesCount;
        oldWithin += s.oldCasesWithinSla;
        onTargetCount += s.onTargetCount;
        onTargetDone += s.onTargetCompleted;
      });

      const newCasesSlaPct = newDenom > 0 ? Math.round((newWithin / newDenom) * 100) : 0;
      const oldCasesSlaPct = oldCount > 0 ? Math.round((oldWithin / oldCount) * 100) : 0;
      const onTargetCompletionPct = onTargetCount > 0 ? Math.round((onTargetDone / onTargetCount) * 100) : 0;

      const hasNew = newDenom > 0;
      const newRate = hasNew ? newWithin / newDenom : null;
      const hasOld = oldCount > 0;
      const oldRate = hasOld ? oldWithin / oldCount : null;
      const hasOnTarget = onTargetCount > 0;
      const onTargetRate = hasOnTarget ? onTargetDone / onTargetCount : null;

      const overallIndex = calculateChangeFactoryIndex(
        hasNew,
        newRate,
        hasOld,
        oldRate,
        hasOnTarget,
        onTargetRate
      );

      return {
        totalCases: newCount + oldCount + onTargetCount,
        newCasesTotal: newCount,
        newCasesDenominator: newDenom,
        newCasesWithinSla: newWithin,
        newCasesSlaPct,
        oldCasesTotal: oldCount,
        oldCasesWithinSla: oldWithin,
        oldCasesSlaPct,
        onTargetCompletionCount: onTargetDone,
        onTargetTotal: onTargetCount,
        onTargetCompletionPct,
        completedCount: newWithin + oldWithin,
        forMonitoringCount: 0,
        overallIndex,
        targetIndex: 80,
      };
    }

    // 3. DEFAULT: ALL ORGANISATION
    return stats;
  }, [stats, summaries, selectedHod, selectedOwner]);

  const isFiltered = selectedHod !== 'ALL' || selectedOwner !== 'ALL';

  // Active filter label description
  const filterDescription = useMemo(() => {
    if (selectedOwner !== 'ALL') {
      const match = summaries.find((s) => s.owner.toLowerCase() === selectedOwner.toLowerCase());
      return {
        title: `Owner: ${selectedOwner}`,
        subtitle: `HOD: ${match?.hod || 'General'} • Individual Performance`,
        badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
        index: activeStats.overallIndex,
        totalCases: activeStats.totalCases,
        scopeType: 'Owner' as const,
      };
    }
    if (selectedHod !== 'ALL') {
      const teamCount = summaries.filter((s) => s.hod?.toLowerCase() === selectedHod.toLowerCase()).length;
      return {
        title: `HOD: ${selectedHod}`,
        subtitle: `${teamCount} Team Assignees • Department Aggregate`,
        badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
        index: activeStats.overallIndex,
        totalCases: activeStats.totalCases,
        scopeType: 'HOD' as const,
      };
    }
    return {
      title: 'Organization Wide',
      subtitle: `All HODs & ${summaries.length} Owners • Global Executive Scope`,
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
      index: stats.overallIndex,
      totalCases: stats.totalCases,
      scopeType: 'All' as const,
    };
  }, [selectedHod, selectedOwner, summaries, activeStats, stats]);

  // Capture screenshot of the cards container
  const handleDownloadSnapshot = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    try {
      const dataUrl = await captureElementToPng('internal-kpi-cards-screenshot-area');
      if (dataUrl) {
        const link = document.createElement('a');
        const filename = selectedOwner !== 'ALL'
          ? `etisalat_KPI_Cards_Owner_${selectedOwner.replace(/\s+/g, '_')}`
          : selectedHod !== 'ALL'
          ? `etisalat_KPI_Cards_HOD_${selectedHod.replace(/\s+/g, '_')}`
          : 'etisalat_KPI_Cards_Organization_Wide';
        link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Failed to capture cards screenshot:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Quick Actions Bar (Etisalat Corporate Red Accent) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>Internal CCF Executive KPIs</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 font-semibold lowercase">
              etisalat standard
            </span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportInternalCfiReport(stats, summaries)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#E2001A] hover:bg-[#C80017] text-white font-sans text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Download Internal CCF KPI Executive Governance Report (HTML/PDF)"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Download Report</span>
          </button>

          {onNavigateToCompiledTracker && (
            <button
              onClick={() => onNavigateToCompiledTracker(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-800 dark:text-rose-300 bg-rose-50/90 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/80 dark:border-rose-800/60 rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Compiled Cases (3 Sources)</span>
              <ArrowRight className="w-3 h-3 text-rose-500" />
            </button>
          )}

          <button
            onClick={() => onNavigateTo2026Tracker(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-800 dark:text-red-300 bg-red-50/90 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200/80 dark:border-red-800/60 rounded-xl transition-all shadow-2xs cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span>2026 Tracker</span>
            <ArrowRight className="w-3 h-3 text-red-500" />
          </button>

          <button
            onClick={() => onNavigateToBacklogTracker(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50/90 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200/80 dark:border-amber-800/60 rounded-xl transition-all shadow-2xs cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Backlog Tracker</span>
            <ArrowRight className="w-3 h-3 text-amber-500" />
          </button>
        </div>
      </div>

      {/* 🟢 DROPDOWN FILTER BAR ABOVE KPI CARDS (HOD & OWNER FILTER SELECTORS) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-red-50 dark:bg-red-950/70 text-[#E2001A] border border-red-200/80 dark:border-red-900/80 shrink-0">
              <Filter className="w-4 h-4 text-[#E2001A]" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  KPI Cards Filter &amp; Scope
                </span>
                {isFiltered && (
                  <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 font-mono text-[10px] font-bold border border-red-300 dark:border-red-800 animate-pulse">
                    Filtered Scope Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Filter the 4 executive KPI cards by HOD or Owner to evaluate individual or team metrics (ideal for targeted review &amp; screenshots).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSnapshot}
              disabled={isCapturing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-sans text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-60"
              title="Capture and download high-resolution PNG of the filtered KPI cards with etisalat watermark"
            >
              <Camera className="w-3.5 h-3.5 text-red-400" />
              <span>{isCapturing ? 'Capturing…' : 'Capture Cards PNG'}</span>
            </button>

            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer border border-slate-300 dark:border-slate-700"
                title="Reset all filters to show full organization metrics"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Show All (Reset)</span>
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Selectors Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          {/* Dropdown 1: Filter by HOD */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Filter by HOD / Team Lead:</span>
            </label>
            <div className="relative">
              <select
                value={selectedHod}
                onChange={handleHodChange}
                className="w-full appearance-none px-3 py-2 pr-8 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all cursor-pointer"
              >
                <option value="ALL">All HODs (Entire Organization)</option>
                {hodList.map((hod) => {
                  const count = summaries.filter((s) => s.hod?.toLowerCase() === hod.toLowerCase()).length;
                  return (
                    <option key={hod} value={hod}>
                      {hod} ({count} {count === 1 ? 'owner' : 'owners'})
                    </option>
                  );
                })}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Dropdown 2: Filter by Owner */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Filter by Owner / Assignee:</span>
            </label>
            <div className="relative">
              <select
                value={selectedOwner}
                onChange={handleOwnerChange}
                className="w-full appearance-none px-3 py-2 pr-8 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all cursor-pointer"
              >
                <option value="ALL">
                  {selectedHod !== 'ALL'
                    ? `All Owners under ${selectedHod} (${ownerList.length})`
                    : `All Owners (${summaries.length} Total)`}
                </option>
                {ownerList.map(({ owner, hod }) => (
                  <option key={owner} value={owner}>
                    {owner} {selectedHod === 'ALL' && hod ? `(HOD: ${hod})` : ''}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <User className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Quick Filter Status Indicator Card */}
          <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Current Cards Scope
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate block">
                {filterDescription.title}
              </span>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-950 text-[#E2001A] border border-red-200 dark:border-red-900 block">
                {activeStats.overallIndex}% CFI
              </span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                {activeStats.totalCases} cases
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 📸 SCREENSHOT-READY KPI CARDS WRAPPER */}
      <div id="internal-kpi-cards-screenshot-area" className="space-y-3 p-1">
        {/* Screenshot Header Watermark (always visible for screenshot attribution) */}
        <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-xl shadow-xs border-l-4 border-l-[#E2001A]">
          <div className="flex items-center gap-2.5">
            <EtisalatLogo size={20} />
            <div className="h-4 w-px bg-slate-700" />
            <div>
              <span className="text-xs font-bold text-white tracking-wide">
                etisalat Internal Change Factory Index (CFI) Performance Cards
              </span>
              <span className="text-[10px] text-slate-300 ml-2 font-mono">
                • {filterDescription.title} ({filterDescription.subtitle})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-300">
            <span>Benchmark: 80% Standard</span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400 font-bold">{activeStats.overallIndex}% Index</span>
            <span className="text-slate-600">|</span>
            <span>{activeStats.totalCases} Cases</span>
          </div>
        </div>

        {/* 1. 4 Executive KPI Cards (Dynamic stats based on HOD/Owner Filter) */}
        <KpiCards
          stats={activeStats}
          onNavigateTo2026={() => {
            if (selectedOwner !== 'ALL') {
              onSelectOwner(selectedOwner, '2026', false);
            } else if (selectedHod !== 'ALL' && onSelectHod) {
              onSelectHod(selectedHod, false);
            } else {
              onNavigateTo2026Tracker(false);
            }
          }}
          onNavigateToBacklog={() => {
            if (selectedOwner !== 'ALL') {
              onSelectOwner(selectedOwner, 'backlog', false);
            } else if (selectedHod !== 'ALL' && onSelectHod) {
              onSelectHod(selectedHod, false);
            } else {
              onNavigateToBacklogTracker(false);
            }
          }}
          onNavigateToCompiled={() => {
            if (selectedOwner !== 'ALL') {
              onSelectOwner(selectedOwner, 'compiled', true);
            } else if (selectedHod !== 'ALL' && onSelectHod) {
              onSelectHod(selectedHod, true);
            } else {
              onNavigateToCompiledTracker?.(true);
            }
          }}
          onNavigateToOnTarget={() => {
            if (selectedOwner !== 'ALL') {
              onSelectOwner(selectedOwner, 'on-target', false);
            } else {
              onNavigateToOnTargetTracker?.();
            }
          }}
          onFilterNewCases={() => {
            if (selectedOwner !== 'ALL') {
              onSelectOwner(selectedOwner, '2026', true);
            } else if (selectedHod !== 'ALL' && onSelectHod) {
              onSelectHod(selectedHod, true);
            } else {
              onFilterNewCases?.() ?? onNavigateTo2026Tracker(true);
            }
          }}
          onFilterOldCases={() => {
            if (selectedOwner !== 'ALL') {
              onSelectOwner(selectedOwner, 'backlog', true);
            } else if (selectedHod !== 'ALL' && onSelectHod) {
              onSelectHod(selectedHod, true);
            } else {
              onFilterOldCases?.() ?? onNavigateToBacklogTracker(true);
            }
          }}
          onFilterOnTarget={() => {
            if (selectedOwner !== 'ALL') {
              onSelectOwner(selectedOwner, 'on-target', false);
            } else {
              onNavigateToOnTargetTracker?.();
            }
          }}
        />
      </div>

      {/* 2. Owner Performance Analytics Graph */}
      <ExecutiveAnalyticsCharts
        summaries={summaries}
        onSelectOwner={onSelectOwner}
        onSelectHod={onSelectHod}
        onNavigateTo2026Tracker={onNavigateTo2026Tracker}
        onNavigateToBacklogTracker={onNavigateToBacklogTracker}
        onNavigateToCompiledTracker={onNavigateToCompiledTracker}
      />

      {/* 3. HOD Team Performance & Department Graph (Segregated dedicated graph) */}
      <HodAnalyticsGraph
        summaries={summaries}
        stats={stats}
        onSelectHod={onSelectHod}
        onSelectOwner={onSelectOwner}
        onNavigateToCompiledTracker={onNavigateToCompiledTracker}
      />

      {/* 4. Owner Level Detailed Index Summary Table */}
      <ChangeFactoryIndexTable
        summaries={summaries}
        onSelectOwner={onSelectOwner}
        onNavigateTo2026Tracker={onNavigateTo2026Tracker}
        onNavigateToBacklogTracker={onNavigateToBacklogTracker}
      />
    </div>
  );
};

