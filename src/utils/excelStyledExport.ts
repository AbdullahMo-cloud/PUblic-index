import ExcelJS from 'exceljs';
import { TranslatedCcfRow } from '../types/ccf';
import { ColumnDefinition } from '../components/CcfDataTable';
import {
  formatDateTime12h,
  isDateOrMonthField,
  getDateCellType,
  extractCellDate,
} from './dateAndFormulaUtils';

export type TrackerType = '2026' | 'backlog' | 'on-target' | 'external' | 'compiled';

export interface SuperHeaderGroup {
  name: string;
  startCol: number; // 1-indexed
  endCol: number;   // 1-indexed
  bgColor: string;  // ARGB hex (e.g. 'FF1E293B')
  textColor: string;
}

/**
 * Maps cell values to display strings, cleaning up dates and nulls
 */
export function getExportCellValue(row: TranslatedCcfRow, colKey: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const direct = (row as any)[colKey];
  let val: unknown = direct;

  if (val === undefined || val === null || val === '') {
    if (row.rawRowData && row.rawRowData[colKey] !== undefined) {
      val = row.rawRowData[colKey];
    } else if (row.rawRowData) {
      const lower = colKey.toLowerCase().trim();
      for (const [k, v] of Object.entries(row.rawRowData)) {
        if (k.toLowerCase().trim() === lower) {
          val = v;
          break;
        }
      }
    }
  }

  if (val === undefined || val === null || val === '' || val === '-') {
    return '-';
  }

  const str = String(val).trim();
  if (!str || str === '-') return '-';

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
    'month2026',
    'externalSlaCountDays',
    'noDevSla',
    'withDevSla',
    'caseHorizon2026',
  ].includes(colKey);

  if (!isFormulaMonthCol) {
    if (
      str.includes('GMT') ||
      str.includes('(') ||
      /^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4}/.test(str) ||
      (/date|created|updated/i.test(colKey) && !colKey.toLowerCase().includes('month'))
    ) {
      const isTimePreserved = /^created$|^updated$|date\s*created|date\s*updated/i.test(colKey.trim());
      return formatDateTime12h(str, isTimePreserved);
    }
  }

  return str;
}

/**
 * Retrieves raw value from row or rawRowData before display string formatting
 */
export function getRawExportValue(row: TranslatedCcfRow, colKey: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const direct = (row as any)[colKey];
  if (direct !== undefined && direct !== null && direct !== '') return direct;
  if (row.rawRowData && row.rawRowData[colKey] !== undefined && row.rawRowData[colKey] !== '') {
    return row.rawRowData[colKey];
  }
  if (row.rawRowData) {
    const lower = colKey.toLowerCase().trim();
    for (const [k, v] of Object.entries(row.rawRowData)) {
      if (k.toLowerCase().trim() === lower && v !== undefined && v !== '') return v;
    }
  }
  return undefined;
}

/**
 * Determine theme color styling for column group based on tracker type
 */
