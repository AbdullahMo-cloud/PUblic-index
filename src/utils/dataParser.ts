import * as XLSX from 'xlsx';
import {
  RawCcfRow,
  TranslatedCcfRow,
  OwnerIndexSummary,
  CcfAggregateStats,
  ExternalKpiStats,
  ExternalMonthlyCfiRow,
  ExternalOwnerCfiSummary,
  ExternalHodCfiSummary,
} from '../types/ccf';
import { UserAllocation, DEFAULT_USER_ALLOCATIONS } from '../types/allocation';
import {
  parseDateFlexible,
  extractYearFromValue,
  formatMonthYY,
  formatDdMmmYyyy,
  getEndOfMonthDate,
  normalizeCommittedMonth,
  calculateDaysDifference,
  formatDateTime12h,
  extractCellDate,
} from './dateAndFormulaUtils';

/**
 * Normalizes any status string by stripping invisible characters, extra whitespace,
 * and converting to clean lowercase for exact evaluation.
 */
export function normalizeStatus(status: unknown): string {
  if (status === null || status === undefined) return '';
  return String(status)
    .replace(/[\uFEFF\xA0\r\n\t]+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Checks if status is eligible for the Completed Month columns:
 * 1. "For Monitoring"
 * 2. "Completed"
 * 3. "Under Development"
 */
export function isStatusCompletedEligible(status: unknown): boolean {
  const s = normalizeStatus(status);
  if (!s) return false;
  return (
    s === 'for monitoring' ||
    s === 'completed' ||
    s === 'under development' ||
    s === 'monitoring' ||
    s === 'complete' ||
    s === 'in development' ||
    s === 'under dev' ||
    s === 'for-monitoring' ||
    s === 'under-development' ||
    s.includes('monitoring') ||
    s.includes('completed') ||
    s.includes('under development') ||
    s.includes('in development')
  );
}

/**
 * Checks if status is eligible for SLA (Monitoring Start Date - Created Date):
 * Status must be "Completed", "For Monitoring", or "Under Development"
 */
export function isStatusSlaEligible(status: unknown): boolean {
  const s = normalizeStatus(status);
  if (!s) return false;
  return (
    s === 'for monitoring' ||
    s === 'completed' ||
    s === 'under development' ||
    s === 'monitoring' ||
    s === 'complete' ||
    s === 'in development' ||
    s === 'under dev' ||
    s === 'for-monitoring' ||
    s === 'under-development' ||
    (s.includes('monitoring') && !s.includes('not')) ||
    (s.includes('completed') && !s.includes('not')) ||
    (s.includes('under development') && !s.includes('not'))
  );
}

/**
 * Checks if status is "In Progress"
 */
export function isStatusInProgress(status: unknown): boolean {
  const s = normalizeStatus(status);
  if (!s) return false;
  return s === 'in progress' || s === 'in-progress' || s.includes('in progress');
}

/**
 * Evaluates whether a case has its monitoring start date / month in 2026
 */
export function isMonitoringIn2026(row: TranslatedCcfRow | RawCcfRow): boolean {
  const dates = [
    row.monitoringStartDate,
    row.monthCompleted,
    row.monitoringMonth,
    (row as any)['Monitoring Start Date'],
    (row as any)['Custom field (Monitoring Start Date)'],
    (row as any)['Target Monitoring Date'],
  ];
  return dates.some((d) => {
    if (!d) return false;
    const s = String(d).trim().toLowerCase();
    return s.includes('2026') || s.includes('-26') || s.endsWith('/26') || s.includes('/2026');
  });
}

/**
 * Evaluates whether a case meets the general Backlog concept criteria (created < 2026,
 * and if status is "Under Development", only included if monitoring in 2026).
 */
export function isBacklogConceptCase(row: TranslatedCcfRow | RawCcfRow): boolean {
  const trans = row as Partial<TranslatedCcfRow>;
  if (trans.isNewCase || !trans.createdYear || Number(trans.createdYear) >= 2026) {
    return false;
  }
  const s = normalizeStatus(row.status);
  if (s === 'under development' || s.includes('under dev')) {
    return isMonitoringIn2026(row);
  }
  return true;
}

/**
 * Filter helper for Backlog cases in the Internal Backlog CCF Tracker:
 * Created before 2026, internal, and if status is "Under Development", only included if monitoring in 2026
 */
export function isBacklogCase(row: TranslatedCcfRow | RawCcfRow): boolean {
  const trans = row as Partial<TranslatedCcfRow>;
  if (trans.ccfType === 'External') {
    return false;
  }
  return isBacklogConceptCase(row);
}

/**
 * Evaluates whether a case qualifies for On-Target tracking:
 * - N9: Number of cases transferred from Under Development to Completed.
 * - O9: Those cases completed on or before the committed target date, marked Y.
 */
export function evaluateOnTargetCompletion(row: TranslatedCcfRow | RawCcfRow): {
  isUnderDevToCompleted: boolean;
  isOnTime: boolean;
} {
  const key = String(row.issueKey || '').trim().toUpperCase();
  const trans = row as Partial<TranslatedCcfRow>;

  // 1. Explicit user rule: CCF-443 and CCF-162 are fixed as transferred From Under Dev to Completed (2 Cases)
  if (key === 'CCF-443' || key === 'CCF-162') {
    const isAchieved = trans.achieved === 'Yes';
    return { isUnderDevToCompleted: true, isOnTime: isAchieved };
  }

  // 2. Transferred from Under Dev to Completed (Card 1 Numerator & Denominator)
  if (trans.onTargetStatus === 'From Under Dev to Completed') {
    const isAchieved = trans.achieved === 'Yes';
    return { isUnderDevToCompleted: true, isOnTime: isAchieved };
  }

  // 3. Raw column check for explicit transferred cases
  const rawData = row.rawRowData as Record<string, string> | undefined;
  if (rawData) {
    const rawOnTargetVal = rawData['On-Target Status'] || rawData['On Target Status'] || rawData['onTargetStatus'];
    if (rawOnTargetVal === 'From Under Dev to Completed') {
      const isAchieved = trans.achieved === 'Yes' || rawData['Achieved'] === 'Yes' || rawData['On Target'] === 'Y';
      return { isUnderDevToCompleted: true, isOnTime: isAchieved };
    }
  }

  return { isUnderDevToCompleted: false, isOnTime: false };
}

/**
 * Mapping of header keywords to standardized field names.
 * This guarantees we depend on header names, NOT fixed column indices or order!
 */
export function identifyHeaderField(rawHeader: string): keyof RawCcfRow | null {
  if (!rawHeader) return null;
  // Clean invisible characters, BOM, quotes, and whitespace
  const h = String(rawHeader)
    .replace(/^[\s\uFEFF\xA0"']+|[\s"']+$/g, '')
    .toLowerCase()
    .trim();

  // 1. Issue Type
  if (/^issue\s*type$|^type$/i.test(h) || h === 'issue_type') return 'issueType';

  // 2. Issue Key
  if (/^issue\s*key$|^key$|ccf\s*key|issue_key/i.test(h)) return 'issueKey';

  // 3. Issue ID
  if (/^issue\s*id$|^issueid$/i.test(h) || h === 'issue_id' || h === 'id') return 'issueId';

  // 4. Parent ID
  if (/^parent\s*id$|^parentid$/i.test(h) || h === 'parent_id' || h === 'parent') return 'parentId';

  // 5. Summary
  if (/^summary$|^title$|^subject$/i.test(h)) return 'summary';

  // 6. Description
  if (/^description$|^details$|^desc$/i.test(h)) return 'description';

  // 7. Assignee
  if (/^assignee$|^owner$|^assigned\s*to$/i.test(h)) return 'assignee';

  // 8. Status
  if (/^status$|^state$|issue\s*status|current\s*status/i.test(h)) return 'status';
  
  // 9. Created
  if (/^created$|^created\s*date$|^creation\s*date$|^date\s*created$/i.test(h)) return 'created';
  if ((h.includes('created') || h.includes('creation')) && !h.includes('month') && !h.includes('complete')) {
    return 'created';
  }

  // 10 & 11. Monitoring Start & End Dates
  if (h.includes('monitoring') && h.includes('end')) return 'monitoringEndDate';
  if (h.includes('monitoring') && (h.includes('start') || h.includes('date') || !h.includes('end'))) {
    return 'monitoringStartDate';
  }

  // 12. Updated
  if (/^updated$|^update\s*date$|^last\s*updated$|^modified$/i.test(h)) return 'updated';

  // 13 & 14. Committed Start & End Dates
  if (h.includes('committed') && h.includes('start')) return 'committedStartDate';
  if (h.includes('committed') && (h.includes('end') || h.includes('target') || h.includes('date'))) return 'committedEndDate';

  // 15. Complaint Month
  if (h.includes('complaint')) return 'complaintMonth';

  // 16. Change Category
  if (h.includes('change category') || (h.includes('category') && !h.includes('tracker'))) return 'changeCategory';

  // 17 & 18. Product Groups
  if (h.includes('product group') || h.includes('product')) return 'productGroups';

  // 19. Source
  if (h.includes('source') || h.includes('origin')) return 'source';

  // 20. Assigned Date
  if (h.includes('assigned date') || h.includes('date assigned')) return 'assignedDate';

  // 21. Assignee Team (distinct from Department!)
  if (h.includes('assignee team') || h === 'hod' || (h.includes('team') && !h.includes('department'))) {
    return 'assigneeTeam';
  }

  // 22. In Progress Start Date
  if (h.includes('in progress') && (h.includes('start') || h.includes('date'))) return 'inProgressStartDate';

  // 23. Dev Required
  if (h.includes('dev required') || h.includes('dev_required') || h.includes('development required')) return 'devRequired';

  // Department (distinct check)
  if (h.includes('department') || h.includes('dept')) return 'department';

  if (h.includes('type') && h.includes('ccf')) return 'ccfType';
  
  // 24. Resolved / Resolve Date / Resolution Date / Transition to status last date / Actual
  if (
    h === 'resolved' ||
    h === 'resolve date' ||
    h === 'resolved date' ||
    h === 'resolution date' ||
    h.includes('resolv') ||
    h.includes('transition to status last date') ||
    h.includes('status last date') ||
    h === 'actual' ||
    h === 'actual date'
  ) {
    return 'resolved';
  }

  return null;
}

/**
 * Transforms a raw CCF row into a fully translated row with all business formulas
 */
export function translateCcfRow(raw: RawCcfRow, index: number): TranslatedCcfRow {
  const createdDate = parseDateFlexible(raw.created);
  let createdYear = extractYearFromValue(raw.created) || (createdDate ? createdDate.getUTCFullYear() : null);
  if (!createdYear) {
    createdYear =
      extractYearFromValue(raw.monitoringStartDate) ||
      extractYearFromValue(raw.committedEndDate) ||
      extractYearFromValue(raw.updated) ||
      2026; // Default to current year 2026 if date has no year specified
  }
  // 1st Rule: New Case is created in 2026!
  const isNewCase = createdYear === 2026;

  // THE THREE MONTH TRANSLATED COLUMNS (as requested):
  // Column 1: "Created Month" -> translates Created date to MMM-YY for all cases
  let createdMonth = formatMonthYY(createdDate);
  if (createdMonth === '-' && createdYear) {
    createdMonth = `Jan-${String(createdYear).slice(-2)}`;
  }

  // Check the exact 3 eligible statuses: "For Monitoring", "Completed", "Under Development"
  const isCompletedEligible = isStatusCompletedEligible(raw.status);

  // Column 2: "Created Month (Completed)" -> tracks Created date month specifically for the 3 statuses
  let createdMonthCompleted = '-';
  if (isCompletedEligible && createdDate) {
    createdMonthCompleted = formatMonthYY(createdDate);
    if (createdMonthCompleted === '-' && createdYear) {
      createdMonthCompleted = `Jan-${String(createdYear).slice(-2)}`;
    }
  }

  // Column 3: "Month Completed" -> tracks the month from column "Custom field (Monitoring Start Date)" for the same 3 statuses
  const monitoringStartDate = parseDateFlexible(raw.monitoringStartDate);
  let monthCompleted = '-';
  if (isCompletedEligible && monitoringStartDate) {
    monthCompleted = formatMonthYY(monitoringStartDate);
  }

  // Rule 4: "SLA" -> variance days from Custom field (Monitoring Start Date) - Created
  // For the status "For Monitoring" and "Completed"
  const isSlaEligible = isStatusSlaEligible(raw.status);
  let slaDays: number | null = null;
  const startRawYearForSla = extractYearFromValue(raw.monitoringStartDate);
  const startParsedYearForSla = monitoringStartDate ? monitoringStartDate.getUTCFullYear() : null;
  const startYearForSla = startRawYearForSla || startParsedYearForSla;

  // Exclude cases that started monitoring in 2025 or earlier (< 2026)
  if (isSlaEligible && monitoringStartDate && createdDate && (!startYearForSla || startYearForSla >= 2026)) {
    slaDays = calculateDaysDifference(monitoringStartDate, createdDate);
  }

  // Rule 5: "SLA duration" -> =IF(AA2<="90","90","More than 90")
  let slaDuration: TranslatedCcfRow['slaDuration'] = 'Pending';
  if (slaDays !== null) {
    slaDuration = slaDays <= 90 ? '90' : 'More than 90';
  } else if (!isSlaEligible || (startYearForSla !== null && startYearForSla < 2026)) {
    slaDuration = '-';
  }

  // Rule 6: "Committed Month" -> format MMM-YY (e.g. "Oct -> 2026" or "Sep-2026" translated to "Sep-26" or "Oct-26")
  const committedMonth = normalizeCommittedMonth(raw.committedEndDate);

  // Rule 7: "Committed end datevalue" -> for status "In Progress", gives date at End of Month (e.g. 30-Sep-2026)
  const isInProgress = isStatusInProgress(raw.status);
  let committedEndDateValue = '-';
  let slaDaysInProgress: number | null = null;
  let slaProgressStatus: TranslatedCcfRow['slaProgressStatus'] = 'N/A';
  let committedMonthProgress = '-';

  if (isInProgress) {
    const endOfMonth = getEndOfMonthDate(raw.committedEndDate || raw.monitoringStartDate || raw.created);
    if (endOfMonth) {
      committedEndDateValue = formatDdMmmYyyy(endOfMonth);
      // Rule 10: "Committed Month Progress" -> same committed end date value for progress, in MMM-YY format
      committedMonthProgress = formatMonthYY(endOfMonth);

      // Rule 8: "SLA days in Progress" -> calculates committed end date value - Created date
      if (createdDate) {
        slaDaysInProgress = calculateDaysDifference(endOfMonth, createdDate);
      }
    }

    // Rule 9: "SLA Progress Status" -> <= 90 is "Within 90" and if > 90 is "Beyond 90"
    if (slaDaysInProgress !== null) {
      slaProgressStatus = slaDaysInProgress <= 90 ? 'Within 90' : 'Beyond 90';
    } else {
      slaProgressStatus = 'Pending';
    }
  }

  // Backlog tracker specific fields:
  // 1. "Monitoring Month": For "For Monitoring", "Completed", "Under Development"
  // from Custom field (Monitoring Start Date) (or fallback to Monitoring End Date), in format MMM-YY
  const monitoringEndDate = parseDateFlexible(raw.monitoringEndDate);
  let monitoringMonth = '-';

  const normStatus = normalizeStatus(raw.status);
  const isBacklogEligibleStatus =
    normStatus === 'for monitoring' ||
    normStatus === 'completed' ||
    normStatus === 'under development' ||
    normStatus === 'for-monitoring' ||
    normStatus === 'under-development' ||
    normStatus === 'complete' ||
    normStatus === 'monitoring';

  if (isBacklogEligibleStatus && (monitoringStartDate || monitoringEndDate)) {
    monitoringMonth = formatMonthYY(monitoringStartDate || monitoringEndDate);
  }

  // 2. "SLA": Calculated days for "For Monitoring", "Completed", "Under Development"
  // from Custom field (Monitoring Start Date) after 31-12-2025 (>= 1-1-2026)
  // If monitoring started before 2026 (<= 31-12-2025), do not calculate the days.
  // 3. "SLA duration": If SLA < 181 -> "180", if >= 181 -> "Above 180"
  let slaBacklogDays: number | null = null;
  let slaBacklogDuration = '-';

  // Extract monitoring years from both raw string values and parsed Dates
  const startRawYear = extractYearFromValue(raw.monitoringStartDate);
  const startParsedYear = monitoringStartDate ? monitoringStartDate.getUTCFullYear() : null;
  const startYear = startRawYear || startParsedYear;

  const endRawYear = extractYearFromValue(raw.monitoringEndDate);
  const endParsedYear = monitoringEndDate ? monitoringEndDate.getUTCFullYear() : null;
  const endYear = endRawYear || endParsedYear;

  // If monitoring started before 2026 (startYear < 2026, or if start is absent and end is < 2026),
  // strictly exclude from days calculation (SLA days = blank, SLA duration = '-')
  const startedMonitoringBefore2026 =
    (startYear !== null && startYear < 2026) ||
    (!startYear && endYear !== null && endYear < 2026);

  const backlogMonitoringDate = monitoringStartDate || monitoringEndDate;
  if (isBacklogEligibleStatus && backlogMonitoringDate && !startedMonitoringBefore2026) {
    const monitoringYear = startYear || endYear || backlogMonitoringDate.getUTCFullYear();
    if (monitoringYear >= 2026) {
      const baseCutoff = new Date('2026-01-01T00:00:00Z');
      slaBacklogDays = calculateDaysDifference(backlogMonitoringDate, baseCutoff);
      if (slaBacklogDays !== null && slaBacklogDays >= 0) {
        slaBacklogDuration = slaBacklogDays < 181 ? '180' : 'Above 180';
      }
    }
  } else {
    // Monitoring in 2025 or earlier -> do not calculate days (leave blank)
    slaBacklogDays = null;
    slaBacklogDuration = '-';
  }

  // Determine trackerCategory: '2026', 'backlog', or 'external'
  let trackerCategory: '2026' | 'backlog' | 'external' = isNewCase ? '2026' : 'backlog';
  if (
    raw.ccfType === 'External' ||
    String(raw.issueType || '').toLowerCase().includes('external') ||
    String(raw.summary || '').toLowerCase().includes('[external]') ||
    String(raw.assignee || '').toLowerCase().includes('vendor')
  ) {
    trackerCategory = 'external';
  }

  // On-Target Completion Methodology Fields & Calculation:
  const key = String(raw.issueKey || '').trim().toUpperCase();
  const isFixedOnTarget = key === 'CCF-443' || key === 'CCF-162';

  // Extract resolved date string
  let resolvedStr: string | undefined = undefined;

  // 1. Check rawRowData for exact column 'Resolved', 'Transition to status last date', etc.
  if (raw.rawRowData) {
    for (const [k, v] of Object.entries(raw.rawRowData)) {
      const lower = k.toLowerCase().trim();
      const valStr = String(v || '').trim();
      if (!valStr || valStr === '-') continue;
      if (
        lower === 'resolved' ||
        lower === 'resolved date' ||
        lower === 'resolve date' ||
        lower === 'resolution date' ||
        lower.includes('transition to status last date') ||
        lower.includes('status last date') ||
        lower.includes('resolv') ||
        lower === 'actual' ||
        lower === 'actual date'
      ) {
        resolvedStr = valStr;
        break;
      }
    }
  }

  // 2. Check raw.resolved if valid and not legacy placeholder
  if (!resolvedStr && raw.resolved && raw.resolved !== '-' && raw.resolved !== '01-Dec-2025' && raw.resolved !== '01-Jun-2025') {
    resolvedStr = String(raw.resolved).trim();
  }

  // 3. Fallback for CCF-443 and CCF-162 from actual dates
  if (isFixedOnTarget && !resolvedStr) {
    if (key === 'CCF-443') resolvedStr = '11/Jun/26 10:05 AM';
    if (key === 'CCF-162') resolvedStr = '02/Jun/26 1:29 PM';
  }

  // 4. Fallback to monitoringEndDate if status is completed
  if (!resolvedStr && (normStatus === 'completed' || normStatus === 'complete' || isFixedOnTarget)) {
    if (raw.monitoringEndDate && String(raw.monitoringEndDate).trim() !== '-') {
      resolvedStr = String(raw.monitoringEndDate).trim();
    }
  }

  const resolvedDate = parseDateFlexible(resolvedStr);
  const resolvedMonth = resolvedDate ? formatMonthYY(resolvedDate) : '-';
  const resolvedDisplay = resolvedDate ? formatDateTime12h(resolvedDate, true) : (resolvedStr || '-');

  let onTargetStatus: TranslatedCcfRow['onTargetStatus'] = raw.onTargetStatus as TranslatedCcfRow['onTargetStatus'];
  let achieved: TranslatedCcfRow['achieved'] = raw.achieved as TranslatedCcfRow['achieved'];

  if (isFixedOnTarget) {
    onTargetStatus = 'From Under Dev to Completed';
    // User business rule: compare committed month with resolved month
    // CCF-443: committed Dec-25 !== resolved Jun-26 -> No
    // CCF-162: committed Jun-25 !== resolved Jun-26 -> No
    if (committedMonth !== '-' && resolvedMonth !== '-') {
      achieved = committedMonth.toLowerCase() === resolvedMonth.toLowerCase() ? 'Yes' : 'No';
    } else {
      achieved = 'No';
    }
  } else if (normStatus === 'under development' || normStatus.includes('under dev')) {
    onTargetStatus = 'Pending to Completed';
    achieved = 'Pending';
  } else if (raw.onTargetStatus === 'From Under Dev to Completed') {
    onTargetStatus = 'From Under Dev to Completed';
    if (committedMonth !== '-' && resolvedMonth !== '-') {
      achieved = committedMonth.toLowerCase() === resolvedMonth.toLowerCase() ? 'Yes' : 'No';
    } else {
      achieved = (raw.achieved as TranslatedCcfRow['achieved']) || 'No';
    }
  } else if (!onTargetStatus) {
    onTargetStatus = 'Not Applicable';
    achieved = '-';
  }

  // External CCF Tracker Fields Calculation (All Master Data)
  let externalTrackerStatus: '2026' | 'Backlog' | 'No Backlog' = 'No Backlog';
  if (isNewCase || createdYear === 2026) {
    externalTrackerStatus = '2026';
  } else if (isBacklogConceptCase(raw)) {
    externalTrackerStatus = 'Backlog';
  } else {
    externalTrackerStatus = 'No Backlog';
  }

  let rawDevReq = raw.devRequired;
  if (!rawDevReq && raw.rawRowData) {
    for (const [k, v] of Object.entries(raw.rawRowData)) {
      if (k.toLowerCase().includes('dev required') || k.toLowerCase().includes('devrequired')) {
        rawDevReq = String(v || '').trim();
        break;
      }
    }
  }

  const devReqRaw = String(rawDevReq || '').trim().toLowerCase();
  const isDevReqYes = devReqRaw === 'yes' || devReqRaw === 'y' || devReqRaw === 'true' || devReqRaw === '1';
  const isDevReqNo = devReqRaw === 'no' || devReqRaw === 'n' || devReqRaw === 'false' || devReqRaw === '0';
  const normalizedDevRequired: 'Yes' | 'No' | '-' = isDevReqYes ? 'Yes' : (isDevReqNo ? 'No' : '-');

  // SLA Calculation Logic for External CCF Tracker:
  // SLA Days count ONLY for status "For Monitoring" and "Completed" (for both 2026 status and Backlog status)
  // Under Development, In Progress, New, Not Started, Cancelled do NOT count SLA Days (value stays null / '-')
  const isExternalSlaEligibleStatus =
    (normStatus === 'for monitoring' ||
      normStatus === 'for-monitoring' ||
      normStatus === 'monitoring' ||
      normStatus === 'in monitoring' ||
      normStatus === 'completed' ||
      normStatus === 'complete' ||
      normStatus === 'closed' ||
      normStatus === 'resolved' ||
      normStatus === 'done' ||
      (normStatus.includes('monitoring') && !normStatus.includes('not')) ||
      (normStatus.includes('completed') && !normStatus.includes('not'))) &&
    !normStatus.includes('under dev') &&
    !normStatus.includes('under-dev') &&
    !normStatus.includes('under development') &&
    !normStatus.includes('under-development') &&
    !normStatus.includes('in progress') &&
    !normStatus.includes('in-progress') &&
    normStatus !== 'new' &&
    normStatus !== 'not started' &&
    normStatus !== 'cancelled' &&
    normStatus !== 'canceled';

  let externalSlaCountDays: number | null = null;

  if (isExternalSlaEligibleStatus) {
    // 1. Extract Custom field (In Progress Date) / In Progress Start Date
    let rawInProgressDate = raw.inProgressStartDate || raw.inProgressDate;
    if (!rawInProgressDate && raw.rawRowData) {
      for (const [k, v] of Object.entries(raw.rawRowData)) {
        const lower = k.toLowerCase().trim();
        if (lower.includes('in progress') && (lower.includes('date') || lower.includes('start'))) {
          const valStr = String(v || '').trim();
          if (valStr && valStr !== '-') {
            rawInProgressDate = valStr;
            break;
          }
        }
      }
    }

    const parsedInProgressDate = parseDateFlexible(rawInProgressDate);
    const cutoff2026 = new Date('2026-01-01T00:00:00Z');

    // Effective In Progress Start Date:
    // Any backlog case / 2026 case with In Progress Start Date if before 1-1-2026 or blank will be 1-1-2026
    let effectiveInProgressDate: Date = cutoff2026;
    if (parsedInProgressDate && parsedInProgressDate.getTime() >= cutoff2026.getTime()) {
      effectiveInProgressDate = parsedInProgressDate;
    } else {
      effectiveInProgressDate = cutoff2026;
    }

    // 2. Extract Custom field (Monitoring Start Date)
    const parsedMonitoringStartDate =
      parseDateFlexible(raw.monitoringStartDate) ||
      parseDateFlexible(raw.monitoringEndDate);

    if (parsedMonitoringStartDate) {
      externalSlaCountDays = calculateDaysDifference(parsedMonitoringStartDate, effectiveInProgressDate);
    }
  }

  let noDevSla: 'Within SLA' | 'Outside SLA' | '-' = '-';
  if (isDevReqNo && externalSlaCountDays !== null && externalSlaCountDays >= 0) {
    noDevSla = externalSlaCountDays <= 90 ? 'Within SLA' : 'Outside SLA';
  }

  let withDevSla: 'Within SLA' | 'Outside SLA' | '-' = '-';
  if (isDevReqYes && externalSlaCountDays !== null && externalSlaCountDays >= 0) {
    withDevSla = externalSlaCountDays <= 180 ? 'Within SLA' : 'Outside SLA';
  }

  const fullMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let month2026 = '-';
  if (externalTrackerStatus === '2026' || isNewCase || createdYear === 2026) {
    const fallbackDate =
      createdDate ||
      parseDateFlexible(raw.created) ||
      parseDateFlexible(raw.inProgressStartDate) ||
      parseDateFlexible(raw.inProgressDate) ||
      parseDateFlexible(raw.monitoringStartDate) ||
      parseDateFlexible(raw.committedEndDate) ||
      parseDateFlexible(raw.complaintMonth) ||
      parseDateFlexible(raw.assignedDate) ||
      parseDateFlexible(raw.updated);

    if (fallbackDate) {
      month2026 = fullMonthNames[fallbackDate.getUTCMonth()];
    } else if (raw.complaintMonth && String(raw.complaintMonth).trim() !== '-') {
      month2026 = String(raw.complaintMonth).trim();
    } else {
      // Default to October for active 2026 cases if no date is specified
      month2026 = 'October';
    }
  }

  // 2026 Case Horizon Calculation (External CCFi KPI Focus):
  // Evaluates whether ongoing 2026 cases belong to 2026 delivery or legitimately cross into 2027
  let caseHorizon2026: 'Eligible 2026' | '2027 Exceed Level' | '-' = '-';
  let caseTargetDeliveryDate: string = '-';

  const is2026Stream = externalTrackerStatus === '2026' || isNewCase || createdYear === 2026;

  if (is2026Stream) {
    const isCompletedOrMonitoring =
      normStatus === 'completed' ||
      normStatus === 'complete' ||
      normStatus === 'closed' ||
      normStatus === 'resolved' ||
      normStatus === 'done' ||
      normStatus === 'for monitoring' ||
      normStatus === 'for-monitoring' ||
      normStatus === 'monitoring' ||
      normStatus === 'in monitoring';

    const isOngoingStatus =
      normStatus === 'in progress' ||
      normStatus === 'in-progress' ||
      normStatus === 'under dev' ||
      normStatus === 'under-dev' ||
      normStatus === 'under development' ||
      normStatus === 'under-development';

    if (isCompletedOrMonitoring && !isOngoingStatus) {
      caseHorizon2026 = 'Eligible 2026';
    } else if (isOngoingStatus) {
      // Ongoing cases: Check milestone date + SLA window (90d No Dev, 180d Dev)
      let rawMilestoneDate = raw.inProgressStartDate || raw.inProgressDate;
      if (!rawMilestoneDate && raw.rawRowData) {
        for (const [k, v] of Object.entries(raw.rawRowData)) {
          const lower = k.toLowerCase().trim();
          if (lower.includes('in progress') && (lower.includes('date') || lower.includes('start'))) {
            const valStr = String(v || '').trim();
            if (valStr && valStr !== '-') {
              rawMilestoneDate = valStr;
              break;
            }
          }
        }
      }
      if (!rawMilestoneDate) {
        rawMilestoneDate = raw.committedStartDate;
      }
      if (!rawMilestoneDate && raw.rawRowData) {
        for (const [k, v] of Object.entries(raw.rawRowData)) {
          const lower = k.toLowerCase().trim();
          if (lower.includes('committed start') || (lower.includes('committed') && lower.includes('start'))) {
            const valStr = String(v || '').trim();
            if (valStr && valStr !== '-') {
              rawMilestoneDate = valStr;
              break;
            }
          }
        }
      }
      if (!rawMilestoneDate) {
        rawMilestoneDate = raw.created;
      }

      const parsedMilestone = parseDateFlexible(rawMilestoneDate);
      const isDev = normalizedDevRequired === 'Yes';
      const slaDaysWindow = isDev ? 180 : 90;

      if (parsedMilestone) {
        const targetDelivery = new Date(parsedMilestone.getTime() + (slaDaysWindow * 24 * 60 * 60 * 1000));
        caseTargetDeliveryDate = formatDdMmmYyyy(targetDelivery);
        // December 31, 2026 23:59:59 cutoff
        const endOf2026 = new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 999));
        if (targetDelivery.getTime() > endOf2026.getTime()) {
          caseHorizon2026 = '2027 Exceed Level';
        } else {
          caseHorizon2026 = 'Eligible 2026';
        }
      } else {
        caseHorizon2026 = 'Eligible 2026';
      }
    } else {
      caseHorizon2026 = '-';
    }
  }

  return {
    ...raw,
    id: raw.id || `ccf-${index + 1}`,
    trackerCategory,
    isNewCase,
    createdYear,
    createdMonth,
    createdMonthCompleted,
    monthCompleted,
    slaDays,
    slaDuration,
    committedMonth,
    committedEndDateValue,
    slaDaysInProgress,
    slaProgressStatus,
    committedMonthProgress,
    monitoringMonth,
    slaBacklogDays,
    slaBacklogDuration,
    resolved: resolvedDisplay,
    resolvedMonth,
    onTargetStatus,
    achieved,
    externalTrackerStatus,
    month2026,
    externalSlaCountDays,
    normalizedDevRequired,
    noDevSla,
    withDevSla,
    caseHorizon2026,
    caseTargetDeliveryDate,
  };
}

/**
 * Maps cases for On-Target completion methodology across uploads & re-uploads:
 * - Cases with status 'Under Development' are registered in knownUnderDevKeys and marked as 'Pending to Completed'.
 * - When a known under-dev case transitions to 'Completed', its status becomes 'From Under Dev to Completed'.
 * - 'Achieved' column calculation:
 *     Compares the month of Custom field (Committed End Date) with the month of Resolve Date.
 *     If same month -> 'Yes', if different -> 'No', if pending -> 'Pending'.
 * - Fixed cases CCF-443 and CCF-162 are permanently set as 'From Under Dev to Completed' with achieved = 'Yes'.
 */
export function applyOnTargetMapping(
  rows: TranslatedCcfRow[],
  knownUnderDevKeys: Set<string> = new Set()
): { rows: TranslatedCcfRow[]; updatedKeys: Set<string> } {
  const updatedKeys = new Set(knownUnderDevKeys);

  const mapped = rows.map((r) => {
    const key = String(r.issueKey || '').trim().toUpperCase();
    const isFixed = key === 'CCF-443' || key === 'CCF-162';
    const s = normalizeStatus(r.status);
    const isUnderDev = s === 'under development' || s.includes('under dev');
    const isCompleted =
      s === 'completed' ||
      s === 'complete' ||
      s === 'closed' ||
      (s.includes('completed') && !s.includes('not'));

    let onTargetStatus: TranslatedCcfRow['onTargetStatus'] = r.onTargetStatus || 'Not Applicable';
    let achieved: TranslatedCcfRow['achieved'] = r.achieved || '-';
    let resolvedStr: string | undefined = undefined;

    // Check rawRowData for exact Resolved / Transition to status last date / Actual column
    if (r.rawRowData) {
      for (const [colK, v] of Object.entries(r.rawRowData)) {
        const lower = colK.toLowerCase().trim();
        const valStr = String(v || '').trim();
        if (!valStr || valStr === '-') continue;
        if (
          lower === 'resolved' ||
          lower === 'resolved date' ||
          lower === 'resolve date' ||
          lower === 'resolution date' ||
          lower.includes('transition to status last date') ||
          lower.includes('status last date') ||
          lower.includes('resolv') ||
          lower === 'actual' ||
          lower === 'actual date'
        ) {
          resolvedStr = valStr;
          break;
        }
      }
    }

    if (!resolvedStr && r.resolved && r.resolved !== '-' && r.resolved !== '01-Dec-2025' && r.resolved !== '01-Jun-2025') {
      resolvedStr = String(r.resolved).trim();
    }

    if (isFixed && !resolvedStr) {
      if (key === 'CCF-443') resolvedStr = '11/Jun/26 10:05 AM';
      if (key === 'CCF-162') resolvedStr = '02/Jun/26 1:29 PM';
    }

    if (!resolvedStr && (isCompleted || isFixed)) {
      if (r.monitoringEndDate && String(r.monitoringEndDate).trim() !== '-') {
        resolvedStr = String(r.monitoringEndDate).trim();
      }
    }

    const resolvedDateObj = parseDateFlexible(resolvedStr);
    const resolvedMonth = resolvedDateObj ? formatMonthYY(resolvedDateObj) : '-';
    const resolvedDisplay = resolvedDateObj ? formatDateTime12h(resolvedDateObj, true) : (resolvedStr || '-');

    if (isFixed) {
      onTargetStatus = 'From Under Dev to Completed';
      // Compare month of Committed End Date with month of Resolve Date
      const committedDate = parseDateFlexible(r.committedEndDate || r.committedEndDateValue);
      const cMonth = committedDate ? formatMonthYY(committedDate) : r.committedMonth;

      if (cMonth && cMonth !== '-' && resolvedMonth && resolvedMonth !== '-') {
        achieved = cMonth.toLowerCase() === resolvedMonth.toLowerCase() ? 'Yes' : 'No';
      } else {
        achieved = 'No';
      }
    } else if (isUnderDev) {
      onTargetStatus = 'Pending to Completed';
      achieved = 'Pending';
      updatedKeys.add(key);
    } else if (updatedKeys.has(key) && isCompleted) {
      onTargetStatus = 'From Under Dev to Completed';
      // Compare month of Custom field (Committed End Date) with month of Resolve Date
      const committedDate = parseDateFlexible(r.committedEndDate || r.committedEndDateValue);
      const cMonth = committedDate ? formatMonthYY(committedDate) : r.committedMonth;

      if (cMonth && cMonth !== '-' && resolvedMonth && resolvedMonth !== '-') {
        achieved = cMonth.toLowerCase() === resolvedMonth.toLowerCase() ? 'Yes' : 'No';
      } else {
        achieved = 'No';
      }
    }

    return {
      ...r,
      resolved: resolvedDisplay,
      resolvedMonth,
      onTargetStatus,
      achieved,
    };
  });

  return { rows: mapped, updatedKeys };
}

/**
 * Parse an Excel or CSV file buffer/array, automatically locating the header row
 * and mapping columns by name
 */
export function parseSpreadsheetData(data: ArrayBuffer | Uint8Array | string): TranslatedCcfRow[] {
  const workbook = XLSX.read(data, {
    type: typeof data === 'string' ? 'string' : 'array',
    cellDates: true,
  });

  // Find the most appropriate sheet in workbook with data
  let targetSheet: XLSX.WorkSheet | null = null;
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    if (ws && ws['!ref']) {
      targetSheet = ws;
      break;
    }
  }

  if (!targetSheet) return [];

  // Convert to 2D array to locate the exact header row
  const rawRows2D: unknown[][] = XLSX.utils.sheet_to_json(targetSheet, { header: 1, defval: '' });
  if (rawRows2D.length === 0) return [];

  // Search first 15 rows for the row containing header keywords (e.g., 'Created' or 'Status' or 'Key')
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(rawRows2D.length, 15); r++) {
    const row = rawRows2D[r];
    if (Array.isArray(row)) {
      const matchCount = row.filter((cell) => {
        const id = identifyHeaderField(String(cell));
        return id !== null;
      }).length;
      if (matchCount >= 2) {
        headerRowIndex = r;
        break;
      }
    }
  }

  // Extract all column headers from the detected header row to preserve original headers
  const headerCells = (rawRows2D[headerRowIndex] as unknown[]) || [];
  const discoveredHeaders: string[] = [];
  headerCells.forEach((c, colIdx) => {
    const hStr = String(c ?? '').trim();
    if (hStr) {
      discoveredHeaders.push(hStr);
    } else {
      // Check if subsequent rows have content in this column
      const hasContentBelow = rawRows2D.slice(headerRowIndex + 1, headerRowIndex + 15).some(
        (r) => Array.isArray(r) && r[colIdx] !== undefined && String(r[colIdx]).trim() !== ''
      );
      if (hasContentBelow) {
        discoveredHeaders.push(`Column_${colIdx + 1}`);
      }
    }
  });

  // Parse starting from the discovered header row
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(targetSheet, {
    range: headerRowIndex,
    defval: '',
  });

  if (rawRows.length === 0) return [];

  // Union of discovered headers and all keys that appear across rows
  const allSheetKeysSet = new Set<string>(discoveredHeaders);
  rawRows.forEach((r) => {
    Object.keys(r).forEach((k) => {
      const cleanK = String(k).trim();
      if (cleanK && !cleanK.startsWith('__EMPTY')) {
        allSheetKeysSet.add(cleanK);
      }
    });
  });
  const allSheetHeaders = Array.from(allSheetKeysSet);

  const headerMap: Record<string, keyof RawCcfRow> = {};
  allSheetHeaders.forEach((key) => {
    const identified = identifyHeaderField(key);
    if (identified) {
      headerMap[key] = identified;
    }
  });

  return rawRows.map((row, idx) => {
    const mapped: Partial<RawCcfRow> = {};
    const rawRowData: Record<string, string> = {};

    const cleanCellVal = (val: unknown, colName: string): string => {
      if (val === undefined || val === null) return '';
      const isTimePreserved = /^created$|^updated$|date\s*created|date\s*updated/i.test(colName.trim());
      if (val instanceof Date) {
        return formatDateTime12h(val, isTimePreserved);
      }
      const s = String(val).trim();
      if (!s || s === '-') return '-';
      // If it looks like JavaScript Date string (Image 1) or is a date column:
      if (
        s.includes('GMT') ||
        s.includes('(') ||
        /^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4}/.test(s) ||
        (/date|created|updated/i.test(colName) && !colName.toLowerCase().includes('month'))
      ) {
        return formatDateTime12h(s, isTimePreserved);
      }
      return s;
    };

    // 1. Populate all known sheet headers first
    allSheetHeaders.forEach((colName) => {
      const val = row[colName];
      const cleanVal = cleanCellVal(val, colName);
      rawRowData[colName] = cleanVal;
      const field = headerMap[colName] || identifyHeaderField(colName);
      if (field && cleanVal && cleanVal !== '-') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapped as any)[field] = cleanVal;
      }
    });

    // 2. Also capture any remaining properties on row
    Object.entries(row).forEach(([colName, val]) => {
      if (rawRowData[colName] === undefined) {
        const cleanVal = cleanCellVal(val, colName);
        rawRowData[colName] = cleanVal;
        const field = headerMap[colName] || identifyHeaderField(colName);
        if (field && cleanVal && cleanVal !== '-') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (mapped as any)[field] = cleanVal;
        }
      }
    });

    const rawRow: RawCcfRow = {
      issueKey: mapped.issueKey || `CCF-${4000 + idx}`,
      summary: mapped.summary || `Change Request #${idx + 1}`,
      assignee: mapped.assignee || 'Unassigned',
      status: mapped.status || 'New',
      created: mapped.created || '01/10/2026',
      issueType: mapped.issueType || 'Task',
      issueId: mapped.issueId || String(310000 + idx),
      parentId: mapped.parentId || '',
      description: mapped.description || '',
      monitoringStartDate: mapped.monitoringStartDate || '',
      monitoringEndDate: mapped.monitoringEndDate || '',
      updated: mapped.updated || '',
      committedStartDate: mapped.committedStartDate || '',
      committedEndDate: mapped.committedEndDate || '',
      assignedDate: mapped.assignedDate || '',
      assigneeTeam: mapped.assigneeTeam || 'CX Governance',
      inProgressDate: mapped.inProgressDate || '',
      inProgressStartDate: mapped.inProgressStartDate || '',
      complaintMonth: mapped.complaintMonth || '',
      changeCategory: mapped.changeCategory || '',
      productGroups: mapped.productGroups || '',
      source: mapped.source || '',
      devRequired: mapped.devRequired || '',
      department: mapped.department || 'Consumer',
      ccfType: mapped.ccfType || 'Internal',
    };

    const translated = translateCcfRow(rawRow, idx);
    translated.rawColumns = allSheetHeaders;
    translated.rawRowData = rawRowData;
    return translated;
  });
}

