export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      score: 1.0, summary: "ERROR: GEMINI_API_KEY not found in environment variables.",
      cloud: 0, retention: 0, execution: 0, flow: 0, direction: 0, volume: 0, ring_count: 0,
    });
  }

  const { frames, trickId } = req.body || {};
  if (!frames || !trickId) {
    return res.status(200).json({
      score: 1.0, summary: "ERROR: Missing frames or trickId in request.",
      cloud: 0, retention: 0, execution: 0, flow: 0, direction: 0, volume: 0, ring_count: 0,
    });
  }

  const brutal = `SCORING PHILOSOPHY: Be a harsh, unforgiving judge. Most attempts should score 3-6. Scores of 8+ require genuinely impressive, dense, well-executed tricks. A score of 9 should feel rare. A 10 should feel nearly impossible. If the vapor is thin, wispy, or barely visible, score low (1-4). Do NOT give out easy high scores.`;

  const prompts = {
    ghost: `You are VapeValidator, a brutally honest vape trick judge.\n${brutal}\n\nTrick: Ghost Inhale. The user exhales a ball of vapor then re-inhales it.\nScoring (1.0-10.0, one decimal):\n- cloud 0-3: size and density. Thin wispy exhale = 0-1. Dense ball = 2-3.\n- retention 0-3: how little vapor was lost before re-inhale = 0-1.\n- execution 0-4: spherical shape + clean re-inhale. Sloppy = 0-1. Perfect = 3-4.\nRespond ONLY with JSON, no markdown: {"score":<1.0-10.0>,"summary":"<one brutal sentence>","cloud":<0-3>,"retention":<0-3>,"execution":<0-4>}`,
    orings: `You are VapeValidator, a brutally honest vape trick judge.\n${brutal}\n\nTrick: O-Rings. Count only DISTINCT clearly circular rings. Blobs do NOT count.\nScoring (1.0-10.0, one decimal):\n- roundness 0-4: perfectly circular = 3-4. Deformed = 0-1.\n- consistency 0-3: uniform size and shape.\n- distance 0-3: how far rings travel.\nRespond ONLY with JSON, no markdown: {"score":<1.0-10.0>,"ring_count":<int>,"summary":"<one brutal sentence>","roundness":<0-4>,"consistency":<0-3>,"distance":<0-3>}`,
    french: `You are VapeValidator, a brutally honest vape trick judge.\n${brutal}\n\nTrick: French Inhale. Vapor must visibly flow UPWARD from mouth into nostrils.\nScoring (1.0-10.0, one decimal):\n- flow 0-4: continuous unbroken stream. Gaps = major deduction.\n- direction 0-3: clearly going upward toward nose.\n- volume 0-3: thick dense visible vapor. Wispy = 0-1.\nRespond ONLY with JSON, no markdown: {"score":<1.0-10.0>,"summary":"<one brutal sentence>","flow":<0-4>,"direction":<0-3>,"volume":<0-3>}`,
  };

  const prompt = prompts[trickId] || prompts.ghost;
  const parts = [
    { text: prompt },
    ...frames.map(b64 => ({ inline_data: { mime_type: "image/jpeg", data: b64 } })),
    { text: "Now analyze the frames and respond with only the JSON." },
  ];

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
        }),
      }
    );

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return res.status(200).json({
        score: 1.0, summary: "PARSE_ERROR: " + rawText.slice(0, 200),
        cloud: 0, retention: 0, execution: 0, flow: 0, direction: 0, volume: 0, ring_count: 0,
      });
    }

    if (data.error) {
      return res.status(200).json({
        score: 1.0, summary: "GEMINI_ERROR " + data.error.code + ": " + data.error.message,
        cloud: 0, retention: 0, execution: 0, flow: 0, direction: 0, volume: 0, ring_count: 0,
      });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(200).json({
        score: 1.0, summary: "JSON_PARSE_ERROR: " + clean.slice(0, 200),
        cloud: 0, retention: 0, execution: 0, flow: 0, direction: 0, volume: 0, ring_count: 0,
      });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(200).json({
      score: 1.0, summary: "FETCH_ERROR: " + err.message,
      cloud: 0, retention: 0, execution: 0, flow: 0, direction: 0, volume: 0, ring_count: 0,
    });
  }
}