export function getColumnGroupStyles(
  group: 'uploaded' | 'completed' | 'in_progress',
  trackerType: TrackerType
): {
  superHeaderLabel: string;
  superBgArgb: string;
  superTextArgb: string;
  headerBgArgb: string;
  headerTextArgb: string;
  cellBgArgb: string;
  htmlSuperBg: string;
  htmlSuperText: string;
  htmlHeaderBg: string;
  htmlHeaderText: string;
  htmlCellBg: string;
} {
  if (group === 'uploaded') {
    return {
      superHeaderLabel: '📋 UPLOADED RAW COLUMNS',
      superBgArgb: 'FF1E293B', // Slate 800
      superTextArgb: 'FFFFFFFF',
      headerBgArgb: 'FFF1F5F9', // Slate 100
      headerTextArgb: 'FF0F172A', // Slate 900
      cellBgArgb: 'FFFFFFFF',
      htmlSuperBg: '#1e293b',
      htmlSuperText: '#ffffff',
      htmlHeaderBg: '#f1f5f9',
      htmlHeaderText: '#0f172a',
      htmlCellBg: '#ffffff',
    };
  }

  if (trackerType === 'on-target') {
    return {
      superHeaderLabel: '🎯 ON-TARGET METHODOLOGY & ACHIEVED',
      superBgArgb: 'FF065F46', // Emerald 800
      superTextArgb: 'FFFFFFFF',
      headerBgArgb: 'FFD1FAE5', // Emerald 100
      headerTextArgb: 'FF064E3B', // Emerald 900
      cellBgArgb: 'FFECFDF5', // Emerald 50
      htmlSuperBg: '#065f46',
      htmlSuperText: '#ffffff',
      htmlHeaderBg: '#d1fae5',
      htmlHeaderText: '#064e3b',
      htmlCellBg: '#ecfdf5',
    };
  }

  if (trackerType === 'backlog') {
    return {
      superHeaderLabel: '📦 BACKLOG CCF SLA CALCULATION (180D SLA)',
      superBgArgb: 'FF92400E', // Amber 800
      superTextArgb: 'FFFFFFFF',
      headerBgArgb: 'FFFEF3C7', // Amber 100
      headerTextArgb: 'FF78350F', // Amber 900
      cellBgArgb: 'FFFFFBEB', // Amber 50
      htmlSuperBg: '#92400e',
      htmlSuperText: '#ffffff',
      htmlHeaderBg: '#fef3c7',
      htmlHeaderText: '#78350f',
      htmlCellBg: '#fffbeb',
    };
  }

  if (trackerType === 'external') {
    return {
      superHeaderLabel: '🌐 EXTERNAL CCF CALCULATION & VENDOR SLA',
      superBgArgb: 'FF075985', // Sky 800
      superTextArgb: 'FFFFFFFF',
      headerBgArgb: 'FFE0F2FE', // Sky 100
      headerTextArgb: 'FF0C4A6E', // Sky 900
      cellBgArgb: 'FFF0F9FF', // Sky 50
      htmlSuperBg: '#075985',
      htmlSuperText: '#ffffff',
      htmlHeaderBg: '#e0f2fe',
      htmlHeaderText: '#0c4a6e',
      htmlCellBg: '#f0f9ff',
    };
  }

  // 2026 or default
  if (group === 'in_progress') {
    return {
      superHeaderLabel: '⏳ IN PROGRESS CALCULATION (EOM / SLA)',
      superBgArgb: 'FF312E81', // Indigo 900
      superTextArgb: 'FFFFFFFF',
      headerBgArgb: 'FFE0E7FF', // Indigo 100
      headerTextArgb: 'FF1E1B4B', // Indigo 950
      cellBgArgb: 'FFEEF2FF', // Indigo 50
      htmlSuperBg: '#312e81',
      htmlSuperText: '#ffffff',
      htmlHeaderBg: '#e0e7ff',
      htmlHeaderText: '#1e1b4b',
      htmlCellBg: '#eef2ff',
    };
  }

  return {
    superHeaderLabel: '✅ COMPLETED CALCULATION (≤90D SLA)',
    superBgArgb: 'FF991B1B', // Red 800
    superTextArgb: 'FFFFFFFF',
    headerBgArgb: 'FFFEE2E2', // Red 100
    headerTextArgb: 'FF7F1D1D', // Red 900
    cellBgArgb: 'FFFEF2F2', // Red 50
    htmlSuperBg: '#991b1b',
    htmlSuperText: '#ffffff',
    htmlHeaderBg: '#fee2e2',
    htmlHeaderText: '#7f1d1d',
    htmlCellBg: '#fef2f2',
  };
}

/**
 * Determine custom cell formatting badge colors (SLA, Achieved, Status)
 */
