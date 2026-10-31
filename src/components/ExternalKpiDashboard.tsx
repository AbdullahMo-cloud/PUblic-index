import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ExternalKpiStats, ExternalMonthlyCfiRow } from '../types/ccf';
import {
  Globe2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  Cpu,
  ShieldCheck,
  ArrowUpRight,
  Presentation,
  Download,
  Users,
  Calendar,
  Layers,
  Search,
  Check,
  Copy,
  X,
  ChevronRight,
  ChevronDown,
  BarChart3,
  Percent,
  Info,
  HelpCircle,
  Sparkles,
  Printer,
  FileSpreadsheet,
  Award,
  GitFork,
} from 'lucide-react';

import {
  exportExecutiveCfiReport,
  exportExecutiveTrendReport,
  exportExecutiveCfiMatrixReport,
  exportExternalCfiMatrixTableReport,
  exportExternalCfiTableExcel,
  exportExternalCfiTableRawXlsx,
  exportExternalOwnerHodTableReport,
  exportExternalOwnerHodTableExcel,
  exportExternalKpiPptx,
} from '../utils/reportExport';
import { EtisalatLogo } from './EtisalatLogo';
import { ExternalChangeFactoryIndexTable } from './ExternalChangeFactoryIndexTable';
import { ExternalFilterPreset } from './CcfDataTable';

interface ExternalKpiDashboardProps {
  stats: ExternalKpiStats;
  onNavigateToExternalTracker: (preset?: ExternalFilterPreset) => void;
  onOpenPresentation?: () => void;
  onSelectOwnerFilter?: (owner: string) => void;
  onSelectHodFilter?: (hod: string) => void;
}

