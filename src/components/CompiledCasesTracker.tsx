import React, { useState, useMemo } from 'react';
import { TranslatedCcfRow } from '../types/ccf';
import { CcfDataTable } from './CcfDataTable';
import { AVAILABLE_HODS } from '../types/allocation';
import {
  Layers,
  Box,
  Target,
  Sparkles,
  Users,
  X,
  RotateCcw,
  CheckCircle2,
  Info,
  ArrowRight,
} from 'lucide-react';

export type CompiledSource = '2026' | 'backlog' | 'on-target';

interface CompiledCasesTrackerProps {
  rows2026: TranslatedCcfRow[];
  rowsBacklog: TranslatedCcfRow[];
  rowsOnTarget: TranslatedCcfRow[]; // Completed cases (2 cases in default state)
  allOnTargetRows?: TranslatedCcfRow[]; // All 22 cases
  onNavigateToOnTargetTracker?: () => void;
  allRows: TranslatedCcfRow[];
  selectedOwnerFilter?: string;
  onClearOwnerFilter?: () => void;
  selectedHodFilter?: string;
  onSelectHod?: (hod: string) => void;
  onClearHodFilter?: () => void;
  onSelectOwner?: (owner: string) => void;
  initialSource?: '2026' | 'backlog' | 'on-target';
  initialOnlyEligible?: boolean;
}

