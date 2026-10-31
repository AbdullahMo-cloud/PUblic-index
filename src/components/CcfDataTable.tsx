import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TranslatedCcfRow } from '../types/ccf';
import {
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Info,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  Maximize2,
  Minimize2,
  Check,
  Copy,
  Columns,
  RotateCcw,
  SlidersHorizontal,
  User,
} from 'lucide-react';
import { identifyHeaderField } from '../utils/dataParser';
import {
  formatDateTime12h,
  parseDateFlexible,
  isDateOrMonthField,
  extractCellDate,
  extractYearFromValue,
} from '../utils/dateAndFormulaUtils';
import {
  exportTrackerStyledExcel,
  copyTableWithThemeToClipboard,
  TrackerType,
} from '../utils/excelStyledExport';

export interface ExternalFilterPreset {
  devRequired?: 'Yes' | 'No';
  caseHorizon?: 'Eligible 2026' | '2027 Exceed Level' | string;
  month?: string;
  status?: string;
}

interface CcfDataTableProps {
  rows: TranslatedCcfRow[];
  title: string;
  defaultFilterCategory?: 'All' | 'New' | 'Old';
  defaultFilterStatus?: string;
  selectedOwnerFilter?: string;
  onClearOwnerFilter?: () => void;
  hideCalculations?: boolean;
  isBacklogTracker?: boolean;
  isOnTargetTracker?: boolean;
  isExternalTracker?: boolean;
  initialOnlyEligible?: boolean;
  externalFilterPreset?: ExternalFilterPreset;
}

export type ColumnGroupMode = 'all' | 'completed' | 'in_progress' | 'translated' | 'uploaded';

export interface ColumnDefinition {
  key: string;
  label: string;
  isFormula?: boolean;
  isRaw?: boolean;
  group: 'uploaded' | 'completed' | 'in_progress';
  width: string;
}

