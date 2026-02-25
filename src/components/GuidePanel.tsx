export default function GuidePanel() {
  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#111] p-8 text-[#e0e0e0]">
      <div className="max-w-[720px] mx-auto">
        <h2 className="text-lg font-bold text-[#4a9eff] border-b border-[#3a3a3e] pb-2 mb-4">How It Works</h2>
        <p className="text-[13px] text-[#bbb] leading-relaxed mb-3">
          This tool converts a source image into a <strong className="text-[#e0e0e0]">perforated panel design</strong> — a pattern of precisely sized and spaced holes that recreate the image when the panel is backlit. Darker areas of the image get larger holes (more light passes through), lighter areas get smaller holes or no holes at all.
        </p>

        <h2 className="text-lg font-bold text-[#4a9eff] border-b border-[#3a3a3e] pb-2 mb-4 mt-6">Step-by-Step Workflow</h2>

        <div className="flex items-start mb-3">
          <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#4a9eff] text-[#111] text-xs font-bold mr-2 shrink-0">1</span>
          <p className="text-[13px] text-[#bbb] leading-relaxed"><strong className="text-[#e0e0e0]">Upload a source image.</strong> Drag and drop (or click to browse) in the Source Image area. High-contrast images work best.</p>
        </div>
        <div className="flex items-start mb-3">
          <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#4a9eff] text-[#111] text-xs font-bold mr-2 shrink-0">2</span>
          <p className="text-[13px] text-[#bbb] leading-relaxed"><strong className="text-[#e0e0e0]">Set wall dimensions.</strong> Enter width and height in feet. Set the gap between panels (typically 1/4").</p>
        </div>
        <div className="flex items-start mb-3">
          <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#4a9eff] text-[#111] text-xs font-bold mr-2 shrink-0">3</span>
          <p className="text-[13px] text-[#bbb] leading-relaxed"><strong className="text-[#e0e0e0]">Choose panel sizes.</strong> Toggle which standard panel widths and heights are available. The solver finds the best combination.</p>
        </div>
        <div className="flex items-start mb-3">
          <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#4a9eff] text-[#111] text-xs font-bold mr-2 shrink-0">4</span>
          <p className="text-[13px] text-[#bbb] leading-relaxed"><strong className="text-[#e0e0e0]">Adjust image settings.</strong> Use brightness, contrast, and invert to optimize the perforation pattern.</p>
        </div>
        <div className="flex items-start mb-3">
          <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#4a9eff] text-[#111] text-xs font-bold mr-2 shrink-0">5</span>
          <p className="text-[13px] text-[#bbb] leading-relaxed"><strong className="text-[#e0e0e0]">Configure grid and holes.</strong> Set spacing, pattern, sizes, threshold, and gamma.</p>
        </div>
        <div className="flex items-start mb-3">
          <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#4a9eff] text-[#111] text-xs font-bold mr-2 shrink-0">6</span>
          <p className="text-[13px] text-[#bbb] leading-relaxed"><strong className="text-[#e0e0e0]">Preview and export.</strong> Review in 2D or 3D, then export as SVG, DXF, or PNG.</p>
        </div>

        <h2 className="text-lg font-bold text-[#4a9eff] border-b border-[#3a3a3e] pb-2 mb-4 mt-6">Controls Reference</h2>

        <h3 className="text-sm font-bold text-white mt-5 mb-2">Image Adjustments</h3>
        <ul className="text-[13px] text-[#bbb] leading-relaxed pl-5 list-disc mb-3 space-y-1">
          <li><strong className="text-[#e0e0e0]">Brightness</strong> — Shifts lightness. Increase to reduce holes.</li>
          <li><strong className="text-[#e0e0e0]">Contrast</strong> — Widens tonal range. Higher = sharper hole size distinction.</li>
          <li><strong className="text-[#e0e0e0]">Invert</strong> — Flips light and dark.</li>
        </ul>

        <h3 className="text-sm font-bold text-white mt-5 mb-2">Grid Settings</h3>
        <ul className="text-[13px] text-[#bbb] leading-relaxed pl-5 list-disc mb-3 space-y-1">
          <li><strong className="text-[#e0e0e0]">Spacing Mode</strong> — Set by physical spacing or by count.</li>
          <li><strong className="text-[#e0e0e0]">X / Y Spacing</strong> — Distance between hole centers. Smaller = finer detail.</li>
          <li><strong className="text-[#e0e0e0]">Grid Pattern</strong> — Rectangular or staggered (honeycomb).</li>
        </ul>

        <div className="bg-[rgba(255,170,68,0.08)] border-l-[3px] border-[#fa3] px-3 py-2 text-xs text-[#caa] rounded-r mb-3">
          <strong>Minimum 2" center-to-center spacing is enforced.</strong> Closer spacing compromises structural integrity.
        </div>

        <h3 className="text-sm font-bold text-white mt-5 mb-2">Hole Settings</h3>
        <ul className="text-[13px] text-[#bbb] leading-relaxed pl-5 list-disc mb-3 space-y-1">
          <li><strong className="text-[#e0e0e0]">Standard Sizes</strong> — Toggle available drill/punch sizes. Holes snap to nearest.</li>
          <li><strong className="text-[#e0e0e0]">Threshold</strong> — Brightness cutoff. Higher = more holes.</li>
          <li><strong className="text-[#e0e0e0]">Gamma</strong> — Curve mapping. &lt;1 = larger holes, &gt;1 = smaller holes.</li>
        </ul>

        <h2 className="text-lg font-bold text-[#4a9eff] border-b border-[#3a3a3e] pb-2 mb-4 mt-6">Export Formats</h2>
        <ul className="text-[13px] text-[#bbb] leading-relaxed pl-5 list-disc mb-3 space-y-1">
          <li><strong className="text-[#e0e0e0]">SVG</strong> — Vector file with real-world inch dimensions. For CNC/laser.</li>
          <li><strong className="text-[#e0e0e0]">DXF</strong> — AutoCAD-compatible (R12). Panel outlines + holes on separate layers.</li>
          <li><strong className="text-[#e0e0e0]">PNG</strong> — Raster screenshot for presentations.</li>
        </ul>

        <div className="bg-[rgba(74,158,255,0.08)] border-l-[3px] border-[#4a9eff] px-3 py-2 text-xs text-[#aaa] rounded-r mb-3">
          You can export individual panels or the full wall using the dropdown above the export buttons.
        </div>
      </div>
    </div>
  );
}
