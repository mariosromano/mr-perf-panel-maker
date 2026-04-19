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
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '' }]);
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
      if (!res.ok || !res.body) {
        const t = await res.text();
        throw new Error(t || 'Request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const raw of events) {
          const line = raw.trim();
          if (!line.startsWith('data:')) continue;
          let evt: Record<string, unknown>;
          try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (evt.type === 'delta' && typeof evt.text === 'string') {
            const delta = evt.text;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (!last || last.role !== 'assistant') return prev;
              return [...prev.slice(0, -1), { ...last, content: last.content + delta }];
            });
          } else if (evt.type === 'done') {
            if (typeof evt.fullText === 'string') {
              const finalText = evt.fullText as string;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (!last || last.role !== 'assistant') return prev;
                return [...prev.slice(0, -1), { ...last, content: finalText }];
              });
            }
            if (evt.params && typeof evt.params === 'object' && Object.keys(evt.params as object).length > 0) {
              applyParams(evt.params as Record<string, unknown>);
            }
          } else if (evt.type === 'error') {
            streamError = (evt.error as string) || 'Stream error';
          }
        }
      }
      if (streamError) throw new Error(streamError);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Drop the empty assistant bubble if the stream failed before any text
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.content === '') return prev.slice(0, -1);
        return prev;
      });
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
      <div className="px-5 py-3.5 border-b border-[#3a3a3e] bg-gradient-to-br from-[#2a2a2e] to-[#1a1a1e] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4a9eff] to-[#8a5aff] flex items-center justify-center text-[12px] font-bold text-white shadow-[0_2px_8px_rgba(74,158,255,0.4)]">M</div>
          <div>
            <div className="text-[14px] font-semibold text-white leading-none">Ask Mara</div>
            <div className="text-[10px] text-[#888] mt-0.5">Design assistant</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md text-[#888] hover:text-white hover:bg-[#3a3a3e] transition-colors flex items-center justify-center text-lg"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      {/* API Key input (only if server doesn't have it) */}
      {!serverHasAnthropicKey && (
        <div className="px-5 py-2 border-b border-[#3a3a3e] shrink-0">
          <input
            type="password"
            placeholder="Anthropic API Key (sk-ant-...)"
            value={apiKey}
            onChange={e => handleKeyChange(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-[#1a1a1e] border border-[#3a3a3e] rounded text-[#ccc] text-[11px] outline-none"
          />
        </div>
      )}

      {/* Compact welcome section — greeting + suggestions together, near top */}
      {messages.length <= 1 && (
        <div className="px-5 pt-4 pb-3 shrink-0">
          <div className="px-3.5 py-2.5 rounded-[14px_14px_14px_4px] bg-[#2a2a2e] text-[12.5px] leading-relaxed text-[#e0e0e0] mb-3 border border-[#3a3a3e]">
            {messages[0]?.content}
          </div>
          <div className="text-[10px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Try one of these</div>
          <div className="flex flex-col gap-1.5">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => { setInput(s); inputRef.current?.focus(); }}
                className="text-left px-3 py-2 bg-[#1a1a1e] border border-[#3a3a3e] rounded-md text-[12px] text-[#bbb] hover:border-[#4a9eff] hover:text-[#4a9eff] hover:bg-[rgba(74,158,255,0.06)] transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages (only when > 1 message) */}
      {messages.length > 1 && (
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {messages.map((msg, i) => (
            <div key={i} className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`px-3.5 py-2.5 text-[12.5px] leading-relaxed max-w-[88%] whitespace-pre-wrap text-white ${
                  msg.role === 'user'
                    ? 'bg-[#4a9eff] rounded-[14px_14px_4px_14px]'
                    : 'bg-[#3a3a3e] rounded-[14px_14px_14px_4px]'
                }`}
              >
                {msg.content || (loading && i === messages.length - 1 && msg.role === 'assistant' ? '…' : msg.content)}
              </div>
            </div>
          ))}
          {error && <div className="px-3 py-2 rounded-lg bg-[#4a2a2a] text-[#ff6b6b] text-xs">{error}</div>}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* Spacer that only exists when intro is shown — keeps input near top but pushes it to bottom when messages flow */}
      {messages.length <= 1 && <div className="flex-1 min-h-0" />}

      {/* Input — compact, close to content */}
      <div className="px-5 pt-2 pb-4 border-t border-[#3a3a3e] bg-[#1c1c20] shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything — tune sliders, recommend a vibe, explain a feature…"
            rows={2}
            className="flex-1 px-3 py-2 bg-[#0f0f12] border border-[#3a3a3e] rounded-lg text-white text-[13px] resize-none outline-none focus:border-[#4a9eff] transition-colors placeholder:text-[#555] leading-relaxed"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className={`px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all ${
              loading || !input.trim()
                ? 'bg-[#3a3a3e] text-[#888] cursor-default'
                : 'bg-gradient-to-br from-[#4a9eff] to-[#6a7eff] cursor-pointer hover:brightness-110 shadow-[0_2px_10px_rgba(74,158,255,0.3)]'
            }`}
          >
            {loading ? '…' : 'Send'}
          </button>
        </div>
        <div className="text-[9.5px] text-[#555] mt-1.5 flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4ade80]"></span>
          Powered by Haiku 4.5 · streaming
        </div>
      </div>
    </div>
  );
}