/**
 * Exact Excel Formula for Cell G3 (INDEX %):
 * =IF(AND(ISNUMBER(D3), D3<>0), (D3/0.8)*0.5, 0)
 * + IF(AND(ISNUMBER(E3), E3<>0), (E3/0.8)*0.4, 0)
 * + IF(AND(ISNUMBER(D3), D3<>""), IF(OR(NOT(ISNUMBER(F3)), F3=0), 0.1, (F3/0.8)*0.1), IF(AND(ISNUMBER(F3), F3<>0), (F3/0.8)*0.1, 0))
 *
 * Methodology of Column F Contribution inside KPI Index Internal CCF!G:G:
 * - Benchmark target is 80%.
 * - If F has a positive percentage (F > 0):
 *     contribution = (F / 80%) * 10% = (F / 0.8) * 0.1
 * - You get 10% when F is blank or 0 and D contains a numeric value.
 * - You get 0% when F is blank or 0 and D is blank/non-numeric.
 *
 * Examples:
 * D       F       KPI contribution
 * 57%     Blank   10%
 * Blank   Blank   0%
 * 100%    0%      10%
 * Any     40%     5%
 * Any     80%     10%
 *
 * Total Index Example:
 * D = 100%, E = 25%, F = Blank (with numeric D):
 * (100/80) * 0.5 = 62.5% (~63%)
 * (25/80) * 0.4 = 12.5% (~12%)
 * On-Target = 10%
 * Total Index = 62.5% + 12.5% + 10% = 85%
 */
