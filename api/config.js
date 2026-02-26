export default function handler(req, res) {
  res.json({
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasFalKey: !!process.env.FAL_API_KEY,
  });
}
