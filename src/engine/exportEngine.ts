import type { PanelState, Panel } from './types';
import { render2d } from './render2d';
import { computeStats } from './panelEngine';

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSVG(state: PanelState, panels: Panel[]) {
  if (!panels.length || !panels.some(p => p.holes.length)) return;

  const isAll = panels.length > 1;
  if (isAll) {
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${state.wallW}in" height="${state.wallH}in" viewBox="0 0 ${state.wallW} ${state.wallH}">\n`;
    for (const p of panels) {
      svg += `  <g id="panel-${p.label}" transform="translate(${p.x.toFixed(4)},${p.y.toFixed(4)})">\n`;
      svg += `    <rect x="0" y="0" width="${p.w}" height="${p.h}" fill="none" stroke="#000" stroke-width="0.01"/>\n`;
      for (const h of p.holes) {
        svg += `    <circle cx="${h.x.toFixed(4)}" cy="${h.y.toFixed(4)}" r="${(h.d / 2).toFixed(4)}" fill="none" stroke="#000" stroke-width="0.005"/>\n`;
      }
      svg += `  </g>\n`;
    }
    svg += `</svg>`;
    downloadFile('wall-all-panels.svg', svg, 'image/svg+xml');
  } else {
    const p = panels[0];
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}in" height="${p.h}in" viewBox="0 0 ${p.w} ${p.h}">\n`;
    svg += `  <rect x="0" y="0" width="${p.w}" height="${p.h}" fill="none" stroke="#000" stroke-width="0.01"/>\n`;
    for (const h of p.holes) {
      svg += `  <circle cx="${h.x.toFixed(4)}" cy="${h.y.toFixed(4)}" r="${(h.d / 2).toFixed(4)}" fill="none" stroke="#000" stroke-width="0.005"/>\n`;
    }
    svg += `</svg>`;
    downloadFile(`panel-${p.label}.svg`, svg, 'image/svg+xml');
  }
}

export function exportDXF(state: PanelState, panels: Panel[]) {
  if (!panels.length || !panels.some(p => p.holes.length)) return;

  const isAll = panels.length > 1;
  let dxf = '0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n2\n';
  dxf += '0\nLAYER\n2\nPANEL\n70\n0\n62\n7\n6\nCONTINUOUS\n';
  dxf += '0\nLAYER\n2\nHOLES\n70\n0\n62\n1\n6\nCONTINUOUS\n';
  dxf += '0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';

  const refH = isAll ? state.wallH : panels[0].h;
  for (const p of panels) {
    const ox = isAll ? p.x : 0;
    const oy = isAll ? p.y : 0;
    const corners: [number, number][] = [
      [ox, oy],
      [ox + p.w, oy],
      [ox + p.w, oy + p.h],
      [ox, oy + p.h],
    ];
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = corners[i];
      const [x2, y2] = corners[(i + 1) % 4];
      dxf += `0\nLINE\n8\nPANEL\n10\n${x1.toFixed(4)}\n20\n${(refH - y1).toFixed(4)}\n30\n0\n11\n${x2.toFixed(4)}\n21\n${(refH - y2).toFixed(4)}\n31\n0\n`;
    }
    for (const h of p.holes) {
      const hx = ox + h.x, hy = oy + h.y;
      dxf += `0\nCIRCLE\n8\nHOLES\n10\n${hx.toFixed(4)}\n20\n${(refH - hy).toFixed(4)}\n30\n0\n40\n${(h.d / 2).toFixed(4)}\n`;
    }
  }
  dxf += '0\nENDSEC\n0\nEOF\n';
  downloadFile(
    isAll ? 'wall-all-panels.dxf' : `panel-${panels[0].label}.dxf`,
    dxf,
    'application/dxf'
  );
}