export function getBadgeColors(
  colKey: string,
  val: string
): {
  bgArgb?: string;
  textArgb?: string;
  isBold?: boolean;
  htmlBg?: string;
  htmlText?: string;
} {
  const norm = String(val || '').trim().toLowerCase();

  // SLA Duration or Progress Status
  if (
    colKey === 'slaDuration' ||
    colKey === 'slaProgressStatus' ||
    colKey === 'noDevSla' ||
    colKey === 'withDevSla' ||
    colKey === 'slaBacklogDuration'
  ) {
    if (norm === '90' || norm === 'within 90' || norm === 'within sla' || norm === '180') {
      return {
        bgArgb: 'FFDCFCE7', // Emerald 100
        textArgb: 'FF15803D', // Emerald 700
        isBold: true,
        htmlBg: '#dcfce7',
        htmlText: '#15803d',
      };
    }
    if (norm === 'more than 90' || norm === 'beyond 90' || norm === 'outside sla' || norm === 'above 180') {
      return {
        bgArgb: 'FFFEE2E2', // Red 100
        textArgb: 'FFB91C1C', // Red 700
        isBold: true,
        htmlBg: '#fee2e2',
        htmlText: '#b91c1c',
      };
    }
  }

  // 2026 Case Horizon & Exceed Level badge
  if (colKey === 'caseHorizon2026') {
    if (norm === 'eligible 2026') {
      return {
        bgArgb: 'FFDCFCE7', // Emerald 100
        textArgb: 'FF15803D', // Emerald 700
        isBold: true,
        htmlBg: '#dcfce7',
        htmlText: '#15803d',
      };
    }
    if (norm === '2027 exceed level') {
      return {
        bgArgb: 'FFFEF3C7', // Amber 100
        textArgb: 'FFB45309', // Amber 700
        isBold: true,
        htmlBg: '#fef3c7',
        htmlText: '#b45309',
      };
    }
  }

  // 2026 Case Horizon
  if (colKey === 'caseHorizon2026') {
    if (norm === 'eligible 2026') {
      return {
        bgArgb: 'FFDCFCE7', // Emerald 100
        textArgb: 'FF15803D', // Emerald 700
        isBold: true,
        htmlBg: '#dcfce7',
        htmlText: '#15803d',
      };
    }
    if (norm === '2027 exceed level') {
      return {
        bgArgb: 'FFFEF3C7', // Amber 100
        textArgb: 'FFB45309', // Amber 700
        isBold: true,
        htmlBg: '#fef3c7',
        htmlText: '#b45309',
      };
    }
  }

  // Achieved (On-Target)
  if (colKey === 'achieved') {
    if (norm === 'yes') {
      return {
        bgArgb: 'FFDCFCE7',
        textArgb: 'FF15803D',
        isBold: true,
        htmlBg: '#dcfce7',
        htmlText: '#15803d',
      };
    }
    if (norm === 'no') {
      return {
        bgArgb: 'FFFEE2E2',
        textArgb: 'FFB91C1C',
        isBold: true,
        htmlBg: '#fee2e2',
        htmlText: '#b91c1c',
      };
    }
    if (norm === 'pending') {
      return {
        bgArgb: 'FFFEF3C7',
        textArgb: 'FFB45309',
        isBold: true,
        htmlBg: '#fef3c7',
        htmlText: '#b45309',
      };
    }
  }

  // Status highlights
  if (colKey === 'status') {
    if (norm === 'completed') {
      return {
        bgArgb: 'FFDCFCE7',
        textArgb: 'FF15803D',
        isBold: true,
        htmlBg: '#dcfce7',
        htmlText: '#15803d',
      };
    }
    if (norm === 'in progress') {
      return {
        bgArgb: 'FFE0E7FF',
        textArgb: 'FF3730A3',
        isBold: true,
        htmlBg: '#e0e7ff',
        htmlText: '#3730a3',
      };
    }
    if (norm === 'for monitoring') {
      return {
        bgArgb: 'FFFEF3C7',
        textArgb: 'FFB45309',
        isBold: true,
        htmlBg: '#fef3c7',
        htmlText: '#b45309',
      };
    }
    if (norm === 'under development') {
      return {
        bgArgb: 'FFF3E8FF',
        textArgb: 'FF6B21A8',
        isBold: true,
        htmlBg: '#f3e8ff',
        htmlText: '#6b21a8',
      };
    }
  }

  return {};
}

/**
 * Build Super Header Groups from columns
 */
function buildSuperHeaderGroups(
  columns: ColumnDefinition[],
  trackerType: TrackerType
): SuperHeaderGroup[] {
  const groups: SuperHeaderGroup[] = [];
  let currentGroup: 'uploaded' | 'completed' | 'in_progress' | null = null;
  let startCol = 1;

  columns.forEach((col, idx) => {
    const colGroup = col.group || 'uploaded';
    if (currentGroup === null) {
      currentGroup = colGroup;
      startCol = idx + 1;
    } else if (currentGroup !== colGroup) {
      // Close previous group
      const styles = getColumnGroupStyles(currentGroup, trackerType);
      groups.push({
        name: styles.superHeaderLabel,
        startCol,
        endCol: idx, // 1-indexed inclusive
        bgColor: styles.superBgArgb,
        textColor: styles.superTextArgb,
      });
      currentGroup = colGroup;
      startCol = idx + 1;
    }
  });

  if (currentGroup !== null) {
    const styles = getColumnGroupStyles(currentGroup, trackerType);
    groups.push({
      name: styles.superHeaderLabel,
      startCol,
      endCol: columns.length,
      bgColor: styles.superBgArgb,
      textColor: styles.superTextArgb,
    });
  }

  return groups;
}

