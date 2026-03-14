export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured. Add ANTHROPIC_API_KEY in Vercel environment variables." });
  }

  const { frames, trickId } = req.body;
  if (!frames || !trickId) {
    return res.status(400).json({ error: "Missing frames or trickId" });
  }

  const brutal = `SCORING PHILOSOPHY: Be a harsh, unforgiving judge. Most attempts should score 3–6. Scores of 8+ require genuinely impressive, dense, well-executed tricks. A score of 9 should feel rare. A 10 should feel nearly impossible — only for textbook-perfect execution with a massive, dense cloud. If the vapor is thin, wispy, or barely visible, score low (1–4). Do NOT give out easy high scores.`;

  const systemPrompts = {
    ghost: `You are VapeValidator, a brutally honest vape trick judge.\n${brutal}\n\nTrick: Ghost Inhale.\nScoring (1.0–10.0, one decimal):\n- cloud 0–3: size and density. Thin wispy exhale = 0–1. Dense ball = 2–3.\n- retention 0–3: how little vapor was lost. Major dissipation before re-inhale = 0–1.\n- execution 0–4: spherical shape of cloud + completeness of re-inhale. Sloppy = 0–1. Clean spherical re-inhale = 3–4.\nIf you see mostly empty air or a barely visible puff, score 1–3.\nRespond ONLY with JSON: {"score":<1.0-10.0>,"summary":"<one brutal honest sentence>","cloud":<0-3>,"retention":<0-3>,"execution":<0-4>}`,
    orings: `You are VapeValidator, a brutally honest vape trick judge.\n${brutal}\n\nTrick: O-Rings.\nCount only DISTINCT, clearly circular rings. Blobs, ovals, and shapeless puffs do NOT count.\nScoring (1.0–10.0, one decimal):\n- roundness 0–4: perfectly circular rings = 3–4. Deformed = 0–1.\n- consistency 0–3: uniform size and shape across rings.\n- distance 0–3: how far rings travel before dissolving.\nIf no clear rings are visible, ring_count = 0 and score = 1–3.\nRespond ONLY with JSON: {"score":<1.0-10.0>,"ring_count":<int>,"summary":"<one brutal honest sentence>","roundness":<0-4>,"consistency":<0-3>,"distance":<0-3>}`,
    french: `You are VapeValidator, a brutally honest vape trick judge.\n${brutal}\n\nTrick: French Inhale (Irish Waterfall). Vapor must visibly flow UPWARD from open mouth into nostrils continuously.\nScoring (1.0–10.0, one decimal):\n- flow 0–4: continuous unbroken vapor stream. Any gaps = major deduction.\n- direction 0–3: clearly travelling upward toward nose. Sideways or downward = 0.\n- volume 0–3: thick, dense, visible vapor stream. Wispy = 0–1.\nIf there is no visible upward vapor movement, score 1–3.\nRespond ONLY with JSON: {"score":<1.0-10.0>,"summary":"<one brutal honest sentence>","flow":<0-4>,"direction":<0-3>,"volume":<0-3>}`,
  };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompts[trickId] || systemPrompts.ghost,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: `Analyze these ${frames.length} frames of a vape trick video. Be harsh.` },
            ...frames.map(b64 => ({
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: b64 },
            })),
          ],
        }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const text = data.content?.find(b => b.type === "text")?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Analysis error:", err);
    return res.status(500).json({ error: "Analysis failed. " + err.message });
  }
}
