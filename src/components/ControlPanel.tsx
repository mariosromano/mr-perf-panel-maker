import { useState, useCallback, useRef, useEffect } from 'react';
import type { PanelState } from '../engine/types';
import { STANDARD_WIDTHS, STANDARD_HEIGHTS, STANDARD_HOLE_SIZES } from '../engine/types';
import { computeStats } from '../engine/panelEngine';
import { exportSVG, exportDXF, exportPNG } from '../engine/exportEngine';

interface ControlPanelProps {
  panelState: PanelState;
  onStateChange: (updates: Partial<PanelState>) => void;
  onImageLoad: (file: File) => void;
  onImageClear: () => void;
  floorEnabled: boolean;
  onFloorEnabledChange: (enabled: boolean) => void;
  scaleFigureEnabled: boolean;
  onScaleFigureEnabledChange: (enabled: boolean) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  rendererRef: React.RefObject<unknown>;
  sceneRef: React.RefObject<unknown>;
  cameraRef: React.RefObject<unknown>;
  activeTab: '2d' | '3d' | 'guide';
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#3a3a3e]">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-[11px] font-semibold text-[#888] uppercase tracking-wider">{title}</span>
        <span className="text-[#666] text-[10px]">{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && <div className="px-4 pb-3.5 pt-0.5">{children}</div>}
    </div>
  );
}

