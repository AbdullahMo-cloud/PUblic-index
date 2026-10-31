import { parseDateFlexible, formatDateTime12h, formatMonthYY, formatDdMmmYyyy } from './dateAndFormulaUtils';

/**
 * Normalizes column keys and headers to detect whether a column represents
 * a Date, Timestamp, or Month field.
 */
export function isDateColumnKey(colKey: string, colLabel?: string): boolean {
  const norm = `${colKey} ${colLabel || ''}`.toLowerCase().replace(/[\-_()]/g, ' ').trim();

  // Exclude SLA days, numeric durations, and status labels
  if (
    norm.includes('sla days') ||
    norm.includes('count days') ||
    norm.includes('duration') ||
    norm.includes('status') ||
    norm.includes('sla count')
  ) {
    return false;
  }

  // Explicitly mentioned date fields requested by the user:
  // 1. Custom field (Monitoring Start Date)
  // 2. Custom field (Monitoring End Date)
  // 3. Custom field (Committed End Date)
  // 4. Custom field (Complaint Month)
  // 5. Custom field (Assigned Date)
  // 6. Custom field (In Progress Start Date)
  // 7. Created
  // 8. Updated
  if (
    norm.includes('monitoring start date') ||
    norm.includes('monitoring end date') ||
    norm.includes('committed end date') ||
    norm.includes('committed start date') ||
    norm.includes('complaint month') ||
    norm.includes('assigned date') ||
    norm.includes('in progress start date') ||
    norm.includes('in progress date') ||
    norm.includes('created') ||
    norm.includes('updated') ||
    norm.includes('resolved') ||
    norm.includes('resolution date') ||
    norm.includes('resolve date') ||
    norm.includes('actual date') ||
    norm.includes('target monitoring date') ||
    norm.includes('target committed date') ||
    norm.includes('month completed') ||
    norm.includes('monitoring month') ||
    norm.includes('created month') ||
    norm.includes('committed month') ||
    norm.includes('resolved month') ||
    norm.includes('month 2026')
  ) {
    return true;
  }

  // Internal keys
  if (
    colKey === 'monitoringStartDate' ||
    colKey === 'monitoringEndDate' ||
    colKey === 'committedStartDate' ||
    colKey === 'committedEndDate' ||
    colKey === 'committedEndDateValue' ||
    colKey === 'complaintMonth' ||
    colKey === 'assignedDate' ||
    colKey === 'inProgressStartDate' ||
    colKey === 'inProgressDate' ||
    colKey === 'created' ||
    colKey === 'updated' ||
    colKey === 'resolved' ||
    colKey === 'monthCompleted' ||
    colKey === 'monitoringMonth' ||
    colKey === 'createdMonth' ||
    colKey === 'committedMonth' ||
    colKey === 'resolvedMonth' ||
    colKey === 'month2026'
  ) {
    return true;
  }

  // Generic date keywords
  if (norm.includes('date') || norm.includes('timestamp')) {
    return true;
  }

  return false;
}

/**
 * Determines whether a date column should retain time (hh:mm:ss) or be date-only.
 * Created, Updated, and Resolved typically preserve time; operational target dates
 * and milestone dates are date-only.
 */
export function isDateTimeColumnKey(colKey: string, sampleVal?: unknown): boolean {
  const norm = colKey.toLowerCase().replace(/[\-_()]/g, ' ').trim();
  if (
    norm === 'created' ||
    norm === 'updated' ||
    norm === 'resolved' ||
    norm.includes('date created') ||
    norm.includes('date updated') ||
    norm.includes('date resolved') ||
    norm.includes('timestamp')
  ) {
    return true;
  }

  if (typeof sampleVal === 'string' && (sampleVal.includes(':') || /am|pm/i.test(sampleVal))) {
    return true;
  }

  return false;
}

/**
 * Determines whether a column is specifically a Month column (e.g. Complaint Month,
 * Month Completed, Committed Month).
 */
export function isMonthColumnKey(colKey: string, colLabel?: string): boolean {
  const norm = `${colKey} ${colLabel || ''}`.toLowerCase().trim();
  if (norm.includes('sla') || norm.includes('duration') || norm.includes('status')) return false;
  return (
    norm.includes('complaint month') ||
    norm.includes('month completed') ||
    norm.includes('monitoring month') ||
    norm.includes('committed month') ||
    norm.includes('created month') ||
    norm.includes('resolved month') ||
    norm.includes('month 2026') ||
    colKey === 'complaintMonth' ||
    colKey === 'monthCompleted' ||
    colKey === 'monitoringMonth' ||
    colKey === 'committedMonth' ||
    colKey === 'createdMonth' ||
    colKey === 'resolvedMonth' ||
    colKey === 'month2026'
  );
}

