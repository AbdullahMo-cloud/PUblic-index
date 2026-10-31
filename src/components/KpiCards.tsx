import React from 'react';
import { motion } from 'motion/react';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Archive,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { CcfAggregateStats } from '../types/ccf';

interface KpiCardsProps {
  stats: CcfAggregateStats;
  onFilterNewCases?: () => void;
  onFilterOldCases?: () => void;
  onFilterInProgress?: () => void;
  onFilterOnTarget?: () => void;
  onNavigateTo2026?: () => void;
  onNavigateToBacklog?: () => void;
  onNavigateToInProgress?: () => void;
  onNavigateToCompiled?: () => void;
  onNavigateToOnTarget?: () => void;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  stats,
  onFilterNewCases,
  onFilterOldCases,
  onFilterInProgress,
  onFilterOnTarget,
  onNavigateTo2026,
  onNavigateToBacklog,
  onNavigateToInProgress,
  onNavigateToCompiled,
  onNavigateToOnTarget,
}) => {
  const isIndexOnTarget = stats.overallIndex >= stats.targetIndex;
  const isNewCasesOnTarget = stats.newCasesSlaPct >= 80;
  const isOldCasesOnTarget = stats.oldCasesSlaPct >= 80;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* 1. CHANGE FACTORY INDEX (ETISALAT BRANDED MODERN EXECUTIVE KPI) */}
      <motion.div
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.99 }}
        onClick={onNavigateToCompiled || onNavigateTo2026}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-red-300 transition-all duration-200 p-5 flex flex-col justify-between overflow-hidden group cursor-pointer"
      >
        {/* Top Accent Stripe - Etisalat Signature red Gradient */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-red-500 to-red-600" />

        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200/80 flex items-center justify-center text-red-700 shadow-2xs">
                <TrendingUp className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 tracking-wide uppercase block">
                  Change Factory Index
                </span>
                <span className="text-[10px] text-red-700 font-semibold font-mono">
                  Etisalat Standard
                </span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-red-100/70 text-red-800 border border-red-200">
              Target {stats.targetIndex}%
            </span>
          </div>

          {/* Metric */}
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 tracking-tight">
              {stats.overallIndex}%
            </span>
            <span className="text-xs font-semibold text-slate-500 font-mono">
              YTD Composite
            </span>
          </div>

          {/* Clean Solid Progress Bar with Etisalat red */}
          <div className="mt-3.5 space-y-1.5">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(stats.overallIndex, 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-600"
              />
            </div>
          </div>

          {/* Status Badge */}
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {isIndexOnTarget ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200/60 font-semibold">
                <ArrowUpRight className="w-3.5 h-3.5 text-red-600" />
                <span>Exceeding Benchmark (+{stats.overallIndex - stats.targetIndex}%)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 font-semibold">
                <ArrowDownRight className="w-3.5 h-3.5 text-amber-600" />
                <span>Below Benchmark ({stats.overallIndex - stats.targetIndex}%)</span>
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Weighted SLA Average</span>
          <span className="font-mono font-bold text-slate-700 flex items-center gap-1 group-hover:text-red-700 transition-colors">
            {stats.totalCases || (stats.newCasesTotal + stats.oldCasesTotal + (stats.onTargetTotal || 2))} Cases <ArrowRight className="w-3 h-3 text-red-500" />
          </span>
        </div>
      </motion.div>

      {/* 2. NEW CASES 2026 SLA (MODERN PROFESSIONAL KPI) */}
      <motion.div
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.99 }}
        onClick={onFilterNewCases || onNavigateTo2026}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-red-300 transition-all duration-200 p-5 flex flex-col justify-between overflow-hidden group cursor-pointer"
      >
        {/* Top Accent Stripe - red slate */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 to-slate-500" />

        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-2xs">
                <Layers className="w-4 h-4 text-red-600" />
              </div>
              <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">
                New Cases (2026)
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
              Target 80%
            </span>
          </div>

          {/* Metric */}
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 tracking-tight">
              {stats.newCasesSlaPct}%
            </span>
            <span className="text-xs font-semibold text-slate-500 font-mono">
              ({stats.newCasesWithinSla}/{stats.newCasesDenominator ?? stats.newCasesTotal} ≤90d)
            </span>
          </div>

          {/* Clean Solid Progress Bar */}
          <div className="mt-3.5 space-y-1.5">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(stats.newCasesSlaPct, 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-red-500"
              />
            </div>
          </div>

          {/* Status Badge */}
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {isNewCasesOnTarget ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200/60 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-red-600" />
                <span>On Target SLA Performance</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/60 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>{80 - stats.newCasesSlaPct}% Below SLA Target</span>
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="w-full mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Created Year = 2026</span>
          <span className="font-mono font-bold text-red-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            {stats.newCasesTotal} Cases <ArrowRight className="w-3 h-3 text-red-500" />
          </span>
        </div>
      </motion.div>

      {/* 3. OLD CASES BACKLOG SLA (MODERN PROFESSIONAL KPI) */}
      <motion.div
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.99 }}
        onClick={onFilterOldCases || onNavigateToBacklog}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-amber-300 transition-all duration-200 p-5 flex flex-col justify-between overflow-hidden group cursor-pointer"
      >
        {/* Top Accent Stripe */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />

        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-2xs">
                <Archive className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">
                Old Cases (&lt;2026)
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
              Target 80%
            </span>
          </div>

          {/* Metric */}
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 tracking-tight">
              {stats.oldCasesSlaPct}%
            </span>
            <span className="text-xs font-semibold text-slate-500 font-mono">
              ({stats.oldCasesWithinSla}/{stats.oldCasesTotal} ≤180d)
            </span>
          </div>

          {/* Clean Solid Progress Bar */}
          <div className="mt-3.5 space-y-1.5">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(stats.oldCasesSlaPct, 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-amber-500"
              />
            </div>
          </div>

          {/* Status Badge */}
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {isOldCasesOnTarget ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                <span>On Target SLA Resolution</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 font-semibold">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Legacy resolution backlog</span>
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="w-full mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Created Year &lt; 2026</span>
          <span className="font-mono font-bold text-amber-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            {stats.oldCasesTotal} Eligible Cases <ArrowRight className="w-3 h-3 text-amber-500" />
          </span>
        </div>
      </motion.div>

      {/* 4. ON-TARGET COMPLETION (ETISALAT CORPORATE KPI - BENCHMARKED AGAINST 80%, 10% WEIGHT) */}
      <motion.div
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.99 }}
        onClick={onNavigateToOnTarget || onFilterOnTarget || onNavigateTo2026}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all duration-200 p-5 flex flex-col justify-between overflow-hidden group cursor-pointer"
      >
        {/* Top Accent Stripe */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />

        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">
                On-Target Completion
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              80% Target • 10% Wt
            </span>
          </div>

          {/* Metric */}
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 tracking-tight">
              {(stats.onTargetTotal ?? 0) > 0 ? `${stats.onTargetCompletionPct}%` : '100%'}
            </span>
            <span className="text-xs font-semibold text-slate-500 font-mono">
              {(stats.onTargetTotal ?? 0) > 0
                ? `(${stats.onTargetCompletionCount ?? 0} of ${stats.onTargetTotal} on-time)`
                : '(10% Benchmark Award)'}
            </span>
          </div>

          {/* Clean Solid Progress Bar */}
          <div className="mt-3.5 space-y-1.5">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((stats.onTargetTotal ?? 0) > 0 ? stats.onTargetCompletionPct : 100, 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-emerald-500"
              />
            </div>
          </div>

          {/* Status Badge */}
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {(stats.onTargetTotal ?? 0) > 0 ? (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold border ${
                  stats.onTargetCompletionPct >= 80
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                    : 'bg-amber-50 text-amber-700 border-amber-200/60'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {stats.onTargetCompletionPct >= 80 ? 'Meeting 80% Benchmark' : 'Below 80% Benchmark'}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>10% Benchmark Awarded to Index</span>
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (onNavigateToOnTarget) onNavigateToOnTarget();
            else if (onFilterOnTarget) onFilterOnTarget();
          }}
          className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 cursor-pointer"
        >
          <span>Dev → Completed Transferred</span>
          <span className="font-mono font-bold text-emerald-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            {stats.onTargetTotal ?? 2} Transferred Cases <ArrowRight className="w-3 h-3 text-emerald-500" />
          </span>
        </div>
      </motion.div>
    </div>
  );
};