export function calculateChangeFactoryIndex(
  hasNewCases: boolean,
  newCasesRate: number | null,
  hasOldCases: boolean,
  oldCasesRate: number | null,
  hasOnTarget: boolean,
  onTargetRate: number | null
): number {
  // If owner has zero cases overall across all trackers, index is 0
  if (!hasNewCases && !hasOldCases && !hasOnTarget) {
    return 0;
  }

  // Term 1 (New Cases SLA - Column D): contributes 50%, benchmarked against 80% target
  // =IF(AND(ISNUMBER(D3), D3<>0), (D3/0.8)*0.5, 0)
  let term1 = 0;
  const isDNumeric = hasNewCases && newCasesRate !== null;
  if (isDNumeric && newCasesRate > 0) {
    term1 = (newCasesRate / 0.8) * 0.5;
  }

  // Term 2 (Old Cases SLA - Column E): contributes 40%, benchmarked against 80% target
  // + IF(AND(ISNUMBER(E3), E3<>0), (E3/0.8)*0.4, 0)
  let term2 = 0;
  const isENumeric = hasOldCases && oldCasesRate !== null;
  if (isENumeric && oldCasesRate > 0) {
    term2 = (oldCasesRate / 0.8) * 0.4;
  }

  // Term 3 (On-Target Completion - Column F): contributes 10%, benchmarked against 80% target
  // + IF(AND(ISNUMBER(D3), D3<>""), IF(OR(NOT(ISNUMBER(F3)), F3=0), 0.1, (F3/0.8)*0.1), IF(AND(ISNUMBER(F3), F3<>0), (F3/0.8)*0.1, 0))
  let term3 = 0;
  const isFNumeric = hasOnTarget && onTargetRate !== null;
  const isFPositive = isFNumeric && onTargetRate > 0;
  const isFBlankOrZero = !isFNumeric || onTargetRate === 0;

  if (isFPositive) {
    term3 = (onTargetRate / 0.8) * 0.1;
  } else if (isFBlankOrZero && isDNumeric) {
    term3 = 0.1; // 10% awarded when F is blank or 0 and D contains a numeric value
  } else {
    term3 = 0; // 0% awarded when F is blank or 0 and D is blank/non-numeric
  }

  return Math.round((term1 + term2 + term3) * 100);
}

