#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = "/Users/ryanjameson/Desktop/Lifehub/Code/active/Wargames";
const dataDir = path.join(repoRoot, "packages/content/data");
const imageCatalogPath = path.join(dataDir, "images.json");
const scenariosPath = path.join(dataDir, "scenarios.json");
const scenarioWorldPath = path.join(dataDir, "scenario_world_ns.json");
const publicImageDir = path.join(repoRoot, "apps/web/public/assets/images");
const outputDir = path.join(repoRoot, "output/image-review");
const outputAssetDir = path.join(outputDir, "assets");
const outputHtml = path.join(outputDir, "flashpoint-image-review.html");
const outputJson = path.join(outputDir, "flashpoint-image-review.json");
const outputReplacementJson = path.join(outputDir, "flashpoint-image-replacement-queue.json");
const outputTopPriorityBatchJsonl = path.join(outputDir, "flashpoint-image-replacement-top-priority.jsonl");

const imageCatalog = JSON.parse(fs.readFileSync(imageCatalogPath, "utf8"));
const scenarios = JSON.parse(fs.readFileSync(scenariosPath, "utf8"));
const scenarioWorld = JSON.parse(fs.readFileSync(scenarioWorldPath, "utf8"));

const catalogById = new Map(imageCatalog.map((image) => [image.id, image]));
const usageById = new Map();
const directPathUsages = [];

function addUsage(imageId, usage) {
  if (!usageById.has(imageId)) usageById.set(imageId, []);
  usageById.get(imageId).push(usage);
}

function walk(node, state = {}) {
  if (Array.isArray(node)) {
    node.forEach((child, index) => walk(child, { ...state, index }));
    return;
  }
  if (!node || typeof node !== "object") return;

  const nextState = { ...state };
  if (typeof node.id === "string") {
    if (!nextState.ids) nextState.ids = [];
    nextState.ids = [...nextState.ids, node.id];
  }

  if (Array.isArray(node.heroImageIds)) {
    node.heroImageIds.forEach((imageId, order) => {
      addUsage(imageId, {
        role: "hero",
        order,
        ids: nextState.ids || [],
        caption: node.caption || "",
        source: "scenarios.json",
      });
    });
  }

  if (Array.isArray(node.evidenceImageIds)) {
    node.evidenceImageIds.forEach((imageId, order) => {
      addUsage(imageId, {
        role: "support",
        order,
        ids: nextState.ids || [],
        caption: node.caption || "",
        source: "scenarios.json",
      });
    });
  }

  if (typeof node.path === "string" && node.path.startsWith("/assets/images/")) {
    directPathUsages.push({
      path: node.path,
      ids: nextState.ids || [],
      source: "scenario_world_ns.json",
    });
  }

  for (const child of Object.values(node)) walk(child, nextState);
}

walk(scenarios);
walk(scenarioWorld);

function imageFileInfo(image) {
  const relativeAssetPath = image.path.replace(/^\/assets\/images\//, "");
  const absolutePath = path.join(publicImageDir, relativeAssetPath);
  const exists = fs.existsSync(absolutePath);
  const reviewRelativePath = exists ? copyIntoReviewAssets(absolutePath, relativeAssetPath) : "";
  return {
    relativeAssetPath,
    absolutePath,
    exists,
    reviewRelativePath,
    extension: path.extname(relativeAssetPath).replace(".", "").toLowerCase(),
  };
}

function directPathInfo(assetPath) {
  const relativeAssetPath = assetPath.replace(/^\/assets\/images\//, "");
  const absolutePath = path.join(publicImageDir, relativeAssetPath);
  const exists = fs.existsSync(absolutePath);
  const reviewRelativePath = exists ? copyIntoReviewAssets(absolutePath, relativeAssetPath) : "";
  return {
    relativeAssetPath,
    absolutePath,
    exists,
    reviewRelativePath,
    extension: path.extname(relativeAssetPath).replace(".", "").toLowerCase(),
  };
}

function copyIntoReviewAssets(sourcePath, relativeAssetPath) {
  const destinationPath = path.join(outputAssetDir, relativeAssetPath);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  try {
    fs.rmSync(destinationPath, { force: true });
  } catch {}
  try {
    fs.linkSync(sourcePath, destinationPath);
  } catch {
    const symlinkTarget = path.relative(path.dirname(destinationPath), sourcePath);
    fs.symlinkSync(symlinkTarget, destinationPath);
  }
  return path.relative(outputDir, destinationPath);
}

function classifyImage(image, info, usages) {
  const isLegacySvg = info.extension === "svg";
  const isFallback = image.id.startsWith("img_");
  const isPhotoreal = info.extension === "png" || info.extension === "jpg" || info.extension === "jpeg";
  const active = usages.length > 0;

  let status = "catalog-only";
  if (active) status = "active";
  if (active && (isLegacySvg || isFallback)) status = "active-legacy";
  if (!active && (isLegacySvg || isFallback)) status = "unused-legacy";
  if (active && isPhotoreal && !isLegacySvg) status = "active-approved-candidate";

  return {
    active,
    isLegacySvg,
    isFallback,
    isPhotoreal,
    status,
  };
}

function uniqueBeatLabels(usages) {
  const seen = new Set();
  const labels = [];
  usages.forEach((usage) => {
    const ids = usage.ids || [];
    const scenarioId = ids[0] || "unknown_scenario";
    const beatId = ids.find((id) => id.startsWith("ns_")) || ids[ids.length - 1] || "unknown_beat";
    const label = `${scenarioId} -> ${beatId} [${usage.role} #${usage.order + 1}]`;
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  });
  return labels;
}

const reviewImages = imageCatalog
  .map((image) => {
    const info = imageFileInfo(image);
    const usages = usageById.get(image.id) || [];
    const classification = classifyImage(image, info, usages);
    return {
      ...image,
      ...info,
      ...classification,
      usages,
      usageCount: usages.length,
      beatLabels: uniqueBeatLabels(usages),
    };
  })
  .sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.status !== b.status) return a.status.localeCompare(b.status);
    return a.id.localeCompare(b.id);
  });

