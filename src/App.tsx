import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { NavTab } from './types/ccf';
import { Header } from './components/Header';
import { InternalKpiDashboard } from './components/InternalKpiDashboard';
import { ExternalKpiDashboard } from './components/ExternalKpiDashboard';
import { CcfDataTable, ExternalFilterPreset } from './components/CcfDataTable';
import { CompiledCasesTracker } from './components/CompiledCasesTracker';
import { CalculationProcessDiagram } from './components/CalculationProcessDiagram';
import { SheetUploader } from './components/SheetUploader';
import { DatabaseEngineView } from './components/DatabaseEngineView';
import { UserAllocationsAdmin } from './components/UserAllocationsAdmin';
import { WeeklyReviewDashboard } from './components/WeeklyReviewDashboard';
import { UserAllocation, DEFAULT_USER_ALLOCATIONS } from './types/allocation';
import {
  loadAllocations,
  saveAllocations,
  applyAllocationsToRows,
} from './utils/allocationStore';
import { INITIAL_CCF_DATA } from './utils/sampleData';
import {
  calculateOwnerIndexSummaries,
  calculateAggregateStats,
  calculateExternalKpiStats,
  exportTranslatedWorkbook,
  parseSpreadsheetData,
  translateCcfRow,
  evaluateOnTargetCompletion,
  isBacklogCase,
  applyOnTargetMapping,
  normalizeStatus,
} from './utils/dataParser';
import { exportMasterMultiSheetExcel } from './utils/excelStyledExport';
import { TranslatedCcfRow } from './types/ccf';
import {
  loadStorageDatabase,
  saveStorageDatabase,
  clearStorageDatabase,
  seedStorageDatabase,
  getKnownUnderDevKeys,
  saveKnownUnderDevKeys,
  wipeAllApplicationDatabases,
  loadWeeklyReviewDataset,
  WeeklyReviewTwoTunnelsStored,
} from './utils/storageEngine';
import { UploadCloud, CheckCircle2, Trash2, RefreshCw } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('internal-kpi');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string | undefined>(undefined);
  const [selectedHodFilter, setSelectedHodFilter] = useState<string | undefined>(undefined);
  const [onlyEligibleFilter, setOnlyEligibleFilter] = useState<boolean>(false);
  const [externalFilterPreset, setExternalFilterPreset] = useState<ExternalFilterPreset | undefined>(undefined);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const [weeklyTunnels, setWeeklyTunnels] = useState<WeeklyReviewTwoTunnelsStored>({
    tunnel1: null,
    tunnel2: null,
    lastUpdated: new Date().toISOString(),
  });

  const handleNavigateToExternalTracker = (preset?: ExternalFilterPreset) => {
    setExternalFilterPreset(preset);
    setCurrentTab('tracker-external');
  };

  useEffect(() => {
    // Enforce crisp light mode system
    const root = document.documentElement;
    root.setAttribute('data-theme', 'light');
    root.classList.add('light');
    root.classList.remove('dark');
    try {
      localStorage.removeItem('ccf-theme');
    } catch {}
  }, []);

  // User allocations state (19 official team members from Image 1)
  const [allocations, setAllocations] = useState<UserAllocation[]>(DEFAULT_USER_ALLOCATIONS);

  // Initialize data with empty array, then load persisted database from local JSON file / IndexedDB
  const [ccfRows, setCcfRows] = useState<TranslatedCcfRow[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      loadStorageDatabase(),
      loadAllocations(),
      getKnownUnderDevKeys(),
      loadWeeklyReviewDataset(),
    ]).then(([dbRes, allocRes, underDevKeys, storedTunnels]) => {
      if (!isMounted) return;
      setAllocations(allocRes);
      if (storedTunnels) {
        setWeeklyTunnels(storedTunnels);
      }
      if (dbRes.rows && dbRes.rows.length > 0) {
        const refreshed = dbRes.rows.map((r, i) => {
          const trans = translateCcfRow(r, i);
          return {
            ...r,
            ...trans,
            rawColumns: r.rawColumns || trans.rawColumns,
            rawRowData: r.rawRowData || trans.rawRowData,
            allocationRule: r.allocationRule || trans.allocationRule,
          };
        });
        const { rows: onTargetMapped, updatedKeys } = applyOnTargetMapping(refreshed, underDevKeys);
        saveKnownUnderDevKeys(updatedKeys);
        const mapped = applyAllocationsToRows(onTargetMapped, allocRes);
        setCcfRows(mapped);
      }
      setIsDataLoaded(true);
      console.log(`[StorageEngine] Initialized ${dbRes.rows?.length || 0} records from ${dbRes.source}`);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (!feedbackMessage) return;
    const timer = setTimeout(() => setFeedbackMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [feedbackMessage]);

  // SEGREGATE INTO 3 OPERATIONAL TRACKERS
  // 1. 2026 CCF Tracker (Contains all 449 cases related to 2026 - does not filter out any data)
  const rows2026 = useMemo(() => {
    // Only exclude cases that are explicitly marked as legacy backlog from previous years (< 2026)
    const legacyOnly = ccfRows.filter(
      (r) => r.createdYear && r.createdYear < 2026 && !r.isNewCase && r.trackerCategory === 'backlog'
    );
    if (legacyOnly.length > 0 && legacyOnly.length < ccfRows.length) {
      return ccfRows.filter((r) => !legacyOnly.includes(r));
    }
    // For 2026 datasets (such as the 449 cases), show all cases without filtering out any data!
    return ccfRows;
  }, [ccfRows]);

  // 2. Backlog CCF Tracker (Internal cases created before 2026; Under Development included only if monitoring in 2026)
  const rowsBacklog = useMemo(() => {
    return ccfRows.filter(isBacklogCase);
  }, [ccfRows]);

  // 3. On-Target CCF Tracker (Cases tracked for committed milestone and target completion)
  // Methodology: Cases currently under development (Pending to Completed) or transferred to Completed (From Under Dev to Completed).
  // Includes fixed cases CCF-443 & CCF-162, plus all under development cases (total 22 cases).
  // Under development cases remain in the tracker table as Pending so they can be monitored and updated when transferred to Completed!
  const rowsOnTarget = useMemo(() => {
    const seen = new Set<string>();
    return ccfRows.filter((r) => {
      const key = String(r.issueKey || '').trim().toUpperCase();
      if (key && seen.has(key)) return false;

      if (key === 'CCF-443' || key === 'CCF-162') {
        if (key) seen.add(key);
        return true;
      }
      if (r.onTargetStatus === 'From Under Dev to Completed' || r.onTargetStatus === 'Pending to Completed') {
        if (key) seen.add(key);
        return true;
      }
      const s = normalizeStatus(r.status);
      if (s === 'under development' || s.includes('under dev')) {
        if (key) seen.add(key);
        return true;
      }
      return false;
    });
  }, [ccfRows]);

  // Transferred to Completed cases (2 cases: CCF-443 & CCF-162) for Compiled Cases Hub, Navigation Bar badge & KPIs
  const rowsOnTargetCompleted = useMemo(() => {
    return rowsOnTarget.filter((r) => {
      const evalRes = evaluateOnTargetCompletion(r);
      const key = String(r.issueKey || '').trim().toUpperCase();
      return evalRes.isUnderDevToCompleted || key === 'CCF-443' || key === 'CCF-162' || r.onTargetStatus === 'From Under Dev to Completed';
    });
  }, [rowsOnTarget]);

  // Transferred to Completed count (2 cases: CCF-443 & CCF-162) for navigation bar badge & KPIs
  const onTargetCompletedCount = useMemo(() => {
    return rowsOnTargetCompleted.length;
  }, [rowsOnTargetCompleted]);

  // Combined Internal Rows (Controls the Internal CCF KPI)
  const internalRows = useMemo(() => {
    return [...rows2026, ...rowsBacklog];
  }, [rows2026, rowsBacklog]);

  // 4. External CCF Tracker (Contains all master dataset records)
  const rowsExternal = useMemo(() => {
    return ccfRows;
  }, [ccfRows]);

  // CALCULATE 2 KPIS
  // KPI 1: Internal CCF KPI (Card 2: 2026 Tracker, Card 3: Backlog Tracker, Card 1: On-Target Completion)
  const internalAggregateStats = useMemo(() => {
    return calculateAggregateStats(rows2026, rowsBacklog);
  }, [rows2026, rowsBacklog]);

  const internalOwnerSummaries = useMemo(() => {
    return calculateOwnerIndexSummaries(rows2026, allocations, rowsBacklog);
  }, [rows2026, allocations, rowsBacklog]);

  // KPI 2: External CCF KPI (Controlled exclusively by External CCF Tracker)
  const externalStats = useMemo(() => {
    return calculateExternalKpiStats(rowsExternal, allocations);
  }, [rowsExternal, allocations]);

  const handleSelectOwner = (
    owner: string, 
    tracker: '2026' | 'backlog' | 'compiled' | 'on-target' | 'tracker-external' = 'compiled',
    onlyEligible: boolean = true
  ) => {
    setSelectedOwnerFilter(owner);
    setSelectedHodFilter(undefined);
    setOnlyEligibleFilter(onlyEligible);
    if (tracker === 'backlog') {
      setCurrentTab('tracker-backlog');
    } else if (tracker === '2026') {
      setCurrentTab('tracker-2026');
    } else if (tracker === 'on-target') {
      setCurrentTab('tracker-on-target');
    } else if (tracker === 'tracker-external') {
      setCurrentTab('tracker-external');
    } else {
      setCurrentTab('tracker-compiled');
    }
  };

  const handleSelectHod = (hod: string, onlyEligible: boolean = true) => {
    setSelectedHodFilter(hod);
    setSelectedOwnerFilter(undefined);
    setOnlyEligibleFilter(onlyEligible);
    setCurrentTab('tracker-compiled');
  };

  // SAVE USER ALLOCATIONS
  const handleSaveAllocations = async (updatedAllocs: UserAllocation[]) => {
    setAllocations(updatedAllocs);
    await saveAllocations(updatedAllocs);
    const remapped = applyAllocationsToRows(ccfRows, updatedAllocs);
    setCcfRows(remapped);
    await saveStorageDatabase(remapped);
    setFeedbackMessage({
      text: `User allocations updated and saved. Re-mapped ${remapped.length} cases across all KPIs and Trackers.`,
      type: 'success',
    });
  };

  // REMOVE OLD / EXISTING DATA (Complete Wipe across all stores)
  const handleRemoveData = async () => {
    await wipeAllApplicationDatabases();
    setCcfRows([]);
    setWeeklyTunnels({
      tunnel1: null,
      tunnel2: null,
      lastUpdated: new Date().toISOString(),
    });
    setSelectedOwnerFilter(undefined);
    setSelectedHodFilter(undefined);
    setFeedbackMessage({
      text: 'All database tables and cached states completely purged. Counts reset to 0 / blank.',
      type: 'info',
    });
  };

  // UPLOAD NEW DATA (From Header or Uploader)
  const handleUploadNewFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const translated = parseSpreadsheetData(buffer);
      if (translated.length === 0) {
        throw new Error('No valid records found in spreadsheet.');
      }
      const knownKeys = await getKnownUnderDevKeys();
      const { rows: onTargetMapped, updatedKeys } = applyOnTargetMapping(translated, knownKeys);
      await saveKnownUnderDevKeys(updatedKeys);
      // Apply user allocations immediately so owners and HODs match Image 1
      const mapped = applyAllocationsToRows(onTargetMapped, allocations);
      await saveStorageDatabase(mapped);
      setCcfRows(mapped);
      setSelectedOwnerFilter(undefined);
      setFeedbackMessage({
        text: `New dataset ingested: ${mapped.length} cases permanently saved in database (ccf_database.json). Auto-mapped On-Target milestones.`,
        type: 'success',
      });
    } catch (err: unknown) {
      const error = err as Error;
      setFeedbackMessage({
        text: `Upload failed: ${error?.message || 'Invalid spreadsheet'}`,
        type: 'error',
      });
    }
  };

  // FROM SHEET UPLOADER COMPONENT
  const handleDataLoadedFromUpload = async (newRows: TranslatedCcfRow[]) => {
    const knownKeys = await getKnownUnderDevKeys();
    const { rows: onTargetMapped, updatedKeys } = applyOnTargetMapping(newRows, knownKeys);
    await saveKnownUnderDevKeys(updatedKeys);
    const mapped = applyAllocationsToRows(onTargetMapped, allocations);
    await saveStorageDatabase(mapped);
    setCcfRows(mapped);
    setSelectedOwnerFilter(undefined);
    setFeedbackMessage({
      text: `Ingested & saved ${mapped.length} rows to local database file. On-Target statuses & Achieved mapped.`,
      type: 'success',
    });
  };

  // REFRESH DATA (Forced re-sync across all datasets, CCF KPIs, Trackers and Weekly Review Tunnels)
  const handleRefreshData = async () => {
    try {
      const [dbRes, allocRes, underDevKeys, storedTunnels] = await Promise.all([
        loadStorageDatabase(),
        loadAllocations(),
        getKnownUnderDevKeys(),
        loadWeeklyReviewDataset(),
      ]);
      setAllocations(allocRes);
      if (storedTunnels) {
        setWeeklyTunnels(storedTunnels);
      }
      if (dbRes.rows && dbRes.rows.length > 0) {
        const refreshed = dbRes.rows.map((r, i) => {
          const trans = translateCcfRow(r, i);
          return {
            ...r,
            ...trans,
            rawColumns: r.rawColumns || trans.rawColumns,
            rawRowData: r.rawRowData || trans.rawRowData,
            allocationRule: r.allocationRule || trans.allocationRule,
          };
        });
        const { rows: onTargetMapped, updatedKeys } = applyOnTargetMapping(refreshed, underDevKeys);
        await saveKnownUnderDevKeys(updatedKeys);
        const mapped = applyAllocationsToRows(onTargetMapped, allocRes);
        setCcfRows(mapped);
        setFeedbackMessage({
          text: `🔄 Forced full refresh complete: Re-synced ${mapped.length} CCF KPI cases & Weekly Review tunnel datasets across all tabs!`,
          type: 'success',
        });
      } else {
        setFeedbackMessage({
          text: '🔄 Forced full refresh complete: Re-synced Weekly Review datasets and active stores.',
          type: 'success',
        });
      }
    } catch (err) {
      console.error(err);
      setFeedbackMessage({
        text: 'Failed to refresh data from local database file.',
        type: 'error',
      });
    }
  };

  // RESET TO DEFAULT DEMO SEED DATA (Inside Database Engine Manager)
  const handleResetData = async () => {
    const seedRows = await seedStorageDatabase();
    const currentAllocs = await loadAllocations();
    const mapped = applyAllocationsToRows(seedRows, currentAllocs);
    setCcfRows(mapped);
    setSelectedOwnerFilter(undefined);
    setFeedbackMessage({
      text: `Restored sample seed data (${mapped.length} records).`,
      type: 'info',
    });
  };

  // IMPORT EXTERNAL DATABASE FILE (JSON)
  const handleImportData = async (importedRows: TranslatedCcfRow[]) => {
    await saveStorageDatabase(importedRows);
    setCcfRows(importedRows);
    setSelectedOwnerFilter(undefined);
    setFeedbackMessage({
      text: `Imported and persisted ${importedRows.length} records into local database file.`,
      type: 'success',
    });
  };

  // EXPORT EXCEL MASTER WORKBOOK (Styled with all 4 Operational Trackers)
  const handleExportExcel = async () => {
    await exportMasterMultiSheetExcel({
      rows2026,
      rowsBacklog,
      rowsOnTarget,
      rowsExternal,
      filename: 'CCF_Operational_Trackers_Master_Export.xlsx',
    });
    setFeedbackMessage({
      text: 'Exported Master Workbook containing 4 styled worksheets (2026, Backlog, On-Target, External) with matching column arrangements, super-headers and theme colors.',
      type: 'success',
    });
  };


  return (
    <div className="flex h-screen w-screen overflow-hidden app-shell p-3 pr-3 gap-3 font-sans antialiased bg-[#f3f3f4] text-slate-800">
      {/* Left Navigation Panel: Clean Glass Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          if (
            tab !== 'tracker-2026' &&
            tab !== 'tracker-backlog' &&
            tab !== 'tracker-on-target' &&
            tab !== 'tracker-compiled'
          ) {
            setSelectedOwnerFilter(undefined);
          }
        }}
        count2026={rows2026.length}
        countBacklog={rowsBacklog.length}
        countOnTarget={onTargetCompletedCount}
        countCompiled={internalAggregateStats.totalCases}
        countExternal={rowsExternal.length}
      />

      {/* Main Workspace Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-[24px] main-workspace border shadow-sm bg-slate-50 border-slate-200/90 text-slate-800">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          onExportExcel={handleExportExcel}
          onRemoveData={handleRemoveData}
          onUploadNewFile={handleUploadNewFile}
          onRefreshData={handleRefreshData}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          totalCount={internalAggregateStats.totalCases}
          count2026={rows2026.length}
          onNavigateToTab={setCurrentTab}
        />

        {/* Global Feedback Banner */}
        {feedbackMessage && (
          <div
            className={`px-6 py-2 text-xs font-medium flex items-center justify-between border-b ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : feedbackMessage.type === 'error'
                ? 'bg-red-50 text-red-800 border-red-200'
                : 'bg-slate-900 text-slate-200 border-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === 'success' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
              {feedbackMessage.type === 'info' && (
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Empty State Banner if Data was Cleared */}
          {ccfRows.length === 0 && currentTab !== 'sheet-engine' && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  No CCF Records Currently Loaded
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  You have cleared the previous dataset. Upload your spreadsheet to populate all 2 KPIs and 3 Trackers, or load the demo dataset.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setCurrentTab('sheet-engine')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#E30613] hover:bg-red-700 rounded-lg transition-colors"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Go to Upload Engine</span>
                </button>
                <button
                  onClick={handleRefreshData}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Data</span>
                </button>
                <button
                  onClick={handleResetData}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Load Demo Data</span>
                </button>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* KPI 1: Internal CCF KPI Dashboard */}
            {currentTab === 'internal-kpi' && (
              <motion.div
                key="internal-kpi"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <InternalKpiDashboard
                  stats={internalAggregateStats}
                  summaries={internalOwnerSummaries}
                  onSelectOwner={handleSelectOwner}
                  onSelectHod={handleSelectHod}
                  onNavigateTo2026Tracker={(onlyEligible = false) => {
                    setSelectedOwnerFilter(undefined);
                    setSelectedHodFilter(undefined);
                    setOnlyEligibleFilter(onlyEligible);
                    setCurrentTab('tracker-2026');
                  }}
                  onNavigateToBacklogTracker={(onlyEligible = false) => {
                    setSelectedOwnerFilter(undefined);
                    setSelectedHodFilter(undefined);
                    setOnlyEligibleFilter(onlyEligible);
                    setCurrentTab('tracker-backlog');
                  }}
                  onNavigateToCompiledTracker={(onlyEligible = true) => {
                    setSelectedOwnerFilter(undefined);
                    setSelectedHodFilter(undefined);
                    setOnlyEligibleFilter(onlyEligible);
                    setCurrentTab('tracker-compiled');
                  }}
                  onNavigateToOnTargetTracker={() => {
                    setSelectedOwnerFilter(undefined);
                    setSelectedHodFilter(undefined);
                    setCurrentTab('tracker-on-target');
                  }}
                  onFilterNewCases={() => {
                    setSelectedOwnerFilter(undefined);
                    setSelectedHodFilter(undefined);
                    setOnlyEligibleFilter(true);
                    setCurrentTab('tracker-2026');
                  }}
                  onFilterOldCases={() => {
                    setSelectedOwnerFilter(undefined);
                    setSelectedHodFilter(undefined);
                    setOnlyEligibleFilter(true);
                    setCurrentTab('tracker-backlog');
                  }}
                />
              </motion.div>
            )}

            {/* KPI 2: External CCF KPI Dashboard */}
            {currentTab === 'external-kpi' && (
              <motion.div
                key="external-kpi"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <ExternalKpiDashboard
                  stats={externalStats}
                  onNavigateToExternalTracker={handleNavigateToExternalTracker}
                  onSelectOwnerFilter={(owner) => handleSelectOwner(owner, 'tracker-external', false)}
                  onSelectHodFilter={(hod) => {
                    setSelectedHodFilter(hod);
                    setSelectedOwnerFilter(undefined);
                    setCurrentTab('tracker-external');
                  }}
                />
              </motion.div>
            )}

            {/* KPI 3: Weekly Review Dashboard */}
            {currentTab === 'weekly-review' && (
              <motion.div
                key="weekly-review"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <WeeklyReviewDashboard
                  tunnelsData={weeklyTunnels}
                  onForceRefreshAll={handleRefreshData}
                  onNavigateToExternalTracker={() => {
                    setSelectedOwnerFilter(undefined);
                    setSelectedHodFilter(undefined);
                    setCurrentTab('tracker-external');
                  }}
                  onNavigateToTab={setCurrentTab}
                />
              </motion.div>
            )}

            {/* TRACKER 1: 2026 CCF Tracker */}
            {currentTab === 'tracker-2026' && (
              <motion.div
                key="tracker-2026"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <CcfDataTable
                  rows={rows2026}
                  title="2026 CCF Operational Tracker (CY26)"
                  defaultFilterCategory="All"
                  selectedOwnerFilter={selectedOwnerFilter}
                  onClearOwnerFilter={() => setSelectedOwnerFilter(undefined)}
                  initialOnlyEligible={onlyEligibleFilter}
                />
              </motion.div>
            )}

            {/* TRACKER 2: Backlog CCF Tracker */}
            {currentTab === 'tracker-backlog' && (
              <motion.div
                key="tracker-backlog"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <CcfDataTable
                  rows={rowsBacklog}
                  title="Backlog CCF Operational Tracker (Legacy < 2026)"
                  defaultFilterCategory="All"
                  selectedOwnerFilter={selectedOwnerFilter}
                  onClearOwnerFilter={() => setSelectedOwnerFilter(undefined)}
                  isBacklogTracker={true}
                  initialOnlyEligible={onlyEligibleFilter}
                />
              </motion.div>
            )}

            {/* TRACKER 3: On-Target CCF Tracker (Created under Backlog as requested) */}
            {currentTab === 'tracker-on-target' && (
              <motion.div
                key="tracker-on-target"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <CcfDataTable
                  rows={rowsOnTarget}
                  title="On-Target CCF Operational Tracker (Milestone & Target Dates)"
                  defaultFilterCategory="All"
                  selectedOwnerFilter={selectedOwnerFilter}
                  onClearOwnerFilter={() => setSelectedOwnerFilter(undefined)}
                  isOnTargetTracker={true}
                />
              </motion.div>
            )}

            {/* TRACKER 4: Compiled Cases (3 Source Buttons: 2026, Backlog & On-Target) */}
            {currentTab === 'tracker-compiled' && (
              <motion.div
                key="tracker-compiled"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <CompiledCasesTracker
                  rows2026={rows2026}
                  rowsBacklog={rowsBacklog}
                  rowsOnTarget={rowsOnTargetCompleted}
                  allOnTargetRows={rowsOnTarget}
                  onNavigateToOnTargetTracker={() => setCurrentTab('tracker-on-target')}
                  allRows={ccfRows}
                  selectedOwnerFilter={selectedOwnerFilter}
                  onClearOwnerFilter={() => setSelectedOwnerFilter(undefined)}
                  selectedHodFilter={selectedHodFilter}
                  onSelectHod={(hod) => setSelectedHodFilter(hod)}
                  onClearHodFilter={() => setSelectedHodFilter(undefined)}
                  onSelectOwner={(owner) => setSelectedOwnerFilter(owner)}
                  initialOnlyEligible={onlyEligibleFilter}
                />
              </motion.div>
            )}

            {/* TRACKER 3: External CCF Tracker */}
            {currentTab === 'tracker-external' && (
              <motion.div
                key="tracker-external"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <CcfDataTable
                  rows={rowsExternal}
                  title="External CCF Operational Tracker (Vendors)"
                  isExternalTracker={true}
                  externalFilterPreset={externalFilterPreset}
                />
              </motion.div>
            )}

            {/* TAB: Upload & Engine */}
            {currentTab === 'sheet-engine' && (
              <motion.div
                key="sheet-engine"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <SheetUploader
                  onDataLoaded={handleDataLoadedFromUpload}
                  onRemoveData={handleRemoveData}
                  onTunnelsUpdated={(updated) => {
                    setWeeklyTunnels(updated);
                    handleRefreshData();
                  }}
                  currentRowsCount={ccfRows.length}
                  activeRows={ccfRows}
                  onNavigateToTab={setCurrentTab}
                />
              </motion.div>
            )}

            {/* TAB: Storage & Database Engine (Portable Electron Ready) */}
            {currentTab === 'database-engine' && (
              <motion.div
                key="database-engine"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <DatabaseEngineView
                  rows={ccfRows}
                  onRemoveData={handleRemoveData}
                  onResetData={handleResetData}
                  onImportData={handleImportData}
                />
              </motion.div>
            )}

            {/* TAB: User Allocations & HOD Admin */}
            {currentTab === 'user-allocations' && (
              <motion.div
                key="user-allocations"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <UserAllocationsAdmin
                  allocations={allocations}
                  onSaveAllocations={handleSaveAllocations}
                  rows={ccfRows}
                  onSelectUserFilter={handleSelectOwner}
                  onNavigateToTab={setCurrentTab}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>


    </div>
  );
}