export interface IndexContributionBreakdown {
  term1NewCasesPct: number; // e.g. 62.5%
  term2OldCasesPct: number; // e.g. 12.5%
  term3OnTargetPct: number; // e.g. 10%
  totalIndex: number; // e.g. 85%
  onTargetRule: string;
}

export function getChangeFactoryIndexBreakdown(
  hasNewCases: boolean,
  newCasesRate: number | null,
  hasOldCases: boolean,
  oldCasesRate: number | null,
  hasOnTarget: boolean,
  onTargetRate: number | null
): IndexContributionBreakdown {
  const isDNumeric = hasNewCases && newCasesRate !== null;
  const isENumeric = hasOldCases && oldCasesRate !== null;
  const isFNumeric = hasOnTarget && onTargetRate !== null;

  let term1 = 0;
  if (isDNumeric && newCasesRate > 0) {
    term1 = (newCasesRate / 0.8) * 0.5;
  }

  let term2 = 0;
  if (isENumeric && oldCasesRate > 0) {
    term2 = (oldCasesRate / 0.8) * 0.4;
  }

  let term3 = 0;
  let onTargetRule = '0% (D is blank/non-numeric)';

  const isFPositive = isFNumeric && onTargetRate > 0;
  const isFBlankOrZero = !isFNumeric || onTargetRate === 0;

  if (isFPositive) {
    term3 = (onTargetRate / 0.8) * 0.1;
    onTargetRule = `(${Math.round(onTargetRate * 100)}% / 80%) × 10% = ${Math.round(term3 * 1000) / 10}%`;
  } else if (isFBlankOrZero && isDNumeric) {
    term3 = 0.1;
    onTargetRule = '10% awarded (F is blank/0 and D is numeric)';
  } else {
    term3 = 0;
    onTargetRule = '0% (F is blank/0 and D is blank)';
  }

  const totalIndex = Math.round((term1 + term2 + term3) * 100);

  return {
    term1NewCasesPct: Math.round(term1 * 1000) / 10,
    term2OldCasesPct: Math.round(term2 * 1000) / 10,
    term3OnTargetPct: Math.round(term3 * 1000) / 10,
    totalIndex,
    onTargetRule,
  };
}

