import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRight,
  RefreshCw,
  Layers,
  Archive,
  Globe2,
  Trash2,
  Calendar,
  Sparkles,
  Check,
  Table,
  BarChart3,
  FolderUp,
  RotateCcw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { TranslatedCcfRow } from '../types/ccf';
import { parseSpreadsheetData, identifyHeaderField } from '../utils/dataParser';
import { NavTab } from '../types/ccf';
import { exportMasterMultiSheetExcel } from '../utils/excelStyledExport';
import { isDateColumnKey, parseCellToDate } from '../utils/dateColumnUtils';
import {
  loadWeeklyReviewDataset,
  saveWeeklyReviewDataset,
  wipeAllApplicationDatabases,
  WeeklyReviewTwoTunnelsStored,
} from '../utils/storageEngine';
import { resolveCaseRowInfo, parseRawWeeklyReviewSheet } from './WeeklyReviewDashboard';

interface SheetUploaderProps {
  onDataLoaded: (rows: TranslatedCcfRow[]) => void;
  onRemoveData?: () => void;
  onTunnelsUpdated?: (updated: WeeklyReviewTwoTunnelsStored) => void;
  currentRowsCount: number;
  activeRows?: TranslatedCcfRow[];
  onNavigateToTab?: (tab: NavTab) => void;
}

