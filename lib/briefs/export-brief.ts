import type { BriefRow } from "@/lib/db/schema/briefs";
import type {
  StoryboardScene,
  ShotlistGroup,
} from "@/lib/db/schema/brief-storyboards";

interface ExportBrief extends BriefRow {
  scenes?: StoryboardScene[];
  shotlist?: ShotlistGroup[];
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
}

function budgetLabel(v: string): string {
  const map: Record<string, string> = {
    under_1k: "Under $1,000",
    "1k_3k": "$1,000 – $3,000",
    "3k_5k": "$3,000 – $5,000",
    "5k_10k": "$5,000 – $10,000",
    "10k_plus": "$10,000+",
  };
  return map[v] ?? v;
}

function kindLabel(v: string): string {
  const map: Record<string, string> = {
    shoot: "Shoot",
    edit: "Edit",
    shoot_and_edit: "Shoot & Edit",
  };
  return map[v] ?? v;
}

const SHOT_LABELS: Record<string, string> = {
  wide: "Wide",
  medium: "Medium",
  close_up: "Close-up",
  detail: "Detail",
  aerial: "Aerial",
  pov: "POV",
};

const CAM_LABELS: Record<string, string> = {
  static: "Static",
  pan: "Pan",
  tilt: "Tilt",
  track: "Track",
  handheld: "Handheld",
  crane: "Crane",
  drone: "Drone",
};

// ── Markdown ───────────────────────────────────────────────────────────────

