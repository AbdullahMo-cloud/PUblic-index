export type NavTab = string;
export type CcfStatus =
  | 'New'
  | 'In Progress'
  | 'Under Development'
  | 'For Monitoring'
  | 'Completed'
  | 'Closed'
  | 'Rejected'
  | 'On Hold';

export type SlaDurationStatus = '90' | 'More than 90' | 'Pending' | 'N/A' | '-';
export type SlaProgressStatus = 'Within 90' | 'Beyond 90' | 'Pending' | 'N/A';
export type TrackerCategory = '2026' | 'backlog' | 'external';

export interface RawCcfRow {
  id?: string;
  issueType?: string;
  issueKey: string;
  issueId?: string;
  parentId?: string;
  summary: string;
  description?: string;
  assignee: string;
  hod?: string; // Head of Department / Assignee Team Lead
  assigneeTeam?: string;
  status: CcfStatus | string;
  created: string; // e.g. "01/10/2026 9:15" or ISO
  monitoringStartDate?: string;
  monitoringEndDate?: string;
  updated?: string;
  committedStartDate?: string;
  committedEndDate?: string; // e.g. "Oct -> 2026", "Sep-26"
  complaintMonth?: string;
  changeCategory?: string;
  productGroups?: string;
  source?: string;
  assignedDate?: string;
  inProgressStartDate?: string;
  inProgressDate?: string;
  devRequired?: string;
  department?: string;
  ccfType?: 'Internal' | 'External';
  trackerCategory?: TrackerCategory;
  resolved?: string;
  [key: string]: unknown;
}

export interface TranslatedCcfRow extends RawCcfRow {
  // Translated calculated columns as required by user brief
  isNewCase: boolean; // Created in 2026 -> New Case, earlier -> Old Case
  createdYear: number | null;
  // THE THREE MONTH TRANSLATED COLUMNS (as requested):
  createdMonth: string; // 1. "Created Month" -> translates Created date to MMM-YY for all cases
  createdMonthCompleted: string; // 2. "Created Month (Completed)" -> tracks Created date month for statuses: "For Monitoring", "Completed", "Under Development"
  monthCompleted: string; // 3. "Month Completed" -> tracks month from "Custom field (Monitoring Start Date)" for statuses: "For Monitoring", "Completed", "Under Development"
  slaDays: number | null; // Monitoring Start Date - Created Date (variance in days)
  slaDuration: SlaDurationStatus; // "=IF(AA2<="90","90","More than 90")"
  committedMonth: string; // Translated "Oct -> 2026" to "Oct-26"
  committedEndDateValue: string; // For "In Progress", date at end of month (e.g. "30-Sep-2026")
  slaDaysInProgress: number | null; // Committed end date value - Created date
  slaProgressStatus: SlaProgressStatus; // "<= 90" -> "Within 90", else "Beyond 90"
  committedMonthProgress: string; // Month format "MMM-YY" for Progress
  // Backlog tracker specific fields
  monitoringMonth: string; 
  slaBacklogDays: number | null; // SLA: calculated days from Custom field (Monitoring End Date) after 31-12-2025
  slaBacklogDuration: string; // SLA duration: if SLA < 181 -> "180", else "Above 180"
  // On-Target Completion methodology fields:
  resolvedMonth?: string; // Month of Resolved date (e.g. "Jun-26" or "Jun")
  onTargetStatus?: 'From Under Dev to Completed' | 'Pending to Completed' | 'Not Applicable';
  // External CCF Tracker fields
  externalTrackerStatus?: '2026' | 'Backlog' | 'No Backlog';
  externalEligible?: string;
  externalSlaBranch?: string;
  month2026?: string; // Full month name MMMM for 2026 cases; blank (-) for non-2026
  externalSlaCountDays?: number | null;
  externalSlaDueDate?: string;
  externalMaturityStatus?: 'Within SLA' | 'Outside SLA' | '-';
  externalIsEligibleForSla?: boolean;
  normalizedDevRequired?: 'Yes' | 'No' | '-';
  noDevSla?: 'Within SLA' | 'Outside SLA' | '-';
  withDevSla?: 'Within SLA' | 'Outside SLA' | '-';
  // 2026 Case Horizon (External CCFi KPI Focus)
  caseHorizon2026?: 'Eligible 2026' | '2027 Exceed Level' | '-';
  caseTargetDeliveryDate?: string;
  rawColumns?: string[]; // All original column headers uploaded from the sheet
  rawRowData?: Record<string, string>; // Complete original row data uploaded from the sheet
}

export interface OwnerIndexSummary {
  owner: string;
  assignee?: string;
  hod: string;
  newCasesCount: number; // Card 2 Total Count: "In Progress", "Under Development", "For Monitoring", "Completed"
  newCasesDenominator: number; // Card 2 Denominator: "Under Development", "For Monitoring", "Completed"
  newCasesWithinSla: number; // Card 2 Numerator: SLA Duration <= 90
  newCasesPct: number; // Card 2: (Numerator / Denominator) * 100
  oldCasesCount: number; // Card 3 Total Eligible: all except "Not Started" and "Cancelled"
  oldCasesWithinSla: number; // Card 3 Numerator: SLA Duration <= 180
  oldCasesPct: number; // Card 3: (Numerator / Denominator) * 100
  onTargetCount: number; // Card 1 (N): Cases transferred from Under Development to Completed
  onTargetCompleted: number; // Card 1 (O): Cases completed on or before target date, marked Y
  onTargetPct: number; // Card 1 (F): O ÷ N (or 0 if N=0)
  onTargetContribution?: number; // Column F Contribution in Column G: (F/0.8)*0.1 or 10% if blank/0 with numeric D
  changeFactoryIndex: number; // Weighted Change Factory Index %
}

