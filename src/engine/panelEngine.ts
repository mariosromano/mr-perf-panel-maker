import type { PanelState, Panel, AxisSolution, LayoutOption, LightingPreset } from './types';

// ─── Image Processing ────────────────────────────────────────────────
export function processImage(state: PanelState): { grayPixels: Float32Array; imgWidth: number; imgHeight: number } | null {
  const img = state.sourceImage;
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const cx = c.getContext('2d')!;
  cx.drawImage(img, 0, 0);
  const data = cx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  const gray = new Float32Array(c.width * c.height);
  const br = state.brightness / 100;
  const co = state.contrast / 100;
  const cf = (1 + co) / (1 - co + 0.001);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    let v = (px[idx] * 0.299 + px[idx + 1] * 0.587 + px[idx + 2] * 0.114) / 255;
    v = (v + br - 0.5) * cf + 0.5;
    if (state.invert) v = 1 - v;
    gray[i] = Math.max(0, Math.min(1, v));
  }
  return { grayPixels: gray, imgWidth: c.width, imgHeight: c.height };
}

export function sampleImage(state: PanelState, u: number, v: number): number {
  const g = state.grayPixels;
  if (!g) return 1;
  const w = state.imgWidth, h = state.imgHeight;
  const fx = Math.max(0, Math.min(1, u)) * (w - 1);
  const fy = Math.max(0, Math.min(1, v)) * (h - 1);
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
  const dx = fx - x0, dy = fy - y0;
  return g[y0 * w + x0] * (1 - dx) * (1 - dy) +
         g[y0 * w + x1] * dx * (1 - dy) +
         g[y1 * w + x0] * (1 - dx) * dy +
         g[y1 * w + x1] * dx * dy;
}

