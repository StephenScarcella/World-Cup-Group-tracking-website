// Generates recap.json — the daily front-page headline + sub.
// Compares "yesterday" leaderboard (before yesterday's matches) vs "today"
// leaderboard (after) to find the biggest mover, then writes editorial-tone
// copy: scenario-aware headline (new leader / dead heat / surge / quiet day)
// and a narrative sub that names the signature match behind the day's mover.
// Day-seeded phrasing variety keeps consecutive days from reading identically.

const fs = require("fs");
const path = require("path");
const { TEAMS } = require("./lib/teams");
const { computeLeaderboard, TIER_MULT, SCORING } = require("./lib/scoring");

const ROOT = path.join(__dirname, "..");
const PICKS = readJson("picks.json", { picks: {} });
const RESULTS = readJson("results.json", { matches: [] });
const picks = PICKS.picks || {};

function readJson(rel, fallback) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { console.log("Bad JSON in", rel, e.message); return fallback; }
}

const teamById = (id) => TEAMS.find(t => t.id == id);
const ownerOf = (id) => picks[id] || null;
const ROUND_LABEL = { r32: "Round of 32", r16: "Round of 16", qf: "quarterfinal", sf: "semifinal", final: "final" };

// ---- match windowing -------------------------------------------------------
const now = new Date();
const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const yesterdayDateStr = cutoff.toISOString().slice(0, 10);

const allMatches = RESULTS.matches || [];
const beforeYesterday = allMatches.filter(m => m.utcDate && new Date(m.utcDate) < cutoff);
const yesterdayMatches = allMatches.filter(m => m.utcDate && new Date(m.utcDate) >= cutoff && new Date(m.utcDate) < now);

const rowsBefore = computeLeaderboard({ picks, matches: beforeYesterday });
const rowsAfter  = computeLeaderboard({ picks, matches: allMatches });

const ptsBefore = Object.fromEntries(rowsBefore.map(r => [r.name, r.pts]));
const deltas = rowsAfter.map(r => ({ name: r.name, pts: r.pts, gained: +(r.pts - (ptsBefore[r.name] || 0)).toFixed(2) }));
deltas.sort((a, b) => b.gained - a.gained);

const leader = rowsAfter[0];
const second = rowsAfter[1];
const bigMover = deltas[0];
const oldLeader = rowsBefore[0];

// ---- helpers ---------------------------------------------------------------
function num(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }
function fmtPts(n) { return n.toFixed(1); }

// winner of a match (handles explicit winner flag, else score, else null=tie)
function winnerIdOf(m) {
  if (m.winner === "A") return m.teamAId;
  if (m.winner === "B") return m.teamBId;
  if (m.scoreA > m.scoreB) return m.teamAId;
  if (m.scoreB > m.scoreA) return m.teamBId;
  return null;
}

// points a given team earned in a single match (mirrors scoring.js)
function pointsFor(m, teamId) {
  const t = teamById(teamId);
  if (!t) return 0;
  const winnerId = winnerIdOf(m);
  if (m.round === "group") {
    const base = winnerId === null ? SCORING.group_tie : winnerId === teamId ? SCORING.group_win : SCORING.group_loss;
    return base * TIER_MULT[t.tier];
  }
  return winnerId === teamId ? (SCORING[m.round] || 0) * TIER_MULT[t.tier] : 0;
}

// the single biggest positive scoring match for an owner from yesterday's set
function signatureMatch(ownerName) {
  let best = null;
  yesterdayMatches.forEach(m => {
    [m.teamAId, m.teamBId].forEach(tid => {
      if (ownerOf(tid) !== ownerName) return;
      const pts = pointsFor(m, tid);
      if (pts <= 0) return;
      if (!best || pts > best.pts) best = { m, tid, pts };
    });
  });
  return best;
}

