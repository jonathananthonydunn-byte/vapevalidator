// VapeValidator — pure client-side computer vision, no API key needed

// ── Helpers ──────────────────────────────────────────────────────────────────

function decodeBase64Frame(b64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.width, img.height));
    };
    img.src = "data:image/jpeg;base64," + b64;
  });
}

// Returns 0-1 score of how much "smoke-like" pixels are in the image
// Smoke = high brightness, low saturation (white/grey pixels)
function analyzeSmokePixels(imageData) {
  const { data, width, height } = imageData;
  let smokePixels = 0;
  let totalPixels = 0;
  let brightnessList = [];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const brightness = (r + g + b) / 3 / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;

    brightnessList.push(brightness);
    totalPixels++;

    // Smoke-like: bright and low saturation (white/grey cloud)
    if (brightness > 0.55 && saturation < 0.25) {
      smokePixels++;
    }
  }

  const avgBrightness = brightnessList.reduce((a, b) => a + b, 0) / brightnessList.length;
  const smokeRatio = smokePixels / totalPixels;

  return { smokeRatio, avgBrightness };
}

// Compares two frames to measure how much changed (motion/dissipation)
function measureFrameDiff(imgDataA, imgDataB) {
  const a = imgDataA.data, b = imgDataB.data;
  let diff = 0;
  const step = 8; // sample every 8th pixel for speed
  let count = 0;
  for (let i = 0; i < a.length; i += 4 * step) {
    diff += Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]);
    count++;
  }
  return diff / count / 255; // 0-1
}

// Measure smoke in upper vs lower half (for french inhale upward flow)
function analyzeVerticalSmoke(imageData) {
  const { data, width, height } = imageData;
  let topSmoke = 0, bottomSmoke = 0;
  let topTotal = 0, bottomTotal = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i+1], b = data[i+2];
      const brightness = (r + g + b) / 3 / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const isSmoke = brightness > 0.55 && saturation < 0.25;

      if (y < height / 2) { topTotal++; if (isSmoke) topSmoke++; }
      else { bottomTotal++; if (isSmoke) bottomSmoke++; }
    }
  }
  return {
    topRatio: topSmoke / topTotal,
    bottomRatio: bottomSmoke / bottomTotal,
  };
}

// Detect circular patterns (rings) by looking for ring-shaped smoke regions
function detectRings(imageData) {
  const { data, width, height } = imageData;

  // Build a smoke mask
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const brightness = (r + g + b) / 3 / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    mask[i / 4] = (brightness > 0.52 && saturation < 0.28) ? 1 : 0;
  }

  // Scan horizontal slices for ring-like patterns (smoke on edges, gap in middle)
  let ringLikeSlices = 0;
  const sliceHeight = Math.floor(height / 20);

  for (let y = sliceHeight; y < height - sliceHeight; y += sliceHeight) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push(mask[y * width + x]);
    }

    // Find smoke runs in this row
    let runs = [];
    let inRun = false, runStart = 0;
    for (let x = 0; x < row.length; x++) {
      if (row[x] && !inRun) { inRun = true; runStart = x; }
      else if (!row[x] && inRun) { inRun = false; runs.push({ start: runStart, end: x }); }
    }

    // A ring cross-section shows: smoke gap smoke pattern
    if (runs.length >= 2) {
      const totalWidth = width;
      const firstRun = runs[0];
      const lastRun = runs[runs.length - 1];
      const gapSize = lastRun.start - firstRun.end;
      const leftWidth = firstRun.end - firstRun.start;
      const rightWidth = lastRun.end - lastRun.start;

      // Ring-like if: reasonable gap, similar width edges, centered-ish
      if (gapSize > totalWidth * 0.08 && gapSize < totalWidth * 0.6 &&
          Math.abs(leftWidth - rightWidth) < totalWidth * 0.15) {
        ringLikeSlices++;
      }
    }
  }

  return ringLikeSlices;
}

// ── Main Analysis Function ────────────────────────────────────────────────────