// ─── Layout Solver ───────────────────────────────────────────────────
export function solveAxis(wallDim: number, gap: number, sizes: number[]): AxisSolution[] {
  if (!sizes.length) return [];
  const sorted = sizes.slice().sort((a, b) => b - a);
  const results: AxisSolution[] = [];

  function recurse(idx: number, totalDim: number, numPanels: number, counts: Record<number, number>) {
    const totalWithGaps = totalDim + Math.max(0, numPanels - 1) * gap;
    if (totalWithGaps > wallDim + gap + 0.01) return;
    if (numPanels > 0) {
      results.push({
        counts: { ...counts },
        total: totalWithGaps,
        coverage: totalWithGaps / wallDim,
        numPanels,
      });
    }
    if (idx >= sorted.length) return;
    const size = sorted[idx];
    const maxN = Math.floor((wallDim - totalWithGaps + gap) / (size + (numPanels > 0 ? gap : 0)));
    for (let n = 0; n <= Math.min(maxN, 30); n++) {
      counts[size] = (counts[size] || 0) + n;
      recurse(idx + 1, totalDim + n * size, numPanels + n, counts);
      counts[size] -= n;
      if (counts[size] === 0) delete counts[size];
    }
  }

  recurse(0, 0, 0, {});

  results.sort((a, b) => {
    const cd = b.coverage - a.coverage;
    if (Math.abs(cd) > 0.003) return cd;
    const distinct = Object.keys(a.counts).length - Object.keys(b.counts).length;
    if (distinct !== 0) return distinct;
    return a.numPanels - b.numPanels;
  });

  const seen = new Set<string>();
  const unique: AxisSolution[] = [];
  for (const r of results) {
    const key = Object.entries(r.counts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  }
  return unique.slice(0, 12);
}

export function arrangeAxis(counts: Record<number, number>): number[] {
  const entries = Object.entries(counts).map(([k, v]) => [parseInt(k), v] as [number, number]).sort(([a], [b]) => a - b);
  const all: number[] = [];
  for (const [size, count] of entries) {
    for (let i = 0; i < count; i++) all.push(size);
  }
  if (all.length <= 2) return all;

  const largest = Math.max(...all);
  const edges = all.filter(p => p < largest);
  const middles = all.filter(p => p === largest);
  const leftEdge = edges.slice(0, Math.ceil(edges.length / 2));
  const rightEdge = edges.slice(Math.ceil(edges.length / 2));
  return [...leftEdge, ...middles, ...rightEdge];
}

function describeCounts(counts: Record<number, number>): string {
  const entries = Object.entries(counts).map(([k, v]) => [parseInt(k), v] as [number, number]).sort(([a], [b]) => a - b);
  return entries.map(([s, n]) => n === 1 ? `${s}"` : `${n}x${s}"`).join(' + ');
}

export function solveAndBuildPanels(state: PanelState): {
  layoutOptions: LayoutOption[];
  panels: Panel[];
  colWidths: number[];
  rowHeights: number[];
} {
  const wSolutions = solveAxis(state.wallW, state.panelGap, state.enabledWidths);
  const hSolutions = solveAxis(state.wallH, state.panelGap, state.enabledHeights);

  if (!wSolutions.length || !hSolutions.length) {
    return { layoutOptions: [], panels: [], colWidths: [], rowHeights: [] };
  }

  const combos: LayoutOption[] = [];
  const maxW = Math.min(wSolutions.length, 6);
  const maxH = Math.min(hSolutions.length, 6);
  for (let wi = 0; wi < maxW; wi++) {
    for (let hi = 0; hi < maxH; hi++) {
      const w = wSolutions[wi], h = hSolutions[hi];
      const totalCoverage = (w.coverage + h.coverage) / 2;
      const totalPanels = w.numPanels * h.numPanels;
      combos.push({
        w,
        h,
        totalCoverage,
        totalPanels,
        desc: `W: ${describeCounts(w.counts)} | H: ${describeCounts(h.counts)}`,
      });
    }
  }

  combos.sort((a, b) => {
    const cd = b.totalCoverage - a.totalCoverage;
    if (Math.abs(cd) > 0.003) return cd;
    return a.totalPanels - b.totalPanels;
  });

  const layoutOptions = combos.slice(0, 15);

  // Apply the selected layout
  const idx = Math.min(state.selectedLayoutIdx, layoutOptions.length - 1);
  if (layoutOptions.length === 0) {
    return { layoutOptions: [], panels: [], colWidths: [], rowHeights: [] };
  }

  const opt = layoutOptions[Math.max(0, idx)];
  const colWidths = arrangeAxis(opt.w.counts);
  const rowHeights = arrangeAxis(opt.h.counts);

  const gap = state.panelGap;
  const totalW = colWidths.reduce((s, v) => s + v, 0) + (colWidths.length - 1) * gap;
  const totalH = rowHeights.reduce((s, v) => s + v, 0) + (rowHeights.length - 1) * gap;
  const offsetX = (state.wallW - totalW) / 2;
  const offsetY = (state.wallH - totalH) / 2;

  const panels: Panel[] = [];
  let yPos = offsetY;
  for (let r = 0; r < rowHeights.length; r++) {
    let xPos = offsetX;
    for (let c = 0; c < colWidths.length; c++) {
      const pw = colWidths[c], ph = rowHeights[r];
      panels.push({
        x: xPos,
        y: yPos,
        w: pw,
        h: ph,
        col: c,
        row: r,
        label: `${String.fromCharCode(65 + r)}${c + 1}`,
        sizeLabel: `${pw}"x${ph}"`,
        holes: [],
      });
      xPos += pw + gap;
    }
    yPos += rowHeights[r] + gap;
  }

  return { layoutOptions, panels, colWidths, rowHeights };
}

// ─── Hole Computation ────────────────────────────────────────────────
export function computeAllHoles(state: PanelState): { panels: Panel[]; gridInfo: { cols: number; rows: number } } {
  const panels = state.panels.map(p => ({ ...p, holes: [...p.holes] }));

  if (!state.grayPixels) {
    panels.forEach(p => (p.holes = []));
    return { panels, gridInfo: { cols: 0, rows: 0 } };
  }

  const wW = state.wallW, wH = state.wallH, m = state.margin;
  const thresh = state.threshold / 255, gam = state.gamma;
  const sizes = state.enabledHoleSizes.slice().sort((a, b) => a - b);
  if (!sizes.length) {
    panels.forEach(p => (p.holes = []));
    return { panels, gridInfo: { cols: 0, rows: 0 } };
  }
  const minD = sizes[0], maxD = sizes[sizes.length - 1];

  let lastGridInfo = { cols: 0, rows: 0 };

  for (const panel of panels) {
    const pW = panel.w, pH = panel.h;
    const areaW = pW - 2 * m, areaH = pH - 2 * m;
    if (areaW <= 0 || areaH <= 0) {
      panel.holes = [];
      continue;
    }

    let cols: number, rows: number;
    const minSp = state.minSpacing;
    if (state.spacingMode === 'spacing') {
      const sx = Math.max(minSp, state.spacingX);
      const sy = Math.max(minSp, state.spacingY);
      cols = Math.max(1, Math.floor(areaW / sx) + 1);
      rows = Math.max(1, Math.floor(areaH / sy) + 1);
    } else {
      const refW = Math.max(...state.colWidths) || 48;
      const refH = Math.max(...state.rowHeights) || 120;
      cols = Math.max(1, Math.round(state.gridCols * (areaW / (refW - 2 * m))));
      rows = Math.max(1, Math.round(state.gridRows * (areaH / (refH - 2 * m))));
      const maxCols = Math.floor(areaW / minSp) + 1;
      const maxRows = Math.floor(areaH / minSp) + 1;
      cols = Math.min(cols, maxCols);
      rows = Math.min(rows, maxRows);
    }
    lastGridInfo = { cols, rows };
    const holes: Panel['holes'] = [];

    for (let r = 0; r < rows; r++) {
      const isOdd = r % 2 === 1;
      const cCols = (state.gridPattern === 'hex' && isOdd) ? cols - 1 : cols;
      const sx = cols > 1 ? areaW / (cols - 1) : 0;
      const xOff = (state.gridPattern === 'hex' && isOdd) ? sx * 0.5 : 0;
      for (let c = 0; c < cCols; c++) {
        const lx = m + (cols > 1 ? c * (areaW / (cols - 1)) : areaW / 2) + xOff;
        const ly = m + (rows > 1 ? r * (areaH / (rows - 1)) : areaH / 2);
        if (lx < 0 || lx > pW || ly < 0 || ly > pH) continue;
        const u = (panel.x + lx) / wW, v = (panel.y + ly) / wH;
        const brightness = sampleImage(state, u, v);
        if (brightness > thresh) continue;
        const t = Math.pow(Math.max(0, Math.min(1, 1 - brightness / thresh)), gam);
        const rawDiam = minD + t * (maxD - minD);
        let bestSize = sizes[0], bestDist = Math.abs(rawDiam - sizes[0]);
        for (let si = 1; si < sizes.length; si++) {
          const dist = Math.abs(rawDiam - sizes[si]);
          if (dist < bestDist) {
            bestDist = dist;
            bestSize = sizes[si];
          }
        }
        holes.push({ x: lx, y: ly, d: bestSize });
      }
    }
    panel.holes = holes;
  }

  return { panels, gridInfo: lastGridInfo };
}

// ─── Statistics ──────────────────────────────────────────────────────
export function computeStats(state: PanelState): {
  totalHoles: number;
  openAreaPct: number;
  sizesUsed: number;
  panelSF: number;
  estimatedTotal: number;
} {
  const panels = state.panels;
  const totalHoles = panels.reduce((s, p) => s + p.holes.length, 0);

  let openArea = 0;
  const sizeCounts: Record<number, number> = {};
  for (const p of panels) {
    for (const h of p.holes) {
      openArea += Math.PI * (h.d / 2) * (h.d / 2);
      sizeCounts[h.d] = (sizeCounts[h.d] || 0) + 1;
    }
  }

  const totalArea = panels.reduce((s, p) => s + p.w * p.h, 0);
  const openAreaPct = totalArea > 0 ? (openArea / totalArea) * 100 : 0;
  const sizesUsed = Object.keys(sizeCounts).length;
  const panelSF = panels.reduce((s, p) => s + (p.w * p.h) / 144, 0);
  const estimatedTotal = panelSF * 42;

  return { totalHoles, openAreaPct, sizesUsed, panelSF, estimatedTotal };
}

// ─── Lighting Presets (from RibMaker) ────────────────────────────────
interface LightConfig {
  color: number;
  intensity: number;
  position: [number, number, number];
  castShadow?: boolean;
}

interface LightingConfig {
  background: number;
  hemisphere: { sky: number; ground: number; intensity: number };
  lights: LightConfig[];
}

export const LIGHTING_PRESETS: Record<LightingPreset, LightingConfig> = {
  standard: {
    background: 0x111111,
    hemisphere: { sky: 0xffffff, ground: 0x444444, intensity: 0.6 },
    lights: [
      { color: 0xffffff, intensity: 1.0, position: [20, 30, 40], castShadow: true },
      { color: 0x4488ff, intensity: 0.3, position: [-20, 10, -10] },
    ],
  },
  dramatic: {
    background: 0x0a0a0f,
    hemisphere: { sky: 0x222233, ground: 0x111111, intensity: 0.3 },
    lights: [
      { color: 0xffaa66, intensity: 1.8, position: [15, 25, 30], castShadow: true },
      { color: 0x2244aa, intensity: 0.6, position: [-30, 5, -20] },
    ],
  },
  sunset: {
    background: 0x1a0f0a,
    hemisphere: { sky: 0xff8844, ground: 0x331111, intensity: 0.4 },
    lights: [
      { color: 0xff6633, intensity: 1.5, position: [30, 15, 20], castShadow: true },
      { color: 0xff4422, intensity: 0.5, position: [-10, 20, -30] },
    ],
  },
  cool: {
    background: 0x0a0f1a,
    hemisphere: { sky: 0xaaccff, ground: 0x222233, intensity: 0.5 },
    lights: [
      { color: 0xccddff, intensity: 1.2, position: [20, 30, 25], castShadow: true },
      { color: 0x6688cc, intensity: 0.4, position: [-15, 10, -20] },
    ],
  },
  night: {
    background: 0x050510,
    hemisphere: { sky: 0x112244, ground: 0x050505, intensity: 0.2 },
    lights: [
      { color: 0x4466aa, intensity: 0.8, position: [10, 20, 30], castShadow: true },
      { color: 0x223366, intensity: 0.3, position: [-20, 15, -10] },
    ],
  },
};