// human phrase for a signature match, oriented to the owner's team
function describeSignature(best) {
  if (!best) return null;
  const { m, tid } = best;
  const t = teamById(tid);
  const oppId = tid === m.teamAId ? m.teamBId : m.teamAId;
  const opp = teamById(oppId);
  const oppOwner = ownerOf(oppId);
  const oppPoss = opp ? (oppOwner ? `${oppOwner}'s ${opp.name}` : opp.name) : "their opponent";
  if (m.round !== "group") {
    return `${t.name} knocking out ${oppPoss} in the ${ROUND_LABEL[m.round] || m.round}`;
  }
  const myScore = tid === m.teamAId ? m.scoreA : m.scoreB;
  const opScore = tid === m.teamAId ? m.scoreB : m.scoreA;
  const margin = Math.abs(m.scoreA - m.scoreB);
  if (myScore === opScore) return `${t.name}'s ${myScore}–${opScore} draw with ${oppPoss}`;
  if (margin >= 4) return `${t.name}'s ${myScore}–${opScore} demolition of ${oppPoss}`;
  if (margin >= 3) return `${t.name}'s ${myScore}–${opScore} rout of ${oppPoss}`;
  return `${t.name}'s ${myScore}–${opScore} win over ${oppPoss}`;
}

// day-seeded picker so wording varies day to day but is stable within a day
function hashStr(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
const seed = hashStr(now.toISOString().slice(0, 10));
const pick = (arr) => arr[seed % arr.length];

// knockout eliminations from yesterday's matches
const eliminated = yesterdayMatches.filter(m => m.round !== "group").map(m => {
  const winnerId = winnerIdOf(m) || m.teamAId;
  const loserId = winnerId === m.teamAId ? m.teamBId : m.teamAId;
  const loser = teamById(loserId);
  return { team: loser ? loser.name : "?", owner: ownerOf(loserId), round: m.round };
}).filter(x => x.owner);

// ---- scenario detection ----------------------------------------------------
const top = leader ? leader.pts : 0;
const coLeaders = rowsAfter.filter(r => r.pts === top);
const gap = leader && second ? +(leader.pts - second.pts).toFixed(2) : 0;
const newLeader = !!(oldLeader && leader && oldLeader.name !== leader.name && yesterdayMatches.length);
const moverIsLeader = bigMover && leader && bigMover.name === leader.name;

// ---- headline + sub --------------------------------------------------------
let headline, sub;

if (allMatches.length === 0) {
  headline = "The Group is locked in. 48 teams, 8 friends, one trophy.";
  sub = "Draft's done. Once the group stage kicks off, scores update automatically — tier-weighted, ranked and recapped every day.";
} else if (yesterdayMatches.length === 0) {
  headline = pick([
    `Quiet day at the top — ${leader.name} stays put on ${fmtPts(top)}.`,
    `No movement: ${leader.name} holds the lead at ${fmtPts(top)}.`,
    `${leader.name} sits tight on ${fmtPts(top)} with no matches in the last 24 hours.`
  ]);
  sub = coLeaders.length > 1
    ? `${listNames(coLeaders.map(r => r.name))} remain locked together at the summit. Standings unchanged — the next slate of matches decides who blinks first.`
    : `${gap > 0 ? `${num(gap)} still separates ${leader.name} from ${second ? second.name : "the pack"}.` : "The chasers stay within touching distance."} Standings unchanged until the next kickoff.`;
} else {
  // --- headline ---
  if (coLeaders.length > 1) {
    headline = pick([
      `Dead heat at the summit: ${listNames(coLeaders.map(r => r.name))} locked on ${fmtPts(top)}.`,
      `It's a tie at the top — ${listNames(coLeaders.map(r => r.name))} share the lead at ${fmtPts(top)}.`,
      `${listNames(coLeaders.map(r => r.name))} can't be separated, both on ${fmtPts(top)}.`
    ]);
  } else if (newLeader) {
    headline = pick([
      `${leader.name} storms to the top at ${fmtPts(top)} — ${oldLeader.name} knocked off the perch.`,
      `New leader: ${leader.name} surges past ${oldLeader.name} to ${fmtPts(top)}.`,
      `${leader.name} seizes the lead at ${fmtPts(top)}, ${oldLeader.name} dethroned.`
    ]);
  } else if (bigMover && bigMover.gained > 0 && !moverIsLeader) {
    headline = pick([
      `${bigMover.name} erupts for +${num(bigMover.gained)} — but ${leader.name} holds the top at ${fmtPts(top)}.`,
      `${bigMover.name} surges +${num(bigMover.gained)}; ${leader.name} clings to ${fmtPts(top)}.`,
      `${leader.name} holds at ${fmtPts(top)} as ${bigMover.name} comes charging (+${num(bigMover.gained)}).`
    ]);
  } else if (moverIsLeader && bigMover.gained > 0) {
    headline = pick([
      `${leader.name} tightens the grip — +${num(bigMover.gained)} stretches the lead to ${fmtPts(top)}.`,
      `${leader.name} pulls clear at ${fmtPts(top)}, banking +${num(bigMover.gained)} on the day.`,
      `${leader.name} extends the lead to ${fmtPts(top)} with a +${num(bigMover.gained)} haul.`
    ]);
  } else {
    headline = `${leader.name} holds the lead at ${fmtPts(top)}.`;
  }

  // --- sub ---
  const parts = [];

  // 1) top of the table
  if (coLeaders.length > 1) {
    const third = rowsAfter[coLeaders.length];
    parts.push(`${listNames(coLeaders.map(r => r.name))} are deadlocked on ${fmtPts(top)}${third ? `, with ${third.name} lurking at ${fmtPts(third.pts)}` : ""}.`);
  } else {
    parts.push(`${leader.name} leads on ${fmtPts(top)}${second ? `, ${gap > 0 ? `${num(gap)} clear of ${second.name}` : `level with ${second.name}`}` : ""}.`);
  }

  // 2) the day's big mover + the match that did it
  if (bigMover && bigMover.gained > 0) {
    const sig = describeSignature(signatureMatch(bigMover.name));
    parts.push(`The day belonged to ${bigMover.name} (+${num(bigMover.gained)})${sig ? `, fueled by ${sig}` : ""}.`);
  }

  // 3) other notable climbers
  const others = deltas.filter(d => d.gained > 0 && d.name !== (bigMover && bigMover.name)).slice(0, 2);
  if (others.length) {
    parts.push(`${listNames(others.map(d => `${d.name} (+${num(d.gained)})`))} also climbed.`);
  }

  // 4) eliminations
  if (eliminated.length) {
    const elimList = eliminated.slice(0, 3).map(e => `${e.team} (${e.owner})`).join(", ");
    parts.push(`Out of the tournament: ${elimList}.`);
  }

  // 5) tightness / trailer flavor
  const within = rowsAfter.filter(r => top - r.pts <= 1).length;
  const last = rowsAfter[rowsAfter.length - 1];
  if (within >= 4) {
    parts.push(`${within} players now sit within a point of the lead.`);
  } else if (last && top - last.pts >= 3) {
    parts.push(`${last.name} (${fmtPts(last.pts)}) has ground to make up.`);
  }

  sub = parts.join(" ");
}

function listNames(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const recap = {
  generatedAt: now.toISOString(),
  date: now.toISOString().slice(0, 10),
  yesterday: yesterdayDateStr,
  headline, sub,
  leader: leader ? { name: leader.name, pts: +leader.pts.toFixed(2) } : null,
  bigMover,
  eliminated,
  matchCountYesterday: yesterdayMatches.length
};

fs.writeFileSync(path.join(ROOT, "recap.json"), JSON.stringify(recap, null, 2));
console.log("Wrote recap.json:", headline);
console.log("Sub:", sub);
