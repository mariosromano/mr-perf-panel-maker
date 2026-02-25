import { useEffect, useRef, useCallback } from 'react';
import type { PanelState } from '../engine/types';
import { render2d } from '../engine/render2d';

interface Canvas2DProps {
  panelState: PanelState;
}

export default function Canvas2D({ panelState }: Canvas2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const camRef = useRef({ x: 0, y: 0, zoom: 1 });
  const panRef = useRef({ isPanning: false, startX: 0, startY: 0, camX: 0, camY: 0 });
  const zoomInfoRef = useRef<HTMLDivElement>(null);

  const resetView = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const padL = 60, padT = 50, padR = 20, padB = 20;
    const availW = container.clientWidth - padL - padR;
    const availH = container.clientHeight - padT - padB;
    const scaleX = availW / panelState.wallW;
    const scaleY = availH / panelState.wallH;
    const zoom = Math.min(scaleX, scaleY);
    camRef.current = {
      x: padL + (availW / 2) - (panelState.wallW / 2) * zoom,
      y: padT + (availH / 2) - (panelState.wallH / 2) * zoom,
      zoom,
    };
    if (zoomInfoRef.current) zoomInfoRef.current.textContent = Math.round(zoom * 100) + '%';
  }, [panelState.wallW, panelState.wallH]);

  const doRender = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    const cam = camRef.current;
    render2d(canvas, panelState, cam.x, cam.y, cam.zoom);
  }, [panelState]);

  // Reset view on wall dimension change
  useEffect(() => {
    resetView();
  }, [resetView]);

  // Render on state change
  useEffect(() => {
    requestAnimationFrame(doRender);
  }, [doRender]);

  // Wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const cam = camRef.current;
      const nz = Math.max(0.05, Math.min(200, cam.zoom * factor));
      cam.x = mx - (mx - cam.x) * (nz / cam.zoom);
      cam.y = my - (my - cam.y) * (nz / cam.zoom);
      cam.zoom = nz;
      if (zoomInfoRef.current) zoomInfoRef.current.textContent = Math.round(nz * 100) + '%';
      doRender();
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [doRender]);

  // Pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleDown = (e: MouseEvent) => {
      panRef.current = {
        isPanning: true,
        startX: e.clientX,
        startY: e.clientY,
        camX: camRef.current.x,
        camY: camRef.current.y,
      };
    };
    const handleMove = (e: MouseEvent) => {
      if (!panRef.current.isPanning) return;
      camRef.current.x = panRef.current.camX + (e.clientX - panRef.current.startX);
      camRef.current.y = panRef.current.camY + (e.clientY - panRef.current.startY);
      doRender();
    };
    const handleUp = () => {
      panRef.current.isPanning = false;
    };
    canvas.addEventListener('mousedown', handleDown);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      canvas.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [doRender]);

  // Resize
  useEffect(() => {
    const handleResize = () => doRender();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [doRender]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-grab active:cursor-grabbing"
      />
      <div
        ref={zoomInfoRef}
        className="absolute bottom-2 left-2 text-[11px] text-[#888] bg-black/50 px-2 py-0.5 rounded pointer-events-none"
      >
        100%
      </div>
    </div>
  );
}
