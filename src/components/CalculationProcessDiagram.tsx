import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  GitFork,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Calendar,
  Layers,
  Code2,
  ShieldAlert,
  ShieldCheck,
  Check,
  Play,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Calculator,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';

interface CalculationProcessDiagramProps {
  onNavigateToExternalTracker?: () => void;
  onNavigateToExternalKpi?: () => void;
}

export const CalculationProcessDiagram: React.FC<CalculationProcessDiagramProps> = ({
  onNavigateToExternalTracker,
  onNavigateToExternalKpi,
}) => {
  // Sandbox Simulator State
  const [simStatus, setSimStatus] = useState<string>('For Monitoring');
  const [simDevReq, setSimDevReq] = useState<'Yes' | 'No'>('No');
  const [simInProgressDate, setSimInProgressDate] = useState<string>('2026-02-15');
  const [simMonitoringDate, setSimMonitoringDate] = useState<string>('2026-03-20');
  const [activeStepTab, setActiveStepTab] = useState<number>(1);

  // Compute live sandbox output
  const simulationResult = useMemo(() => {
    const normStatus = simStatus.toLowerCase().trim();
    const isStatusEligible =
      normStatus === 'for monitoring' ||
      normStatus === 'completed' ||
      normStatus === 'closed' ||
      normStatus === 'resolved';

    if (!isStatusEligible) {
      return {
        isEligible: false,
        rejectionReason: `Status "${simStatus}" is NOT "For Monitoring" or "Completed". Per business rule, all other statuses (New, In Progress, Under Development, Not Started, etc.) must have SLA Count Days and SLA Tags left completely BLANK ('-').`,
        turnaroundDays: null,
        slaWindowDays: simDevReq === 'Yes' ? 180 : 90,
        slaDueDate: '-',
        isDueAfter2026: false,
        noDevSla: '-',
        withDevSla: '-',
        finalTag: '-',
        kpiCounted: false,
      };
    }

    const inProg = new Date(simInProgressDate);
    const monDate = simMonitoringDate ? new Date(simMonitoringDate) : null;
    const slaWindow = simDevReq === 'Yes' ? 180 : 90;

    // SLA Due Date (months from In Progress Start Date)
    const dueObj = new Date(inProg);
    if (simDevReq === 'Yes') {
      dueObj.setMonth(dueObj.getMonth() + 6);
    } else {
      dueObj.setMonth(dueObj.getMonth() + 3);
    }

    const dueYear = dueObj.getFullYear();
    const isDueAfter2026 = dueObj.getTime() > new Date('2026-12-31T23:59:59Z').getTime();

    // Turnaround Days = Monitoring Start Date - In Progress Start Date
    let turnaroundDays: number | null = null;
    if (monDate && !isNaN(monDate.getTime()) && !isNaN(inProg.getTime())) {
      const diffMs = monDate.getTime() - inProg.getTime();
      turnaroundDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }

    let finalTag: 'Within SLA' | 'Outside SLA' | 'Grace Period (Due 2027)' = 'Within SLA';
    let kpiCounted = true;

    if (isDueAfter2026) {
      // Due in 2027:
      // If completed early within SLA window:
      if (turnaroundDays !== null && turnaroundDays <= slaWindow) {
        finalTag = 'Within SLA';
        kpiCounted = true;
      } else {
        finalTag = 'Grace Period (Due 2027)';
        kpiCounted = false; // Excluded from 2026 denominator!
      }
    } else {
      // Due in 2026:
      if (turnaroundDays !== null && turnaroundDays <= slaWindow) {
        finalTag = 'Within SLA';
      } else {
        finalTag = 'Outside SLA';
      }
      kpiCounted = true;
    }

    const noDevSla = simDevReq === 'No' ? finalTag : '-';
    const withDevSla = simDevReq === 'Yes' ? finalTag : '-';

    return {
      isEligible: true,
      rejectionReason: null,
      turnaroundDays,
      slaWindowDays: slaWindow,
      slaDueDate: dueObj.toISOString().split('T')[0],
      isDueAfter2026,
      noDevSla,
      withDevSla,
      finalTag,
      kpiCounted,
    };
  }, [simStatus, simDevReq, simInProgressDate, simMonitoringDate]);

  // Sample Cases Database
  const sampleCases = [
    {
      id: 'EXT-01',
      title: 'Fast Turnaround (No Dev)',
      status: 'For Monitoring',
      devReq: 'No',
      inProgress: '10-Feb-2026',
      monitoring: '15-Mar-2026',
      turnaround: '33 days',
      window: '90 days (3m)',
      dueDate: '10-May-2026 (CY26)',
      slaNoDev: 'Within SLA',
      slaWithDev: '-',
      finalStatus: 'Within SLA',
      kpiImpact: 'Counted in 2026 (Pass)',
      note: '33 days <= 90 days threshold. Status is For Monitoring -> Tagged Within SLA.',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
    {
      id: 'EXT-02',
      title: 'Delayed Delivery (With Dev)',
      status: 'Completed',
      devReq: 'Yes',
      inProgress: '15-Jan-2026',
      monitoring: '20-Aug-2026',
      turnaround: '217 days',
      window: '180 days (6m)',
      dueDate: '15-Jul-2026 (CY26)',
      slaNoDev: '-',
      slaWithDev: 'Outside SLA',
      finalStatus: 'Outside SLA',
      kpiImpact: 'Counted in 2026 (Breach)',
      note: '217 days > 180 days threshold. Due in July 2026. Status Completed -> Outside SLA.',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    },
    {
      id: 'EXT-03',
      title: 'Under Development (Gated Out)',
      status: 'Under Development',
      devReq: 'Yes',
      inProgress: '10-May-2026',
      monitoring: '-',
      turnaround: '-',
      window: '180 days (6m)',
      dueDate: '10-Nov-2026',
      slaNoDev: '-',
      slaWithDev: '-',
      finalStatus: '-',
      kpiImpact: 'Excluded (Pending completion)',
      note: 'Status is NOT "For Monitoring" or "Completed" -> SLA Count Days and SLA Tags remain BLANK (-).',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
    },
    {
      id: 'EXT-04',
      title: 'In Progress (Gated Out)',
      status: 'In Progress',
      devReq: 'No',
      inProgress: '05-Apr-2026',
      monitoring: '-',
      turnaround: '-',
      window: '90 days (3m)',
      dueDate: '05-Jul-2026',
      slaNoDev: '-',
      slaWithDev: '-',
      finalStatus: '-',
      kpiImpact: 'Excluded (WIP)',
      note: 'Status is NOT "For Monitoring" or "Completed" -> SLA Count Days and SLA Tags remain BLANK (-).',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
    },
    {
      id: 'EXT-05',
      title: 'Late 2026 Start (No Dev Grace Period)',
      status: 'For Monitoring',
      devReq: 'No',
      inProgress: '20-Oct-2026',
      monitoring: '15-Dec-2026',
      turnaround: '56 days',
      window: '90 days (3m)',
      dueDate: '20-Jan-2027 (CY27)',
      slaNoDev: 'Within SLA',
      slaWithDev: '-',
      finalStatus: 'Within SLA',
      kpiImpact: 'Early Completion Awarded',
      note: 'Started Oct 2026, due Jan 2027, but completed early in 56 days (<= 90) -> Tagged Within SLA.',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
    {
      id: 'EXT-06',
      title: 'Q3 Start (With Dev Grace Period)',
      status: 'For Monitoring',
      devReq: 'Yes',
      inProgress: '15-Aug-2026',
      monitoring: 'Pending/Dec',
      turnaround: '120 days',
      window: '180 days (6m)',
      dueDate: '15-Feb-2027 (CY27)',
      slaNoDev: '-',
      slaWithDev: 'Grace Period (Due 2027)',
      finalStatus: 'Grace Period (Due 2027)',
      kpiImpact: 'Excluded from 2026 Denominator',
      note: 'With Dev started Aug 2026 -> 6 months matures Feb 2027. Excluded from 2026 denominator per grace rule.',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    },
  ];

  return (
    <div className="space-y-8 pb-16 text-slate-800">
      {/* HEADER BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-indigo-900/40">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Official Business Methodology</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <GitFork className="w-8 h-8 text-indigo-400 shrink-0" />
              External CCF Calculation Process Diagram
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-3xl leading-relaxed">
              Complete architectural blueprint illustrating the lifecycle of External CCF cases: from initial master data
              segregation and date field extraction, through strict status gating, SLA day turnaround computation, to
              2026/2027 Grace Period classification and final table column presentation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onNavigateToExternalTracker && (
              <button
                onClick={onNavigateToExternalTracker}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-xs border border-white/15 transition-all shadow-xs"
              >
                <Layers className="w-4 h-4 text-indigo-300" />
                <span>External CCF Tracker</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onNavigateToExternalKpi && (
              <button
                onClick={onNavigateToExternalKpi}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30"
              >
                <Calculator className="w-4 h-4" />
                <span>External KPI Dashboard</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative background grid pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#818cf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
      </div>

      {/* QUICK JUMP NAVIGATION BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase px-2 tracking-wider">Methodology Steps:</span>
          {[
            { id: 1, label: '1. Segregation' },
            { id: 2, label: '2. Dates Extraction' },
            { id: 3, label: '3. Status Gate' },
            { id: 4, label: '4. Turnaround Days' },
            { id: 5, label: '5. Dev Threshold' },
            { id: 6, label: '6. Grace Period' },
            { id: 7, label: '7. Final Table' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveStepTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeStepTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 font-medium px-2">
          Enforced Rule: Only <strong className="text-indigo-600 font-bold">For Monitoring</strong> & <strong className="text-indigo-600 font-bold">Completed</strong> receive SLA tags
        </div>
      </div>

      {/* SECTION 1: END-TO-END VISUAL PROCESS FLOWCHART */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black">
                A
              </span>
              End-to-End Visual Workflow Diagram
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Follow the arrows to see how every case is evaluated from arrival to final column assignment.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            Deterministic Tree Logic
          </span>
        </div>

        {/* FLOWCHART GRAPH CANVAS */}
        <div className="relative overflow-x-auto p-4 sm:p-6 bg-slate-50/60 rounded-2xl border border-slate-200/80">
          <div className="min-w-[860px] space-y-6">

            {/* STAGE 1: INGESTION & SEGREGATION */}
            <div className="flex items-center gap-4">
              <div className="w-48 shrink-0 text-right">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Step 1: Segregation</span>
                <p className="text-xs text-slate-600 font-medium">Master Data Filter</p>
              </div>

              <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Incoming Master CCF Data</h4>
                    <p className="text-xs text-slate-500">All cases exported from Jira or central CCF register</p>
                  </div>
                </div>

                <ArrowRight className="w-5 h-5 text-slate-300" />

                <div className="bg-blue-50/70 border border-blue-200 rounded-xl px-3.5 py-2 text-xs">
                  <span className="font-bold text-blue-900">External CCF Segregation Rule:</span>
                  <div className="text-blue-700 font-mono mt-0.5">Category = 'external' OR Dept = 'External CCF'</div>
                </div>

                <ArrowRight className="w-5 h-5 text-indigo-500 animate-pulse" />

                <div className="bg-indigo-600 text-white rounded-xl px-4 py-2.5 text-xs font-bold shadow-xs">
                  External CCF Tracker Dataset
                </div>
              </div>
            </div>

            {/* CONNECTOR */}
            <div className="flex justify-center -my-3">
              <ArrowDown className="w-5 h-5 text-indigo-400" />
            </div>

            {/* STAGE 2: DATE FIELD EXTRACTION */}
            <div className="flex items-center gap-4">
              <div className="w-48 shrink-0 text-right">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Step 2: Field Extraction</span>
                <p className="text-xs text-slate-600 font-medium">Key Dates Identification</p>
              </div>

              <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3">
                  <span className="text-[11px] font-bold text-indigo-900 uppercase flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    Anchor Start Date
                  </span>
                  <div className="text-xs font-semibold text-slate-900 mt-1">Custom field (In Progress Date)</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">`inProgressStartDate`</div>
                  <div className="text-[11px] text-indigo-700 mt-1 bg-white/80 p-1.5 rounded-lg border border-indigo-100">
                    Base start point for turnaround & SLA window
                  </div>
                </div>

                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3">
                  <span className="text-[11px] font-bold text-emerald-900 uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Turnaround End Date
                  </span>
                  <div className="text-xs font-semibold text-slate-900 mt-1">Custom field (Monitoring Start Date)</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">`monitoringStartDate`</div>
                  <div className="text-[11px] text-emerald-700 mt-1 bg-white/80 p-1.5 rounded-lg border border-emerald-100">
                    Recorded when case moves into monitoring
                  </div>
                </div>

                <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3">
                  <span className="text-[11px] font-bold text-purple-900 uppercase flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-purple-600" />
                    Classification Flag
                  </span>
                  <div className="text-xs font-semibold text-slate-900 mt-1">Dev Required (Yes / No)</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">`devRequired`</div>
                  <div className="text-[11px] text-purple-700 mt-1 bg-white/80 p-1.5 rounded-lg border border-purple-100">
                    Defines SLA window: 90 days vs 180 days
                  </div>
                </div>
              </div>
            </div>

            {/* CONNECTOR */}
            <div className="flex justify-center -my-3">
              <ArrowDown className="w-5 h-5 text-indigo-400" />
            </div>

            {/* STAGE 3: THE CRITICAL STATUS GATEKEEPER */}
            <div className="flex items-center gap-4">
              <div className="w-48 shrink-0 text-right">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-500">Step 3: Gatekeeper</span>
                <p className="text-xs text-rose-600 font-bold">Strict Status Gate</p>
              </div>

              <div className="flex-1 bg-linear-to-r from-amber-500/10 via-white to-indigo-500/10 p-5 rounded-2xl border-2 border-dashed border-indigo-300 shadow-xs">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-black uppercase">
                        CRITICAL EVALUATION DECISION
                      </span>
                      <h4 className="text-base font-black text-slate-900 mt-1">
                        Is Status strictly "For Monitoring" or "Completed"?
                      </h4>
                      <p className="text-xs text-slate-500">
                        Formula check: <code className="text-indigo-700 font-mono font-bold">OR(Status == "For Monitoring", Status == "Completed")</code>
                      </p>
                    </div>
                  </div>
                </div>

                {/* TWO FORKING PATHS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
                  {/* BRANCH A: REJECTED / BLANK PATH */}
                  <div className="bg-rose-50/80 rounded-xl p-3.5 border border-rose-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-rose-800 font-black text-xs uppercase tracking-wide">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>NO: Other Statuses (New, In Progress, Under Dev, etc.)</span>
                      </div>
                      <p className="text-xs text-rose-900 mt-2 font-medium">
                        Case has not reached monitoring or completion. It is actively being handled or queued.
                      </p>
                    </div>
                    <div className="mt-3 bg-white/90 rounded-lg p-2.5 border border-rose-300 font-mono text-xs space-y-1">
                      <div className="text-rose-950 font-bold">Enforced Outputs:</div>
                      <div className="text-slate-700">• SLA Count Days = <span className="font-bold text-rose-700">'-' (Blank)</span></div>
                      <div className="text-slate-700">• No Dev SLA = <span className="font-bold text-rose-700">'-' (Blank)</span></div>
                      <div className="text-slate-700">• With Dev SLA = <span className="font-bold text-rose-700">'-' (Blank)</span></div>
                      <div className="text-slate-700">• 2026 SLA Status = <span className="font-bold text-rose-700">'-' (Blank)</span></div>
                    </div>
                  </div>

                  {/* BRANCH B: APPROVED PATH */}
                  <div className="bg-emerald-50/80 rounded-xl p-3.5 border border-emerald-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-emerald-800 font-black text-xs uppercase tracking-wide">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>YES: Status IS "For Monitoring" or "Completed"</span>
                      </div>
                      <p className="text-xs text-emerald-900 mt-2 font-medium">
                        Turnaround cycle has completed! The case is eligible for turnaround calculation and SLA compliance scoring.
                      </p>
                    </div>
                    <div className="mt-3 bg-white/90 rounded-lg p-2.5 border border-emerald-300 font-mono text-xs space-y-1">
                      <div className="text-emerald-950 font-bold">Allowed Outputs:</div>
                      <div className="text-slate-700">• SLA Count Days = <span className="font-bold text-emerald-700">Monitoring Date - In Progress Date</span></div>
                      <div className="text-slate-700">• Evaluated against SLA Window (90d vs 180d)</div>
                      <div className="text-slate-700">• Evaluated for 2026 vs 2027 Grace Period</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CONNECTOR */}
            <div className="flex justify-center -my-3">
              <ArrowDown className="w-5 h-5 text-emerald-500" />
            </div>

            {/* STAGE 4: SLA TURNAROUND DAYS FORMULA */}
            <div className="flex items-center gap-4">
              <div className="w-48 shrink-0 text-right">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Step 4: Calculation</span>
                <p className="text-xs text-slate-600 font-medium">Turnaround Days Formula</p>
              </div>

              <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">SLA Count Days Equation</h4>
                    <p className="text-xs text-slate-500">Calculates elapsed turnaround calendar days</p>
                  </div>
                </div>

                <div className="bg-slate-900 text-white rounded-xl p-3 font-mono text-xs font-bold tracking-wide">
                  SLA Count Days = Monitoring Start Date - In Progress Start Date
                </div>
              </div>
            </div>

            {/* CONNECTOR */}
            <div className="flex justify-center -my-3">
              <ArrowDown className="w-5 h-5 text-indigo-400" />
            </div>

            {/* STAGE 5: DEV THRESHOLD BRANCH */}
            <div className="flex items-center gap-4">
              <div className="w-48 shrink-0 text-right">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Step 5: Window Mapping</span>
                <p className="text-xs text-slate-600 font-medium">Dev Required Branch</p>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* NO DEV */}
                <div className="bg-white p-4 rounded-2xl border border-sky-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">
                      No Dev (Configuration / Standard)
                    </span>
                    <span className="text-xs font-mono font-bold text-sky-700">Threshold: 90 Days</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    <strong>SLA Window:</strong> 3 Calendar Months (90 Days).
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    <strong>SLA Due Date:</strong> In Progress Start Date + 3 Months.
                  </div>
                  <div className="mt-2 bg-sky-50 rounded-lg p-2 text-[11px] text-sky-950 font-mono">
                    Cases starting on or after Oct 1, 2026 mature in 2027 (Grace Period rule applies).
                  </div>
                </div>

                {/* WITH DEV */}
                <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 text-xs font-bold">
                      With Dev (Software Development Required)
                    </span>
                    <span className="text-xs font-mono font-bold text-purple-700">Threshold: 180 Days</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    <strong>SLA Window:</strong> 6 Calendar Months (180 Days).
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    <strong>SLA Due Date:</strong> In Progress Start Date + 6 Months.
                  </div>
                  <div className="mt-2 bg-purple-50 rounded-lg p-2 text-[11px] text-purple-950 font-mono">
                    Cases starting on or after July 1, 2026 mature in 2027 (Grace Period rule applies).
                  </div>
                </div>
              </div>
            </div>

            {/* CONNECTOR */}
            <div className="flex justify-center -my-3">
              <ArrowDown className="w-5 h-5 text-indigo-400" />
            </div>

            {/* STAGE 6: 2026 VS 2027 GRACE PERIOD EVALUATION */}
            <div className="flex items-center gap-4">
              <div className="w-48 shrink-0 text-right">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Step 6: Grace Period</span>
                <p className="text-xs text-amber-700 font-bold">2026 vs 2027 Maturity</p>
              </div>

              <div className="flex-1 bg-amber-50/70 p-4 rounded-2xl border border-amber-300 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <h4 className="text-sm font-bold text-amber-950">
                      Does SLA Due Date mature in 2026 or 2027?
                    </h4>
                  </div>
                  <span className="text-xs font-mono bg-white px-2.5 py-1 rounded-md text-amber-900 border border-amber-200 font-bold">
                    Cutoff: 31-Dec-2026
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-amber-200">
                    <span className="font-bold text-slate-900 block mb-1">
                      Case Matures in 2026 (SLA Due Date &lt;= 31-Dec-2026):
                    </span>
                    <ul className="space-y-1 text-slate-600 font-medium">
                      <li>• If <code className="text-emerald-700 font-bold">Turnaround &lt;= Window</code> &rarr; Tagged <strong className="text-emerald-700">"Within SLA"</strong></li>
                      <li>• If <code className="text-rose-700 font-bold">Turnaround &gt; Window</code> &rarr; Tagged <strong className="text-rose-700">"Outside SLA"</strong></li>
                      <li className="text-[11px] text-slate-500 mt-1 italic">Counted in 2026 KPI compliance denominator.</li>
                    </ul>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-200">
                    <span className="font-bold text-amber-950 block mb-1">
                      Case Matures in 2027 (SLA Due Date &gt; 31-Dec-2026):
                    </span>
                    <ul className="space-y-1 text-slate-600 font-medium">
                      <li>• If completed early within window &rarr; Tagged <strong className="text-emerald-700">"Within SLA"</strong></li>
                      <li>• If still ongoing or completed after window &rarr; Tagged <strong className="text-amber-700">"Grace Period (Due 2027)"</strong></li>
                      <li className="text-[11px] text-amber-800 mt-1 font-semibold">Exempt from 2026 denominator per manager logic!</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* CONNECTOR */}
            <div className="flex justify-center -my-3">
              <ArrowDown className="w-5 h-5 text-indigo-500" />
            </div>

            {/* STAGE 7: FINAL TABLE VIEW */}
            <div className="flex items-center gap-4">
              <div className="w-48 shrink-0 text-right">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Step 7: Final Table</span>
                <p className="text-xs text-indigo-700 font-bold">Column Presentation</p>
              </div>

              <div className="flex-1 bg-indigo-900 text-white p-4 rounded-2xl border border-indigo-700 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                    Final External CCF Tracker Table Columns
                  </span>
                  <span className="text-[11px] bg-indigo-800 px-2 py-0.5 rounded text-indigo-200">
                    Direct 1:1 Mapping
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-[11px] font-mono">
                  <div className="bg-indigo-950/70 p-2 rounded border border-indigo-800/80">
                    <div className="text-indigo-400 text-[10px]">Col 1</div>
                    <div className="font-bold">Issue Key</div>
                  </div>
                  <div className="bg-indigo-950/70 p-2 rounded border border-indigo-800/80">
                    <div className="text-indigo-400 text-[10px]">Col 2</div>
                    <div className="font-bold">Status</div>
                  </div>
                  <div className="bg-indigo-950/70 p-2 rounded border border-indigo-800/80">
                    <div className="text-indigo-400 text-[10px]">Col 3</div>
                    <div className="font-bold">In Progress Date</div>
                  </div>
                  <div className="bg-indigo-950/70 p-2 rounded border border-indigo-800/80">
                    <div className="text-indigo-400 text-[10px]">Col 4</div>
                    <div className="font-bold">Monitoring Date</div>
                  </div>
                  <div className="bg-indigo-950/70 p-2 rounded border border-indigo-800/80">
                    <div className="text-indigo-400 text-[10px]">Col 5</div>
                    <div className="font-bold text-amber-300">SLA Count Days</div>
                  </div>
                  <div className="bg-indigo-950/70 p-2 rounded border border-indigo-800/80">
                    <div className="text-indigo-400 text-[10px]">Col 6</div>
                    <div className="font-bold text-emerald-300">SLA Status</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* SECTION 2: INTERACTIVE CALCULATION SANDBOX / SIMULATOR */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">
                B
              </span>
              Interactive Calculation Sandbox (Test Any Case)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Modify the status, dates, and development flag below to see real-time computation and gatekeeper enforcement.
            </p>
          </div>
          <button
            onClick={() => {
              setSimStatus('For Monitoring');
              setSimDevReq('No');
              setSimInProgressDate('2026-02-15');
              setSimMonitoringDate('2026-03-20');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Values</span>
          </button>
        </div>

        {/* INPUT CONTROLS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          {/* STATUS SELECT */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              1. Case Status
            </label>
            <select
              value={simStatus}
              onChange={(e) => setSimStatus(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="For Monitoring">For Monitoring (Eligible)</option>
              <option value="Completed">Completed (Eligible)</option>
              <option value="Under Development">Under Development (Gated Out)</option>
              <option value="In Progress">In Progress (Gated Out)</option>
              <option value="New">New (Gated Out)</option>
              <option value="Not Started">Not Started (Gated Out)</option>
            </select>
            <span className="text-[10px] text-slate-500 block mt-1">
              {simStatus === 'For Monitoring' || simStatus === 'Completed'
                ? '✅ Status passes gatekeeper'
                : '⛔ Status will be gated out (blank tags)'}
            </span>
          </div>

          {/* DEV REQUIRED SELECT */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              2. Dev Required?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSimDevReq('No')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  simDevReq === 'No'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                }`}
              >
                No (90d / 3m)
              </button>
              <button
                type="button"
                onClick={() => setSimDevReq('Yes')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  simDevReq === 'Yes'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                }`}
              >
                Yes (180d / 6m)
              </button>
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              Window: {simDevReq === 'Yes' ? '180 days (6 months)' : '90 days (3 months)'}
            </span>
          </div>

          {/* IN PROGRESS START DATE */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              3. In Progress Date
            </label>
            <input
              type="date"
              value={simInProgressDate}
              onChange={(e) => setSimInProgressDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[10px] text-slate-500 block mt-1">
              Start anchor for SLA window
            </span>
          </div>

          {/* MONITORING START DATE */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              4. Monitoring Date
            </label>
            <input
              type="date"
              value={simMonitoringDate}
              onChange={(e) => setSimMonitoringDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[10px] text-slate-500 block mt-1">
              Date moved into monitoring
            </span>
          </div>
        </div>

        {/* LIVE SIMULATOR OUTPUT CARD */}
        <div className={`p-5 rounded-2xl border-2 transition-all ${
          !simulationResult.isEligible
            ? 'bg-slate-50 border-slate-300'
            : simulationResult.finalTag === 'Within SLA'
            ? 'bg-emerald-50/70 border-emerald-300'
            : simulationResult.finalTag === 'Outside SLA'
            ? 'bg-rose-50/70 border-rose-300'
            : 'bg-amber-50/70 border-amber-300'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                !simulationResult.isEligible
                  ? 'bg-slate-200 text-slate-700'
                  : simulationResult.finalTag === 'Within SLA'
                  ? 'bg-emerald-600 text-white'
                  : simulationResult.finalTag === 'Outside SLA'
                  ? 'bg-rose-600 text-white'
                  : 'bg-amber-500 text-white'
              }`}>
                {!simulationResult.isEligible ? '—' : simulationResult.finalTag === 'Within SLA' ? '✓' : simulationResult.finalTag === 'Outside SLA' ? '✕' : '⏳'}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Live Evaluation Result:
                </span>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <span>Final Tag:</span>
                  <span className={`px-3 py-0.5 rounded-lg font-mono ${
                    !simulationResult.isEligible
                      ? 'bg-slate-200 text-slate-800'
                      : simulationResult.finalTag === 'Within SLA'
                      ? 'bg-emerald-200 text-emerald-950 font-black'
                      : simulationResult.finalTag === 'Outside SLA'
                      ? 'bg-rose-200 text-rose-950 font-black'
                      : 'bg-amber-200 text-amber-950 font-black'
                  }`}>
                    {simulationResult.finalTag}
                  </span>
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">SLA Count Days</span>
                <span className="font-bold text-slate-900">
                  {simulationResult.turnaroundDays !== null ? `${simulationResult.turnaroundDays} days` : '-'}
                </span>
              </div>
              <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">SLA Due Date</span>
                <span className="font-bold text-slate-900">{simulationResult.slaDueDate}</span>
              </div>
              <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px]">2026 KPI Counted?</span>
                <span className={`font-bold ${simulationResult.kpiCounted ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {simulationResult.kpiCounted ? 'YES (In Denominator)' : 'NO (Grace/Excluded)'}
                </span>
              </div>
            </div>
          </div>

          {/* EXPLANATION DETAIL */}
          <div className="mt-4 text-xs">
            {!simulationResult.isEligible ? (
              <div className="flex items-start gap-2.5 text-slate-700 bg-white/80 p-3 rounded-xl border border-slate-200">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block mb-0.5">Gatekeeper Enforced:</strong>
                  {simulationResult.rejectionReason}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white/80 p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">Calculation Audit:</span>
                  <div className="text-slate-600">• Turnaround: <span className="font-mono font-bold">{simMonitoringDate} - {simInProgressDate} = {simulationResult.turnaroundDays} days</span></div>
                  <div className="text-slate-600">• Threshold: <span className="font-mono font-bold">{simulationResult.slaWindowDays} days</span> ({simDevReq === 'Yes' ? 'With Dev' : 'No Dev'})</div>
                  <div className="text-slate-600">• SLA Due Date: <span className="font-mono font-bold">{simulationResult.slaDueDate}</span> ({simulationResult.isDueAfter2026 ? 'Matures in 2027' : 'Matures in 2026'})</div>
                </div>

                <div className="bg-white/80 p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">Table Column Outputs:</span>
                  <div className="text-slate-600 font-mono">• No Dev SLA: <span className="font-bold text-slate-900">{simulationResult.noDevSla}</span></div>
                  <div className="text-slate-600 font-mono">• With Dev SLA: <span className="font-bold text-slate-900">{simulationResult.withDevSla}</span></div>
                  <div className="text-slate-600 font-mono">• External SLA Status: <span className="font-bold text-slate-900">{simulationResult.finalTag}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: CONCRETE SAMPLE CASES TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-black">
                C
              </span>
              Sample Case Scenarios (Comparing All Business Branches)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Real-world examples illustrating each permutation of status, dev requirement, turnaround, and grace period.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 font-semibold bg-slate-100 px-3 py-1 rounded-full">
            6 Reference Archetypes
          </span>
        </div>

        {/* SAMPLE CASES TABLE */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3">Scenario</th>
                <th className="p-3">Status</th>
                <th className="p-3">Dev Req</th>
                <th className="p-3">In Progress Date</th>
                <th className="p-3">Monitoring Date</th>
                <th className="p-3">Count Days</th>
                <th className="p-3">SLA Due Date</th>
                <th className="p-3">No Dev SLA</th>
                <th className="p-3">With Dev SLA</th>
                <th className="p-3">SLA Status</th>
                <th className="p-3">Methodology Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sampleCases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3 font-bold text-slate-900">
                    <div>{c.title}</div>
                    <span className="text-[10px] text-slate-400 font-mono">{c.id}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      c.status === 'For Monitoring'
                        ? 'bg-blue-100 text-blue-800'
                        : c.status === 'Completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="p-3 font-semibold">{c.devReq}</td>
                  <td className="p-3 font-mono text-slate-700">{c.inProgress}</td>
                  <td className="p-3 font-mono text-slate-700">{c.monitoring}</td>
                  <td className="p-3 font-mono font-bold text-slate-900">{c.turnaround}</td>
                  <td className="p-3 font-mono text-slate-600">{c.dueDate}</td>
                  <td className="p-3 font-mono">
                    {c.slaNoDev === '-' ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                        {c.slaNoDev}
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono">
                    {c.slaWithDev === '-' ? (
                      <span className="text-slate-400">-</span>
                    ) : c.slaWithDev === 'Outside SLA' ? (
                      <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">
                        {c.slaWithDev}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
                        {c.slaWithDev}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {c.finalStatus === '-' ? (
                      <span className="text-slate-400 font-mono font-bold">-</span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${c.badgeColor}`}>
                        {c.finalStatus}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-slate-600 text-[11px] max-w-xs leading-relaxed">
                    {c.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: EXACT FORMULAS & KPI SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* FORMULA REFERENCE */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Code2 className="w-5 h-5 text-indigo-600" />
            Official Excel & System Formulas
          </h3>
          <div className="space-y-3 font-mono text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
                1. SLA Count Days Formula:
              </span>
              <div className="text-slate-800 font-bold">
                =IF(OR(Status="For Monitoring", Status="Completed"), [@[Monitoring Start Date]] - [@[In Progress Start Date]], "-")
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
                2. SLA Due Date Formula:
              </span>
              <div className="text-slate-800 font-bold">
                =EDATE([@[In Progress Start Date]], IF([@[Dev Required]]="Yes", 6, 3))
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
                3. Final SLA Compliance Tag Formula:
              </span>
              <div className="text-slate-800 font-bold leading-relaxed">
                =IF(NOT(OR(Status="For Monitoring", Status="Completed")), "-",<br />
                &nbsp;&nbsp;IF(SLA_Due_Date &gt; DATE(2026,12,31),<br />
                &nbsp;&nbsp;&nbsp;&nbsp;IF(Turnaround &lt;= Window, "Within SLA", "Grace Period (Due 2027)"),<br />
                &nbsp;&nbsp;&nbsp;&nbsp;IF(Turnaround &lt;= Window, "Within SLA", "Outside SLA")<br />
                &nbsp;&nbsp;)<br />
                )
              </div>
            </div>
          </div>
        </div>

        {/* KPI IMPACT & DENOMINATOR RULES */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            External CCF KPI Denominator Rules
          </h3>
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-xl text-emerald-950 font-medium">
              <strong className="text-emerald-900 block mb-0.5">SLA Compliance % Formula:</strong>
              <div className="font-mono font-bold text-xs">
                SLA Compliance % = (Within SLA Cases / Total Evaluated Cases) × 100
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  1
                </span>
                <p>
                  <strong>Included in Denominator:</strong> All cases with status "For Monitoring" or "Completed" that have an SLA Due Date maturing within calendar year 2026 (or completed early in 2026).
                </p>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  2
                </span>
                <p>
                  <strong>Grace Period Excluded:</strong> Cases maturing in 2027 that are not finished early are tagged <strong className="text-amber-800 font-bold">"Grace Period (Due 2027)"</strong> and excluded from the 2026 compliance denominator.
                </p>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  3
                </span>
                <p>
                  <strong>Active/Work-in-Progress Excluded:</strong> Cases with status "New", "In Progress", or "Under Development" are excluded from SLA scoring until they reach "For Monitoring" or "Completed".
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
