// Snapshots current state into archive/YYYY-MM-DD.html — a read-only daily front page.
// Also updates archive/index.html (the list of all archive days).

const fs = require("fs");
const path = require("path");
const { TEAMS } = require("./lib/teams");
const { computeLeaderboard, PLAYERS } = require("./lib/scoring");

const ROOT = path.join(__dirname, "..");
const ARCH = path.join(ROOT, "archive");
if (!fs.existsSync(ARCH)) fs.mkdirSync(ARCH);

const PICKS = readJson("picks.json", { picks: {} });
const RESULTS = readJson("results.json", { matches: [] });
const RECAP = readJson("recap.json", { headline: "", sub: "" });

function readJson(rel, fallback) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return fallback; }
}

const today = new Date().toISOString().slice(0,10);
const niceDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const rows = computeLeaderboard({ picks: PICKS.picks, matches: RESULTS.matches });

// Only include matches that took place in the last 24h on the archive's front face.
const now = Date.now();
const cutoff = now - 24*60*60*1000;
const yesterdayMatches = (RESULTS.matches || []).filter(m => m.utcDate && new Date(m.utcDate).getTime() >= cutoff);

const teamById = (id) => TEAMS.find(t => t.id == id);
const ROUND_LABEL = { group: "Group Stage", r32: "Round of 32", r16: "Round of 16", qf: "Quarterfinal", sf: "Semifinal", final: "Final" };

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>The Group — ${niceDate}</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700;800&family=Playfair+Display:wght@900&display=swap" rel="stylesheet">
<style>
:root { --bg:#0b1020; --panel:#161d3d; --line:#2a335f; --ink:#f6f3e8; --ink-dim:#b9bfd6; --gold:#f5c84c; --red:#e63946; --green:#2dd4bf; }
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:'Inter',system-ui,sans-serif}
.container{max-width:1100px;margin:0 auto;padding:30px 24px}
.back{display:inline-block;color:var(--gold);text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:20px}
.eyebrow{font-family:'Bebas Neue',sans-serif;letter-spacing:4px;color:var(--gold);font-size:14px}
h1{font-family:'Playfair Display',serif;font-weight:900;font-size:clamp(28px,4.5vw,46px);margin:12px 0;line-height:1.05}
.sub{color:var(--ink-dim);max-width:60ch;line-height:1.55}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:30px}
@media(max-width:760px){.grid{grid-template-columns:1fr}}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px}
.panel h2{font-family:'Bebas Neue',sans-serif;letter-spacing:2px;font-size:18px;color:var(--gold);margin:0 0 14px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:8px 6px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06)}
th{color:var(--ink-dim);font-size:10px;text-transform:uppercase;letter-spacing:1.2px;font-weight:600}
.pts{font-family:'Bebas Neue',sans-serif;color:var(--gold);font-size:18px}
.match{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px}
.match .score{font-family:'Bebas Neue',sans-serif;color:var(--gold);font-size:20px}
.match .meta{font-size:10px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:1px}
.tier{display:inline-block;width:18px;height:18px;border-radius:3px;text-align:center;font-size:10px;line-height:18px;font-weight:700;color:#0b1020;margin-right:6px}
.t1{background:#f5c84c}.t2{background:#c0c0c0}.t3{background:#cd7f32;color:#fff}.t4{background:#6b7280;color:#fff}
footer{margin-top:40px;color:var(--ink-dim);font-size:11px;text-align:center}
</style>
</head>
<body>
<div class="container">
  <a href="./index.html" class="back">← Archive</a>
  <div class="eyebrow">FRONT PAGE — ${niceDate.toUpperCase()}</div>
  <h1>${escapeHtml(RECAP.headline || "The day's recap")}</h1>
  <p class="sub">${escapeHtml(RECAP.sub || "")}</p>

  <div class="grid">
    <div class="panel">
      <h2>STANDINGS AT END OF DAY</h2>
      <table>
        <thead><tr><th>#</th><th>Player</th><th>Pts</th><th>Alive</th></tr></thead>
        <tbody>
          ${rows.map((r,i) => `<tr><td>${i+1}</td><td>${escapeHtml(r.name)}</td><td class="pts">${r.pts.toFixed(1)}</td><td>${r.alive}/${r.teams.length}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div class="panel">
      <h2>MATCHES — LAST 24 HOURS</h2>
      ${yesterdayMatches.length === 0
        ? `<p style="color:var(--ink-dim);font-size:13px">No matches played.</p>`
        : yesterdayMatches.map(m => {
            const a = teamById(m.teamAId), b = teamById(m.teamBId);
            if (!a || !b) return "";
            return `<div class="match">
              <div><span class="tier t${a.tier}">${a.tier}</span><strong>${escapeHtml(a.name)}</strong></div>
              <div style="text-align:center"><div class="meta">${ROUND_LABEL[m.round] || m.round}</div><div class="score">${m.scoreA} – ${m.scoreB}</div></div>
              <div style="text-align:right"><strong>${escapeHtml(b.name)}</strong><span class="tier t${b.tier}" style="margin:0 0 0 6px">${b.tier}</span></div>
            </div>`;
          }).join("")
      }
    </div>
  </div>

  <footer>The Group — frozen snapshot of ${today}. <a href="../index.html" style="color:var(--gold)">Back to live page</a></footer>
</div>
</body>
</html>`;

fs.writeFileSync(path.join(ARCH, `${today}.html`), html);
console.log("Wrote archive/" + today + ".html");

// Rebuild archive/index.html with the list of all snapshots.
const days = fs.readdirSync(ARCH).filter(f => /^\d{4}-\d{2}-\d{2}\.html$/.test(f)).sort().reverse();
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Group — Archive</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;700&display=swap" rel="stylesheet">
<style>
body{margin:0;background:#0b1020;color:#f6f3e8;font-family:'Inter',system-ui,sans-serif}
.container{max-width:760px;margin:0 auto;padding:40px 24px}
h1{font-family:'Bebas Neue',sans-serif;letter-spacing:4px;color:#f5c84c;font-size:32px;margin:0 0 20px}
a{display:block;padding:14px 18px;background:#161d3d;border:1px solid #2a335f;border-radius:10px;color:#f6f3e8;text-decoration:none;margin-bottom:10px;font-weight:600}
a:hover{background:#1d2550}
.back{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#f5c84c;display:inline-block;margin-bottom:20px;background:none;padding:0;border:none}
</style>
</head>
<body>
<div class="container">
  <a class="back" href="../index.html">← Live page</a>
  <h1>ARCHIVE</h1>
  ${days.length === 0 ? "<p>No archived days yet.</p>" :
    days.map(f => {
      const day = f.replace(".html","");
      const nice = new Date(day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      return `<a href="./${f}">${nice}</a>`;
    }).join("")
  }
</div>
</body>
</html>`;
fs.writeFileSync(path.join(ARCH, "index.html"), indexHtml);
console.log("Wrote archive/index.html with " + days.length + " day(s).");

function escapeHtml(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
