import { RawCcfRow, TranslatedCcfRow } from '../types/ccf';
import { translateCcfRow } from './dataParser';
import { formatDateTime12h } from './dateAndFormulaUtils';

interface OwnerSpec {
  owner: string;
  hod: string;
  newCount: number;
  newWithin: number;
  oldCount: number;
  oldWithin: number;
  onTargetCount?: number;
  onTargetCompleted?: number;
}

const OWNER_SPECS: OwnerSpec[] = [
  { owner: 'Abdelfattah Al-Masri', hod: 'Himanshu', newCount: 9, newWithin: 1, oldCount: 15, oldWithin: 3, onTargetCount: 4, onTargetCompleted: 3 },
  { owner: 'Amnah Hamad Alshamsi', hod: 'Kristine', newCount: 3, newWithin: 2, oldCount: 2, oldWithin: 0 },
  { owner: 'Anish Gokel', hod: 'Prince', newCount: 1, newWithin: 1, oldCount: 0, oldWithin: 0 },
  { owner: 'Fatma Nasser Al Shamsi', hod: 'Kristine', newCount: 0, newWithin: 0, oldCount: 3, oldWithin: 2 },
  { owner: 'Hitesh Sharma', hod: 'Hassan', newCount: 0, newWithin: 0, oldCount: 0, oldWithin: 0 },
  { owner: 'Kholoud Nasser Alsaedi', hod: 'Himanshu', newCount: 5, newWithin: 1, oldCount: 6, oldWithin: 1 },
  { owner: 'Khaled Alabdouli', hod: 'Himanshu', newCount: 7, newWithin: 4, oldCount: 1, oldWithin: 1, onTargetCount: 5, onTargetCompleted: 4 },
  { owner: 'Maryam Abdullah Ramadan Al', hod: 'Kristine', newCount: 3, newWithin: 3, oldCount: 0, oldWithin: 0 },
  { owner: 'Noora Tareq Alsalman', hod: 'Himanshu', newCount: 2, newWithin: 2, oldCount: 4, oldWithin: 1, onTargetCount: 2, onTargetCompleted: 2 },
  { owner: 'Prafull Nautiyal', hod: 'Hassan', newCount: 7, newWithin: 3, oldCount: 3, oldWithin: 0 },
  { owner: 'Purnima Muralidharn', hod: 'Himanshu', newCount: 0, newWithin: 0, oldCount: 2, oldWithin: 2 },
  { owner: 'Rajput, Preksha', hod: 'Prince', newCount: 25, newWithin: 24, oldCount: 47, oldWithin: 42, onTargetCount: 10, onTargetCompleted: 8 },
  { owner: 'Nalin Seth', hod: 'Himanshu', newCount: 2, newWithin: 0, oldCount: 3, oldWithin: 0 },
  { owner: 'Sakir Kasim', hod: 'Hassan', newCount: 0, newWithin: 0, oldCount: 3, oldWithin: 0 },
  { owner: 'Shivaramakrishnan Paramesw', hod: 'Hassan', newCount: 4, newWithin: 4, oldCount: 19, oldWithin: 10 },
  { owner: 'Taha Ahmed', hod: 'Kristine', newCount: 3, newWithin: 0, oldCount: 0, oldWithin: 0 },
  { owner: 'Yaser Mahmoud Elabid', hod: 'Kristine', newCount: 63, newWithin: 62, oldCount: 4, oldWithin: 3, onTargetCount: 12, onTargetCompleted: 10 },
  { owner: 'Zubair Ghori', hod: 'Miggy', newCount: 0, newWithin: 0, oldCount: 10, oldWithin: 0 },
  { owner: 'Zuber Mohammed Uddin', hod: 'Himanshu', newCount: 1, newWithin: 1, oldCount: 6, oldWithin: 0 },
];

const TASK_SUMMARIES = [
  "Device Care Review: switch account automation flow",
  "Customer Self-Service portal CCF enhancement",
  "Billing Engine reconcilation workflow sync",
  "SIM Activation real-time validation gate",
  "Roaming Tariff calculation module migration",
  "Payment Gateway 3DS v2.2 protocol alignment",
  "CRM Contact Center omni-channel queue routing",
  "eShop checkout step 1 no-latency refactoring",
  "Broadband order provisioning orchestrator",
  "Identity verification KYC document review queue",
  "IVR speech recognition intent classification",
  "Partner settlement automated statement dispatch",
  "Network inventory catalog schema synchronization",
  "CX Service Excellence satisfaction survey integration"
];