export async function analyzeFramesLocally(frames, trickId) {
  if (!frames || frames.length === 0) {
    return fallback(trickId, "No frames captured.");
  }

  try {
    // Decode all frames
    const imageDataList = await Promise.all(frames.map(decodeBase64Frame));

    // Per-frame smoke metrics
    const smokeMetrics = imageDataList.map(analyzeSmokePixels);
    const smokeRatios = smokeMetrics.map(m => m.smokeRatio);
    const maxSmoke = Math.max(...smokeRatios);
    const avgSmoke = smokeRatios.reduce((a, b) => a + b, 0) / smokeRatios.length;

    // Motion between frames
    const diffs = [];
    for (let i = 1; i < imageDataList.length; i++) {
      diffs.push(measureFrameDiff(imageDataList[i - 1], imageDataList[i]));
    }
    const avgMotion = diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
    const maxMotion = diffs.length > 0 ? Math.max(...diffs) : 0;

    if (trickId === "ghost") {
      return analyzeGhost(smokeRatios, maxSmoke, avgSmoke, avgMotion, maxMotion, imageDataList);
    } else if (trickId === "orings") {
      return analyzeOrings(smokeRatios, maxSmoke, avgSmoke, imageDataList, diffs);
    } else if (trickId === "french") {
      return analyzeFrench(smokeRatios, maxSmoke, avgSmoke, avgMotion, imageDataList);
    }

    return fallback(trickId, "Unknown trick.");
  } catch (err) {
    return fallback(trickId, "Analysis error: " + err.message);
  }
}

function analyzeGhost(smokeRatios, maxSmoke, avgSmoke, avgMotion, maxMotion, imageDataList) {
  // Cloud size: how much smoke was visible at peak
  // maxSmoke 0-1, map to 0-3
  const cloudRaw = Math.min(maxSmoke * 18, 3); // needs ~17% smoke pixels for max
  const cloud = Math.round(Math.min(cloudRaw, 3));

  // Retention: smoke should appear THEN decrease (re-inhale)
  // Look for peak then drop pattern
  const peakIdx = smokeRatios.indexOf(maxSmoke);
  const afterPeak = smokeRatios.slice(peakIdx);
  const smokeDrop = afterPeak.length > 1
    ? (afterPeak[0] - afterPeak[afterPeak.length - 1]) / Math.max(afterPeak[0], 0.001)
    : 0;
  // Good ghost: smoke drops sharply after peak (re-inhale)
  const retentionRaw = smokeDrop > 0.4 ? 3 : smokeDrop > 0.2 ? 2 : smokeDrop > 0.05 ? 1 : 0;
  const retention = Math.round(Math.min(retentionRaw, 3));

  // Execution: combination of having smoke AND re-inhaling it
  // Good execution = high peak smoke + clear drop
  const executionRaw = (cloud >= 2 && retention >= 2) ? 4
    : (cloud >= 1 && retention >= 1) ? 2
    : cloud >= 1 ? 1 : 0;
  const execution = Math.min(executionRaw, 4);

  const total = cloud + retention + execution;
  // Max is 10, scale with harsh curve
  const score = Math.max(1.0, Math.min(10.0, parseFloat((total * 0.95 + 0.5).toFixed(1))));

  const summaries = {
    low: "Barely a puff. The ghost didn't even show up.",
    mid: "Some smoke was present but the re-inhale was unconvincing.",
    high: "Solid cloud with a clean re-inhale. Respectable.",
    vhigh: "Dense, spherical, re-inhaled perfectly. The ghost was real.",
  };
  const summary = score < 4 ? summaries.low : score < 6 ? summaries.mid : score < 8 ? summaries.high : summaries.vhigh;

  return { score, summary, cloud, retention, execution };
}

