import { useState, useCallback, useRef } from 'react';

const SIZE_PRESETS = [
  { key: 'small',  w: 10, h: 8,  label: 'Small',  desc: 'Accent panel',   blurb: "10' × 8'"  },
  { key: 'medium', w: 20, h: 10, label: 'Medium', desc: 'Feature wall',   blurb: "20' × 10'" },
  { key: 'large',  w: 30, h: 12, label: 'Large',  desc: 'Statement wall', blurb: "30' × 12'" },
] as const;

const STARTER_IMAGES = [
  { file: 'gradient_sunset_skyline_colorful.jpg', label: 'Skyline' },
  { file: 'radiating_starburst_light_rays.jpg',   label: 'Starburst' },
  { file: 'jimi_hendrix_portrait_circles.jpg',    label: 'Portrait' },
  { file: 'flowing_waves_starry_night.jpg',       label: 'Waves' },
  { file: 'abstract_marble_ink_texture.jpg',      label: 'Marble' },
  { file: 'ink_dense_forest_misty_canopy.jpg',    label: 'Forest' },
  { file: 'peony_flower_line_drawing.jpg',        label: 'Flower' },
  { file: 'clouds.jpg',                           label: 'Clouds' },
];

interface OnboardingWizardProps {
  onComplete: (args: { wallW: number; wallH: number; sampleFile?: string; sampleLabel?: string; uploadedFile?: File }) => void;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const finish = useCallback(
    (imageArg: { sampleFile?: string; sampleLabel?: string; uploadedFile?: File }) => {
      if (!size) return;
      setFadingOut(true);
      onComplete({ wallW: size.w, wallH: size.h, ...imageArg });
    },
    [size, onComplete],
  );

  const handleSizePick = (w: number, h: number) => {
    setSize({ w, h });
    setStep(2);
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      style={{
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 0.5s ease',
        pointerEvents: fadingOut ? 'none' : 'auto',
        animation: fadingOut ? undefined : 'wizardIn 0.4s ease-out',
      }}
    >
      <div className="w-[720px] max-w-[94vw] bg-[#1a1a1e] rounded-2xl border border-[#3a3a3e] shadow-[0_32px_100px_rgba(0,0,0,0.7)] overflow-hidden">
        {/* Header with Mara */}
        <div className="px-8 pt-8 pb-2 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4a9eff] to-[#8a5aff] flex items-center justify-center text-[18px] font-bold text-white shadow-lg shrink-0">
            M
          </div>
          <div>
            <div className="text-[22px] font-bold text-white leading-tight">
              {step === 1 ? "Hi, I'm Mara." : 'Perfect. Now pick a vibe.'}
            </div>
            <div className="text-[13px] text-[#999] mt-1 leading-relaxed">
              {step === 1
                ? "Let's set up your first wall. What are we working on? Pick a size — we'll fine-tune later."
                : "I'll perforate this image into your panels. You can swap it anytime."}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {step === 1 && (
            <div className="grid grid-cols-3 gap-3">
              {SIZE_PRESETS.map(p => (
                <button
                  key={p.key}
                  onClick={() => handleSizePick(p.w * 12, p.h * 12)}
                  className="flex flex-col items-start gap-1 p-5 bg-[#2a2a2e] border border-[#3a3a3e] rounded-xl text-left hover:border-[#4a9eff] hover:bg-[#2a2a3e] transition-all group"
                >
                  <div className="text-[#888] text-[11px] uppercase tracking-wider font-semibold">{p.desc}</div>
                  <div className="text-[#e0e0e0] text-[20px] font-bold">{p.label}</div>
                  <div className="text-[#4a9eff] text-[13px] font-mono mt-1">{p.blurb}</div>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-4 gap-2.5 mb-4">
                {STARTER_IMAGES.map(img => (
                  <button
                    key={img.file}
                    onClick={() => finish({ sampleFile: img.file, sampleLabel: img.label })}
                    className="group relative aspect-square rounded-lg overflow-hidden border border-[#3a3a3e] hover:border-[#4a9eff] transition-all cursor-pointer"
                  >
                    <img
                      src={`/samples/${img.file}`}
                      alt={img.label}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-center pb-1.5">
                      <span className="text-[11px] font-medium text-white">{img.label}</span>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 border-2 border-dashed border-[#3a3a3e] rounded-lg text-[13px] text-[#888] hover:border-[#4a9eff] hover:text-[#4a9eff] hover:bg-[rgba(74,158,255,0.05)] transition-all"
              >
                ↑ Or upload your own image
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  if (e.target.files?.length) finish({ uploadedFile: e.target.files[0] });
                }}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-3 border-t border-[#3a3a3e] bg-[#0f0f12] flex items-center justify-between text-[11px] text-[#666]">
          <span>Step {step} of 2</span>
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="text-[#4a9eff] hover:underline"
            >
              ← Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
