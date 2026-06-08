// Shared scoring logic. Mirror of computeLeaderboard() in index.html.
const { TEAMS } = require("./teams");

const TIER_MULT = {1:1, 2:2, 3:3, 4:4};
const SCORING = {
  group_win: 1, group_tie: 0.5, group_loss: 0,
  r32: 2, r16: 3, qf: 4, sf: 6, final: 8
};

const PLAYERS = [
  {name: "Teddy", color: "#e63946"},
  {name: "Rob",   color: "#4361ee"},
  {name: "Jim",   color: "#2dd4bf"},
  {name: "Stev",  color: "#f97316"},
  {name: "James", color: "#a855f7"},
  {name: "Nick",  color: "#06b6d4"},
  {name: "Joe",   color: "#facc15"},
  {name: "Max",   color: "#ec4899"}
];

const teamById = (id) => TEAMS.find(t => t.id == id);

function computeLeaderboard({ picks = {}, matches = [] } = {}) {
  const rows = PLAYERS.map(p => ({
    name: p.name, color: p.color,
    teams: [], pts: 0,
    breakdown: {group:0, r32:0, r16:0, qf:0, sf:0, final:0},
    alive: 0
  }));
  const byName = Object.fromEntries(rows.map(r => [r.name, r]));

  Object.entries(picks).forEach(([tid, pname]) => {
    const t = teamById(tid);
    if (!t || !byName[pname]) return;
    byName[pname].teams.push({...t, status: "active", earned: 0});
  });

  matches.forEach(m => {
    const a = teamById(m.teamAId), b = teamById(m.teamBId);
    if (!a || !b) return;
    let winnerId = null;
    if (m.winner === "A") winnerId = a.id;
    else if (m.winner === "B") winnerId = b.id;
    else if (m.scoreA > m.scoreB) winnerId = a.id;
    else if (m.scoreB > m.scoreA) winnerId = b.id;

    if (m.round === "group") {
      [a,b].forEach(t => {
        const pname = picks[t.id];
        if (!pname) return;
        const r = byName[pname];
        let pts = 0;
        if (winnerId === null) pts = SCORING.group_tie;
        else if (winnerId === t.id) pts = SCORING.group_win;
        else pts = SCORING.group_loss;
        const earned = pts * TIER_MULT[t.tier];
        r.pts += earned;
        r.breakdown.group += earned;
        const tt = r.teams.find(x => x.id == t.id);
        if (tt) tt.earned += earned;
      });
    } else {
      if (!winnerId) return;
      const w = teamById(winnerId);
      const pname = picks[w.id];
      if (pname) {
        const r = byName[pname];
        const base = SCORING[m.round] || 0;
        const earned = base * TIER_MULT[w.tier];
        r.pts += earned;
        r.breakdown[m.round] += earned;
        const tt = r.teams.find(x => x.id == w.id);
        if (tt) tt.earned += earned;
      }
      const loserId = (winnerId === a.id) ? b.id : a.id;
      const lp = picks[loserId];
      if (lp) {
        const lpRow = byName[lp];
        const lt = lpRow.teams.find(x => x.id == loserId);
        if (lt) lt.status = "out — " + m.round.toUpperCase();
      }
    }
  });

  rows.forEach(r => {
    r.alive = r.teams.filter(t => t.status === "active").length;
    r.teams.sort((x,y) => x.tier - y.tier || x.name.localeCompare(y.name));
  });
  rows.sort((a,b) => b.pts - a.pts);
  return rows;
}

module.exports = { PLAYERS, TIER_MULT, SCORING, computeLeaderboard };