const directImageReview = directPathUsages.map((usage) => ({
  ...usage,
  ...directPathInfo(usage.path),
}));

const replacementPriority = (image) => {
  if (image.usageCount >= 2) return "high";
  if (image.kind === "artifact" || image.kind === "map") return "high";
  return "medium";
};

const replacementVisualDirection = (image) => {
  if (image.kind === "artifact") {
    return "briefing-surface artifact with documentary newsroom realism";
  }
  if (image.kind === "map") {
    return "operational map / overhead briefing graphic with restrained real-world detail";
  }
  return "wire-service photojournalism still with grounded geopolitical realism";
};

const replacementPrompt = (image) => {
  const beatRead = image.beatLabels.join("; ");
  const tags = Array.isArray(image.tags) ? image.tags.join(", ") : "";
  return [
    "Altira Flashpoint Taiwan scenario authoring image.",
    `Create a ${replacementVisualDirection(image)}.`,
    `Depict: ${image.alt}.`,
    `Narrative intent: ${image.caption}`,
    `Current beat usage: ${beatRead}.`,
    `Tags: ${tags}.`,
    "Avoid poster styling, game UI overlays, and synthetic concept-art composition.",
    "Prefer documentary framing, specific operational detail, and believable lighting."
  ].join(" ");
};

const replacementQueue = reviewImages
  .filter((image) => image.status === "active-legacy")
  .sort((a, b) => {
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    return a.id.localeCompare(b.id);
  })
  .map((image) => ({
    id: image.id,
    usageCount: image.usageCount,
    priority: replacementPriority(image),
    kind: image.kind,
    perspective: image.perspective,
    tags: image.tags,
    alt: image.alt,
    caption: image.caption,
    beatLabels: image.beatLabels,
    suggestedPrompt: replacementPrompt(image),
  }));

const topPriorityBatchJobs = replacementQueue
  .filter((image) => image.priority === "high")
  .slice(0, 3)
  .map((image) => ({
    id: image.id,
    out: `${image.id}.png`,
    n: 1,
    size: "1536x1024",
    quality: "high",
    output_format: "png",
    background: "opaque",
    prompt: image.suggestedPrompt,
  }));

const summary = {
  catalogCount: imageCatalog.length,
  activeReferencedCount: reviewImages.filter((image) => image.active).length,
  activeLegacyCount: reviewImages.filter((image) => image.status === "active-legacy").length,
  activeApprovedCandidateCount: reviewImages.filter((image) => image.status === "active-approved-candidate").length,
  catalogOnlyCount: reviewImages.filter((image) => !image.active).length,
  directPathCount: directImageReview.length,
  replacementQueueCount: replacementQueue.length,
};

const reviewPayload = {
  generatedAtEt: new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "America/New_York",
  }).format(new Date()),
  summary,
  images: reviewImages,
  directPathImages: directImageReview,
  replacementQueue,
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderUsageList(image) {
  if (!image.beatLabels.length) return "<p class=\"muted\">Not currently referenced by beat-authored hero/evidence fields.</p>";
  return `<ul>${image.beatLabels.map((label) => `<li>${escapeHtml(label)}</li>`).join("")}</ul>`;
}