/**
 * Calculates per-owner summary rows grouped by Assignee
 * Follows exact user rules & Excel formula methodology:
 * - Card 1: On-Target Completion (default 0 for now)
 * - Card 2: New Cases KPI (Source: 2026 CCF Tracker, 50% weight at 80% SLA)
 * - Card 3: Old Cases KPI (Source: Backlog Tracker, 40% weight at 80% SLA)
 * - Index: =IF(AND(ISNUMBER(D3), D3<>0), (D3/0.8)*0.5, 0) + IF(AND(ISNUMBER(E3), E3<>0), (E3/0.8)*0.4, 0) + ...
 */
export function calculateOwnerIndexSummaries(
  rows: TranslatedCcfRow[],
  allocations?: UserAllocation[],
  explicitBacklogRows?: TranslatedCcfRow[]
): OwnerIndexSummary[] {
  const rows2026 = explicitBacklogRows ? rows : rows.filter((r) => r.isNewCase || r.createdYear === 2026);
  const rowsBacklog = explicitBacklogRows ? explicitBacklogRows : rows.filter(isBacklogCase);

  const groups: Record<string, {
    owner: string;
    assignee: string;
    hod: string;
    newCasesCount: number;
    newCasesDenominator: number;
    newCasesWithinSla: number;
    oldCasesCount: number;
    oldCasesWithinSla: number;
    onTargetCount: number;
    onTargetCompleted: number;
  }> = {};

  // Build lookup map for allocations
  const allocLookup = new Map<string, UserAllocation>();
  if (allocations && allocations.length > 0) {
    allocations.forEach((alloc) => {
      allocLookup.set(alloc.owner.toLowerCase(), alloc);
      allocLookup.set(alloc.assignee.toLowerCase(), alloc);
      groups[alloc.owner] = {
        owner: alloc.owner,
        assignee: alloc.assignee,
        hod: alloc.hod,
        newCasesCount: 0,
        newCasesDenominator: 0,
        newCasesWithinSla: 0,
        oldCasesCount: 0,
        oldCasesWithinSla: 0,
        onTargetCount: 0,
        onTargetCompleted: 0,
      };
    });
  }

  const normalize = (val: unknown) => String(val || '').toLowerCase().trim();

  // Helper to find canonical owner name
  const resolveOwnerInfo = (rawAssignee?: string, rawHod?: string) => {
    const clean = String(rawAssignee || '').trim();
    const matched = allocLookup.get(clean.toLowerCase());
    if (matched) {
      return { owner: matched.owner, assignee: matched.assignee, hod: matched.hod };
    }
    return { owner: clean || 'Unassigned', assignee: clean || 'unassigned', hod: rawHod || 'General' };
  };

  // 2. Card 2: New Cases KPI (Source: 2026 CCF Tracker)
  rows2026.forEach((row) => {
    const { owner, assignee, hod } = resolveOwnerInfo(row.assignee, row.hod || row.assigneeTeam);

    if (!groups[owner]) {
      groups[owner] = {
        owner,
        assignee,
        hod,
        newCasesCount: 0,
        newCasesDenominator: 0,
        newCasesWithinSla: 0,
        oldCasesCount: 0,
        oldCasesWithinSla: 0,
        onTargetCount: 0,
        onTargetCompleted: 0,
      };
    }

    const g = groups[owner];
    const s = normalize(row.status);

    // Total Count: In Progress, Under Development, For Monitoring, Completed
    const isEligible4 = ['in progress', 'under development', 'for monitoring', 'completed'].some(
      (k) => s === k || s.includes(k)
    );
    if (isEligible4) {
      g.newCasesCount += 1;
    }

    // Denominator & Numerator: Under Development, For Monitoring, Completed
    const isEligible3 = ['under development', 'for monitoring', 'completed'].some(
      (k) => s === k || s.includes(k)
    );
    if (isEligible3) {
      g.newCasesDenominator += 1;
      const isWithinSla =
        row.slaDuration === '90' ||
        (row.slaDays !== null && row.slaDays <= 90);
      if (isWithinSla) {
        g.newCasesWithinSla += 1;
      }
    }

    // Card 1: On-Target Completion (N: cases from Under Dev to Completed, O: completed on or before committed target date)
    const onTargetEval = evaluateOnTargetCompletion(row);
    if (onTargetEval.isUnderDevToCompleted) {
      g.onTargetCount += 1;
      if (onTargetEval.isOnTime) {
        g.onTargetCompleted += 1;
      }
    }
  });

  // 3. Card 3: Old Cases KPI (Source: Backlog Tracker)
  rowsBacklog.forEach((row) => {
    const { owner, assignee, hod } = resolveOwnerInfo(row.assignee, row.hod || row.assigneeTeam);

    if (!groups[owner]) {
      groups[owner] = {
        owner,
        assignee,
        hod,
        newCasesCount: 0,
        newCasesDenominator: 0,
        newCasesWithinSla: 0,
        oldCasesCount: 0,
        oldCasesWithinSla: 0,
        onTargetCount: 0,
        onTargetCompleted: 0,
      };
    }

    const g = groups[owner];
    const s = normalize(row.status);

    // Total Count & Denominator: all except "Not Started" and "Cancelled"
    const isExcluded = s === 'not started' || s === 'cancelled' || s.includes('not started') || s.includes('cancelled');
    if (!isExcluded) {
      g.oldCasesCount += 1;
      const isWithinSla =
        row.slaBacklogDuration === '180' ||
        (row.slaBacklogDays !== null && row.slaBacklogDays < 181);
      if (isWithinSla) {
        g.oldCasesWithinSla += 1;
      }
    }

    // Card 1: On-Target Completion for Backlog cases
    const onTargetEval = evaluateOnTargetCompletion(row);
    if (onTargetEval.isUnderDevToCompleted) {
      g.onTargetCount += 1;
      if (onTargetEval.isOnTime) {
        g.onTargetCompleted += 1;
      }
    }
  });

  return Object.values(groups).map((g) => {
    const hasNewCases = g.newCasesCount > 0;
    const newCasesRate = hasNewCases ? g.newCasesWithinSla / g.newCasesCount : null;
    const newCasesPct = hasNewCases ? Math.round(newCasesRate! * 100) : 0;

    const hasOldCases = g.oldCasesCount > 0;
    const oldCasesRate = hasOldCases ? g.oldCasesWithinSla / g.oldCasesCount : null;
    const oldCasesPct = hasOldCases ? Math.round(oldCasesRate! * 100) : 0;

    const hasOnTarget = g.onTargetCount > 0;
    const onTargetRate = hasOnTarget ? g.onTargetCompleted / g.onTargetCount : null;
    const onTargetPct = hasOnTarget ? Math.round(onTargetRate! * 100) : 0;

    // Apply exact Excel formula:
    // (D/0.8)*0.5 + (E/0.8)*0.4 + IF(hasOnTarget, (F/0.8)*0.1, 0.1)
    const compositeScore = calculateChangeFactoryIndex(
      hasNewCases,
      newCasesRate,
      hasOldCases,
      oldCasesRate,
      hasOnTarget,
      onTargetRate
    );

    // Compute exact contribution percentage of Column F (On-Target)
    const isFPositive = hasOnTarget && onTargetRate !== null && onTargetRate > 0;
    const isFBlankOrZero = !hasOnTarget || onTargetRate === null || onTargetRate === 0;
    const isDNumeric = hasNewCases && newCasesRate !== null;
    let onTargetContribution = 0;
    if (isFPositive) {
      onTargetContribution = Math.round(((onTargetRate! / 0.8) * 0.1) * 1000) / 10;
    } else if (isFBlankOrZero && isDNumeric) {
      onTargetContribution = 10;
    } else {
      onTargetContribution = 0;
    }

    return {
      owner: g.owner,
      assignee: g.assignee,
      hod: g.hod,
      newCasesCount: g.newCasesCount,
      newCasesDenominator: g.newCasesCount,
      newCasesWithinSla: g.newCasesWithinSla,
      newCasesPct,
      oldCasesCount: g.oldCasesCount,
      oldCasesWithinSla: g.oldCasesWithinSla,
      oldCasesPct,
      onTargetCount: g.onTargetCount,
      onTargetCompleted: g.onTargetCompleted,
      onTargetPct,
      onTargetContribution,
      changeFactoryIndex: compositeScore,
    };
  }).sort((a, b) => b.changeFactoryIndex - a.changeFactoryIndex);
}

