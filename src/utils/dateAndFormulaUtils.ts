/**
 * Utility functions for CCF Date parsing, End-of-Month calculations,
 * and SLA formulas according to the specified business rules.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, spe: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Robust extraction of the year from any date representation, string, or number.
 * Guarantees that 2026 cases are NEVER missed.
 */
export function extractYearFromValue(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;

  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    return isNaN(y) ? null : y;
  }

  // Excel serial date number
  if (typeof val === 'number') {
    // Excel base date: Dec 30 1899
    const utcDays = Math.floor(val - 25569);
    const dateInfo = new Date(utcDays * 86400 * 1000);
    if (!isNaN(dateInfo.getUTCFullYear())) {
      return dateInfo.getUTCFullYear();
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // Direct regex search for 4-digit years
  const yearMatch = str.match(/\b(202\d|201\d|203\d)\b/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10);
  }

  // Check for 2-digit years with slash/dash/dot: e.g. 01/10/26, 1-10-26, 26-Oct-26
  const twoDigitEnd = str.match(/[/\-.](\d{2})(?:\s+|$)/);
  if (twoDigitEnd) {
    const yy = parseInt(twoDigitEnd[1], 10);
    return yy < 70 ? 2000 + yy : 1900 + yy;
  }

  // Check for arrow format e.g. "Oct -> 2026" or "Sep -> 26"
  const arrowMatch = str.match(/(?:->|-|>)\s*(\d{2,4})/);
  if (arrowMatch) {
    let yy = parseInt(arrowMatch[1], 10);
    if (yy < 100) yy += 2000;
    return yy;
  }

  // Fallback to parseDateFlexible
  const parsed = parseDateFlexible(val);
  return parsed ? parsed.getUTCFullYear() : null;
}

/**
 * Flexible date parser for various formats from Jira / Excel exports:
 * - "01/10/2026 9:15" (DD/MM/YYYY or MM/DD/YYYY)
 * - "01/10/26 9:15"
 * - "01/Oct/26" or "01-Oct-2026"
 * - "2026-10-01"
 * - "Oct -> 2026"
 * - Excel serial numbers
 */
