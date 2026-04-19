import { useState, useCallback, useRef, useEffect } from 'react';
import type { PanelState, LightingPreset } from '../engine/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Denser pattern, more contrast',
  'Softer, gallery lighting',
  'Bigger wall, 30ft, dramatic backlight',
];

interface AskMaraDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onStateChange: (updates: Partial<PanelState>) => void;
  onLightingPresetChange: (preset: LightingPreset) => void;
  onScaleFigureEnabledChange: (enabled: boolean) => void;
  onFloorEnabledChange: (enabled: boolean) => void;
  onCeilingModeChange: (enabled: boolean) => void;
}

function getSavedKey(key: string): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(key) ?? '';
}

export default function AskMaraDrawer({
  isOpen,
  onClose,
  onStateChange,
  onLightingPresetChange,
  onScaleFigureEnabledChange,
  onFloorEnabledChange,
  onCeilingModeChange,
}: AskMaraDrawerProps) {
  const [apiKey, setApiKey] = useState(() => getSavedKey('perfpanel_api_key'));
  const [serverHasAnthropicKey, setServerHasAnthropicKey] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "I'm Mara. Tell me how to tune your panels — size, density, lighting — and I'll adjust the sliders live.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(cfg => { if (cfg.hasAnthropicKey) setServerHasAnthropicKey(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyChange = useCallback((val: string) => {
    setApiKey(val);
    localStorage.setItem('perfpanel_api_key', val);
  }, []);

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
      setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
      if (data.params && Object.keys(data.params).length > 0) applyParams(data.params);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [input, apiKey, serverHasAnthropicKey, messages, applyParams]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <div
      className="absolute top-0 right-0 h-full bg-[#222226] border-l border-[#3a3a3e] shadow-[-8px_0_32px_rgba(0,0,0,0.4)] flex flex-col z-50"
      style={{
        width: 360,
        transform: isOpen ? 'translateX(0)' : 'translateX(110%)',
        transition: 'transform 0.3s ease',
      }}
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-[#3a3a3e] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#4a9eff] to-[#8a5aff] flex items-center justify-center text-[11px] font-bold text-white">M</div>
          <div className="text-[14px] font-semibold text-white">Ask Mara</div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md text-[#888] hover:text-white hover:bg-[#3a3a3e] transition-colors flex items-center justify-center"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      {/* API Key input (only if server doesn't have it) */}
      {!serverHasAnthropicKey && (
        <div className="px-5 py-2 border-b border-[#3a3a3e]">
          <input
            type="password"
            placeholder="Anthropic API Key (sk-ant-...)"
            value={apiKey}
            onChange={e => handleKeyChange(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-[#1a1a1e] border border-[#3a3a3e] rounded text-[#ccc] text-[11px] outline-none"
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`px-3.5 py-2.5 text-[12.5px] leading-relaxed max-w-[88%] whitespace-pre-wrap text-white ${
                msg.role === 'user'
                  ? 'bg-[#4a9eff] rounded-[14px_14px_4px_14px]'
                  : 'bg-[#3a3a3e] rounded-[14px_14px_14px_4px]'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="px-3.5 py-2.5 rounded-[14px_14px_14px_4px] bg-[#3a3a3e] text-[#888] text-[13px] inline-block">
            Thinking...
          </div>
        )}
        {error && <div className="px-3 py-2 rounded-lg bg-[#4a2a2a] text-[#ff6b6b] text-xs">{error}</div>}
        <div ref={chatEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-5 pb-2 flex flex-col gap-1.5">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => setInput(s)}
              className="text-left px-3 py-2 bg-[#1a1a1e] border border-[#3a3a3e] rounded-md text-[12px] text-[#bbb] hover:border-[#4a9eff] hover:text-[#4a9eff] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 px-5 border-t border-[#3a3a3e] bg-[#2a2a2e]">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="How should I tune it?"
            rows={2}
            className="flex-1 px-3 py-2 bg-[#1a1a1e] border border-[#3a3a3e] rounded-lg text-white text-[13px] resize-none outline-none focus:border-[#4a9eff] transition-colors placeholder:text-[#666]"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold text-white self-end ${
              loading || !input.trim() ? 'bg-[#555] cursor-default' : 'bg-[#4a9eff] cursor-pointer hover:bg-[#3a8eef]'
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
