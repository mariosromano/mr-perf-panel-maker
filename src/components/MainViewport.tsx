import { lazy, Suspense } from 'react';
import type { PanelState, LightingPreset } from '../engine/types';
import Canvas2D from './Canvas2D';
import GuidePanel from './GuidePanel';

const Viewport3D = lazy(() => import('./Viewport3D'));

interface MainViewportProps {
  activeTab: '2d' | '3d' | 'guide';
  onTabChange: (tab: '2d' | '3d' | 'guide') => void;
  panelState: PanelState;
  lightingPreset: LightingPreset;
  floorEnabled: boolean;
  scaleFigureEnabled: boolean;
  ceilingMode: boolean;
  rendererRef: React.MutableRefObject<unknown>;
  sceneRef: React.MutableRefObject<unknown>;
  cameraRef: React.MutableRefObject<unknown>;
}

export default function MainViewport({
  activeTab,
  onTabChange,
  panelState,
  lightingPreset,
  floorEnabled,
  scaleFigureEnabled,
  ceilingMode,
  rendererRef,
  sceneRef,
  cameraRef,
}: MainViewportProps) {
  const tabs: { id: '2d' | '3d' | 'guide'; label: string }[] = [
    { id: '2d', label: '2D Pattern' },
    { id: '3d', label: '3D Preview' },
    { id: 'guide', label: 'Guide' },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Tab bar */}
      <div className="flex gap-4 bg-[#222226] border-b border-[#3a3a3e] px-3">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`px-5 py-2.5 text-[13px] font-semibold border-b-2 transition-all ${
              activeTab === tab.id
                ? 'text-[#e0e0e0] border-[#4a9eff]'
                : 'text-[#888] border-transparent hover:text-[#e0e0e0]'
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden bg-[#111]">
        {activeTab === '2d' && <Canvas2D panelState={panelState} />}
        {activeTab === '3d' && (
          <Suspense fallback={
            <div className="flex items-center justify-center h-full text-[#888] text-sm">Loading 3D engine...</div>
          }>
            <Viewport3D
              panelState={panelState}
              lightingPreset={lightingPreset}
              floorEnabled={floorEnabled}
              scaleFigureEnabled={scaleFigureEnabled}
              ceilingMode={ceilingMode}
              rendererRef={rendererRef}
              sceneRef={sceneRef}
              cameraRef={cameraRef}
            />
          </Suspense>
        )}
        {activeTab === 'guide' && <GuidePanel />}

        {/* No-image message */}
        {activeTab !== 'guide' && !panelState.grayPixels && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-[#888] text-sm pointer-events-none">
            <div className="text-[32px] mb-2">&#9678;</div>
            Drop an image on the sidebar to begin
            <p className="mt-1.5 text-xs">Supports JPG, PNG, WebP</p>
          </div>
        )}
      </div>
    </div>
  );
}