export function parseDateFlexible(val: unknown): Date | null {
  if (val === null || val === undefined || val === '') return null;

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // Excel serial date number
  if (typeof val === 'number') {
    const utcDays = Math.floor(val - 25569);
    const dateInfo = new Date(utcDays * 86400 * 1000);
    return isNaN(dateInfo.getTime()) ? null : dateInfo;
  }

  const str = String(val).trim();
  if (!str) return null;

  // 1. Month-Year: "DEC24", "Jan25", "June26", "Sep26", "May26", "Oct-25", "Oct-26", "Oct-24", "Sep.26", "May.5", "Dec.5"
  const mMonthYear = str.match(/^([a-zA-Z]{3,})[\.\-/_\s]*(\d{1,4})$/);
  if (mMonthYear) {
    const monthStr = mMonthYear[1].toLowerCase().slice(0, 3);
    const mIdx = MONTH_MAP[monthStr];
    if (mIdx !== undefined) {
      let year = parseInt(mMonthYear[2], 10);
      if (year < 10) year += 2020; // e.g. 5 -> 2025, 6 -> 2026
      else if (year < 100) year += 2000; // e.g. 24 -> 2024, 25 -> 2025, 26 -> 2026
      return new Date(Date.UTC(year, mIdx, 1));
    }
  }

  // 2. Year-Month: "2025.Oct", "25.Oct", "2026-Sep", "26Sep"
  const mYearMonth = str.match(/^(\d{1,4})[\.\-/_\s]*([a-zA-Z]{3,})$/);
  if (mYearMonth) {
    const monthStr = mYearMonth[2].toLowerCase().slice(0, 3);
    const mIdx = MONTH_MAP[monthStr];
    if (mIdx !== undefined) {
      let year = parseInt(mYearMonth[1], 10);
      if (year < 10) year += 2020;
      else if (year < 100) year += 2000;
      return new Date(Date.UTC(year, mIdx, 1));
    }
  }

  // 3. Arrow format: "Oct -> 2026", "Sep -> 2026", "Oct -> 26", "Oct -> 25"
  const arrowMatch = str.match(/^([a-zA-Z]{3,})\s*(?:->|>)\s*(\d{2,4})$/);
  if (arrowMatch) {
    const monthStr = arrowMatch[1].toLowerCase().slice(0, 3);
    let year = parseInt(arrowMatch[2], 10);
    if (year < 10) year += 2020;
    else if (year < 100) year += 2000;
    const month = MONTH_MAP[monthStr];
    if (month !== undefined) {
      return new Date(Date.UTC(year, month, 1));
    }
  }

  // 4. Standalone Month Name ONLY (strictly letters only, e.g. "October", "Oct", "January", "Jan")
  if (/^[a-zA-Z]{3,}$/.test(str.trim())) {
    const cleanLower = str.toLowerCase().trim().slice(0, 3);
    const monthIdx = MONTH_MAP[cleanLower];
    if (monthIdx !== undefined) {
      return new Date(Date.UTC(2026, monthIdx, 1));
    }
  }

  // Format: "12-Jan-2026 06:59:00 PM", "12-Jan-2026 13:59", "01/Oct/26", "2-June-2026", "2 June 2026"
  const textMonthMatch = str.match(
    /^(\d{1,2})[/\-\s]+([a-zA-Z]{3,})[/\-\s]+(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?(?:\s*(AM|PM))?/i
  );
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10);
    const monthStr = textMonthMatch[2].toLowerCase().slice(0, 3);
    let year = parseInt(textMonthMatch[3], 10);
    if (year < 100) year += 2000;
    const month = MONTH_MAP[monthStr];
    if (month !== undefined) {
      let hour = textMonthMatch[4] ? parseInt(textMonthMatch[4], 10) : 0;
      const min = textMonthMatch[5] ? parseInt(textMonthMatch[5], 10) : 0;
      const sec = textMonthMatch[6] ? parseInt(textMonthMatch[6], 10) : 0;
      const ampm = textMonthMatch[7]?.toUpperCase();
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      return new Date(Date.UTC(year, month, day, hour, min, sec));
    }
  }

  // Format: "June 2, 2026", "Jun 02 2026"
  const monthFirstMatch = str.match(
    /^([a-zA-Z]{3,})[/\-\s]+(\d{1,2}),?[/\-\s]+(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?(?:\s*(AM|PM))?/i
  );
  if (monthFirstMatch) {
    const monthStr = monthFirstMatch[1].toLowerCase().slice(0, 3);
    const day = parseInt(monthFirstMatch[2], 10);
    let year = parseInt(monthFirstMatch[3], 10);
    if (year < 100) year += 2000;
    const month = MONTH_MAP[monthStr];
    if (month !== undefined) {
      let hour = monthFirstMatch[4] ? parseInt(monthFirstMatch[4], 10) : 0;
      const min = monthFirstMatch[5] ? parseInt(monthFirstMatch[5], 10) : 0;
      const sec = monthFirstMatch[6] ? parseInt(monthFirstMatch[6], 10) : 0;
      const ampm = monthFirstMatch[7]?.toUpperCase();
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      return new Date(Date.UTC(year, month, day, hour, min, sec));
    }
  }

  // Format: "Sep-26" or "Sep-2026"
  const shortMonthYear = str.match(/^([a-zA-Z]{3,})[-/](\d{2,4})$/);
  if (shortMonthYear) {
    const monthStr = shortMonthYear[1].toLowerCase().slice(0, 3);
    let year = parseInt(shortMonthYear[2], 10);
    if (year < 100) year += 2000;
    const month = MONTH_MAP[monthStr];
    if (month !== undefined) {
      return new Date(Date.UTC(year, month, 1));
    }
  }

  // Format: "Month YYYY", e.g. "October 2026", "Oct 2026"
  const monthSpaceYear = str.match(/^([a-zA-Z]{3,})\s+(\d{2,4})$/);
  if (monthSpaceYear) {
    const monthStr = monthSpaceYear[1].toLowerCase().slice(0, 3);
    let year = parseInt(monthSpaceYear[2], 10);
    if (year < 100) year += 2000;
    const month = MONTH_MAP[monthStr];
    if (month !== undefined) {
      return new Date(Date.UTC(year, month, 1));
    }
  }

  // Format: Single month name e.g. "October", "January", "Oct", "Jan"
  const singleMonthMatch = str.match(/^([a-zA-Z]{3,})$/);
  if (singleMonthMatch) {
    const monthStr = singleMonthMatch[1].toLowerCase().slice(0, 3);
    const month = MONTH_MAP[monthStr];
    if (month !== undefined) {
      return new Date(Date.UTC(2026, month, 1));
    }
  }

  // Format: "YYYY-MM" or "YYYY/MM"
  const yearMonthOnly = str.match(/^(\d{4})[/-](\d{1,2})$/);
  if (yearMonthOnly) {
    const year = parseInt(yearMonthOnly[1], 10);
    const month = parseInt(yearMonthOnly[2], 10) - 1;
    if (month >= 0 && month <= 11) {
      return new Date(Date.UTC(year, month, 1));
    }
  }

  // Format: "06/01/2026 1:25:00 PM" or "22/04/2025 04:00 AM" or "22-04-2025 04:00 AM"
  const us12hMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (us12hMatch) {
    const p1 = parseInt(us12hMatch[1], 10);
    const p2 = parseInt(us12hMatch[2], 10);
    let year = parseInt(us12hMatch[3], 10);
    if (year < 100) year += 2000;
    let hour = parseInt(us12hMatch[4], 10);
    const minute = parseInt(us12hMatch[5], 10);
    const second = us12hMatch[6] ? parseInt(us12hMatch[6], 10) : 0;
    const isPm = us12hMatch[7].toUpperCase() === 'PM';

    if (isPm && hour < 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;

    let day = p1;
    let month = p2 - 1;
    if (p2 > 12 && p1 <= 12) {
      day = p2;
      month = p1 - 1;
    }
    const safeMonth = Math.max(0, Math.min(11, month));
    return new Date(Date.UTC(year, safeMonth, day, hour, minute, second));
  }

  // Format: JavaScript Date string e.g. "Mon Feb 02 2026 00:00:00 GMT-0500 (Eastern Standard Time)"
  const jsDateMatch = str.match(
    /^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/
  );
  if (jsDateMatch) {
    const monthName = jsDateMatch[1].toLowerCase();
    const month = MONTH_MAP[monthName] !== undefined ? MONTH_MAP[monthName] : 0;
    const day = parseInt(jsDateMatch[2], 10);
    const year = parseInt(jsDateMatch[3], 10);
    const hour = parseInt(jsDateMatch[4], 10);
    const minute = parseInt(jsDateMatch[5], 10);
    const second = parseInt(jsDateMatch[6], 10);
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  // Format: "01/10/2026 9:15", "01/10/26", "01-10-2026", "01/04/2023", "01.04.2023", "01-04-2023"
  const slashMatch = str.match(/^(\d{1,2})[\.\-/](\d{1,2})[\.\-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (slashMatch) {
    const part1 = parseInt(slashMatch[1], 10);
    const part2 = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);
    if (year < 100) year += 2000;
    const hour = slashMatch[4] ? parseInt(slashMatch[4], 10) : 0;
    const minute = slashMatch[5] ? parseInt(slashMatch[5], 10) : 0;

    let day = part1;
    let month = part2 - 1;
    if (part2 > 12 && part1 <= 12) {
      day = part2;
      month = part1 - 1;
    }
    const safeMonth = Math.max(0, Math.min(11, month));
    return new Date(Date.UTC(year, safeMonth, day, hour, minute));
  }

  // Two-part numeric format: "01/23", "01.23", "04/23", "01/24", "01/25", "02/25", "09/26", "10/26", "04/2023"
  // Prevents JavaScript Date from misinterpreting "01/23" or "01.23" as year 2001
  const twoPartNumeric = str.match(/^(\d{1,2})[\.\-/](\d{2,4})$/);
  if (twoPartNumeric) {
    const p1 = parseInt(twoPartNumeric[1], 10);
    const p2 = parseInt(twoPartNumeric[2], 10);
    let m = -1;
    let y = 2026;

    if (p1 > 12 && p2 <= 12) {
      y = p1 < 100 ? 2000 + p1 : p1;
      m = p2 - 1;
    } else if (p2 >= 2000) {
      m = p1 - 1;
      y = p2;
    } else if (p2 >= 20 && p2 <= 30) {
      m = p1 - 1;
      y = 2000 + p2;
    } else if (p2 >= 3 && p2 <= 9) {
      m = p1 - 1;
      y = 2020 + p2;
    } else if (p1 >= 1 && p1 <= 12) {
      m = p1 - 1;
      y = p2 < 100 ? 2000 + p2 : p2;
    }

    if (m >= 0 && m <= 11) {
      return new Date(Date.UTC(y, m, 1));
    }
  }

  // Format: ISO "2026-10-01" or "2026/10/01"
  const isoMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const hour = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
    const minute = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
    return new Date(Date.UTC(year, month, day, hour, minute));
  }

  // Standard fallback (strictly constrained to enterprise CCF range: 2015 to 2035; NEVER year 2001)
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const yr = parsed.getUTCFullYear();
    if (yr >= 2015 && yr <= 2035) {
      return parsed;
    }
  }

  return null;
}

/**
 * Formats any date, timestamp, or JavaScript Date string representation to
 * International format:
 * - With time (only for Created and Updated): "DD-MMM-YYYY h:mm:ss A" (e.g. "12-Jan-2026 6:59:00 PM")
 * - Without time (for all other date columns): "DD-MMM-YYYY" (e.g. "03-Feb-2026")
 */
export function formatDateTime12h(val: unknown, includeTime: boolean = false): string {
  if (val === null || val === undefined || val === '') return '-';

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '-') return '-';

    // Already in exact DD-MMM-YYYY format
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2}-[A-Za-z]{3}-\d{4})(?:\s+.*)?$/i);
    if (ddmmyyyyMatch) {
      if (!includeTime) {
        return ddmmyyyyMatch[1];
      }
      if (trimmed.includes(':')) {
        return trimmed;
      }
    }

    // Direct check for JavaScript Date string (Image 1):
    // "Mon Feb 02 2026 00:00:00 GMT-0500 (Eastern Standard Time)"
    const jsDateMatch = trimmed.match(
      /^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/
    );
    if (jsDateMatch) {
      const monthStr = jsDateMatch[1].toLowerCase();
      const monthNum = MONTH_MAP[monthStr] !== undefined ? MONTH_MAP[monthStr] : 0;
      const monthName = MONTH_NAMES[monthNum];
      const day = String(parseInt(jsDateMatch[2], 10)).padStart(2, '0');
      const year = jsDateMatch[3];

      let hour = parseInt(jsDateMatch[4], 10);
      const minute = jsDateMatch[5];
      const second = jsDateMatch[6];
      const hasRealTime = !(hour === 0 && minute === '00' && second === '00');

      if (!includeTime || !hasRealTime) {
        return `${day}-${monthName}-${year}`;
      }

      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12 || 12;

      return `${day}-${monthName}-${year} ${hour}:${minute}:${second} ${ampm}`;
    }
  }

  // Parse Date object or flexible timestamp
  const date = val instanceof Date ? val : parseDateFlexible(val);
  if (!date || isNaN(date.getTime())) {
    return String(val);
  }

  const day = String(date.getUTCDate()).padStart(2, '0');
  const monthName = MONTH_NAMES[date.getUTCMonth()];
  const year = date.getUTCFullYear();

  const hasSourceTime = typeof val === 'string'
    ? (val.includes(':') || /am|pm/i.test(val))
    : (date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0);

  if (!includeTime || !hasSourceTime) {
    return `${day}-${monthName}-${year}`;
  }

  let hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return `${day}-${monthName}-${year} ${hours}:${minutes}:${seconds} ${ampm}`;
}

