import React, { useState, useMemo, useRef, useEffect } from 'react';
import { OwnerIndexSummary } from '../types/ccf';
import { Filter, Search, ArrowUpDown, Download, CheckCircle2, ChevronDown, FileSpreadsheet, Printer, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';
import { EtisalatLogo } from './EtisalatLogo';
import { calculateChangeFactoryIndex } from '../utils/dataParser';
import { exportInternalCfiTableReport, exportInternalCfiTableExcel } from '../utils/reportExport';

interface ChangeFactoryIndexTableProps {
  summaries: OwnerIndexSummary[];
  onSelectOwner?: (owner: string, tracker?: '2026' | 'backlog' | 'compiled', onlyEligible?: boolean) => void;
  onNavigateTo2026Tracker?: () => void;
  onNavigateToBacklogTracker?: () => void;
}

export const ChangeFactoryIndexTable: React.FC<ChangeFactoryIndexTableProps> = ({
  summaries,
  onSelectOwner,
}) => {
  const [selectedHod, setSelectedHod] = useState<string>('ALL');
  const [searchOwner, setSearchOwner] = useState<string>('');
  const [sortField, setSortField] = useState<keyof OwnerIndexSummary>('changeFactoryIndex');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Unique HODs for filter dropdown
  const hodList = useMemo(() => {
    const set = new Set<string>();
    summaries.forEach((s) => {
      if (s.hod) set.add(s.hod);
    });
    return Array.from(set).sort();
  }, [summaries]);

  // Filtered and sorted summaries
  const filteredSummaries = useMemo(() => {
    return summaries
      .filter((s) => {
        const matchesHod = selectedHod === 'ALL' || s.hod.toLowerCase() === selectedHod.toLowerCase();
        const matchesSearch =
          !searchOwner ||
          s.owner.toLowerCase().includes(searchOwner.toLowerCase()) ||
          s.hod.toLowerCase().includes(searchOwner.toLowerCase());
        return matchesHod && matchesSearch;
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
  }, [summaries, selectedHod, searchOwner, sortField, sortAsc]);

  // Totals calculation
  const totals = useMemo(() => {
    let newCount = 0;
    let newDenominator = 0;
    let newWithin = 0;
    let oldCount = 0;
    let oldWithin = 0;
    let onTargetCount = 0;
    let onTargetDone = 0;

    summaries.forEach((s) => {
      newCount += s.newCasesCount;
      newDenominator += s.newCasesDenominator;
      newWithin += s.newCasesWithinSla;
      oldCount += s.oldCasesCount;
      oldWithin += s.oldCasesWithinSla;
      onTargetCount += s.onTargetCount;
      onTargetDone += s.onTargetCompleted;
    });

    const newPct = newDenominator > 0 ? Math.round((newWithin / newDenominator) * 100) : 0;
    const oldPct = oldCount > 0 ? Math.round((oldWithin / oldCount) * 100) : 0;
    const onTargetPct = onTargetCount > 0 ? Math.round((onTargetDone / onTargetCount) * 100) : 0;

    const hasNew = newDenominator > 0;
    const newRate = hasNew ? newWithin / newDenominator : null;
    const hasOld = oldCount > 0;
    const oldRate = hasOld ? oldWithin / oldCount : null;
    const hasOnTarget = onTargetCount > 0;
    const onTargetRate = hasOnTarget ? onTargetDone / onTargetCount : null;

    const totalIndex = calculateChangeFactoryIndex(
      hasNew,
      newRate,
      hasOld,
      oldRate,
      hasOnTarget,
      onTargetRate
    );

    return {
      newCount,
      newWithin,
      newPct,
      oldCount,
      oldWithin,
      oldPct,
      onTargetCount,
      onTargetDone,
      onTargetPct,
      totalIndex,
    };
  }, [summaries]);

  const handleSort = (field: keyof OwnerIndexSummary) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleExportThemedHtml = () => {
    setIsExportMenuOpen(false);
    exportInternalCfiTableReport({
      summaries: filteredSummaries,
      totals,
      selectedHod,
      searchOwner,
    });
  };

  const handleExportThemedExcel = () => {
    setIsExportMenuOpen(false);
    exportInternalCfiTableExcel({
      summaries: filteredSummaries,
      totals,
      selectedHod,
      searchOwner,
    });
  };

  const exportTableToExcel = () => {
    setIsExportMenuOpen(false);
    const data = filteredSummaries.map((s) => ({
      Owner: s.owner,
      HOD: s.hod,
      'YTD New (80%)': `${s.newCasesPct}%`,
      'YTD Old (80%)': `${s.oldCasesPct}%`,
      'YTD On Target': `${s.onTargetPct}%`,
      'INDEX': `${s.changeFactoryIndex}%`,
      'New Cases Count': s.newCasesCount,
      'New Cases Within SLA': s.newCasesWithinSla,
      'New Cases %': `${s.newCasesPct}%`,
      'Old Cases Count': s.oldCasesCount,
      'Old Cases Within SLA': s.oldCasesWithinSla,
      'Old Cases %': `${s.oldCasesPct}%`,
      'On Target Count': s.onTargetCount,
      'On Target Done': s.onTargetCompleted,
      'On Target %': `${s.onTargetPct}%`,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Change Factory Index');
    XLSX.writeFile(wb, 'Change_Factory_Index_Matrix_Etisalat.xlsx');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Table Header Controls matching image c1494983 */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80">
        <div className="flex items-center gap-3">
          <EtisalatLogo size={24} />
          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
            <span>Filter HOD:</span>
          </div>
          <select
            value={selectedHod}
            onChange={(e) => setSelectedHod(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
          >
            <option value="ALL">All HODs ({hodList.length})</option>
            {hodList.map((hod) => (
              <option key={hod} value={hod}>
                {hod}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchOwner}
              onChange={(e) => setSearchOwner(e.target.value)}
              placeholder="Search Owner name..."
              className="text-xs bg-white border border-slate-200 rounded pl-8 pr-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-500 placeholder:text-slate-400 w-48"
            />
          </div>

          {/* Export Table Button: Downloads Excel with App Theme & Colors */}
          <div className="relative" ref={exportMenuRef}>
            <div className="inline-flex rounded-lg shadow-2xs border border-slate-200 overflow-hidden bg-white hover:border-slate-300 transition-colors">
              <button
                onClick={handleExportThemedExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Export Table as Excel (.xls with App Theme & Red Variance Colors)"
              >
                <Download className="w-3.5 h-3.5 text-rose-600" />
                <span>Export Table</span>
              </button>
              <button
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                className="px-1.5 py-1.5 border-l border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                title="Choose Excel or Report Formats"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Dropdown Menu for Theme & Colors selection */}
            {isExportMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-xl border border-slate-200 shadow-xl p-1.5 z-40 text-xs">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Export Options
                </div>
                <button
                  onClick={handleExportThemedExcel}
                  className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-emerald-50 text-slate-800 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Themed Excel Sheet (.xls)</span>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold uppercase">Default</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Opens in Excel with dark red, med red, light red headers &amp; peach index column preserved.
                    </div>
                  </div>
                </button>

                <button
                  onClick={exportTableToExcel}
                  className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-700">Raw Excel Workbook (.xlsx)</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Standard clean spreadsheet table</div>
                  </div>
                </button>

                <button
                  onClick={handleExportThemedHtml}
                  className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-rose-50 text-slate-800 transition-colors cursor-pointer border-t border-slate-100 mt-1 pt-1.5"
                >
                  <Printer className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Print / PDF Table Report (HTML)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Formatted standalone view with Print/Save as PDF button.
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Structured Spreadsheet Header replicating the user's Sheet screenshot */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            {/* Top Red Bar: Section Group Headers */}
            <tr className="bg-rose-900 text-white font-semibold text-[11px] tracking-wide divide-x divide-rose-800">
              <th colSpan={2} className="px-3 py-2 text-center bg-rose-950 font-bold uppercase tracking-wider">
                CHANGE FACTORY INDEX
              </th>
              <th colSpan={4} className="px-3 py-2 text-center bg-rose-900 uppercase">
                YTD (90% TARGET)
              </th>
              <th colSpan={3} className="px-3 py-2 text-center bg-rose-800 uppercase">
                NEW CASES (80%)
              </th>
              <th colSpan={3} className="px-3 py-2 text-center bg-rose-900 uppercase">
                OLD CASES (80%)
              </th>
              <th colSpan={3} className="px-3 py-2 text-center bg-rose-950 uppercase">
                FROM UNDER DEV TO COMPLETED (TARGET 80% • 10% WT)
              </th>
            </tr>

            {/* Sub-Headers Row */}
            <tr className="bg-slate-100 text-slate-700 font-medium text-[11px] border-b border-slate-200 divide-x divide-slate-200">
              <th
                onClick={() => handleSort('owner')}
                className="px-3 py-2 cursor-pointer hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>Owner</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('hod')}
                className="px-3 py-2 cursor-pointer hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>HOD</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              {/* YTD Group */}
              <th className="px-2.5 py-2 text-right font-mono whitespace-nowrap">NEW CASES (80%)</th>
              <th className="px-2.5 py-2 text-right font-mono whitespace-nowrap">OLD CASES (80%)</th>
              <th className="px-2.5 py-2 text-right font-mono whitespace-nowrap">ON TARGET</th>
              <th
                onClick={() => handleSort('changeFactoryIndex')}
                className="px-3 py-2 text-right font-mono font-bold bg-slate-200/60 cursor-pointer hover:bg-slate-200 whitespace-nowrap text-rose-900"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>INDEX</span>
                  <ArrowUpDown className="w-3 h-3 text-rose-700" />
                </div>
              </th>

              {/* New Cases Group */}
              <th className="px-2.5 py-2 text-right font-mono">Count</th>
              <th className="px-2.5 py-2 text-right font-mono">Within SLA</th>
              <th className="px-2.5 py-2 text-right font-mono">%</th>

              {/* Old Cases Group */}
              <th className="px-2.5 py-2 text-right font-mono">Count</th>
              <th className="px-2.5 py-2 text-right font-mono">Within SLA</th>
              <th className="px-2.5 py-2 text-right font-mono">Within SLA %</th>

              {/* On Target Group */}
              <th className="px-2.5 py-2 text-right font-mono" title="Number of cases transferred from Under Development to Completed">Count</th>
              <th className="px-2.5 py-2 text-right font-mono" title="Cases completed on or before committed target date">On Target</th>
              <th className="px-2.5 py-2 text-right font-mono" title="On Target % (Target 80% • Weight 10%)">On Target %</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 font-normal">
            {filteredSummaries.map((s) => {
              const isIndexHigh = s.changeFactoryIndex >= 90;
              const isIndexLow = s.changeFactoryIndex < 80;
              const isNewPctHigh = s.newCasesPct >= 80;
              const isOldPctHigh = s.oldCasesPct >= 80;

              // Exact contribution breakdown calculation for tooltip
              const newContrib = s.newCasesDenominator > 0 ? Math.round((s.newCasesPct / 80) * 50 * 10) / 10 : 0;
              const oldContrib = s.oldCasesCount > 0 ? Math.round((s.oldCasesPct / 80) * 40 * 10) / 10 : 0;
              const onTargetContrib = s.onTargetContribution ?? (s.onTargetCount > 0 ? Math.round((s.onTargetPct / 80) * 10 * 10) / 10 : (s.newCasesDenominator > 0 ? 10 : 0));

              return (
                <tr
                  key={s.owner}
                  onClick={() => onSelectOwner?.(s.owner, 'compiled', true)}
                  title={`Click to view required eligible cases for ${s.owner} (2026, Backlog & On-Target) in Compiled Cases Hub`}
                  className="hover:bg-slate-50/90 transition-colors divide-x divide-slate-100 cursor-pointer"
                >
                  <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">
                    {s.owner}
                  </td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                    {s.hod}
                  </td>

                  {/* YTD Metrics */}
                  <td 
                    onClick={(e) => { e.stopPropagation(); onSelectOwner?.(s.owner, '2026', true); }}
                    className="px-2.5 py-2 text-right font-mono tabular-nums text-slate-700 cursor-pointer hover:bg-red-50 hover:text-red-900 transition-colors"
                    title={`Click to view ${s.newCasesCount} eligible cases for ${s.owner} (excluding Not Started & New) in 2026 Tracker`}
                  >
                    {s.newCasesDenominator > 0 ? `${s.newCasesPct}%` : ''}
                  </td>
                  <td 
                    onClick={(e) => { e.stopPropagation(); onSelectOwner?.(s.owner, 'backlog', true); }}
                    className="px-2.5 py-2 text-right font-mono tabular-nums text-slate-700 cursor-pointer hover:bg-amber-100 hover:text-amber-900 transition-colors"
                    title={`Click to view ${s.oldCasesCount} eligible backlog cases for ${s.owner} (excluding Not Started & Cancelled) in Backlog Tracker`}
                  >
                    {s.oldCasesCount > 0 ? `${s.oldCasesPct}%` : ''}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono tabular-nums text-slate-500">
                    {s.onTargetCount > 0 ? `${s.onTargetPct}%` : ''}
                  </td>

                  {/* INDEX Column with exact spreadsheet style conditional formatting & detailed breakdown tooltip */}
                  <td
                    title={`Index Breakdown for ${s.owner}:\n• New Cases (50% Wt): ${newContrib}%\n• Old Cases (40% Wt): ${oldContrib}%\n• On-Target (10% Wt): ${onTargetContrib}%\n= Total Index: ${s.changeFactoryIndex}%`}
                    className={`px-3 py-2 text-right font-mono tabular-nums font-bold ${
                      isIndexHigh
                        ? 'bg-red-100 text-red-900'
                        : isIndexLow
                        ? 'bg-rose-100 text-rose-900'
                        : 'bg-amber-50 text-amber-900'
                    }`}
                  >
                    {s.changeFactoryIndex}%
                  </td>

                  {/* NEW CASES (80%) Group */}
                  <td 
                    onClick={(e) => { e.stopPropagation(); onSelectOwner?.(s.owner, '2026'); }}
                    className="px-2.5 py-2 text-right font-mono tabular-nums text-slate-700 cursor-pointer hover:bg-red-50 transition-colors"
                    title="Click to view 2026 cases in 2026 Tracker"
                  >
                    {s.newCasesCount}
                  </td>
                  <td 
                    onClick={(e) => { e.stopPropagation(); onSelectOwner?.(s.owner, '2026'); }}
                    className="px-2.5 py-2 text-right font-mono tabular-nums text-slate-700 cursor-pointer hover:bg-red-50 transition-colors"
                    title="Click to view 2026 cases in 2026 Tracker"
                  >
                    {s.newCasesWithinSla}
                  </td>
                  <td
                    onClick={(e) => { e.stopPropagation(); onSelectOwner?.(s.owner, '2026'); }}
                    className={`px-2.5 py-2 text-right font-mono tabular-nums cursor-pointer hover:bg-red-50 transition-colors ${
                      s.newCasesCount > 0 && isNewPctHigh ? 'bg-red-50 font-medium text-red-800' : 'text-slate-700'
                    }`}
                    title="Click to view 2026 cases in 2026 Tracker"
                  >
                    {s.newCasesCount > 0 ? `${s.newCasesPct}%` : ''}
                  </td>

                  {/* OLD CASES (80%) Group */}
                  <td 
                    onClick={(e) => { e.stopPropagation(); onSelectOwner?.(s.owner, 'backlog'); }}
                    className="px-2.5 py-2 text-right font-mono tabular-nums text-slate-700 cursor-pointer hover:bg-amber-100 hover:text-amber-900 transition-colors"
                    title="Click to view backlog cases in Backlog Tracker"
                  >
                    {s.oldCasesCount}
                  </td>
                  <td 
                    onClick={(e) => { e.stopPropagation(); onSelectOwner?.(s.owner, 'backlog'); }}
                    className="px-2.5 py-2 text-right font-mono tabular-nums text-slate-700 cursor-pointer hover:bg-amber-100 hover:text-amber-900 transition-colors"
                    title="Click to view backlog cases in Backlog Tracker"
                  >
                    {s.oldCasesWithinSla}
                  </td>
                  <td
                    onClick={(e) => { e.stopPropagation(); onSelectOwner?.(s.owner, 'backlog'); }}
                    className={`px-2.5 py-2 text-right font-mono tabular-nums cursor-pointer hover:bg-amber-100 hover:text-amber-900 transition-colors ${
                      s.oldCasesCount > 0 && isOldPctHigh ? 'bg-red-50 font-medium text-red-800' : 'text-slate-700'
                    }`}
                    title="Click to view backlog cases in Backlog Tracker"
                  >
                    {s.oldCasesCount > 0 ? `${s.oldCasesPct}%` : ''}
                  </td>

                  {/* ON TARGET COMPLETION Group */}
                  <td className="px-2.5 py-2 text-right font-mono tabular-nums text-slate-600">
                    {s.onTargetCount > 0 ? s.onTargetCount : '-'}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono tabular-nums text-slate-600">
                    {s.onTargetCount > 0 ? s.onTargetCompleted : '-'}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono tabular-nums text-slate-600">
                    {s.onTargetCount > 0 ? `${s.onTargetPct}%` : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* TOTAL Row */}
          <tfoot>
            <tr className="bg-rose-950 text-white font-bold text-xs divide-x divide-rose-900 border-t-2 border-rose-900">
              <td colSpan={2} className="px-3 py-2.5 uppercase tracking-wider text-rose-100">
                TOTAL
              </td>
              <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                {totals.newPct}%
              </td>
              <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                {totals.oldPct}%
              </td>
              <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                {totals.onTargetCount > 0 ? `${totals.onTargetPct}%` : ''}
              </td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums bg-rose-900 text-white font-extrabold text-sm">
                {totals.totalIndex}%
              </td>

              {/* Total New Cases */}
              <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-rose-100">
                {totals.newCount}
              </td>
              <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-rose-100">
                {totals.newWithin}
              </td>
              <td className="px-2.5 py-2.5 text-right font-mono tabular-nums bg-rose-900 text-white">
                {totals.newPct}%
              </td>

              {/* Total Old Cases */}
              <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-rose-100">
                {totals.oldCount}
              </td>
              <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-rose-100">
                {totals.oldWithin}
              </td>
              <td className="px-2.5 py-2.5 text-right font-mono tabular-nums bg-rose-900 text-white">
                {totals.oldPct}%
              </td>

              {/* Total On Target */}
              <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-rose-100">
                {totals.onTargetCount}
              </td>
              <td className="px-2.5 py-2.5 text-right font-mono tabular-nums text-rose-100">
                {totals.onTargetDone}
              </td>
              <td className="px-2.5 py-2.5 text-right font-mono tabular-nums bg-rose-900 text-white">
                {totals.onTargetCount > 0 ? `${totals.onTargetPct}%` : ''}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