/**
 * Populates a styled Excel worksheet with two-tier headers, category colors, and cell formats
 */
export function populateStyledWorksheet(
  worksheet: ExcelJS.Worksheet,
  rows: TranslatedCcfRow[],
  columns: ColumnDefinition[],
  trackerType: TrackerType,
  sheetTitle: string
) {
  // Set sheet view to show grid lines
  worksheet.views = [{ showGridLines: true }];

  const superGroups = buildSuperHeaderGroups(columns, trackerType);

  // Row 1: Category Super-Headers
  const superRow = worksheet.getRow(1);
  superRow.height = 26;

  columns.forEach((_, idx) => {
    const colIdx = idx + 1;
    const cell = superRow.getCell(colIdx);
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FF0F172A' } },
    };
  });

  superGroups.forEach((g) => {
    if (g.startCol === g.endCol) {
      const cell = superRow.getCell(g.startCol);
      cell.value = g.name;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: g.bgColor },
      };
      cell.font = {
        name: 'Segoe UI',
        size: 10,
        bold: true,
        color: { argb: g.textColor },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      worksheet.mergeCells(1, g.startCol, 1, g.endCol);
      const cell = superRow.getCell(g.startCol);
      cell.value = g.name;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: g.bgColor },
      };
      cell.font = {
        name: 'Segoe UI',
        size: 10,
        bold: true,
        color: { argb: g.textColor },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Apply fill to all merged cells
      for (let c = g.startCol; c <= g.endCol; c++) {
        const cCell = superRow.getCell(c);
        cCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: g.bgColor },
        };
      }
    }
  });

  // Row 2: Column Headers
  const headerRow = worksheet.getRow(2);
  headerRow.height = 24;

  columns.forEach((col, idx) => {
    const colIdx = idx + 1;
    const styles = getColumnGroupStyles(col.group || 'uploaded', trackerType);
    const cell = headerRow.getCell(colIdx);
    cell.value = col.label;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: styles.headerBgArgb },
    };
    cell.font = {
      name: 'Segoe UI',
      size: 9.5,
      bold: true,
      color: { argb: styles.headerTextArgb },
    };
    cell.alignment = {
      horizontal: col.key.includes('summary') || col.key.includes('description') ? 'left' : 'center',
      vertical: 'middle',
      wrapText: false,
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // Enable auto-filter on header row
  worksheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: columns.length },
  };

  // Populate Data Rows
  const colMaxLengths: number[] = columns.map((c) => Math.max(c.label.length, 12));

  rows.forEach((row, rowIdx) => {
    const excelRowNumber = rowIdx + 3;
    const dataRow = worksheet.getRow(excelRowNumber);
    dataRow.height = 20;

    columns.forEach((col, colIdx0) => {
      const colIdx = colIdx0 + 1;
      const cell = dataRow.getCell(colIdx);
      const displayVal = getExportCellValue(row, col.key);
      const dateType = getDateCellType(col.key, col.label);

      let cellValue: ExcelJS.CellValue = displayVal;

      if (dateType) {
        const rawVal = getRawExportValue(row, col.key);
        const parsedDate = extractCellDate(rawVal) || extractCellDate(displayVal);
        if (parsedDate && !isNaN(parsedDate.getTime()) && parsedDate.getUTCFullYear() >= 2015) {
          cellValue = parsedDate;
          if (dateType === 'timestamp') {
            cell.numFmt = 'yyyy-mm-dd hh:mm:ss';
          } else if (col.key === 'month2026') {
            cell.numFmt = 'mmmm';
          } else if (dateType === 'month') {
            cell.numFmt = 'mmm-yy';
          } else {
            cell.numFmt = 'yyyy-mm-dd';
          }
        } else {
          cellValue = displayVal || '-';
        }
      }

      cell.value = cellValue;

      const styles = getColumnGroupStyles(col.group || 'uploaded', trackerType);
      const badge = getBadgeColors(col.key, displayVal);

      // Determine cell background
      let cellBg = styles.cellBgArgb;
      if (col.group === 'uploaded' && rowIdx % 2 === 1) {
        cellBg = 'FFF8FAFC'; // Light slate alternating zebra
      }
      if (badge.bgArgb) {
        cellBg = badge.bgArgb;
      }

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: cellBg },
      };

      const fontColor = badge.textArgb || (styles.cellBgArgb !== 'FFFFFFFF' && styles.cellBgArgb !== 'FFF8FAFC' ? styles.headerTextArgb : 'FF334155');
      cell.font = {
        name: col.isFormula || col.key === 'issueKey' ? 'Consolas' : 'Segoe UI',
        size: 9,
        bold: Boolean(badge.isBold || col.key === 'issueKey'),
        color: { argb: fontColor },
      };

      // Alignment
      const isNumeric = col.key.toLowerCase().includes('days') || col.key === 'slaBacklogDays';
      const isDateOrMonth = Boolean(dateType) || /month|date|created|updated/i.test(col.key);
      cell.alignment = {
        horizontal: isNumeric ? 'right' : (isDateOrMonth || col.isFormula ? 'center' : 'left'),
        vertical: 'middle',
      };

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      // Track max length for column auto-sizing
      if (displayVal && displayVal !== '-') {
        colMaxLengths[colIdx0] = Math.max(colMaxLengths[colIdx0], Math.min(displayVal.length, 50));
      }
    });
  });

  // Set column widths
  columns.forEach((col, idx) => {
    const colIdx = idx + 1;
    let width = Math.min(Math.max(colMaxLengths[idx] + 4, 12), 48);
    if (col.key.toLowerCase().includes('summary')) width = 36;
    if (col.key.toLowerCase().includes('description')) width = 32;
    if (col.key === 'issueKey') width = 16;
    worksheet.getColumn(colIdx).width = width;
  });
}