/**
 * Format a Date to "MMM-YY", e.g. "Oct-26"
 */
export function formatMonthYY(date: Date | null): string {
  if (!date) return '-';
  const month = MONTH_NAMES[date.getUTCMonth()];
  const yy = String(date.getUTCFullYear()).slice(-2);
  return `${month}-${yy}`;
}

/**
 * Format a Date to standard DD-MMM-YYYY, e.g. "30-Sep-2026"
 */
export function formatDdMmmYyyy(date: Date | null): string {
  if (!date) return '-';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = MONTH_NAMES[date.getUTCMonth()];
  const yyyy = date.getUTCFullYear();
  return `${day}-${month}-${yyyy}`;
}

/**
 * Calculates end date of the month for a given date or string
 */
export function getEndOfMonthDate(dateOrStr: Date | string | null): Date | null {
  if (!dateOrStr) return null;
  const date = dateOrStr instanceof Date ? dateOrStr : parseDateFlexible(dateOrStr);
  if (!date) return null;

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
}

/**
 * Normalizes committed month strings like "Oct -> 2026" or "Sep-26" to standard "MMM-YY"
 */
export function normalizeCommittedMonth(rawVal: unknown): string {
  if (!rawVal) return '-';
  const parsed = parseDateFlexible(rawVal);
  if (parsed) {
    return formatMonthYY(parsed);
  }
  return String(rawVal).trim();
}

