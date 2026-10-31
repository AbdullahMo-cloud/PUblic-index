import React, { useState, useMemo } from 'react';
import { OwnerIndexSummary, CcfAggregateStats } from '../types/ccf';
import { calculateChangeFactoryIndex } from '../utils/dataParser';
import {
  Users,
  Award,
  Layers,
  Archive,
  Target,
  ArrowRight,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ChevronRight,
  User,
} from 'lucide-react';

interface HodAnalyticsGraphProps {
  summaries: OwnerIndexSummary[];
  stats: CcfAggregateStats;
  onSelectHod?: (hod: string, onlyEligible?: boolean) => void;
  onSelectOwner?: (owner: string, tracker?: '2026' | 'backlog' | 'compiled', onlyEligible?: boolean) => void;
  onNavigateToCompiledTracker?: (onlyEligible?: boolean) => void;
}

type HodChartTab = 'index-ranking' | 'new-cases' | 'old-cases' | 'on-target';

export const HodAnalyticsGraph: React.FC<HodAnalyticsGraphProps> = ({
  summaries,
  stats,
  onSelectHod,
  onSelectOwner,
  onNavigateToCompiledTracker,
}) => {
  const [activeTab, setActiveTab] = useState<HodChartTab>('index-ranking');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [hoveredHod, setHoveredHod] = useState<string | null>(null);
  const [expandedHod, setExpandedHod] = useState<string | null>(null);

  // Compute aggregated department metrics across summaries
  const hodMetrics = useMemo(() => {
    const map: Record<
      string,
      {
        hod: string;
        owners: OwnerIndexSummary[];
        ownersCount: number;
        totalNewCases: number;
        totalNewDenominator: number;
        newWithinSla: number;
        totalOldCases: number;
        oldWithinSla: number;
        totalOnTargetCount: number;
        totalOnTargetCompleted: number;
      }
    > = {};

    summaries.forEach((s) => {
      const h = s.hod || 'General';
      if (!map[h]) {
        map[h] = {
          hod: h,
          owners: [],
          ownersCount: 0,
          totalNewCases: 0,
          totalNewDenominator: 0,
          newWithinSla: 0,
          totalOldCases: 0,
          oldWithinSla: 0,
          totalOnTargetCount: 0,
          totalOnTargetCompleted: 0,
        };
      }
      map[h].owners.push(s);
      map[h].ownersCount += 1;
      map[h].totalNewCases += s.newCasesCount;
      map[h].totalNewDenominator += s.newCasesDenominator;
      map[h].newWithinSla += s.newCasesWithinSla;
      map[h].totalOldCases += s.oldCasesCount;
      map[h].oldWithinSla += s.oldCasesWithinSla;
      map[h].totalOnTargetCount += s.onTargetCount;
      map[h].totalOnTargetCompleted += s.onTargetCompleted;
    });

    return Object.values(map)
      .map((item) => {
        const newPct =
          item.totalNewDenominator > 0 ? Math.round((item.newWithinSla / item.totalNewDenominator) * 100) : 0;
        const oldPct =
          item.totalOldCases > 0 ? Math.round((item.oldWithinSla / item.totalOldCases) * 100) : 0;
        const onTargetPct =
          item.totalOnTargetCount > 0 ? Math.round((item.totalOnTargetCompleted / item.totalOnTargetCount) * 100) : 0;

        const hasNew = item.totalNewDenominator > 0;
        const newRate = hasNew ? item.newWithinSla / item.totalNewDenominator : null;
        const hasOld = item.totalOldCases > 0;
        const oldRate = hasOld ? item.oldWithinSla / item.totalOldCases : null;
        const hasOnTarget = item.totalOnTargetCount > 0;
        const onTargetRate = hasOnTarget ? item.totalOnTargetCompleted / item.totalOnTargetCount : null;

        // Exact official Change Factory Index formula matching KPI and owners:
        const hodIndex = calculateChangeFactoryIndex(
          hasNew,
          newRate,
          hasOld,
          oldRate,
          hasOnTarget,
          onTargetRate
        );

        // Sort owners inside this HOD by their changeFactoryIndex
        item.owners.sort((a, b) => b.changeFactoryIndex - a.changeFactoryIndex);

        return {
          ...item,
          hodIndex,
          newPct,
          oldPct,
          onTargetPct,
          totalVolume: item.totalNewCases + item.totalOldCases + item.totalOnTargetCount,
        };
      })
      .sort((a, b) => b.hodIndex - a.hodIndex);
  }, [summaries]);

  // Overall HOD summary stats - exactly matches KPI formula
  const overallStats = useMemo(() => {
    const topDepartment = [...hodMetrics].sort((a, b) => b.hodIndex - a.hodIndex)[0];
    const totalCases = hodMetrics.reduce((acc, m) => acc + m.totalVolume, 0);
    return {
      topDepartment,
      totalCases,
      totalDepts: hodMetrics.length,
    };
  }, [hodMetrics]);

  // Sortings for specific tabs
  const sortedByIndex = useMemo(() => {
    return [...hodMetrics].sort((a, b) => b.hodIndex - a.hodIndex);
  }, [hodMetrics]);

  const sortedByNewCases = useMemo(() => {
    return [...hodMetrics].sort((a, b) => b.totalNewCases - a.totalNewCases || b.newPct - a.newPct);
  }, [hodMetrics]);

  const sortedByOldCases = useMemo(() => {
    return [...hodMetrics].sort((a, b) => b.totalOldCases - a.totalOldCases || b.oldPct - a.oldPct);
  }, [hodMetrics]);

  const maxNewCount = useMemo(() => {
    const max = Math.max(...hodMetrics.map((h) => h.totalNewCases), 1);
    return Math.max(max, 10);
  }, [hodMetrics]);

  const maxOldCount = useMemo(() => {
    const max = Math.max(...hodMetrics.map((h) => h.totalOldCases), 1);
    return Math.max(max, 10);
  }, [hodMetrics]);

  return (
    <div className="bg-white dark:bg-[#161a26] border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden transition-all duration-200">
      {/* Top Accent Stripe - Etisalat Brand Gradient */}
      <div className="h-1 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500" />

      {/* Header Container */}
      <div className="p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#121622]/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/60 flex items-center justify-center text-red-600 dark:text-red-400 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  HOD Performance Graph &amp; Department Analytics
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                  {hodMetrics.length} Departments
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Segregated department performance graphs across 2026, Backlog, and On-Target cases calculated with the Etisalat Change Factory standard.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToCompiledTracker && (
              <button
                onClick={() => onNavigateToCompiledTracker(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-800 dark:text-rose-300 bg-rose-50/90 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/80 dark:border-rose-800/60 rounded-xl transition-all shadow-2xs cursor-pointer"
                title="View all required cases segregated by HOD in Compiled Cases Hub"
              >
                <Sparkles className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Open Compiled Cases Hub</span>
                <ArrowRight className="w-3 h-3 text-rose-500" />
              </button>
            )}

            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isCollapsed ? 'Expand HOD Graph' : 'Collapse HOD Graph'}
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 4 Department Summary Metric Badges: EXACT Change Factory Index matching KPI (79%), not 59% average! */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-200/60 dark:border-white/5">
          <div className="bg-white/80 dark:bg-[#161a26]/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Change Factory Index</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-extrabold font-mono text-red-600 dark:text-red-400">
                  {stats.overallIndex}%
                </span>
                <span className="text-[10px] font-mono font-semibold text-slate-500">Target {stats.targetIndex}%</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white/80 dark:bg-[#161a26]/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Top Department</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[120px] block mt-1">
                {overallStats.topDepartment?.hod || 'N/A'} ({overallStats.topDepartment?.hodIndex || 0}%)
              </span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white/80 dark:bg-[#161a26]/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Active Departments</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {overallStats.totalDepts}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">5 Leads</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white/80 dark:bg-[#161a26]/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Total Volume</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {overallStats.totalCases}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Cases</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* View Tabs Matching the Owner Graph */}
        {!isCollapsed && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-200/60 dark:border-white/5">
            <button
              onClick={() => setActiveTab('index-ranking')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'index-ranking'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white dark:bg-[#161a26] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-50'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>HOD Index Ranking</span>
            </button>

            <button
              onClick={() => setActiveTab('new-cases')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'new-cases'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white dark:bg-[#161a26] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>New Cases: Volume &amp; SLA (CY26, 50%)</span>
            </button>

            <button
              onClick={() => setActiveTab('old-cases')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'old-cases'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white dark:bg-[#161a26] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-50'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Old Cases: Backlog &amp; SLA (&lt;2026, 40%)</span>
            </button>

            <button
              onClick={() => setActiveTab('on-target')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'on-target'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>On-Target (Target 80% • Weight 10%)</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Interactive HOD Graph Canvas - Structured exactly like Owner Graph */}
      {!isCollapsed && (
        <div className="p-5 space-y-4">
          {/* TAB 1: HOD CHANGE FACTORY INDEX RANKING (SAME VISUAL GRAPH AS OWNER) */}
          {activeTab === 'index-ranking' && (
            <div className="space-y-3">
              {/* Legend & Target Marker Info */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pb-1">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    <span>&ge; 90% (Exceeding Benchmark)</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                    <span>80% - 89% (On Target)</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    <span>&lt; 80% (Action Required)</span>
                  </span>
                </div>
                <div className="hidden md:flex items-center gap-2 font-mono text-[11px]">
                  <span>Target Threshold: 80%</span>
                </div>
              </div>

              {/* Graphical Bars */}
              <div className="space-y-3">
                {sortedByIndex.map((hm, idx) => {
                  const isHovered = hoveredHod === hm.hod;
                  const isExpanded = expandedHod === hm.hod;
                  const isExceeding = hm.hodIndex >= 90;
                  const isOnTarget = hm.hodIndex >= 80 && hm.hodIndex < 90;

                  return (
                    <div
                      key={hm.hod}
                      className={`rounded-xl border transition-all overflow-hidden ${
                        isHovered
                          ? 'bg-slate-50 dark:bg-[#1a2030] border-red-300 dark:border-red-900 shadow-xs'
                          : 'bg-white dark:bg-[#161a26]/60 border-slate-200/90 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      {/* Main HOD Bar Row */}
                      <div
                        onMouseEnter={() => setHoveredHod(hm.hod)}
                        onMouseLeave={() => setHoveredHod(null)}
                        onClick={() => onSelectHod?.(hm.hod, true)}
                        title={`Click to view required eligible cases for HOD ${hm.hod} in Compiled Cases Hub`}
                        className="p-3.5 cursor-pointer group space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-5 text-[11px] font-mono text-slate-400 font-bold">
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white text-sm truncate group-hover:text-red-600 transition-colors">
                              {hm.hod}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5 truncate">
                              {hm.ownersCount} Team Members · {hm.totalVolume} Cases
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono hidden md:inline">
                              New: {hm.totalNewDenominator > 0 ? `${hm.newPct}%` : '-'} · Backlog: {hm.totalOldCases > 0 ? `${hm.oldPct}%` : '-'} · Target: {hm.totalOnTargetCount > 0 ? `${hm.onTargetPct}%` : '10%'}
                            </span>

                            <div className="flex items-baseline gap-1 font-mono font-extrabold text-base">
                              <span
                                className={
                                  isExceeding
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : isOnTarget
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                }
                              >
                                {hm.hodIndex}%
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">INDEX</span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedHod(isExpanded ? null : hm.hod);
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title={isExpanded ? 'Hide team members' : 'View team members'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </button>

                            <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-red-500 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>

                        {/* Progress Bar Container with 80% and 90% benchmark indicators */}
                        <div className="relative h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          {/* 80% Benchmark Reference Line */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-slate-400 dark:bg-slate-500 z-10"
                            style={{ left: '80%' }}
                            title="80% Target Benchmark"
                          />
                          {/* 90% Benchmark Reference Line */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 dark:bg-emerald-600 z-10 opacity-60"
                            style={{ left: '90%' }}
                            title="90% Exceeding Benchmark"
                          />

                          {/* Animated Score Fill */}
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isExceeding
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                : isOnTarget
                                ? 'bg-gradient-to-r from-red-500 to-red-600'
                                : 'bg-gradient-to-r from-rose-500 to-amber-500'
                            }`}
                            style={{ width: `${Math.min(hm.hodIndex, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Expandable Team Members Inside This HOD */}
                      {isExpanded && (
                        <div className="px-4 py-3 bg-slate-50/80 dark:bg-[#121622]/80 border-t border-slate-100 dark:border-white/5 space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pb-1">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <User className="w-3 h-3 text-red-500" />
                              <span>Team Members under {hm.hod} ({hm.owners.length})</span>
                            </span>
                            <span>Click any member to inspect their required cases</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {hm.owners.map((ow) => {
                              return (
                                <div
                                  key={ow.owner}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectOwner?.(ow.owner, 'compiled', true);
                                  }}
                                  title={`Click to view required cases for ${ow.owner}`}
                                  className="p-2 rounded-lg bg-white dark:bg-[#161a26] border border-slate-200/80 dark:border-white/5 hover:border-red-400 dark:hover:border-red-600 transition-all cursor-pointer flex items-center justify-between gap-2 shadow-2xs group"
                                >
                                  <div className="min-w-0">
                                    <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block truncate group-hover:text-red-600 transition-colors">
                                      {ow.owner}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {ow.newCasesCount} New · {ow.oldCasesCount} Backlog
                                    </span>
                                  </div>
                                  <div className="text-right shrink-0 font-mono">
                                    <span className={`text-xs font-extrabold ${
                                      ow.changeFactoryIndex >= 80 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                                    }`}>
                                      {ow.changeFactoryIndex}%
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: HOD NEW CASES (VOLUME VS SLA %) */}
          {activeTab === 'new-cases' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  New Cases 2026 Volume (Count) vs SLA Performance (&le;90 Days) by Department
                </span>
                <span className="text-[11px] font-mono">Target: &le;90d SLA (80% Benchmark)</span>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {sortedByNewCases.map((hm) => {
                  const isHovered = hoveredHod === hm.hod;
                  const isSlaGood = hm.newPct >= 80;
                  const volumePct = Math.round((hm.totalNewCases / maxNewCount) * 100);

                  return (
                    <div
                      key={hm.hod}
                      onMouseEnter={() => setHoveredHod(hm.hod)}
                      onMouseLeave={() => setHoveredHod(null)}
                      onClick={() => onSelectHod?.(hm.hod, true)}
                      title={`Click to view required 2026 cases for ${hm.hod}`}
                      className={`group p-3 rounded-xl border transition-all cursor-pointer ${
                        isHovered
                          ? 'bg-slate-50 dark:bg-[#1a2030] border-red-300 dark:border-red-900 shadow-xs'
                          : 'bg-white dark:bg-[#161a26]/60 border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-xs mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-red-600 transition-colors">
                            {hm.hod}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {hm.ownersCount} Members
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 font-mono">
                          <span className="text-slate-600 dark:text-slate-300 font-bold">
                            {hm.totalNewCases} Cases
                          </span>
                          <span className="text-slate-400">·</span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-xs ${
                              isSlaGood
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                            }`}
                          >
                            {hm.newPct}% SLA (&le;90d)
                          </span>
                        </div>
                      </div>

                      {/* Visual Comparison: Volume vs SLA */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span className="w-16 shrink-0">Volume</span>
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-slate-400 dark:bg-slate-500 transition-all duration-500"
                              style={{ width: `${Math.min(volumePct, 100)}%` }}
                            />
                          </div>
                          <span className="w-12 text-right">{hm.totalNewCases}</span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span className="w-16 shrink-0">SLA Rate</span>
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-slate-400 dark:bg-slate-500 z-10"
                              style={{ left: '80%' }}
                              title="80% Target Benchmark"
                            />
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isSlaGood ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(hm.newPct, 100)}%` }}
                            />
                          </div>
                          <span className="w-12 text-right font-bold text-slate-700 dark:text-slate-200">
                            {hm.newPct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: HOD OLD CASES (BACKLOG & RESOLUTION SLA %) */}
          {activeTab === 'old-cases' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Legacy Backlog (&lt;2026) Count vs Resolution SLA (&le;180 Days) by Department
                </span>
                <span className="text-[11px] font-mono">Target: &le;180d SLA (80% Benchmark)</span>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {sortedByOldCases.map((hm) => {
                  const isHovered = hoveredHod === hm.hod;
                  const isSlaGood = hm.oldPct >= 80;
                  const volumePct = Math.round((hm.totalOldCases / maxOldCount) * 100);

                  return (
                    <div
                      key={hm.hod}
                      onMouseEnter={() => setHoveredHod(hm.hod)}
                      onMouseLeave={() => setHoveredHod(null)}
                      onClick={() => onSelectHod?.(hm.hod, true)}
                      title={`Click to view required backlog cases for ${hm.hod}`}
                      className={`group p-3 rounded-xl border transition-all cursor-pointer ${
                        isHovered
                          ? 'bg-slate-50 dark:bg-[#1a2030] border-amber-300 dark:border-amber-900 shadow-xs'
                          : 'bg-white dark:bg-[#161a26]/60 border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-xs mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-amber-600 transition-colors">
                            {hm.hod}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {hm.ownersCount} Members
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 font-mono">
                          <span className="text-slate-600 dark:text-slate-300 font-bold">
                            {hm.totalOldCases} Cases
                          </span>
                          <span className="text-slate-400">·</span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-xs ${
                              isSlaGood
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                            }`}
                          >
                            {hm.oldPct}% SLA (&le;180d)
                          </span>
                        </div>
                      </div>

                      {/* Visual Comparison: Backlog Volume vs SLA */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span className="w-16 shrink-0">Volume</span>
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-slate-400 dark:bg-slate-500 transition-all duration-500"
                              style={{ width: `${Math.min(volumePct, 100)}%` }}
                            />
                          </div>
                          <span className="w-12 text-right">{hm.totalOldCases}</span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span className="w-16 shrink-0">SLA Rate</span>
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-slate-400 dark:bg-slate-500 z-10"
                              style={{ left: '80%' }}
                              title="80% Target Benchmark"
                            />
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isSlaGood ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(hm.oldPct, 100)}%` }}
                            />
                          </div>
                          <span className="w-12 text-right font-bold text-slate-700 dark:text-slate-200">
                            {hm.oldPct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: HOD ON-TARGET (10% WEIGHT) */}
          {activeTab === 'on-target' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <span className="font-semibold text-slate-700">
                  On-Target Delivery Rate (Target 80% • Weight 10%) by Department
                </span>
                <span className="text-[11px] font-mono">Target: 80% Benchmark • 10% Weight</span>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {sortedByIndex.map((hm) => {
                  const isHovered = hoveredHod === hm.hod;
                  const hasCases = hm.totalOnTargetCount > 0;
                  const isSlaGood = hasCases && hm.onTargetPct >= 80;

                  return (
                    <div
                      key={hm.hod}
                      onMouseEnter={() => setHoveredHod(hm.hod)}
                      onMouseLeave={() => setHoveredHod(null)}
                      onClick={() => onSelectHod?.(hm.hod, true)}
                      title={`Click to view required on-target cases for ${hm.hod}`}
                      className={`group p-3 rounded-xl border transition-all cursor-pointer ${
                        isHovered
                          ? 'bg-slate-50 border-emerald-300 shadow-xs'
                          : 'bg-white border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-xs mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-800 truncate group-hover:text-emerald-600 transition-colors">
                            {hm.hod}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {hm.ownersCount} Members
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 font-mono">
                          <span className="text-slate-600 font-bold">
                            {hm.totalOnTargetCompleted} / {hm.totalOnTargetCount} Met
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="px-2 py-0.5 rounded font-bold text-xs bg-emerald-50 text-emerald-700">
                            {hasCases ? `${hm.onTargetPct}% Met` : '10% Benchmark Award'}
                          </span>
                        </div>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span className="w-20 shrink-0">On-Target</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden relative">
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-slate-400 dark:bg-slate-500 z-10"
                              style={{ left: '80%' }}
                              title="80% Target Benchmark"
                            />
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                hasCases
                                  ? isSlaGood
                                    ? 'bg-emerald-500'
                                    : 'bg-amber-500'
                                  : 'bg-emerald-400/60'
                              }`}
                              style={{ width: `${Math.min(hasCases ? hm.onTargetPct : 100, 100)}%` }}
                            />
                          </div>
                          <span className="w-20 text-right font-bold text-slate-700 dark:text-slate-200">
                            {hasCases ? `${hm.onTargetPct}%` : '10% Award'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Hint */}
      <div className="px-5 py-2.5 bg-slate-50 dark:bg-[#11141d] border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-red-500" />
          <span>Click any department bar above to filter and inspect their required operational cases in the tracker.</span>
        </span>
        <span className="font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          Etisalat Change Factory Standard
        </span>
      </div>
    </div>
  );
};