export interface CcfAggregateStats {
  totalCases: number;
  newCasesTotal: number; // Card 2 Total Count (4 statuses)
  newCasesDenominator: number; // Card 2 SLA Denominator (3 statuses)
  newCasesWithinSla: number; // Card 2 SLA Numerator (<= 90)
  newCasesSlaPct: number; // Card 2 SLA %: (Numerator / Denominator) * 100
  oldCasesTotal: number; // Card 3 Total Eligible (Excl. Not Started & Cancelled)
  oldCasesWithinSla: number; // Card 3 SLA Numerator (<= 180)
  oldCasesSlaPct: number; // Card 3 SLA %: (Numerator / Denominator) * 100
  onTargetCompletionCount: number; // Card 1 (O): Cases completed on or before target date, marked Y
  onTargetTotal: number; // Card 1 (N): Cases transferred from Under Development to Completed
  onTargetCompletionPct: number; // Card 1 (F): O ÷ N (or 0 if N=0)
  inProgressCount?: number;
  inProgressWithin90?: number;
  inProgressPct?: number;
  completedCount: number;
  forMonitoringCount: number;
  overallIndex: number;
  targetIndex: number; // 80%
}

export interface ExternalMonthlyCfiRow {
  month: string; // 'Jan', 'Feb', ..., 'Dec'
  fullMonthName: string; // 'January', 'February', ...
  // No Dev Section (Target 80%, Weight 80%)
  noDevPct: number;
  noDevCount: number;
  noDevWithinSla: number;
  noDevOutsideSla: number;
  noDevUnresolved: number;
  // Dev Section (Target 80%, Weight 20%)
  devPct: number;
  devCount: number;
  devWithinSla: number;
  devOutsideSla: number;
  devUnresolved: number;
  // Total Section
  totalCfiPct: number; // No Dev % + (Dev % / 80 * 20)
  glidePct: number; // 50%, 54%, 58%, 62%, 66%, 70%, 74%, 78%, 82%, 86%, 88%, 90%
  totalCases: number;
  forMonitoringCompleted: number;
  activeCases: number;
  pctClosed: number;
}

export interface ExternalOwnerCfiSummary {
  owner: string;
  assignee: string;
  hod: string;
  rank: number;
  noDevCount: number;
  noDevWithinSla: number;
  noDevOutsideSla: number;
  noDevPct: number;
  devCount: number;
  devWithinSla: number;
  devOutsideSla: number;
  devPct: number;
  totalCases: number;
  totalCfiPct: number;
}

export interface ExternalHodCfiSummary {
  hod: string;
  ownerCount: number;
  rank: number;
  noDevCount: number;
  noDevWithinSla: number;
  noDevOutsideSla: number;
  noDevPct: number;
  devCount: number;
  devWithinSla: number;
  devOutsideSla: number;
  devPct: number;
  totalCases: number;
  totalCfiPct: number;
}

export interface ExternalKpiStats {
  totalExternalCases: number;
  eligibleCasesCount?: number; // Cases evaluated for 2026 SLA compliance (excludes 2027 Branch cases)
  gracePeriodCount?: number;   // Cases segregated into Grace Period (SLA deadline matures in 2027)
  branch2027ExcludedCount?: number; // Total 2026 cases excluded from 2026 unresolved count into 2027 branch
  unstarted2027Count?: number;      // 2026 unstarted cases (expected SLA in 2027, excluded)
  inProgress2027Count?: number;     // 2026 ongoing cases with SLA maturing in 2027 (excluded from 2026 unresolved)
  exceedLevel2027Count?: number;    // 2026 ongoing cases crossing into 2027 (excluded from 2026 unresolved penalty)
  eligible2026Count?: number;       // Active 2026 delivery cases evaluated in 2026
  withinSlaCount: number;
  outsideSlaCount?: number;
  externalSlaPct: number;
  inProgressCount: number;
  completedCount: number;
  targetIndex: number; // 80%
  // No Dev
  noDevTotalCount: number;
  noDevWithinSlaCount: number;
  noDevOverallPct: number;
  noDevContPct: number; // 45% = AVERAGE(Jan:Dec No Dev Count) / (AVERAGE No Dev + AVERAGE Dev)
  // Dev
  devTotalCount: number;
  devWithinSlaCount: number;
  devOverallPct: number;
  devContPct: number; // 55% = AVERAGE(Jan:Dec Dev Count) / (AVERAGE No Dev + AVERAGE Dev)
  // Combined Score
  overallCfiScore: number;
  // Matrix and Owner & HOD breakdowns
  monthlyData: ExternalMonthlyCfiRow[];
  ownerBreakdown: ExternalOwnerCfiSummary[];
  hodBreakdown: ExternalHodCfiSummary[];
  partnerBreakdown: {
    partner: string;
    total: number;
    withinSla: number;
    slaPct: number;
  }[];
}