/**
 * Calculate difference in calendar days between two dates: endDate - startDate
 * Matches Excel date subtraction: =INT(EndDate) - INT(StartDate)
 */
export function calculateDaysDifference(
  endDate: Date | null,
  startDate: Date | null,
  allowNegative: boolean = false
): number | null {
  if (!endDate || !startDate) return null;
  const utcStart = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
  const utcEnd = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
  const msDiff = utcEnd - utcStart;
  const days = Math.round(msDiff / (1000 * 60 * 60 * 24));
  return allowNegative ? days : Math.max(0, days);
}

/**
 * Determines if a column key or label represents one of the target date or month fields
 */
export function isDateOrMonthField(colKey: string, colLabel?: string): boolean {
  if (!colKey) return false;
  const k = colKey.toLowerCase().trim();
  const l = (colLabel || '').toLowerCase().trim();

  // Explicit non-date fields (days counts, durations, status, etc.)
  if (
    k.includes('days') ||
    k.includes('count') ||
    k.includes('duration') ||
    k.includes('status') ||
    k.includes('category') ||
    k.includes('group') ||
    l.includes('days') ||
    l.includes('count') ||
    l.includes('duration') ||
    l.includes('status')
  ) {
    return false;
  }

  // 1. Target Date Columns:
  // - Custom field (Monitoring Start Date)
  // - Custom field (Monitoring End Date)
  // - Custom field (Committed End Date)
  // - Custom field (Complaint Month)
  // - Custom field (Assigned Date)
  // - Custom field (In Progress Start Date)
  // - Created
  // - Updated
  const targetExactKeys = [
    'monitoringstartdate',
    'monitoringenddate',
    'committedenddate',
    'complaintmonth',
    'assigneddate',
    'inprogressstartdate',
    'created',
    'updated',
  ];

  if (targetExactKeys.includes(k)) return true;

  // 2. All additional extracted/uploaded dates & months:
  // Resolved, monthCompleted, monitoringMonth, createdMonth, committedMonth, etc.
  const additionalKeys = [
    'resolved',
    'resolveddate',
    'resolvedmonth',
    'monthcompleted',
    'monitoringmonth',
    'createdmonth',
    'createdmonthcompleted',
    'committedmonth',
    'committedmonthprogress',
    'committedstartdate',
    'committedenddatevalue',
    'month2026',
  ];

  if (additionalKeys.includes(k)) return true;

  // 3. Label matching for raw headers
  if (
    l.includes('monitoring start date') ||
    l.includes('monitoring end date') ||
    l.includes('committed end date') ||
    l.includes('committed start date') ||
    l.includes('complaint month') ||
    l.includes('assigned date') ||
    l.includes('in progress start date') ||
    l.includes('in progress date') ||
    l.includes('month completed') ||
    l.includes('monitoring month') ||
    l.includes('created month') ||
    l.includes('committed month') ||
    l.includes('resolved') ||
    l.includes('resolve date') ||
    k.includes('date') ||
    k.includes('month') ||
    l.includes('date') ||
    l.includes('month')
  ) {
    return true;
  }

  return false;
}

/**
 * Returns the specific date format category:
 * - 'timestamp': yyyy-mm-dd hh:mm:ss
 * - 'date': yyyy-mm-dd
 * - 'month': mmm-yy
 */
export function getDateCellType(colKey: string, colLabel?: string): 'timestamp' | 'date' | 'month' | null {
  if (!isDateOrMonthField(colKey, colLabel)) return null;

  const k = colKey.toLowerCase().trim();
  const l = (colLabel || '').toLowerCase().trim();

  // Timestamps: Created & Updated
  if (
    k === 'created' ||
    k === 'updated' ||
    k === 'datecreated' ||
    k === 'dateupdated' ||
    l === 'created' ||
    l === 'updated'
  ) {
    return 'timestamp';
  }

  // Month periods: Complaint Month, monthCompleted, monitoringMonth, createdMonth, committedMonth, etc.
  if (k.includes('month') || l.includes('month')) {
    return 'month';
  }

  // Pure dates
  return 'date';
}

/**
 * Robust extraction of a Date object from any cell value.
 * Supports strings, timestamps, JS Date strings, ISO dates, month names, Excel serial numbers.
 */
export function extractCellDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === '' || val === '-') return null;
  return parseDateFlexible(val);
}