function Slider({
  label, value, min, max, step, format, onChange, info,
}: {
  label: string; value: number; min: number; max: number; step: number;
  format?: (v: number) => string; onChange: (v: number) => void; info?: string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync from parent when not dragging
  useEffect(() => { setLocalValue(value); }, [value]);

  const handleChange = (v: number) => {
    setLocalValue(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 150);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="mb-2.5 last:mb-0">
      <label className="flex justify-between mb-1 text-[11px] text-[#ccc]">
        <span className="truncate mr-2">{label}</span>
        <span className="text-[#4a9eff] font-medium font-mono shrink-0">
          {format ? format(localValue) : localValue}
        </span>
      </label>
      <input type="range" min={min} max={max} step={step} value={localValue}
        onChange={(e) => handleChange(parseFloat(e.target.value))} />
      {info && <p className="text-[10px] text-[#666] mt-0.5">{info}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <div className="flex items-center justify-between mb-2 text-[13px]">
      <span className="text-[#e0e0e0]">{label}</span>
      <div
        className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${checked ? 'bg-[#4a9eff]' : 'bg-[#3a3a3e]'}`}
        onClick={() => onChange(!checked)}
      >
        <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </div>
    </div>
  );
}

function SizeToggleGroup({
  sizes, enabled, onChange, formatLabel,
}: {
  sizes: number[]; enabled: number[]; onChange: (enabled: number[]) => void;
  formatLabel?: (s: number) => string;
}) {
  const toggle = (size: number) => {
    const isActive = enabled.includes(size);
    if (isActive && enabled.length <= 1) return; // prevent disabling all
    const next = isActive ? enabled.filter(s => s !== size) : [...enabled, size];
    onChange(next);
  };

  const defaultFormat = (s: number) => {
    if (s < 1) {
      const frac = s === 0.75 ? '3/4' : s === 0.625 ? '5/8' : s === 0.5 ? '1/2' : s === 0.25 ? '1/4' : `${s}`;
      return `${frac}"`;
    }
    if (s === 1.5) return '1-1/2"';
    if (s === 1.25) return '1-1/4"';
    const ft = Math.floor(s / 12);
    return ft >= 1 ? `${s}" (${ft}')` : `${s}"`;
  };

  return (
    <div className="flex gap-1.5 flex-wrap mb-2">
      {sizes.map(s => (
        <button
          key={s}
          className={`px-2 py-1 text-[11px] border rounded transition-all ${
            enabled.includes(s)
              ? 'border-[#4a9eff] bg-[rgba(74,158,255,0.15)] text-[#e0e0e0]'
              : 'border-[#3a3a3e] bg-[#2a2a2e] text-[#888]'
          }`}
          onClick={() => toggle(s)}
        >
          {(formatLabel || defaultFormat)(s)}
        </button>
      ))}
    </div>
  );
}

export default function ControlPanel({
  panelState,
  onStateChange,
  onImageLoad,
  onImageClear,
  floorEnabled,
  onFloorEnabledChange,
  scaleFigureEnabled,
  onScaleFigureEnabledChange,
  canvasRef,
  rendererRef,
  sceneRef,
  cameraRef,
  activeTab,
}: ControlPanelProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [exportTarget, setExportTarget] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const stats = computeStats(panelState);

  const handleImageUpload = useCallback(async (file: File) => {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
    setImagePreview(dataUrl);
    onImageLoad(file);
  }, [onImageLoad]);

  const handleClearImage = useCallback(() => {
    setImagePreview(null);
    onImageClear();
  }, [onImageClear]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) handleImageUpload(e.dataTransfer.files[0]);
  }, [handleImageUpload]);

  const fmtPrice = (n: number) =>
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const getExportPanels = () => {
    return exportTarget === 'all'
      ? panelState.panels
      : panelState.panels.filter(p => p.label === exportTarget);
  };

  const handleExportPNG = () => {
    if (activeTab === '3d') {
      const renderer = rendererRef.current as { render: (s: unknown, c: unknown) => void; domElement: HTMLCanvasElement } | null;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
        exportPNG(renderer.domElement);
      }
    } else if (canvasRef.current) {
      exportPNG(canvasRef.current);
    }
  };

  return (
    <div className="w-[320px] min-w-[320px] bg-[#222226] h-screen overflow-y-auto border-r border-[#3a3a3e] flex flex-col">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-[#3a3a3e] bg-gradient-to-br from-[#2a2a2e] to-[#1a1a1e]">
        <div className="text-[15px] font-bold tracking-wider">
          <span className="text-[#4a9eff]">M|R</span> Walls Perf Panel Maker
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Source Image */}
        <Section title="Source Image">
          <div
            className={`border-2 border-dashed border-[#3a3a3e] rounded-lg p-6 text-center cursor-pointer hover:border-[#4a9eff] hover:bg-[rgba(74,158,255,0.08)] transition-all min-h-[80px] flex flex-col items-center justify-center relative ${imagePreview ? 'p-2' : ''}`}
            onClick={() => document.getElementById('perf-file-input')?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="Preview" className="max-w-full max-h-[140px] rounded" />
                <button
                  className="absolute top-1 right-1 w-[22px] h-[22px] bg-[#e55] text-white border-none rounded-full text-sm cursor-pointer leading-none"
                  onClick={(e) => { e.stopPropagation(); handleClearImage(); }}
                >
                  &times;
                </button>
              </>
            ) : (
              <>
                <p className="text-[13px] text-[#888]">Drop image here or click to browse</p>
              </>
            )}
          </div>
          <input
            type="file"
            id="perf-file-input"
            accept="image/*"
            className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleImageUpload(e.target.files[0]); }}
          />
          <Toggle label="Invert Image" checked={panelState.invert} onChange={v => onStateChange({ invert: v })} />
        </Section>

        {/* Wall Dimensions */}
        <Section title="Wall Dimensions">
          <div className="flex gap-2 mb-2">
            <label className="flex items-center justify-between flex-1 text-[13px]">
              <span className="text-[#888]">W (ft)</span>
              <input
                type="number"
                className="w-16 bg-[#2a2a2e] border border-[#3a3a3e] text-[#e0e0e0] rounded px-1.5 py-1 text-[13px] text-right"
                value={panelState.wallW / 12}
                min={1} max={200} step={0.5}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) onStateChange({ wallW: v * 12 }); }}
              />
            </label>
            <label className="flex items-center justify-between flex-1 text-[13px]">
              <span className="text-[#888]">H (ft)</span>
              <input
                type="number"
                className="w-16 bg-[#2a2a2e] border border-[#3a3a3e] text-[#e0e0e0] rounded px-1.5 py-1 text-[13px] text-right"
                value={panelState.wallH / 12}
                min={1} max={200} step={0.5}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) onStateChange({ wallH: v * 12 }); }}
              />
            </label>
          </div>
          <label className="flex items-center justify-between text-[13px]">
            <span className="text-[#888]">Gap (in)</span>
            <input
              type="number"
              className="w-16 bg-[#2a2a2e] border border-[#3a3a3e] text-[#e0e0e0] rounded px-1.5 py-1 text-[13px] text-right"
              value={panelState.panelGap}
              min={0} max={4} step={0.0625}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) onStateChange({ panelGap: v }); }}
            />
          </label>
        </Section>

        {/* Panel Layout */}
        <Section title="Panel Layout">
          <div className="text-[11px] text-[#888] mb-1">Available widths</div>
          <SizeToggleGroup
            sizes={STANDARD_WIDTHS}
            enabled={panelState.enabledWidths}
            onChange={enabledWidths => onStateChange({ enabledWidths })}
          />
          <div className="text-[11px] text-[#888] mb-1">Available heights</div>
          <SizeToggleGroup
            sizes={STANDARD_HEIGHTS}
            enabled={panelState.enabledHeights}
            onChange={enabledHeights => onStateChange({ enabledHeights })}
          />
          <div className="text-[11px] text-[#888] mb-1">Layout option</div>
          <select
            className="w-full mb-2 bg-[#2a2a2e] border border-[#3a3a3e] text-[#e0e0e0] rounded px-2 py-1 text-[12px]"
            value={panelState.selectedLayoutIdx}
            onChange={e => onStateChange({ selectedLayoutIdx: parseInt(e.target.value) })}
          >
            {panelState.layoutOptions.map((opt, i) => (
              <option key={i} value={i}>
                {opt.desc} — {opt.totalPanels} panels, {(opt.totalCoverage * 100).toFixed(1)}%
              </option>
            ))}
          </select>
          <Slider label="Margin (in)" value={panelState.margin} min={0} max={6} step={0.25}
            onChange={v => onStateChange({ margin: v })} />

          {/* Layout info */}
          {panelState.panels.length > 0 && (
            <div className="text-[11px] text-[#e0e0e0] mt-1.5 p-2 bg-[rgba(74,158,255,0.06)] border border-[#3a3a3e] rounded leading-relaxed">
              <span className="text-[#888]">Cols:</span> {panelState.colWidths.map(w => `${w}"`).join(' | ')}<br/>
              <span className="text-[#888]">Rows:</span> {panelState.rowHeights.map(h => `${h}"`).join(' | ')}<br/>
              <span className="text-[#4a9eff] font-semibold">{panelState.colWidths.length} x {panelState.rowHeights.length} = {panelState.panels.length} panels</span>
            </div>
          )}
        </Section>

        {/* Advanced Toggle */}
        <div className="px-4 py-2.5 border-b border-[#3a3a3e]">
          <button
            className={`w-full py-2 border rounded-md text-[11px] cursor-pointer font-semibold transition-colors ${
              showAdvanced
                ? 'bg-[#2a2a3e] border-[#4a9eff] text-[#4a9eff]'
                : 'bg-transparent border-[#3a3a3e] text-[#888] hover:text-[#ccc] hover:border-[#555]'
            }`}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
          </button>
        </div>

        {/* Image Adjustments (Advanced) */}
        {showAdvanced && (
          <Section title="Image Adjustments">
            <Slider label="Brightness" value={panelState.brightness} min={-100} max={100} step={1}
              onChange={v => onStateChange({ brightness: v })} />
            <Slider label="Contrast" value={panelState.contrast} min={-100} max={100} step={1}
              onChange={v => onStateChange({ contrast: v })} />
          </Section>
        )}

        {/* Grid Settings (Advanced) */}
        {showAdvanced && <Section title="Grid Settings">
          <div className="flex items-center justify-between mb-2 text-[13px]">
            <span className="text-[#e0e0e0]">Spacing Mode</span>
            <div className="flex gap-1">
              {(['spacing', 'count'] as const).map(m => (
                <button
                  key={m}
                  className={`px-2.5 py-1 text-[11px] border rounded transition-all ${
                    panelState.spacingMode === m
                      ? 'border-[#4a9eff] bg-[rgba(74,158,255,0.15)] text-[#e0e0e0]'
                      : 'border-[#3a3a3e] bg-[#2a2a2e] text-[#888]'
                  }`}
                  onClick={() => onStateChange({ spacingMode: m })}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {panelState.spacingMode === 'spacing' ? (
            <div className="flex gap-2 items-center mb-2">
              <label className="flex items-center gap-1 flex-1 text-[13px]">
                <span className="text-[#888]">X (in)</span>
                <input
                  type="number"
                  className="w-16 bg-[#2a2a2e] border border-[#3a3a3e] text-[#e0e0e0] rounded px-1.5 py-1 text-[13px] text-right"
                  value={panelState.spacingX} min={2} max={12} step={0.05}
                  onChange={e => {
                    const v = Math.max(panelState.minSpacing, parseFloat(e.target.value) || 2);
                    const updates: Partial<PanelState> = { spacingX: v };
                    if (panelState.lockRatio) updates.spacingY = v;
                    onStateChange(updates);
                  }}
                />
              </label>
              <button
                className={`w-6 h-6 flex items-center justify-center text-xs border rounded shrink-0 ${
                  panelState.lockRatio ? 'text-[#4a9eff] border-[#4a9eff]' : 'text-[#888] border-[#3a3a3e]'
                }`}
                onClick={() => onStateChange({ lockRatio: !panelState.lockRatio })}
                title="Lock ratio"
              >
                &#128279;
              </button>
              <label className="flex items-center gap-1 flex-1 text-[13px]">
                <span className="text-[#888]">Y (in)</span>
                <input
                  type="number"
                  className="w-16 bg-[#2a2a2e] border border-[#3a3a3e] text-[#e0e0e0] rounded px-1.5 py-1 text-[13px] text-right"
                  value={panelState.spacingY} min={2} max={12} step={0.05}
                  onChange={e => {
                    const v = Math.max(panelState.minSpacing, parseFloat(e.target.value) || 2);
                    const updates: Partial<PanelState> = { spacingY: v };
                    if (panelState.lockRatio) updates.spacingX = v;
                    onStateChange(updates);
                  }}
                />
              </label>
            </div>
          ) : (
            <div className="flex gap-2 mb-2">
              <label className="flex items-center gap-1 flex-1 text-[13px]">
                <span className="text-[#888]">Cols</span>
                <input
                  type="number"
                  className="w-16 bg-[#2a2a2e] border border-[#3a3a3e] text-[#e0e0e0] rounded px-1.5 py-1 text-[13px] text-right"
                  value={panelState.gridCols} min={2} max={500} step={1}
                  onChange={e => onStateChange({ gridCols: parseInt(e.target.value) || 46 })}
                />
              </label>
              <label className="flex items-center gap-1 flex-1 text-[13px]">
                <span className="text-[#888]">Rows</span>
                <input
                  type="number"
                  className="w-16 bg-[#2a2a2e] border border-[#3a3a3e] text-[#e0e0e0] rounded px-1.5 py-1 text-[13px] text-right"
                  value={panelState.gridRows} min={2} max={500} step={1}
                  onChange={e => onStateChange({ gridRows: parseInt(e.target.value) || 118 })}
                />
              </label>
            </div>
          )}

          <div className="flex items-center justify-between mb-2 text-[13px]">
            <span className="text-[#e0e0e0]">Grid Pattern</span>
            <div className="flex gap-1">
              {(['rect', 'hex'] as const).map(p => (
                <button
                  key={p}
                  className={`px-2.5 py-1 text-[11px] border rounded transition-all ${
                    panelState.gridPattern === p
                      ? 'border-[#4a9eff] bg-[rgba(74,158,255,0.15)] text-[#e0e0e0]'
                      : 'border-[#3a3a3e] bg-[#2a2a2e] text-[#888]'
                  }`}
                  onClick={() => onStateChange({ gridPattern: p })}
                >
                  {p === 'rect' ? 'Rectangular' : 'Staggered'}
                </button>
              ))}
            </div>
          </div>
        </Section>}

        {/* Hole Settings (Advanced) */}
        {showAdvanced && (
          <Section title="Hole Settings">
            <div className="text-[11px] text-[#888] mb-1">Standard sizes (in)</div>
            <SizeToggleGroup
              sizes={STANDARD_HOLE_SIZES}
              enabled={panelState.enabledHoleSizes}
              onChange={enabledHoleSizes => onStateChange({ enabledHoleSizes })}
            />
            <Slider label="Threshold" value={panelState.threshold} min={0} max={255} step={1}
              onChange={v => onStateChange({ threshold: v })} />
            <Slider label="Gamma" value={panelState.gamma} min={0.2} max={5} step={0.1}
              format={v => v.toFixed(1)} onChange={v => onStateChange({ gamma: v })} />
          </Section>
        )}

        {/* Visualization (Advanced) */}
        {showAdvanced && (
          <Section title="Visualization">
            <label className="flex items-center justify-between mb-2 text-[13px]">
              <span className="text-[#e0e0e0]">Panel Color</span>
              <input
                type="color"
                className="w-8 h-6 border border-[#3a3a3e] rounded cursor-pointer bg-transparent p-0.5"
                value={panelState.panelColor}
                onChange={e => onStateChange({ panelColor: e.target.value })}
              />
            </label>
            <label className="flex items-center justify-between mb-2 text-[13px]">
              <span className="text-[#e0e0e0]">Background</span>
              <input
                type="color"
                className="w-8 h-6 border border-[#3a3a3e] rounded cursor-pointer bg-transparent p-0.5"
                value={panelState.bgColor}
                onChange={e => onStateChange({ bgColor: e.target.value })}
              />
            </label>
            <Toggle label="Backlight" checked={panelState.backlight} onChange={v => onStateChange({ backlight: v })} />
            {panelState.backlight && (
              <>
                <label className="flex items-center justify-between mb-2 text-[13px]">
                  <span className="text-[#e0e0e0]">Backlight Color</span>
                  <input
                    type="color"
                    className="w-8 h-6 border border-[#3a3a3e] rounded cursor-pointer bg-transparent p-0.5"
                    value={panelState.backlightColor}
                    onChange={e => onStateChange({ backlightColor: e.target.value })}
                  />
                </label>
                <Slider label="Intensity" value={panelState.backlightIntensity} min={0} max={2} step={0.05}
                  format={v => v.toFixed(1)} onChange={v => onStateChange({ backlightIntensity: v })} />
              </>
            )}
            <Toggle label="Show panel labels" checked={panelState.showLabels} onChange={v => onStateChange({ showLabels: v })} />
            <Toggle label="Floor" checked={floorEnabled} onChange={onFloorEnabledChange} />
            <Toggle label="Scale Figure" checked={scaleFigureEnabled} onChange={onScaleFigureEnabledChange} />
          </Section>
        )}

        {/* Statistics */}
        <Section title="Statistics">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
            <span className="text-[#888]">Wall Size</span>
            <span className="text-right font-semibold">{(panelState.wallW / 12).toFixed(1)}' x {(panelState.wallH / 12).toFixed(1)}'</span>
            <span className="text-[#888]">Panels</span>
            <span className="text-right font-semibold">
              {panelState.panels.length ? `${panelState.colWidths.length} x ${panelState.rowHeights.length} = ${panelState.panels.length}` : '\u2014'}
            </span>
            <span className="text-[#888]">Total Holes</span>
            <span className="text-right font-semibold">{stats.totalHoles || '\u2014'}</span>
            <span className="text-[#888]">Open Area</span>
            <span className="text-right font-semibold">{stats.totalHoles ? stats.openAreaPct.toFixed(1) + '%' : '\u2014'}</span>
            <span className="text-[#888]">Sizes Used</span>
            <span className="text-right font-semibold">{stats.sizesUsed ? stats.sizesUsed + ' sizes' : '\u2014'}</span>
          </div>
        </Section>

        {/* Pricing */}
        <Section title="Estimated Pricing">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
            <span className="text-[#888]">Panel Area</span>
            <span className="text-right font-semibold">{stats.panelSF > 0 ? stats.panelSF.toFixed(1) + ' SF' : '\u2014'}</span>
            <span className="text-[#888]">Rate</span>
            <span className="text-right font-semibold">$42 / SF</span>
            <span className="text-[#e0e0e0] font-semibold">Estimated Total</span>
            <span className="text-right font-semibold text-[#4a9eff] text-sm">
              {stats.estimatedTotal > 0 ? fmtPrice(stats.estimatedTotal) : '\u2014'}
            </span>
          </div>
          <p className="text-[10px] text-[#888] mt-2 leading-relaxed">
            Panels only. Illumination, mounting hardware, and installation not included.
          </p>
        </Section>

        {/* Export */}
        <Section title="Export">
          <select
            className="w-full mb-2 bg-[#2a2a2e] border border-[#3a3a3e] text-[#e0e0e0] rounded px-2 py-1.5 text-[13px]"
            value={exportTarget}
            onChange={e => setExportTarget(e.target.value)}
          >
            <option value="all">All Panels (Full Wall)</option>
            {panelState.panels.map(p => (
              <option key={p.label} value={p.label}>Panel {p.label} ({p.sizeLabel})</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              className="flex-1 py-2 text-[13px] font-semibold border border-[#3a3a3e] bg-[#2a2a2e] text-[#e0e0e0] rounded-md hover:border-[#4a9eff] hover:bg-[rgba(74,158,255,0.1)] transition-all"
              onClick={() => exportSVG(panelState, getExportPanels())}
            >
              SVG
            </button>
            <button
              className="flex-1 py-2 text-[13px] font-semibold border border-[#3a3a3e] bg-[#2a2a2e] text-[#e0e0e0] rounded-md hover:border-[#4a9eff] hover:bg-[rgba(74,158,255,0.1)] transition-all"
              onClick={() => exportDXF(panelState, getExportPanels())}
            >
              DXF
            </button>
            <button
              className="flex-1 py-2 text-[13px] font-semibold border border-[#3a3a3e] bg-[#2a2a2e] text-[#e0e0e0] rounded-md hover:border-[#4a9eff] hover:bg-[rgba(74,158,255,0.1)] transition-all"
              onClick={handleExportPNG}
            >
              PNG
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
