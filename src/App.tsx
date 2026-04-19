import { useState, useCallback, useRef, useEffect } from 'react';
import type { PanelState, LightingPreset } from './engine/types';
import { DEFAULT_PANEL_STATE } from './engine/types';
import { processImage, solveAndBuildPanels, computeAllHoles } from './engine/panelEngine';
import AskMaraDrawer from './components/AskMaraDrawer';
import ControlPanel from './components/ControlPanel';
import MainViewport from './components/MainViewport';
import OnboardingWizard from './components/OnboardingWizard';

export default function App() {
  const [panelState, setPanelState] = useState<PanelState>({ ...DEFAULT_PANEL_STATE });
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('standard');
  const [floorEnabled, setFloorEnabled] = useState(false);
  const [scaleFigureEnabled, setScaleFigureEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'2d' | '3d' | 'guide'>('3d');
  const [ceilingMode, setCeilingMode] = useState(false);
  const [askMaraOpen, setAskMaraOpen] = useState(false);
  const [onboarded, setOnboarded] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('perfpanel_onboarded') === 'true' : false,
  );

  // Three.js refs (typed as unknown to avoid importing THREE in the main bundle)
  const rendererRef = useRef<unknown>(null);
  const sceneRef = useRef<unknown>(null);
  const cameraRef = useRef<unknown>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fields that trigger each recompute stage
  const IMAGE_KEYS = new Set(['brightness', 'contrast', 'invert']);
  const LAYOUT_KEYS = new Set(['wallW', 'wallH', 'panelGap', 'enabledWidths', 'enabledHeights', 'selectedLayoutIdx']);
  const HOLE_KEYS = new Set([
    'spacingMode', 'spacingX', 'spacingY', 'gridCols', 'gridRows', 'gridPattern',
    'enabledHoleSizes', 'threshold', 'gamma', 'margin',
  ]);

  // Full recompute (used for initial load and image load)
  const recomputeFull = useCallback((state: PanelState): PanelState => {
    let s = { ...state };
    if (s.sourceImage) {
      const imgData = processImage(s);
      if (imgData) s = { ...s, ...imgData };
    }
    const { layoutOptions, panels, colWidths, rowHeights } = solveAndBuildPanels(s);
    s = { ...s, layoutOptions, panels, colWidths, rowHeights,
      selectedLayoutIdx: Math.min(s.selectedLayoutIdx, Math.max(0, layoutOptions.length - 1)) };
    if (s.grayPixels) {
      const { panels: ph, gridInfo } = computeAllHoles(s);
      s = { ...s, panels: ph, gridInfo };
    }
    return s;
  }, []);

  // Smart recompute — only runs the stages needed based on which keys changed
  const handleStateChange = useCallback((updates: Partial<PanelState>) => {
    setPanelState(prev => {
      const next = { ...prev, ...updates };
      const keys = Object.keys(updates);

      const needsImage = keys.some(k => IMAGE_KEYS.has(k));
      const needsLayout = keys.some(k => LAYOUT_KEYS.has(k));
      const needsHoles = keys.some(k => HOLE_KEYS.has(k));

      // Visual-only change — no recompute needed
      if (!needsImage && !needsLayout && !needsHoles) return next;

      let s = { ...next };

      if (needsImage && s.sourceImage) {
        const imgData = processImage(s);
        if (imgData) s = { ...s, ...imgData };
      }

      if (needsImage || needsLayout) {
        const { layoutOptions, panels, colWidths, rowHeights } = solveAndBuildPanels(s);
        s = { ...s, layoutOptions, panels, colWidths, rowHeights,
          selectedLayoutIdx: Math.min(s.selectedLayoutIdx, Math.max(0, layoutOptions.length - 1)) };
      }

      if ((needsImage || needsLayout || needsHoles) && s.grayPixels) {
        const { panels: ph, gridInfo } = computeAllHoles(s);
        s = { ...s, panels: ph, gridInfo };
      }

      return s;
    });
  }, []);

  // Handle image load
  const handleImageLoad = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setPanelState(prev => {
          const next = { ...prev, sourceImage: img };
          return recomputeFull(next);
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [recomputeFull]);

  // Handle image clear
  const handleImageClear = useCallback(() => {
    setPanelState(prev => {
      const next = {
        ...prev,
        sourceImage: null,
        grayPixels: null,
        imgWidth: 0,
        imgHeight: 0,
      };
      // Clear holes but keep layout
      const { layoutOptions, panels, colWidths, rowHeights } = solveAndBuildPanels(next);
      return {
        ...next,
        layoutOptions,
        panels: panels.map(p => ({ ...p, holes: [] })),
        colWidths,
        rowHeights,
      };
    });
  }, []);

  // Initial layout solve
  useEffect(() => {
    setPanelState(prev => recomputeFull(prev));
  }, [recomputeFull]);

  // Auto-load default sample image on mount — only for returning users
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (!onboarded) return;
    if (autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) return;
        const file = new File([blob], 'gradient_sunset_skyline_colorful.jpg', { type: 'image/jpeg' });
        handleImageLoad(file);
      }, 'image/jpeg', 0.92);
    };
    img.src = '/samples/gradient_sunset_skyline_colorful.jpg';
  }, [handleImageLoad, onboarded]);

  // Onboarding completion — atomic apply of size + image, unlock UI only when image is ready
  const handleOnboardingComplete = useCallback(
    ({ wallW, wallH, sampleFile, sampleLabel, uploadedFile }: { wallW: number; wallH: number; sampleFile?: string; sampleLabel?: string; uploadedFile?: File }) => {
      localStorage.setItem('perfpanel_onboarded', 'true');

      const applyAndUnlock = (img: HTMLImageElement | null, imageName: string) => {
        setPanelState(prev => {
          const next = { ...prev, wallW, wallH, imageName, ...(img ? { sourceImage: img } : {}) };
          return recomputeFull(next);
        });
        setTimeout(() => setOnboarded(true), 400);
      };

      if (uploadedFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => applyAndUnlock(img, uploadedFile.name.replace(/\.[^.]+$/, ''));
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(uploadedFile);
      } else if (sampleFile) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => applyAndUnlock(img, sampleLabel || sampleFile.replace(/\.[^.]+$/, ''));
        img.onerror = () => applyAndUnlock(null, '');
        img.src = `/samples/${sampleFile}`;
      } else {
        applyAndUnlock(null, '');
      }
    },
    [recomputeFull],
  );

  return (
    <div className="flex w-screen h-screen relative">
      {/* Center: Main Viewport */}
      <MainViewport
        activeTab={activeTab}
        onTabChange={setActiveTab}
        panelState={panelState}
        lightingPreset={lightingPreset}
        floorEnabled={floorEnabled}
        scaleFigureEnabled={scaleFigureEnabled}
        ceilingMode={ceilingMode}
        rendererRef={rendererRef}
        sceneRef={sceneRef}
        cameraRef={cameraRef}
      />

      {/* Right: Control Panel (with embedded Ask Mara button + Render) */}
      <div
        className="relative overflow-hidden"
        style={{
          width: 360,
          opacity: onboarded ? 1 : 0,
          pointerEvents: onboarded ? 'auto' : 'none',
          transition: 'opacity 0.6s ease 0.2s',
        }}
      >
        <ControlPanel
          panelState={panelState}
          onStateChange={handleStateChange}
          onImageLoad={handleImageLoad}
          onImageClear={handleImageClear}
          floorEnabled={floorEnabled}
          onFloorEnabledChange={setFloorEnabled}
          scaleFigureEnabled={scaleFigureEnabled}
          onScaleFigureEnabledChange={setScaleFigureEnabled}
          ceilingMode={ceilingMode}
          onCeilingModeChange={setCeilingMode}
          canvasRef={canvasRef}
          rendererRef={rendererRef}
          sceneRef={sceneRef}
          cameraRef={cameraRef}
          activeTab={activeTab}
          onOpenAskMara={() => setAskMaraOpen(true)}
        />

        {/* Ask Mara drawer — slides over ControlPanel */}
        {askMaraOpen && (
          <AskMaraDrawer
            isOpen={askMaraOpen}
            onClose={() => setAskMaraOpen(false)}
            onStateChange={handleStateChange}
            onLightingPresetChange={setLightingPreset}
            onScaleFigureEnabledChange={setScaleFigureEnabled}
            onFloorEnabledChange={setFloorEnabled}
            onCeilingModeChange={setCeilingMode}
          />
        )}
      </div>

      {/* Onboarding — first visit only */}
      {!onboarded && <OnboardingWizard onComplete={handleOnboardingComplete} />}
    </div>
  );
}