export const STANDARD_UPLOADED_HEADERS: string[] = [
  'Issue Type',
  'Issue key',
  'Issue id',
  'Parent id',
  'Summary',
  'Description',
  'Assignee',
  'Status',
  'Created',
  'Custom field (Monitoring Start Date)',
  'Custom field (Monitoring End Date)',
  'Updated',
  'Custom field (Committed Start Date)',
  'Custom field (Committed End Date)',
  'Custom field (Complaint Month)',
  'Custom field (Change Category)',
  'Custom field (Product Groups)',
  'Custom field (Source)',
  'Custom field (Assigned Date)',
  'Custom field (Assignee Team)',
  'Custom field (In Progress Date)',
  'Custom field (Dev Required)',
  'Custom field (Department)',
];

function generateSeedCcfRows(): TranslatedCcfRow[] {
  const rawRows: RawCcfRow[] = [];
  let ccfNum = 4500;
  let issueIdCounter = 312800;

  OWNER_SPECS.forEach((spec) => {
    // 1. Generate 2026 New Cases (Total 135)
    for (let i = 0; i < spec.newCount; i++) {
      ccfNum++;
      issueIdCounter++;
      const isWithinSla = i < spec.newWithin;

      const monthIndex = 1 + (i % 12); // Jan to Dec 2026 (ongoing cases in Nov/Dec spill into 2027)
      const monthStr = monthIndex < 10 ? `0${monthIndex}` : `${monthIndex}`;
      const day = (i % 25) + 1;
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      const createdStr = `${dayStr}/${monthStr}/2026 09:15`;

      // On-Target eligibility: transferred from Under Development to Completed
      const isOnTargetDev = Boolean(spec.onTargetCount && i < spec.onTargetCount);
      const isOnTargetCompleted = Boolean(isOnTargetDev && i < (spec.onTargetCompleted || 0));

      // Status
      let status: RawCcfRow['status'] = 'Completed';
      if (isOnTargetDev) {
        status = 'Completed';
      } else if (i % 5 === 0 && spec.newCount > 1) {
        status = 'In Progress';
      } else if (i % 5 === 1) {
        status = 'For Monitoring';
      } else if (i % 5 === 2) {
        status = 'Under Development';
      }

      // Monitoring Start Date (for completed/monitoring/under development)
      const daysToAdd = isWithinSla ? 25 + (i % 50) : 100 + (i % 45);
      const mDate = new Date(Date.UTC(2026, monthIndex - 1, day + daysToAdd));
      const mDayStr = String(mDate.getUTCDate()).padStart(2, '0');
      const mMonthStr = String(mDate.getUTCMonth() + 1).padStart(2, '0');
      const monitoringStartDate = `${mDayStr}/${mMonthStr}/${mDate.getUTCFullYear()}`;

      // Committed End Date
      const commitMonthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIndex % 12];
      const committedEndDate = `${commitMonthName} -> 2026`;

      const rawRowData: Record<string, string> = {};
      if (isOnTargetDev) {
        rawRowData['On Target'] = isOnTargetCompleted ? 'Y' : 'N';
      }

      const isDevRequired = isOnTargetDev || status === 'Under Development' || (i % 2 === 0);
      let inProgressStartDate = '';
      if (status === 'In Progress' || status === 'Under Development') {
        inProgressStartDate = createdStr;
      }

      rawRows.push({
        issueType: 'Task',
        issueKey: `CCF-${ccfNum}`,
        issueId: String(issueIdCounter),
        parentId: '',
        summary: TASK_SUMMARIES[(ccfNum + i) % TASK_SUMMARIES.length],
        assignee: spec.owner,
        hod: spec.hod,
        assigneeTeam: `CX Service Excellence (${spec.hod})`,
        status,
        created: createdStr,
        monitoringStartDate: status === 'In Progress' ? '' : monitoringStartDate,
        inProgressStartDate,
        committedEndDate,
        devRequired: isDevRequired ? 'Yes' : 'No',
        department: 'CX Governance and Assurance',
        ccfType: 'Internal',
        rawRowData,
      });
    }

    // 2. Generate Legacy Backlog Old Cases (< 2026, Total 128)
    for (let j = 0; j < spec.oldCount; j++) {
      ccfNum++;
      issueIdCounter++;
      const isWithinSla = j < spec.oldWithin;

      // Created in 2025
      const createdMonth = 1 + (j % 12);
      const createdMonthStr = createdMonth < 10 ? `0${createdMonth}` : `${createdMonth}`;
      const createdDay = (j % 28) + 1;
      const createdDayStr = createdDay < 10 ? `0${createdDay}` : `${createdDay}`;
      const createdStr = `${createdDayStr}/${createdMonthStr}/2025 14:30`;

      // Some cases monitoring in 2025 (should have blank SLA), some monitoring in 2026 (calculated SLA)
      let monitoringEndDate = '';
      if (j % 2 === 0) {
        // Monitoring in 2025 (e.g. April 2025)
        const mMonth = 1 + (j % 4); // Jan-Apr 2025
        const mDay = (j % 28) + 1;
        monitoringEndDate = `${mDay < 10 ? '0' + mDay : mDay}/${mMonth < 10 ? '0' + mMonth : mMonth}/2025 04:00 AM`;
      } else {
        // Monitoring in 2026
        const daysAfterCutoff = isWithinSla ? 20 + (j % 150) : 185 + (j % 90);
        const mEndDate = new Date(Date.UTC(2026, 0, 1 + daysAfterCutoff));
        const mEndDayStr = String(mEndDate.getUTCDate()).padStart(2, '0');
        const mEndMonthStr = String(mEndDate.getUTCMonth() + 1).padStart(2, '0');
        monitoringEndDate = `${mEndDayStr}/${mEndMonthStr}/${mEndDate.getUTCFullYear()} 04:00 AM`;
      }

      rawRows.push({
        issueType: 'Task',
        issueKey: `CCF-${ccfNum}`,
        issueId: String(issueIdCounter),
        parentId: '',
        summary: `[Legacy Backlog] ${TASK_SUMMARIES[(ccfNum + j) % TASK_SUMMARIES.length]}`,
        assignee: spec.owner,
        hod: spec.hod,
        assigneeTeam: `CX Service Excellence (${spec.hod})`,
        status: j % 3 === 0 ? 'For Monitoring' : 'Completed',
        created: createdStr,
        monitoringStartDate: monitoringEndDate,
        monitoringEndDate,
        committedEndDate: 'Dec -> 2025',
        department: 'CX Governance and Assurance',
        ccfType: 'Internal',
      });
    }
  });

  return rawRows.map((r, i) => {
    const translated = translateCcfRow(r, i);
    const rawRowData: Record<string, string> = {
      'Issue Type': r.issueType || 'Task',
      'Issue key': r.issueKey,
      'Issue id': r.issueId || '',
      'Parent id': r.parentId || '',
      'Summary': r.summary || '',
      'Description': r.description || '',
      'Assignee': r.assignee || '',
      'Status': r.status || '',
      'Created': formatDateTime12h(r.created, true),
      'Custom field (Monitoring Start Date)': r.monitoringStartDate ? formatDateTime12h(r.monitoringStartDate, false) : '-',
      'Custom field (Monitoring End Date)': r.monitoringEndDate ? formatDateTime12h(r.monitoringEndDate, false) : '-',
      'Updated': formatDateTime12h(r.updated || r.created, true),
      'Custom field (Committed Start Date)': r.committedStartDate ? formatDateTime12h(r.committedStartDate, false) : '',
      'Custom field (Committed End Date)': r.committedEndDate || '',
      'Custom field (Complaint Month)': r.complaintMonth || '',
      'Custom field (Change Category)': r.changeCategory || 'Standard',
      'Custom field (Product Groups)': r.productGroups || 'B2C',
      'Custom field (Source)': r.source || 'Jira CCF',
      'Custom field (Assigned Date)': r.assignedDate ? formatDateTime12h(r.assignedDate, false) : '',
      'Custom field (Assignee Team)': r.assigneeTeam || '',
      'Custom field (In Progress Date)': r.inProgressDate ? formatDateTime12h(r.inProgressDate, false) : '',
      'Custom field (Dev Required)': r.devRequired || 'Yes',
      'Custom field (Department)': r.department || 'Consumer',
    };

    translated.rawColumns = STANDARD_UPLOADED_HEADERS;
    translated.rawRowData = rawRowData;
    return translated;
  });
}

export const INITIAL_CCF_DATA: TranslatedCcfRow[] = generateSeedCcfRows();