/**
 * Parse any cell value as a reliable JavaScript Date object.
 */
export function parseCellToDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === '' || val === '-') {
    return null;
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  return parseDateFlexible(val);
}

/**
 * Compare two cell values chronologically for Oldest to Newest or Newest to Oldest sorting.
 * Missing / blank / '-' values are gracefully sorted to the bottom.
 */
export function compareDatesChronological(valA: unknown, valB: unknown, sortAsc: boolean): number {
  const dateA = parseCellToDate(valA);
  const dateB = parseCellToDate(valB);

  // Both are missing / non-dates
  if (!dateA && !dateB) {
    const sA = String(valA ?? '').trim();
    const sB = String(valB ?? '').trim();
    return sortAsc ? sA.localeCompare(sB) : sB.localeCompare(sA);
  }

  // Push missing dates to the bottom
  if (!dateA) return 1;
  if (!dateB) return -1;

  const timeA = dateA.getTime();
  const timeB = dateB.getTime();

  if (timeA === timeB) return 0;
  return sortAsc ? timeA - timeB : timeB - timeA;
}

/**
 * Output format structure for ExcelJS cell values
 */
export interface ExcelDateCellOutput {
  value: Date | string | number | null;
  numFmt?: string;
  isDate: boolean;
  displayFormatted: string;
}

/**
 * Extracts and prepares cell values for native Excel writing:
 * - Real Date object (enabling Excel AutoFilter "Sort Oldest to Newest" & Date grouping hierarchy)
 * - Exact numFmt ('yyyy-mm-dd hh:mm:ss' or 'yyyy-mm-dd' or 'mmm-yy')
 */
export function getExcelTypedCell(
  rawVal: unknown,
  colKey: string,
  colLabel?: string,
  preferredDateFormat: 'YYYY-MM-DD' | 'DD-MMM-YYYY' = 'YYYY-MM-DD'
): ExcelDateCellOutput {
  if (rawVal === undefined || rawVal === null || rawVal === '' || rawVal === '-') {
    return {
      value: null,
      isDate: false,
      displayFormatted: '-',
    };
  }

  const isDateCol = isDateColumnKey(colKey, colLabel);
  const isMonthCol = isMonthColumnKey(colKey, colLabel);
  const parsedDate = parseCellToDate(rawVal);

  if (parsedDate && (isDateCol || isMonthCol)) {
    const hasTime = isDateTimeColumnKey(colKey, rawVal);

    if (isMonthCol) {
      // Month-only: normalize to 1st of that month in UTC
      const monthDate = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), 1, 0, 0, 0));
      return {
        value: monthDate,
        numFmt: 'mmm-yy',
        isDate: true,
        displayFormatted: formatMonthYY(monthDate),
      };
    }

    if (hasTime) {
      // Full timestamp: preserve time
      const excelFmt = preferredDateFormat === 'YYYY-MM-DD' ? 'yyyy-mm-dd hh:mm:ss' : 'dd-mmm-yyyy hh:mm:ss';
      return {
        value: parsedDate,
        numFmt: excelFmt,
        isDate: true,
        displayFormatted: formatDateTime12h(parsedDate, true),
      };
    } else {
      // Date-only: normalize to UTC midnight so day never shifts across timezones
      const dateOnly = new Date(
        Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), 0, 0, 0)
      );
      const excelFmt = preferredDateFormat === 'YYYY-MM-DD' ? 'yyyy-mm-dd' : 'dd-mmm-yyyy';
      return {
        value: dateOnly,
        numFmt: excelFmt,
        isDate: true,
        displayFormatted: preferredDateFormat === 'YYYY-MM-DD'
          ? `${dateOnly.getUTCFullYear()}-${String(dateOnly.getUTCMonth() + 1).padStart(2, '0')}-${String(dateOnly.getUTCDate()).padStart(2, '0')}`
          : formatDdMmmYyyy(dateOnly),
      };
    }
  }

  // Numeric fields (SLA days, backlog days, etc.)
  const strVal = String(rawVal).trim();
  const isNumericCol =
    colKey.toLowerCase().includes('days') ||
    colKey === 'slaBacklogDays' ||
    colKey === 'slaDays' ||
    colKey === 'externalSlaCountDays';

  if (isNumericCol) {
    const num = parseFloat(strVal);
    if (!isNaN(num)) {
      return {
        value: num,
        numFmt: '#,##0',
        isDate: false,
        displayFormatted: String(num),
      };
    }
  }

  return {
    value: strVal,
    isDate: false,
    displayFormatted: strVal,
  };
}
