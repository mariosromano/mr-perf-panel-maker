import type { PanelState } from './types';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function fmtDim(inches: number): string {
  const ft = Math.floor(inches / 12);
  const rem = inches - ft * 12;
  if (ft === 0) return `${rem % 1 === 0 ? rem : rem.toFixed(1)}"`;
  if (Math.abs(rem) < 0.05) return `${ft}'`;
  return `${ft}'-${rem % 1 === 0 ? rem : rem.toFixed(1)}"`;
}

export function render2d(
  canvas: HTMLCanvasElement,
  state: PanelState,
  camX: number,
  camY: number,
  camZoom: number
) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(camX, camY);
  ctx.scale(camZoom, camZoom);
  const wW = state.wallW, wH = state.wallH;

  // Backlight glow
  if (state.backlight) {
    const bl = hexToRgb(state.backlightColor);
    const int = state.backlightIntensity;
    const pad = Math.max(wW, wH) * 0.03;

    if (state.backlightMode === 'gradient') {
      const bl2 = hexToRgb(state.backlightColor2);
      const angle = (state.backlightGradientAngle * Math.PI) / 180;
      const diag = Math.max(wW, wH) * 0.7;
      const cx = wW / 2, cy = wH / 2;
      const dx = Math.cos(angle) * diag, dy = Math.sin(angle) * diag;
      const linGrad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
      linGrad.addColorStop(0, `rgba(${bl.r},${bl.g},${bl.b},${0.4 * int})`);
      linGrad.addColorStop(0.5, `rgba(${(bl.r + bl2.r) >> 1},${(bl.g + bl2.g) >> 1},${(bl.b + bl2.b) >> 1},${0.15 * int})`);
      linGrad.addColorStop(1, `rgba(${bl2.r},${bl2.g},${bl2.b},${0.4 * int})`);
      ctx.fillStyle = linGrad;
      ctx.fillRect(-pad, -pad, wW + pad * 2, wH + pad * 2);
    } else {
      const grad = ctx.createRadialGradient(wW / 2, wH / 2, 0, wW / 2, wH / 2, Math.max(wW, wH) * 0.6);
      grad.addColorStop(0, `rgba(${bl.r},${bl.g},${bl.b},${0.4 * int})`);
      grad.addColorStop(1, `rgba(${bl.r},${bl.g},${bl.b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(-pad, -pad, wW + pad * 2, wH + pad * 2);
    }
  }

  // Compute gradient helper for hole fills
  const isGradientBL = state.backlight && state.backlightMode === 'gradient';
  const blC1 = state.backlight ? hexToRgb(state.backlightColor) : { r: 0, g: 0, b: 0 };
  const blC2 = isGradientBL ? hexToRgb(state.backlightColor2) : blC1;
  const blAngleRad = isGradientBL ? (state.backlightGradientAngle * Math.PI) / 180 : 0;

  function holeGradientColor(globalX: number, globalY: number): string {
    if (!isGradientBL) return state.backlight ? state.backlightColor : state.bgColor;
    const cx = wW / 2, cy = wH / 2;
    const dx = globalX - cx, dy = globalY - cy;
    const proj = dx * Math.cos(blAngleRad) + dy * Math.sin(blAngleRad);
    const diag = Math.max(wW, wH) * 0.7;
    const t = Math.max(0, Math.min(1, (proj / diag + 1) / 2));
    const r = Math.round(blC1.r + (blC2.r - blC1.r) * t);
    const g = Math.round(blC1.g + (blC2.g - blC1.g) * t);
    const b = Math.round(blC1.b + (blC2.b - blC1.b) * t);
    return `rgb(${r},${g},${b})`;
  }

  // Draw panels
  for (const panel of state.panels) {
    ctx.save();
    ctx.translate(panel.x, panel.y);
    ctx.fillStyle = state.panelColor;
    ctx.fillRect(0, 0, panel.w, panel.h);

    const holes = panel.holes;
    if (isGradientBL) {
      // Draw each hole with its position-based gradient color
      for (const hole of holes) {
        const r = hole.d / 2;
        ctx.fillStyle = holeGradientColor(panel.x + hole.x, panel.y + hole.y);
        ctx.beginPath();
        ctx.arc(hole.x, hole.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const blColor = state.backlight ? state.backlightColor : state.bgColor;
      ctx.fillStyle = blColor;
      ctx.beginPath();
      for (const hole of holes) {
        const r = hole.d / 2;
        ctx.moveTo(hole.x + r, hole.y);
        ctx.arc(hole.x, hole.y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // Panel border
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5 / camZoom;
    ctx.strokeRect(0, 0, panel.w, panel.h);

    // Labels
    if (state.showLabels) {
      const fs = Math.min(panel.w, panel.h) * 0.07;
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(panel.label, panel.w / 2, panel.h / 2 - fs * 0.6);
      ctx.font = `${fs * 0.6}px sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillText(panel.sizeLabel, panel.w / 2, panel.h / 2 + fs * 0.5);
    }
    ctx.restore();
  }

  // Wall outline
  ctx.setLineDash([4 / camZoom, 4 / camZoom]);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1 / camZoom;
  ctx.strokeRect(0, 0, wW, wH);
  ctx.setLineDash([]);

  // ─── Dimension Lines ────────────────────────────────────────────
  if (state.panels.length) {
    const lw = 1 / camZoom;
    const tick = 6 / camZoom;
    const dimOffset = 18 / camZoom;
    const fontSize = Math.max(4, 4 / camZoom);
    const dimColor = 'rgba(255,255,255,0.55)';
    const dimTextColor = 'rgba(255,255,255,0.75)';
    ctx.strokeStyle = dimColor;
    ctx.lineWidth = lw;
    ctx.setLineDash([]);

    const cw = state.colWidths, rh = state.rowHeights;
    const gap = state.panelGap;
    const totalW = cw.reduce((s, v) => s + v, 0) + (cw.length - 1) * gap;
    const totalH = rh.reduce((s, v) => s + v, 0) + (rh.length - 1) * gap;
    const ox = (wW - totalW) / 2;
    const oy = (wH - totalH) / 2;

    // Top: overall wall width
    const topY = oy - dimOffset * 2.8;
    ctx.beginPath(); ctx.moveTo(0, topY); ctx.lineTo(wW, topY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, topY - tick); ctx.lineTo(0, topY + tick); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wW, topY - tick); ctx.lineTo(wW, topY + tick); ctx.stroke();
    ctx.font = `bold ${fontSize * 1.1}px sans-serif`;
    ctx.fillStyle = dimTextColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(fmtDim(wW), wW / 2, topY - tick * 0.5);

    // Top: per-column widths
    const colDimY = oy - dimOffset;
    let cx = ox;
    for (let i = 0; i < cw.length; i++) {
      const pw = cw[i];
      ctx.beginPath(); ctx.moveTo(cx, colDimY); ctx.lineTo(cx + pw, colDimY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, colDimY - tick * 0.7); ctx.lineTo(cx, colDimY + tick * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + pw, colDimY - tick * 0.7); ctx.lineTo(cx + pw, colDimY + tick * 0.7); ctx.stroke();
      ctx.font = `${fontSize * 0.9}px sans-serif`;
      ctx.fillStyle = dimColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(fmtDim(pw), cx + pw / 2, colDimY - tick * 0.3);
      cx += pw + gap;
    }

    // Left: overall wall height
    const leftX = ox - dimOffset * 2.8;
    ctx.beginPath(); ctx.moveTo(leftX, 0); ctx.lineTo(leftX, wH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(leftX - tick, 0); ctx.lineTo(leftX + tick, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(leftX - tick, wH); ctx.lineTo(leftX + tick, wH); ctx.stroke();
    ctx.save();
    ctx.translate(leftX - tick * 0.5, wH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = `bold ${fontSize * 1.1}px sans-serif`;
    ctx.fillStyle = dimTextColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(fmtDim(wH), 0, 0);
    ctx.restore();

    // Left: per-row heights
    const rowDimX = ox - dimOffset;
    let cy2 = oy;
    for (let i = 0; i < rh.length; i++) {
      const ph = rh[i];
      ctx.beginPath(); ctx.moveTo(rowDimX, cy2); ctx.lineTo(rowDimX, cy2 + ph); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rowDimX - tick * 0.7, cy2); ctx.lineTo(rowDimX + tick * 0.7, cy2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rowDimX - tick * 0.7, cy2 + ph); ctx.lineTo(rowDimX + tick * 0.7, cy2 + ph); ctx.stroke();
      ctx.save();
      ctx.translate(rowDimX - tick * 0.3, cy2 + ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.font = `${fontSize * 0.9}px sans-serif`;
      ctx.fillStyle = dimColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(fmtDim(ph), 0, 0);
      ctx.restore();
      cy2 += ph + gap;
    }
  }

  ctx.restore();

  // Scale bar
  drawScaleBar(ctx, w, h, camZoom);
}

function drawScaleBar(ctx: CanvasRenderingContext2D, w: number, h: number, camZoom: number) {
  const niceSteps = [0.5, 1, 2, 3, 4, 5, 6, 10, 12, 24, 48, 96];
  let best = niceSteps[0];
  for (const s of niceSteps) {
    if (Math.abs(s * camZoom - 100) < Math.abs(best * camZoom - 100)) best = s;
  }
  const barPx = best * camZoom;
  const x = w - barPx - 20, y = h - 30;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(x, y, barPx, 3);
  ctx.fillRect(x, y - 4, 1, 11);
  ctx.fillRect(x + barPx, y - 4, 1, 11);
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(best + '"', x + barPx / 2, y - 6);
}