/**
 * Export a styled Excel file for any tracker matching the app theme
 */
export async function exportTrackerStyledExcel(
  rows: TranslatedCcfRow[],
  columns: ColumnDefinition[],
  trackerType: TrackerType,
  sheetTitle: string,
  filename: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Change Factory Index';
  workbook.lastModifiedBy = 'Change Factory Index';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(sheetTitle.slice(0, 31));
  populateStyledWorksheet(worksheet, rows, columns, trackerType, sheetTitle);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate formatted HTML & plain-text table string for copy-paste theme
 */
export function generateCopyPasteTableData(
  rows: TranslatedCcfRow[],
  columns: ColumnDefinition[],
  trackerType: TrackerType,
  sheetTitle: string
): { html: string; text: string } {
  const superGroups = buildSuperHeaderGroups(columns, trackerType);

  // 1. Build HTML Table with rich inline styles (pasteable directly into Excel/PPT/Word with colors)
  let html = `<table style="border-collapse: collapse; font-family: Segoe UI, Arial, sans-serif; font-size: 11px; color: #1e293b;">\n`;

  // Super-Header Row
  html += `  <thead>\n    <tr style="height: 28px;">\n`;
  superGroups.forEach((g) => {
    const span = g.endCol - g.startCol + 1;
    const styles = getColumnGroupStyles(
      g.name.includes('UPLOADED')
        ? 'uploaded'
        : g.name.includes('IN PROGRESS')
        ? 'in_progress'
        : 'completed',
      trackerType
    );
    html += `      <th colspan="${span}" style="background-color: ${styles.htmlSuperBg}; color: ${styles.htmlSuperText}; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #0f172a; padding: 6px 12px; font-size: 11px; letter-spacing: 0.5px;">${g.name}</th>\n`;
  });
  html += `    </tr>\n`;

  // Column Headers Row
  html += `    <tr style="height: 26px;">\n`;
  columns.forEach((col) => {
    const styles = getColumnGroupStyles(col.group || 'uploaded', trackerType);
    html += `      <th style="background-color: ${styles.htmlHeaderBg}; color: ${styles.htmlHeaderText}; font-weight: bold; border: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; padding: 6px 10px; text-align: center; vertical-align: middle; white-space: nowrap;">${col.label}</th>\n`;
  });
  html += `    </tr>\n  </thead>\n`;

  // Data Rows
  html += `  <tbody>\n`;
  rows.forEach((row, rowIdx) => {
    const zebraBg = rowIdx % 2 === 1 ? '#f8fafc' : '#ffffff';
    html += `    <tr style="height: 22px;">\n`;
    columns.forEach((col) => {
      const val = getExportCellValue(row, col.key);
      const styles = getColumnGroupStyles(col.group || 'uploaded', trackerType);
      const badge = getBadgeColors(col.key, val);

      let cellBg = styles.htmlCellBg !== '#ffffff' ? styles.htmlCellBg : zebraBg;
      let textColor = styles.htmlHeaderText;
      let fontWeight = col.key === 'issueKey' ? 'bold' : 'normal';

      if (badge.htmlBg) {
        cellBg = badge.htmlBg;
        textColor = badge.htmlText || textColor;
        fontWeight = 'bold';
      }

      const isNumeric = col.key.toLowerCase().includes('days') || col.key === 'slaBacklogDays';
      const isCenter = col.isFormula || /month|date|created|updated|status/i.test(col.key);
      const align = isNumeric ? 'right' : (isCenter ? 'center' : 'left');

      html += `      <td style="background-color: ${cellBg}; color: ${textColor}; font-weight: ${fontWeight}; border: 1px solid #e2e8f0; padding: 4px 8px; text-align: ${align}; vertical-align: middle; white-space: nowrap;">${val}</td>\n`;
    });
    html += `    </tr>\n`;
  });
  html += `  </tbody>\n</table>`;

  // 2. Build Tab-Separated Plain Text (Fallback)
  let text = '';
  // Row 1: Super groups repeated or spaced
  text += columns.map((col) => {
    const s = getColumnGroupStyles(col.group || 'uploaded', trackerType);
    return s.superHeaderLabel;
  }).join('\t') + '\n';

  // Row 2: Headers
  text += columns.map((c) => c.label).join('\t') + '\n';

  // Rows 3+: Data
  rows.forEach((row) => {
    text += columns.map((c) => getExportCellValue(row, c.key)).join('\t') + '\n';
  });

  return { html, text };
}

/**
 * Copies the table to clipboard with full HTML formatting and colors
 */
export async function copyTableWithThemeToClipboard(
  rows: TranslatedCcfRow[],
  columns: ColumnDefinition[],
  trackerType: TrackerType,
  sheetTitle: string
): Promise<boolean> {
  const { html, text } = generateCopyPasteTableData(rows, columns, trackerType, sheetTitle);

  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const htmlBlob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([text], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        }),
      ]);
      return true;
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Clipboard write error:', err);
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Get standard uploaded columns arranged logically with key identifiers first
 */
