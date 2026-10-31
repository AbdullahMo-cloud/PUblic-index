import React, { useState, useMemo } from 'react';
import { OwnerIndexSummary } from '../types/ccf';
import { calculateChangeFactoryIndex } from '../utils/dataParser';
import {
  BarChart3,
  TrendingUp,
  Target,
  Award,
  Layers,
  Archive,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ExecutiveAnalyticsChartsProps {
  summaries: OwnerIndexSummary[];
  onSelectOwner?: (owner: string, tracker?: '2026' | 'backlog' | 'compiled' | 'on-target', onlyEligible?: boolean) => void;
  onSelectHod?: (hod: string) => void;
  onNavigateTo2026Tracker?: () => void;
  onNavigateToBacklogTracker?: () => void;
  onNavigateToCompiledTracker?: () => void;
}

type ChartTab = 'index-ranking' | 'new-cases' | 'old-cases' | 'on-target';

export const ExecutiveAnalyticsCharts: React.FC<ExecutiveAnalyticsChartsProps> = ({
  summaries,
  onSelectOwner,
  onSelectHod,
}) => {
  const [activeTab, setActiveTab] = useState<ChartTab>('index-ranking');
  const [selectedHod, setSelectedHod] = useState<string>('ALL');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [hoveredOwner, setHoveredOwner] = useState<string | null>(null);

  // Extract unique HODs
  const hodList = useMemo(() => {
    const set = new Set<string>();
    summaries.forEach((s) => {
      if (s.hod) set.add(s.hod);
    });
    return Array.from(set).sort();
  }, [summaries]);

  // Filtered dataset based on HOD
  const filteredSummaries = useMemo(() => {
    return summaries.filter((s) => {
      if (selectedHod === 'ALL') return true;
      return s.hod.toLowerCase() === selectedHod.toLowerCase();
    });
  }, [summaries, selectedHod]);

  // High-level KPI aggregations for the chart header
  const chartStats = useMemo(() => {
    if (filteredSummaries.length === 0) {
      return {
        avgIndex: 0,
        topOwner: null as OwnerIndexSummary | null,
        totalNewCases: 0,
        totalNewDenominator: 0,
        totalNewWithin: 0,
        newSlaPct: 0,
        totalOldCases: 0,
        totalOldWithin: 0,
        oldSlaPct: 0,
        totalOnTargetCount: 0,
        totalOnTargetCompleted: 0,
        onTargetPct: 0,
        meetingTargetCount: 0,
      };
    }

    let sumIndex = 0;
    let totalNewCases = 0;
    let totalNewDenominator = 0;
    let totalNewWithin = 0;
    let totalOldCases = 0;
    let totalOldWithin = 0;
    let totalOnTargetCount = 0;
    let totalOnTargetCompleted = 0;
    let meetingTargetCount = 0;

    let top: OwnerIndexSummary | null = null;

    filteredSummaries.forEach((s) => {
      sumIndex += s.changeFactoryIndex;
      totalNewCases += s.newCasesCount;
      totalNewDenominator += s.newCasesDenominator;
      totalNewWithin += s.newCasesWithinSla;
      totalOldCases += s.oldCasesCount;
      totalOldWithin += s.oldCasesWithinSla;
      totalOnTargetCount += s.onTargetCount;
      totalOnTargetCompleted += s.onTargetCompleted;
      if (s.changeFactoryIndex >= 80) meetingTargetCount++;

      if (!top || s.changeFactoryIndex > top.changeFactoryIndex) {
        top = s;
      }
    });

    const avgIndex = filteredSummaries.length > 0 ? Math.round(sumIndex / filteredSummaries.length) : 0;
    const newSlaPct = totalNewDenominator > 0 ? Math.round((totalNewWithin / totalNewDenominator) * 100) : 0;
    const oldSlaPct = totalOldCases > 0 ? Math.round((totalOldWithin / totalOldCases) * 100) : 0;
    const onTargetPct = totalOnTargetCount > 0 ? Math.round((totalOnTargetCompleted / totalOnTargetCount) * 100) : 0;

    // Main Change Factory Index calculation using the official formula on aggregate totals:
    // (New Cases SLA / 80% × 50%) + (Old Cases SLA / 80% × 40%) + On-Target (10%)
    const hasNew = totalNewDenominator > 0;
    const newRate = hasNew ? totalNewWithin / totalNewDenominator : null;
    const hasOld = totalOldCases > 0;
    const oldRate = hasOld ? totalOldWithin / totalOldCases : null;
    const hasOnTarget = totalOnTargetCount > 0;
    const onTargetRate = hasOnTarget ? totalOnTargetCompleted / totalOnTargetCount : null;

    const mainIndexRes = calculateChangeFactoryIndex(
      hasNew,
      newRate,
      hasOld,
      oldRate,
      hasOnTarget,
      onTargetRate
    );
    const mainIndexScore = mainIndexRes;

    return {
      mainIndexScore,
      avgIndex,
      topOwner: top,
      totalNewCases,
      totalNewDenominator,
      totalNewWithin,
      newSlaPct,
      totalOldCases,
      totalOldWithin,
      oldSlaPct,
      totalOnTargetCount,
      totalOnTargetCompleted,
      onTargetPct,
      meetingTargetCount,
    };
  }, [filteredSummaries]);

  // Sorted summaries for Index Ranking tab
  const sortedByIndex = useMemo(() => {
    return [...filteredSummaries].sort((a, b) => b.changeFactoryIndex - a.changeFactoryIndex);
  }, [filteredSummaries]);

  // Sorted summaries for New Cases tab
  const sortedByNewCases = useMemo(() => {
    return [...filteredSummaries].sort((a, b) => {
      if (b.newCasesCount !== a.newCasesCount) {
        return b.newCasesCount - a.newCasesCount;
      }
      return b.newCasesPct - a.newCasesPct;
    });
  }, [filteredSummaries]);

  // Sorted summaries for Old Cases tab
  const sortedByOldCases = useMemo(() => {
    return [...filteredSummaries].sort((a, b) => {
      if (b.oldCasesCount !== a.oldCasesCount) {
        return b.oldCasesCount - a.oldCasesCount;
      }
      return b.oldCasesPct - a.oldCasesPct;
    });
  }, [filteredSummaries]);

  // Sorted summaries for On-Target Completion tab
  const sortedByOnTarget = useMemo(() => {
    return [...filteredSummaries].sort((a, b) => {
      if (b.onTargetCount !== a.onTargetCount) {
        return b.onTargetCount - a.onTargetCount;
      }
      return b.onTargetPct - a.onTargetPct;
    });
  }, [filteredSummaries]);

  const maxOnTargetCount = useMemo(() => {
    const max = Math.max(...filteredSummaries.map((s) => s.onTargetCount), 1);
    return Math.max(max, 5);
  }, [filteredSummaries]);

  // Grouped metrics by HOD for HOD Breakdown tab
  const hodMetrics = useMemo(() => {
    const map: Record<
      string,
      {
        hod: string;
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

        const hodIndex = calculateChangeFactoryIndex(
          hasNew,
          newRate,
          hasOld,
          oldRate,
          hasOnTarget,
          onTargetRate
        );

        return {
          ...item,
          hodIndex,
          newPct,
          oldPct,
          onTargetPct,
          totalVolume: item.totalNewCases + item.totalOldCases + item.totalOnTargetCount,
        };
      })
      .sort((a, b) => b.totalVolume - a.totalVolume);
  }, [summaries]);

  // Calculate maximum values for scale normalization
  const maxNewCount = useMemo(() => {
    const max = Math.max(...filteredSummaries.map((s) => s.newCasesCount), 1);
    return Math.max(max, 10);
  }, [filteredSummaries]);

  const maxOldCount = useMemo(() => {
    const max = Math.max(...filteredSummaries.map((s) => s.oldCasesCount), 1);
    return Math.max(max, 10);
  }, [filteredSummaries]);

  return (
    <div className="bg-white dark:bg-[#131722] rounded-2xl border border-slate-200/90 dark:border-white/10 shadow-xs hover:shadow-sm transition-all duration-200 overflow-hidden">
      {/* Top Header & Executive Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-[#161b28]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Title & Brand Tag */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/50 flex items-center justify-center text-red-600 shadow-2xs shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-wide uppercase">
                  Change Factory Index &amp; SLA Executive Visualizer
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/80 font-bold">
                  Interactive Graphics
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Visual translation of owner performance, 2026 new cases volume &amp; SLA, backlog resolution, and benchmark targets before the detailed matrix below.
              </p>
            </div>
          </div>

          {/* Right Controls: Filter by HOD + Collapse / Expand */}
          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>HOD:</span>
            </div>
            <select
              value={selectedHod}
              onChange={(e) => setSelectedHod(e.target.value)}
              className="text-xs bg-white dark:bg-[#161a26] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-red-500 shadow-2xs font-medium cursor-pointer"
            >
              <option value="ALL">All HODs ({hodList.length})</option>
              {hodList.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-[#161a26] border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors shadow-2xs"
              title={isCollapsed ? 'Expand Charts' : 'Collapse Charts'}
            >
              {isCollapsed ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Show Charts</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Hide Charts</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 5 Summary Highlight Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4 pt-3 border-t border-slate-200/60 dark:border-white/5 text-xs">
          <div className="bg-white/80 dark:bg-[#161a26]/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Change Factory Index</span>
              <span
                className="text-base font-extrabold font-mono text-slate-900 dark:text-white"
                title={`Main Calculation: (New Cases ${chartStats.newSlaPct}% ÷ 80% × 50%) + (Old Cases ${chartStats.oldSlaPct}% ÷ 80% × 40%) + On-Target (10%) = ${chartStats.mainIndexScore}% (Team Avg: ${chartStats.avgIndex}%)`}
              >
                {chartStats.mainIndexScore}%
              </span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white/80 dark:bg-[#161a26]/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">New Cases (50% Wt)</span>
              <span className="text-base font-extrabold font-mono text-slate-900 dark:text-white">
                {chartStats.newSlaPct}%
              </span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white/80 dark:bg-[#161a26]/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Old Cases (40% Wt)</span>
              <span className="text-base font-extrabold font-mono text-slate-900 dark:text-white">
                {chartStats.oldSlaPct}%
              </span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Archive className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white/80 dark:bg-[#161a26]/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">On-Target (10% Wt)</span>
              <span className="text-base font-extrabold font-mono text-slate-900 dark:text-white">
                {chartStats.totalOnTargetCount > 0 ? `${chartStats.onTargetPct}%` : '100%'}
              </span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white/80 dark:bg-[#161a26]/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Top Performer</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[100px] block">
                {chartStats.topOwner ? chartStats.topOwner.owner : 'N/A'}
              </span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* View Tabs */}
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
              <span>Change Factory Index Ranking</span>
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
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>On-Target (80% Target • 10% Wt)</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Interactive Chart Canvas */}
      {!isCollapsed && (
        <div className="p-5 space-y-4">
          {/* TAB 1: CHANGE FACTORY INDEX RANKING */}
          {activeTab === 'index-ranking' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-1">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Showing {sortedByIndex.length} Owners
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    <span>&ge; 90% (Exceeding Benchmark)</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                    <span>80% - 89% (On Target)</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                    <span>&lt; 80% (Action Required)</span>
                  </span>
                </div>
                <div className="hidden md:flex items-center gap-2 font-mono text-[11px]">
                  <span>Target Threshold: 80%</span>
                </div>
              </div>

              {/* Graphical Bars */}
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {sortedByIndex.map((s, idx) => {
                  const isHovered = hoveredOwner === s.owner;
                  const isExceeding = s.changeFactoryIndex >= 90;
                  const isOnTarget = s.changeFactoryIndex >= 80 && s.changeFactoryIndex < 90;

                  return (
                    <div
                      key={s.owner}
                      onMouseEnter={() => setHoveredOwner(s.owner)}
                      onMouseLeave={() => setHoveredOwner(null)}
                      onClick={() => onSelectOwner?.(s.owner, 'compiled', true)}
                      title={`Click to view required eligible cases for ${s.owner} (2026, Backlog & On-Target) in Compiled Cases Hub`}
                      className={`group p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isHovered
                          ? 'bg-slate-50 dark:bg-[#1a2030] border-red-300 dark:border-red-900 shadow-xs'
                          : 'bg-white dark:bg-[#161a26]/60 border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 text-[11px] font-mono text-slate-400 font-bold">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-red-600 transition-colors">
                            {s.owner}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5 truncate max-w-[140px]">
                            {s.hod}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono hidden sm:inline">
                            New: {s.newCasesDenominator > 0 ? `${s.newCasesPct}%` : '-'} · Old: {s.oldCasesCount > 0 ? `${s.oldCasesPct}%` : '-'} · Target: {s.onTargetCount > 0 ? `${s.onTargetPct}%` : (s.newCasesDenominator > 0 ? '10%' : '0%')}
                          </span>
                          <div className="flex items-baseline gap-1 font-mono font-extrabold text-sm">
                            <span
                              className={
                                isExceeding
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : isOnTarget
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              {s.changeFactoryIndex}%
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">INDEX</span>
                          </div>
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
                          style={{ width: `${Math.min(s.changeFactoryIndex, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: NEW CASES (VOLUME VS SLA %) */}
          {activeTab === 'new-cases' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  New Cases 2026 Volume (Count) vs SLA Performance (&le;90 Days)
                </span>
                <span className="text-[11px] font-mono">Target: &le;90d SLA (80% Benchmark)</span>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {sortedByNewCases.map((s) => {
                  const isHovered = hoveredOwner === s.owner;
                  const isSlaGood = s.newCasesPct >= 80;
                  const volumePct = Math.round((s.newCasesCount / maxNewCount) * 100);

                  return (
                    <div
                      key={s.owner}
                      onMouseEnter={() => setHoveredOwner(s.owner)}
                      onMouseLeave={() => setHoveredOwner(null)}
                      onClick={() => onSelectOwner?.(s.owner, '2026', true)}
                      title={`Click to view ${s.newCasesCount} eligible cases for ${s.owner} (excluding Not Started & New) in 2026 Tracker`}
                      className={`group p-3 rounded-xl border transition-all cursor-pointer ${
                        isHovered
                          ? 'bg-slate-50 dark:bg-[#1a2030] border-red-300 dark:border-red-900 shadow-xs'
                          : 'bg-white dark:bg-[#161a26]/60 border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-xs mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-red-600 transition-colors">
                            {s.owner}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {s.hod}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 font-mono">
                          <span
                            className="text-slate-600 dark:text-slate-300 font-bold"
                          >
                            {s.newCasesCount} Cases
                          </span>
                          <span className="text-slate-400">·</span>
                          <span
                            title={`SLA %: ${s.newCasesWithinSla} Within SLA ÷ ${s.newCasesCount} Count Cases = ${s.newCasesPct}%`}
                            className={`px-2 py-0.5 rounded font-bold text-xs cursor-help ${
                              isSlaGood
                                ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800/60'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                            }`}
                          >
                            {s.newCasesPct}% SLA ({s.newCasesWithinSla}/{s.newCasesCount} &le;90d)
                          </span>
                        </div>
                      </div>

                      {/* Dual Bar: Top is volume, Bottom is SLA */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span className="w-14 shrink-0">Volume</span>
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-slate-700 dark:bg-slate-400 rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(volumePct, 4)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right">{s.newCasesCount}</span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span className="w-14 shrink-0">SLA %</span>
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                            {/* 80% marker */}
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-slate-400 dark:bg-slate-500 z-10"
                              style={{ left: '80%' }}
                            />
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isSlaGood ? 'bg-red-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(s.newCasesPct, 100)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right font-bold text-slate-700 dark:text-slate-200">
                            {s.newCasesPct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: OLD CASES (BACKLOG VOLUME VS SLA %) */}
          {activeTab === 'old-cases' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Legacy Backlog (&lt;2026) Count vs Resolution SLA (&le;180 Days)
                </span>
                <span className="text-[11px] font-mono">Target: &le;180d SLA (80% Benchmark)</span>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {sortedByOldCases.map((s) => {
                  const isHovered = hoveredOwner === s.owner;
                  const isSlaGood = s.oldCasesPct >= 80;
                  const volumePct = Math.round((s.oldCasesCount / maxOldCount) * 100);

                  return (
                    <div
                      key={s.owner}
                      onMouseEnter={() => setHoveredOwner(s.owner)}
                      onMouseLeave={() => setHoveredOwner(null)}
                      onClick={() => onSelectOwner?.(s.owner, 'backlog', true)}
                      title={`Click to view ${s.oldCasesCount} eligible backlog cases for ${s.owner} (excluding Not Started & Cancelled) in Backlog Tracker`}
                      className={`group p-3 rounded-xl border transition-all cursor-pointer ${
                        isHovered
                          ? 'bg-slate-50 dark:bg-[#1a2030] border-amber-300 dark:border-amber-900 shadow-xs'
                          : 'bg-white dark:bg-[#161a26]/60 border-slate-100 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-xs mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-amber-600 transition-colors">
                            {s.owner}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {s.hod}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 font-mono">
                          <span className="text-slate-600 dark:text-slate-300 font-bold">
                            {s.oldCasesCount} Cases
                          </span>
                          <span className="text-slate-400">·</span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-xs ${
                              isSlaGood
                                ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                            }`}
                          >
                            {s.oldCasesPct}% SLA ({s.oldCasesWithinSla}/{s.oldCasesCount} &le;180d)
                          </span>
                        </div>
                      </div>

                      {/* Dual Bar: Top is volume, Bottom is SLA */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span className="w-14 shrink-0">Backlog</span>
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(volumePct, 4)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right">{s.oldCasesCount}</span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span className="w-14 shrink-0">SLA %</span>
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                            {/* 80% marker */}
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-slate-400 dark:bg-slate-500 z-10"
                              style={{ left: '80%' }}
                            />
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isSlaGood ? 'bg-amber-600' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(s.oldCasesPct, 100)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right font-bold text-slate-700 dark:text-slate-200">
                            {s.oldCasesPct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: ON-TARGET COMPLETION (80% Target, 10% Weight) */}
          {activeTab === 'on-target' && (() => {
            const onTargetOwners = sortedByOnTarget.filter((s) => s.onTargetCount > 0);

            return (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 pb-1 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">
                      On-Target Performance: Cases Transferred from Under Dev to Completed
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                      Target 80% • Weight 10%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="font-bold text-slate-600">80% Target Benchmark</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-emerald-700 font-bold">10% Weight</span>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {onTargetOwners.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No cases transferred from Under Development to Completed yet in current dataset.
                    </div>
                  ) : (
                    onTargetOwners.map((s) => {
                      const isHovered = hoveredOwner === s.owner;
                      const isSlaGood = s.onTargetPct >= 80;

                      const contrib = s.onTargetContribution ?? (s.onTargetPct >= 80 ? 10 : Math.round((s.onTargetPct / 80) * 10 * 10) / 10);
                      const contribLabel = isSlaGood
                        ? `${contrib}% Contrib to Index (≥80% Target)`
                        : `${contrib}% Contrib to Index (<80% Target)`;
                      const contribBadgeClass = isSlaGood
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200';

                      return (
                        <div
                          key={s.owner}
                          onMouseEnter={() => setHoveredOwner(s.owner)}
                          onMouseLeave={() => setHoveredOwner(null)}
                          onClick={() => onSelectOwner?.(s.owner, 'on-target', false)}
                          title={`Click to view ${s.owner} on-target cases in On-Target CCF Tracker`}
                          className={`group p-3 rounded-xl border transition-all cursor-pointer ${
                            isHovered
                              ? 'bg-slate-50 border-emerald-300 shadow-xs'
                              : 'bg-white border-slate-100 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 text-xs mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold text-slate-800 truncate group-hover:text-emerald-600 transition-colors">
                                {s.owner}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                                {s.hod}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 font-mono">
                              <span className="text-slate-600 font-bold">
                                {s.onTargetCompleted}/{s.onTargetCount} Met On-Time
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-700 font-bold">
                                {s.onTargetPct}% Rate
                              </span>
                              <span className="text-slate-400">·</span>
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-xs border ${contribBadgeClass}`}
                              >
                                {contribLabel}
                              </span>
                            </div>
                          </div>

                          {/* Visual Bar: Shows On-Target % vs 80% Benchmark */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                              <span className="w-24 shrink-0 font-medium">On-Target Rate</span>
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden relative">
                                {/* 80% Benchmark Reference Line */}
                                <div
                                  className="absolute top-0 bottom-0 w-0.5 bg-slate-400 z-10"
                                  style={{ left: '80%' }}
                                  title="80% Target Benchmark"
                                />
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isSlaGood ? 'bg-emerald-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.min(s.onTargetPct, 100)}%` }}
                                />
                              </div>
                              <span className="w-20 text-right font-bold text-slate-700">
                                {s.onTargetPct}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Footer Hint */}
      <div className="px-5 py-2.5 bg-slate-50 dark:bg-[#11141d] border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-red-500" />
          <span>Click any owner bar above to filter and inspect their operational cases in the tracker.</span>
        </span>
        <span className="font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          Etisalat Change Factory Standard
        </span>
      </div>
    </div>
  );
};