export const CcfDataTable: React.FC<CcfDataTableProps> = ({
  rows,
  title,
  defaultFilterCategory = 'All',
  defaultFilterStatus = 'All',
  selectedOwnerFilter,
  onClearOwnerFilter,
  hideCalculations = false,
  isBacklogTracker = false,
  isOnTargetTracker = false,
  isExternalTracker = false,
  initialOnlyEligible = false,
  externalFilterPreset,
}) => {
  // Global search & filters
  const [search, setSearch] = useState('');
  const [columnGroupMode, setColumnGroupMode] = useState<ColumnGroupMode>('all');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [selectedRow, setSelectedRow] = useState<TranslatedCcfRow | null>(null);

  // Column Visibility / Hide Options
  const [hiddenColKeys, setHiddenColKeys] = useState<Set<string>>(new Set());
  const [showColumnChooser, setShowColumnChooser] = useState(false);
  const [colChooserSearch, setColChooserSearch] = useState('');

  // Sorting: Default to Created date from new to old (descending)
  const [sortCol, setSortCol] = useState<string>('created');
  const [sortAsc, setSortAsc] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Excel-Style Per-Column Filters
  // Structure: { [colKey]: string[] } (array of allowed values)
  const [activeColumnFilters, setActiveColumnFilters] = useState<Record<string, string[]>>({});
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [tempSelectedValues, setTempSelectedValues] = useState<string[]>([]);
  const filterPopupRef = useRef<HTMLDivElement>(null);

  // Dynamic Cascading Quick Filters
  const [quickUser, setQuickUser] = useState<string>(selectedOwnerFilter || 'All');
  const [quickStatus, setQuickStatus] = useState<string>(defaultFilterStatus || 'All');
  const [quickMonth, setQuickMonth] = useState<string>('All');
  const [quickSla, setQuickSla] = useState<string>('All');
  const [onlyEligible, setOnlyEligible] = useState<boolean>(Boolean(initialOnlyEligible));

  // Determine tracker type for styled exports, copy-paste theme, and colors
  const trackerType: TrackerType = isExternalTracker
    ? 'external'
    : isOnTargetTracker
    ? 'on-target'
    : isBacklogTracker
    ? 'backlog'
    : '2026';

  const [copiedTheme, setCopiedTheme] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (initialOnlyEligible !== undefined) {
      setOnlyEligible(initialOnlyEligible);
    }
  }, [initialOnlyEligible]);

  useEffect(() => {
    if (externalFilterPreset) {
      const filters: Record<string, string[]> = {};
      if (externalFilterPreset.devRequired) {
        filters['normalizedDevRequired'] = [externalFilterPreset.devRequired];
      }
      if (externalFilterPreset.caseHorizon) {
        filters['caseHorizon2026'] = [externalFilterPreset.caseHorizon];
      }
      if (externalFilterPreset.status) {
        filters['externalTrackerStatus'] = [externalFilterPreset.status];
      }
      if (externalFilterPreset.month) {
        filters['month2026'] = [externalFilterPreset.month];
      }
      setActiveColumnFilters(filters);
      setPage(1);
    }
  }, [externalFilterPreset]);

  // Total eligible cases in this tracker (e.g. 135 for 2026 cases, 127/124 for Backlog)
  const totalEligibleCount = useMemo(() => {
    return rows.filter((r) => {
      const s = (r.status || '').toLowerCase().trim();
      if (isBacklogTracker) {
        return (
          s !== 'not started' &&
          s !== 'cancelled' &&
          s !== 'canceled' &&
          !s.includes('not started') &&
          !s.includes('cancell')
        );
      }
      return (
        s !== 'not started' &&
        s !== 'new' &&
        s !== 'cancelled' &&
        !s.includes('not started') &&
        !s.includes('cancelled')
      );
    }).length;
  }, [rows, isBacklogTracker]);

  // Synchronize with selectedOwnerFilter from parent
  useEffect(() => {
    if (selectedOwnerFilter) {
      setQuickUser(selectedOwnerFilter);
    } else {
      setQuickUser('All');
    }
  }, [selectedOwnerFilter]);

  // Listen for Escape key to close Focus Mode or Filter Popover
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openFilterCol) {
          setOpenFilterCol(null);
        } else if (isFocusMode) {
          setIsFocusMode(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode, openFilterCol]);

  // Click outside to close filter popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterPopupRef.current && !filterPopupRef.current.contains(e.target as Node)) {
        setOpenFilterCol(null);
      }
    };
    if (openFilterCol) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openFilterCol]);

  // Helper to extract column string value accurately from either rawRowData or row properties
  const getColValue = (row: TranslatedCcfRow, colKey: string): string => {
    let rawVal: unknown = undefined;

    // 1. Direct translated / row property
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const directVal = (row as any)[colKey];
    if (directVal !== undefined && directVal !== null && directVal !== '') {
      rawVal = directVal;
    } else if (row.rawRowData) {
      // 2. Direct rawRowData lookup
      if (row.rawRowData[colKey] !== undefined && row.rawRowData[colKey] !== '') {
        rawVal = row.rawRowData[colKey];
      } else {
        // Fuzzy case-insensitive lookup in rawRowData
        const lowerKey = colKey.toLowerCase().trim();
        for (const [k, v] of Object.entries(row.rawRowData)) {
          if (k.toLowerCase().trim() === lowerKey && v !== undefined && v !== '') {
            rawVal = v;
            break;
          }
        }
      }
    }

    if (rawVal === undefined || rawVal === null || rawVal === '') {
      // 3. Header mapping lookup: e.g. if colKey is "Custom field (Monitoring Start Date)", identify field -> 'monitoringStartDate'
      const identified = identifyHeaderField(colKey);
      if (identified) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fieldVal = (row as any)[identified];
        if (fieldVal !== undefined && fieldVal !== null && fieldVal !== '') {
          rawVal = fieldVal;
        }
      }
    }

    if (rawVal === undefined || rawVal === null || rawVal === '' || rawVal === '-') {
      return '-';
    }

    const strVal = String(rawVal).trim();
    if (!strVal || strVal === '-') return '-';

    // Format any date / timestamp values to "MM/DD/YYYY h:mm:ss A" (matching Image 2)
    // Avoid re-formatting formula month columns like "Oct-26", "30-Sep-2026", or duration numbers
    const isFormulaMonthCol = [
      'createdMonth',
      'createdMonthCompleted',
      'monthCompleted',
      'committedMonth',
      'committedMonthProgress',
      'slaDuration',
      'slaProgressStatus',
      'slaDays',
      'slaDaysInProgress',
      'committedEndDateValue',
      'monitoringMonth',
      'slaBacklogDays',
      'slaBacklogDuration',
    ].includes(colKey);

    if (!isFormulaMonthCol) {
      // If it looks like JavaScript Date string (Image 1) or column is a date column:
      if (
        strVal.includes('GMT') ||
        strVal.includes('(') ||
        /^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4}/.test(strVal) ||
        (/date|created|updated/i.test(colKey) && !colKey.toLowerCase().includes('month'))
      ) {
        // Keep time ONLY for Created and Updated columns; strip time for all other date columns
        const isTimePreserved = /^created$|^updated$|date\s*created|date\s*updated/i.test(colKey.trim());
        return formatDateTime12h(strVal, isTimePreserved);
      }
    }

    return strVal;
  };

  // Build the list of columns to display
  // 1. ALL Uploaded Raw Columns from Sheet arranged logically with primary identifiers first
  const uploadedCols: ColumnDefinition[] = useMemo(() => {
    const priorityOrder = [
      'issue key',
      'issue type',
      'summary',
      'status',
      'assignee',
      'created',
      'custom field (monitoring start date)',
      'monitoring start date',
      'custom field (monitoring end date)',
      'monitoring end date',
      'updated',
      'custom field (committed start date)',
      'committed start date',
      'custom field (committed end date)',
      'committed end date',
      'custom field (in progress date)',
      'in progress date',
      'custom field (dev required)',
      'dev required',
      'custom field (complaint month)',
      'custom field (change category)',
      'custom field (product groups)',
      'custom field (source)',
      'custom field (assigned date)',
      'custom field (assignee team)',
      'custom field (department)',
      'department',
      'issue id',
      'parent id',
      'description',
    ];

    const getPriority = (colName: string): number => {
      const lower = colName.toLowerCase().trim();
      const direct = priorityOrder.indexOf(lower);
      if (direct !== -1) return direct;
      for (let i = 0; i < priorityOrder.length; i++) {
        if (lower.includes(priorityOrder[i])) return i;
      }
      return 1000;
    };

    const sampleRow = rows.find((r) => r.rawColumns && r.rawColumns.length > 0) || rows[0];
    if (sampleRow && sampleRow.rawColumns && sampleRow.rawColumns.length > 0) {
      const sortedRaw = [...sampleRow.rawColumns].sort((a, b) => getPriority(a) - getPriority(b));
      return sortedRaw.map((colName) => ({
        key: colName,
        label: colName,
        isRaw: true,
        group: 'uploaded' as const,
        width: colName.toLowerCase().includes('summary') ? 'w-64' : 'w-36',
      }));
    }

    // Default: The 23 standard headers arranged with primary fields first
    return [
      { key: 'issueKey', label: 'Issue key', isRaw: true, group: 'uploaded' as const, width: 'w-28' },
      { key: 'issueType', label: 'Issue Type', isRaw: true, group: 'uploaded' as const, width: 'w-24' },
      { key: 'summary', label: 'Summary', isRaw: true, group: 'uploaded' as const, width: 'w-64' },
      { key: 'status', label: 'Status', isRaw: true, group: 'uploaded' as const, width: 'w-28' },
      { key: 'assignee', label: 'Assignee', isRaw: true, group: 'uploaded' as const, width: 'w-36' },
      { key: 'created', label: 'Created', isRaw: true, group: 'uploaded' as const, width: 'w-36' },
      { key: 'monitoringStartDate', label: 'Custom field (Monitoring Start Date)', isRaw: true, group: 'uploaded' as const, width: 'w-44' },
      { key: 'monitoringEndDate', label: 'Custom field (Monitoring End Date)', isRaw: true, group: 'uploaded' as const, width: 'w-44' },
      { key: 'updated', label: 'Updated', isRaw: true, group: 'uploaded' as const, width: 'w-36' },
      { key: 'committedStartDate', label: 'Custom field (Committed Start Date)', isRaw: true, group: 'uploaded' as const, width: 'w-44' },
      { key: 'committedEndDate', label: 'Custom field (Committed End Date)', isRaw: true, group: 'uploaded' as const, width: 'w-44' },
      { key: 'inProgressStartDate', label: 'Custom field (In Progress Date)', isRaw: true, group: 'uploaded' as const, width: 'w-44' },
      { key: 'devRequired', label: 'Custom field (Dev Required)', isRaw: true, group: 'uploaded' as const, width: 'w-36' },
      { key: 'complaintMonth', label: 'Custom field (Complaint Month)', isRaw: true, group: 'uploaded' as const, width: 'w-40' },
      { key: 'changeCategory', label: 'Custom field (Change Category)', isRaw: true, group: 'uploaded' as const, width: 'w-40' },
      { key: 'productGroups', label: 'Custom field (Product Groups)', isRaw: true, group: 'uploaded' as const, width: 'w-40' },
      { key: 'source', label: 'Custom field (Source)', isRaw: true, group: 'uploaded' as const, width: 'w-36' },
      { key: 'assignedDate', label: 'Custom field (Assigned Date)', isRaw: true, group: 'uploaded' as const, width: 'w-40' },
      { key: 'assigneeTeam', label: 'Custom field (Assignee Team)', isRaw: true, group: 'uploaded' as const, width: 'w-44' },
      { key: 'department', label: 'Custom field (Department)', isRaw: true, group: 'uploaded' as const, width: 'w-40' },
      { key: 'issueId', label: 'Issue id', isRaw: true, group: 'uploaded' as const, width: 'w-24' },
      { key: 'parentId', label: 'Parent id', isRaw: true, group: 'uploaded' as const, width: 'w-24' },
      { key: 'description', label: 'Description', isRaw: true, group: 'uploaded' as const, width: 'w-48' },
    ];
  }, [rows]);

  // 2. PART 1: Completed Calculation Columns (First Part with Distinct Header)
  const completedCols: ColumnDefinition[] = useMemo(() => [
    { key: 'createdMonth', label: 'Created Month', isFormula: true, group: 'completed' as const, width: 'w-28' },
    { key: 'createdMonthCompleted', label: 'Created Month (Completed)', isFormula: true, group: 'completed' as const, width: 'w-44' },
    { key: 'monthCompleted', label: 'Month Completed', isFormula: true, group: 'completed' as const, width: 'w-36' },
    { key: 'slaDays', label: 'SLA Days', isFormula: true, group: 'completed' as const, width: 'w-32' },
    { key: 'slaDuration', label: 'SLA Duration (≤90)', isFormula: true, group: 'completed' as const, width: 'w-36' },
  ], []);

  // 3. PART 2: In Progress Calculation Columns (From Committed Month to the End with Different Header)
  const inProgressCols: ColumnDefinition[] = useMemo(() => [
    { key: 'committedMonth', label: 'Committed Month', isFormula: true, group: 'in_progress' as const, width: 'w-32' },
    { key: 'committedEndDateValue', label: 'Committed End Date Value', isFormula: true, group: 'in_progress' as const, width: 'w-44' },
    { key: 'slaDaysInProgress', label: 'SLA Days in Progress', isFormula: true, group: 'in_progress' as const, width: 'w-36' },
    { key: 'slaProgressStatus', label: 'SLA Progress Status', isFormula: true, group: 'in_progress' as const, width: 'w-36' },
    { key: 'committedMonthProgress', label: 'Committed Month (Progress)', isFormula: true, group: 'in_progress' as const, width: 'w-44' },
  ], []);

  const backlogCols: ColumnDefinition[] = useMemo(() => [
    { key: 'monitoringMonth', label: 'Monitoring Month', isFormula: true, group: 'completed' as const, width: 'w-36' },
    { key: 'slaBacklogDays', label: 'SLA', isFormula: true, group: 'completed' as const, width: 'w-28' },
    { key: 'slaBacklogDuration', label: 'SLA duration', isFormula: true, group: 'completed' as const, width: 'w-36' },
  ], []);

  const onTargetCols: ColumnDefinition[] = useMemo(() => [
    { key: 'onTargetStatus', label: 'On-Target Status', isFormula: true, group: 'completed' as const, width: 'w-56' },
    { key: 'committedMonth', label: 'Committed Month', isFormula: true, group: 'in_progress' as const, width: 'w-36' },
    { key: 'resolved', label: 'Resolved Date', isFormula: true, group: 'completed' as const, width: 'w-48' },
    { key: 'resolvedMonth', label: 'Actual Month', isFormula: true, group: 'completed' as const, width: 'w-32' },
    { key: 'achieved', label: 'Achieved', isFormula: true, group: 'completed' as const, width: 'w-28' },
  ], []);

  const externalCols: ColumnDefinition[] = useMemo(() => [
    { key: 'externalTrackerStatus', label: 'Status', isFormula: true, group: 'completed' as const, width: 'w-36' },
    { key: 'month2026', label: '2026 Month', isFormula: true, group: 'completed' as const, width: 'w-36' },
    { key: 'caseHorizon2026', label: '2026 Case Horizon', isFormula: true, group: 'completed' as const, width: 'w-44' },
    { key: 'normalizedDevRequired', label: 'Dev Required', isFormula: true, group: 'completed' as const, width: 'w-32' },
    { key: 'externalSlaCountDays', label: 'SLA Count days', isFormula: true, group: 'completed' as const, width: 'w-36' },
    { key: 'noDevSla', label: 'No Dev SLA (≤90d)', isFormula: true, group: 'completed' as const, width: 'w-40' },
    { key: 'withDevSla', label: 'With Dev SLA (≤180d)', isFormula: true, group: 'completed' as const, width: 'w-40' },
  ], []);

  const translatedCols = useMemo(() => [...completedCols, ...inProgressCols], [completedCols, inProgressCols]);

  const allAvailableCols = useMemo(() => {
    if (isExternalTracker) return [...uploadedCols, ...externalCols];
    if (isOnTargetTracker) return [...uploadedCols, ...onTargetCols];
    if (isBacklogTracker) return [...uploadedCols, ...backlogCols];
    if (hideCalculations) return [...uploadedCols];
    return [...uploadedCols, ...completedCols, ...inProgressCols];
  }, [uploadedCols, completedCols, inProgressCols, backlogCols, onTargetCols, externalCols, hideCalculations, isBacklogTracker, isOnTargetTracker, isExternalTracker]);

  // Helper actions for hiding / showing columns
  const hideColumn = (key: string) => {
    setHiddenColKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const toggleColumnHide = (key: string) => {
    setHiddenColKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const unhideAllColumns = () => {
    setHiddenColKeys(new Set());
  };

  // Quick Focus Presets
  const focusCompletedOnly = () => {
    const hide = new Set<string>();
    uploadedCols.forEach((c) => hide.add(c.key));
    inProgressCols.forEach((c) => hide.add(c.key));
    setHiddenColKeys(hide);
    setColumnGroupMode('all');
  };

  const focusInProgressOnly = () => {
    const hide = new Set<string>();
    uploadedCols.forEach((c) => hide.add(c.key));
    completedCols.forEach((c) => hide.add(c.key));
    setHiddenColKeys(hide);
    setColumnGroupMode('all');
  };

  const focusAllCalculations = () => {
    const hide = new Set<string>();
    uploadedCols.forEach((c) => hide.add(c.key));
    setHiddenColKeys(hide);
    setColumnGroupMode('all');
  };

  const focusUploadedOnly = () => {
    const hide = new Set<string>();
    completedCols.forEach((c) => hide.add(c.key));
    inProgressCols.forEach((c) => hide.add(c.key));
    setHiddenColKeys(hide);
    setColumnGroupMode('all');
  };

  // Active columns based on mode and hidden keys
  const displayedColumns = useMemo(() => {
    let baseList = allAvailableCols;
    if (columnGroupMode === 'completed') {
      baseList = completedCols;
    } else if (columnGroupMode === 'in_progress') {
      baseList = inProgressCols;
    } else if (columnGroupMode === 'translated') {
      baseList = translatedCols;
    } else if (columnGroupMode === 'uploaded') {
      baseList = uploadedCols;
    }
    return baseList.filter((c) => !hiddenColKeys.has(c.key));
  }, [allAvailableCols, columnGroupMode, completedCols, inProgressCols, translatedCols, uploadedCols, hiddenColKeys]);

  // Sub-counts for visible columns in each group for the super-header
  const visibleUploadedCols = useMemo(() => {
    return displayedColumns.filter((c) => c.group === 'uploaded');
  }, [displayedColumns]);

  const visibleCompletedCols = useMemo(() => {
    return displayedColumns.filter((c) => c.group === 'completed');
  }, [displayedColumns]);

  const visibleInProgressCols = useMemo(() => {
    return displayedColumns.filter((c) => c.group === 'in_progress');
  }, [displayedColumns]);

  // Core dynamic cascading matcher
  const doesRowMatchFilters = (
    r: TranslatedCcfRow,
    options?: {
      excludeColKey?: string;
      skipQuickUser?: boolean;
      skipQuickStatus?: boolean;
      skipQuickMonth?: boolean;
      skipQuickSla?: boolean;
      skipSearch?: boolean;
    }
  ): boolean => {
    // 0. Only Eligible Cases Filter (excludes Not Started, New, and Cancelled for 2026; Not Started and Cancelled for Backlog)
    if (onlyEligible) {
      const s = (r.status || '').toLowerCase().trim();
      const isExcluded = isBacklogTracker
        ? (
            s === 'not started' ||
            s === 'cancelled' ||
            s === 'canceled' ||
            s.includes('not started') ||
            s.includes('cancell')
          )
        : (
            s === 'not started' ||
            s === 'new' ||
            s === 'cancelled' ||
            s.includes('not started') ||
            s.includes('cancelled')
          );
      if (isExcluded) {
        return false;
      }
    }

    // 1. Quick User filter (or selectedOwnerFilter)
    if (!options?.skipQuickUser && quickUser !== 'All') {
      const rowAssignee = (r.assignee || '').toLowerCase().trim();
      const targetUser = quickUser.toLowerCase().trim();
      if (rowAssignee !== targetUser) {
        return false;
      }
    }

    // 2. Quick Status filter
    if (!options?.skipQuickStatus && quickStatus !== 'All') {
      const rowStatus = (r.status || '').toLowerCase().trim();
      const targetStatus = quickStatus.toLowerCase().trim();
      if (rowStatus !== targetStatus) {
        return false;
      }
    }

    // 3. Quick Month filter
    if (!options?.skipQuickMonth && quickMonth !== 'All') {
      const rowMonth = (r.createdMonth || '').toLowerCase().trim();
      const targetMonth = quickMonth.toLowerCase().trim();
      if (rowMonth !== targetMonth) {
        return false;
      }
    }

    // 4. Quick SLA filter
    if (!options?.skipQuickSla && quickSla !== 'All') {
      if (quickSla === '90' && r.slaDuration !== '90') return false;
      if (quickSla === 'More than 90' && r.slaDuration !== 'More than 90') return false;
      if (quickSla === '-' && r.slaDuration !== '-') return false;
    }

    // 5. Global search filter
    if (!options?.skipSearch && search.trim()) {
      const q = search.toLowerCase();
      const match =
        r.issueKey.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.assignee.toLowerCase().includes(q) ||
        (r.hod && r.hod.toLowerCase().includes(q)) ||
        r.createdMonth.toLowerCase().includes(q) ||
        String(r.status).toLowerCase().includes(q);
      if (!match) return false;
    }

    // 6. Per-column Excel filters
    for (const [colKey, allowedValues] of Object.entries(activeColumnFilters)) {
      if (options?.excludeColKey && options.excludeColKey === colKey) {
        continue; // Exclude self during facet calculation
      }
      const val = getColValue(r, colKey);
      if (!allowedValues.includes(val)) {
        return false;
      }
    }

    return true;
  };

  // Filtered rows across all active filters
  const filteredRows = useMemo(() => {
    return rows.filter((r) => doesRowMatchFilters(r));
  }, [rows, quickUser, quickStatus, quickMonth, quickSla, onlyEligible, search, activeColumnFilters]);

  // Compute unique values and exact dynamic counts for a column:
  // Scoped strictly to rows matching all other active filters!
  const getUniqueColumnValues = (colKey: string): { value: string; count: number }[] => {
    const isAssignee = colKey === 'assignee' || colKey === 'owner';
    const isStatus = colKey === 'status';
    const isMonth = colKey === 'createdMonth' || colKey === 'monitoringMonth';
    const isSla = colKey === 'slaDuration' || colKey === 'slaBacklogDuration';

    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      const matches = doesRowMatchFilters(r, {
        excludeColKey: colKey,
        skipQuickUser: isAssignee,
        skipQuickStatus: isStatus,
        skipQuickMonth: isMonth,
        skipQuickSla: isSla,
      });
      if (matches) {
        const val = getColValue(r, colKey);
        counts[val] = (counts[val] || 0) + 1;
      }
    });

    const isDateCol = isDateOrMonthField(colKey);
    if (isDateCol) {
      return Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => {
          if (a.value === '-' || a.value === '' || a.value === 'Unknown') return 1;
          if (b.value === '-' || b.value === '' || b.value === 'Unknown') return -1;
          const dateA = extractCellDate(a.value);
          const dateB = extractCellDate(b.value);
          if (!dateA && !dateB) return a.value.localeCompare(b.value);
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateA.getTime() - dateB.getTime();
        });
    }

    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  };

  // Dynamic Options for Quick Filters (with exact cascading counts)
  const quickUserOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    rows.forEach((r) => {
      if (doesRowMatchFilters(r, { skipQuickUser: true, excludeColKey: 'assignee' })) {
        total++;
        const u = r.assignee || 'Unassigned';
        counts[u] = (counts[u] || 0) + 1;
      }
    });
    const items = Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
    return { items, totalMatching: total };
  }, [rows, quickStatus, quickMonth, quickSla, search, activeColumnFilters]);

  const quickStatusOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    rows.forEach((r) => {
      if (doesRowMatchFilters(r, { skipQuickStatus: true, excludeColKey: 'status' })) {
        total++;
        const s = r.status || 'Unknown';
        counts[s] = (counts[s] || 0) + 1;
      }
    });
    const items = Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
    return { items, totalMatching: total };
  }, [rows, quickUser, quickMonth, quickSla, search, activeColumnFilters]);

  const quickMonthOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    rows.forEach((r) => {
      if (doesRowMatchFilters(r, { skipQuickMonth: true, excludeColKey: 'createdMonth' })) {
        total++;
        const m = r.createdMonth || 'Unknown';
        counts[m] = (counts[m] || 0) + 1;
      }
    });
    const items = Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
    return { items, totalMatching: total };
  }, [rows, quickUser, quickStatus, quickSla, search, activeColumnFilters]);

  const quickSlaOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    rows.forEach((r) => {
      if (doesRowMatchFilters(r, { skipQuickSla: true, excludeColKey: 'slaDuration' })) {
        total++;
        const dur = r.slaDuration || '-';
        counts[dur] = (counts[dur] || 0) + 1;
      }
    });
    const items = Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
    return { items, totalMatching: total };
  }, [rows, quickUser, quickStatus, quickMonth, search, activeColumnFilters]);

  // Dynamic KPI Stats across currently filtered rows
  const filteredStats = useMemo(() => {
    let completed = 0;
    let monitoring = 0;
    let underDev = 0;
    let inProgress = 0;
    let notStarted = 0;
    let newCases = 0;
    let withinSla = 0;
    let moreThanSla = 0;
    let noSla = 0;

    let fromUnderDevToCompleted = 0;
    let pendingToCompleted = 0;
    let achievedYes = 0;
    let achievedNo = 0;
    let achievedPending = 0;

    let cat2026 = 0;
    let catBacklog = 0;
    let catNoBacklog = 0;
    let noDevWithinSla = 0;
    let noDevOutsideSla = 0;
    let withDevWithinSla = 0;
    let withDevOutsideSla = 0;
    let eligible2026 = 0;
    let exceed2027 = 0;

    filteredRows.forEach((r) => {
      const st = (r.status || '').toLowerCase().trim();
      if (st === 'completed') completed++;
      else if (st === 'for monitoring') monitoring++;
      else if (st === 'under development') underDev++;
      else if (st === 'in progress') inProgress++;
      else if (st === 'not started') notStarted++;
      else if (st === 'new') newCases++;

      if (r.caseHorizon2026 === 'Eligible 2026') eligible2026++;
      else if (r.caseHorizon2026 === '2027 Exceed Level') exceed2027++;

      if (r.slaDuration === '90') withinSla++;
      else if (r.slaDuration === 'More than 90') moreThanSla++;
      else noSla++;

      if (r.onTargetStatus === 'From Under Dev to Completed') fromUnderDevToCompleted++;
      else if (r.onTargetStatus === 'Pending to Completed') pendingToCompleted++;

      if (r.achieved === 'Yes') achievedYes++;
      else if (r.achieved === 'No') achievedNo++;
      else if (r.achieved === 'Pending') achievedPending++;

      // External CCF Metrics
      if (r.externalTrackerStatus === '2026') cat2026++;
      else if (r.externalTrackerStatus === 'Backlog') catBacklog++;
      else if (r.externalTrackerStatus === 'No Backlog') catNoBacklog++;

      if (r.noDevSla === 'Within SLA') noDevWithinSla++;
      else if (r.noDevSla === 'Outside SLA') noDevOutsideSla++;

      if (r.withDevSla === 'Within SLA') withDevWithinSla++;
      else if (r.withDevSla === 'Outside SLA') withDevOutsideSla++;
    });

    const activeCases = completed + monitoring + underDev + inProgress;
    const slaEvaluated = withinSla + moreThanSla;
    const slaPct = slaEvaluated > 0 ? Math.round((withinSla / slaEvaluated) * 100) : 0;
    const onTargetRate = fromUnderDevToCompleted > 0 ? Math.round((achievedYes / fromUnderDevToCompleted) * 100) : 100;

    return {
      total: filteredRows.length,
      activeCases,
      completed,
      monitoring,
      underDev,
      inProgress,
      notStarted,
      newCases,
      withinSla,
      moreThanSla,
      noSla,
      slaEvaluated,
      slaPct,
      fromUnderDevToCompleted,
      pendingToCompleted,
      achievedYes,
      achievedNo,
      achievedPending,
      eligible2026,
      exceed2027,
      onTargetRate,
      cat2026,
      catBacklog,
      catNoBacklog,
      noDevWithinSla,
      noDevOutsideSla,
      withDevWithinSla,
      withDevOutsideSla,
    };
  }, [filteredRows]);

  // Open Excel filter popover for a specific column
  const handleOpenFilter = (colKey: string) => {
    if (openFilterCol === colKey) {
      setOpenFilterCol(null);
      return;
    }
    const currentAllowed = activeColumnFilters[colKey];
    const availableVals = getUniqueColumnValues(colKey).map((v) => v.value);
    if (currentAllowed && currentAllowed.length > 0) {
      setTempSelectedValues([...currentAllowed]);
    } else {
      setTempSelectedValues(availableVals);
    }
    setFilterSearchQuery('');
    setOpenFilterCol(colKey);
  };

  // Apply Excel column filter
  const applyExcelFilter = (colKey: string) => {
    const allVals = getUniqueColumnValues(colKey).map((v) => v.value);
    if (allVals.length > 0 && allVals.every((v) => tempSelectedValues.includes(v))) {
      // Clear filter if all available values are selected
      const updated = { ...activeColumnFilters };
      delete updated[colKey];
      setActiveColumnFilters(updated);
    } else {
      setActiveColumnFilters({
        ...activeColumnFilters,
        [colKey]: tempSelectedValues,
      });
    }
    setOpenFilterCol(null);
    setPage(1);
  };

  // Clear a specific column filter
  const clearExcelFilter = (colKey: string) => {
    const updated = { ...activeColumnFilters };
    delete updated[colKey];
    setActiveColumnFilters(updated);
    setOpenFilterCol(null);
    setPage(1);
  };

  // Clear all filters (both quick and excel column filters)
  const clearAllFilters = () => {
    setQuickUser('All');
    setQuickStatus('All');
    setQuickMonth('All');
    setQuickSla('All');
    setOnlyEligible(false);
    setSearch('');
    setActiveColumnFilters({});
    onClearOwnerFilter?.();
    setPage(1);
  };

  const handleQuickUserChange = (u: string) => {
    setQuickUser(u);
    if (u === 'All') {
      onClearOwnerFilter?.();
    }
    setPage(1);
  };

  // Sort rows: Chronologically for all date/month columns, numerically for numbers, alphabetically for text
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const isDateCol = isDateOrMonthField(sortCol);
      if (isDateCol) {
        const valA = getColValue(a, sortCol);
        const valB = getColValue(b, sortCol);
        const dateA = extractCellDate(valA) || (sortCol === 'created' && a.createdYear ? new Date(a.createdYear, 0, 1) : null);
        const dateB = extractCellDate(valB) || (sortCol === 'created' && b.createdYear ? new Date(b.createdYear, 0, 1) : null);

        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;

        const timeA = dateA.getTime();
        const timeB = dateB.getTime();
        if (timeA !== timeB) {
          return sortAsc ? timeA - timeB : timeB - timeA;
        }
        return 0;
      }

      const valA = getColValue(a, sortCol);
      const valB = getColValue(b, sortCol);

      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortAsc ? numA - numB : numB - numA;
      }
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [filteredRows, sortCol, sortAsc]);

  // Paginated rows
  const effectivePageSize = isFocusMode ? 50 : pageSize;
  const totalPages = Math.ceil(sortedRows.length / effectivePageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * effectivePageSize;
    return sortedRows.slice(start, start + effectivePageSize);
  }, [sortedRows, page, effectivePageSize]);

  const activeExcelFilterCount = Object.keys(activeColumnFilters).length;
  const isAnyFilterActive =
    quickUser !== 'All' ||
    quickStatus !== 'All' ||
    quickMonth !== 'All' ||
    quickSla !== 'All' ||
    onlyEligible ||
    search.trim() !== '' ||
    activeExcelFilterCount > 0;

  const handleCopyTableTheme = async () => {
    const success = await copyTableWithThemeToClipboard(
      filteredRows,
      displayedColumns,
      trackerType,
      title
    );
    if (success) {
      setCopiedTheme(true);
      setExportFeedback(`Copied ${filteredRows.length} rows to clipboard with full theme & colors! Paste (Ctrl+V) directly into Excel or PowerPoint.`);
      setTimeout(() => setCopiedTheme(false), 3000);
      setTimeout(() => setExportFeedback(null), 5000);
    }
  };

  const handleExportTrackerExcel = async () => {
    setIsExporting(true);
    try {
      await exportTrackerStyledExcel(
        filteredRows,
        displayedColumns,
        trackerType,
        title,
        `${title.replace(/[\s/\\?%*:|"<>]+/g, '_')}_Excel.xlsx`
      );
      setExportFeedback(`Exported ${filteredRows.length} rows with matching header formats and theme colors to Excel.`);
      setTimeout(() => setExportFeedback(null), 4000);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs flex flex-col ${
        isFocusMode ? 'fixed inset-0 z-50 rounded-none border-0 h-screen w-screen' : ''
      }`}
    >
      {/* Table Toolbar & Focus Mode Banner */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isFocusMode ? 'bg-red-500' : 'bg-rose-600'}`} />
              <h2 className="text-sm font-semibold text-slate-800">
                {title} {isFocusMode ? '— Excel Spreadsheet Focus View' : ''}
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500 font-medium">
              ({sortedRows.length} displayed / {rows.length} total)
            </span>
            {isAnyFilterActive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-800 text-[11px] font-semibold">
                <span>Dynamic Filters Active</span>
                <button
                  onClick={clearAllFilters}
                  className="hover:text-rose-950 font-bold ml-0.5"
                  title="Clear all filters"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* HIDE / SHOW COLUMNS BUTTON */}
            <button
              onClick={() => setShowColumnChooser(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors shadow-2xs border ${
                hiddenColKeys.size > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
              title="Hide or show columns to focus"
            >
              <EyeOff className="w-3.5 h-3.5 text-slate-500" />
              <span>Hide / Show Columns</span>
              {hiddenColKeys.size > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 text-[10px] rounded-full font-bold">
                  {hiddenColKeys.size} hidden
                </span>
              )}
            </button>

            {hiddenColKeys.size > 0 && (
              <button
                onClick={unhideAllColumns}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded font-semibold hover:bg-rose-100 transition-colors"
                title="Unhide all columns"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Unhide All</span>
              </button>
            )}

            {/* FOCUS MODE / EXCEL VIEW TOGGLE BUTTON */}
            <button
              onClick={() => setIsFocusMode(!isFocusMode)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors shadow-2xs ${
                isFocusMode
                  ? 'bg-red-700 hover:bg-red-800 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
              title="Expand to immersive Excel mode with column filters"
            >
              {isFocusMode ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Exit Focus Mode</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Focus Mode (Excel View)</span>
                </>
              )}
            </button>

            {/* COPY TABLE (PASTE THEME) BUTTON */}
            <button
              onClick={handleCopyTableTheme}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors shadow-2xs border ${
                copiedTheme
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
              title="Copy table with full theme & colors to clipboard — paste (Ctrl+V) directly into Excel, PowerPoint, or Word"
            >
              {copiedTheme ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{copiedTheme ? 'Copied with Theme!' : 'Copy Table (Paste Theme)'}</span>
            </button>

            {/* EXPORT EXCEL BUTTON (SAME FORMAT & ARRANGE COLUMNS & THEME COLORS) */}
            <button
              onClick={handleExportTrackerExcel}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
              title="Export this tracker with matching column arrangement, header formats and theme colors as Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK BANNER FOR COPY / EXPORT */}
        {exportFeedback && (
          <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-medium animate-in fade-in duration-150">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="flex-1">{exportFeedback}</span>
            <button
              onClick={() => setExportFeedback(null)}
              className="text-emerald-600 hover:text-emerald-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* DYNAMIC CASCADING FILTERS BAR */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          {/* 1. Dynamic User / Assignee Dropdown */}
          <div className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 border transition-all ${
            quickUser !== 'All'
              ? 'bg-rose-50/90 border-rose-300 text-rose-900 shadow-2xs font-semibold'
              : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
          }`}>
            <User className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="text-[11px] text-slate-500 font-medium">User:</span>
            <select
              value={quickUser}
              onChange={(e) => handleQuickUserChange(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer max-w-[170px] truncate text-xs"
            >
              <option value="All">All Users ({quickUserOptions.totalMatching})</option>
              {quickUserOptions.items.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.value} ({item.count})
                </option>
              ))}
            </select>
            {quickUser !== 'All' && (
              <button
                onClick={() => handleQuickUserChange('All')}
                className="text-rose-700 hover:text-rose-950 ml-0.5 p-0.5 rounded"
                title="Clear user filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 2. Dynamic Status Dropdown */}
          <div className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 border transition-all ${
            quickStatus !== 'All'
              ? 'bg-rose-50/90 border-rose-300 text-rose-900 shadow-2xs font-semibold'
              : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
          }`}>
            <span className="text-[11px] text-slate-500 font-medium">Status:</span>
            <select
              value={quickStatus}
              onChange={(e) => {
                setQuickStatus(e.target.value);
                setPage(1);
              }}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer max-w-[155px] truncate text-xs"
            >
              <option value="All">All Statuses ({quickStatusOptions.totalMatching})</option>
              {quickStatusOptions.items.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.value} ({item.count})
                </option>
              ))}
            </select>
            {quickStatus !== 'All' && (
              <button
                onClick={() => {
                  setQuickStatus('All');
                  setPage(1);
                }}
                className="text-rose-700 hover:text-rose-950 ml-0.5 p-0.5 rounded"
                title="Clear status filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 3. Dynamic Month Dropdown */}
          <div className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 border transition-all ${
            quickMonth !== 'All'
              ? 'bg-rose-50/90 border-rose-300 text-rose-900 shadow-2xs font-semibold'
              : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
          }`}>
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-500 font-medium">Month:</span>
            <select
              value={quickMonth}
              onChange={(e) => {
                setQuickMonth(e.target.value);
                setPage(1);
              }}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer max-w-[130px] truncate text-xs"
            >
              <option value="All">All Months ({quickMonthOptions.totalMatching})</option>
              {quickMonthOptions.items.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.value} ({item.count})
                </option>
              ))}
            </select>
            {quickMonth !== 'All' && (
              <button
                onClick={() => {
                  setQuickMonth('All');
                  setPage(1);
                }}
                className="text-rose-700 hover:text-rose-950 ml-0.5 p-0.5 rounded"
                title="Clear month filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 4. Dynamic SLA Duration Dropdown */}
          <div className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 border transition-all ${
            quickSla !== 'All'
              ? 'bg-rose-50/90 border-rose-300 text-rose-900 shadow-2xs font-semibold'
              : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
          }`}>
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-500 font-medium">SLA:</span>
            <select
              value={quickSla}
              onChange={(e) => {
                setQuickSla(e.target.value);
                setPage(1);
              }}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer max-w-[155px] truncate text-xs"
            >
              <option value="All">All SLA ({quickSlaOptions.totalMatching})</option>
              {quickSlaOptions.items.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.value === '90'
                    ? 'Within SLA ≤90d'
                    : item.value === 'More than 90'
                    ? 'Over SLA >90d'
                    : 'Pending / No SLA'}{' '}
                  ({item.count})
                </option>
              ))}
            </select>
            {quickSla !== 'All' && (
              <button
                onClick={() => {
                  setQuickSla('All');
                  setPage(1);
                }}
                className="text-rose-700 hover:text-rose-950 ml-0.5 p-0.5 rounded"
                title="Clear SLA filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 5. Dynamic Eligible Cases Only Toggle (135 Cases for 2026, 127 for Backlog) */}
          <button
            onClick={() => {
              setOnlyEligible(!onlyEligible);
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
              onlyEligible
                ? isBacklogTracker
                  ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                  : 'bg-red-600 text-white border-red-700 shadow-sm'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
            title={
              onlyEligible
                ? isBacklogTracker
                  ? "Showing only eligible Backlog cases (excluding Not Started & Cancelled). Click to show all cases."
                  : "Showing only eligible SLA cases. Click to show all cases (including Not Started & New)."
                : isBacklogTracker
                ? `Filter to only eligible Backlog cases (${totalEligibleCount} Cases, excluding Not Started & Cancelled)`
                : `Filter to only eligible SLA cases (${totalEligibleCount} Cases)`
            }
          >
            <Check className={`w-3.5 h-3.5 ${onlyEligible ? 'text-white' : 'text-slate-400'}`} />
            <span>{onlyEligible ? `Eligible Cases (${filteredStats.total})` : `Eligible Cases (${totalEligibleCount})`}</span>
          </button>

          {/* Global Search across all columns */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search across all columns..."
              className="w-full bg-white border border-slate-300 rounded-md pl-8 pr-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500 placeholder:text-slate-400 text-xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Reset All Filters Button */}
          {isAnyFilterActive && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 transition-colors shadow-2xs"
              title="Reset all dynamic and column filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>

        {/* DYNAMIC KPI SUMMARY & ACTIVE FILTER TAGS */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
          {/* Real-time KPI Breakdown for Currently Selected Filter */}
          {isExternalTracker ? (
            <div className="flex flex-wrap items-center gap-2 font-mono">
              <span className="font-sans font-bold text-slate-800">
                {filteredStats.total} External Tracker Records
              </span>
              <span className="text-slate-300">|</span>
              <span className="px-2.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-300 font-bold">
                2026: {filteredStats.cat2026}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 font-bold">
                Backlog: {filteredStats.catBacklog}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 font-medium">
                No Backlog: {filteredStats.catNoBacklog}
              </span>
              <span className="text-slate-300">|</span>
              <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold">
                Eligible 2026: {filteredStats.eligible2026}
              </span>
              {filteredStats.exceed2027 > 0 && (
                <span className="px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold" title="Ongoing 2026 cases with delivery window extending into 2027; excluded from 2026 unresolved penalty">
                  2027 Exceed Level: {filteredStats.exceed2027}
                </span>
              )}
              <span className="text-slate-300">|</span>
              <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold">
                No Dev SLA (≤90d): Within {filteredStats.noDevWithinSla} / Outside {filteredStats.noDevOutsideSla}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-300 font-semibold">
                With Dev SLA (≤180d): Within {filteredStats.withDevWithinSla} / Outside {filteredStats.withDevOutsideSla}
              </span>
            </div>
          ) : isOnTargetTracker ? (
            <div className="flex flex-wrap items-center gap-2 font-mono">
              <span className="font-sans font-bold text-slate-800">
                {filteredStats.total} On-Target Cases
              </span>
              <span className="text-slate-300">|</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                From Under Dev to Completed: {filteredStats.fromUnderDevToCompleted}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 font-semibold inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Pending to Completed: {filteredStats.pendingToCompleted}
              </span>
              <span className="text-slate-300">|</span>
              <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                Achieved: Yes ({filteredStats.achievedYes})
              </span>
              {filteredStats.achievedNo > 0 && (
                <span className="px-2.5 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 font-bold">
                  Achieved: No ({filteredStats.achievedNo})
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-medium">
                Pending ({filteredStats.achievedPending})
              </span>
              <span className="text-slate-300">|</span>
              <span className={`px-2.5 py-0.5 rounded font-bold border ${
                filteredStats.onTargetRate >= 80
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                On-Target Completion Rate: {filteredStats.onTargetRate}% (≥80% Target)
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 font-mono">
              <span className="font-sans font-bold text-slate-800">
                {filteredStats.total} {onlyEligible ? 'Eligible Cases' : 'Cases'}
              </span>
              <span className="text-slate-300">|</span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                Completed: {filteredStats.completed}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                For Monitoring: {filteredStats.monitoring}
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-semibold">
                Under Dev: {filteredStats.underDev}
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-semibold">
                In Progress: {filteredStats.inProgress}
              </span>
              {filteredStats.exceed2027 > 0 && (
                <span
                  className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 font-bold inline-flex items-center gap-1"
                  title="Cases whose 90d/180d SLA timeline exceeds 2026 into 2027 (excluded from 2026 unresolved count)"
                >
                  <span>2027 Exceed: {filteredStats.exceed2027}</span>
                  <span className="text-[10px] text-amber-700 font-normal hidden sm:inline">(Excl. from 2026 Unresolved)</span>
                </span>
              )}
              <span className="text-slate-300">|</span>
              <span className={`px-2 py-0.5 rounded font-bold border ${
                filteredStats.slaPct >= 80
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                SLA ≤90d: {filteredStats.withinSla} / {filteredStats.slaEvaluated} ({filteredStats.slaPct}%)
              </span>
              {filteredStats.notStarted > 0 && (
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  Not Started: {filteredStats.notStarted}
                </span>
              )}
              {filteredStats.newCases > 0 && (
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  New: {filteredStats.newCases}
                </span>
              )}
            </div>
          )}

          {/* Active Excel Column Filter Tags */}
          <div className="flex flex-wrap items-center gap-1.5 text-slate-500">
            {onlyEligible && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                isBacklogTracker
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-red-100 text-red-900 border border-red-300'
              }`}>
                <span>{isBacklogTracker ? 'Eligible Backlog Cases Only' : 'Eligible SLA Cases Only'} ({filteredStats.total})</span>
                <button
                  onClick={() => {
                    setOnlyEligible(false);
                    setPage(1);
                  }}
                  className={`font-bold ml-0.5 ${isBacklogTracker ? 'hover:text-amber-950' : 'hover:text-red-950'}`}
                  title="Remove eligible only filter to show all cases"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {Object.entries(activeColumnFilters).map(([cKey, allowedVals]) => {
              const colDef = displayedColumns.find((c) => c.key === cKey);
              const label = colDef?.label || cKey;
              return (
                <span
                  key={cKey}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-mono"
                >
                  <span className="font-semibold">{label}:</span>
                  <span className="truncate max-w-[120px]" title={allowedVals.join(', ')}>
                    {allowedVals.join(', ')}
                  </span>
                  <button
                    onClick={() => clearExcelFilter(cKey)}
                    className="hover:text-rose-950 font-bold ml-0.5"
                    title={`Clear ${label} filter`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Excel Spreadsheet Grid */}
      <div className="overflow-x-auto flex-1 relative min-h-[460px]">
        <table className="w-full text-xs text-left border-collapse border border-slate-200">
          <thead>
            {/* Top Column Category Super-Headers: Separated Completed Calculation vs In Progress Calculation */}
            <tr className="text-white text-[10px] uppercase font-semibold tracking-wider divide-x border-b border-slate-700">
              {isFocusMode && <th className="px-2 py-1.5 w-12 text-center bg-slate-900 border-slate-700">#</th>}
              
              {/* 1. Uploaded Sheet Raw Columns Header */}
              {visibleUploadedCols.length > 0 && (
                <th
                  colSpan={visibleUploadedCols.length}
                  className="px-3 py-1.5 bg-slate-800 text-slate-200 text-left font-medium border-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <span>📋 Uploaded Sheet Raw Columns ({visibleUploadedCols.length})</span>
                    <button
                      onClick={() => {
                        const next = new Set(hiddenColKeys);
                        uploadedCols.forEach((c) => next.add(c.key));
                        setHiddenColKeys(next);
                      }}
                      className="text-[10px] text-slate-400 hover:text-white underline font-normal normal-case"
                      title="Hide uploaded raw columns to focus on calculations"
                    >
                      Hide Raw Group
                    </button>
                  </div>
                </th>
              )}

              {/* 2. On-Target Super-Header */}
              {isOnTargetTracker && (visibleCompletedCols.length > 0 || visibleInProgressCols.length > 0) && (
                <th
                  colSpan={visibleCompletedCols.length + visibleInProgressCols.length}
                  className="px-3 py-1.5 bg-emerald-800 text-emerald-100 text-left font-semibold border-emerald-700"
                >
                  <div className="flex items-center justify-between">
                    <span>🎯 On-Target Methodology & Achieved Calculation ({visibleCompletedCols.length + visibleInProgressCols.length})</span>
                    <span className="text-[10px] text-emerald-200 font-normal normal-case hidden sm:inline">
                      Under Dev ➔ Completed & Committed Month Mapping
                    </span>
                  </div>
                </th>
              )}

              {/* 3. Backlog Super-Header */}
              {isBacklogTracker && visibleCompletedCols.length > 0 && (
                <th
                  colSpan={visibleCompletedCols.length}
                  className="px-3 py-1.5 bg-amber-800 text-amber-100 text-left font-semibold border-amber-700"
                >
                  <div className="flex items-center justify-between">
                    <span>📦 Backlog CCF Calculations (180d SLA) ({visibleCompletedCols.length})</span>
                    <span className="text-[10px] text-amber-200 font-normal normal-case hidden sm:inline">
                      Monitoring Month & 180 Days Target
                    </span>
                  </div>
                </th>
              )}

              {/* 4. External CCF Super-Header */}
              {isExternalTracker && visibleCompletedCols.length > 0 && (
                <th
                  colSpan={visibleCompletedCols.length}
                  className="px-3 py-1.5 bg-sky-800 text-sky-100 text-left font-semibold border-sky-700"
                >
                  <div className="flex items-center justify-between">
                    <span>🌐 External CCF Calculations & Vendor SLA ({visibleCompletedCols.length})</span>
                    <span className="text-[10px] text-sky-200 font-normal normal-case hidden sm:inline">
                      No Dev (≤90d) & With Dev (≤180d)
                    </span>
                  </div>
                </th>
              )}

              {/* 5. 2026 Completed Calculation Header */}
              {!isOnTargetTracker && !isBacklogTracker && !isExternalTracker && visibleCompletedCols.length > 0 && (
                <th
                  colSpan={visibleCompletedCols.length}
                  className="px-3 py-1.5 bg-red-800 text-red-100 text-left font-semibold border-red-700"
                >
                  <div className="flex items-center justify-between">
                    <span>✅ Part 1: Completed Calculation (≤90d SLA) ({visibleCompletedCols.length})</span>
                    <span className="text-[10px] text-red-300 font-normal normal-case hidden sm:inline">
                      Monitoring & Completed SLA
                    </span>
                  </div>
                </th>
              )}

              {/* 6. 2026 In Progress Calculation Header */}
              {!isOnTargetTracker && !isBacklogTracker && !isExternalTracker && visibleInProgressCols.length > 0 && (
                <th
                  colSpan={visibleInProgressCols.length}
                  className="px-3 py-1.5 bg-indigo-900 text-indigo-100 text-left font-semibold border-indigo-800"
                >
                  <div className="flex items-center justify-between">
                    <span>⏳ Part 2: In Progress Calculation (EOM / SLA) ({visibleInProgressCols.length})</span>
                    <span className="text-[10px] text-indigo-300 font-normal normal-case hidden sm:inline">
                      Committed Month to End
                    </span>
                  </div>
                </th>
              )}
            </tr>

            {/* Individual Column Headers with Excel Filter Funnel & Hide Option */}
            <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300 divide-x divide-slate-200 sticky top-0 z-20 shadow-xs">
              {isFocusMode && (
                <th className="px-2 py-2 text-center text-slate-400 font-mono text-[10px] bg-slate-200">
                  Row
                </th>
              )}

              {displayedColumns.map((col) => {
                const isFiltered = activeColumnFilters[col.key] !== undefined;
                const isSorted = sortCol === col.key;
                const isCompletedCol = col.group === 'completed';
                const isInProgressCol = col.group === 'in_progress';

                let headerBg = 'bg-slate-100 text-slate-800 border-slate-200';
                let badgeText = '';
                let badgeClass = '';

                if (isExternalTracker && isCompletedCol) {
                  headerBg = 'bg-sky-50/90 text-sky-950 border-sky-200';
                  badgeText = 'EXTERNAL';
                  badgeClass = 'bg-sky-100 text-sky-800 border-sky-200';
                } else if (isOnTargetTracker && (isCompletedCol || isInProgressCol)) {
                  headerBg = 'bg-emerald-50/90 text-emerald-950 border-emerald-200';
                  badgeText = 'ON-TARGET';
                  badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                } else if (isBacklogTracker && isCompletedCol) {
                  headerBg = 'bg-amber-50/90 text-amber-950 border-amber-200';
                  badgeText = 'BACKLOG SLA';
                  badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
                } else if (isCompletedCol) {
                  headerBg = 'bg-red-50/90 text-red-950 border-red-200';
                  badgeText = 'COMPLETED';
                  badgeClass = 'bg-red-100 text-red-800 border-red-200';
                } else if (isInProgressCol) {
                  headerBg = 'bg-indigo-50/90 text-indigo-950 border-indigo-200';
                  badgeText = 'IN PROGRESS';
                  badgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
                }

                const isDateCol = isDateOrMonthField(col.key, col.label);

                return (
                  <th
                    key={col.key}
                    className={`px-3 py-2 whitespace-nowrap select-none group relative ${headerBg}`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      {/* Sortable Header Name & Category Badge */}
                      <div
                        onClick={() => {
                          if (sortCol === col.key) {
                            setSortAsc(!sortAsc);
                          } else {
                            setSortCol(col.key);
                            setSortAsc(true);
                          }
                        }}
                        className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 flex-1 truncate"
                        title={isDateCol ? `Click to sort chronologically by ${col.label}` : `Click to sort by ${col.label}`}
                      >
                        {badgeText && (
                          <span className={`text-[9px] px-1 py-0.5 rounded font-bold border shrink-0 ${badgeClass}`}>
                            {badgeText}
                          </span>
                        )}
                        {isDateCol && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/90 shadow-2xs shrink-0"
                            title="Native Excel Date cell (<c t='d'>) with chronological sorting & filtering"
                          >
                            <Calendar className="w-2.5 h-2.5 text-rose-600" />
                            <span>Date</span>
                          </span>
                        )}
                        <span className="truncate">{col.label}</span>
                        {isSorted ? (
                          sortAsc ? (
                            <ArrowUp className="w-3 h-3 text-rose-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-rose-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Quick Hide Column Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            hideColumn(col.key);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-200/70 transition-colors opacity-0 group-hover:opacity-100"
                          title={`Hide column "${col.label}"`}
                        >
                          <EyeOff className="w-3 h-3" />
                        </button>

                        {/* EXCEL FILTER ICON BUTTON */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenFilter(col.key);
                          }}
                          className={`p-1 rounded transition-colors ${
                            isFiltered
                              ? 'bg-rose-600 text-white hover:bg-rose-700'
                              : 'text-slate-400 hover:text-slate-800 hover:bg-slate-200'
                          }`}
                          title={`Excel Filter: ${col.label}`}
                        >
                          <Filter className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* EXCEL FILTER POPUP POPOVER */}
                    {openFilterCol === col.key && (
                      <div
                        ref={filterPopupRef}
                        className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-300 p-3 z-50 text-slate-800 font-normal normal-case space-y-2.5 animate-in fade-in zoom-in-95 duration-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="font-semibold text-xs text-slate-800 truncate max-w-[170px]">
                            Filter: {col.label}
                          </span>
                          <button
                            onClick={() => setOpenFilterCol(null)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Sort Options */}
                        <div className="space-y-1 text-xs">
                          {isDateCol ? (
                            <>
                              <button
                                onClick={() => {
                                  setSortCol(col.key);
                                  setSortAsc(true);
                                  setOpenFilterCol(null);
                                }}
                                className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 flex items-center justify-between text-xs text-slate-700 font-medium transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <ArrowUp className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Sort Oldest to Newest (Chronological)</span>
                                </div>
                              </button>
                              <button
                                onClick={() => {
                                  setSortCol(col.key);
                                  setSortAsc(false);
                                  setOpenFilterCol(null);
                                }}
                                className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 flex items-center justify-between text-xs text-slate-700 font-medium transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <ArrowDown className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Sort Newest to Oldest (Chronological)</span>
                                </div>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setSortCol(col.key);
                                  setSortAsc(true);
                                  setOpenFilterCol(null);
                                }}
                                className="w-full text-left px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-2"
                              >
                                <ArrowUp className="w-3.5 h-3.5 text-slate-500" />
                                <span>Sort A to Z (Ascending)</span>
                              </button>
                              <button
                                onClick={() => {
                                  setSortCol(col.key);
                                  setSortAsc(false);
                                  setOpenFilterCol(null);
                                }}
                                className="w-full text-left px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-2"
                              >
                                <ArrowDown className="w-3.5 h-3.5 text-slate-500" />
                                <span>Sort Z to A (Descending)</span>
                              </button>
                            </>
                          )}
                        </div>

                        {/* Quick Date Presets */}
                        {isDateCol && (
                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                              Quick Date Presets:
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const allUnique = getUniqueColumnValues(col.key);
                                  const matches = allUnique
                                    .filter((u) => {
                                      const yr = extractYearFromValue(u.value);
                                      return yr === 2026;
                                    })
                                    .map((u) => u.value);
                                  setTempSelectedValues(matches);
                                }}
                                className="px-2 py-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                                title="Select only 2026 dates in filter checklist"
                              >
                                <span>2026 Only</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const allUnique = getUniqueColumnValues(col.key);
                                  const matches = allUnique
                                    .filter((u) => {
                                      const yr = extractYearFromValue(u.value);
                                      return yr !== null && yr < 2026;
                                    })
                                    .map((u) => u.value);
                                  setTempSelectedValues(matches);
                                }}
                                className="px-2 py-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                                title="Select only Backlog (< 2026) dates in filter checklist"
                              >
                                <span>Backlog (&lt; 2026)</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Value Search */}
                        <div className="relative">
                          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={filterSearchQuery}
                            onChange={(e) => setFilterSearchQuery(e.target.value)}
                            placeholder="Search values..."
                            className="w-full bg-slate-50 border border-slate-200 rounded pl-7 pr-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
                          />
                        </div>

                        {/* Select All / Deselect All */}
                        {(() => {
                          const allUnique = getUniqueColumnValues(col.key);
                          const filteredUnique = allUnique.filter((u) =>
                            u.value.toLowerCase().includes(filterSearchQuery.toLowerCase())
                          );
                          const isAllSelected = filteredUnique.every((u) => tempSelectedValues.includes(u.value));

                          return (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={() => {
                                      if (isAllSelected) {
                                        setTempSelectedValues([]);
                                      } else {
                                        setTempSelectedValues(allUnique.map((u) => u.value));
                                      }
                                    }}
                                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                  />
                                  <span>(Select All)</span>
                                </label>
                                <span>{filteredUnique.length} distinct</span>
                              </div>

                              {/* Values List */}
                              <div className="max-h-36 overflow-y-auto space-y-1 border border-slate-100 rounded p-1 bg-slate-50/50">
                                {filteredUnique.map((u) => {
                                  const isChecked = tempSelectedValues.includes(u.value);
                                  return (
                                    <label
                                      key={u.value}
                                      className="flex items-center justify-between px-1.5 py-0.5 rounded hover:bg-slate-100 text-xs cursor-pointer"
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            if (isChecked) {
                                              setTempSelectedValues(
                                                tempSelectedValues.filter((v) => v !== u.value)
                                              );
                                            } else {
                                              setTempSelectedValues([...tempSelectedValues, u.value]);
                                            }
                                          }}
                                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                        />
                                        <span className="truncate" title={u.value}>
                                          {u.value}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {u.count}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <button
                            onClick={() => clearExcelFilter(col.key)}
                            className="text-xs text-slate-500 hover:text-slate-800"
                          >
                            Clear
                          </button>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setOpenFilterCol(null)}
                              className="px-2.5 py-1 text-xs border border-slate-200 rounded text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => applyExcelFilter(col.key)}
                              className="px-3 py-1 text-xs bg-rose-700 text-white rounded font-medium hover:bg-rose-800"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </th>
                );
              })}

              {/* Proof header removed as requested ("and remobve this No needed") */}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 font-normal">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={displayedColumns.length + (isFocusMode ? 1 : 0)} className="py-16 text-center text-slate-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700">No records match the current Excel column filters</p>
                  <p className="text-xs text-slate-400 mt-1">Try clearing active column filters or search terms.</p>
                  <button
                    onClick={clearAllFilters}
                    className="mt-3 inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear All Filters</span>
                  </button>
                </td>
              </tr>
            ) : (
              paginatedRows.map((r, rowIdx) => {
                const isWithin90 = r.slaDuration === '90';
                const isOver90 = r.slaDuration === 'More than 90';
                const isProgressWithin90 = r.slaProgressStatus === 'Within 90';
                const isProgressOver90 = r.slaProgressStatus === 'Beyond 90';

                return (
                  <tr
                    key={r.issueKey || `row-${rowIdx}`}
                    className="hover:bg-slate-50/90 transition-colors divide-x divide-slate-100"
                  >
                    {/* Row Index Number for Focus Mode */}
                    {isFocusMode && (
                      <td className="px-2 py-1.5 text-center font-mono text-[11px] text-slate-400 bg-slate-50/60 select-none">
                        {(page - 1) * effectivePageSize + rowIdx + 1}
                      </td>
                    )}

                    {/* Columns */}
                    {displayedColumns.map((col) => {
                      const val = getColValue(r, col.key);
                      const isCompletedCol = col.group === 'completed';
                      const isInProgressCol = col.group === 'in_progress';

                      // Clickable Issue Key to view verification & breakdown without cluttering table with Proof column
                      if (col.key === 'issueKey') {
                        return (
                          <td
                            key={col.key}
                            className="px-3 py-1.5 whitespace-nowrap font-mono font-bold text-slate-900"
                          >
                            <button
                              onClick={() => setSelectedRow(r)}
                              className="text-slate-900 hover:text-blue-700 hover:underline flex items-center gap-1.5 font-mono font-bold text-left"
                              title="Click to view details & formula equation breakdown"
                            >
                              <span>{val}</span>
                            </button>
                          </td>
                        );
                      }

                      // PART 1: Completed Calculation Specialized Cell Styling
                      if (col.key === 'slaDuration') {
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono font-bold bg-red-50/20 whitespace-nowrap">
                            {isWithin90 && <span className="text-red-700">90</span>}
                            {isOver90 && <span className="text-rose-700">More than 90</span>}
                            {!isWithin90 && !isOver90 && <span className="text-slate-400">{val}</span>}
                          </td>
                        );
                      }

                      if (col.key === 'slaDays') {
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-right font-mono bg-red-50/20 whitespace-nowrap">
                            {r.slaDays !== null ? (
                              <span className="font-semibold text-red-950">{r.slaDays} d</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        );
                      }

                      if (col.key === 'createdMonthCompleted' || col.key === 'monthCompleted') {
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono bg-red-50/20 whitespace-nowrap">
                            {val !== '-' ? (
                              <span className="font-semibold text-red-900 bg-red-50 px-2 py-0.5 rounded border border-red-200 text-xs">
                                {val}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        );
                      }

                      if (col.key === 'createdMonth') {
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono bg-red-50/10 whitespace-nowrap">
                            <span className="font-medium text-slate-800">{val}</span>
                          </td>
                        );
                      }

                      if (col.key === 'caseHorizon2026') {
                        const isEligible = val === 'Eligible 2026';
                        const isExceed = val === '2027 Exceed Level';
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono whitespace-nowrap bg-red-50/10">
                            {isEligible && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                Eligible 2026
                              </span>
                            )}
                            {isExceed && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
                                title="SLA timeline extends into 2027; excluded from 2026 unresolved count"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                2027 Exceed Level
                              </span>
                            )}
                            {!isEligible && !isExceed && (
                              <span className="text-slate-400 font-mono">-</span>
                            )}
                          </td>
                        );
                      }

                      // PART 2: In Progress Calculation Specialized Cell Styling
                      if (col.key === 'slaProgressStatus') {
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono bg-indigo-50/20 whitespace-nowrap">
                            {isProgressWithin90 && <span className="text-red-700 font-semibold">Within 90</span>}
                            {isProgressOver90 && <span className="text-rose-700 font-semibold">Beyond 90</span>}
                            {!isProgressWithin90 && !isProgressOver90 && <span className="text-slate-400">{val}</span>}
                          </td>
                        );
                      }

                      if (col.key === 'slaDaysInProgress') {
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-right font-mono bg-indigo-50/20 whitespace-nowrap">
                            {r.slaDaysInProgress !== null ? (
                              <span className="font-semibold text-indigo-950">{r.slaDaysInProgress} d</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        );
                      }

                      if (col.key === 'committedMonth' || col.key === 'committedEndDateValue') {
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono bg-indigo-50/20 whitespace-nowrap">
                            <span className="text-slate-800 font-medium">{val}</span>
                          </td>
                        );
                      }

                      if (col.key === 'committedMonthProgress') {
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono bg-indigo-50/20 whitespace-nowrap">
                            {val !== '-' ? (
                              <span className="font-semibold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs">
                                {val}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        );
                      }

                      // Backlog Tracker Columns Styling
                      if (col.key === 'monitoringMonth') {
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono bg-red-50/20 whitespace-nowrap">
                            {val !== '-' ? (
                              <span className="font-semibold text-red-900 bg-red-50 px-2 py-0.5 rounded border border-red-200 text-xs">
                                {val}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        );
                      }

                      if (col.key === 'slaBacklogDays') {
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-right font-mono bg-red-50/20 whitespace-nowrap">
                            {r.slaBacklogDays !== null && r.slaBacklogDays !== undefined ? (
                              <span className="font-semibold text-red-950 font-mono">{r.slaBacklogDays} d</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        );
                      }

                      if (col.key === 'slaBacklogDuration') {
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono font-bold bg-red-50/20 whitespace-nowrap">
                            {val === '180' && (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs font-bold">
                                180
                              </span>
                            )}
                            {val === 'Above 180' && (
                              <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs font-bold">
                                Above 180
                              </span>
                            )}
                            {val !== '180' && val !== 'Above 180' && (
                              <span className="text-slate-400">{val}</span>
                            )}
                          </td>
                        );
                      }

                      // On-Target Methodology Columns Cell Styling
                      if (col.key === 'onTargetStatus') {
                        const isFromUnderDev = val === 'From Under Dev to Completed';
                        const isPending = val === 'Pending to Completed';
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono whitespace-nowrap bg-emerald-50/15">
                            {isFromUnderDev && (
                              <span className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300 text-[11px] font-bold shadow-2xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                                From Under Dev to Completed
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-300 text-[11px] font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Pending to Completed
                              </span>
                            )}
                            {!isFromUnderDev && !isPending && (
                              <span className="text-slate-400">{val || '-'}</span>
                            )}
                          </td>
                        );
                      }

                      if (col.key === 'achieved') {
                        const isYes = val === 'Yes';
                        const isNo = val === 'No';
                        const isPending = val === 'Pending';
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono whitespace-nowrap bg-emerald-50/15">
                            {isYes && (
                              <span className="inline-flex items-center justify-center min-w-[56px] text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-400 font-bold text-xs shadow-2xs">
                                Yes
                              </span>
                            )}
                            {isNo && (
                              <span className="inline-flex items-center justify-center min-w-[56px] text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-md border border-rose-400 font-bold text-xs shadow-2xs">
                                No
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center justify-center min-w-[56px] text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-300 font-medium text-xs">
                                Pending
                              </span>
                            )}
                            {!isYes && !isNo && !isPending && (
                              <span className="text-slate-400">{val || '-'}</span>
                            )}
                          </td>
                        );
                      }

                      if (col.key === 'resolvedMonth') {
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono whitespace-nowrap bg-emerald-50/15">
                            {val !== '-' && val ? (
                              <span className="font-semibold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                                {val}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        );
                      }

                      // External Tracker Columns Specialized Cell Styling
                      if (col.key === 'externalTrackerStatus') {
                        const is2026 = val === '2026';
                        const isBacklog = val === 'Backlog';
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono whitespace-nowrap bg-sky-50/20">
                            {is2026 && (
                              <span className="inline-flex items-center gap-1 text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded-full border border-sky-300 font-bold text-xs">
                                2026
                              </span>
                            )}
                            {isBacklog && (
                              <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 font-bold text-xs">
                                Backlog
                              </span>
                            )}
                            {!is2026 && !isBacklog && (
                              <span className="text-slate-400">{val || '-'}</span>
                            )}
                          </td>
                        );
                      }

                      if (col.key === 'month2026') {
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono whitespace-nowrap bg-sky-50/20">
                            {val !== '-' && val ? (
                              <span className="font-semibold text-sky-900 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 text-xs">
                                {val}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        );
                      }

                      if (col.key === 'normalizedDevRequired') {
                        const isYes = val === 'Yes';
                        const isNo = val === 'No';
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono whitespace-nowrap bg-sky-50/20">
                            {isYes && (
                              <span className="text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-semibold text-xs">
                                Yes
                              </span>
                            )}
                            {isNo && (
                              <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-semibold text-xs">
                                No
                              </span>
                            )}
                            {!isYes && !isNo && <span className="text-slate-400">-</span>}
                          </td>
                        );
                      }

                      if (col.key === 'externalSlaCountDays') {
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-right font-mono bg-sky-50/20 whitespace-nowrap">
                            {r.externalSlaCountDays !== null && r.externalSlaCountDays !== undefined ? (
                              <span className="font-semibold text-sky-950 font-mono">{r.externalSlaCountDays} d</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        );
                      }

                      if (col.key === 'noDevSla' || col.key === 'withDevSla') {
                        const isWithin = val === 'Within SLA';
                        const isOutside = val === 'Outside SLA';
                        return (
                          <td key={col.key} className="px-3 py-1.5 text-center font-mono whitespace-nowrap bg-sky-50/20">
                            {isWithin && (
                              <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 font-bold text-xs">
                                Within SLA
                              </span>
                            )}
                            {isOutside && (
                              <span className="text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-300 font-bold text-xs">
                                Outside SLA
                              </span>
                            )}
                            {!isWithin && !isOutside && (
                              <span className="text-slate-400">{val || '-'}</span>
                            )}
                          </td>
                        );
                      }

                      return (
                        <td
                          key={col.key}
                          className={`px-3 py-1.5 truncate max-w-xs ${
                            isCompletedCol
                              ? 'bg-red-50/10 font-mono'
                              : isInProgressCol
                              ? 'bg-indigo-50/10 font-mono'
                              : 'text-slate-700'
                          }`}
                          title={val}
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Excel Status Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={effectivePageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-700 text-xs font-mono"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
          <span className="font-mono text-slate-600">
            Showing {(page - 1) * effectivePageSize + 1}–{Math.min(page * effectivePageSize, sortedRows.length)} of{' '}
            {sortedRows.length} filtered ({rows.length} total)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isFocusMode && (
            <span className="text-[11px] font-mono text-red-800 bg-red-50 px-2 py-0.5 rounded border border-red-200">
              Excel Focus Mode Active · Press Esc to exit
            </span>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Previous
            </button>
            <span className="font-mono px-2">
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Hide / Show Columns Manager Modal */}
      {showColumnChooser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-slate-600" />
                  <span>Hide / Show Columns Manager</span>
                  <span className="text-xs font-mono font-normal text-slate-500">
                    ({displayedColumns.length} visible / {allAvailableCols.length} total)
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose which columns to show or hide to focus on the calculations you need.
                </p>
              </div>
              <button
                onClick={() => setShowColumnChooser(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Focus Preset Buttons */}
            <div className="p-3 bg-slate-50 border-b border-slate-100 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Quick Focus Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={focusCompletedOnly}
                  className="px-2.5 py-1 text-xs rounded bg-red-100 hover:bg-red-200 text-red-900 font-semibold transition-colors border border-red-200 shadow-2xs"
                >
                  🎯 Focus: Completed Only ({completedCols.length} cols)
                </button>
                <button
                  onClick={focusInProgressOnly}
                  className="px-2.5 py-1 text-xs rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-semibold transition-colors border border-indigo-200 shadow-2xs"
                >
                  ⏳ Focus: In Progress Only ({inProgressCols.length} cols)
                </button>
                <button
                  onClick={focusAllCalculations}
                  className="px-2.5 py-1 text-xs rounded bg-purple-100 hover:bg-purple-200 text-purple-900 font-semibold transition-colors border border-purple-200 shadow-2xs"
                >
                  ⚡ Focus: All Calculations (Hide Raw)
                </button>
                <button
                  onClick={focusUploadedOnly}
                  className="px-2.5 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium transition-colors"
                >
                  📋 Focus: Uploaded Raw Only
                </button>
                <button
                  onClick={unhideAllColumns}
                  className="px-2.5 py-1 text-xs rounded bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-300 transition-colors shadow-2xs"
                >
                  👁️ Show All Columns
                </button>
              </div>
            </div>

            {/* Search Input for Columns */}
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={colChooserSearch}
                  onChange={(e) => setColChooserSearch(e.target.value)}
                  placeholder="Filter columns by name..."
                  className="w-full bg-slate-50 border border-slate-200 rounded pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Categorized Column Checklists */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Category 1: Completed Calculations */}
              <div className="rounded-lg border border-red-200 bg-red-50/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-red-950 flex items-center gap-1.5">
                    <span>✅ Part 1: Completed Calculation Columns</span>
                    <span className="text-[10px] text-red-700 font-mono">({completedCols.length})</span>
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      onClick={() => {
                        const next = new Set(hiddenColKeys);
                        completedCols.forEach((c) => next.delete(c.key));
                        setHiddenColKeys(next);
                      }}
                      className="text-red-800 hover:underline font-medium"
                    >
                      Show All
                    </button>
                    <span className="text-red-300">·</span>
                    <button
                      onClick={() => {
                        const next = new Set(hiddenColKeys);
                        completedCols.forEach((c) => next.add(c.key));
                        setHiddenColKeys(next);
                      }}
                      className="text-red-800 hover:underline font-medium"
                    >
                      Hide All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  {completedCols
                    .filter((c) => c.label.toLowerCase().includes(colChooserSearch.toLowerCase()))
                    .map((col) => {
                      const isHidden = hiddenColKeys.has(col.key);
                      return (
                        <label
                          key={col.key}
                          className={`flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer transition-colors ${
                            isHidden ? 'bg-white/60 text-slate-400' : 'bg-white text-red-950 font-medium shadow-2xs'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!isHidden}
                            onChange={() => toggleColumnHide(col.key)}
                            className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                          />
                          <span className="truncate">{col.label}</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Category 2: In Progress Calculations */}
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-indigo-950 flex items-center gap-1.5">
                    <span>⏳ Part 2: In Progress Calculation Columns</span>
                    <span className="text-[10px] text-indigo-700 font-mono">({inProgressCols.length})</span>
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      onClick={() => {
                        const next = new Set(hiddenColKeys);
                        inProgressCols.forEach((c) => next.delete(c.key));
                        setHiddenColKeys(next);
                      }}
                      className="text-indigo-800 hover:underline font-medium"
                    >
                      Show All
                    </button>
                    <span className="text-indigo-300">·</span>
                    <button
                      onClick={() => {
                        const next = new Set(hiddenColKeys);
                        inProgressCols.forEach((c) => next.add(c.key));
                        setHiddenColKeys(next);
                      }}
                      className="text-indigo-800 hover:underline font-medium"
                    >
                      Hide All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  {inProgressCols
                    .filter((c) => c.label.toLowerCase().includes(colChooserSearch.toLowerCase()))
                    .map((col) => {
                      const isHidden = hiddenColKeys.has(col.key);
                      return (
                        <label
                          key={col.key}
                          className={`flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer transition-colors ${
                            isHidden ? 'bg-white/60 text-slate-400' : 'bg-white text-indigo-950 font-medium shadow-2xs'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!isHidden}
                            onChange={() => toggleColumnHide(col.key)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="truncate">{col.label}</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Category 3: Uploaded Raw Sheet Columns */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                    <span>📋 Uploaded Sheet Raw Columns</span>
                    <span className="text-[10px] text-slate-500 font-mono">({uploadedCols.length})</span>
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      onClick={() => {
                        const next = new Set(hiddenColKeys);
                        uploadedCols.forEach((c) => next.delete(c.key));
                        setHiddenColKeys(next);
                      }}
                      className="text-slate-700 hover:underline font-medium"
                    >
                      Show All
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      onClick={() => {
                        const next = new Set(hiddenColKeys);
                        uploadedCols.forEach((c) => next.add(c.key));
                        setHiddenColKeys(next);
                      }}
                      className="text-slate-700 hover:underline font-medium"
                    >
                      Hide All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  {uploadedCols
                    .filter((c) => c.label.toLowerCase().includes(colChooserSearch.toLowerCase()))
                    .map((col) => {
                      const isHidden = hiddenColKeys.has(col.key);
                      return (
                        <label
                          key={col.key}
                          className={`flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer transition-colors ${
                            isHidden ? 'bg-white/50 text-slate-400' : 'bg-white text-slate-800 font-normal shadow-2xs'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!isHidden}
                            onChange={() => toggleColumnHide(col.key)}
                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                          />
                          <span className="truncate">{col.label}</span>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                onClick={unhideAllColumns}
                className="text-slate-600 hover:text-slate-900 underline font-medium"
              >
                Reset All Columns to Visible
              </button>
              <button
                onClick={() => setShowColumnChooser(false)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded font-medium hover:bg-slate-800 transition-colors shadow-2xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row Detail Drawer / Proof Modal */}
      {selectedRow && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <span>{selectedRow.issueKey}</span>
                  <span className="text-xs font-mono font-normal text-slate-500">
                    ({selectedRow.isNewCase ? 'New Case 2026' : 'Backlog Case'})
                  </span>
                </h3>
                <p className="text-xs text-slate-500 truncate max-w-md mt-0.5">{selectedRow.summary}</p>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded bg-slate-50 border border-slate-100 space-y-1.5">
                <div className="font-medium text-slate-700">Uploaded Sheet Input Values & Month Translations</div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 font-mono text-[11px]">
                  <div>Created: <strong className="text-slate-800">{formatDateTime12h(selectedRow.created, true)}</strong></div>
                  <div>Status: <strong className="text-slate-800">{selectedRow.status}</strong></div>
                  <div>Assignee: <strong className="text-slate-800">{selectedRow.assignee}</strong></div>
                  <div>Monitoring Start: <strong className="text-slate-800">{selectedRow.monitoringStartDate ? formatDateTime12h(selectedRow.monitoringStartDate, false) : '-'}</strong></div>
                  <div className="col-span-2 pt-1 border-t border-slate-200 grid grid-cols-3 gap-2">
                    <div>1. Created Month: <strong className="text-rose-800">{selectedRow.createdMonth}</strong></div>
                    <div>2. Created M (Completed): <strong className="text-rose-800">{selectedRow.createdMonthCompleted}</strong></div>
                    <div>3. Month Completed: <strong className="text-rose-800">{selectedRow.monthCompleted}</strong></div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded bg-rose-50/60 border border-rose-100 space-y-1.5">
                <div className="font-medium text-rose-900">SLA Duration Evaluation</div>
                <div className="text-slate-600">
                  Equation: <code className="bg-white px-1 py-0.5 rounded border border-rose-200 font-mono text-[11px]">=IF(AA2&lt;=&quot;90&quot;,&quot;90&quot;,&quot;More than 90&quot;)</code>
                </div>
                <div className="flex items-center justify-between text-slate-700 pt-1">
                  <span>SLA Days: <strong className="font-mono">{selectedRow.slaDays ?? 'N/A'} days</strong></span>
                  <span>Evaluated Result: <strong className="font-mono text-rose-800">{selectedRow.slaDuration}</strong></span>
                </div>
              </div>

              <div className="p-3 rounded bg-amber-50/60 border border-amber-100 space-y-1.5">
                <div className="font-medium text-amber-900">In Progress Committed End Date (EOM)</div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 font-mono text-[11px]">
                  <div>Raw Committed End: <strong className="text-slate-800">{selectedRow.committedEndDate || 'N/A'}</strong></div>
                  <div>Committed Month: <strong className="text-slate-800">{selectedRow.committedMonth}</strong></div>
                  <div>Calculated EOM Date: <strong className="text-slate-800">{selectedRow.committedEndDateValue}</strong></div>
                  <div>SLA in Progress: <strong className="text-slate-800">{selectedRow.slaDaysInProgress ?? 'N/A'} days</strong></div>
                  <div>Committed Month (Prog): <strong className="text-amber-800">{selectedRow.committedMonthProgress}</strong></div>
                </div>
                <div className="pt-1 text-slate-700 font-mono">
                  Progress SLA Status: <strong className="text-amber-900">{selectedRow.slaProgressStatus}</strong>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedRow(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded text-xs hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
