// Pulls World Cup 2026 results from football-data.org, normalizes to our schema,
// and writes results.json. Designed to run in GitHub Actions.
//
// Env: FOOTBALL_DATA_KEY (free tier — sign up at https://www.football-data.org/)
//
// If the API key is missing or the WC competition isn't yet active, the script
// exits cleanly without erroring (so the workflow doesn't fail in the lead-up).

const fs = require("fs");
const path = require("path");
const { teamByApi, STAGE_MAP } = require("./lib/teams");

const KEY = process.env.FOOTBALL_DATA_KEY;
const OUT = path.join(__dirname, "..", "results.json");

(async () => {
  if (!KEY) {
    console.log("No FOOTBALL_DATA_KEY set — skipping fetch. (Add it as a GitHub secret.)");
    return;
  }

  let json;
  try {
    const r = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
      headers: { "X-Auth-Token": KEY }
    });
    if (!r.ok) {
      console.log(`football-data responded ${r.status}. Skipping.`);
      return;
    }
    json = await r.json();
  } catch (e) {
    console.log("Fetch failed:", e.message);
    return;
  }

  const incoming = json.matches || [];
  console.log(`Fetched ${incoming.length} matches from football-data.`);

  const unmatched = new Set();
  const matches = [];
  const scheduled = [];
  let finished = 0;

  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const m of incoming) {
    const a = teamByApi(m.homeTeam?.name);
    const b = teamByApi(m.awayTeam?.name);
    if (!a) unmatched.add(m.homeTeam?.name);
    if (!b) unmatched.add(m.awayTeam?.name);
    if (!a || !b) continue;

    const round = STAGE_MAP[m.stage] || null;
    if (!round) {
      console.log("Unknown stage:", m.stage);
      continue;
    }

    if (m.status === "FINISHED") {
      finished++;
      const scoreA = m.score?.fullTime?.home ?? 0;
      const scoreB = m.score?.fullTime?.away ?? 0;
      let winner = null;
      if (round !== "group") {
        if (m.score?.winner === "HOME_TEAM") winner = "A";
        else if (m.score?.winner === "AWAY_TEAM") winner = "B";
      }
      matches.push({
        id: m.id, round,
        teamAId: a.id, teamBId: b.id,
        scoreA, scoreB, winner,
        utcDate: m.utcDate
      });
    } else if (m.status === "SCHEDULED" || m.status === "TIMED") {
      const kickoff = new Date(m.utcDate);
      if (kickoff <= sevenDaysOut) {
        scheduled.push({
          id: m.id, round,
          teamAId: a.id, teamBId: b.id,
          utcDate: m.utcDate
        });
      }
    }
  }

  console.log(`Mapped ${matches.length} of ${finished} finished matches. ${scheduled.length} upcoming (next 7 days).`);
  if (unmatched.size) console.log("Unmatched names (add to ALIAS in lib/teams.js):", [...unmatched]);

  const out = { fetchedAt: new Date().toISOString(), matches, scheduled };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log("Wrote", OUT);
})();