/**
 * Calculates overall aggregate dashboard metrics
 * Implements user rules:
 * - Card 1: On-Target Completion (N: under dev to completed, O: on or before target date)
 * - Card 2: New Cases KPI (Source: 2026 CCF Tracker)
 * - Card 3: Old Cases KPI (Source: Backlog Tracker)
 */
export function calculateAggregateStats(
  rows: TranslatedCcfRow[],
  explicitBacklogRows?: TranslatedCcfRow[]
): CcfAggregateStats {
  const rows2026 = explicitBacklogRows ? rows : rows.filter((r) => r.isNewCase || r.createdYear === 2026);
  const rowsBacklog = explicitBacklogRows ? explicitBacklogRows : rows.filter(isBacklogCase);

  const normalize = (val: unknown) => String(val || '').toLowerCase().trim();

  // Card 2: New Cases KPI (Source: 2026 CCF Tracker)
  // Total Count: Count all cases with status "In Progress", "Under Development", "For Monitoring", or "Completed".
  // SLA Target: SLA Duration <= 90.
  // SLA % Calculation:
  // Numerator: Count of cases with status "Under Development", "For Monitoring", or "Completed" where SLA Duration is <= 90.
  // Denominator: Total count of cases with status "Under Development", "For Monitoring", or "Completed".
  // Formula: (Numerator / Denominator) * 100
  let newCasesTotal = 0;
  let newCasesDenominator = 0;
  let newCasesWithinSla = 0;

  rows2026.forEach((r) => {
    const s = normalize(r.status);
    const isEligible4 = ['in progress', 'under development', 'for monitoring', 'completed'].some(
      (k) => s === k || s.includes(k)
    );
    if (isEligible4) {
      newCasesTotal++;
    }

    const isEligible3 = ['under development', 'for monitoring', 'completed'].some(
      (k) => s === k || s.includes(k)
    );
    if (isEligible3) {
      newCasesDenominator++;
      const isWithinSla =
        r.slaDuration === '90' ||
        (r.slaDays !== null && r.slaDays <= 90);
      if (isWithinSla) {
        newCasesWithinSla++;
      }
    }
  });

  const newCasesSlaPct = newCasesTotal > 0 ? Math.round((newCasesWithinSla / newCasesTotal) * 100) : 0;

  // Card 3: Old Cases KPI (Source: Backlog Tracker)
  // Total Count: Count all cases except those with status "Not Started" or "Cancelled".
  // SLA Target: SLA Duration <= 180.
  // SLA % Calculation:
  // Numerator: Count of eligible old cases where SLA Duration is <= 180.
  // Denominator: Total eligible old cases (all except "Not Started" and "Cancelled").
  // Formula: (Numerator / Denominator) * 100
  let oldCasesTotal = 0;
  let oldCasesWithinSla = 0;

  rowsBacklog.forEach((r) => {
    const s = normalize(r.status);
    const isExcluded = s === 'not started' || s === 'cancelled' || s.includes('not started') || s.includes('cancelled');
    if (!isExcluded) {
      oldCasesTotal++;
      const isWithinSla =
        r.slaBacklogDuration === '180' ||
        (r.slaBacklogDays !== null && r.slaBacklogDays < 181);
      if (isWithinSla) {
        oldCasesWithinSla++;
      }
    }
  });

  const oldCasesSlaPct = oldCasesTotal > 0 ? Math.round((oldCasesWithinSla / oldCasesTotal) * 100) : 0;

  // Card 1: On-Target Completion
  // N: Number of cases transferred from Under Development to Completed.
  // O: Those cases completed on or before the committed target date, marked Y.
  // F: O ÷ N.
  let onTargetTotal = 0;
  let onTargetCompleted = 0;

  const allRows = [...rows2026, ...rowsBacklog];
  allRows.forEach((r) => {
    const evalRes = evaluateOnTargetCompletion(r);
    if (evalRes.isUnderDevToCompleted) {
      onTargetTotal++;
      if (evalRes.isOnTime) {
        onTargetCompleted++;
      }
    }
  });

  const onTargetCompletionPct = onTargetTotal > 0 ? Math.round((onTargetCompleted / onTargetTotal) * 100) : 0;

  // Preserved for background tracking
  let inProgressCount = 0;
  let inProgressWithin90 = 0;
  rows2026.forEach((r) => {
    const s = normalize(r.status);
    if (s === 'in progress' || s.includes('in progress')) {
      inProgressCount++;
      if (r.slaProgressStatus === 'Within 90') inProgressWithin90++;
    }
  });
  const inProgressPct = inProgressCount > 0 ? Math.round((inProgressWithin90 / inProgressCount) * 100) : 0;

  // Overall Change Factory Index using exact Excel formula
  const hasNew = newCasesTotal > 0;
  const newRate = hasNew ? newCasesWithinSla / newCasesTotal : null;
  const hasOld = oldCasesTotal > 0;
  const oldRate = hasOld ? oldCasesWithinSla / oldCasesTotal : null;
  const hasOnTarget = onTargetTotal > 0;
  const onTargetRate = hasOnTarget ? onTargetCompleted / onTargetTotal : null;

  const overallIndex = calculateChangeFactoryIndex(
    hasNew,
    newRate,
    hasOld,
    oldRate,
    hasOnTarget,
    onTargetRate
  );

  return {
    totalCases: rows2026.length + rowsBacklog.length + onTargetTotal,
    newCasesTotal,
    newCasesDenominator: newCasesTotal,
    newCasesWithinSla,
    newCasesSlaPct,
    oldCasesTotal,
    oldCasesWithinSla,
    oldCasesSlaPct,
    onTargetCompletionCount: onTargetCompleted,
    onTargetTotal,
    onTargetCompletionPct,
    inProgressCount,
    inProgressWithin90,
    inProgressPct,
    completedCount: 0,
    forMonitoringCount: 0,
    overallIndex,
    targetIndex: 90,
  };
}

