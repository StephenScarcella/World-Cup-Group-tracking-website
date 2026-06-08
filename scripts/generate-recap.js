// Generates recap.json — the daily front-page headline + sub.
// Compares "yesterday" leaderboard (before yesterday's matches) vs "today" leaderboard
// (after) to find biggest mover. Calls out big upsets and eliminations.

const fs = require("fs");
const path = require("path");
const { TEAMS } = require("./lib/teams");
const { computeLeaderboard } = require("./lib/scoring");

const ROOT = path.join(__dirname, "..");
const PICKS = readJson("picks.json", { picks: {} });
const RESULTS = readJson("results.json", { matches: [] });

function readJson(rel, fallback) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { console.log("Bad JSON in", rel, e.message); return fallback; }
}

const teamById = (id) => TEAMS.find(t => t.id == id);

// Pull match utcDate. Default to today's matches = within the last 24h UTC.
const now = new Date();
const cutoff = new Date(now.getTime() - 24*60*60*1000);
const yesterdayDateStr = cutoff.toISOString().slice(0,10);

const allMatches = RESULTS.matches || [];
const beforeYesterday = allMatches.filter(m => m.utcDate && new Date(m.utcDate) < cutoff);
const yesterdayMatches = allMatches.filter(m => m.utcDate && new Date(m.utcDate) >= cutoff && new Date(m.utcDate) < now);

const rowsBefore = computeLeaderboard({ picks: PICKS.picks, matches: beforeYesterday });
const rowsAfter  = computeLeaderboard({ picks: PICKS.picks, matches: allMatches });

const ptsBefore = Object.fromEntries(rowsBefore.map(r => [r.name, r.pts]));
const deltas = rowsAfter.map(r => ({ name: r.name, pts: r.pts, gained: +(r.pts - (ptsBefore[r.name] || 0)).toFixed(2) }));
deltas.sort((a,b) => b.gained - a.gained);

const leader = rowsAfter[0];
const bigMover = deltas[0];

// Knockout eliminations from yesterday's matches
const knockouts = yesterdayMatches.filter(m => m.round !== "group");
const eliminated = knockouts.map(m => {
  const a = teamById(m.teamAId), b = teamById(m.teamBId);
  const winnerId = m.winner === "A" ? m.teamAId :
                   m.winner === "B" ? m.teamBId :
                   m.scoreA > m.scoreB ? m.teamAId : m.teamBId;
  const loser = winnerId === m.teamAId ? b : a;
  return { team: loser.name, owner: PICKS.picks[loser.id] || null, round: m.round };
}).filter(x => x.owner);

let headline, sub;
if (allMatches.length === 0) {
  headline = `The Group is locking in. 48 teams. 8 friends. One trophy.`;
  sub = `Draft picks roll in as they're recorded. Once Group A kicks off, scores update every 30 minutes.`;
} else if (yesterdayMatches.length === 0) {
  headline = `${leader.name} holds the top at ${leader.pts.toFixed(1)}.`;
  sub = `No matches in the last 24 hours. Standings unchanged.`;
} else {
  const parts = [];
  parts.push(`${leader.name} leads with ${leader.pts.toFixed(1)}`);
  if (bigMover && bigMover.gained > 0 && bigMover.name !== leader.name) {
    parts.push(`${bigMover.name} surged +${bigMover.gained}`);
  } else if (bigMover && bigMover.gained > 0) {
    parts.push(`extending the gap by +${bigMover.gained}`);
  }
  headline = parts.join(" — ") + ".";

  const subBits = [];
  if (yesterdayMatches.length) subBits.push(`${yesterdayMatches.length} match${yesterdayMatches.length===1?"":"es"} played`);
  if (eliminated.length) {
    const elimList = eliminated.slice(0,3).map(e => `${e.team} (${e.owner})`).join(", ");
    subBits.push(`Out: ${elimList}`);
  }
  sub = subBits.join(" · ");
}

const recap = {
  generatedAt: now.toISOString(),
  date: now.toISOString().slice(0,10),
  yesterday: yesterdayDateStr,
  headline, sub,
  leader: leader ? { name: leader.name, pts: +leader.pts.toFixed(2) } : null,
  bigMover,
  eliminated,
  matchCountYesterday: yesterdayMatches.length
};

fs.writeFileSync(path.join(ROOT, "recap.json"), JSON.stringify(recap, null, 2));
console.log("Wrote recap.json:", headline);
