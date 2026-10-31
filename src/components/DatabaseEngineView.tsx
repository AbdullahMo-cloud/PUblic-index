import React, { useState, useEffect } from 'react';
import {
  Database,
  HardDrive,
  Download,
  UploadCloud,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FolderTree,
  ShieldCheck,
  Server,
  Layers,
  Archive,
  Globe2,
  FileCode,
} from 'lucide-react';
import { TranslatedCcfRow } from '../types/ccf';
import { getStorageInfo, StorageStatus } from '../utils/storageEngine';

interface DatabaseEngineViewProps {
  rows: TranslatedCcfRow[];
  onRemoveData: () => void;
  onResetData: () => void;
  onImportData: (rows: TranslatedCcfRow[]) => void;
}

export const DatabaseEngineView: React.FC<DatabaseEngineViewProps> = ({
  rows,
  onRemoveData,
  onResetData,
  onImportData,
}) => {
  const [storageInfo, setStorageInfo] = useState<StorageStatus | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  useEffect(() => {
    getStorageInfo().then(setStorageInfo);
  }, [rows]);

  const count2026 = rows.filter((r) => r.ccfType !== 'External' && r.isNewCase).length;
  const countBacklog = rows.filter((r) => r.ccfType !== 'External' && !r.isNewCase).length;
  const countExternal = rows.filter((r) => r.ccfType === 'External').length;

  const handleExportJson = () => {
    window.location.href = '/api/database/export/json';
  };

  const handleExportSql = () => {
    window.location.href = '/api/database/export/sql';
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const importedRows = Array.isArray(parsed) ? parsed : parsed.rows;
        if (!Array.isArray(importedRows) || importedRows.length === 0) {
          throw new Error('No valid record array found in JSON file.');
        }
        onImportData(importedRows);
        setImportSuccess(`Successfully restored ${importedRows.length} records into database.`);
      } catch (err: any) {
        setImportError(`Import failed: ${err.message || 'Invalid JSON format'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };


  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-800">
      {/* Top Banner: Storage Engine Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-red-600/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400">
                <Database className="w-6 h-6" />
              </span>
              <div>
                <span className="text-xs font-semibold text-red-400 tracking-wider uppercase">
                  Portable Storage Engine
                </span>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  Local File Database (JSON & SQLite Compatible)
                </h1>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center min-w-[110px]">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Stored</span>
              <span className="text-2xl font-black text-white">{rows.length}</span>
              <span className="text-[10px] text-emerald-400 block font-medium">100% Persisted</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center min-w-[110px]">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Storage Mode</span>
              <span className="text-sm font-bold text-red-400 mt-1 block">File + IndexedDB</span>
              <span className="text-[10px] text-slate-300 block">No 5MB Limit</span>
            </div>
          </div>
        </div>

        {/* Database File Status Pill */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-mono">
            <HardDrive className="w-3.5 h-3.5 text-red-400" />
            <span>File Path: <strong>./data/ccf_database.json</strong></span>
            {storageInfo?.sizeBytes ? (
              <span className="text-slate-400">({(storageInfo.sizeBytes / 1024).toFixed(1)} KB on disk)</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Ready for Standalone USB / Portable Packaging</span>
          </div>
        </div>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors shadow-2xs"
            title="Download the raw database file as ccf_database.json"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Download Database (JSON)</span>
          </button>

          <button
            onClick={handleExportSql}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors shadow-xs"
            title="Download full SQL dump with CREATE TABLE and INSERT statements for SQLite / PostgreSQL"
          >
            <FileCode className="w-3.5 h-3.5 text-red-400" />
            <span>Export as SQL Database (.sql)</span>
          </button>

          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer shadow-2xs">
            <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
            <span>Import Database File</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJsonFile}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onResetData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Reset database to default seed demo dataset"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restore Demo Seed</span>
          </button>

          <button
            onClick={onRemoveData}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-40"
            title="Wipe database completely to 0 records"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
            <span>Remove Old Data</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {importSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{importSuccess}</span>
        </div>
      )}
      {importError && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{importError}</span>
        </div>
      )}

      {/* Core Breakdown & Current State */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>2026 CCF Tracker Records</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{count2026}</span>
            <span className="text-xs text-slate-500 font-mono">
              {rows.length > 0 ? ((count2026 / rows.length) * 100).toFixed(1) : 0}% of dataset
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
            <Archive className="w-4 h-4 text-amber-600" />
            <span>Backlog CCF Tracker Records</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{countBacklog}</span>
            <span className="text-xs text-slate-500 font-mono">
              {rows.length > 0 ? ((countBacklog / rows.length) * 100).toFixed(1) : 0}% of dataset
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
            <Globe2 className="w-4 h-4 text-purple-600" />
            <span>External CCF Tracker Records</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{countExternal}</span>
            <span className="text-xs text-slate-500 font-mono">
              {rows.length > 0 ? ((countExternal / rows.length) * 100).toFixed(1) : 0}% of dataset
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};