/**
 * Generates an Excel (.xlsx) file with all translated columns ready to download
 */
export function exportTranslatedWorkbook(rows: TranslatedCcfRow[], filename = 'CCF_Translated_Tracker.xlsx') {
  const exportData = rows.map((r) => {
    const rowObj: Record<string, unknown> = {
      // 1. ALL UPLOADED SHEET COLUMNS (Jira Export)
      'Issue Type': r.issueType || 'Task',
      'Issue key': r.issueKey,
      'Issue id': r.issueId || '',
      'Parent id': r.parentId || '',
      'Summary': r.summary,
      'Description': r.description || '',
      'Assignee': r.assignee,
      'Status': r.status,
      'Created': extractCellDate(r.created) || formatDateTime12h(r.created, true),
      'Custom field (Monitoring Start Date)': extractCellDate(r.monitoringStartDate) || '',
      'Custom field (Monitoring End Date)': extractCellDate(r.monitoringEndDate) || '',
      'Updated': extractCellDate(r.updated) || formatDateTime12h(r.updated, true),
      'Custom field (Committed Start Date)': extractCellDate(r.committedStartDate) || '',
      'Custom field (Committed End Date)': extractCellDate(r.committedEndDate) || r.committedEndDate || '',
      'Custom field (Complaint Month)': extractCellDate(r.complaintMonth) || r.complaintMonth || '',
      'Custom field (Change Category)': r.changeCategory || '',
      'Custom field (Product Groups)': r.productGroups || '',
      'Custom field (Source)': r.source || '',
      'Custom field (Assigned Date)': extractCellDate(r.assignedDate) || '',
      'Custom field (Assignee Team)': r.assigneeTeam || '',
      'Custom field (In Progress Start Date)': extractCellDate(r.inProgressStartDate) || '',
      'Custom field (Dev Required)': r.devRequired || '',
      // 2. THE THREE MONTH COLUMNS & TRANSLATED EQUATIONS (as requested):
      'Case Category': r.isNewCase ? 'New Case (2026)' : 'Old Case (<2026)',
      '2026 Case Horizon': r.caseHorizon2026 || '-',
      'Created Month': extractCellDate(r.createdMonth) || r.createdMonth,
      'Created Month (Completed)': extractCellDate(r.createdMonthCompleted) || r.createdMonthCompleted,
      'Month Completed': extractCellDate(r.monthCompleted) || r.monthCompleted,
      'SLA Days': r.slaDays !== null ? r.slaDays : '',
      'SLA duration': r.slaDuration,
      'Committed Month': extractCellDate(r.committedMonth) || r.committedMonth,
      'Committed end datevalue': extractCellDate(r.committedEndDateValue) || r.committedEndDateValue,
      'SLA days in Progress': r.slaDaysInProgress !== null ? r.slaDaysInProgress : '',
      'SLA Progress Status': r.slaProgressStatus,
      'Committed Month (Progress)': extractCellDate(r.committedMonthProgress) || r.committedMonthProgress,
      // Backlog Tracker specific calculated columns
      'Monitoring Month': extractCellDate(r.monitoringMonth) || r.monitoringMonth,
      'SLA': r.slaBacklogDays !== null ? r.slaBacklogDays : '',
      'SLA duration (Backlog)': r.slaBacklogDuration,
      // On-Target Tracker specific calculated columns
      'On-Target Status': r.onTargetStatus || '',
      'Committed Month (Target)': extractCellDate(r.committedMonth) || r.committedMonth || '',
      'Resolve Date': extractCellDate(r.resolved) || r.resolved || '',
      'Resolved Month': extractCellDate(r.resolvedMonth) || r.resolvedMonth || '',
      'Achieved': r.achieved || '',
    };

    // Include any other dynamic custom fields from rawRowData
    if (r.rawRowData) {
      Object.entries(r.rawRowData).forEach(([k, v]) => {
        if (!rowObj[k]) {
          rowObj[k] = v;
        }
      });
    }

    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData, { cellDates: true });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'CCF Complete Register');
  XLSX.writeFile(workbook, filename);
}

/**
 * Calculates External CCF KPI metrics for third-party vendors & systems,
 * including No Dev (80% target, 80% weight), Dev (80% target, 20% weight),
 * the 17-row monthly CFI Actual matrix, and per-owner CFI performance.
 */
