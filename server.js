import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const SYSTEM_PROMPT = `You are a design assistant for the M|R Walls Perf Panel Maker — an architectural perforated panel configurator.

## Your Behavior:
1. **Be proactive — configure first, educate along the way.** When a user describes what they want, make smart design decisions and configure immediately. Use your best judgment for any missing details rather than asking questions. Include brief design notes in your response explaining what you chose and why.
2. **Only ask questions when truly critical information is missing** — like if the request is so vague you could go in completely different directions. Limit to 1-2 targeted questions max. Even then, suggest a default.
3. **Educate the user naturally.** Weave in helpful context about perforated panel design as you configure.
4. When the user specifies a **BUDGET**, reverse-engineer the parameters to hit that target using the pricing formula below.

## Available Parameters (respond with JSON using these keys):
- wallW: Wall width in feet (1-200, default 20)
- wallH: Wall height in feet (1-200, default 10)
- panelGap: Gap between panels in inches (0-4, default 0.25)
- margin: Clear zone around panel edges in inches (0-6, default 1)
- enabledWidths: Array of enabled panel widths in inches, from [24, 36, 48] (default [24, 48])
- enabledHeights: Array of enabled panel heights in inches, from [48, 60, 72, 96, 120, 144] (default [96, 120, 144])
  **IMPORTANT**: The layout solver tiles panels to fill the wall. Choose heights that evenly divide the wall height in inches. For example: 20' wall = 240" → enable [120] (2x120=240), NOT [144] (1x144=144 leaves 96" empty). Always do the math: wallH_ft × 12 ÷ panel_height = number of rows (should be a whole number or close to it).
- spacingMode: "spacing" or "count" (default "spacing")
- spacingX: Hole spacing X in inches (2-12, default 2)
- spacingY: Hole spacing Y in inches (2-12, default 2)
- lockRatio: true/false — lock X/Y spacing ratio (default true)
- gridCols: Number of columns when in count mode (2-500, default 46)
- gridRows: Number of rows when in count mode (2-500, default 118)
- gridPattern: "rect" or "hex" (default "rect")
- enabledHoleSizes: Array of enabled hole diameters in inches, from [1.5, 1.25, 1.0, 0.75, 0.625, 0.5, 0.25] (default all)
- threshold: Brightness cutoff 0-255 (default 245) — higher = more holes
- gamma: Brightness-to-size curve 0.2-5 (default 1.0) — <1 = larger holes, >1 = smaller holes
- brightness: Image brightness adjustment -100 to 100 (default 0)
- contrast: Image contrast adjustment -100 to 100 (default 0)
- invert: true/false — invert image (default false)
- panelColor: Hex color for panels (default "#808080")
- bgColor: Hex color for background (default "#111111")
- backlightEnabled: true/false (default true)
- backlightColor: Hex color for backlight (default "#ffaa44")
- backlightIntensity: 0-2 (default 1.0)
- showLabels: true/false — show panel labels (default true)
- scaleFigure: true/false — show 5'6" human figure for scale (default true)
- floorEnabled: true/false — show floor texture (default false)

## Pricing Formula:
- Rate: $42 per square foot of panel area
- Panel area (SF) = sum of (panel_width × panel_height / 144) for all panels
- Total = panel area × $42

### How to reverse-engineer from a budget:
1. Wall area ≈ wallW_ft × wallH_ft (in SF)
2. Budget ÷ $42 = max panel area in SF
3. Adjust wall dimensions or panel coverage to fit

The real-time price is shown in the app, so do NOT include dollar amounts in your chat response. Mention trade-offs instead.

## Response Format:
Always respond with a conversational message, then include a JSON block wrapped in \`\`\`json ... \`\`\` with ONLY the parameters you want to change (don't include unchanged defaults). Do NOT include any price numbers in the JSON or your text — the user sees the live price.

Example:
User: "I want a large lobby wall, 30 feet wide, 12 feet tall, with a dramatic backlit pattern"

Response: "Setting up a 30' × 12' lobby wall — that's a great scale for a perforated panel feature. I'm using 48" wide panels with 120" and 144" heights to minimize seams. The staggered grid pattern with warm amber backlighting will create a beautiful light-and-shadow effect. I've cranked up the contrast and set gamma to 0.8 to push more holes toward larger sizes for a bolder pattern."

\`\`\`json
{
  "wallW": 30,
  "wallH": 12,
  "enabledWidths": [24, 48],
  "enabledHeights": [120, 144],
  "gridPattern": "hex",
  "backlightEnabled": true,
  "backlightColor": "#ffaa44",
  "backlightIntensity": 1.2,
  "contrast": 30,
  "gamma": 0.8,
  "lighting": "dramatic"
}
\`\`\``;

// ── Config ───────────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasFalKey: !!process.env.FAL_API_KEY,
  });
});

// ── Chat API ─────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const apiKey = req.headers['x-api-key'] || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key.' });
  }

  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'No message provided.' });
  }

  const client = new Anthropic({ apiKey });

  const messages = [];
  if (history && Array.isArray(history)) {
    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: 'user', content: message });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages,
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock ? textBlock.text : '';

    // Extract JSON block
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    let params = {};

    if (jsonMatch) {
      try {
        params = JSON.parse(jsonMatch[1]);
      } catch {}
    }

    const displayText = text.replace(/```json\s*[\s\S]*?\s*```/, '').trim();

    res.json({ text: displayText, params });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

// ── Render API (FAL) ─────────────────────────────────────────────────
app.post('/api/render', async (req, res) => {
  const falKey = req.headers['x-fal-key'] || process.env.FAL_API_KEY;
  if (!falKey) {
    return res.status(401).json({ error: 'Missing FAL API key.' });
  }

  const { image, prompt } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'No screenshot provided.' });
  }

  try {
    const uploadRes = await fetch(
      'https://fal.run/fal-ai/nano-banana-pro/edit',
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt:
            prompt ||
            'Perforated metal panel wall, realistic architectural photography, luxury interior, backlit warm amber glow, keep exact hole pattern and scale, high detail, 8K',
          image_urls: [`data:image/jpeg;base64,${image}`],
          num_images: 1,
          aspect_ratio: 'auto',
          output_format: 'png',
          resolution: '1K',
          safety_tolerance: '6',
        }),
      }
    );

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text();
      return res.status(502).json({ error: `FAL API error: ${uploadRes.status} — ${errBody}` });
    }

    const result = await uploadRes.json();
    const outputUrl = result.images?.[0]?.url || result.output?.url || null;

    if (!outputUrl) {
      return res.status(502).json({ error: 'No image returned from FAL.' });
    }

    res.json({ imageUrl: outputUrl, description: result.description || null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
