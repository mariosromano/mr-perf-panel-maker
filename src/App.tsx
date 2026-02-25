import { useState, useCallback, useRef, useEffect } from 'react';
import type { PanelState, LightingPreset } from './engine/types';
import { DEFAULT_PANEL_STATE } from './engine/types';
import { processImage, solveAndBuildPanels, computeAllHoles } from './engine/panelEngine';
import ChatPanel from './components/ChatPanel';
import ControlPanel from './components/ControlPanel';
import MainViewport from './components/MainViewport';

export default function App() {
  const [panelState, setPanelState] = useState<PanelState>({ ...DEFAULT_PANEL_STATE });
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('standard');
  const [floorEnabled, setFloorEnabled] = useState(false);
  const [scaleFigureEnabled, setScaleFigureEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'2d' | '3d' | 'guide'>('2d');

  // Onboarding
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(true);

  useEffect(() => {
    const onboarded = localStorage.getItem('perfpanel_onboarded') === 'true';
    setIsFirstTimeUser(!onboarded);
    setSidebarReady(onboarded);
  }, []);

  const completeOnboarding = useCallback(() => {
    setIsFirstTimeUser(false);
    localStorage.setItem('perfpanel_onboarded', 'true');
    setTimeout(() => setSidebarReady(true), 50);
  }, []);

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

  return (
    <div className="flex w-screen h-screen">
      {/* Left: AI Chat Panel */}
      <ChatPanel
        onStateChange={handleStateChange}
        onLightingPresetChange={setLightingPreset}
        onScaleFigureEnabledChange={setScaleFigureEnabled}
        onFloorEnabledChange={setFloorEnabled}
        rendererRef={rendererRef}
        sceneRef={sceneRef}
        cameraRef={cameraRef}
        isFloating={isFirstTimeUser}
        sidebarReady={sidebarReady}
        onOnboardingComplete={completeOnboarding}
      />

      {/* Center: Main Viewport */}
      <MainViewport
        activeTab={activeTab}
        onTabChange={setActiveTab}
        panelState={panelState}
        lightingPreset={lightingPreset}
        floorEnabled={floorEnabled}
        scaleFigureEnabled={scaleFigureEnabled}
        rendererRef={rendererRef}
        sceneRef={sceneRef}
        cameraRef={cameraRef}
      />

      {/* Right: Control Panel */}
      <ControlPanel
        panelState={panelState}
        onStateChange={handleStateChange}
        onImageLoad={handleImageLoad}
        onImageClear={handleImageClear}
        floorEnabled={floorEnabled}
        onFloorEnabledChange={setFloorEnabled}
        scaleFigureEnabled={scaleFigureEnabled}
        onScaleFigureEnabledChange={setScaleFigureEnabled}
        canvasRef={canvasRef}
        rendererRef={rendererRef}
        sceneRef={sceneRef}
        cameraRef={cameraRef}
        activeTab={activeTab}
      />
    </div>
  );
}