export function calculateExternalKpiStats(
  rows: TranslatedCcfRow[],
  allocations?: UserAllocation[]
): ExternalKpiStats {
  const totalExternalCases = rows.length;

  const exceedLevel2027Count = rows.filter((r) => r.caseHorizon2026 === '2027 Exceed Level').length;
  const eligible2026Count = rows.filter((r) => r.caseHorizon2026 === 'Eligible 2026').length;

  const activeRows = rows.filter((r) => {
    const st = normalizeStatus(r.status);
    if (st === 'not started' || st === 'new' || st === 'cancelled' || st === 'canceled') return false;
    if (r.caseHorizon2026 === '2027 Exceed Level') return false;
    return true;
  });

  let withinSlaCount = 0;
  let inProgressCount = 0;
  let completedCount = 0;

  // Initial active totals
  let initialNoDevTotalCount = 0;
  let initialNoDevWithinSlaCount = 0;

  let initialDevTotalCount = 0;
  let initialDevWithinSlaCount = 0;

  const partnerMap: Record<string, { total: number; withinSla: number }> = {};

  activeRows.forEach((r) => {
    const isWithinSla =
      r.noDevSla === 'Within SLA' ||
      r.withDevSla === 'Within SLA' ||
      r.slaDuration === '90' ||
      r.slaProgressStatus === 'Within 90' ||
      (r.slaDays !== null && r.slaDays <= 90);

    if (isWithinSla) withinSlaCount++;

    const s = normalizeStatus(r.status);
    if (s === 'in progress') inProgressCount++;
    else if (s === 'completed' || s === 'closed' || s === 'for monitoring' || s === 'for-monitoring' || s === 'complete') completedCount++;

    if (r.normalizedDevRequired === 'No') {
      initialNoDevTotalCount++;
      if (r.noDevSla === 'Within SLA') initialNoDevWithinSlaCount++;
    } else if (r.normalizedDevRequired === 'Yes') {
      initialDevTotalCount++;
      if (r.withDevSla === 'Within SLA') initialDevWithinSlaCount++;
    }

    const partner = r.assignee || 'General Vendor';
    if (!partnerMap[partner]) {
      partnerMap[partner] = { total: 0, withinSla: 0 };
    }
    partnerMap[partner].total++;
    if (isWithinSla) partnerMap[partner].withinSla++;
  });

  const externalSlaPct = totalExternalCases > 0 ? Math.round((withinSlaCount / totalExternalCases) * 100) : 0;
  const initialNoDevOverallPct = initialNoDevTotalCount > 0 ? Math.round((initialNoDevWithinSlaCount / initialNoDevTotalCount) * 100) : 0;
  const initialDevOverallPct = initialDevTotalCount > 0 ? Math.round((initialDevWithinSlaCount / initialDevTotalCount) * 100) : 0;
  const initialOverallCfiScore = Number((initialNoDevOverallPct + (initialDevOverallPct / 80 * 20)).toFixed(2));

  // 17-Row CFI Monthly Matrix Calculation (matching the user's Excel model)
  const glideTargets = [50, 54, 58, 62, 66, 70, 74, 78, 82, 86, 88, 90];
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsFull = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  function getRowMonthIndex(r: TranslatedCcfRow): number {
    if (r.month2026 && r.month2026 !== '-') {
      const s = r.month2026.trim().toLowerCase();
      const idxFull = monthsFull.findIndex((m) => m.toLowerCase() === s);
      if (idxFull !== -1) return idxFull;
      const idxShort = monthsShort.findIndex((m) => m.toLowerCase() === s);
      if (idxShort !== -1) return idxShort;
    }
    if (r.createdYear === 2026 && r.created) {
      const d = parseDateFlexible(r.created);
      if (d) return d.getUTCMonth();
    }
    return -1;
  }

  // Dynamic cumulative calculation per user specification
  const monthlyData: ExternalMonthlyCfiRow[] = monthsShort.map((mShort, idx) => {
    const mFull = monthsFull[idx];

    // Cumulative eligible rows up to month idx
    const cumulativeRows = activeRows.filter((r) => {
      if (r.externalTrackerStatus === 'Backlog') return true;
      const mIdx = getRowMonthIndex(r);
      return mIdx !== -1 && mIdx <= idx;
    });

    const noDev = cumulativeRows.filter((r) => r.normalizedDevRequired === 'No');
    const dev = cumulativeRows.filter((r) => r.normalizedDevRequired === 'Yes');

    const noDevCount = noDev.length;
    const noDevWithinSla = noDev.filter((r) => r.noDevSla === 'Within SLA').length;
    const noDevOutsideSla = noDev.filter((r) => r.noDevSla === 'Outside SLA').length;
    const noDevUnresolved = Math.max(0, noDevCount - noDevWithinSla - noDevOutsideSla);

    const devCount = dev.length;
    const devWithinSla = dev.filter((r) => r.withDevSla === 'Within SLA').length;
    const devOutsideSla = dev.filter((r) => r.withDevSla === 'Outside SLA').length;
    const devUnresolved = Math.max(0, devCount - devWithinSla - devOutsideSla);

    const noDevRatio = noDevCount > 0 ? (noDevWithinSla / noDevCount) : 0;
    const devRatio = devCount > 0 ? (devWithinSla / devCount) : 0;

    const noDevPct = Math.round(noDevRatio * 100);
    const devPct = Math.round(devRatio * 100);

    const noDevScorePart = (noDevRatio / 0.80) * 0.80;
    const devScorePart = (devRatio / 0.80) * 0.20;
    const totalCfiPct = Number(((noDevScorePart + devScorePart) * 100).toFixed(2));
    const glidePct = glideTargets[idx];
    const totalCases = noDevCount + devCount;

    const forMonitoringCompleted = noDevWithinSla + noDevOutsideSla + devWithinSla + devOutsideSla;
    const activeCases = noDevUnresolved + devUnresolved;
    const pctClosed = totalCases > 0 ? Math.round((forMonitoringCompleted / totalCases) * 100) : 0;

    return {
      month: mShort,
      fullMonthName: mFull,
      noDevPct,
      noDevCount,
      noDevWithinSla,
      noDevOutsideSla,
      noDevUnresolved,
      devPct,
      devCount,
      devWithinSla,
      devOutsideSla,
      devUnresolved,
      totalCfiPct,
      glidePct,
      totalCases,
      forMonitoringCompleted,
      activeCases,
      pctClosed,
    };
  });

  const avgNoDevCount = monthlyData.reduce((acc, m) => acc + m.noDevCount, 0) / 12;
  const avgDevCount = monthlyData.reduce((acc, m) => acc + m.devCount, 0) / 12;
  const totalAvgCount = avgNoDevCount + avgDevCount;
  const rawNoDevCont = totalAvgCount > 0 ? (avgNoDevCount / totalAvgCount) * 100 : 46.2;
  const noDevContPct = Number(rawNoDevCont.toFixed(1));
  const devContPct = Number((100 - noDevContPct).toFixed(1));

  const latestMonth = monthlyData[monthlyData.length - 1];
  const overallCfiScore = latestMonth ? latestMonth.totalCfiPct : 0;
  const noDevTotalCount = latestMonth ? latestMonth.noDevCount : 0;
  const noDevWithinSlaCount = latestMonth ? latestMonth.noDevWithinSla : 0;
  const noDevOverallPct = latestMonth ? latestMonth.noDevPct : 0;
  const devTotalCount = latestMonth ? latestMonth.devCount : 0;
  const devWithinSlaCount = latestMonth ? latestMonth.devWithinSla : 0;
  const devOverallPct = latestMonth ? latestMonth.devPct : 0;

  // Build lookup map for user allocations (Owner display name, short assignee key, HOD)
  const allocLookup = new Map<string, UserAllocation>();
  const effectiveAllocs = allocations && allocations.length > 0 ? allocations : DEFAULT_USER_ALLOCATIONS;
  effectiveAllocs.forEach((alloc) => {
    allocLookup.set(alloc.owner.toLowerCase().trim(), alloc);
    allocLookup.set(alloc.assignee.toLowerCase().trim(), alloc);
  });

  const resolveOwnerDetails = (rawAssignee?: string, rawHod?: string) => {
    const clean = String(rawAssignee || '').trim();
    const matched = allocLookup.get(clean.toLowerCase());
    if (matched) {
      return { owner: matched.owner, assignee: matched.assignee, hod: matched.hod };
    }
    return {
      owner: clean || 'Unassigned',
      assignee: clean || 'unassigned',
      hod: rawHod || 'General',
    };
  };

  // Group eligible active cases by Owner
  const ownerMap: Record<string, {
    owner: string;
    assignee: string;
    hod: string;
    noDevCount: number;
    noDevWithinSla: number;
    noDevOutsideSla: number;
    devCount: number;
    devWithinSla: number;
    devOutsideSla: number;
    totalCases: number;
  }> = {};

  // Pre-populate with known allocations so configured owners are recognized
  effectiveAllocs.forEach((alloc) => {
    ownerMap[alloc.owner] = {
      owner: alloc.owner,
      assignee: alloc.assignee,
      hod: alloc.hod,
      noDevCount: 0,
      noDevWithinSla: 0,
      noDevOutsideSla: 0,
      devCount: 0,
      devWithinSla: 0,
      devOutsideSla: 0,
      totalCases: 0,
    };
  });

  activeRows.forEach((r) => {
    const { owner, assignee, hod } = resolveOwnerDetails(r.assignee, r.hod || r.assigneeTeam);
    if (!ownerMap[owner]) {
      ownerMap[owner] = {
        owner,
        assignee,
        hod,
        noDevCount: 0,
        noDevWithinSla: 0,
        noDevOutsideSla: 0,
        devCount: 0,
        devWithinSla: 0,
        devOutsideSla: 0,
        totalCases: 0,
      };
    }
    ownerMap[owner].totalCases++;

    const isNoDev = r.normalizedDevRequired === 'No';
    const isDev = r.normalizedDevRequired === 'Yes';

    if (isNoDev) {
      ownerMap[owner].noDevCount++;
      if (r.noDevSla === 'Within SLA') {
        ownerMap[owner].noDevWithinSla++;
      } else {
        ownerMap[owner].noDevOutsideSla++;
      }
    } else if (isDev) {
      ownerMap[owner].devCount++;
      if (r.withDevSla === 'Within SLA') {
        ownerMap[owner].devWithinSla++;
      } else {
        ownerMap[owner].devOutsideSla++;
      }
    }
  });

  // Calculate percentages and CFI Index with 80% No Dev Weight and 20% Dev Weight
  // Formula: ((NoDev% / 80) * 80) + ((Dev% / 80) * 20) = NoDev% + (Dev% / 80 * 20)
  // Example from user screenshot: Rajput, Preksha has 100% No Dev and 96% Dev -> 100 + 24 = 124%!
  const ownerBreakdown: ExternalOwnerCfiSummary[] = Object.values(ownerMap)
    .filter((o) => o.totalCases > 0)
    .map((o) => {
      const noDevPct = o.noDevCount > 0 ? Math.round((o.noDevWithinSla / o.noDevCount) * 100) : 0;
      const devPct = o.devCount > 0 ? Math.round((o.devWithinSla / o.devCount) * 100) : 0;

      let totalCfiPct = 0;
      if (o.noDevCount > 0 && o.devCount > 0) {
        totalCfiPct = Math.round(noDevPct + (devPct / 80) * 20);
      } else if (o.noDevCount > 0) {
        totalCfiPct = Math.round((noDevPct / 80) * 100);
      } else if (o.devCount > 0) {
        totalCfiPct = Math.round((devPct / 80) * 100);
      }

      return {
        ...o,
        rank: 0,
        noDevPct,
        devPct,
        totalCfiPct,
      };
    })
    .sort((a, b) => {
      if (b.totalCfiPct !== a.totalCfiPct) return b.totalCfiPct - a.totalCfiPct;
      return b.totalCases - a.totalCases;
    })
    .map((o, idx) => ({
      ...o,
      rank: idx + 1,
    }));

  // Group by HOD
  const hodMap: Record<string, {
    hod: string;
    owners: Set<string>;
    noDevCount: number;
    noDevWithinSla: number;
    noDevOutsideSla: number;
    devCount: number;
    devWithinSla: number;
    devOutsideSla: number;
    totalCases: number;
  }> = {};

  ownerBreakdown.forEach((o) => {
    const h = o.hod || 'General';
    if (!hodMap[h]) {
      hodMap[h] = {
        hod: h,
        owners: new Set<string>(),
        noDevCount: 0,
        noDevWithinSla: 0,
        noDevOutsideSla: 0,
        devCount: 0,
        devWithinSla: 0,
        devOutsideSla: 0,
        totalCases: 0,
      };
    }
    hodMap[h].owners.add(o.owner);
    hodMap[h].noDevCount += o.noDevCount;
    hodMap[h].noDevWithinSla += o.noDevWithinSla;
    hodMap[h].noDevOutsideSla += o.noDevOutsideSla;
    hodMap[h].devCount += o.devCount;
    hodMap[h].devWithinSla += o.devWithinSla;
    hodMap[h].devOutsideSla += o.devOutsideSla;
    hodMap[h].totalCases += o.totalCases;
  });

  const hodBreakdown: ExternalHodCfiSummary[] = Object.values(hodMap)
    .filter((h) => h.totalCases > 0)
    .map((h) => {
      const noDevPct = h.noDevCount > 0 ? Math.round((h.noDevWithinSla / h.noDevCount) * 100) : 0;
      const devPct = h.devCount > 0 ? Math.round((h.devWithinSla / h.devCount) * 100) : 0;

      let totalCfiPct = 0;
      if (h.noDevCount > 0 && h.devCount > 0) {
        totalCfiPct = Math.round(noDevPct + (devPct / 80) * 20);
      } else if (h.noDevCount > 0) {
        totalCfiPct = Math.round((noDevPct / 80) * 100);
      } else if (h.devCount > 0) {
        totalCfiPct = Math.round((devPct / 80) * 100);
      }

      return {
        hod: h.hod,
        ownerCount: h.owners.size,
        rank: 0,
        noDevCount: h.noDevCount,
        noDevWithinSla: h.noDevWithinSla,
        noDevOutsideSla: h.noDevOutsideSla,
        noDevPct,
        devCount: h.devCount,
        devWithinSla: h.devWithinSla,
        devOutsideSla: h.devOutsideSla,
        devPct,
        totalCases: h.totalCases,
        totalCfiPct,
      };
    })
    .sort((a, b) => {
      if (b.totalCfiPct !== a.totalCfiPct) return b.totalCfiPct - a.totalCfiPct;
      return b.totalCases - a.totalCases;
    })
    .map((h, idx) => ({
      ...h,
      rank: idx + 1,
    }));

  const partnerBreakdown = Object.entries(partnerMap)
    .map(([partner, data]) => ({
      partner,
      total: data.total,
      withinSla: data.withinSla,
      slaPct: data.total > 0 ? Math.round((data.withinSla / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.slaPct - a.slaPct);

  return {
    totalExternalCases,
    exceedLevel2027Count,
    eligible2026Count,
    withinSlaCount,
    externalSlaPct,
    inProgressCount,
    completedCount,
    targetIndex: 80,
    noDevTotalCount,
    noDevWithinSlaCount,
    noDevOverallPct,
    noDevContPct,
    devTotalCount,
    devWithinSlaCount,
    devOverallPct,
    devContPct,
    overallCfiScore,
    monthlyData,
    ownerBreakdown,
    hodBreakdown,
    partnerBreakdown,
  };
}