function analyzeOrings(smokeRatios, maxSmoke, avgSmoke, imageDataList, diffs) {
  // Detect ring patterns across frames
  let totalRingSlices = 0;
  let bestRingFrame = 0;

  imageDataList.forEach((frame, i) => {
    const rings = detectRings(frame);
    if (rings > bestRingFrame) bestRingFrame = rings;
    totalRingSlices += rings;
  });

  // Estimate ring count from ring-like slices
  // Each ring takes up roughly 3-5 slices if detected well
  const estimatedRings = Math.min(10, Math.floor(bestRingFrame / 3));

  // Roundness: how consistent were the ring patterns
  const roundness = Math.min(4, Math.round(bestRingFrame / 2));

  // Consistency: were rings seen across multiple frames
  const framesWithRings = imageDataList.filter((f, i) => detectRings(f) > 2).length;
  const consistency = Math.min(3, framesWithRings);

  // Distance: rings that last show up in later frames
  const lastHalfSmoke = smokeRatios.slice(Math.floor(smokeRatios.length / 2));
  const avgLateSmoke = lastHalfSmoke.reduce((a, b) => a + b, 0) / Math.max(lastHalfSmoke.length, 1);
  const distance = avgLateSmoke > 0.04 ? 3 : avgLateSmoke > 0.02 ? 2 : avgLateSmoke > 0.005 ? 1 : 0;

  const total = roundness + consistency + distance;
  const score = Math.max(1.0, Math.min(10.0, parseFloat(((total / 10) * 9 + 1).toFixed(1))));

  const ring_count = Math.max(0, estimatedRings);

  const summaries = {
    low: "No discernible rings detected. Those were just puffs.",
    mid: "Some ring-like shapes appeared but lacked definition.",
    high: "Clean rings with good shape. The geometry was real.",
    vhigh: "Multiple well-defined rings. Smoke geometry on point.",
  };
  const summary = score < 4 ? summaries.low : score < 6 ? summaries.mid : score < 8 ? summaries.high : summaries.vhigh;

  return { score, ring_count, summary, roundness, consistency, distance };
}

function analyzeFrench(smokeRatios, maxSmoke, avgSmoke, avgMotion, imageDataList) {
  // French inhale: smoke should appear in UPPER half (near nose) over time
  const verticalMetrics = imageDataList.map(analyzeVerticalSmoke);
  const topRatios = verticalMetrics.map(v => v.topRatio);
  const bottomRatios = verticalMetrics.map(v => v.bottomRatio);

  const avgTop = topRatios.reduce((a, b) => a + b, 0) / topRatios.length;
  const avgBottom = bottomRatios.reduce((a, b) => a + b, 0) / bottomRatios.length;

  // Flow: smoke should be present consistently across frames
  const framesWithSmoke = smokeRatios.filter(r => r > 0.02).length;
  const flow = Math.min(4, Math.round((framesWithSmoke / imageDataList.length) * 4));

  // Direction: more smoke in top half than bottom
  const topBias = avgTop / Math.max(avgBottom, 0.001);
  const direction = topBias > 1.3 ? 3 : topBias > 1.0 ? 2 : topBias > 0.7 ? 1 : 0;

  // Volume: overall smoke amount
  const volume = Math.min(3, Math.round(maxSmoke * 20));

  const total = flow + direction + volume;
  const score = Math.max(1.0, Math.min(10.0, parseFloat((total * 0.95 + 0.5).toFixed(1))));

  const summaries = {
    low: "No upward vapor movement detected. That was just exhaling.",
    mid: "Some vapor flow present but direction was unclear.",
    high: "Visible upward flow from mouth toward nose. Solid attempt.",
    vhigh: "Smooth continuous waterfall effect. The French approve.",
  };
  const summary = score < 4 ? summaries.low : score < 6 ? summaries.mid : score < 8 ? summaries.high : summaries.vhigh;

  return { score, summary, flow, direction, volume };
}

function fallback(trickId, msg) {
  return trickId === "orings"
    ? { score: 1.0, ring_count: 0, summary: msg, roundness: 0, consistency: 0, distance: 0 }
    : { score: 1.0, summary: msg, cloud: 0, retention: 0, execution: 0, flow: 0, direction: 0, volume: 0 };
}
