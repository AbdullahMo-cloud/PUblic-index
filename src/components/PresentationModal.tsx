import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  TrendingUp,
  Globe2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { CcfAggregateStats, ExternalKpiStats, OwnerIndexSummary } from '../types/ccf';
import { exportKpiPresentation } from '../utils/pptxExport';

interface PresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  internalStats: CcfAggregateStats;
  externalStats: ExternalKpiStats;
  internalOwnerSummaries: OwnerIndexSummary[];
  totalRows: number;
  count2026: number;
  countBacklog: number;
  countExternal: number;
}

export const PresentationModal: React.FC<PresentationModalProps> = ({
  isOpen,
  onClose,
  internalStats,
  externalStats,
  internalOwnerSummaries,
  totalRows,
  count2026,
  countBacklog,
  countExternal,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isExportingPptx, setIsExportingPptx] = useState(false);

  const internalStatus =
    internalStats.overallIndex >= internalStats.targetIndex ? 'Target Met' : 'Under Target';
  const externalStatus =
    externalStats.externalSlaPct >= externalStats.targetIndex ? 'Target Met' : 'Under Target';
  const breachedExternal = Math.max(0, externalStats.totalExternalCases - externalStats.withinSlaCount);
  const blendedSlaPct =
    internalStats.totalCases > 0
      ? Math.round(
          ((internalStats.newCasesWithinSla + internalStats.oldCasesWithinSla) /
            internalStats.totalCases) *
            100
        )
      : 0;

  // Keyboard navigation (Arrow keys + Esc)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setCurrentSlide((prev) => Math.min(prev + 1, 3));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleExportPpt = async () => {
    try {
      setIsExportingPptx(true);
      await exportKpiPresentation({
        internalStats,
        externalStats,
        internalOwnerSummaries,
        totalRows,
        count2026,
        countBacklog,
        countExternal,
      });
    } catch (err) {
      console.error('Failed to export PPTX', err);
    } finally {
      setIsExportingPptx(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-between p-4 sm:p-6 overflow-hidden select-none">
      {/* Top Presentation Control Bar */}
      <div className="w-full max-w-6xl flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-white shadow-2xl shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-[#E30613] tracking-tight">etisalat</span>
          <span className="text-slate-500">|</span>
          <span className="text-xs font-semibold text-slate-200">
            Executive 2-KPI Presentation Deck
          </span>
        </div>

        {/* Slide Selector Indicators */}
        <div className="flex items-center gap-1.5 bg-slate-950/70 px-3 py-1.5 rounded-xl border border-slate-800">
          {['Cover', 'KPI 1 (Internal)', 'KPI 2 (External)', 'Trackers Synthesis'].map(
            (label, idx) => (
              <button
                key={label}
                onClick={() => setCurrentSlide(idx)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                  currentSlide === idx
                    ? 'bg-[#E30613] text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                {idx + 1}. {label}
              </button>
            )
          )}
        </div>

        {/* Action Buttons: Download PPTX & Close */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPpt}
            disabled={isExportingPptx}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#E30613] hover:bg-red-700 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
            title="Download PowerPoint presentation file (.pptx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingPptx ? 'Generating PPT...' : 'Download PPTX'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            title="Print or Save as PDF"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            title="Close presentation (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Slide Stage (16:9 Aspect Ratio) */}
      <div className="w-full max-w-6xl flex-1 flex items-center justify-center my-4 overflow-hidden">
        <div className="w-full aspect-[16/9] max-h-[82vh] bg-slate-950 rounded-3xl border-2 border-slate-800/90 shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden relative flex flex-col justify-between p-8 sm:p-10">
          <AnimatePresence mode="wait">
            {/* SLIDE 0: Executive Cover Slide */}
            {currentSlide === 0 && (
              <motion.div
                key="slide-0"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="h-full flex flex-col justify-between"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="text-3xl font-black text-[#E30613] tracking-tight">etisalat</span>
                  <span className="text-xs font-mono text-slate-400 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10">
                    CY2026 Executive Review
                  </span>
                </div>

                {/* Cover Main Content */}
                <div className="my-auto space-y-4 max-w-3xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Change Control Factory (CCF) Performance</span>
                  </div>
                  <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                    Change Factory Index
                  </h1>
                  <p className="text-base text-slate-300 leading-relaxed">
                    Executive Governance &amp; Comprehensive Operational Performance Review for both{' '}
                    <strong className="text-white">Internal CCF KPI</strong> and{' '}
                    <strong className="text-white">External Vendor CCF KPI</strong>.
                  </p>
                </div>

                {/* Bottom Snapshot Cards */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                    <span className="text-xs text-slate-400 font-medium">KPI 1: Internal Factory Index</span>
                    <div className="text-2xl font-bold text-[#E30613] mt-1">
                      {internalStats.overallIndex.toFixed(2)}{' '}
                      <span className="text-xs text-slate-400 font-normal">/ 1.00</span>
                    </div>
                    <span className="text-[11px] text-emerald-400 mt-1 inline-block">
                      Target: {internalStats.targetIndex.toFixed(2)} ({internalStatus})
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                    <span className="text-xs text-slate-400 font-medium">KPI 2: External SLA Rate</span>
                    <div className="text-2xl font-bold text-sky-400 mt-1">
                      {externalStats.externalSlaPct.toFixed(1)}%
                    </div>
                    <span className="text-[11px] text-sky-300 mt-1 inline-block">
                      Target: {externalStats.targetIndex}% ({externalStatus})
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                    <span className="text-xs text-slate-400 font-medium">Total Ingested Dataset</span>
                    <div className="text-2xl font-bold text-white mt-1">{totalRows} Cases</div>
                    <span className="text-[11px] text-slate-400 mt-1 inline-block">
                      {count2026} CY26 · {countBacklog} Backlog · {countExternal} Vendors
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SLIDE 1: KPI 1 - Internal CCF KPI Dashboard */}
            {currentSlide === 1 && (
              <motion.div
                key="slide-1"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="h-full flex flex-col justify-between overflow-y-auto"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-[#E30613]" />
                      <span>KPI 1: Internal CCF Executive Dashboard</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Joint Formula: 50% 2026 CCF Tracker + 50% Backlog CCF Tracker
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-[#E30613]">
                      {internalStats.overallIndex.toFixed(2)}
                    </span>
                    <span className="block text-[10px] text-emerald-400 font-medium">
                      Status: {internalStatus}
                    </span>
                  </div>
                </div>

                {/* 4 Cards */}
                <div className="grid grid-cols-4 gap-3 my-3">
                  <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="text-[11px] text-slate-400 font-medium">Overall Factory Index</span>
                    <div className="text-xl font-bold text-[#E30613] mt-1">
                      {internalStats.overallIndex.toFixed(2)}
                    </div>
                    <span className="text-[10px] text-slate-400">Target: {internalStats.targetIndex.toFixed(2)}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="text-[11px] text-slate-400 font-medium">2026 Cases (50% Weight)</span>
                    <div className="text-xl font-bold text-white mt-1">{count2026}</div>
                    <span className="text-[10px] text-red-400">CY26 Tracker Volume</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="text-[11px] text-slate-400 font-medium">Backlog Cases (50% Weight)</span>
                    <div className="text-xl font-bold text-amber-400 mt-1">{countBacklog}</div>
                    <span className="text-[10px] text-slate-400">Legacy Resolutions</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="text-[11px] text-slate-400 font-medium">≤90 Days SLA Rate</span>
                    <div className="text-xl font-bold text-emerald-400 mt-1">
                      {blendedSlaPct}%
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {internalStats.newCasesWithinSla + internalStats.oldCasesWithinSla} Cases On Time
                    </span>
                  </div>
                </div>

                {/* Owners Summary Table */}
                <div className="flex-1 overflow-hidden border border-white/10 rounded-xl bg-slate-900/60">
                  <div className="p-2.5 bg-slate-900 border-b border-white/10 text-xs font-semibold text-slate-300">
                    Top Assignees &amp; Factory Index Rankings
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-950 text-slate-400 font-mono text-[10px]">
                        <tr>
                          <th className="px-3 py-1.5">Owner</th>
                          <th className="px-3 py-1.5 text-center">Cases</th>
                          <th className="px-3 py-1.5 text-center">Closed</th>
                          <th className="px-3 py-1.5 text-center">On Target %</th>
                          <th className="px-3 py-1.5 text-center">Factory Index %</th>
                          <th className="px-3 py-1.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-300 font-mono text-[11px]">
                        {internalOwnerSummaries.slice(0, 5).map((owner) => {
                          const ownerTotal = owner.newCasesCount + owner.oldCasesCount;
                          const isMet = owner.changeFactoryIndex >= 90;
                          return (
                            <tr key={owner.owner} className="hover:bg-white/[0.03]">
                              <td className="px-3 py-1.5 font-sans font-medium text-white">{owner.owner}</td>
                              <td className="px-3 py-1.5 text-center">{ownerTotal}</td>
                              <td className="px-3 py-1.5 text-center">{owner.onTargetCompleted}</td>
                              <td className="px-3 py-1.5 text-center">{owner.onTargetPct}%</td>
                              <td className="px-3 py-1.5 text-center font-bold text-[#E30613]">
                                {owner.changeFactoryIndex.toFixed(1)}%
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] ${
                                    isMet
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-red-500/20 text-red-300'
                                  }`}
                                >
                                  {isMet ? 'Target Met' : 'Under Target'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SLIDE 2: KPI 2 - External CCF KPI Dashboard */}
            {currentSlide === 2 && (
              <motion.div
                key="slide-2"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="h-full flex flex-col justify-between overflow-y-auto"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Globe2 className="w-5 h-5 text-sky-400" />
                      <span>KPI 2: External CCF Vendor Performance Dashboard</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Third-Party Vendors, Partners &amp; System Integration SLA Compliance
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-sky-400">
                      {externalStats.externalSlaPct.toFixed(1)}%
                    </span>
                    <span className="block text-[10px] text-sky-300 font-medium">
                      Status: {externalStatus}
                    </span>
                  </div>
                </div>

                {/* 4 Cards */}
                <div className="grid grid-cols-4 gap-3 my-3">
                  <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="text-[11px] text-slate-400 font-medium">External SLA Compliance</span>
                    <div className="text-xl font-bold text-sky-400 mt-1">
                      {externalStats.externalSlaPct.toFixed(1)}%
                    </div>
                    <span className="text-[10px] text-slate-400">Target: {externalStats.targetIndex}%</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="text-[11px] text-slate-400 font-medium">Total External Cases</span>
                    <div className="text-xl font-bold text-white mt-1">
                      {externalStats.totalExternalCases}
                    </div>
                    <span className="text-[10px] text-slate-400">All Vendor CCFs</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="text-[11px] text-slate-400 font-medium">Within SLA Cases</span>
                    <div className="text-xl font-bold text-emerald-400 mt-1">
                      {externalStats.withinSlaCount}
                    </div>
                    <span className="text-[10px] text-slate-400">Compliance Met</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10">
                    <span className="text-[11px] text-slate-400 font-medium">Breached SLA Cases</span>
                    <div className="text-xl font-bold text-[#E30613] mt-1">
                      {breachedExternal}
                    </div>
                    <span className="text-[10px] text-red-400">Escalation Required</span>
                  </div>
                </div>

                {/* Vendor Distribution Table */}
                <div className="flex-1 overflow-hidden border border-white/10 rounded-xl bg-slate-900/60">
                  <div className="p-2.5 bg-slate-900 border-b border-white/10 text-xs font-semibold text-slate-300">
                    Vendor Partner Performance Breakdown
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-950 text-slate-400 font-mono text-[10px]">
                        <tr>
                          <th className="px-3 py-1.5">Vendor Partner</th>
                          <th className="px-3 py-1.5 text-center">Cases</th>
                          <th className="px-3 py-1.5 text-center">Within SLA</th>
                          <th className="px-3 py-1.5 text-center">Breached</th>
                          <th className="px-3 py-1.5 text-center">SLA Compliance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-300 font-mono text-[11px]">
                        {externalStats.partnerBreakdown && externalStats.partnerBreakdown.length > 0 ? (
                          externalStats.partnerBreakdown.slice(0, 5).map((vendor) => {
                            const vBreached = Math.max(0, vendor.total - vendor.withinSla);
                            return (
                              <tr key={vendor.partner} className="hover:bg-white/[0.03]">
                                <td className="px-3 py-1.5 font-sans font-medium text-white">{vendor.partner}</td>
                                <td className="px-3 py-1.5 text-center">{vendor.total}</td>
                                <td className="px-3 py-1.5 text-center text-emerald-400">{vendor.withinSla}</td>
                                <td className="px-3 py-1.5 text-center text-red-400">{vBreached}</td>
                                <td className="px-3 py-1.5 text-center font-bold text-sky-400">
                                  {vendor.slaPct.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td className="px-3 py-1.5 font-sans font-medium text-white">Aggregated Vendor Pool</td>
                            <td className="px-3 py-1.5 text-center">{externalStats.totalExternalCases}</td>
                            <td className="px-3 py-1.5 text-center text-emerald-400">{externalStats.withinSlaCount}</td>
                            <td className="px-3 py-1.5 text-center text-red-400">{breachedExternal}</td>
                            <td className="px-3 py-1.5 text-center font-bold text-sky-400">
                              {externalStats.externalSlaPct.toFixed(1)}%
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SLIDE 3: Trackers Operational Synthesis */}
            {currentSlide === 3 && (
              <motion.div
                key="slide-3"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="h-full flex flex-col justify-between"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Layers className="w-5 h-5 text-[#E30613]" />
                      <span>Operational Trackers Synthesis</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Segregation into 3 Dedicated Operational Engines
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Total: {totalRows} Processed Rows
                  </span>
                </div>

                {/* 3 Pillar Cards */}
                <div className="grid grid-cols-3 gap-5 my-auto">
                  <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#E30613]">1. 2026 CCF Tracker</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                        {count2026} Cases
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Controls <strong className="text-white">50%</strong> of the Internal CCF KPI. Governs all new change records created in CY2026 with automated ≤90 days SLA calculations.
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-amber-400">2. Backlog CCF Tracker</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {countBacklog} Cases
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Controls <strong className="text-white">50%</strong> of the Internal CCF KPI. Governs all legacy pre-2026 cases to guarantee thorough backlog reduction.
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-sky-400">3. External CCF Tracker</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        {countExternal} Cases
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Controls <strong className="text-white">100%</strong> of the External CCF KPI. Monitors and benchmarks third-party vendor performance and service delivery.
                    </p>
                  </div>
                </div>

                <div className="text-center text-xs text-slate-500 pt-3 border-t border-white/10">
                  etisalat by e&amp; · Enterprise Change Control Factory (CCF)
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Navigation Controls */}
      <div className="w-full max-w-6xl flex items-center justify-between px-4 py-2 text-xs text-slate-400 shrink-0">
        <button
          onClick={() => setCurrentSlide((prev) => Math.max(prev - 1, 0))}
          disabled={currentSlide === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-medium hover:bg-slate-800 disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous Slide</span>
        </button>

        <span>
          Slide <strong className="text-white">{currentSlide + 1}</strong> of 4
        </span>

        <button
          onClick={() => setCurrentSlide((prev) => Math.min(prev + 1, 3))}
          disabled={currentSlide === 3}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-medium hover:bg-slate-800 disabled:opacity-40 transition-colors"
        >
          <span>Next Slide</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
