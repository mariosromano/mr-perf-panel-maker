import type { PanelState, Panel } from './types';

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
