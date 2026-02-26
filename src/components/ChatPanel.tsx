import { useState, useCallback, useRef, useEffect } from 'react';
import type { PanelState, LightingPreset } from '../engine/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

function getSavedKey(key: string): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(key) ?? '';
}

const SUGGESTIONS = [
  'Large lobby wall, 30ft wide, dramatic backlit perforation',
  'Subtle geometric pattern, white panels, gallery lighting',
  'Budget $20K, 15ft wall, bold high-contrast design',
];

interface ChatPanelProps {
  onStateChange: (updates: Partial<PanelState>) => void;
  onLightingPresetChange: (preset: LightingPreset) => void;
  onScaleFigureEnabledChange: (enabled: boolean) => void;
  onFloorEnabledChange: (enabled: boolean) => void;
  onCeilingModeChange: (enabled: boolean) => void;
  rendererRef: React.MutableRefObject<unknown>;
  sceneRef: React.MutableRefObject<unknown>;
  cameraRef: React.MutableRefObject<unknown>;
  isFloating?: boolean;
  sidebarReady?: boolean;
  onOnboardingComplete?: () => void;
}

export default function ChatPanel({
  onStateChange,
  onLightingPresetChange,
  onScaleFigureEnabledChange,
  onFloorEnabledChange,
  onCeilingModeChange,
  rendererRef,
  sceneRef,
  cameraRef,
  isFloating = false,
  sidebarReady = true,
  onOnboardingComplete,
}: ChatPanelProps) {
  const [apiKey, setApiKey] = useState(() => getSavedKey('perfpanel_api_key'));
  const [falKey, setFalKey] = useState(() => getSavedKey('perfpanel_fal_key'));
  const [serverHasAnthropicKey, setServerHasAnthropicKey] = useState(true);
  const [serverHasFalKey, setServerHasFalKey] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Describe the perforated panel wall you want — size, style, hole density, lighting — and I\'ll configure it live. Upload an image first, then tell me what you need.',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showRenderPanel, setShowRenderPanel] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [scenePrompt, setScenePrompt] = useState(
    'Perforated metal panel wall, realistic architectural photography, backlit warm amber glow, keep exact hole pattern and scale'
  );
  const [renderResult, setRenderResult] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStartTime, setRenderStartTime] = useState<number | null>(null);
  const [renderElapsed, setRenderElapsed] = useState(0);
  const renderTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [floatingFadingOut, setFloatingFadingOut] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const floatingTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Check server keys
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(cfg => {
        if (cfg.hasAnthropicKey) setServerHasAnthropicKey(true);
        if (cfg.hasFalKey) setServerHasFalKey(true);
      })
      .catch(() => {});
  }, []);

  // Auto-focus floating textarea
  useEffect(() => {
    if (isFloating && !floatingFadingOut && floatingTextareaRef.current) {
      floatingTextareaRef.current.focus();
    }
  }, [isFloating, floatingFadingOut]);

  // Render progress timer
  useEffect(() => {
    if (rendering && renderStartTime) {
      renderTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - renderStartTime) / 1000;
        setRenderElapsed(elapsed);
        // Asymptotic curve: ~42% at 5s, ~63% at 10s, ~76% at 15s, ~82% at 20s
        setRenderProgress(90 * (1 - Math.exp(-elapsed / 8)));
      }, 100);
      return () => clearInterval(renderTimerRef.current);
    } else {
      clearInterval(renderTimerRef.current);
    }
  }, [rendering, renderStartTime]);

  const handleKeyChange = useCallback((val: string) => {
    setApiKey(val);
    localStorage.setItem('perfpanel_api_key', val);
  }, []);

  const handleFalKeyChange = useCallback((val: string) => {
    setFalKey(val);
    localStorage.setItem('perfpanel_fal_key', val);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Apply AI params
  const applyParams = useCallback((aiParams: Record<string, unknown>) => {
    const updates: Partial<PanelState> = {};

    if (aiParams.wallW !== undefined) updates.wallW = Number(aiParams.wallW) * 12;
    if (aiParams.wallH !== undefined) updates.wallH = Number(aiParams.wallH) * 12;
    if (aiParams.panelGap !== undefined) updates.panelGap = Number(aiParams.panelGap);
    if (aiParams.margin !== undefined) updates.margin = Number(aiParams.margin);
    if (aiParams.enabledWidths !== undefined) updates.enabledWidths = aiParams.enabledWidths as number[];
    if (aiParams.enabledHeights !== undefined) updates.enabledHeights = aiParams.enabledHeights as number[];
    if (aiParams.spacingMode !== undefined) updates.spacingMode = aiParams.spacingMode as 'spacing' | 'count';
    if (aiParams.spacingX !== undefined) updates.spacingX = Number(aiParams.spacingX);
    if (aiParams.spacingY !== undefined) updates.spacingY = Number(aiParams.spacingY);
    if (aiParams.lockRatio !== undefined) updates.lockRatio = Boolean(aiParams.lockRatio);
    if (aiParams.gridCols !== undefined) updates.gridCols = Number(aiParams.gridCols);
    if (aiParams.gridRows !== undefined) updates.gridRows = Number(aiParams.gridRows);
    if (aiParams.gridPattern !== undefined) updates.gridPattern = aiParams.gridPattern as 'rect' | 'hex';
    if (aiParams.enabledHoleSizes !== undefined) updates.enabledHoleSizes = aiParams.enabledHoleSizes as number[];
    if (aiParams.holeShape !== undefined) updates.holeShape = aiParams.holeShape as 'circle' | 'square';
    if (aiParams.threshold !== undefined) updates.threshold = Number(aiParams.threshold);
    if (aiParams.gamma !== undefined) updates.gamma = Number(aiParams.gamma);
    if (aiParams.brightness !== undefined) updates.brightness = Number(aiParams.brightness);
    if (aiParams.contrast !== undefined) updates.contrast = Number(aiParams.contrast);
    if (aiParams.invert !== undefined) updates.invert = Boolean(aiParams.invert);
    if (aiParams.panelColor !== undefined) updates.panelColor = String(aiParams.panelColor);
    if (aiParams.bgColor !== undefined) updates.bgColor = String(aiParams.bgColor);
    if (aiParams.backlightEnabled !== undefined) updates.backlight = Boolean(aiParams.backlightEnabled);
    if (aiParams.backlightMode !== undefined) updates.backlightMode = aiParams.backlightMode as 'solid' | 'gradient';
    if (aiParams.backlightColor !== undefined) updates.backlightColor = String(aiParams.backlightColor);
    if (aiParams.backlightColor2 !== undefined) updates.backlightColor2 = String(aiParams.backlightColor2);
    if (aiParams.backlightGradientAngle !== undefined) updates.backlightGradientAngle = Number(aiParams.backlightGradientAngle);
    if (aiParams.backlightIntensity !== undefined) updates.backlightIntensity = Number(aiParams.backlightIntensity);
    if (aiParams.showLabels !== undefined) updates.showLabels = Boolean(aiParams.showLabels);

    if (Object.keys(updates).length > 0) onStateChange(updates);

    if (aiParams.lighting !== undefined) onLightingPresetChange(aiParams.lighting as LightingPreset);
    if (aiParams.scaleFigure !== undefined) onScaleFigureEnabledChange(Boolean(aiParams.scaleFigure));
    if (aiParams.floorEnabled !== undefined) onFloorEnabledChange(Boolean(aiParams.floorEnabled));
    if (aiParams.ceilingMode !== undefined) onCeilingModeChange(Boolean(aiParams.ceilingMode));
  }, [onStateChange, onLightingPresetChange, onScaleFigureEnabledChange, onFloorEnabledChange, onCeilingModeChange]);

  // Capture screenshot
  const captureScreenshot = useCallback((): string | null => {
    const renderer = rendererRef.current as { render: (s: unknown, c: unknown) => void; domElement: HTMLCanvasElement } | null;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return null;
    renderer.render(scene, camera);
    const canvas = renderer.domElement;
    const maxDim = 1536;
    let w = canvas.width, h = canvas.height;
    if (w > maxDim || h > maxDim) {
      const ratio = maxDim / Math.max(w, h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/jpeg', 0.85);
    ctx.drawImage(canvas, 0, 0, w, h);
    return offscreen.toDataURL('image/jpeg', 0.85);
  }, [rendererRef, sceneRef, cameraRef]);

  // FAL render
  const handleRender = useCallback(async () => {
    if (!falKey && !serverHasFalKey) {
      setError('Enter your FAL API key first.');
      return;
    }
    setRendering(true);
    setError(null);
    setRenderResult(null);
    setRenderProgress(0);
    setRenderElapsed(0);
    setRenderStartTime(Date.now());
    try {
      const dataUrl = captureScreenshot();
      if (!dataUrl) throw new Error('Could not capture screenshot');
      const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
      const renderHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (falKey) renderHeaders['x-fal-key'] = falKey;
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: renderHeaders,
        body: JSON.stringify({ image: base64, prompt: scenePrompt }),
      });
      const text = await res.text();
      let data: Record<string, unknown>;
      try { data = JSON.parse(text); } catch { throw new Error(`Server error (${res.status}): ${text.slice(0, 120)}`); }
      if (!res.ok) throw new Error((data.error as string) || 'Render failed');
      setRenderProgress(100);
      setRenderResult(data.imageUrl as string);
      setMessages(prev => [
        ...prev,
        { role: 'user', content: 'Render realistic' },
        { role: 'assistant', content: "Here's the photorealistic render:", imageUrl: data.imageUrl as string },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Render failed');
    } finally {
      setRendering(false);
      setRenderStartTime(null);
    }
  }, [falKey, serverHasFalKey, scenePrompt, captureScreenshot]);

  // Send chat message
  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;
    if (!apiKey && !serverHasAnthropicKey) {
      setError('Enter your Anthropic API key first.');
      return;
    }
    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);
    try {
      const history = messages.slice(1).map(m => ({ role: m.role, content: m.content }));
      const chatHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) chatHeaders['x-api-key'] = apiKey;
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: chatHeaders,
        body: JSON.stringify({ message: input.trim(), history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      const assistantMsg: ChatMessage = { role: 'assistant', content: data.text };
      setMessages(prev => [...prev, assistantMsg]);
      if (data.params && Object.keys(data.params).length > 0) {
        applyParams(data.params);
      }
      if (isFloating && onOnboardingComplete) {
        setFloatingFadingOut(true);
        setTimeout(() => {
          onOnboardingComplete();
          setFloatingFadingOut(false);
        }, 300);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [input, apiKey, serverHasAnthropicKey, messages, applyParams, isFloating, onOnboardingComplete]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <>
      {/* Floating Welcome Card */}
      {isFloating && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center"
          style={{
            background: 'rgba(0,0,0,0.5)',
            animation: floatingFadingOut ? 'floatCardOut 0.3s ease-in forwards' : 'floatCardIn 0.4s ease-out',
          }}
        >
          <div className="w-[520px] max-w-[90vw] bg-[#222226] rounded-2xl border border-[#3a3a3e] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
            <div className="text-center mb-6">
              <div className="text-[28px] font-bold text-white mb-2">
                <span className="text-[#4a9eff]">M|R</span> Walls
              </div>
              <div className="text-[#999] text-sm leading-relaxed">
                Describe the perforated panel wall you want and the AI will configure it live.
                <br />Upload an image first, then describe the style, size, and lighting.
              </div>
            </div>
            {!serverHasAnthropicKey && !apiKey && (
              <input
                type="password"
                placeholder="Anthropic API Key (sk-ant-...)"
                value={apiKey}
                onChange={e => handleKeyChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#1a1a1e] border border-[#3a3a3e] rounded-lg text-[#ccc] text-[13px] mb-4 outline-none"
              />
            )}
            <div className="flex flex-col gap-2 mb-5">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInput(s)}
                  className="px-3.5 py-2.5 rounded-lg text-[13px] cursor-pointer text-left transition-all"
                  style={{
                    background: input === s ? '#2a2a3e' : '#1a1a1e',
                    border: `1px solid ${input === s ? '#4a9eff' : '#3a3a3e'}`,
                    color: input === s ? '#4a9eff' : '#bbb',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea
                ref={floatingTextareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your wall..."
                rows={3}
                className="flex-1 px-3.5 py-3 bg-[#1a1a1e] border border-[#3a3a3e] rounded-lg text-white text-[14px] resize-none outline-none font-[inherit] focus:border-[#4a9eff] transition-colors placeholder:text-[#666]"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className={`px-6 py-3 border-none rounded-lg text-[14px] font-semibold text-white self-end ${
                  loading || !input.trim() ? 'bg-[#555] cursor-default' : 'bg-[#4a9eff] cursor-pointer hover:bg-[#3a8eef]'
                }`}
              >
                {loading ? '...' : 'Send'}
              </button>
            </div>
            {loading && <div className="text-center text-[#4a9eff] text-[13px] mt-4">Configuring your wall...</div>}
            {error && <div className="px-3 py-2 rounded-lg bg-[#4a2a2a] text-[#ff6b6b] text-xs mt-3">{error}</div>}
          </div>
        </div>
      )}

      {/* Sidebar Chat Panel */}
      <div
        className="flex flex-col bg-[#222226] border-r border-[#3a3a3e] h-screen"
        style={{
          width: sidebarReady ? 380 : 0,
          minWidth: sidebarReady ? 380 : 0,
          opacity: sidebarReady ? 1 : 0,
          overflow: sidebarReady ? undefined : 'hidden',
          borderRight: sidebarReady ? undefined : 'none',
          transition: 'width 0.5s ease, min-width 0.5s ease, opacity 0.5s ease',
        }}
      >
        {/* Header + API Keys */}
        <div className="p-4 px-6 border-b border-[#3a3a3e]">
          <div className="text-lg font-bold text-white mb-2">
            <span className="text-[#4a9eff]">M|R</span> Walls
          </div>
          {!serverHasAnthropicKey && (
            <input
              type="password"
              placeholder="Anthropic API Key (sk-ant-...)"
              value={apiKey}
              onChange={e => handleKeyChange(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#1a1a1e] border border-[#3a3a3e] rounded text-[#ccc] text-[11px] mb-1.5 outline-none"
            />
          )}
          {!serverHasFalKey && (
            <input
              type="password"
              placeholder="FAL API Key (for realistic renders)"
              value={falKey}
              onChange={e => handleFalKeyChange(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#1a1a1e] border border-[#3a3a3e] rounded text-[#ccc] text-[11px] outline-none"
            />
          )}
        </div>

        {/* How to Use */}
        <div className="px-6 pt-3">
          <button
            onClick={() => setShowAbout(!showAbout)}
            className={`w-full py-1.5 border rounded-md text-[11px] cursor-pointer font-medium transition-colors ${
              showAbout ? 'bg-[#2a2a3e] border-[#3a3a3e] text-[#4a9eff]' : 'bg-transparent border-[#3a3a3e] text-[#888]'
            }`}
          >
            {showAbout ? 'Hide Guide' : 'How to Use'}
          </button>
          {showAbout && (
            <div className="p-3 bg-[#1a1a1e] rounded-lg mt-1.5 text-[11px] text-[#bbb] leading-relaxed max-h-[260px] overflow-y-auto">
              <div className="font-bold text-[#4a9eff] mb-1.5 text-xs">M|R Walls Perf Panel Maker</div>
              <p className="mb-2">Design perforated panel walls by uploading an image and describing what you want in the chat.</p>
              <div className="font-semibold text-[#ccc] mb-1">What you can do:</div>
              <ul className="mb-2 pl-4 list-disc space-y-0.5">
                <li>Upload an image and the AI converts it to a perforation pattern</li>
                <li>Describe wall dimensions, lighting, hole settings</li>
                <li>Set a budget and the AI adjusts parameters</li>
                <li>Export SVG, DXF for CNC or PNG for presentations</li>
                <li>Render photorealistic images (requires FAL key)</li>
              </ul>
              <div className="font-semibold text-[#ccc] mb-1">Tips:</div>
              <ul className="pl-4 list-disc space-y-0.5">
                <li>High-contrast images work best for perforations</li>
                <li>Pricing: $42/SF panel area</li>
                <li>Use gamma &lt;1 for bolder patterns, &gt;1 for subtler</li>
              </ul>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.map((msg, i) => (
            <div key={i} className={`mb-3 flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`px-3.5 py-2.5 text-[12.5px] leading-relaxed max-w-[88%] whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#4a9eff] rounded-[14px_14px_4px_14px]'
                    : 'bg-[#3a3a3e] rounded-[14px_14px_14px_4px]'
                } text-white`}
              >
                {msg.content}
              </div>
              {msg.imageUrl && (
                <img
                  src={msg.imageUrl}
                  alt="Rendered"
                  className="mt-2 max-w-[90%] rounded-lg cursor-pointer border border-[#3a3a3e]"
                  onClick={() => setRenderResult(msg.imageUrl!)}
                />
              )}
            </div>
          ))}
          {loading && (
            <div className="px-3.5 py-2.5 rounded-[14px_14px_14px_4px] bg-[#3a3a3e] text-[#888] text-[13px] inline-block">
              Configuring...
            </div>
          )}
          {rendering && (
            <div className="px-3.5 py-3 rounded-[14px_14px_14px_4px] bg-[#3a3a3e] text-[13px] max-w-[88%]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[#c9a0ff] font-medium">Rendering...</span>
                <span className="text-[#888] text-[11px] font-mono">{Math.round(renderElapsed)}s</span>
              </div>
              <div className="w-full h-2 bg-[#2a2a2e] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-200 ease-out"
                  style={{
                    width: `${Math.round(renderProgress)}%`,
                    background: 'linear-gradient(90deg, #7a5aaa, #5a3a8a)',
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[#888] text-[10px]">{Math.round(renderProgress)}%</span>
                <span className="text-[#666] text-[10px]">Generating photorealistic image</span>
              </div>
            </div>
          )}
          {error && <div className="px-3 py-2 rounded-lg bg-[#4a2a2a] text-[#ff6b6b] text-xs">{error}</div>}
          <div ref={chatEndRef} />
        </div>

        {/* Render Panel */}
        <div className="px-6 pt-1.5">
          <button
            onClick={() => setShowRenderPanel(!showRenderPanel)}
            className={`w-full py-2 border rounded-md text-[11px] cursor-pointer font-semibold transition-colors ${
              showRenderPanel
                ? 'bg-[#5a3a7a] border-[#7a5aaa] text-white'
                : 'bg-transparent border-[#7a5aaa] text-[#c9a0ff]'
            }`}
          >
            {showRenderPanel ? 'Hide Render' : 'Render Realistic'}
          </button>
          {showRenderPanel && (
            <div className="py-2">
              <textarea
                value={scenePrompt}
                onChange={e => setScenePrompt(e.target.value)}
                rows={3}
                placeholder="Describe the scene context..."
                className="w-full px-2.5 py-2 bg-[#1a1a1e] border border-[#3a3a3e] rounded-md text-white text-[11px] resize-none outline-none font-[inherit] mb-1.5"
              />
              <button
                onClick={handleRender}
                disabled={rendering || (!falKey && !serverHasFalKey)}
                className={`w-full py-2.5 border-none rounded-md text-[13px] font-bold text-white ${
                  rendering || (!falKey && !serverHasFalKey)
                    ? 'bg-[#555] cursor-default'
                    : 'bg-gradient-to-br from-[#7a5aaa] to-[#5a3a8a] cursor-pointer'
                }`}
              >
                {rendering ? 'Rendering...' : (!falKey && !serverHasFalKey) ? 'Enter FAL Key Above' : 'Render'}
              </button>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 px-6 border-t border-[#3a3a3e] bg-[#2a2a2e]">
          <div className="text-[10px] text-[#888] mb-2 uppercase tracking-wider font-medium">Describe your wall</div>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='e.g. "30ft lobby, dramatic backlight" or "budget $20K, bold pattern"'
              rows={3}
              className="flex-1 px-4 py-3 bg-[#1a1a1e] border border-[#3a3a3e] rounded-xl text-white text-[14px] leading-relaxed resize-none outline-none font-[inherit] focus:border-[#4a9eff] transition-colors placeholder:text-[#666]"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className={`px-5 py-3 border-none rounded-xl text-[14px] font-semibold text-white self-end ${
                loading || !input.trim() ? 'bg-[#555] cursor-default' : 'bg-[#4a9eff] cursor-pointer hover:bg-[#3a8eef]'
              }`}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Render Result Modal */}
      {renderResult && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-[9999] cursor-pointer"
          onClick={() => setRenderResult(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img
              src={renderResult}
              alt="Photorealistic Render"
              className="max-w-[90vw] max-h-[85vh] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
            />
            <div className="flex gap-2 justify-center mt-3">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(renderResult!);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'mr-walls-render.png';
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch {
                    window.open(renderResult!, '_blank');
                  }
                }}
                className="px-6 py-2.5 bg-[#4a9eff] text-white border-none rounded-md text-[13px] font-semibold cursor-pointer"
              >
                Download
              </button>
              <button
                onClick={() => setRenderResult(null)}
                className="px-6 py-2.5 bg-[#4a4a52] text-white border-none rounded-md text-[13px] font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