export const SheetUploader: React.FC<SheetUploaderProps> = ({
  onDataLoaded,
  onRemoveData,
  onTunnelsUpdated,
  currentRowsCount,
  activeRows = [],
  onNavigateToTab,
}) => {
  const [tunnelsData, setTunnelsData] = useState<WeeklyReviewTwoTunnelsStored>({
    tunnel1: null,
    tunnel2: null,
    lastUpdated: new Date().toISOString(),
  });

  useEffect(() => {
    let isMounted = true;
    loadWeeklyReviewDataset().then((stored) => {
      if (isMounted && stored) {
        setTunnelsData(stored);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const [fileName1, setFileName1] = useState<string | null>(null);
  const [fileName2, setFileName2] = useState<string | null>(null);
  const [detectedHeaders, setDetectedHeaders] = useState<{ raw: string; mapped: string }[]>([]);
  const [parsedRows, setParsedRows] = useState<TranslatedCcfRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const fileInputRefCombined = useRef<HTMLInputElement>(null);

  // Active dataset to display: newly parsed rows or currently persisted database rows
  const displayRows = parsedRows.length > 0 ? parsedRows : activeRows;

  // Distribution counts
  const count2026 = displayRows.filter((r) => r.ccfType !== 'External' && r.isNewCase).length;
  const countBacklog = displayRows.filter((r) => r.ccfType !== 'External' && !r.isNewCase).length;
  const countExternal = displayRows.filter((r) => r.ccfType === 'External').length;

  // ---------------------------------------------------------------------------
  // PROCESS TUNNEL 1 (Operations, Trackers & Slide 1 Feed)
  // ---------------------------------------------------------------------------
  const processTunnel1 = async (file: File) => {
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setUploadSuccess(false);
    setFileName1(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      const preferred = wb.SheetNames.find((s) => /weekly|review|external|ccf/i.test(s)) || wb.SheetNames[0];
      const parsed = parseRawWeeklyReviewSheet(wb, preferred);
      const translated = parseSpreadsheetData(buffer);
      const baseRows = parsed.rows.length > 0 ? parsed.rows : translated;

      if (baseRows.length === 0) {
        throw new Error(
          'No valid records found. Ensure sheet contains headers like Created, Status, Key, or Summary.'
        );
      }

      // Populate detected headers
      if (translated.length > 0 && translated[0].rawColumns) {
        const headerDetectionList: { raw: string; mapped: string }[] = [];
        translated[0].rawColumns.forEach((key) => {
          const mapped = identifyHeaderField(key);
          headerDetectionList.push({
            raw: key,
            mapped: mapped ? String(mapped) : 'Unmapped / Passthrough',
          });
        });
        setDetectedHeaders(headerDetectionList);
      }

      setParsedRows(translated);

      // Filter non-RCA / non-CC cases for Slide 1
      const slide1Rows = baseRows.filter((r) => {
        const info = resolveCaseRowInfo(r);
        return !info || info.sourceCategory === 'First Source';
      });

      const updatedTunnels: WeeklyReviewTwoTunnelsStored = {
        ...tunnelsData,
        tunnel1: {
          fileName: file.name,
          rows: slide1Rows.length > 0 ? slide1Rows : baseRows,
          uploadedAt: new Date().toISOString(),
          recordCount: (slide1Rows.length > 0 ? slide1Rows : baseRows).length,
        },
        lastUpdated: new Date().toISOString(),
      };

      await saveWeeklyReviewDataset(updatedTunnels);
      setTunnelsData(updatedTunnels);
      onTunnelsUpdated?.(updatedTunnels);

      // Auto-apply immediately to Operational Trackers & Main KPIs
      onDataLoaded(translated);
      setUploadSuccess(true);
      setSuccessMsg(`Tunnel 1 successfully ingested! ${translated.length} rows updated Operational Trackers, KPIs, and Weekly Review Slide 1.`);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error?.message || 'Failed to process Tunnel 1 spreadsheet.');
      setUploadSuccess(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // PROCESS TUNNEL 2 (RCA, Command Center & Slide 2 Feed)
  // ---------------------------------------------------------------------------
  const processTunnel2 = async (file: File) => {
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setFileName2(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      const preferred = wb.SheetNames.find((s) => /weekly|review|rca|command|ccf/i.test(s)) || wb.SheetNames[0];
      const parsed = parseRawWeeklyReviewSheet(wb, preferred);
      const rowsToUse = parsed.rows.length > 0 ? parsed.rows : parseSpreadsheetData(buffer);

      if (rowsToUse.length === 0) {
        throw new Error('No valid records found in Tunnel 2 file.');
      }

      // Map rows for Tunnel 2 (RCA & Command Centre)
      const rcaCcRows = rowsToUse.map((r) => {
        const info = resolveCaseRowInfo(r, { forceTunnel2Category: true });
        return {
          ...r,
          source: info?.sourceCategory || 'RCA',
        };
      });

      const updatedTunnels: WeeklyReviewTwoTunnelsStored = {
        ...tunnelsData,
        tunnel2: {
          fileName: file.name,
          rows: rcaCcRows,
          uploadedAt: new Date().toISOString(),
          recordCount: rcaCcRows.length,
        },
        lastUpdated: new Date().toISOString(),
      };

      await saveWeeklyReviewDataset(updatedTunnels);
      setTunnelsData(updatedTunnels);
      onTunnelsUpdated?.(updatedTunnels);
      setSuccessMsg(`Tunnel 2 successfully ingested! ${rcaCcRows.length} RCA & Command Center cases feed Weekly Review Slide 2.`);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error?.message || 'Failed to process Tunnel 2 spreadsheet.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // PROCESS COMBINED MASTER (Auto-splits into Tunnel 1 and Tunnel 2)
  // ---------------------------------------------------------------------------
  const processCombinedMaster = async (file: File) => {
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      const preferred = wb.SheetNames.find((s) => /weekly|review|external|ccf/i.test(s)) || wb.SheetNames[0];
      const parsed = parseRawWeeklyReviewSheet(wb, preferred);
      const translated = parseSpreadsheetData(buffer);
      const baseRows = parsed.rows.length > 0 ? parsed.rows : translated;

      if (baseRows.length === 0) {
        throw new Error('No valid records found in master file.');
      }

      const t1Rows = baseRows.filter((r) => {
        const info = resolveCaseRowInfo(r);
        return !info || info.sourceCategory === 'First Source';
      });

      const t2Rows = baseRows.filter((r) => {
        const info = resolveCaseRowInfo(r);
        return info && (info.sourceCategory === 'RCA' || info.sourceCategory === 'Command Centre');
      });

      const updatedTunnels: WeeklyReviewTwoTunnelsStored = {
        tunnel1: {
          fileName: `${file.name} (Slide 1: Excl. RCA & CC)`,
          rows: t1Rows.length > 0 ? t1Rows : baseRows,
          uploadedAt: new Date().toISOString(),
          recordCount: (t1Rows.length > 0 ? t1Rows : baseRows).length,
        },
        tunnel2: t2Rows.length > 0 ? {
          fileName: `${file.name} (Slide 2: RCA & CC)`,
          rows: t2Rows,
          uploadedAt: new Date().toISOString(),
          recordCount: t2Rows.length,
        } : null,
        lastUpdated: new Date().toISOString(),
      };

      await saveWeeklyReviewDataset(updatedTunnels);
      setTunnelsData(updatedTunnels);
      onTunnelsUpdated?.(updatedTunnels);

      // Auto-apply to Operational Trackers
      onDataLoaded(translated);
      setParsedRows(translated);
      setUploadSuccess(true);
      setSuccessMsg(`Combined Master uploaded! Auto-split into Tunnel 1 (${t1Rows.length} cases) and Tunnel 2 (${t2Rows.length} cases).`);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error?.message || 'Failed to process Master spreadsheet.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = async () => {
    setParsedRows([]);
    setDetectedHeaders([]);
    setFileName1(null);
    setFileName2(null);
    setUploadSuccess(false);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Call wipeAllApplicationDatabases and onRemoveData
    await wipeAllApplicationDatabases();
    const emptyTunnels: WeeklyReviewTwoTunnelsStored = {
      tunnel1: null,
      tunnel2: null,
      lastUpdated: new Date().toISOString(),
    };
    setTunnelsData(emptyTunnels);
    onTunnelsUpdated?.(emptyTunnels);
    onRemoveData?.();
  };

  // 8 Target Date Fields specifically requested:
  // Custom field (Monitoring Start Date), Custom field (Monitoring End Date),
  // Custom field (Committed End Date), Custom field (Complaint Month),
  // Custom field (Assigned Date), Custom field (In Progress Start Date),
  // Created, Updated
  const targetDateFields = useMemo(() => [
    { key: 'monitoringStartDate', label: 'Custom field (Monitoring Start Date)', desc: 'Monitoring cycle trigger date' },
    { key: 'monitoringEndDate', label: 'Custom field (Monitoring End Date)', desc: 'Monitoring conclusion date' },
    { key: 'committedEndDate', label: 'Custom field (Committed End Date)', desc: 'Delivery target commitment date' },
    { key: 'complaintMonth', label: 'Custom field (Complaint Month)', desc: 'Complaint reporting calendar month' },
    { key: 'assignedDate', label: 'Custom field (Assigned Date)', desc: 'Engineer assignment timestamp' },
    { key: 'inProgressStartDate', label: 'Custom field (In Progress Start Date)', desc: 'Development work commencement date' },
    { key: 'created', label: 'Created', desc: 'Case initiation timestamp' },
    { key: 'updated', label: 'Updated', desc: 'Last modification timestamp' },
  ], []);

  const [isExportingCleaned, setIsExportingCleaned] = useState(false);
  const [dateExportFeedback, setDateExportFeedback] = useState<string | null>(null);

  // Compute live date parsing diagnostics across all rows
  const dateStats = useMemo(() => {
    return targetDateFields.map((f) => {
      let populatedCount = 0;
      let validDateCount = 0;
      let sampleRaw = '-';

      displayRows.forEach((r) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const val = (r as any)[f.key] ?? r.rawRowData?.[f.label] ?? r.rawRowData?.[f.key];
        if (val !== undefined && val !== null && val !== '' && val !== '-') {
          populatedCount++;
          if (sampleRaw === '-') sampleRaw = String(val);
          const parsed = parseCellToDate(val);
          if (parsed) validDateCount++;
        }
      });

      return {
        ...f,
        populatedCount,
        validDateCount,
        sampleRaw,
        pct: populatedCount > 0 ? Math.round((validDateCount / populatedCount) * 100) : 100,
      };
    });
  }, [displayRows, targetDateFields]);

  const handleExportCleanedExcel = async () => {
    setIsExportingCleaned(true);
    setDateExportFeedback(null);
    try {
      const rows2026 = displayRows.filter((r) => r.isNewCase || r.createdYear === 2026);
      const rowsBacklog = displayRows.filter((r) => !r.isNewCase && r.createdYear !== 2026 && r.ccfType !== 'External');
      const rowsOnTarget = displayRows.filter((r) => r.onTargetStatus === 'From Under Dev to Completed');
      const rowsExternal = displayRows.filter((r) => r.ccfType === 'External');

      await exportMasterMultiSheetExcel({
        rows2026: rows2026.length > 0 ? rows2026 : displayRows,
        rowsBacklog: rowsBacklog.length > 0 ? rowsBacklog : displayRows,
        rowsOnTarget: rowsOnTarget.length > 0 ? rowsOnTarget : displayRows.slice(0, 5),
        rowsExternal: rowsExternal.length > 0 ? rowsExternal : displayRows.slice(0, 5),
        filename: 'CCF_Date_Normalized_True_Excel_Dates.xlsx',
      });
      setDateExportFeedback('Export complete! All date columns written as native Excel Date cells (<c t="d">). When opened in Microsoft Excel, you can now sort "Oldest to Newest" and use the native Date AutoFilter hierarchy.');
      setTimeout(() => setDateExportFeedback(null), 6000);
    } catch (err) {
      console.error(err);
      setDateExportFeedback('Failed to generate Excel export.');
    } finally {
      setIsExportingCleaned(false);
    }
  };

  const downloadSampleTemplate = () => {
    const templateData = [
      {
        'Issue Type': 'Task',
        'Issue key': 'CCF-4562',
        'Issue id': '312848',
        'Parent id': '',
        'Summary': 'Device Care Review: switch account automation flow',
        'Description': '<p dir="auto">Step 1 no latency automation</p>',
        'Assignee': 'Yaser Mahmoud Elabid',
        'Status': 'Completed',
        'Created': '01/10/2026 9:15',
        'Custom field (Monitoring Start Date)': '12/10/2026',
        'Custom field (Monitoring End Date)': '25/10/2026',
        'Updated': '15/10/2026 14:30',
        'Custom field (Committed Start Date)': '05/10/2026',
        'Custom field (Committed End Date)': 'Oct -> 2026',
        'Custom field (Complaint Month)': 'Oct-26',
        'Custom field (Assigned Date)': '02/10/2026',
        'Custom field (Assignee Team)': 'CX Service Excellence',
        'Custom field (In Progress Date)': '03/10/2026',
        'Custom field (Dev Required)': 'Yes',
        'Custom field (Department)': 'COMMUNI CONSUMER',
      },
      {
        'Issue Type': 'Bug',
        'Issue key': 'CCF-4100',
        'Issue id': '312010',
        'Parent id': '',
        'Summary': 'Legacy fiber optical routing optimization',
        'Description': '<p dir="auto">Legacy backlog cleanup</p>',
        'Assignee': 'Waqas Naseer',
        'Status': 'For Monitoring',
        'Created': '12/11/2025 14:00',
        'Custom field (Monitoring Start Date)': '15/01/2026',
        'Custom field (Monitoring End Date)': '28/01/2026',
        'Updated': '01/10/2026 08:00',
        'Custom field (Committed Start Date)': '15/11/2025',
        'Custom field (Committed End Date)': 'Sep -> 2026',
        'Custom field (Complaint Month)': 'Nov-25',
        'Custom field (Assigned Date)': '14/11/2025',
        'Custom field (Assignee Team)': 'Himanshu Pod',
        'Custom field (In Progress Date)': '01/12/2025',
        'Custom field (Dev Required)': 'No',
        'Custom field (Department)': 'COMMUNI CONSUMER',
      },
      {
        'Issue Type': 'Task',
        'Issue key': 'CCF-443',
        'Issue id': '310920',
        'Parent id': '',
        'Summary': 'Roaming Tariff calculation module migration',
        'Description': '<p>Core billing update</p>',
        'Assignee': 'Rajput, Preksha',
        'Status': 'Completed',
        'Created': '15/03/2025 10:00',
        'Custom field (Monitoring Start Date)': '10/06/2026',
        'Custom field (Monitoring End Date)': '11/06/2026',
        'Updated': '11/06/2026 10:05',
        'Custom field (Committed Start Date)': '01/04/2025',
        'Custom field (Committed End Date)': 'Dec -> 2025',
        'Custom field (Complaint Month)': 'Mar-25',
        'Custom field (Assigned Date)': '20/03/2025',
        'Custom field (Assignee Team)': 'Prince Pod',
        'Custom field (In Progress Date)': '01/05/2025',
        'Custom field (Dev Required)': 'Yes',
        'Custom field (Department)': 'COMMUNI CONSUMER',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CCF_Raw_Export');
    XLSX.writeFile(wb, 'CCF_Sample_Jira_Dates_Export.xlsx');
  };

  return (
    <div className="space-y-6">
      {/* Introduction Card with Actions */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-600" />
              <span>Spreadsheet Ingestion &amp; Excel Date AutoFilter Engine</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Upload your complete multi-year CCF export (.xlsx, .xls, .csv).
              The engine automatically detects all date columns—specifically <strong>Custom field (Monitoring Start Date)</strong>,
              <strong> Custom field (Monitoring End Date)</strong>, <strong>Custom field (Committed End Date)</strong>,
              <strong> Custom field (Complaint Month)</strong>, <strong>Custom field (Assigned Date)</strong>,
              <strong> Custom field (In Progress Start Date)</strong>, <strong>Created</strong>, and <strong>Updated</strong>—and
              normalizes them into <strong>true Excel Date cells</strong>. This enables Microsoft Excel to sort
              <strong> Oldest to Newest</strong> and provide native calendar filtering instead of text sorting.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRemoveData && (
              <button
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
                title="Remove existing uploaded data from system"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Old Data</span>
              </button>
            )}

            <button
              onClick={downloadSampleTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors shadow-2xs"
              title="Download sample Jira file with all 8 custom date fields"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download Jira Date Sample (.xlsx)</span>
            </button>

            <button
              onClick={handleExportCleanedExcel}
              disabled={isExportingCleaned || displayRows.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-2xs disabled:opacity-50"
              title="Export all records as native Excel Date cells with Oldest-to-Newest filters enabled"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isExportingCleaned ? 'Exporting...' : 'Export Native Date Excel'}</span>
            </button>
          </div>
        </div>

        {dateExportFeedback && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs flex items-center gap-2 font-medium animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{dateExportFeedback}</span>
          </div>
        )}
      </div>

      {/* SPECIAL PANEL: 8 Target Date Columns Normalization Diagnostics */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-rose-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Target Custom Date Fields Status (Real Date &amp; Oldest-to-Newest AutoFilter Ready)
            </h3>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>Native Date Typing Active</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {dateStats.map((f, i) => (
            <div
              key={i}
              className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-slate-800 truncate" title={f.label}>
                  {f.label}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-white text-emerald-700 border border-emerald-200 shrink-0">
                  {f.validDateCount} valid
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                {f.desc}
              </p>
              <div className="pt-1 border-t border-slate-200/70 flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Sample:</span>
                <span className="font-mono text-slate-700 font-medium truncate max-w-[120px]" title={f.sampleRaw}>
                  {f.sampleRaw}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2-TUNNEL INGESTION PIPELINE ARCHITECTURE (CENTRALIZED IN SPREADSHEET ENGINE) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderUp className="w-4 h-4 text-rose-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Centralized Ingestion Architecture (2 Streamlined Tunnels)
            </h3>
          </div>
          <button
            onClick={() => fileInputRefCombined.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold border border-indigo-200 text-xs transition-colors shadow-2xs"
            title="Upload a single combined spreadsheet to auto-split into Tunnel 1 and Tunnel 2"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
            <span>Upload Combined Master Spreadsheet</span>
          </button>
          <input
            ref={fileInputRefCombined}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                processCombinedMaster(e.target.files[0]);
              }
            }}
            className="hidden"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* TUNNEL 1 CARD */}
          <div
            onClick={() => fileInputRef1.current?.click()}
            className="bg-white rounded-xl border-2 border-dashed border-red-200 hover:border-[#E2001A] bg-gradient-to-b from-red-50/30 to-white p-6 text-center cursor-pointer transition-all space-y-3 group shadow-2xs"
          >
            <input
              ref={fileInputRef1}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  processTunnel1(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-red-100 text-[#E2001A] flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
              {isProcessing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <BarChart3 className="w-6 h-6" />}
            </div>
            <div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-[#E2001A] text-[10px] font-bold uppercase tracking-wider mb-1">
                <span>Tunnel 1</span>
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                Operations, Trackers &amp; Slide 1 Feed
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xs mx-auto">
                Feeds Operational Trackers, Main KPI Dashboard, and Weekly Review Slide 1 (All excl. RCA &amp; CC).
              </p>
            </div>
            {tunnelsData.tunnel1 ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 font-mono font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Active: {tunnelsData.tunnel1.fileName} ({tunnelsData.tunnel1.recordCount} rows)</span>
              </div>
            ) : fileName1 ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 font-mono">
                <FileSpreadsheet className="w-3.5 h-3.5 text-red-600" />
                <span>{fileName1}</span>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#E2001A] text-white text-xs font-semibold rounded-md shadow-2xs group-hover:bg-red-700 transition-colors">
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Tunnel 1 File</span>
              </span>
            )}
          </div>

          {/* TUNNEL 2 CARD */}
          <div
            onClick={() => fileInputRef2.current?.click()}
            className="bg-white rounded-xl border-2 border-dashed border-emerald-200 hover:border-emerald-600 bg-gradient-to-b from-emerald-50/30 to-white p-6 text-center cursor-pointer transition-all space-y-3 group shadow-2xs"
          >
            <input
              ref={fileInputRef2}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  processTunnel2(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
              {isProcessing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Layers className="w-6 h-6" />}
            </div>
            <div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider mb-1">
                <span>Tunnel 2</span>
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                RCA, Command Center &amp; Slide 2 Feed
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xs mx-auto">
                Feeds Root Cause Analysis (RCA) Module, Command Center View, and Weekly Review Slide 2 (RCA &amp; CC).
              </p>
            </div>
            {tunnelsData.tunnel2 ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 font-mono font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Active: {tunnelsData.tunnel2.fileName} ({tunnelsData.tunnel2.recordCount} rows)</span>
              </div>
            ) : fileName2 ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 font-mono">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>{fileName2}</span>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-2xs group-hover:bg-emerald-800 transition-colors">
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Tunnel 2 File</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center justify-between shadow-2xs font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-950 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Automatic Distribution Result Strip */}
      {(uploadSuccess || displayRows.length > 0) && (
        <div className="bg-white rounded-lg border-2 border-red-500 p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-red-600" />
              <h3 className="text-sm font-semibold text-slate-800">
                {uploadSuccess
                  ? 'Data Successfully Loaded & Distributed Across All Trackers!'
                  : 'Currently Active Ingested Dataset in Storage Engine'}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700">
              {displayRows.length} Total Records Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 2026 CCF Tracker Distribution Card */}
            <div className="p-3.5 rounded-lg bg-red-50/70 border border-red-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-red-600" />
                  <span>2026 CCF Tracker</span>
                </span>
                <span className="text-xs font-mono font-bold bg-white text-red-800 px-2 py-0.5 rounded border border-red-200">
                  {count2026} Cases
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Created Year = 2026. Translated with 10 computed columns &amp; ≤90 SLA equations.
              </p>
              <button
                onClick={() => onNavigateToTab?.('tracker-2026')}
                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-white bg-[#E30613] hover:bg-red-700 rounded transition-colors"
              >
                <span>Open 2026 CCF Tracker</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Backlog CCF Tracker Distribution Card */}
            <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                  <Archive className="w-4 h-4 text-amber-600" />
                  <span>Backlog CCF Tracker</span>
                </span>
                <span className="text-xs font-mono font-bold bg-white text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                  {countBacklog} Cases
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Created Year &lt; 2026. Legacy resolution items contributing 50% to Internal KPI.
              </p>
              <button
                onClick={() => onNavigateToTab?.('tracker-backlog')}
                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded transition-colors"
              >
                <span>Open Backlog CCF Tracker</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* External CCF Tracker Distribution Card */}
            <div className="p-3.5 rounded-lg bg-sky-50/70 border border-sky-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-900 flex items-center gap-1.5">
                  <Globe2 className="w-4 h-4 text-sky-600" />
                  <span>External CCF Tracker</span>
                </span>
                <span className="text-xs font-mono font-bold bg-white text-sky-800 px-2 py-0.5 rounded border border-sky-200">
                  {countExternal} Cases
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Third-party partner &amp; vendor records controlling the External CCF KPI.
              </p>
              <button
                onClick={() => onNavigateToTab?.('tracker-external')}
                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded transition-colors"
              >
                <span>Open External CCF Tracker</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Mapping Verification */}
      {detectedHeaders.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Header Name Recognition ({detectedHeaders.length} Columns Detected)
            </h3>
            <span className="text-xs text-red-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Independent of Column Sorting Order</span>
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {detectedHeaders.map((h, i) => (
              <div
                key={i}
                className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
              >
                <span className="text-slate-700 truncate font-mono text-[11px]" title={h.raw}>
                  {h.raw}
                </span>
                <span className="text-slate-400 text-[10px]">→</span>
                <span className="text-red-700 font-medium text-[11px] truncate" title={h.mapped}>
                  {h.mapped}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Table of Ingested Records */}
      {displayRows.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Ingested Records Preview ({displayRows.length} Total Rows)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing sample translated columns from the parsed dataset.
              </p>
            </div>
            <button
              onClick={() => onNavigateToTab?.('tracker-2026')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
            >
              <span>View in 2026 CCF Tracker</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="px-3 py-2">Issue Key</th>
                  <th className="px-3 py-2">Assignee</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 font-mono">Category</th>
                  <th className="px-3 py-2 font-mono">Created Date</th>
                  <th className="px-3 py-2 font-mono">Created Month</th>
                  <th className="px-3 py-2 font-mono text-right">SLA Days</th>
                  <th className="px-3 py-2 font-mono">SLA Duration</th>
                  <th className="px-3 py-2 font-mono">Committed Month</th>
                  <th className="px-3 py-2 font-mono">Progress Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {displayRows.slice(0, 6).map((row) => (
                  <tr key={row.issueKey} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-bold text-slate-800">{row.issueKey}</td>
                    <td className="px-3 py-2 text-slate-700 font-sans">{row.assignee}</td>
                    <td className="px-3 py-2 text-slate-700 font-sans">{row.status}</td>
                    <td className="px-3 py-2">
                      <span className={row.isNewCase ? 'text-red-700 font-bold' : 'text-slate-600'}>
                        {row.isNewCase ? '2026 New' : 'Backlog (<26)'}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.created}</td>
                    <td className="px-3 py-2">{row.createdMonth}</td>
                    <td className="px-3 py-2 text-right">{row.slaDays ?? '-'}</td>
                    <td className="px-3 py-2 font-bold text-red-800">{row.slaDuration}</td>
                    <td className="px-3 py-2">{row.committedMonth}</td>
                    <td className="px-3 py-2">{row.slaProgressStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
