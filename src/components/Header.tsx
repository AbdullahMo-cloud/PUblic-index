import React, { useRef, useState, useEffect } from 'react';
import {
  Download,
  Search,
  RefreshCw,
  Trash2,
  UploadCloud,
  Database,
  ChevronDown,
  Sparkles,
  Copy,
  Layers,
} from 'lucide-react';
import { NavTab } from '../types/ccf';
import { EtisalatLogo } from './EtisalatLogo';

interface HeaderProps {
  currentTab: NavTab;
  onExportExcel: () => void;
  onExportMasterWorkbook?: () => void;
  onCopyActiveTheme?: () => void;
  onRemoveData: () => void;
  onUploadNewFile: (file: File) => void;
  onRefreshData: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount: number;
  count2026: number;
  onNavigateToTab?: (tab: NavTab) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onExportExcel,
  onExportMasterWorkbook,
  onCopyActiveTheme,
  onRemoveData,
  onUploadNewFile,
  onRefreshData,
  searchQuery,
  onSearchChange,
  totalCount,
  onNavigateToTab,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    if (exportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportOpen]);

  const tabTitles: Record<NavTab, { title: string; category: string }> = {
    'internal-kpi': { title: 'Internal CCF KPI Dashboard', category: 'KPI Dashboard' },
    'external-kpi': { title: 'External CCF KPI Dashboard', category: 'KPI Dashboard' },
    'tracker-2026': { title: '2026 CCF Operational Tracker (CY26)', category: 'Operational Tracker' },
    'tracker-backlog': { title: 'Backlog CCF Tracker (Legacy Backlog)', category: 'Operational Tracker' },
    'tracker-on-target': { title: 'On-Target CCF Tracker (Milestones & Committed Dates)', category: 'Operational Tracker' },
    'tracker-compiled': { title: 'Case Sources Hub — 3 Segregated Trackers', category: 'Operational Tracker' },
    'tracker-external': { title: 'External CCF Tracker (Vendors)', category: 'Operational Tracker' },
    'sheet-engine': { title: 'Spreadsheet Upload & Header Engine', category: 'Data Pipeline' },
    'database-engine': { title: 'Storage & Database Engine (Portable Electron)', category: 'System Architecture' },
    'user-allocations': { title: 'User Allocations & HOD Admin', category: 'Administration' },
  };

  const currentMeta = tabTitles[currentTab] || { title: 'Dashboard', category: 'Overview' };

  return (
    <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 shadow-2xs z-10">
      {/* Hidden file input for uploading new sheets */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls, .csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onUploadNewFile(file);
            e.target.value = '';
          }
        }}
      />

      {/* Zone 1: Page Title & Context */}
      <div className="flex items-center gap-3 min-w-0">
        <EtisalatLogo size={22} className="shrink-0 mr-1 hidden sm:inline-flex" />
        <div className="h-4 w-px bg-slate-200 hidden sm:block" />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-900 truncate">
              {currentMeta.title}
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold hidden sm:inline">
              {currentMeta.category}
            </span>
          </div>
        </div>

        {/* Database Engine Status Button */}
        <button
          onClick={() => onNavigateToTab?.('database-engine')}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100 transition-colors cursor-pointer"
          title="Database Engine: ccf_database.json (Local File beside executable). Click to open Storage Engine."
        >
          <Database className="w-3 h-3 text-emerald-600" />
          <span className="font-semibold">Local DB</span>
        </button>

        {/* Total Cases Indicator Badge */}
        <div className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[11px] bg-red-50 text-red-800 border border-red-200 font-bold" title="Total Active CCF Register Cases">
          <span>Total:</span>
          <span className="text-[#E2001A] font-extrabold">{totalCount || 708} Cases</span>
        </div>
      </div>

      {/* Zone 2: Live Search Input */}
      <div className="relative flex-1 max-w-xs xl:max-w-sm hidden md:block">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search Issue Key, Owner, or HOD..."
          className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 placeholder:text-slate-400 text-slate-700 transition-colors"
        />
      </div>

      {/* Zone 3: Primary Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Themed Export Excel with Dropdown */}
        <div className="relative inline-flex items-center" ref={exportRef}>
          <button
            onClick={onExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-l-md border border-slate-900 transition-colors shadow-2xs cursor-pointer"
            title="Export themed Excel report matching app headers, colors, and column arrangement"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="px-1.5 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-r-md border-t border-b border-r border-slate-900 transition-colors cursor-pointer"
            title="More Excel & Report Export Options"
          >
            <ChevronDown className="w-3.5 h-3.5 text-white" />
          </button>

          {exportOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-1 text-xs divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
              <div className="p-2.5 bg-slate-50 border-b border-slate-100 rounded-t-xl">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Themed Report Export</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Current View: <strong className="text-slate-700">{currentMeta.title}</strong>
                </p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setExportOpen(false);
                    onExportExcel();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between text-slate-700 cursor-pointer"
                >
                  <div>
                    <span className="font-semibold text-slate-800 block">Export Active View (.xlsx)</span>
                    <span className="text-[10px] text-slate-500">Same headers, colors, & arranged columns</span>
                  </div>
                  <Download className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>

                {onExportMasterWorkbook && (
                  <button
                    onClick={() => {
                      setExportOpen(false);
                      onExportMasterWorkbook();
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between text-slate-700 cursor-pointer"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 block">Export Master Workbook</span>
                      <span className="text-[10px] text-slate-500">All 5 Trackers in 1 themed multi-tab Excel</span>
                    </div>
                    <Layers className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  </button>
                )}
              </div>

              {onCopyActiveTheme && (
                <div className="py-1">
                  <button
                    onClick={() => {
                      setExportOpen(false);
                      onCopyActiveTheme();
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-indigo-50/60 flex items-center justify-between text-indigo-700 cursor-pointer"
                  >
                    <div>
                      <span className="font-semibold flex items-center gap-1.5">
                        <Copy className="w-3 h-3 text-indigo-600" />
                        <span>Copy Table Theme</span>
                      </span>
                      <span className="text-[10px] text-indigo-500 block">Paste directly into Excel / Word / Email</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-slate-200 mx-0.5" />

        {/* Refresh Active Database Data */}
        <button
          onClick={onRefreshData}
          title="Refresh view from local database file (ccf_database.json)"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-all shadow-2xs cursor-pointer active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-700" />
          <span>Refresh Data</span>
        </button>
      </div>
    </header>
  );
};