export function getDefaultUploadedCols(sampleRow?: TranslatedCcfRow): ColumnDefinition[] {
  if (sampleRow && sampleRow.rawColumns && sampleRow.rawColumns.length > 0) {
    // Preserve sheet columns
    return sampleRow.rawColumns.map((colName) => ({
      key: colName,
      label: colName,
      isRaw: true,
      group: 'uploaded' as const,
      width: colName.toLowerCase().includes('summary') ? 'w-64' : 'w-36',
    }));
  }

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
}

export function get2026CalculatedCols(): ColumnDefinition[] {
  return [
    { key: 'createdMonth', label: 'Created Month', isFormula: true, group: 'completed' as const, width: 'w-28' },
    { key: 'createdMonthCompleted', label: 'Created Month (Completed)', isFormula: true, group: 'completed' as const, width: 'w-44' },
    { key: 'monthCompleted', label: 'Month Completed', isFormula: true, group: 'completed' as const, width: 'w-36' },
    { key: 'slaDays', label: 'SLA Days', isFormula: true, group: 'completed' as const, width: 'w-32' },
    { key: 'slaDuration', label: 'SLA Duration (≤90)', isFormula: true, group: 'completed' as const, width: 'w-36' },
    { key: 'committedMonth', label: 'Committed Month', isFormula: true, group: 'in_progress' as const, width: 'w-32' },
    { key: 'committedEndDateValue', label: 'Committed End Date Value', isFormula: true, group: 'in_progress' as const, width: 'w-44' },
    { key: 'slaDaysInProgress', label: 'SLA Days in Progress', isFormula: true, group: 'in_progress' as const, width: 'w-36' },
    { key: 'slaProgressStatus', label: 'SLA Progress Status', isFormula: true, group: 'in_progress' as const, width: 'w-36' },
    { key: 'committedMonthProgress', label: 'Committed Month (Progress)', isFormula: true, group: 'in_progress' as const, width: 'w-44' },
  ];
}