export function briefToMarkdown(b: ExportBrief): string {
  const lines: string[] = [];

  const title = b.project_title ?? `${b.brief_type === "lean" ? "Lean" : "Structured"} Brief`;
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`**Reference:** ${b.reference_number}`);
  lines.push(`**Business:** ${b.business_name}`);
  lines.push(`**Contact:** ${b.contact_name} (${b.contact_email})`);
  lines.push(`**Type:** ${b.brief_type === "lean" ? "Lean" : "Structured"}`);
  if (b.brief_kind) lines.push(`**Kind:** ${kindLabel(b.brief_kind)}`);
  lines.push(`**Delivery:** ${fmtDate(b.delivery_date_ms)}`);
  if (b.budget_range) lines.push(`**Budget:** ${budgetLabel(b.budget_range)}`);
  lines.push(`**Created:** ${fmtDate(b.created_at_ms)}`);
  lines.push("");

  lines.push("---");
  lines.push("");

  lines.push("## Description");
  lines.push("");
  lines.push(b.description);
  lines.push("");

  const sections: { label: string; value: string | null }[] = [
    { label: "Style References", value: b.style_references },
    { label: "Key Messages", value: b.key_messages },
    { label: "Target Audience", value: b.target_audience },
    { label: "Deliverables Breakdown", value: b.deliverables_breakdown },
    { label: "Location Details", value: b.location_details },
    { label: "Talent Notes", value: b.talent_notes },
    { label: "Additional Notes", value: b.additional_notes },
  ];

  for (const s of sections) {
    if (!s.value) continue;
    lines.push(`## ${s.label}`);
    lines.push("");
    lines.push(s.value);
    lines.push("");
  }

  if (b.scenes && b.scenes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Storyboard");
    lines.push("");

    const totalDuration = b.scenes.reduce((s, sc) => s + (sc.duration_seconds ?? 0), 0);
    lines.push(`${b.scenes.length} scenes · ~${totalDuration}s total`);
    lines.push("");

    for (const scene of b.scenes) {
      lines.push(`### Scene ${scene.number}`);
      lines.push("");
      lines.push(`**Shot:** ${SHOT_LABELS[scene.shot_type] ?? scene.shot_type} · **Camera:** ${CAM_LABELS[scene.camera_movement] ?? scene.camera_movement} · **Duration:** ${scene.duration_seconds}s`);
      lines.push("");
      lines.push(scene.description);
      if (scene.audio_notes) {
        lines.push("");
        lines.push(`*Audio: ${scene.audio_notes}*`);
      }
      if (scene.mood_note) {
        lines.push("");
        lines.push(`*${scene.mood_note}*`);
      }
      lines.push("");
    }
  }

  if (b.shotlist && b.shotlist.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Shotlist");
    lines.push("");

    const totalMinutes = b.shotlist.reduce((s, g) => s + (g.estimated_minutes ?? 0), 0);
    lines.push(`${b.shotlist.length} setup${b.shotlist.length !== 1 ? "s" : ""} · ~${totalMinutes} min total`);
    lines.push("");

    for (const group of b.shotlist) {
      lines.push(`### Setup ${group.group_number} — ${group.location}`);
      lines.push("");
      lines.push(group.setup_description);
      lines.push("");
      lines.push(`**Est. time:** ~${group.estimated_minutes} min`);
      if (group.equipment_notes) {
        lines.push(`**Equipment:** ${group.equipment_notes}`);
      }
      lines.push("");

      for (const s of group.scenes) {
        lines.push(`- **S${s.scene_number}** (${SHOT_LABELS[s.shot_type] ?? s.shot_type}) — ${s.description}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ── Branded HTML ───────────────────────────────────────────────────────────

export function briefToHtml(b: ExportBrief): string {
  const title = b.project_title ?? `${b.brief_type === "lean" ? "Lean" : "Structured"} Brief`;
  const escapedTitle = esc(title);

  let body = "";

  body += `<div class="meta-grid">`;
  body += metaCell("Reference", b.reference_number);
  body += metaCell("Business", b.business_name);
  body += metaCell("Contact", `${esc(b.contact_name)} (${esc(b.contact_email)})`);
  body += metaCell("Type", b.brief_type === "lean" ? "Lean" : "Structured");
  if (b.brief_kind) body += metaCell("Kind", kindLabel(b.brief_kind));
  body += metaCell("Delivery", fmtDate(b.delivery_date_ms));
  if (b.budget_range) body += metaCell("Budget", budgetLabel(b.budget_range));
  body += metaCell("Created", fmtDate(b.created_at_ms));
  body += `</div>`;

  body += sectionBlock("Description", b.description);

  const sections: { label: string; value: string | null }[] = [
    { label: "Style References", value: b.style_references },
    { label: "Key Messages", value: b.key_messages },
    { label: "Target Audience", value: b.target_audience },
    { label: "Deliverables Breakdown", value: b.deliverables_breakdown },
    { label: "Location Details", value: b.location_details },
    { label: "Talent Notes", value: b.talent_notes },
    { label: "Additional Notes", value: b.additional_notes },
  ];

  for (const s of sections) {
    if (!s.value) continue;
    body += sectionBlock(s.label, s.value);
  }

  if (b.scenes && b.scenes.length > 0) {
    const totalDuration = b.scenes.reduce((s, sc) => s + (sc.duration_seconds ?? 0), 0);
    body += `<div class="divider"></div>`;
    body += `<h2>Storyboard</h2>`;
    body += `<p class="summary">${b.scenes.length} scenes &middot; ~${totalDuration}s total</p>`;

    for (const scene of b.scenes) {
      body += `<div class="scene-card">`;
      body += `<div class="scene-header">`;
      body += `<span class="scene-number">${scene.number}</span>`;
      body += `<span class="pill">${SHOT_LABELS[scene.shot_type] ?? scene.shot_type}</span>`;
      body += `<span class="pill">${CAM_LABELS[scene.camera_movement] ?? scene.camera_movement}</span>`;
      body += `<span class="duration">${scene.duration_seconds}s</span>`;
      body += `</div>`;
      body += `<p class="scene-desc">${esc(scene.description)}</p>`;
      if (scene.audio_notes) {
        body += `<p class="scene-audio">Audio: ${esc(scene.audio_notes)}</p>`;
      }
      if (scene.mood_note) {
        body += `<p class="scene-mood">${esc(scene.mood_note)}</p>`;
      }
      body += `</div>`;
    }
  }

  if (b.shotlist && b.shotlist.length > 0) {
    const totalMinutes = b.shotlist.reduce((s, g) => s + (g.estimated_minutes ?? 0), 0);
    body += `<div class="divider"></div>`;
    body += `<h2>Shotlist</h2>`;
    body += `<p class="summary">${b.shotlist.length} setup${b.shotlist.length !== 1 ? "s" : ""} &middot; ~${totalMinutes} min total</p>`;

    for (const group of b.shotlist) {
      body += `<div class="setup-card">`;
      body += `<div class="setup-header">`;
      body += `<span class="scene-number">${group.group_number}</span>`;
      body += `<span class="setup-location">${esc(group.location)}</span>`;
      body += `<span class="duration">~${group.estimated_minutes} min</span>`;
      body += `</div>`;
      body += `<p class="scene-desc">${esc(group.setup_description)}</p>`;
      if (group.equipment_notes) {
        body += `<p class="scene-audio">Equipment: ${esc(group.equipment_notes)}</p>`;
      }
      body += `<div class="shot-list">`;
      for (const s of group.scenes) {
        body += `<div class="shot-row">`;
        body += `<span class="shot-num">S${s.scene_number}</span>`;
        body += `<span class="pill small">${SHOT_LABELS[s.shot_type] ?? s.shot_type}</span>`;
        body += `<span class="shot-desc">${esc(s.description)}</span>`;
        body += `</div>`;
      }
      body += `</div>`;
      body += `</div>`;
    }
  }

  const safeFilename = `SuperBad-Brief-${b.reference_number}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapedTitle} — SuperBad Brief</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Righteous&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --red: #B22848;
    --cream: #FDF5E6;
    --pink: #F4A0B0;
    --charcoal: #1A1A18;
    --n900: #1A1A18;
    --n800: #252320;
    --n700: #332F2A;
    --n600: #3D3D37;
    --n500: #807F73;
    --n300: #D4D2C2;
  }

  body {
    font-family: 'DM Sans', system-ui, sans-serif;
    background: var(--n900);
    color: var(--cream);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  .page {
    max-width: 820px;
    margin: 0 auto;
    padding: 48px 40px 80px;
  }

  /* ── Download bar ── */
  .download-bar {
    position: fixed;
    top: 0; left: 0; right: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 12px 32px;
    background: rgba(15, 15, 14, 0.92);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(253, 245, 230, 0.06);
    z-index: 100;
  }

  .download-bar button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 20px;
    border: none;
    border-radius: 6px;
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.18s;
  }

  .download-bar button:hover { opacity: 0.85; }

  .btn-primary {
    background: var(--red);
    color: var(--cream);
  }

  .download-bar .label {
    font-family: 'Righteous', system-ui, sans-serif;
    font-size: 11px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--n500);
  }

  /* ── Header ── */
  .cover {
    margin-top: 16px;
    margin-bottom: 48px;
    padding-bottom: 32px;
    border-bottom: 1px solid rgba(253, 245, 230, 0.08);
  }

  .cover .brand {
    font-family: 'Righteous', system-ui, sans-serif;
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--pink);
    margin-bottom: 16px;
  }

  .cover h1 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 36px;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.3px;
    color: var(--cream);
    margin-bottom: 8px;
  }

  .cover .ref {
    font-family: 'Righteous', system-ui, sans-serif;
    font-size: 12px;
    letter-spacing: 1.5px;
    color: var(--n500);
  }

  /* ── Meta grid ── */
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px 24px;
    background: var(--n800);
    border: 1px solid rgba(253, 245, 230, 0.06);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 32px;
  }

  .meta-cell .meta-label {
    font-family: 'Righteous', system-ui, sans-serif;
    font-size: 10px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--n500);
    margin-bottom: 4px;
  }

  .meta-cell .meta-value {
    font-size: 13px;
    color: var(--cream);
  }

  /* ── Sections ── */
  h2 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 22px;
    font-weight: 700;
    color: var(--cream);
    margin-bottom: 12px;
    letter-spacing: -0.2px;
  }

  .section {
    background: var(--n800);
    border: 1px solid rgba(253, 245, 230, 0.06);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 20px;
  }

  .section .section-label {
    font-family: 'Righteous', system-ui, sans-serif;
    font-size: 10px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--n500);
    margin-bottom: 8px;
  }

  .section .section-body {
    font-size: 14px;
    line-height: 1.65;
    color: var(--n300);
    white-space: pre-wrap;
  }

  .divider {
    border: none;
    border-top: 1px solid rgba(253, 245, 230, 0.08);
    margin: 40px 0 32px;
  }

  .summary {
    font-size: 13px;
    color: var(--n500);
    margin-bottom: 20px;
  }

  /* ── Scenes ── */
  .scene-card {
    background: var(--n800);
    border: 1px solid rgba(253, 245, 230, 0.06);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 12px;
  }

  .scene-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .scene-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(244, 160, 176, 0.12);
    color: var(--pink);
    font-family: 'Righteous', system-ui, sans-serif;
    font-size: 12px;
    flex-shrink: 0;
  }

  .pill {
    display: inline-flex;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(253, 245, 230, 0.05);
    font-family: 'Righteous', system-ui, sans-serif;
    font-size: 9px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--n500);
  }

  .pill.small { font-size: 8px; padding: 1px 6px; }

  .duration {
    font-family: 'Righteous', system-ui, sans-serif;
    font-size: 10px;
    color: var(--n600);
    letter-spacing: 0.5px;
  }

  .scene-desc {
    font-size: 14px;
    line-height: 1.6;
    color: var(--cream);
  }

  .scene-audio {
    font-size: 12px;
    font-style: italic;
    color: var(--n500);
    margin-top: 8px;
  }

  .scene-mood {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 12px;
    font-style: italic;
    color: var(--pink);
    margin-top: 4px;
  }

  /* ── Shotlist ── */
  .setup-card {
    background: var(--n800);
    border: 1px solid rgba(253, 245, 230, 0.06);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
  }

  .setup-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .setup-location {
    font-size: 15px;
    font-weight: 500;
    color: var(--cream);
    flex: 1;
  }

  .shot-list {
    margin-top: 12px;
  }

  .shot-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 6px;
    background: rgba(253, 245, 230, 0.02);
    margin-bottom: 6px;
  }

  .shot-num {
    font-family: 'Righteous', system-ui, sans-serif;
    font-size: 10px;
    color: var(--pink);
    letter-spacing: 0.5px;
    width: 28px;
    flex-shrink: 0;
  }

  .shot-desc {
    font-size: 12px;
    color: var(--n300);
  }

  /* ── Footer ── */
  .footer {
    margin-top: 56px;
    padding-top: 24px;
    border-top: 1px solid rgba(253, 245, 230, 0.06);
    text-align: center;
  }

  .footer .brand {
    font-family: 'Righteous', system-ui, sans-serif;
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--n600);
  }

  .footer .tagline {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 13px;
    font-style: italic;
    color: var(--n500);
    margin-top: 4px;
  }

  /* ── Print / PDF ── */
  @media print {
    .download-bar { display: none !important; }
    body { background: #fff; color: #1A1A18; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 24px 0; max-width: 100%; }
    .cover { border-bottom-color: #e0ddd4; }
    .cover .brand { color: var(--red); }
    .cover h1 { color: var(--charcoal); }
    .meta-grid { background: #f8f5ef; border-color: #e0ddd4; }
    .meta-cell .meta-value { color: var(--charcoal); }
    .section { background: #f8f5ef; border-color: #e0ddd4; }
    .section .section-body { color: #333; }
    .scene-card, .setup-card { background: #f8f5ef; border-color: #e0ddd4; }
    .scene-desc, .setup-location { color: var(--charcoal); }
    .shot-row { background: rgba(0,0,0,0.03); }
    .shot-desc { color: #333; }
    .divider { border-top-color: #e0ddd4; }
    .scene-number { background: rgba(178, 40, 72, 0.1); color: var(--red); }
    .shot-num { color: var(--red); }
    .footer { border-top-color: #e0ddd4; }
    .footer .brand { color: var(--n500); }
  }

  @page {
    size: A4;
    margin: 20mm 16mm;
  }
</style>
</head>
<body>
  <div class="download-bar">
    <span class="label">${esc(b.reference_number)}</span>
    <button class="btn-primary" onclick="window.print()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download PDF
    </button>
  </div>

  <div class="page">
    <div class="cover">
      <div class="brand">SuperBad</div>
      <h1>${escapedTitle}</h1>
      <div class="ref">${esc(b.reference_number)} &middot; ${esc(b.business_name)}</div>
    </div>

    ${body}

    <div class="footer">
      <div class="brand">SuperBad</div>
      <div class="tagline">performance marketing &amp; media</div>
    </div>
  </div>

  <script>
    document.title = "${safeFilename.replace(/"/g, '\\"')}";
  </script>
</body>
</html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function metaCell(label: string, value: string): string {
  return `<div class="meta-cell"><div class="meta-label">${esc(label)}</div><div class="meta-value">${esc(value)}</div></div>`;
}

function sectionBlock(label: string, value: string | null): string {
  if (!value) return "";
  return `<div class="section"><div class="section-label">${esc(label)}</div><div class="section-body">${esc(value)}</div></div>`;
}