export function exportPNG(canvas: HTMLCanvasElement) {
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wall.png';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ─── Shop Drawing PDF ─────────────────────────────────────────────────
function fmtFt(inches: number): string {
  const ft = Math.floor(inches / 12);
  const rem = +(inches - ft * 12).toFixed(2);
  if (rem === 0) return `${ft}'-0"`;
  return `${ft}'-${rem}"`;
}

function fmtUSD(n: number): string {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Generate a deterministic-ish drawing code: MRW-PRF-YYYYMMDD-XXXX
// The suffix is derived from design params so re-exporting the same design produces the same code.
function generateDrawingCode(state: PanelState): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const sig = `${state.wallW}x${state.wallH}x${state.panels.length}x${state.enabledHoleSizes.join(',')}x${state.spacingX}`;
  let hash = 0;
  for (let i = 0; i < sig.length; i++) hash = ((hash << 5) - hash + sig.charCodeAt(i)) | 0;
  const suffix = Math.abs(hash).toString(36).toUpperCase().padStart(4, '0').slice(0, 4);
  return `MRW-PRF-${ymd}-${suffix}`;
}

export async function exportShopDrawingPDF(state: PanelState) {
  // Lazy-load jsPDF so it doesn't bloat the main bundle
  const { default: jsPDF } = await import('jspdf');
  // Landscape Letter — 11" × 8.5"
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'letter' });
  const pageW = 11, pageH = 8.5;
  const margin = 0.4;
  const drawingCode = generateDrawingCode(state);

  // Reserve space: title block 1.2in + legal footer 0.35in = 1.55in bottom
  const tbH = 1.2;
  const footerH = 0.4;
  const tbY = pageH - margin - footerH - tbH;

  // Render elevation on off-screen canvas at print-quality resolution
  const elevCanvas = document.createElement('canvas');
  const aspect = state.wallW / state.wallH;
  const drawAreaW = pageW - 2 * margin;
  const drawAreaH = tbY - margin - 0.35;  // leave ~0.35 in headroom above title block for the estimate total
  const elevBoxW = Math.min(drawAreaW, drawAreaH * aspect);
  const elevBoxH = elevBoxW / aspect;
  const dpi = 240;
  elevCanvas.width = Math.round(elevBoxW * dpi);
  elevCanvas.height = Math.round(elevBoxH * dpi);

  // Extra padding so dimension lines fit outside the wall
  const pad = 0.12;
  const zoomX = (elevCanvas.width * (1 - 2 * pad)) / state.wallW;
  const zoomY = (elevCanvas.height * (1 - 2 * pad)) / state.wallH;
  const zoom = Math.min(zoomX, zoomY);
  const camX = (elevCanvas.width - state.wallW * zoom) / 2;
  const camY = (elevCanvas.height - state.wallH * zoom) / 2;

  const paperState: PanelState = { ...state, bgColor: '#ffffff', panelColor: '#e8e8e8' };
  render2d(elevCanvas, paperState, camX, camY, zoom, 'light');

  const imgData = elevCanvas.toDataURL('image/png');
  const elevX = (pageW - elevBoxW) / 2;
  const elevY = margin;
  pdf.addImage(imgData, 'PNG', elevX, elevY, elevBoxW, elevBoxH);

  // ─── Pricing strip (above title block, right-aligned) ────────────
  const stats = computeStats(state);
  const pricingX = pageW - margin - 0.1;
  const pricingY = tbY - 0.08;
  pdf.setFontSize(7);
  pdf.setTextColor(120);
  pdf.setFont('helvetica', 'normal');

  const pricingLines: [string, number][] = [
    ['Perforated Panels', stats.panelCost],
  ];
  if (state.backlight) {
    const label = stats.backlightType === 'programmable' ? 'Programmable RGB Lighting' : 'RGB Lighting';
    pricingLines.push([label, stats.backlightCost]);
  }

  // Draw each line item
  let py = pricingY - 0.3 - pricingLines.length * 0.18;
  for (const [label, cost] of pricingLines) {
    pdf.setTextColor(90);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(label, pricingX - 1.4, py, { align: 'right' });
    pdf.setTextColor(30);
    pdf.setFont('helvetica', 'bold');
    pdf.text(fmtUSD(cost), pricingX, py, { align: 'right' });
    py += 0.18;
  }

  // Divider
  pdf.setDrawColor(150);
  pdf.setLineWidth(0.01);
  pdf.line(pricingX - 1.8, py - 0.07, pricingX, py - 0.07);

  // Total
  pdf.setFontSize(7);
  pdf.setTextColor(120);
  pdf.setFont('helvetica', 'normal');
  pdf.text('ESTIMATED TOTAL', pricingX - 1.4, py + 0.05, { align: 'right' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(20);
  pdf.text(fmtUSD(stats.estimatedTotal), pricingX, py + 0.1, { align: 'right' });

  // ─── Title block ─────────────────────────────────────────────────
  pdf.setDrawColor(50);
  pdf.setLineWidth(0.02);
  pdf.rect(margin, tbY, pageW - 2 * margin, tbH);
  pdf.line(margin + 2.7, tbY, margin + 2.7, tbY + tbH);
  pdf.line(margin + 6.4, tbY, margin + 6.4, tbY + tbH);

  // Left block — brand
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(30);
  pdf.text('M|R Walls', margin + 0.15, tbY + 0.28);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(80);
  pdf.text('Mario Romano Walls', margin + 0.15, tbY + 0.48);
  pdf.text('2314 Michigan Ave, Santa Monica, CA 90404', margin + 0.15, tbY + 0.62);
  pdf.text('310-243-6967  ·  marioromano.com', margin + 0.15, tbY + 0.76);
  pdf.setFontSize(7);
  pdf.setTextColor(120);
  pdf.text('CO-PRF-02', margin + 0.15, tbY + tbH - 0.1);

  // Middle block — project spec
  const mx = margin + 2.85;
  pdf.setFontSize(7);
  pdf.setTextColor(120);
  pdf.text('PROJECT', mx, tbY + 0.18);
  pdf.setFontSize(11);
  pdf.setTextColor(30);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Perforated Panel Wall', mx, tbY + 0.38);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  const specs: [string, string][] = [
    ['Wall Size', `${fmtFt(state.wallW)} × ${fmtFt(state.wallH)}`],
    ['Design', state.imageName || 'Custom'],
    ['Panels', `${state.colWidths.length} × ${state.rowHeights.length} = ${state.panels.length}`],
    ['Material', 'Corian'],
    ['Backlight', state.backlight ? (state.backlightMode === 'gradient' ? 'Programmable RGB' : 'RGB Solid') : 'None'],
  ];
  let sy = tbY + 0.56;
  for (const [k, v] of specs) {
    pdf.setTextColor(120);
    pdf.text(k, mx, sy);
    pdf.setTextColor(30);
    pdf.text(v, mx + 1.2, sy);
    sy += 0.15;
  }

  // Right block — drawing info
  const rx = margin + 6.55;
  pdf.setFontSize(7);
  pdf.setTextColor(120);
  pdf.text('DRAWING TYPE', rx, tbY + 0.18);
  pdf.setFontSize(11);
  pdf.setTextColor(30);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Shop Drawing', rx, tbY + 0.38);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  const rightSpecs: [string, string][] = [
    ['Code', drawingCode],
    ['Sheet', 'SD1'],
    ['Scale', 'NTS'],
    ['Date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })],
    ['Panel Area', `${stats.panelSF.toFixed(1)} SF`],
  ];
  let ry = tbY + 0.56;
  for (const [k, v] of rightSpecs) {
    pdf.setTextColor(120);
    pdf.text(k, rx, ry);
    pdf.setTextColor(30);
    if (k === 'Code') {
      pdf.setFont('courier', 'bold');
      pdf.text(v, rx + 0.5, ry);
      pdf.setFont('helvetica', 'normal');
    } else {
      pdf.text(v, rx + 0.85, ry);
    }
    ry += 0.15;
  }

  // ─── Legal footer (below title block, no overlap) ────────────────
  const footerY = tbY + tbH + 0.08;
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(6.5);
  pdf.setTextColor(110);
  pdf.text(
    'By signing, client acknowledges all dimensions, panel layouts, and cutouts are correct. Once signed, this document is used for fabrication; no further changes can be made.',
    margin + 0.15,
    footerY,
    { maxWidth: pageW - 2 * margin - 0.3 },
  );
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(80);
  pdf.text(
    'PROPRIETARY: This design and drawing are the intellectual property of Mario Romano Walls. The product depicted herein may only be manufactured by M|R Walls. Reproduction, duplication, or fabrication by any third party is prohibited.',
    margin + 0.15,
    footerY + 0.13,
    { maxWidth: pageW - 2 * margin - 0.3 },
  );

  pdf.save(`${drawingCode}.pdf`);
}
