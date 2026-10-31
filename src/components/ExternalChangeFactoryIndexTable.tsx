import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ExternalKpiStats, ExternalOwnerCfiSummary, ExternalHodCfiSummary } from '../types/ccf';
import {
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Users,
  ShieldCheck,
  ChevronDown,
  Printer,
  FileSpreadsheet,
  Building2,
  Award,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  exportExternalOwnerHodTableReport,
  exportExternalOwnerHodTableExcel,
} from '../utils/reportExport';

interface ExternalChangeFactoryIndexTableProps {
  stats: ExternalKpiStats;
  onSelectOwner?: (owner: string) => void;
  onSelectHod?: (hod: string) => void;
}

export const ExternalChangeFactoryIndexTable: React.FC<ExternalChangeFactoryIndexTableProps> = ({
  stats,
  onSelectOwner,
  onSelectHod,
}) => {
  const [viewMode, setViewMode] = useState<'both' | 'owner' | 'hod'>('both');
  const [selectedHodFilter, setSelectedHodFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [ownerSortField, setOwnerSortField] = useState<keyof ExternalOwnerCfiSummary>('rank');
  const [ownerSortAsc, setOwnerSortAsc] = useState<boolean>(true);
  const [hodSortField, setHodSortField] = useState<keyof ExternalHodCfiSummary>('rank');
  const [hodSortAsc, setHodSortAsc] = useState<boolean>(true);
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

  // Distinct HODs for filter dropdown
  const hodOptions = useMemo(() => {
    const list = new Set<string>();
    (stats.ownerBreakdown || []).forEach((o) => {
      if (o.hod) list.add(o.hod);
    });
    return Array.from(list).sort();
  }, [stats.ownerBreakdown]);

  // Filtered & Sorted Owners
  const filteredOwners = useMemo(() => {
    return (stats.ownerBreakdown || [])
      .filter((o) => {
        const matchesHod = selectedHodFilter === 'ALL' || o.hod.toLowerCase() === selectedHodFilter.toLowerCase();
        const matchesSearch =
          !searchQuery ||
          o.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.assignee.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.hod.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesHod && matchesSearch;
      })
      .sort((a, b) => {
        const valA = a[ownerSortField];
        const valB = b[ownerSortField];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return ownerSortAsc ? valA - valB : valB - valA;
        }
        return ownerSortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
  }, [stats.ownerBreakdown, selectedHodFilter, searchQuery, ownerSortField, ownerSortAsc]);

  // Filtered & Sorted HODs
  const filteredHods = useMemo(() => {
    return (stats.hodBreakdown || [])
      .filter((h) => {
        const matchesSearch =
          !searchQuery || h.hod.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesHod = selectedHodFilter === 'ALL' || h.hod.toLowerCase() === selectedHodFilter.toLowerCase();
        return matchesSearch && matchesHod;
      })
      .sort((a, b) => {
        const valA = a[hodSortField];
        const valB = b[hodSortField];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return hodSortAsc ? valA - valB : valB - valA;
        }
        return hodSortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
  }, [stats.hodBreakdown, searchQuery, selectedHodFilter, hodSortField, hodSortAsc]);

  // Calculate Owner Totals
  const ownerTotals = useMemo(() => {
    const list = filteredOwners;
    const count = list.length;
    let noDevCount = 0;
    let noDevWithin = 0;
    let noDevOutside = 0;
    let devCount = 0;
    let devWithin = 0;
    let devOutside = 0;
    let totalCases = 0;

    list.forEach((o) => {
      noDevCount += o.noDevCount;
      noDevWithin += o.noDevWithinSla;
      noDevOutside += o.noDevOutsideSla;
      devCount += o.devCount;
      devWithin += o.devWithinSla;
      devOutside += o.devOutsideSla;
      totalCases += o.totalCases;
    });

    const noDevPct = noDevCount > 0 ? Math.round((noDevWithin / noDevCount) * 100) : 0;
    const devPct = devCount > 0 ? Math.round((devWithin / devCount) * 100) : 0;
    const indexPct = noDevCount > 0 && devCount > 0
      ? Math.round(noDevPct + (devPct / 80) * 20)
      : (noDevCount > 0 ? Math.round((noDevPct / 80) * 100) : (devCount > 0 ? Math.round((devPct / 80) * 100) : 0));

    return {
      count,
      noDevCount,
      noDevWithin,
      noDevOutside,
      noDevPct,
      devCount,
      devWithin,
      devOutside,
      devPct,
      totalCases,
      indexPct,
    };
  }, [filteredOwners]);

  // Toggle sorting helper for Owners
  const handleOwnerSort = (field: keyof ExternalOwnerCfiSummary) => {
    if (ownerSortField === field) {
      setOwnerSortAsc(!ownerSortAsc);
    } else {
      setOwnerSortField(field);
      setOwnerSortAsc(field === 'rank' || field === 'owner' || field === 'assignee' || field === 'hod');
    }
  };

  // Toggle sorting helper for HODs
  const handleHodSort = (field: keyof ExternalHodCfiSummary) => {
    if (hodSortField === field) {
      setHodSortAsc(!hodSortAsc);
    } else {
      setHodSortField(field);
      setHodSortAsc(field === 'rank' || field === 'hod');
    }
  };

  return (
    <div className="space-y-5">
      {/* SECTION HEADER & CONTROLS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3.5 mb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#990000] to-[#600000] flex items-center justify-center text-white shadow-xs">
              <Award className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Change Factory Index — Digital Performance Matrix
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-bold">
                  80% No Dev / 20% Dev
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Segregated performance breakdown per Owner and HOD. Evaluates all eligible active cases (excluding Not Started, New, and Cancelled).
              </p>
            </div>
          </div>

          {/* Action Export Button & View Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Filter Pills */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setViewMode('both')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'both'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Views (Both)
              </button>
              <button
                onClick={() => setViewMode('owner')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'owner'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>By Owner ({stats.ownerBreakdown?.length || 0})</span>
              </button>
              <button
                onClick={() => setViewMode('hod')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'hod'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-purple-600" />
                <span>By HOD ({stats.hodBreakdown?.length || 0})</span>
              </button>
            </div>

            {/* Export Table Dropdown Menu */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#990000] hover:bg-[#800000] text-white font-sans text-xs font-bold transition-all shadow-2xs active:scale-95 border border-red-900"
                title="Export Table in same look, feel, and theme colors as application"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Table</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    Export Options (Dark Red Theme)
                  </div>
                  <button
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      exportExternalOwnerHodTableReport(stats);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-rose-50 hover:text-rose-900 flex items-center gap-2 font-medium transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <div>
                      <div className="font-bold">Themed Report (HTML / PDF)</div>
                      <div className="text-[10px] text-slate-400">Authentic application styling</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      exportExternalOwnerHodTableExcel(stats);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2 font-medium transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-bold">Excel Spreadsheet (.xlsx)</div>
                      <div className="text-[10px] text-slate-400">Both Owner &amp; HOD Sheets</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SEARCH & FILTER BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 max-w-xl">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Owner, Assignee, or HOD..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* HOD Filter Dropdown */}
            <div className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-semibold text-slate-600">HOD:</span>
              <select
                value={selectedHodFilter}
                onChange={(e) => setSelectedHodFilter(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-xs focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All HODs ({hodOptions.length})</option>
                {hodOptions.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Summary Pill */}
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
            <span>Showing:</span>
            <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
              {filteredOwners.length} owners
            </span>
            <span>•</span>
            <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
              {ownerTotals.totalCases} active cases
            </span>
          </div>
        </div>
      </div>

      {/* 1. OWNER CHANGE FACTORY INDEX TABLE (MATCHING USER SCREENSHOT EXACTLY) */}
      {(viewMode === 'both' || viewMode === 'owner') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              {/* PRIMARY GROUP HEADER BAR IN DARK RED (#990000) */}
              <thead>
                <tr className="bg-[#990000] text-white font-extrabold uppercase tracking-wider text-[11px] border-b-2 border-[#800000] shadow-xs divide-x divide-red-950">
                  <th colSpan={4} className="p-2.5 text-center">
                    CHANGE FACTORY INDEX - DIGITAL
                  </th>
                  <th colSpan={3} className="p-2.5 text-center bg-[#8B0000]">
                    YTD
                  </th>
                  <th colSpan={4} className="p-2.5 text-center bg-[#800000]">
                    NO DEV CASES (80%)
                  </th>
                  <th colSpan={4} className="p-2.5 text-center bg-[#660000]">
                    DEV CASES (20%)
                  </th>
                </tr>

                {/* SUBHEADER ROW */}
                <tr className="bg-slate-50 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200 divide-x divide-slate-200 select-none">
                  {/* Digital Info */}
                  <th
                    onClick={() => handleOwnerSort('rank')}
                    className="p-2 w-14 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Rank</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleOwnerSort('owner')}
                    className="p-2 min-w-[160px] text-left cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Owner</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleOwnerSort('assignee')}
                    className="p-2 w-28 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Assignee</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleOwnerSort('hod')}
                    className="p-2 w-28 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>HOD</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* YTD Metrics */}
                  <th
                    onClick={() => handleOwnerSort('noDevPct')}
                    className="p-2 w-20 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>NO DEV</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleOwnerSort('devPct')}
                    className="p-2 w-20 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>DEV</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleOwnerSort('totalCfiPct')}
                    className="p-2 w-24 text-center bg-emerald-100/70 text-emerald-950 font-black cursor-pointer hover:bg-emerald-200 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>INDEX</span>
                      <ArrowUpDown className="w-3 h-3 text-emerald-700" />
                    </div>
                  </th>

                  {/* NO DEV CASES (80%) */}
                  <th
                    onClick={() => handleOwnerSort('noDevCount')}
                    className="p-2 w-16 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Count</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleOwnerSort('noDevWithinSla')}
                    className="p-2 w-24 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Within SLA</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleOwnerSort('noDevOutsideSla')}
                    className="p-2 w-24 text-center cursor-pointer hover:bg-slate-100 transition-colors text-slate-500"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Not in SLA</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleOwnerSort('noDevPct')}
                    className="p-2 w-20 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>%</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* DEV CASES (20%) */}
                  <th
                    onClick={() => handleOwnerSort('devCount')}
                    className="p-2 w-16 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Count</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleOwnerSort('devWithinSla')}
                    className="p-2 w-24 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Within SLA</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleOwnerSort('devOutsideSla')}
                    className="p-2 w-24 text-center cursor-pointer hover:bg-slate-100 transition-colors text-slate-500"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Not in SLA</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleOwnerSort('devPct')}
                    className="p-2 w-24 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Within SLA %</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredOwners.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="p-8 text-center text-slate-400 italic">
                      No owners found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredOwners.map((o) => {
                    const isRank1 = o.rank === 1;
                    const isRank2 = o.rank === 2;
                    const isRank3 = o.rank === 3;

                    return (
                      <tr
                        key={`${o.owner}-${o.assignee}`}
                        onClick={() => onSelectOwner && onSelectOwner(o.owner)}
                        className={`hover:bg-slate-50/80 transition-colors divide-x divide-slate-100 cursor-pointer ${
                          isRank1 ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        {/* Rank Column */}
                        <td className="p-2.5 text-center font-mono">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black shadow-2xs ${
                              isRank1
                                ? 'bg-amber-400 text-slate-900 ring-2 ring-amber-200'
                                : isRank2
                                ? 'bg-slate-200 text-slate-800'
                                : isRank3
                                ? 'bg-amber-700/80 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {o.rank}
                          </span>
                        </td>

                        {/* Owner Display Name */}
                        <td className="p-2.5 text-left font-bold text-slate-900 hover:text-rose-700 transition-colors">
                          <div className="flex items-center gap-1.5">
                            {isRank1 && <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                            <span>{o.owner}</span>
                          </div>
                        </td>

                        {/* Assignee Short Key */}
                        <td className="p-2.5 text-center">
                          <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {o.assignee}
                          </span>
                        </td>

                        {/* HOD Team Lead */}
                        <td className="p-2.5 text-center font-medium text-slate-700">
                          {o.hod}
                        </td>

                        {/* YTD: NO DEV % */}
                        <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                          {o.noDevPct}%
                        </td>

                        {/* YTD: DEV % */}
                        <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                          {o.devPct}%
                        </td>

                        {/* YTD: INDEX % (Soft green background with bold dark green text like user reference) */}
                        <td className="p-2.5 text-center bg-emerald-100/70 font-mono font-black text-sm text-[#006622]">
                          {o.totalCfiPct}%
                        </td>

                        {/* NO DEV CASES (80%) */}
                        <td className="p-2.5 text-center font-mono font-bold text-slate-900">
                          {o.noDevCount}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-emerald-700">
                          {o.noDevWithinSla}
                        </td>
                        <td className="p-2.5 text-center font-mono font-semibold text-rose-600">
                          {o.noDevOutsideSla}
                        </td>
                        <td
                          className={`p-2.5 text-center font-mono font-extrabold ${
                            o.noDevPct >= 80 ? 'text-emerald-700 bg-emerald-50/50' : 'text-slate-800'
                          }`}
                        >
                          {o.noDevPct}%
                        </td>

                        {/* DEV CASES (20%) */}
                        <td className="p-2.5 text-center font-mono font-bold text-slate-900">
                          {o.devCount}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-indigo-700">
                          {o.devWithinSla}
                        </td>
                        <td className="p-2.5 text-center font-mono font-semibold text-rose-600">
                          {o.devOutsideSla}
                        </td>
                        <td
                          className={`p-2.5 text-center font-mono font-extrabold ${
                            o.devPct >= 80 ? 'text-indigo-800 bg-indigo-50/50' : 'text-slate-800'
                          }`}
                        >
                          {o.devPct}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* SUMMARY TOTALS ROW */}
              <tfoot>
                <tr className="bg-slate-900 text-white font-black text-xs divide-x divide-slate-800 border-t-2 border-rose-900">
                  <td colSpan={4} className="p-3 text-left pl-4 uppercase tracking-wider">
                    Total / Overall Summary ({filteredOwners.length} Owners)
                  </td>
                  <td className="p-3 text-center font-mono text-emerald-300">
                    {ownerTotals.noDevPct}%
                  </td>
                  <td className="p-3 text-center font-mono text-indigo-300">
                    {ownerTotals.devPct}%
                  </td>
                  <td className="p-3 text-center font-mono text-base bg-emerald-600 text-white">
                    {ownerTotals.indexPct}%
                  </td>
                  <td className="p-3 text-center font-mono">
                    {ownerTotals.noDevCount}
                  </td>
                  <td className="p-3 text-center font-mono text-emerald-300">
                    {ownerTotals.noDevWithin}
                  </td>
                  <td className="p-3 text-center font-mono text-rose-300">
                    {ownerTotals.noDevOutside}
                  </td>
                  <td className="p-3 text-center font-mono text-emerald-300">
                    {ownerTotals.noDevPct}%
                  </td>
                  <td className="p-3 text-center font-mono">
                    {ownerTotals.devCount}
                  </td>
                  <td className="p-3 text-center font-mono text-indigo-300">
                    {ownerTotals.devWithin}
                  </td>
                  <td className="p-3 text-center font-mono text-rose-300">
                    {ownerTotals.devOutside}
                  </td>
                  <td className="p-3 text-center font-mono text-indigo-300">
                    {ownerTotals.devPct}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 2. HOD CHANGE FACTORY INDEX TABLE */}
      {(viewMode === 'both' || viewMode === 'hod') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              {/* PRIMARY GROUP HEADER BAR IN DARK RED (#990000) */}
              <thead>
                <tr className="bg-[#990000] text-white font-extrabold uppercase tracking-wider text-[11px] border-b-2 border-[#800000] shadow-xs divide-x divide-red-950">
                  <th colSpan={3} className="p-2.5 text-center">
                    CHANGE FACTORY INDEX - DIGITAL (HOD SUMMARY)
                  </th>
                  <th colSpan={3} className="p-2.5 text-center bg-[#8B0000]">
                    YTD
                  </th>
                  <th colSpan={4} className="p-2.5 text-center bg-[#800000]">
                    NO DEV CASES (80%)
                  </th>
                  <th colSpan={4} className="p-2.5 text-center bg-[#660000]">
                    DEV CASES (20%)
                  </th>
                </tr>

                {/* SUBHEADER ROW */}
                <tr className="bg-slate-50 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200 divide-x divide-slate-200 select-none">
                  {/* Digital Info */}
                  <th
                    onClick={() => handleHodSort('rank')}
                    className="p-2 w-14 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Rank</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleHodSort('hod')}
                    className="p-2 min-w-[180px] text-left cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>HOD / Team Lead</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleHodSort('ownerCount')}
                    className="p-2 w-36 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Owners Count</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* YTD Metrics */}
                  <th
                    onClick={() => handleHodSort('noDevPct')}
                    className="p-2 w-20 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>NO DEV</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleHodSort('devPct')}
                    className="p-2 w-20 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>DEV</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleHodSort('totalCfiPct')}
                    className="p-2 w-24 text-center bg-emerald-100/70 text-emerald-950 font-black cursor-pointer hover:bg-emerald-200 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>INDEX</span>
                      <ArrowUpDown className="w-3 h-3 text-emerald-700" />
                    </div>
                  </th>

                  {/* NO DEV CASES (80%) */}
                  <th
                    onClick={() => handleHodSort('noDevCount')}
                    className="p-2 w-16 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Count</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleHodSort('noDevWithinSla')}
                    className="p-2 w-24 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Within SLA</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleHodSort('noDevOutsideSla')}
                    className="p-2 w-24 text-center cursor-pointer hover:bg-slate-100 transition-colors text-slate-500"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Not in SLA</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleHodSort('noDevPct')}
                    className="p-2 w-20 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>%</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>

                  {/* DEV CASES (20%) */}
                  <th
                    onClick={() => handleHodSort('devCount')}
                    className="p-2 w-16 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Count</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleHodSort('devWithinSla')}
                    className="p-2 w-24 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Within SLA</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleHodSort('devOutsideSla')}
                    className="p-2 w-24 text-center cursor-pointer hover:bg-slate-100 transition-colors text-slate-500"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Not in SLA</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleHodSort('devPct')}
                    className="p-2 w-24 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Within SLA %</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredHods.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-8 text-center text-slate-400 italic">
                      No HOD groups found.
                    </td>
                  </tr>
                ) : (
                  filteredHods.map((h) => {
                    const isRank1 = h.rank === 1;
                    const isRank2 = h.rank === 2;
                    const isRank3 = h.rank === 3;

                    return (
                      <tr
                        key={h.hod}
                        onClick={() => onSelectHod && onSelectHod(h.hod)}
                        className={`hover:bg-slate-50/80 transition-colors divide-x divide-slate-100 cursor-pointer ${
                          isRank1 ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        {/* Rank Column */}
                        <td className="p-2.5 text-center font-mono">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black shadow-2xs ${
                              isRank1
                                ? 'bg-amber-400 text-slate-900 ring-2 ring-amber-200'
                                : isRank2
                                ? 'bg-slate-200 text-slate-800'
                                : isRank3
                                ? 'bg-amber-700/80 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {h.rank}
                          </span>
                        </td>

                        {/* HOD Name */}
                        <td className="p-2.5 text-left font-bold text-slate-900 hover:text-rose-700 transition-colors">
                          <div className="flex items-center gap-1.5">
                            {isRank1 && <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                            <span className="text-[13px]">{h.hod}</span>
                          </div>
                        </td>

                        {/* Owners Count */}
                        <td className="p-2.5 text-center font-medium text-slate-600">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold font-mono">
                            {h.ownerCount} assigned
                          </span>
                        </td>

                        {/* YTD: NO DEV % */}
                        <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                          {h.noDevPct}%
                        </td>

                        {/* YTD: DEV % */}
                        <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                          {h.devPct}%
                        </td>

                        {/* YTD: INDEX % */}
                        <td className="p-2.5 text-center bg-emerald-100/70 font-mono font-black text-sm text-[#006622]">
                          {h.totalCfiPct}%
                        </td>

                        {/* NO DEV CASES (80%) */}
                        <td className="p-2.5 text-center font-mono font-bold text-slate-900">
                          {h.noDevCount}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-emerald-700">
                          {h.noDevWithinSla}
                        </td>
                        <td className="p-2.5 text-center font-mono font-semibold text-rose-600">
                          {h.noDevOutsideSla}
                        </td>
                        <td
                          className={`p-2.5 text-center font-mono font-extrabold ${
                            h.noDevPct >= 80 ? 'text-emerald-700 bg-emerald-50/50' : 'text-slate-800'
                          }`}
                        >
                          {h.noDevPct}%
                        </td>

                        {/* DEV CASES (20%) */}
                        <td className="p-2.5 text-center font-mono font-bold text-slate-900">
                          {h.devCount}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-indigo-700">
                          {h.devWithinSla}
                        </td>
                        <td className="p-2.5 text-center font-mono font-semibold text-rose-600">
                          {h.devOutsideSla}
                        </td>
                        <td
                          className={`p-2.5 text-center font-mono font-extrabold ${
                            h.devPct >= 80 ? 'text-indigo-800 bg-indigo-50/50' : 'text-slate-800'
                          }`}
                        >
                          {h.devPct}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* SUMMARY TOTALS ROW */}
              <tfoot>
                <tr className="bg-slate-900 text-white font-black text-xs divide-x divide-slate-800 border-t-2 border-rose-900">
                  <td colSpan={3} className="p-3 text-left pl-4 uppercase tracking-wider">
                    Total / Overall Summary ({filteredHods.length} HODs)
                  </td>
                  <td className="p-3 text-center font-mono text-emerald-300">
                    {ownerTotals.noDevPct}%
                  </td>
                  <td className="p-3 text-center font-mono text-indigo-300">
                    {ownerTotals.devPct}%
                  </td>
                  <td className="p-3 text-center font-mono text-base bg-emerald-600 text-white">
                    {ownerTotals.indexPct}%
                  </td>
                  <td className="p-3 text-center font-mono">
                    {ownerTotals.noDevCount}
                  </td>
                  <td className="p-3 text-center font-mono text-emerald-300">
                    {ownerTotals.noDevWithin}
                  </td>
                  <td className="p-3 text-center font-mono text-rose-300">
                    {ownerTotals.noDevOutside}
                  </td>
                  <td className="p-3 text-center font-mono text-emerald-300">
                    {ownerTotals.noDevPct}%
                  </td>
                  <td className="p-3 text-center font-mono">
                    {ownerTotals.devCount}
                  </td>
                  <td className="p-3 text-center font-mono text-indigo-300">
                    {ownerTotals.devWithin}
                  </td>
                  <td className="p-3 text-center font-mono text-rose-300">
                    {ownerTotals.devOutside}
                  </td>
                  <td className="p-3 text-center font-mono text-indigo-300">
                    {ownerTotals.devPct}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