export const ExternalKpiDashboard: React.FC<ExternalKpiDashboardProps> = ({
  stats,
  onNavigateToExternalTracker,
  onOpenPresentation,
  onSelectOwnerFilter,
  onSelectHodFilter,
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'performance' | 'cards'>('matrix');
  const [selectedMonth, setSelectedMonth] = useState<string>('latest');
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<{
    noDev: boolean;
    dev: boolean;
    volume: boolean;
  }>({
    noDev: false,
    dev: false,
    volume: false,
  });

  const [isExportMatrixMenuOpen, setIsExportMatrixMenuOpen] = useState(false);
  const exportMatrixMenuRef = React.useRef<HTMLDivElement>(null);

  const [isExportingPptx, setIsExportingPptx] = useState(false);

  // Download the active tab as a native PowerPoint deck (same content as the HTML report of that tab)
  const handleDownloadPptx = async () => {
    if (isExportingPptx) return;
    setIsExportingPptx(true);
    try {
      await exportExternalKpiPptx(
        stats,
        activeTab === 'cards' ? 'cards' : activeTab === 'performance' ? 'performance' : 'matrix'
      );
    } catch (err) {
      console.error('PPT export failed:', err);
      alert('Could not generate the PowerPoint file. Please try again.');
    } finally {
      setIsExportingPptx(false);
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMatrixMenuRef.current && !exportMatrixMenuRef.current.contains(event.target as Node)) {
        setIsExportMatrixMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportThemedHtml = () => {
    setIsExportMatrixMenuOpen(false);
    exportExternalCfiMatrixTableReport(stats);
  };

  const handleExportThemedExcel = () => {
    setIsExportMatrixMenuOpen(false);
    exportExternalCfiTableExcel(stats);
  };

  const handleExportRawXlsx = () => {
    setIsExportMatrixMenuOpen(false);
    exportExternalCfiTableRawXlsx(stats);
  };

  const handleExportFullMatrixReport = () => {
    setIsExportMatrixMenuOpen(false);
    exportExecutiveCfiMatrixReport(stats);
  };

  const toggleSection = (section: 'noDev' | 'dev' | 'volume') => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Month data selected for executive cards (either specific month or full cumulative year/latest)
  const activeMonthData: ExternalMonthlyCfiRow | null = useMemo(() => {
    if (selectedMonth === 'latest') {
      return stats.monthlyData[stats.monthlyData.length - 1] || null;
    }
    return (
      stats.monthlyData.find(
        (m) => m.month.toLowerCase() === selectedMonth.toLowerCase()
      ) || null
    );
  }, [selectedMonth, stats.monthlyData]);

  const currentCfiScore = activeMonthData
    ? activeMonthData.totalCfiPct
    : stats.overallCfiScore;
  const currentNoDevCount = activeMonthData
    ? activeMonthData.noDevCount
    : stats.noDevTotalCount;
  const currentNoDevWithin = activeMonthData
    ? activeMonthData.noDevWithinSla
    : stats.noDevWithinSlaCount;
  const currentNoDevPct = activeMonthData
    ? activeMonthData.noDevPct
    : stats.noDevOverallPct;
  const currentDevCount = activeMonthData
    ? activeMonthData.devCount
    : stats.devTotalCount;
  const currentDevWithin = activeMonthData
    ? activeMonthData.devWithinSla
    : stats.devWithinSlaCount;
  const currentDevPct = activeMonthData
    ? activeMonthData.devPct
    : stats.devOverallPct;
  const currentTotalCases = activeMonthData
    ? activeMonthData.totalCases
    : stats.totalExternalCases;
  const currentClosed = activeMonthData
    ? activeMonthData.forMonitoringCompleted
    : stats.completedCount;

  const isCurrentCfiOnTarget = currentCfiScore >= 100;

  const renderExecutiveSummaryCards = () => (
    <div className="space-y-5">
      {/* CUMULATIVE PERIOD SELECTOR */}
      <div className="bg-slate-50/90 rounded-2xl border border-slate-200 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mr-1">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Cumulative Period:</span>
          </span>

          <button
            onClick={() => setSelectedMonth('latest')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedMonth === 'latest'
                ? 'bg-slate-900 text-white shadow-xs font-bold'
                : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
            }`}
          >
            Full Year (Latest)
          </button>

          {stats.monthlyData.map((m) => {
            const isSelected = selectedMonth.toLowerCase() === m.month.toLowerCase();
            return (
              <button
                key={m.month}
                onClick={() => setSelectedMonth(m.month)}
                className={`px-2 py-1 rounded-lg text-xs font-mono transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                }`}
                title={`Inspect cumulative numbers through ${m.fullMonthName}`}
              >
                {m.month}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2026 CASE HORIZON SUMMARY CALLOUT */}
      {stats.exceedLevel2027Count !== undefined && stats.exceedLevel2027Count > 0 && (
        <div className="bg-amber-50/90 border border-amber-300/80 rounded-2xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-amber-200 text-amber-950 border border-amber-300 shrink-0 font-bold text-xs">
              2026 Horizon
            </span>
            <div>
              <span className="text-xs font-bold text-amber-950 block">
                2026 Case Horizon Active Evaluation: {stats.exceedLevel2027Count} ongoing case{stats.exceedLevel2027Count > 1 ? 's' : ''} crossing into 2027
              </span>
              <span className="text-[11px] text-amber-900">
                Ongoing 2026 cases with target delivery timeline exceeding Dec 31, 2026 (+90d No Dev / +180d Dev) are marked <span className="font-semibold text-amber-950">2027 Exceed Level</span> and excluded from the 2026 unresolved denominator.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono shrink-0">
            <button
              onClick={() => onNavigateToExternalTracker({ caseHorizon: 'Eligible 2026' })}
              className="px-2.5 py-1 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 font-bold transition-all cursor-pointer shadow-2xs"
              title="Click to view Eligible 2026 cases in External CCF Tracker"
            >
              Eligible 2026: {stats.eligible2026Count || 0} ↗
            </button>
            <button
              onClick={() => onNavigateToExternalTracker({ caseHorizon: '2027 Exceed Level' })}
              className="px-2.5 py-1 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-950 border border-amber-400 font-bold transition-all cursor-pointer shadow-2xs"
              title="Click to view 2027 Exceed Level cases in External CCF Tracker"
            >
              2027 Exceed: {stats.exceedLevel2027Count} ↗
            </button>
          </div>
        </div>
      )}

      {/* 3 HIGH-IMPACT EXECUTIVE SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Overall External CFI Score */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          onClick={() => onNavigateToExternalTracker({ status: '2026' })}
          className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50/50 to-emerald-50/20 rounded-2xl border border-slate-200/90 hover:border-emerald-400 p-5 shadow-2xs hover:shadow-md transition-all group flex flex-col justify-between cursor-pointer ring-offset-2 hover:ring-2 hover:ring-emerald-400/50"
          title="Click to view all 2026 cases in External CCF Tracker"
        >
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />

          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </span>
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
                    Overall External CFI
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-800">
                    CFI Actual Index
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100/80 text-emerald-900 border border-emerald-200/80 text-[11px] font-bold font-mono">
                Target: 100.0%
              </span>
            </div>

            <div className="my-4 flex items-baseline justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tight text-slate-900 tabular-nums">
                    {currentCfiScore.toFixed(1)}%
                  </span>
                  <span className="text-xs font-semibold text-slate-500">actual</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Weighted: 80% No Dev + 20% Dev
                </p>
              </div>

              <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="18"
                    className="text-slate-200"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="transparent"
                  />
                  <motion.circle
                    cx="24"
                    cy="24"
                    r="18"
                    className="text-emerald-500"
                    strokeWidth="3.5"
                    strokeDasharray={113}
                    initial={{ strokeDashoffset: 113 }}
                    animate={{ strokeDashoffset: 113 - (113 * Math.min(currentCfiScore, 100)) / 100 }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                  />
                </svg>
                <Sparkles className="w-4 h-4 text-emerald-600 absolute" />
              </div>
            </div>

            <div className="space-y-1.5 my-3">
              <div className="flex justify-between text-[11px] font-medium text-slate-600">
                <span>Performance vs Benchmark</span>
                <span className="font-mono font-bold text-emerald-700">
                  {currentCfiScore >= 100 ? `+${(currentCfiScore - 100).toFixed(1)}% Surplus` : `${currentCfiScore.toFixed(1)}% / 100%`}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200/60">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(currentCfiScore, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 h-full rounded-full shadow-2xs"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
            <span
              className={`inline-flex items-center gap-1.5 font-bold ${
                isCurrentCfiOnTarget ? 'text-emerald-600' : 'text-amber-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 animate-pulse text-emerald-500" />
              <span>
                {isCurrentCfiOnTarget ? 'Exceeding Benchmark' : 'Approaching Target'}
              </span>
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono text-[10px] font-bold border border-slate-200">
              {selectedMonth === 'latest' ? 'Full Cumulative' : `Through ${selectedMonth}`}
            </span>
          </div>
        </motion.div>

        {/* Card 2: No Dev SLA Compliance */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          onClick={() => onNavigateToExternalTracker({ devRequired: 'No' })}
          className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50/50 to-emerald-50/20 rounded-2xl border border-slate-200/90 hover:border-emerald-400 p-5 shadow-2xs hover:shadow-md transition-all group flex flex-col justify-between cursor-pointer ring-offset-2 hover:ring-2 hover:ring-emerald-400/50"
          title="Click to view No Dev cases in External CCF Tracker"
        >
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />

          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-gradient-to-br from-emerald-600 to-green-500 text-white shadow-md shadow-emerald-600/20 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
                    No Dev SLA (≤90d)
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-800">
                    Non-Development Stream
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100/80 text-emerald-900 border border-emerald-200/80 text-[11px] font-bold font-mono">
                80% Target | 80% Wt
              </span>
            </div>

            <div className="my-4 flex items-baseline justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tight text-emerald-600 tabular-nums">
                    {currentNoDevPct}%
                  </span>
                  <span className="text-xs font-semibold text-slate-500">compliance</span>
                </div>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                  {currentNoDevWithin} of {currentNoDevCount} cases resolved in ≤90d
                </p>
              </div>

              <div className="text-right">
                <span className="inline-block px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 font-mono text-xs font-extrabold">
                  {stats.noDevContPct}% Share
                </span>
              </div>
            </div>

            <div className="space-y-1.5 my-3">
              <div className="flex justify-between text-[11px] font-medium text-slate-600">
                <span>SLA Rate vs 80% Target</span>
                <span className="font-mono font-bold text-emerald-700">
                  {currentNoDevPct >= 80 ? `+${(currentNoDevPct - 80).toFixed(1)}% vs Target` : `${(currentNoDevPct - 80).toFixed(1)}%`}
                </span>
              </div>
              <div className="relative w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200/60">
                <div className="absolute top-0 bottom-0 left-[80%] w-0.5 bg-rose-500 z-10" title="80% Target Threshold" />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(currentNoDevPct, 100)}%` }}
                  transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
                  className="bg-gradient-to-r from-emerald-600 to-teal-500 h-full rounded-full shadow-2xs"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>High Compliance Track</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-bold">
              Vol Share: {stats.noDevContPct}%
            </span>
          </div>
        </motion.div>

        {/* Card 3: Required Dev SLA Compliance */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          onClick={() => onNavigateToExternalTracker({ devRequired: 'Yes' })}
          className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50/50 to-indigo-50/20 rounded-2xl border border-slate-200/90 hover:border-indigo-400 p-5 shadow-2xs hover:shadow-md transition-all group flex flex-col justify-between cursor-pointer ring-offset-2 hover:ring-2 hover:ring-indigo-400/50"
          title="Click to view Required Dev cases in External CCF Tracker"
        >
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />

          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/20 shrink-0">
                  <Clock className="w-4 h-4" />
                </span>
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
                    Required Dev SLA (≤180d)
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-800">
                    Development Required Stream
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-indigo-100/80 text-indigo-900 border border-indigo-200/80 text-[11px] font-bold font-mono">
                80% Target | 20% Wt
              </span>
            </div>

            <div className="my-4 flex items-baseline justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tight text-indigo-600 tabular-nums">
                    {currentDevPct}%
                  </span>
                  <span className="text-xs font-semibold text-slate-500">compliance</span>
                </div>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                  {currentDevWithin} of {currentDevCount} cases resolved in ≤180d
                </p>
              </div>

              <div className="text-right">
                <span className="inline-block px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-200 font-mono text-xs font-extrabold">
                  {stats.devContPct}% Share
                </span>
              </div>
            </div>

            <div className="space-y-1.5 my-3">
              <div className="flex justify-between text-[11px] font-medium text-slate-600">
                <span>SLA Rate vs 80% Target</span>
                <span className="font-mono font-bold text-indigo-700">
                  {currentDevPct >= 80 ? `+${(currentDevPct - 80).toFixed(1)}% vs Target` : `${(currentDevPct - 80).toFixed(1)}%`}
                </span>
              </div>
              <div className="relative w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200/60">
                <div className="absolute top-0 bottom-0 left-[80%] w-0.5 bg-rose-500 z-10" title="80% Target Threshold" />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(currentDevPct, 100)}%` }}
                  transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                  className="bg-gradient-to-r from-indigo-600 to-purple-500 h-full rounded-full shadow-2xs"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
            <span className="text-indigo-700 font-bold flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-indigo-600" />
              <span>Dev Track Compliant</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono text-[10px] font-bold">
              Vol Share: {stats.devContPct}%
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* HEADER BAR & SMART VIEW SWITCHER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <EtisalatLogo size={26} />
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                External CCF Executive KPI Dashboard
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-bold">
                CFI Actual Index
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Smart Segregated KPI View: No Dev (80% Weight, ≤90d) &amp; Required Dev (20% Weight, ≤180d)
            </p>
          </div>
        </div>

        {/* View Switcher Pills & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'matrix'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>CFI Monthly Matrix</span>
            </button>

            <button
              onClick={() => setActiveTab('cards')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Executive Trend &amp; Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('performance')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'performance'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-rose-600" />
              <span>CFI By Owner &amp; HOD</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenPresentation && (
              <button
                onClick={onOpenPresentation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition-all shadow-2xs cursor-pointer"
                title="Open Presentation Mode"
              >
                <Presentation className="w-3.5 h-3.5 text-red-400" />
                <span>Presentation</span>
              </button>
            )}


            <button
              onClick={() => {
                if (activeTab === 'cards') {
                  exportExecutiveTrendReport(stats);
                } else if (activeTab === 'performance') {
                  exportExternalOwnerHodTableReport(stats);
                } else {
                  exportExecutiveCfiMatrixReport(stats);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer"
              title={
                activeTab === 'cards'
                  ? 'Download Executive Trend & Analytics Report (HTML/PDF)'
                  : activeTab === 'performance'
                  ? 'Download Owner & HOD Report (HTML/PDF)'
                  : 'Download Executive CFI Monthly Matrix Report (HTML/PDF)'
              }
            >
              <Download className="w-3.5 h-3.5 text-rose-400" />
              <span>
                Download HTML{' '}
                {activeTab === 'cards'
                  ? 'Trend'
                  : activeTab === 'performance'
                  ? 'Owner & HOD'
                  : 'Matrix'}
              </span>
            </button>

            <button
              onClick={handleDownloadPptx}
              disabled={isExportingPptx}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#E2001A] hover:bg-[#c80017] disabled:opacity-60 disabled:cursor-wait border border-[#b80016] rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer"
              title={
                activeTab === 'cards'
                  ? 'Download Executive Trend & Analytics as PowerPoint (.pptx) — same content as the HTML report'
                  : activeTab === 'performance'
                  ? 'Download Owner & HOD as PowerPoint (.pptx) — same content as the HTML report'
                  : 'Download Executive CFI Monthly Matrix as PowerPoint (.pptx) — same content as the HTML report'
              }
            >
              <Presentation className="w-3.5 h-3.5 text-white" />
              <span>
                {isExportingPptx ? 'Building PPT…' : 'Download PPT '}
                {!isExportingPptx &&
                  (activeTab === 'cards'
                    ? 'Trend'
                    : activeTab === 'performance'
                    ? 'Owner & HOD'
                    : 'Matrix')}
              </span>
            </button>

            <button
              onClick={() => onNavigateToExternalTracker()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-all shadow-2xs shrink-0"
            >
              <Cpu className="w-3.5 h-3.5 text-sky-600" />
              <span>External Tracker</span>
              <ArrowRight className="w-3 h-3 text-sky-500" />
            </button>
          </div>
        </div>
      </div>

      {/* DYNAMIC VIEW CONTENT */}

      {/* TAB 1: REORGANIZED EXECUTIVE CFI ACTUAL MONTHLY MATRIX TABLE */}
      <div id="kpi-section-matrix" style={{ display: activeTab === 'matrix' ? 'block' : 'none' }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* CUMULATIVE PERIOD SELECTOR & 3 HIGH-IMPACT EXECUTIVE SUMMARY CARDS */}
          {renderExecutiveSummaryCards()}

          <div className="bg-white rounded-3xl border border-slate-300/80 shadow-2xl shadow-slate-300/60 ring-1 ring-slate-900/5 overflow-hidden space-y-0 transition-all">
            {/* Matrix Card Banner & Actions (Etisalat Theme) */}
          <div className="p-4 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 text-slate-900 border-b border-slate-300 border-t-4 border-t-[#E2001A] flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-2xl bg-rose-100 text-rose-700 border border-rose-200/90 shrink-0 shadow-xs">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <EtisalatLogo size={20} />
                  <span>External CFI Monthly Executive Matrix</span>
                  <span className="px-2.5 py-0.5 bg-[#E2001A] text-white rounded-lg text-[10px] font-sans font-extrabold uppercase tracking-wide shadow-sm">
                    etisalat Corporate Grid
                  </span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Segregated metrics: Node / No Dev (80% Target / 80% Weight) &amp; DEV Required (80% Target / 20% Weight) with dynamic volume share &amp; Glide variance.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Quick Section Expand / Collapse Controls */}
              <div className="inline-flex items-center p-0.5 bg-white rounded-xl border border-slate-300 shadow-2xs">
                <button
                  onClick={() =>
                    setCollapsedSections({
                      noDev: !collapsedSections.noDev,
                      dev: !collapsedSections.dev,
                      volume: !collapsedSections.volume,
                    })
                  }
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Toggle all category sub-rows"
                >
                  {collapsedSections.noDev && collapsedSections.dev ? 'Expand All' : 'Collapse Details'}
                </button>
              </div>

              {/* Export Table Button with Themed Export matching Internal CCF KPI */}
              <div className="relative" ref={exportMatrixMenuRef}>
                <div className="inline-flex rounded-xl shadow-2xs border border-slate-300 overflow-hidden bg-white hover:border-slate-400 transition-colors">
                  <button
                    onClick={handleExportThemedHtml}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 hover:text-slate-950 hover:bg-slate-50 transition-colors cursor-pointer"
                    title="Export Table (Same Theme and Colors as App — HTML / Print / PDF)"
                  >
                    <Download className="w-3.5 h-3.5 text-rose-600" />
                    <span>Export Table</span>
                  </button>
                  <button
                    onClick={() => setIsExportMatrixMenuOpen((prev) => !prev)}
                    className="px-1.5 py-1.5 border-l border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                    title="Choose Export Format (Themed HTML, Themed Excel, or Raw XLSX)"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportMatrixMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Dropdown Menu for Theme & Colors selection */}
                {isExportMatrixMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-76 bg-white rounded-xl border border-slate-200 shadow-xl p-1.5 z-40 text-xs">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Export Table (App Theme &amp; Colors)
                    </div>
                    <button
                      onClick={handleExportThemedHtml}
                      className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-rose-50 text-slate-800 transition-colors cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>Themed Table (HTML / PDF)</span>
                          <span className="text-[9px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-bold uppercase">App Theme</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Dark Red (Node), Medium Red (DEV), Light Red (Total), official Etisalat emblem &amp; Print/PDF.
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={handleExportThemedExcel}
                      className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-emerald-50 text-slate-800 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>Themed Excel Spreadsheet (.xls)</span>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold uppercase">Styled</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Formatted Excel sheet with exact Dark/Medium/Light red theme and headers.
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={handleExportRawXlsx}
                      className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-slate-900">
                          Raw Excel Data (.xlsx)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Clean structured data for analysis.
                        </div>
                      </div>
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      onClick={handleExportFullMatrixReport}
                      className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-[#E2001A] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>Download Report Matrix (Full Governance)</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Complete multi-section governance report with KPI cards and breakdowns.
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <span className="px-2.5 py-1 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 font-mono text-[11px] font-bold shadow-2xs">
                No Dev: 80%
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono text-[11px] font-bold shadow-2xs">
                Dev: 80%
              </span>
            </div>
          </div>

          {/* REORGANIZED MATRIX TABLE (25% Narrower Columns & 3D Curvy Styling) */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse font-sans">
              <thead>
                <tr className="bg-slate-900 text-white font-extrabold uppercase tracking-wider text-[10px] border-b-2 border-rose-900 shadow-xs divide-x divide-slate-800">
                  <th className="p-2 w-[195px] min-w-[195px] max-w-[195px] sticky left-0 bg-slate-900 text-white z-20 shadow-xs border-r border-slate-800">
                    <div className="flex items-center gap-1 px-0.5">
                      <Percent className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="tracking-tight text-white text-[10px] truncate">CFI METRIC / CATEGORY</span>
                    </div>
                  </th>
                  <th className="p-2 border-r border-slate-800 text-center w-[68px] bg-slate-900 text-slate-200">TARGET</th>
                  <th className="p-2 border-r border-slate-800 text-center w-[80px] bg-slate-900 text-slate-200">WEIGHT / SHARE</th>
                  {stats.monthlyData.map((m) => {
                    const isSelected = selectedMonth.toLowerCase() === m.month.toLowerCase();
                    const isHovered = hoveredMonth === m.month;
                    return (
                      <th
                        key={m.month}
                        onClick={() => setSelectedMonth(m.month)}
                        onMouseEnter={() => setHoveredMonth(m.month)}
                        onMouseLeave={() => setHoveredMonth(null)}
                        className={`p-2 border-r border-slate-800 text-center w-[48px] cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#E2001A] text-white font-black shadow-inner'
                            : isHovered
                            ? 'bg-rose-950 text-white font-bold'
                            : 'hover:bg-slate-800 text-slate-200 bg-slate-900'
                        }`}
                        title={`Click to focus executive summary on ${m.fullMonthName}`}
                      >
                        <span className="block font-mono text-[11px]">{m.month}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-slate-800 text-[11px]">
                {/* 🔴 SECTION 1: NODE / NO DEV CATEGORY HEADER (Dark Red Theme matching Internal CCF KPI) */}
                <tr className="bg-rose-950 text-white font-sans font-extrabold text-[11px] border-t-2 border-rose-900 shadow-2xs divide-x divide-rose-900">
                  <td className="p-1.5 px-2 border-r border-rose-900 flex items-center justify-between gap-1 sticky left-0 bg-rose-950 text-white z-10 w-[195px] min-w-[195px] max-w-[195px]">
                    <button
                      onClick={() => toggleSection('noDev')}
                      className="flex items-center gap-1 hover:text-rose-200 transition-colors text-left cursor-pointer min-w-0"
                    >
                      {collapsedSections.noDev ? (
                        <ChevronRight className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                      )}
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shrink-0" />
                      <span className="tracking-tight text-white font-extrabold text-[11px] truncate">Node (No Dev SLA Score %)</span>
                    </button>
                    <span className="text-[9px] font-mono px-1 py-0.5 rounded-md bg-rose-900 text-rose-100 border border-rose-700 font-bold shrink-0">
                      ≤90d
                    </span>
                  </td>
                  <td className="p-1.5 border-r border-rose-900 text-center text-white font-mono font-bold bg-rose-950">
                    80%
                  </td>
                  <td className="p-1.5 border-r border-rose-900 text-center text-white font-mono font-bold bg-rose-950">
                    80% Weight
                  </td>
                  {stats.monthlyData.map((m) => {
                    const isHovered = hoveredMonth === m.month;
                    return (
                      <td
                        key={m.month}
                        className={`p-1.5 border-r border-rose-900 text-center font-black font-mono text-white text-[11px] whitespace-nowrap transition-colors ${
                          isHovered ? 'bg-rose-900' : 'bg-rose-950'
                        }`}
                      >
                        {m.noDevPct}%
                      </td>
                    );
                  })}
                </tr>

                {/* Sub-rows for Section 1 */}
                {!collapsedSections.noDev && (
                  <>
                    {/* Sub-row 1.1: Total Cases */}
                    <tr className="hover:bg-slate-50 transition-colors italic text-slate-700 text-[11px]">
                      <td className="p-1.5 pl-6 border-r border-slate-200 font-sans font-medium flex items-center justify-between sticky left-0 bg-white z-10">
                        <span>Count (Total Cases)</span>
                        <span className="text-[9px] text-slate-400 font-mono not-italic">Vol Pool</span>
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-rose-900 font-mono font-bold bg-rose-50/40">
                        {stats.noDevContPct}% Share
                      </td>
                      {stats.monthlyData.map((m) => {
                        const isHovered = hoveredMonth === m.month;
                        return (
                          <td
                            key={m.month}
                            className={`p-1.5 border-r border-slate-200 text-center font-bold text-slate-900 font-mono ${
                              isHovered ? 'bg-slate-100' : ''
                            }`}
                          >
                            {m.noDevCount}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Sub-row 1.2: Within SLA (≤90d) */}
                    <tr className="hover:bg-slate-50 transition-colors text-slate-700 text-[11px]">
                      <td className="p-1.5 pl-6 border-r border-slate-200 font-sans text-slate-700 sticky left-0 bg-white z-10">
                        Within SLA (≤90d)
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      {stats.monthlyData.map((m) => {
                        const isHovered = hoveredMonth === m.month;
                        return (
                          <td
                            key={m.month}
                            className={`p-1.5 border-r border-slate-200 text-center text-emerald-700 font-bold font-mono ${
                              isHovered ? 'bg-slate-100' : ''
                            }`}
                          >
                            {m.noDevWithinSla}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Sub-row 1.3: Outside SLA (>90d) */}
                    <tr className="hover:bg-slate-50 transition-colors text-slate-700 text-[11px]">
                      <td className="p-1.5 pl-6 border-r border-slate-200 font-sans text-slate-700 sticky left-0 bg-white z-10">
                        Outside SLA (&gt;90d)
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      {stats.monthlyData.map((m) => {
                        const isHovered = hoveredMonth === m.month;
                        return (
                          <td
                            key={m.month}
                            className={`p-1.5 border-r border-slate-200 text-center font-mono ${
                              m.noDevOutsideSla > 0
                                ? 'text-rose-600 font-bold bg-rose-50/50'
                                : 'text-slate-400'
                            } ${isHovered ? 'bg-slate-100' : ''}`}
                          >
                            {m.noDevOutsideSla}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Sub-row 1.4: Unresolved Cases */}
                    <tr className="hover:bg-slate-50 transition-colors italic text-slate-500 text-[11px]">
                      <td className="p-1.5 pl-6 border-r border-slate-200 font-sans sticky left-0 bg-white z-10">
                        Unresolved Cases
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      {stats.monthlyData.map((m) => {
                        const isHovered = hoveredMonth === m.month;
                        return (
                          <td
                            key={m.month}
                            className={`p-1.5 border-r border-slate-200 text-center font-mono text-slate-600 ${
                              isHovered ? 'bg-slate-100' : ''
                            }`}
                          >
                            {m.noDevUnresolved}
                          </td>
                        );
                      })}
                    </tr>
                  </>
                )}

                {/* 🟣 SECTION 2: DEV CATEGORY HEADER (Medium Red Theme matching Internal CCF KPI) */}
                <tr className="bg-rose-900 text-white font-sans font-extrabold text-[11px] border-t-2 border-rose-800 shadow-2xs divide-x divide-rose-800">
                  <td className="p-1.5 px-2 border-r border-rose-800 flex items-center justify-between gap-1.5 sticky left-0 bg-rose-900 text-white z-10 w-[195px] min-w-[195px] max-w-[195px]">
                    <button
                      onClick={() => toggleSection('dev')}
                      className="flex items-center gap-1.5 hover:text-rose-200 transition-colors text-left cursor-pointer min-w-0"
                    >
                      {collapsedSections.dev ? (
                        <ChevronRight className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                      )}
                      <span className="w-2 h-2 rounded-full bg-rose-300 animate-pulse shrink-0" />
                      <span className="tracking-tight text-white font-extrabold truncate">DEV (Dev Required SLA Score %)</span>
                    </button>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-rose-800 text-rose-100 border border-rose-700 font-bold shrink-0">
                      ≤180d
                    </span>
                  </td>
                  <td className="p-1.5 border-r border-rose-800 text-center text-white font-mono font-bold bg-rose-900">
                    80%
                  </td>
                  <td className="p-1.5 border-r border-rose-800 text-center text-white font-mono font-bold bg-rose-900">
                    20% Weight
                  </td>
                  {stats.monthlyData.map((m) => {
                    const isHovered = hoveredMonth === m.month;
                    return (
                      <td
                        key={m.month}
                        className={`p-1.5 border-r border-rose-800 text-center font-black font-mono text-white text-[11px] whitespace-nowrap transition-colors ${
                          isHovered ? 'bg-rose-800' : 'bg-rose-900'
                        }`}
                      >
                        {m.devPct}%
                      </td>
                    );
                  })}
                </tr>

                {/* Sub-rows for Section 2 */}
                {!collapsedSections.dev && (
                  <>
                    {/* Sub-row 2.1: Total Cases */}
                    <tr className="hover:bg-slate-50 transition-colors italic text-slate-700 text-[11px]">
                      <td className="p-1.5 pl-6 border-r border-slate-200 font-sans font-medium flex items-center justify-between sticky left-0 bg-white z-10 w-[195px] min-w-[195px] max-w-[195px]">
                        <span className="truncate">Count (Total Cases)</span>
                        <span className="text-[9px] text-slate-400 font-mono not-italic shrink-0">Vol Pool</span>
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-indigo-900 font-mono font-bold bg-indigo-50/30">
                        {stats.devContPct}% Share
                      </td>
                      {stats.monthlyData.map((m) => {
                        const isHovered = hoveredMonth === m.month;
                        return (
                          <td
                            key={m.month}
                            className={`p-1.5 border-r border-slate-200 text-center font-bold text-slate-900 font-mono ${
                              isHovered ? 'bg-slate-100' : ''
                            }`}
                          >
                            {m.devCount}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Sub-row 2.2: Within SLA (≤180d) */}
                    <tr className="hover:bg-slate-50 transition-colors text-slate-700 text-[11px]">
                      <td className="p-1.5 pl-6 border-r border-slate-200 font-sans text-slate-700 sticky left-0 bg-white z-10 w-[195px] min-w-[195px] max-w-[195px]">
                        <span className="truncate">Within SLA (≤180d)</span>
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      {stats.monthlyData.map((m) => {
                        const isHovered = hoveredMonth === m.month;
                        return (
                          <td
                            key={m.month}
                            className={`p-1.5 border-r border-slate-200 text-center text-indigo-700 font-bold font-mono ${
                              isHovered ? 'bg-slate-100' : ''
                            }`}
                          >
                            {m.devWithinSla}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Sub-row 2.3: Outside SLA (>180d) */}
                    <tr className="hover:bg-slate-50 transition-colors text-slate-700 text-[11px]">
                      <td className="p-1.5 pl-6 border-r border-slate-200 font-sans text-slate-700 sticky left-0 bg-white z-10 w-[195px] min-w-[195px] max-w-[195px]">
                        <span className="truncate">Outside SLA (&gt;180d)</span>
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      {stats.monthlyData.map((m) => {
                        const isHovered = hoveredMonth === m.month;
                        return (
                          <td
                            key={m.month}
                            className={`p-1.5 border-r border-slate-200 text-center font-mono ${
                              m.devOutsideSla > 0
                                ? 'text-rose-600 font-bold bg-rose-50/50'
                                : 'text-slate-400'
                            } ${isHovered ? 'bg-slate-100' : ''}`}
                          >
                            {m.devOutsideSla}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Sub-row 2.4: Unresolved Cases */}
                    <tr className="hover:bg-slate-50 transition-colors italic text-slate-500 text-[11px]">
                      <td className="p-1.5 pl-6 border-r border-slate-200 font-sans sticky left-0 bg-white z-10 w-[195px] min-w-[195px] max-w-[195px]">
                        <span className="truncate">Unresolved Cases</span>
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      {stats.monthlyData.map((m) => {
                        const isHovered = hoveredMonth === m.month;
                        return (
                          <td
                            key={m.month}
                            className={`p-1.5 border-r border-slate-200 text-center font-mono text-slate-600 ${
                              isHovered ? 'bg-slate-100' : ''
                            }`}
                          >
                            {m.devUnresolved}
                          </td>
                        );
                      })}
                    </tr>
                  </>
                )}

                {/* 🔴 SECTION 3: TOTAL CFI ACTUAL (Light Red Theme matching Internal CCF KPI) */}
                <tr className="bg-rose-800 text-white font-sans font-black text-xs border-y-2 border-red-500 shadow-2xs divide-x divide-rose-700">
                  <td className="p-2 border-r border-rose-700 flex items-center gap-1.5 sticky left-0 bg-rose-800 text-white z-10 w-[195px] min-w-[195px] max-w-[195px]">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
                    <span className="uppercase tracking-wider font-extrabold text-white text-[11px] truncate">Total (TOTAL CFI ACTUAL)</span>
                  </td>
                  <td className="p-2 border-r border-rose-700 text-center text-white font-mono font-extrabold bg-rose-800">100%</td>
                  <td className="p-2 border-r border-rose-700 text-center text-white font-mono font-extrabold bg-rose-800">100% Weight</td>
                  {stats.monthlyData.map((m) => {
                    const isHovered = hoveredMonth === m.month;
                    return (
                      <td
                        key={m.month}
                        className={`p-1.5 border-r border-rose-700 text-center font-black font-mono text-white text-[11px] whitespace-nowrap transition-all ${
                          isHovered ? 'bg-rose-700' : 'bg-rose-800'
                        }`}
                      >
                        {m.totalCfiPct.toFixed(1)}%
                      </td>
                    );
                  })}
                </tr>

                {/* Sub-row 3.1: Glide Target */}
                <tr className="bg-slate-100/80 text-slate-700 font-sans font-semibold italic text-[11px]">
                  <td className="p-1.5 pl-6 border-r border-slate-200 flex items-center justify-between sticky left-0 bg-slate-100 z-10 w-[195px] min-w-[195px] max-w-[195px]">
                    <span className="truncate">Glide Target Benchmark</span>
                    <span className="text-[9px] text-slate-500 font-mono not-italic shrink-0">Contracted</span>
                  </td>
                  <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                  <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                  {stats.monthlyData.map((m) => {
                    const isHovered = hoveredMonth === m.month;
                    return (
                      <td
                        key={m.month}
                        className={`p-1.5 border-r border-slate-200 text-center text-slate-700 font-mono font-bold ${
                          isHovered ? 'bg-slate-200' : ''
                        }`}
                      >
                        {m.glidePct}%
                      </td>
                    );
                  })}
                </tr>

                {/* Sub-row 3.2: Performance Variance vs Glide */}
                <tr className="bg-rose-50/50 text-slate-900 font-sans font-bold text-[11px]">
                  <td className="p-1.5 pl-6 border-r border-slate-200 flex items-center justify-between sticky left-0 bg-rose-50/80 z-10 w-[195px] min-w-[195px] max-w-[195px]">
                    <span className="truncate">Performance Variance vs Glide</span>
                    <span className="text-[9px] text-rose-700 font-mono shrink-0">Buffer</span>
                  </td>
                  <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                  <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                  {stats.monthlyData.map((m) => {
                    const isHovered = hoveredMonth === m.month;
                    const diff = m.totalCfiPct - m.glidePct;
                    const isPositive = diff >= 0;
                    return (
                      <td
                        key={m.month}
                        className={`p-1.5 border-r border-slate-200 text-center font-mono ${
                          isHovered ? 'bg-rose-100/70' : ''
                        }`}
                      >
                        <span
                          className={`inline-block px-1 py-0.5 rounded text-[9px] ${
                            isPositive
                              ? 'text-emerald-950 bg-emerald-200/90 border border-emerald-400 font-black'
                              : 'text-rose-950 bg-rose-200/90 border border-rose-400 font-black'
                          }`}
                        >
                          {isPositive ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`}
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* 📊 SECTION 4: OPERATIONAL CASE VOLUME METRICS (Light Slate Header) */}
                <tr className="bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 text-slate-900 font-sans font-extrabold text-[11px] border-t-2 border-slate-300">
                  <td className="p-1.5 px-2 border-r border-slate-300/80 flex items-center justify-between gap-1.5 sticky left-0 bg-slate-200 z-10 w-[195px] min-w-[195px] max-w-[195px]">
                    <button
                      onClick={() => toggleSection('volume')}
                      className="flex items-center gap-1.5 hover:text-slate-900 transition-colors text-left cursor-pointer min-w-0"
                    >
                      {collapsedSections.volume ? (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                      )}
                      <Layers className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span className="tracking-tight text-slate-900 font-extrabold text-[11px] truncate">Case Volume Operational Metrics</span>
                    </button>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-300 text-slate-900 border border-slate-400 font-bold shrink-0">
                      Pool
                    </span>
                  </td>
                  <td className="p-1.5 border-r border-slate-300/80 text-center text-slate-400 font-mono">-</td>
                  <td className="p-1.5 border-r border-slate-300/80 text-center text-slate-400 font-mono">-</td>
                  {stats.monthlyData.map((m) => (
                    <td key={m.month} className="p-1.5 border-r border-slate-300/80 text-center font-mono font-bold text-slate-900">
                      {m.totalCases}
                    </td>
                  ))}
                </tr>

                {!collapsedSections.volume && (
                  <>
                    <tr className="hover:bg-slate-50 transition-colors italic text-slate-700 text-[11px]">
                      <td className="p-1.5 pl-6 border-r border-slate-200 font-sans font-medium flex items-center justify-between sticky left-0 bg-white z-10 w-[195px] min-w-[195px] max-w-[195px]">
                        <span className="truncate">TOTAL Cumulative Cases</span>
                        <span className="text-[9px] text-slate-400 font-mono not-italic shrink-0">Pool</span>
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      {stats.monthlyData.map((m) => {
                        const isHovered = hoveredMonth === m.month;
                        return (
                          <td
                            key={m.month}
                            className={`p-1.5 border-r border-slate-200 text-center font-extrabold text-slate-900 font-mono ${
                              isHovered ? 'bg-slate-100' : ''
                            }`}
                          >
                            {m.totalCases}
                          </td>
                        );
                      })}
                    </tr>

                    <tr className="hover:bg-slate-50 transition-colors italic text-slate-600 text-[11px]">
                      <td className="p-1.5 pl-6 border-r border-slate-200 font-sans sticky left-0 bg-white z-10 w-[195px] min-w-[195px] max-w-[195px]">
                        <span className="truncate">For Monitoring / Completed</span>
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      {stats.monthlyData.map((m) => {
                        const isHovered = hoveredMonth === m.month;
                        return (
                          <td
                            key={m.month}
                            className={`p-1.5 border-r border-slate-200 text-center font-semibold text-emerald-700 font-mono ${
                              isHovered ? 'bg-slate-100' : ''
                            }`}
                          >
                            {m.forMonitoringCompleted}
                          </td>
                        );
                      })}
                    </tr>

                    <tr className="hover:bg-slate-50 transition-colors italic text-slate-600 text-[11px]">
                      <td className="p-1.5 pl-6 border-r border-slate-200 font-sans sticky left-0 bg-white z-10 w-[195px] min-w-[195px] max-w-[195px]">
                        <span className="truncate">Active Cases Pool</span>
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      {stats.monthlyData.map((m) => {
                        const isHovered = hoveredMonth === m.month;
                        return (
                          <td
                            key={m.month}
                            className={`p-1.5 border-r border-slate-200 text-center font-semibold text-indigo-700 font-mono ${
                              isHovered ? 'bg-slate-100' : ''
                            }`}
                          >
                            {m.activeCases}
                          </td>
                        );
                      })}
                    </tr>

                    <tr className="bg-slate-50 text-slate-700 italic font-semibold text-[11px]">
                      <td className="p-1.5 pl-6 border-r border-slate-200 font-sans sticky left-0 bg-slate-50 z-10 w-[195px] min-w-[195px] max-w-[195px]">
                        <span className="truncate">% Closed / Monitored</span>
                      </td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      <td className="p-1.5 border-r border-slate-200 text-center text-slate-300 font-mono">-</td>
                      {stats.monthlyData.map((m) => {
                        const isHovered = hoveredMonth === m.month;
                        return (
                          <td
                            key={m.month}
                            className={`p-1.5 border-r border-slate-200 text-center font-mono font-bold text-slate-800 ${
                              isHovered ? 'bg-slate-100' : ''
                            }`}
                          >
                            {m.pctClosed}%
                          </td>
                        );
                      })}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>

      {/* TAB 3: EXECUTIVE TREND & ANALYTICS VIEW */}
      <div id="kpi-section-trend" style={{ display: activeTab === 'cards' ? 'block' : 'none' }}>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* BEAUTIFULLY ORGANIZED EXECUTIVE COLUMN CHART & TREND OVERLAY */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <BarChart3 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Executive Monthly CFI Column Chart &amp; Glide Trend
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Integrated 12-month column comparison: No Dev (Emerald), Dev Required (Indigo), Total CFI Score (Dark Navy) with Glide Target Trend (Rose Dashed Line).
                  </p>
                </div>
              </div>

              {/* Chart Legend Pills & Download Action */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200">
                  <span className="w-3 h-3 rounded bg-emerald-500 shadow-2xs" />
                  <span className="font-sans font-semibold text-[11px]">No Dev SLA % (80% Weight)</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200">
                  <span className="w-3 h-3 rounded bg-indigo-600 shadow-2xs" />
                  <span className="font-sans font-semibold text-[11px]">Dev SLA % (20% Weight)</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 border border-slate-800">
                  <span className="w-3 h-3 rounded bg-amber-400 shadow-2xs" />
                  <span className="font-sans font-semibold text-[11px]">Total CFI Actual %</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-900 border border-rose-200">
                  <span className="w-4 h-0 border-t-2 border-dashed border-rose-600" />
                  <span className="font-sans font-semibold text-[11px]">Glide Target (50%→90%)</span>
                </div>

                <button
                  onClick={() => exportExecutiveTrendReport(stats)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E2001A] hover:bg-[#C80017] text-white font-sans text-xs font-bold transition-all shadow-sm active:scale-95 ml-auto"
                  title="Download Executive Trend & Analytics Report (HTML/PDF)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Trend Report</span>
                </button>
              </div>
            </div>

            {/* VISUAL COLUMN CHART CONTAINER */}
            <div className="relative pt-6 pb-2">
              {/* Y-Axis Reference Grid Lines (0%, 25%, 50%, 75%, 100%, 120%) */}
              <div className="absolute inset-x-0 top-6 bottom-10 flex flex-col justify-between pointer-events-none opacity-30">
                {[120, 100, 75, 50, 25, 0].map((val) => (
                  <div key={val} className="flex items-center gap-2 w-full text-[10px] font-mono text-slate-400">
                    <span className="w-8 text-right shrink-0">{val}%</span>
                    <div className="w-full border-b border-dashed border-slate-300" />
                  </div>
                ))}
              </div>

              {/* BARS & SVG OVERLAY GRID */}
              <div className="relative h-64 pl-10 pr-2 flex items-end justify-between gap-1 z-10">
                {/* SVG Trend Lines Overlay */}
                <svg className="absolute inset-x-0 top-0 bottom-0 pl-10 pr-2 w-full h-full pointer-events-none z-20 overflow-visible" viewBox="0 0 1200 240" preserveAspectRatio="none">
                  {/* Glide Target Dashed Line */}
                  <polyline
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="3"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    points={stats.monthlyData.map((m, i) => `${(i + 0.5) * 100},${220 - (m.glidePct / 120) * 200}`).join(' ')}
                  />
                  {/* Total CFI Actual Smooth Trend Line */}
                  <polyline
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    points={stats.monthlyData.map((m, i) => `${(i + 0.5) * 100},${220 - (Math.min(m.totalCfiPct, 120) / 120) * 200}`).join(' ')}
                  />
                  {/* Glowing Points on Total CFI */}
                  {stats.monthlyData.map((m, i) => {
                    const cx = (i + 0.5) * 100;
                    const cy = 220 - (Math.min(m.totalCfiPct, 120) / 120) * 200;
                    return (
                      <circle key={m.month} cx={cx} cy={cy} r="5" fill="#1e293b" stroke="#fbbf24" strokeWidth="2.5" />
                    );
                  })}
                </svg>

                {/* MONTHLY COLUMN BAR GROUPS */}
                {stats.monthlyData.map((m) => {
                  const isSelected = selectedMonth.toLowerCase() === m.month.toLowerCase();
                  const isHovered = hoveredMonth === m.month;
                  const variance = (m.totalCfiPct - m.glidePct).toFixed(1);

                  // Scale height percentages (max 120%)
                  const noDevH = Math.min((m.noDevPct / 120) * 100, 100);
                  const devH = Math.min((m.devPct / 120) * 100, 100);
                  const totalH = Math.min((m.totalCfiPct / 120) * 100, 100);

                  return (
                    <div
                      key={m.month}
                      onClick={() => setSelectedMonth(m.month)}
                      onMouseEnter={() => setHoveredMonth(m.month)}
                      onMouseLeave={() => setHoveredMonth(null)}
                      className={`relative flex-1 flex flex-col items-center justify-end h-full group cursor-pointer transition-all p-1 rounded-xl ${
                        isSelected
                          ? 'bg-indigo-50/60 ring-2 ring-indigo-400'
                          : isHovered
                          ? 'bg-slate-100/70'
                          : ''
                      }`}
                    >
                      {/* Variance Badge Top */}
                      <div className="mb-2 z-30 transition-transform group-hover:scale-110">
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 shadow-2xs">
                          +{variance}%
                        </span>
                      </div>

                      {/* 3 Vertical Column Bars Group */}
                      <div className="w-full flex items-end justify-center gap-1 h-48 px-0.5">
                        {/* 1. No Dev Bar */}
                        <div
                          style={{ height: `${noDevH}%` }}
                          className="w-1/3 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md transition-all shadow-xs group-hover:brightness-110 relative"
                          title={`No Dev: ${m.noDevPct}%`}
                        />

                        {/* 2. Dev Required Bar */}
                        <div
                          style={{ height: `${devH}%` }}
                          className="w-1/3 bg-gradient-to-t from-indigo-700 to-indigo-500 rounded-t-md transition-all shadow-xs group-hover:brightness-110 relative"
                          title={`Dev Required: ${m.devPct}%`}
                        />

                        {/* 3. Total CFI Actual Bar */}
                        <div
                          style={{ height: `${totalH}%` }}
                          className="w-1/3 bg-gradient-to-t from-slate-900 to-slate-700 rounded-t-md transition-all shadow-xs border-t-2 border-amber-400 group-hover:brightness-110 relative"
                          title={`Total CFI Actual: ${m.totalCfiPct.toFixed(1)}%`}
                        />
                      </div>

                      {/* Month Label Base */}
                      <div className="mt-2 text-center">
                        <span className={`text-xs font-mono font-bold block ${isSelected ? 'text-indigo-900 font-black' : 'text-slate-700'}`}>
                          {m.month}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 block">
                          {m.totalCfiPct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CUMULATIVE PERIOD SELECTOR & 3 HIGH-IMPACT EXECUTIVE SUMMARY CARDS */}
          {renderExecutiveSummaryCards()}

          {/* Detailed Category Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Detailed Card 1: No Dev Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <ShieldCheck className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">No Dev Category</h3>
                    <p className="text-xs text-slate-500">80% Target | 80% Weight Contribution</p>
                  </div>
                </div>
                <span className="text-2xl font-black text-emerald-600 font-mono">
                  {stats.noDevOverallPct}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center text-xs font-mono">
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <span className="block text-slate-500 text-[10px] font-sans font-bold uppercase">Within SLA</span>
                  <span className="text-lg font-bold text-emerald-700">{stats.noDevWithinSlaCount}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="block text-slate-500 text-[10px] font-sans font-bold uppercase">Total Cases</span>
                  <span className="text-lg font-bold text-slate-900">{stats.noDevTotalCount}</span>
                </div>
                <div className="p-3 bg-emerald-100/60 rounded-xl border border-emerald-200">
                  <span className="block text-slate-700 text-[10px] font-sans font-bold uppercase">Volume Cont</span>
                  <span className="text-lg font-bold text-emerald-900">{stats.noDevContPct}%</span>
                </div>
              </div>
            </div>

            {/* Detailed Card 2: Dev Required Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <Clock className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Required Dev Category</h3>
                    <p className="text-xs text-slate-500">80% Target | 20% Weight Contribution</p>
                  </div>
                </div>
                <span className="text-2xl font-black text-indigo-600 font-mono">
                  {stats.devOverallPct}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center text-xs font-mono">
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <span className="block text-slate-500 text-[10px] font-sans font-bold uppercase">Within SLA</span>
                  <span className="text-lg font-bold text-indigo-700">{stats.devWithinSlaCount}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="block text-slate-500 text-[10px] font-sans font-bold uppercase">Total Cases</span>
                  <span className="text-lg font-bold text-slate-900">{stats.devTotalCount}</span>
                </div>
                <div className="p-3 bg-indigo-100/60 rounded-xl border border-indigo-200">
                  <span className="block text-slate-700 text-[10px] font-sans font-bold uppercase">Volume Cont</span>
                  <span className="text-lg font-bold text-indigo-900">{stats.devContPct}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* 12-Month Cumulative Cards Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>Cumulative Monthly Cards (Jan to Dec)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monthly progression of cumulative cases, segregated No Dev vs Dev performance, and CFI score.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">12 Monthly Cards</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {stats.monthlyData.map((m) => {
                const isSelected = selectedMonth.toLowerCase() === m.month.toLowerCase();
                return (
                  <div
                    key={m.month}
                    onClick={() => setSelectedMonth(m.month)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="text-sm font-bold text-slate-900 font-sans">{m.month}</span>
                      <span className="text-xs font-black font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {m.totalCfiPct.toFixed(1)}%
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs font-mono">
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="font-sans text-[11px] text-slate-500">Cumulative:</span>
                        <span className="font-bold text-slate-900">{m.totalCases} cases</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="font-sans text-[11px] text-emerald-700 font-semibold">No Dev (≤90d):</span>
                        <span className="font-bold text-emerald-800">
                          {m.noDevPct}% ({m.noDevWithinSla}/{m.noDevCount})
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="font-sans text-[11px] text-indigo-700 font-semibold">Dev (≤180d):</span>
                        <span className="font-bold text-indigo-800">
                          {m.devPct}% ({m.devWithinSla}/{m.devCount})
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 text-[11px]">
                        <span className="font-sans text-slate-400">Glide Target:</span>
                        <span className="font-bold text-slate-700">{m.glidePct}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>

      {/* TAB 3: OWNER & HOD CHANGE FACTORY INDEX (DIGITAL) */}
      <div id="kpi-section-owner-hod" style={{ display: activeTab === 'performance' ? 'block' : 'none' }}>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <ExternalChangeFactoryIndexTable
            stats={stats}
            onSelectOwner={onSelectOwnerFilter}
            onSelectHod={onSelectHodFilter}
          />
        </motion.div>
      </div>

    </div>
  );
};