function renderCard(image) {
  const badge = image.status.replaceAll("-", " ");
  const tags = Array.isArray(image.tags) ? image.tags.join(", ") : "";
  const imgBlock = image.exists
    ? `<img src="${escapeHtml(encodeURI(image.reviewRelativePath))}" alt="${escapeHtml(image.alt)}" loading="lazy">`
    : `<div class="missing">Missing file</div>`;
  return `
    <article class="card status-${escapeHtml(image.status)}">
      <div class="thumb">${imgBlock}</div>
      <div class="meta">
        <div class="row">
          <h3>${escapeHtml(image.id)}</h3>
          <span class="badge">${escapeHtml(badge)}</span>
        </div>
        <p><strong>Path:</strong> ${escapeHtml(image.relativeAssetPath)}</p>
        <p><strong>Kind:</strong> ${escapeHtml(image.kind)} | <strong>Ext:</strong> ${escapeHtml(image.extension || "unknown")} | <strong>Usage count:</strong> ${image.usageCount}</p>
        <p><strong>Alt:</strong> ${escapeHtml(image.alt || "")}</p>
        <p><strong>Caption:</strong> ${escapeHtml(image.caption || "")}</p>
        <p><strong>Tags:</strong> ${escapeHtml(tags)}</p>
        <div class="usage">
          <strong>Beat usage</strong>
          ${renderUsageList(image)}
        </div>
      </div>
    </article>
  `;
}

function renderDirectPathCard(image) {
  const imgBlock = image.exists
    ? `<img src="${escapeHtml(encodeURI(image.reviewRelativePath))}" alt="${escapeHtml(image.path)}" loading="lazy">`
    : `<div class="missing">Missing file</div>`;
  return `
    <article class="card direct-path">
      <div class="thumb">${imgBlock}</div>
      <div class="meta">
        <div class="row">
          <h3>${escapeHtml(path.basename(image.relativeAssetPath))}</h3>
          <span class="badge">direct path</span>
        </div>
        <p><strong>Path:</strong> ${escapeHtml(image.relativeAssetPath)}</p>
        <p><strong>Referenced in:</strong> ${escapeHtml((image.ids || []).join(" -> "))}</p>
      </div>
    </article>
  `;
}

