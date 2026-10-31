import pptxgen from 'pptxgenjs';
import { CcfAggregateStats, ExternalKpiStats, OwnerIndexSummary } from '../types/ccf';

export async function exportKpiPresentation({
  internalStats,
  externalStats,
  internalOwnerSummaries,
  totalRows,
  count2026,
  countBacklog,
  countExternal,
}: {
  internalStats: CcfAggregateStats;
  externalStats: ExternalKpiStats;
  internalOwnerSummaries: OwnerIndexSummary[];
  totalRows: number;
  count2026: number;
  countBacklog: number;
  countExternal: number;
}): Promise<void> {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = 'Change Factory Index - Executive 2 KPIs Governance Presentation';
  pptx.author = 'etisalat CCF Engine';
  pptx.company = 'etisalat by e&';

  const BRAND_RED = 'E30613';
  const BG_DARK = '0B0F19';
  const TEXT_WHITE = 'FFFFFF';
  const TEXT_MUTED = '94A3B8';
  const CARD_BG = '1E293B';
  const BORDER_COLOR = '334155';

  const internalStatus =
    internalStats.overallIndex >= internalStats.targetIndex ? 'Target Met' : 'Under Target';
  const externalStatus =
    externalStats.externalSlaPct >= externalStats.targetIndex ? 'Target Met' : 'Under Target';
  const breachedExternal = Math.max(0, externalStats.totalExternalCases - externalStats.withinSlaCount);
  const blendedSlaPct =
    internalStats.totalCases > 0
      ? (((internalStats.newCasesWithinSla + internalStats.oldCasesWithinSla) /
          internalStats.totalCases) *
        100).toFixed(1)
      : '0.0';

  // -------------------------------------------------------------
  // SLIDE 1: Title Slide (Executive Brand Cover)
  // -------------------------------------------------------------
  const slide1 = pptx.addSlide();
  slide1.background = { color: BG_DARK };

  // Decorative top red brand accent line
  slide1.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.15,
    fill: { color: BRAND_RED },
  });

  // Brand Name
  slide1.addText('etisalat', {
    x: 1.0,
    y: 1.8,
    w: 6.0,
    h: 0.8,
    fontSize: 38,
    bold: true,
    color: BRAND_RED,
    fontFace: 'Arial',
  });

  // Presentation Main Title
  slide1.addText('Change Factory Index', {
    x: 1.0,
    y: 2.7,
    w: 11.0,
    h: 1.0,
    fontSize: 32,
    bold: true,
    color: TEXT_WHITE,
    fontFace: 'Arial',
  });

  // Subtitle
  slide1.addText('Executive 2-KPI Governance & Operational Trackers Review (CY2026)', {
    x: 1.0,
    y: 3.7,
    w: 11.0,
    h: 0.6,
    fontSize: 16,
    color: TEXT_MUTED,
    fontFace: 'Arial',
  });

  // Key Quick Metrics Summary Box
  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 1.0,
    y: 4.8,
    w: 11.33,
    h: 1.4,
    fill: { color: CARD_BG },
    line: { color: BORDER_COLOR, width: 1 },
    rectRadius: 0.15,
  });

  slide1.addText(
    [
      { text: 'Internal CCF Index: ', options: { bold: false, color: TEXT_MUTED } },
      { text: `${internalStats.overallIndex.toFixed(2)} `, options: { bold: true, color: BRAND_RED } },
      { text: `(Target: ${internalStats.targetIndex.toFixed(2)})   |   `, options: { color: TEXT_MUTED } },
      { text: 'External SLA Rate: ', options: { bold: false, color: TEXT_MUTED } },
      { text: `${externalStats.externalSlaPct.toFixed(1)}% `, options: { bold: true, color: '38BDF8' } },
      { text: `(Target: ${externalStats.targetIndex.toFixed(0)}%)   |   `, options: { color: TEXT_MUTED } },
      { text: 'Total Processed Cases: ', options: { bold: false, color: TEXT_MUTED } },
      { text: `${totalRows}`, options: { bold: true, color: TEXT_WHITE } },
    ],
    {
      x: 1.3,
      y: 5.2,
      w: 10.7,
      h: 0.6,
      fontSize: 14,
      fontFace: 'Arial',
      align: 'center',
    }
  );

  // -------------------------------------------------------------
  // SLIDE 2: KPI 1 - Internal CCF KPI Dashboard
  // -------------------------------------------------------------
  const slide2 = pptx.addSlide();
  slide2.background = { color: 'F8FAFC' };

  slide2.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.9,
    fill: { color: '0F172A' },
  });

  slide2.addText('KPI 1: Internal CCF Executive Dashboard', {
    x: 0.8,
    y: 0.15,
    w: 9.0,
    h: 0.6,
    fontSize: 20,
    bold: true,
    color: TEXT_WHITE,
    fontFace: 'Arial',
  });

  slide2.addText('Joint Governance: 50% CY26 Tracker + 50% Legacy Backlog Tracker', {
    x: 0.8,
    y: 1.05,
    w: 11.5,
    h: 0.4,
    fontSize: 12,
    color: '64748B',
    fontFace: 'Arial',
  });

  const kpiCards = [
    { title: 'Overall Factory Index', value: internalStats.overallIndex.toFixed(2), sub: `Target: ${internalStats.targetIndex.toFixed(2)} (${internalStatus})`, color: BRAND_RED },
    { title: 'CY26 Tracker Volume', value: `${count2026}`, sub: '50% Internal KPI Weight', color: '0F172A' },
    { title: 'Legacy Backlog Volume', value: `${countBacklog}`, sub: '50% Internal KPI Weight', color: 'D97706' },
    { title: '≤90 Days SLA Compliance', value: `${blendedSlaPct}%`, sub: `${internalStats.newCasesWithinSla + internalStats.oldCasesWithinSla} Cases on Track`, color: '16A34A' },
  ];

  kpiCards.forEach((card, idx) => {
    const cardX = 0.8 + idx * 2.95;
    slide2.addShape(pptx.ShapeType.roundRect, {
      x: cardX,
      y: 1.5,
      w: 2.8,
      h: 1.6,
      fill: { color: 'FFFFFF' },
      line: { color: 'E2E8F0', width: 1 },
      rectRadius: 0.1,
    });

    slide2.addText(card.title, {
      x: cardX + 0.15,
      y: 1.6,
      w: 2.5,
      h: 0.3,
      fontSize: 10,
      bold: true,
      color: '64748B',
      fontFace: 'Arial',
    });

    slide2.addText(card.value, {
      x: cardX + 0.15,
      y: 1.95,
      w: 2.5,
      h: 0.6,
      fontSize: 24,
      bold: true,
      color: card.color,
      fontFace: 'Arial',
    });

    slide2.addText(card.sub, {
      x: cardX + 0.15,
      y: 2.6,
      w: 2.5,
      h: 0.4,
      fontSize: 9,
      color: '64748B',
      fontFace: 'Arial',
    });
  });

  // Owner Breakdown Table
  const tableRows: pptxgen.TableRow[] = [
    [
      { text: 'Owner / Assignee', options: { bold: true, color: 'FFFFFF', fill: { color: '0F172A' } } },
      { text: 'HOD', options: { bold: true, color: 'FFFFFF', fill: { color: '0F172A' }, align: 'center' } },
      { text: 'Total Cases', options: { bold: true, color: 'FFFFFF', fill: { color: '0F172A' }, align: 'center' } },
      { text: 'Closed / Solved', options: { bold: true, color: 'FFFFFF', fill: { color: '0F172A' }, align: 'center' } },
      { text: 'On Target %', options: { bold: true, color: 'FFFFFF', fill: { color: '0F172A' }, align: 'center' } },
      { text: 'Factory Index %', options: { bold: true, color: 'FFFFFF', fill: { color: '0F172A' }, align: 'center' } },
    ],
  ];

  internalOwnerSummaries.slice(0, 7).forEach((owner) => {
    tableRows.push([
      { text: owner.owner, options: { bold: true, color: '1E293B' } },
      { text: owner.hod || '-', options: { align: 'center', color: '475569' } },
      { text: `${owner.newCasesCount + owner.oldCasesCount}`, options: { align: 'center', color: '475569' } },
      { text: `${owner.onTargetCompleted}`, options: { align: 'center', color: '475569' } },
      { text: `${owner.onTargetPct}%`, options: { align: 'center', color: '475569' } },
      { text: `${owner.changeFactoryIndex.toFixed(1)}%`, options: { bold: true, align: 'center', color: BRAND_RED } },
    ]);
  });

  slide2.addTable(tableRows, {
    x: 0.8,
    y: 3.3,
    w: 11.7,
    h: 3.5,
    fontSize: 9,
    fontFace: 'Arial',
    border: { pt: 0.5, color: 'CBD5E1' },
    fill: { color: 'FFFFFF' },
  });

  // -------------------------------------------------------------
  // SLIDE 3: KPI 2 - External CCF KPI Dashboard
  // -------------------------------------------------------------
  const slide3 = pptx.addSlide();
  slide3.background = { color: 'F8FAFC' };

  slide3.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.9,
    fill: { color: '0F172A' },
  });

  slide3.addText('KPI 2: External CCF Vendor Performance Dashboard', {
    x: 0.8,
    y: 0.15,
    w: 9.0,
    h: 0.6,
    fontSize: 20,
    bold: true,
    color: TEXT_WHITE,
    fontFace: 'Arial',
  });

  slide3.addText('Vendor & Third-Party SLA Governance Dashboard', {
    x: 0.8,
    y: 1.05,
    w: 11.5,
    h: 0.4,
    fontSize: 12,
    color: '64748B',
    fontFace: 'Arial',
  });

  const extCards = [
    { title: 'External SLA Compliance', value: `${externalStats.externalSlaPct.toFixed(1)}%`, sub: `Target: ${externalStats.targetIndex}% (${externalStatus})`, color: '0284C7' },
    { title: 'Total Vendor CCFs', value: `${externalStats.totalExternalCases}`, sub: 'Active & Historical', color: '0F172A' },
    { title: 'Within SLA Cases', value: `${externalStats.withinSlaCount}`, sub: 'Vendor SLA Maintained', color: '16A34A' },
    { title: 'Breached Cases', value: `${breachedExternal}`, sub: 'Escalation Threshold', color: BRAND_RED },
  ];

  extCards.forEach((card, idx) => {
    const cardX = 0.8 + idx * 2.95;
    slide3.addShape(pptx.ShapeType.roundRect, {
      x: cardX,
      y: 1.5,
      w: 2.8,
      h: 1.6,
      fill: { color: 'FFFFFF' },
      line: { color: 'E2E8F0', width: 1 },
      rectRadius: 0.1,
    });

    slide3.addText(card.title, {
      x: cardX + 0.15,
      y: 1.6,
      w: 2.5,
      h: 0.3,
      fontSize: 10,
      bold: true,
      color: '64748B',
      fontFace: 'Arial',
    });

    slide3.addText(card.value, {
      x: cardX + 0.15,
      y: 1.95,
      w: 2.5,
      h: 0.6,
      fontSize: 24,
      bold: true,
      color: card.color,
      fontFace: 'Arial',
    });

    slide3.addText(card.sub, {
      x: cardX + 0.15,
      y: 2.6,
      w: 2.5,
      h: 0.4,
      fontSize: 9,
      color: '64748B',
      fontFace: 'Arial',
    });
  });

  // Vendor Breakdown Table
  const vendorRows: pptxgen.TableRow[] = [
    [
      { text: 'Vendor Partner / System', options: { bold: true, color: 'FFFFFF', fill: { color: '0F172A' } } },
      { text: 'Assigned Cases', options: { bold: true, color: 'FFFFFF', fill: { color: '0F172A' }, align: 'center' } },
      { text: 'Within SLA', options: { bold: true, color: 'FFFFFF', fill: { color: '0F172A' }, align: 'center' } },
      { text: 'Breached', options: { bold: true, color: 'FFFFFF', fill: { color: '0F172A' }, align: 'center' } },
      { text: 'SLA Compliance Rate', options: { bold: true, color: 'FFFFFF', fill: { color: '0F172A' }, align: 'center' } },
    ],
  ];

  if (externalStats.partnerBreakdown && externalStats.partnerBreakdown.length > 0) {
    externalStats.partnerBreakdown.slice(0, 7).forEach((vendor) => {
      const vBreached = Math.max(0, vendor.total - vendor.withinSla);
      vendorRows.push([
        { text: vendor.partner, options: { bold: true, color: '1E293B' } },
        { text: `${vendor.total}`, options: { align: 'center', color: '475569' } },
        { text: `${vendor.withinSla}`, options: { align: 'center', color: '16A34A' } },
        { text: `${vBreached}`, options: { align: 'center', color: vBreached > 0 ? 'DC2626' : '475569' } },
        { text: `${vendor.slaPct.toFixed(1)}%`, options: { bold: true, align: 'center', color: vendor.slaPct >= 85 ? '0284C7' : 'DC2626' } },
      ]);
    });
  } else {
    vendorRows.push([
      { text: 'Vendor Pool (Aggregated)', options: { bold: true, color: '1E293B' } },
      { text: `${externalStats.totalExternalCases}`, options: { align: 'center', color: '475569' } },
      { text: `${externalStats.withinSlaCount}`, options: { align: 'center', color: '16A34A' } },
      { text: `${breachedExternal}`, options: { align: 'center', color: 'DC2626' } },
      { text: `${externalStats.externalSlaPct.toFixed(1)}%`, options: { bold: true, align: 'center', color: '0284C7' } },
    ]);
  }

  slide3.addTable(vendorRows, {
    x: 0.8,
    y: 3.3,
    w: 11.7,
    h: 3.5,
    fontSize: 9,
    fontFace: 'Arial',
    border: { pt: 0.5, color: 'CBD5E1' },
    fill: { color: 'FFFFFF' },
  });

  // -------------------------------------------------------------
  // SLIDE 4: Operational Trackers Synthesis
  // -------------------------------------------------------------
  const slide4 = pptx.addSlide();
  slide4.background = { color: BG_DARK };

  slide4.addText('Operational Trackers Synthesis', {
    x: 0.8,
    y: 0.6,
    w: 11.0,
    h: 0.6,
    fontSize: 24,
    bold: true,
    color: TEXT_WHITE,
    fontFace: 'Arial',
  });

  slide4.addText('Detailed Segregation across 3 Discrete Operational Engines', {
    x: 0.8,
    y: 1.2,
    w: 11.0,
    h: 0.4,
    fontSize: 14,
    color: TEXT_MUTED,
    fontFace: 'Arial',
  });

  const trackerBoxes = [
    {
      title: '1. 2026 CCF Tracker (CY26)',
      desc: 'Controls 50% of Internal CCF KPI.\nCalculates SLA Days, Created Month, and resolution benchmarks for new CY2026 cases.',
      count: `${count2026} Cases`,
      accent: BRAND_RED,
    },
    {
      title: '2. Backlog CCF Tracker (Legacy)',
      desc: 'Controls 50% of Internal CCF KPI.\nEnforces governance over historic pre-2026 change control records until final resolution.',
      count: `${countBacklog} Cases`,
      accent: 'D97706',
    },
    {
      title: '3. External CCF Tracker (Vendors)',
      desc: 'Controls 100% of External CCF KPI.\nMonitors partner and vendor SLA agreements against contracted cycle times.',
      count: `${countExternal} Cases`,
      accent: '38BDF8',
    },
  ];

  trackerBoxes.forEach((box, idx) => {
    const boxX = 0.8 + idx * 3.95;
    slide4.addShape(pptx.ShapeType.roundRect, {
      x: boxX,
      y: 2.0,
      w: 3.75,
      h: 4.5,
      fill: { color: CARD_BG },
      line: { color: BORDER_COLOR, width: 1 },
      rectRadius: 0.15,
    });

    slide4.addText(box.title, {
      x: boxX + 0.25,
      y: 2.3,
      w: 3.25,
      h: 0.5,
      fontSize: 13,
      bold: true,
      color: box.accent,
      fontFace: 'Arial',
    });

    slide4.addText(box.count, {
      x: boxX + 0.25,
      y: 2.9,
      w: 3.25,
      h: 0.7,
      fontSize: 28,
      bold: true,
      color: TEXT_WHITE,
      fontFace: 'Arial',
    });

    slide4.addText(box.desc, {
      x: boxX + 0.25,
      y: 3.8,
      w: 3.25,
      h: 2.2,
      fontSize: 11,
      color: TEXT_MUTED,
      fontFace: 'Arial',
    });
  });

  await pptx.writeFile({ fileName: 'Change_Factory_Index_Executive_2_KPIs.pptx' });
}