export const CompiledCasesTracker: React.FC<CompiledCasesTrackerProps> = ({
  rows2026,
  rowsBacklog,
  rowsOnTarget,
  allOnTargetRows,
  onNavigateToOnTargetTracker,
  allRows,
  selectedOwnerFilter,
  onClearOwnerFilter,
  selectedHodFilter,
  onSelectHod,
  onClearHodFilter,
  initialSource = '2026',
  initialOnlyEligible = false,
}) => {
  const [activeSource, setActiveSource] = useState<CompiledSource>(initialSource);
  const [selectedHod, setSelectedHod] = useState<string>(() => selectedHodFilter || 'All');

  // Sync internal source state when prop changes from outside
  React.useEffect(() => {
    if (initialSource) {
      setActiveSource(initialSource);
    }
  }, [initialSource]);

  // Sync internal HOD state when prop changes from outside (e.g. HOD Team Overview click)
  React.useEffect(() => {
    if (selectedHodFilter) {
      setSelectedHod(selectedHodFilter);
    }
  }, [selectedHodFilter]);

  // Filter helper matching HOD and Owner
  const matchHodAndOwner = (r: TranslatedCcfRow, hodFilter: string, ownerFilter?: string) => {
    if (hodFilter !== 'All') {
      const rowHod = String(r.hod || '').toLowerCase().trim();
      const targetHod = hodFilter.toLowerCase().trim();
      if (rowHod !== targetHod) return false;
    }
    if (ownerFilter) {
      const rowAssignee = String(r.assignee || '').toLowerCase().trim();
      const targetOwner = ownerFilter.toLowerCase().trim();
      if (rowAssignee !== targetOwner) return false;
    }
    return true;
  };

  // Get active dataset based on selected segregated source (NEVER appended)
  const sourceBaseRows = useMemo(() => {
    if (activeSource === 'backlog') return rowsBacklog;
    if (activeSource === 'on-target') return rowsOnTarget;
    return rows2026;
  }, [activeSource, rows2026, rowsBacklog, rowsOnTarget]);

  // Dynamic counts for each of the 3 Source buttons based on active HOD and Owner filter
  const sourceCounts = useMemo(() => {
    const count2026 = rows2026.filter((r) => matchHodAndOwner(r, selectedHod, selectedOwnerFilter)).length;
    const countBacklog = rowsBacklog.filter((r) => matchHodAndOwner(r, selectedHod, selectedOwnerFilter)).length;
    const countOnTarget = rowsOnTarget.filter((r) => matchHodAndOwner(r, selectedHod, selectedOwnerFilter)).length;

    return {
      '2026': count2026,
      backlog: countBacklog,
      'on-target': countOnTarget,
    };
  }, [rows2026, rowsBacklog, rowsOnTarget, selectedHod, selectedOwnerFilter]);

  // HOD breakdown counts strictly matching the active selected source (2026 / backlog / on-target)
  const hodCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    AVAILABLE_HODS.forEach((h) => {
      counts[h] = sourceBaseRows.filter((r) => {
        const hodMatch = String(r.hod || '').toLowerCase().trim() === h.toLowerCase().trim();
        if (!hodMatch) return false;
        if (selectedOwnerFilter) {
          return String(r.assignee || '').toLowerCase().trim() === selectedOwnerFilter.toLowerCase().trim();
        }
        return true;
      }).length;
    });
    return counts;
  }, [sourceBaseRows, selectedOwnerFilter]);

  // Total matching cases in the active selected source before HOD filter
  const allHodsCount = useMemo(() => {
    if (selectedOwnerFilter) {
      return sourceBaseRows.filter(
        (r) => String(r.assignee || '').toLowerCase().trim() === selectedOwnerFilter.toLowerCase().trim()
      ).length;
    }
    return sourceBaseRows.length;
  }, [sourceBaseRows, selectedOwnerFilter]);

  // Apply HOD filter to the dataset
  const displayRows = useMemo(() => {
    if (selectedHod === 'All') return sourceBaseRows;
    return sourceBaseRows.filter(
      (r) => String(r.hod || '').toLowerCase().trim() === selectedHod.toLowerCase().trim()
    );
  }, [sourceBaseRows, selectedHod]);

  const sourceTitleMap: Record<CompiledSource, string> = {
    '2026': '2026 CCF Tracker Cases (CY26 Active & Monitored)',
    backlog: 'Backlog CCF Tracker Cases (Legacy Pipeline < 2026)',
    'on-target': 'On-Target CCF Tracker — Completed Cases (Transferred from Dev to Completed)',
  };

  const getSourceIcon = (src: CompiledSource) => {
    switch (src) {
      case '2026':
        return <Layers className="w-4 h-4" />;
      case 'backlog':
        return <Box className="w-4 h-4" />;
      case 'on-target':
        return <Target className="w-4 h-4" />;
    }
  };

  const handleSelectSource = (src: CompiledSource) => {
    setActiveSource(src);
    // Reset HOD filter to 'All' so that switching trackers immediately shows all cases for that selection
    setSelectedHod('All');
    onClearHodFilter?.();
  };

  const handleResetFilters = () => {
    setActiveSource('2026');
    setSelectedHod('All');
    onClearHodFilter?.();
    onClearOwnerFilter?.();
  };

  return (
    <div className="space-y-4">
      {/* COMPILED CONTROL HUB */}
      <div className="bg-white dark:bg-[#161a26] border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-2xs space-y-4">
        {/* Hub Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Case Sources Hub — 3 Segregated Trackers
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Navigate each source independently: switch between <strong>2026 Cases</strong>, <strong>Backlog Cases</strong>, and <strong>On-Target Cases</strong> without mixed appending.
            </p>
          </div>

          {(selectedHod !== 'All' || selectedOwnerFilter || activeSource !== '2026') && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg hover:bg-rose-100 transition-colors shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Hub View</span>
            </button>
          )}
        </div>

        {/* 1. THE 3 SEGREGATED SOURCE BUTTONS (INDIVIDUAL TRACKERS) */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Select Individual Case Source:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Button 1: 2026 Cases */}
            <button
              onClick={() => handleSelectSource('2026')}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                activeSource === '2026'
                  ? 'bg-red-50/90 dark:bg-red-950/50 border-red-500 dark:border-red-700 text-red-950 dark:text-red-100 shadow-md ring-2 ring-red-400'
                  : 'bg-white dark:bg-[#1a2030]/60 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2.5 rounded-lg ${activeSource === '2026' ? 'bg-red-600 text-white shadow-2xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold block truncate text-slate-900 dark:text-white">
                    1. 2026 CCF Tracker Cases
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    CY26 Active &amp; Monitored Cases
                  </span>
                </div>
              </div>
              <span className="text-base font-extrabold font-mono ml-2 text-red-700 dark:text-red-400">
                {sourceCounts['2026']}
              </span>
            </button>

            {/* Button 2: Backlog Cases */}
            <button
              onClick={() => handleSelectSource('backlog')}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                activeSource === 'backlog'
                  ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-500 dark:border-amber-700 text-amber-950 dark:text-amber-100 shadow-md ring-2 ring-amber-400'
                  : 'bg-white dark:bg-[#1a2030]/60 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2.5 rounded-lg ${activeSource === 'backlog' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                  <Box className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold block truncate text-slate-900 dark:text-white">
                    2. Backlog CCF Tracker Cases
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Legacy Pipeline (&lt; 2026)
                  </span>
                </div>
              </div>
              <span className="text-base font-extrabold font-mono ml-2 text-amber-700 dark:text-amber-400">
                {sourceCounts.backlog}
              </span>
            </button>

            {/* Button 3: On-Target Cases */}
            <button
              onClick={() => handleSelectSource('on-target')}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                activeSource === 'on-target'
                  ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100 shadow-md ring-2 ring-emerald-400'
                  : 'bg-white dark:bg-[#1a2030]/60 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2.5 rounded-lg ${activeSource === 'on-target' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold block truncate text-slate-900 dark:text-white">
                    3. On-Target Completed Cases
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Transferred from Dev to Completed ({rowsOnTarget.length} Cases)
                  </span>
                </div>
              </div>
              <span className="text-base font-extrabold font-mono ml-2 text-emerald-700 dark:text-emerald-400">
                {sourceCounts['on-target']}
              </span>
            </button>
          </div>
        </div>

        {/* 2. HOD (HEAD OF DEPARTMENT) SELECTOR BAR */}
        <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Filter by Head of Department (HOD):</span>
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                {activeSource === '2026' ? '2026 CCF' : activeSource === 'backlog' ? 'Backlog CCF' : 'On-Target CCF'} ({allHodsCount})
              </span>
            </div>
            {selectedHod !== 'All' && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Showing cases belonging to <strong>HOD: {selectedHod}</strong>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* All HODs Pill */}
            <button
              onClick={() => {
                setSelectedHod('All');
                onClearHodFilter?.();
              }}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                selectedHod === 'All'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white dark:bg-[#1a2030] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              All HODs ({allHodsCount})
            </button>

            {/* Individual HOD Pills with dynamic counts */}
            {AVAILABLE_HODS.map((hodName) => {
              const isSelected = selectedHod === hodName;
              const count = hodCounts[hodName] || 0;
              return (
                <button
                  key={hodName}
                  onClick={() => {
                    setSelectedHod(hodName);
                    onSelectHod?.(hodName);
                  }}
                  className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-red-600 text-white border-red-600 shadow-xs'
                      : 'bg-white dark:bg-[#1a2030] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span>{hodName}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isSelected ? 'bg-red-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected HOD & Source Status Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-[#121622] p-2.5 rounded-lg border border-slate-200/80 dark:border-white/5 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
              {getSourceIcon(activeSource)}
              <span>Active View:</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-white dark:bg-[#1a2030] border border-slate-200 dark:border-white/10 font-bold text-red-600 dark:text-red-400">
              {activeSource === '2026'
                ? '2026 CCF Tracker'
                : activeSource === 'backlog'
                ? 'Backlog CCF Tracker'
                : 'On-Target CCF Tracker'}
            </span>
            {selectedHod !== 'All' && (
              <span className="px-2 py-0.5 rounded bg-white dark:bg-[#1a2030] border border-slate-200 dark:border-white/10 font-bold text-slate-800 dark:text-slate-200">
                HOD: {selectedHod}
              </span>
            )}
            {selectedOwnerFilter && (
              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-bold flex items-center gap-1">
                <span>Owner: {selectedOwnerFilter}</span>
                <button onClick={onClearOwnerFilter} className="hover:text-rose-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          <span className="font-mono text-slate-500 font-semibold text-[11px]">
            {displayRows.length} cases matching active hub selection
          </span>
        </div>
      </div>

      {/* On-Target Completed Notice & Navigation to Full 22-case Tracker */}
      {activeSource === 'on-target' && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-950 dark:text-emerald-100 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Showing only the <strong>{rowsOnTarget.length} Completed Cases</strong> (transferred from Under Development to Completed) contributing to the <strong>708 Compiled Total</strong>.
            </span>
          </div>
          {onNavigateToOnTargetTracker && (
            <button
              onClick={onNavigateToOnTargetTracker}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <span>Open Full On-Target Tracker ({allOnTargetRows?.length || 22} Cases)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* EMBEDDED DATATABLE WITH FULL DYNAMIC CASCADING FILTERS */}
      <CcfDataTable
        rows={displayRows}
        title={`${sourceTitleMap[activeSource]}${selectedHod !== 'All' ? ` — HOD: ${selectedHod}` : ''}`}
        defaultFilterCategory="All"
        selectedOwnerFilter={selectedOwnerFilter}
        onClearOwnerFilter={onClearOwnerFilter}
        isBacklogTracker={activeSource === 'backlog'}
        isOnTargetTracker={activeSource === 'on-target'}
        initialOnlyEligible={initialOnlyEligible}
      />
    </div>
  );
};