function renderReplacementCard(image) {
  const tags = Array.isArray(image.tags) ? image.tags.join(", ") : "";
  return `
    <article class="card status-active-legacy">
      <div class="meta">
        <div class="row">
          <h3>${escapeHtml(image.id)}</h3>
          <span class="badge">${escapeHtml(image.priority)} priority</span>
        </div>
        <p><strong>Usage count:</strong> ${image.usageCount}</p>
        <p><strong>Kind:</strong> ${escapeHtml(image.kind)} | <strong>Perspective:</strong> ${escapeHtml(image.perspective || "unknown")}</p>
        <p><strong>Alt:</strong> ${escapeHtml(image.alt || "")}</p>
        <p><strong>Caption:</strong> ${escapeHtml(image.caption || "")}</p>
        <p><strong>Tags:</strong> ${escapeHtml(tags)}</p>
        <div class="usage">
          <strong>Beat usage</strong>
          ${renderUsageList(image)}
        </div>
        <div class="prompt-block">
          <strong>Suggested replacement prompt</strong>
          <p>${escapeHtml(image.suggestedPrompt)}</p>
        </div>
      </div>
    </article>
  `;
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Flashpoint Image Review</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      color-scheme: dark;
      --bg: #091018;
      --panel: #0f1822;
      --panel-2: #172331;
      --text: #e7edf5;
      --muted: #94a7bb;
      --line: #294154;
      --accent: #f3b53b;
      --good: #2d7d55;
      --warn: #925c1d;
      --bad: #8b3a3a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(180deg, #07111a 0%, #0b131c 100%);
      color: var(--text);
    }
    header, main {
      width: min(1600px, calc(100vw - 32px));
      margin: 0 auto;
    }
    header { padding: 28px 0 20px; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 30px; margin-bottom: 8px; }
    h2 { font-size: 20px; margin: 26px 0 16px; }
    p + p { margin-top: 8px; }
    .muted { color: var(--muted); }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 18px;
    }
    .summary-card {
      background: var(--panel);
      border: 1px solid var(--line);
      padding: 14px;
    }
    .summary-card strong {
      display: block;
      font-size: 22px;
      margin-top: 6px;
    }
    .section-copy {
      margin-bottom: 12px;
      color: var(--muted);
      max-width: 1100px;
      line-height: 1.5;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .card {
      display: grid;
      grid-template-columns: minmax(220px, 34%) 1fr;
      gap: 16px;
      background: var(--panel);
      border: 1px solid var(--line);
      padding: 14px;
      align-items: start;
    }
    .thumb {
      background: #060c13;
      border: 1px solid #1b2a39;
      min-height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .thumb img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #050b11;
    }
    .missing {
      color: #ffd0d0;
      font-weight: 600;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }
    .badge {
      display: inline-block;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 5px 8px;
      border: 1px solid var(--line);
      color: var(--muted);
      white-space: nowrap;
    }
    .meta p {
      font-size: 14px;
      line-height: 1.45;
      margin-bottom: 8px;
    }
    .usage {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #20303d;
    }
    .usage ul {
      margin: 8px 0 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.45;
    }
    .prompt-block {
      margin-top: 12px;
      padding: 12px;
      border: 1px solid #20303d;
      background: #0b131c;
    }
    .prompt-block p {
      margin-top: 8px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
    }
    .status-active-legacy { border-color: var(--bad); }
    .status-active-approved-candidate { border-color: var(--good); }
    .status-unused-legacy { border-color: var(--warn); }
    .status-catalog-only { border-color: #394a5a; }
    .note {
      background: rgba(243, 181, 59, 0.08);
      border: 1px solid rgba(243, 181, 59, 0.25);
      padding: 12px 14px;
      margin-top: 16px;
      color: #ecd9a3;
    }
    @media (max-width: 1000px) {
      .grid { grid-template-columns: 1fr; }
      .card { grid-template-columns: 1fr; }
      .thumb { min-height: 260px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Flashpoint Image Review</h1>
    <p class="muted">Generated ${escapeHtml(reviewPayload.generatedAtEt)}. This page is for pruning the active image library safely: it shows what is actually wired into the live beat data, plus what still sits in the catalog unused.</p>
    <div class="summary">
      <div class="summary-card">Catalog images<strong>${summary.catalogCount}</strong></div>
      <div class="summary-card">Active referenced<strong>${summary.activeReferencedCount}</strong></div>
      <div class="summary-card">Active legacy / review-first<strong>${summary.activeLegacyCount}</strong></div>
      <div class="summary-card">Active photoreal candidates<strong>${summary.activeApprovedCandidateCount}</strong></div>
      <div class="summary-card">Catalog only / unused<strong>${summary.catalogOnlyCount}</strong></div>
      <div class="summary-card">Direct path images<strong>${summary.directPathCount}</strong></div>
      <div class="summary-card">Replacement queue<strong>${summary.replacementQueueCount}</strong></div>
    </div>
    <div class="note">Recommended pruning order: first remove anything marked <strong>active legacy</strong> from scenario references, then review <strong>catalog only</strong> assets for deletion, then rerun this generator to confirm the active set is clean.</div>
  </header>
  <main>
    <h2>Active Legacy Replacement Queue</h2>
    <p class="section-copy">These are the currently active legacy scenario visuals still wired into live beat references. This queue is the highest-value image-authoring backlog because each item is both in use and still awaiting a stronger final.</p>
    <section class="grid">
      ${replacementQueue.map(renderReplacementCard).join("")}
    </section>

    <h2>Active Referenced Images</h2>
    <p class="section-copy">These are the catalog images currently referenced by beat-authored hero or support fields in the scenario data. If you dislike one of these, we should remove or replace the beat reference before deleting the underlying file.</p>
    <section class="grid">
      ${reviewImages.filter((image) => image.active).map(renderCard).join("")}
    </section>

    <h2>Catalog Images Not Currently Referenced</h2>
    <p class="section-copy">These images still live in the catalog, but the current beat-authoring data is not directly calling them. These are the safest deletion candidates after a quick sanity check.</p>
    <section class="grid">
      ${reviewImages.filter((image) => !image.active).map(renderCard).join("")}
    </section>

    <h2>Direct-Path Images Outside the Catalog</h2>
    <p class="section-copy">These are images referenced by direct asset path instead of catalog ID, currently coming from scenario world/context data. They should also be reviewed so the setup/config surfaces stay aligned with the approved library.</p>
    <section class="grid">
      ${directImageReview.map(renderDirectPathCard).join("")}
    </section>
  </main>
</body>
</html>`;

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(outputAssetDir, { recursive: true });
fs.writeFileSync(outputJson, JSON.stringify(reviewPayload, null, 2));
fs.writeFileSync(outputReplacementJson, JSON.stringify(replacementQueue, null, 2));
fs.writeFileSync(outputTopPriorityBatchJsonl, topPriorityBatchJobs.map((job) => JSON.stringify(job)).join("\n") + "\n");
fs.writeFileSync(outputHtml, html);

console.log(`Wrote review HTML: ${outputHtml}`);
console.log(`Wrote review JSON: ${outputJson}`);
console.log(`Wrote replacement queue JSON: ${outputReplacementJson}`);
console.log(`Wrote top-priority batch JSONL: ${outputTopPriorityBatchJsonl}`);