export function getBacklogCalculatedCols(): ColumnDefinition[] {
  return [
    { key: 'monitoringMonth', label: 'Monitoring Month', isFormula: true, group: 'completed' as const, width: 'w-36' },
    { key: 'slaBacklogDays', label: 'SLA', isFormula: true, group: 'completed' as const, width: 'w-28' },
    { key: 'slaBacklogDuration', label: 'SLA duration', isFormula: true, group: 'completed' as const, width: 'w-36' },
  ];
}

export function getOnTargetCalculatedCols(): ColumnDefinition[] {
  return [
    { key: 'onTargetStatus', label: 'On-Target Status', isFormula: true, group: 'completed' as const, width: 'w-56' },
    { key: 'committedMonth', label: 'Committed Month', isFormula: true, group: 'in_progress' as const, width: 'w-36' },
    { key: 'resolved', label: 'Resolved Date', isFormula: true, group: 'completed' as const, width: 'w-48' },
    { key: 'resolvedMonth', label: 'Actual Month', isFormula: true, group: 'completed' as const, width: 'w-32' },
    { key: 'achieved', label: 'Achieved', isFormula: true, group: 'completed' as const, width: 'w-28' },
  ];
}

export function getExternalCalculatedCols(): ColumnDefinition[] {
  return [
    { key: 'externalTrackerStatus', label: 'Status', isFormula: true, group: 'completed' as const, width: 'w-36' },
    { key: 'month2026', label: '2026 Month', isFormula: true, group: 'completed' as const, width: 'w-36' },
    { key: 'caseHorizon2026', label: '2026 Case Horizon', isFormula: true, group: 'completed' as const, width: 'w-44' },
    { key: 'normalizedDevRequired', label: 'Dev Required', isFormula: true, group: 'completed' as const, width: 'w-32' },
    { key: 'externalSlaCountDays', label: 'SLA Count days', isFormula: true, group: 'completed' as const, width: 'w-36' },
    { key: 'noDevSla', label: 'No Dev SLA (≤90d)', isFormula: true, group: 'completed' as const, width: 'w-40' },
    { key: 'withDevSla', label: 'With Dev SLA (≤180d)', isFormula: true, group: 'completed' as const, width: 'w-40' },
  ];
}

/**
 * Export Master Multi-Sheet Excel Workbook with all 4 Trackers, each with its own
 * arranged columns, super-headers, and theme colors
 */
export async function exportMasterMultiSheetExcel({
  rows2026,
  rowsBacklog,
  rowsOnTarget,
  rowsExternal,
  filename = 'CCF_Operational_Trackers_Master_Export.xlsx',
}: {
  rows2026: TranslatedCcfRow[];
  rowsBacklog: TranslatedCcfRow[];
  rowsOnTarget: TranslatedCcfRow[];
  rowsExternal: TranslatedCcfRow[];
  filename?: string;
}): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Change Factory Index';
  workbook.lastModifiedBy = 'Change Factory Index';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sampleRow = rows2026[0] || rowsBacklog[0] || rowsOnTarget[0] || rowsExternal[0];
  const uploadedCols = getDefaultUploadedCols(sampleRow);

  // Sheet 1: 2026 CCF Tracker
  const cols2026 = [...uploadedCols, ...get2026CalculatedCols()];
  const ws2026 = workbook.addWorksheet('2026 CCF Tracker');
  populateStyledWorksheet(ws2026, rows2026, cols2026, '2026', '2026 CCF Operational Tracker');

  // Sheet 2: Backlog CCF Tracker
  const colsBacklog = [...uploadedCols, ...getBacklogCalculatedCols()];
  const wsBacklog = workbook.addWorksheet('Backlog CCF Tracker');
  populateStyledWorksheet(wsBacklog, rowsBacklog, colsBacklog, 'backlog', 'Backlog CCF Tracker');

  // Sheet 3: On-Target CCF Tracker
  const colsOnTarget = [...uploadedCols, ...getOnTargetCalculatedCols()];
  const wsOnTarget = workbook.addWorksheet('On-Target CCF Tracker');
  populateStyledWorksheet(wsOnTarget, rowsOnTarget, colsOnTarget, 'on-target', 'On-Target CCF Tracker');

  // Sheet 4: External CCF Tracker
  const colsExternal = [...uploadedCols, ...getExternalCalculatedCols()];
  const wsExternal = workbook.addWorksheet('External CCF Tracker');
  populateStyledWorksheet(wsExternal, rowsExternal, colsExternal, 'external', 'External CCF Tracker');

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
