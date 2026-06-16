# CLAUDE.md — WC Group Tracker (session handoff)

> Read this at the start of every new session. It is the ground truth for the current state of this project as of **2026-06-16**.

---

## What this is

Static single-page site for an 8-friend World Cup 2026 fantasy league. Snake draft, 48 teams across 4 tiers. Tier-multiplier scoring. Auto-updates scores from football-data.org via GitHub Actions. Hosted on Netlify. Archived snapshots of each matchday.

**Players (snake draft R1 order):** Teddy, Rob, Jim, Stev, James, Nick, Joe, Max  
**Repo:** `github.com/StephenScarcella/World-Cup-Group-tracking-website`  
**Prod branch:** `main` (Netlify auto-deploys commits to `main`, subject to `netlify-ignore.sh`)

---

## File map

```
index.html              ← Entire front end (HTML + CSS + JS, ~1400 lines)
picks.json              ← Locked draft (committed once after draft)
results.json            ← Match results — written by score-bot, read from GitHub raw
recap.json              ← Daily headline — written by archive-bot
chirps.json             ← Fun trash-talk / commentary lines
outlook.json            ← Season outlook text per player
archive/
  index.html            ← Archive index (links to each day)
  YYYY-MM-DD.html       ← Frozen daily snapshots
scripts/
  fetch-scores.js       ← GitHub Action script: pulls football-data.org → results.json
  generate-recap.js     ← GitHub Action script: builds recap.json nightly
  generate-archive.js   ← GitHub Action script: writes daily archive snapshot
  lib/
    teams.js            ← 48 teams, tier info, API name aliases (ALIAS map)
    scoring.js          ← Shared scoring logic
.github/workflows/
  fetch-scores.yml      ← Cron */10 * * * *: fetch scores → commit results.json
  daily-archive.yml     ← Cron 5 6 * * * (06:05 UTC ≈ 02:05 ET): recap + archive
netlify.toml            ← build.ignore = "bash netlify-ignore.sh"
netlify-ignore.sh       ← Skips Netlify deploy when ONLY results.json changed
DEPLOY.md               ← Original setup walkthrough (partially stale)
PROJECT_NOTES.md        ← Original pre-draft notes (partially stale)
CLAUDE.md               ← This file
```

---

## Score data flow (current architecture)

The site **reads `results.json` directly from GitHub raw**, not from the Netlify deployment. This decouples score freshness from Netlify deploy cost.

```
football-data.org API
        ↓  (every ~10 min via GitHub Actions cron)
scripts/fetch-scores.js
        ↓  (commits if changed)
results.json  in main branch
        ↓
https://raw.githubusercontent.com/StephenScarcella/World-Cup-Group-tracking-website/main/results.json
        ↓  (browser fetches on load + every 60 s)
index.html (in browser)
```

**Netlify is only re-deployed when `index.html`, `picks.json`, or other non-`results.json` files change.** The `netlify-ignore.sh` script exits 0 (skip) when only `results.json` was touched.

The GitHub Actions cron `*/10 * * * *` is **throttled by GitHub** under load — in practice it fires 3-8x per day, not 144x. This is expected. GitHub's scheduler is best-effort, not guaranteed.

### results.json shape

```json
{
  "fetchedAt": "ISO timestamp",
  "matches": [
    {
      "id": 123,
      "round": "group",
      "teamAId": 1,
      "teamBId": 2,
      "scoreA": 2,
      "scoreB": 1,
      "winner": "A",
      "utcDate": "2026-06-11T16:00:00Z"
    }
  ],
  "live": [
    {
      "id": 456,
      "round": "group",
      "teamAId": 3,
      "teamBId": 4,
      "scoreA": 0,
      "scoreB": 0,
      "status": "IN_PLAY",
      "minute": null,
      "utcDate": "2026-06-16T19:00:00Z"
    }
  ],
  "scheduled": [
    {
      "id": 789,
      "round": "group",
      "teamAId": 5,
      "teamBId": 6,
      "utcDate": "2026-06-16T22:00:00Z"
    }
  ]
}
```

- `matches` = FINISHED
- `live` = IN_PLAY or PAUSED (in-progress right now)
- `scheduled` = TIMED/SCHEDULED (not yet started)

---

## Scoring rules

| Round | Win | Tie | Loss |
|-------|-----|-----|------|
| Group (per match) | 1 pt | 0.5 pt | 0 pt |
| R32 | 2 pts | — | — |
| R16 | 3 pts | — | — |
| QF | 4 pts | — | — |
| SF | 6 pts | — | — |
| Final | 8 pts | — | — |

Multiply by tier: T1=1x, T2=2x, T3=3x, T4=4x. Knockout points go only to the **winning** team's owner; losing team owner gets 0 for that round and the team is marked eliminated.

---

## Front-end structure (index.html)

### Hero (top of page, id="live")

Command-center layout:
- **`hero-top`** — masthead + inline stats bar (Leader, Matches, Picks)
- **`recap-bar`** — gold-border editorial headline from `recap.json`
- **`command-grid`** — two columns: `now-panel` (NOW PLAYING / NEXT UP) + `race-panel` (THE RACE mini-leaderboard)
- **`pulse-strip`** (`id="moversBox"`) — "On the rise / Closest race / At the top" engagement cards
- **`games-watch`** (`id="gamesWatchBox"`) — Games to watch section

### Draft board

Collapsed by default inside a `<details class="draft-collapsible">` element. The summary says "Tournament's underway · all 48 picks locked June 9 — open to revisit." Users click to expand.

### Leaderboard (`id="leaderBody"`)

**Hybrid columns** — no more blank future-round cells:
- `#`, `Player`, `Pts`, `Group` (group-stage pts) — always shown
- `KO` column — **only appears** when `STATE.matches.some(m => m.round !== "group")`
- `T1`, `T2`, `T3`, `T4` — tier-specific earned points
- `Played` — number of matches involving that player's teams
- `Alive` — teams still in tournament

### Key JS functions

| Function | Purpose |
|----------|---------|
| `computeLeaderboard(matchSet)` | Parameterized — pass `STATE.matches` or a filtered subset for momentum delta |
| `computeMomentum(rows)` | Compares current vs. pre-last-30hr standings for momentum arrows |
| `renderLeaderboardFull(rows)` | Renders full leaderboard table with hybrid columns |
| `renderLeaderboardMini()` | Mini table in "THE RACE" panel with ▲ arrows |
| `renderNowPanel()` | Shows live matches or next scheduled kickoffs |
| `renderPulseStrip(rows)` | "On the rise / Closest race / At the top" cards |
| `flagEmoji(teamName)` | Returns flag emoji; uses `FLAG_SPECIAL` for England/Scotland subdivision flags |
| `liveMinute(m)` | Estimates current match minute from kickoff UTC when API doesn't return `minute` |
| `loadRemote()` | Fetches `results.json` from GitHub raw (fallback: `./results.json`) |

### Auto-refresh

```javascript
loadState();
renderAll();
loadRemote().then(() => { renderAll(); applyRecap(); renderOutlook(); });
setInterval(() => { loadRemote().then(() => { renderAll(); applyRecap(); }); }, 60000); // 60s full refresh
setInterval(renderNowPanel, 30000);  // 30s clock tick for live matches
```

---

## GitHub Actions

### fetch-scores.yml
- **Cron:** `*/10 * * * *`
- **Node:** 24
- **Env:** `FOOTBALL_DATA_KEY` (GitHub secret — Stephen must have this set in repo Settings → Secrets)
- **Output:** commits `results.json` if anything changed
- football-data.org free tier: statuses are `IN_PLAY`, `PAUSED`, `FINISHED`, `SCHEDULED`, `TIMED`; the `minute` field is often `null` on the free tier — the site estimates it from kickoff UTC

### daily-archive.yml
- **Cron:** `5 6 * * *` (06:05 UTC ≈ 02:05 ET)
- **Node:** 24
- Runs `generate-recap.js` then `generate-archive.js`
- Commits `archive/` and `recap.json`

---

## Known API quirks and aliases

If football-data.org returns a team name that doesn't match our list, the match is **silently skipped** (no commit, no error). Always check `scripts/lib/teams.js` `ALIAS` map when a team's results don't appear.

Current aliases include:
- `"cape verde islands"` → `"Cape Verde"` (critical — this was the June 15 data-gap bug)
- `"côte d'ivoire"` / `"cote d'ivoire"` / `"ivory coast"` → `"Ivory Coast"`
- `"korea republic"` / `"republic of korea"` → `"South Korea"`
- `"türkiye"` / `"turkiye"` → `"Turkey"`
- `"dr congo"` / `"congo dr"` / `"democratic republic of the congo"` → `"DR Congo"`
- `"usa"` / `"united states of america"` → `"United States"`
- `"czech republic"` → `"Czechia"`
- `"cabo verde"` → `"Cape Verde"`

**To add a new alias:** edit `scripts/lib/teams.js`, add to `ALIAS`, commit, push. Next fetch picks it up.

---

## Netlify cost management

- **Problem:** Every commit to `main` triggers a Netlify rebuild (300 min/mo free tier)
- **Solution:** `netlify-ignore.sh` exits 0 (cancel deploy) when only `results.json` changed
- **Result:** Score-only commits = no Netlify build. Only real source changes (index.html, picks.json, etc.) trigger deploys
- `results.json` is read from **GitHub raw** in the browser, so score changes are visible without any Netlify deploy

**Netlify env variables:** The `FOOTBALL_DATA_KEY` lives as a **GitHub secret** (repo Settings → Secrets → Actions), NOT as a Netlify env var. Netlify doesn't run any build commands, so it doesn't need the key.

---

## Current tournament state (as of 2026-06-16)

- Group stage underway, matches started June 11
- 16 matches scored through June 15
- archive/ has daily snapshots from June 8 through June 15
- All 48 draft picks locked and committed in `picks.json`
- Team name alias for "Cape Verde Islands" was fixed June 16 (was causing Monday's 4 games to be dropped)

---

## Common tasks

### Force a score fetch right now
GitHub repo → Actions → "Fetch WC Scores" → "Run workflow" → Run workflow

### Add a team-name alias (when a team's scores aren't showing)
1. Check GitHub Actions logs for the fetch-scores run — it will print unmatched names
2. Edit `scripts/lib/teams.js`, add `"api spelling": "Our Name"` to `ALIAS`
3. Commit + push

### Fix results.json manually
Edit `results.json` directly in the repo and push. The next real API fetch will overwrite, so only useful for temporary corrections.

### Trigger a Netlify deploy (when source changes aren't deploying)
Netlify dashboard → Site → Deploys → "Trigger deploy" → "Deploy site". This runs without `netlify-ignore.sh` logic.

### Verify Netlify is connected
Netlify dashboard → Site configuration → Build & deploy → Continuous deployment → Production branch = `main`, Auto-publish = ON, repo = correct.

### Bump the cron frequency
Edit `fetch-scores.yml` cron line. Note: GitHub throttles heavily. `*/10` is the current setting; going tighter than `*/5` provides no real benefit.

---

## Things to watch out for

1. **GitHub Actions cron is best-effort.** During busy periods it may skip runs or fire late. The site can always be manually triggered.

2. **The `minute` field from football-data.org free tier is often `null`.** The site estimates elapsed time from `utcDate` using `liveMinute()`, accounting for halftime.

3. **Netlify GitHub connection** — if real source deploys aren't firing, check the connection in Netlify dashboard. The repo may need to be re-authorized.

4. **Knockout rounds:** The leaderboard `KO` column appears automatically once any match with `round !== "group"` exists in `STATE.matches`. No code change needed.

5. **Daily archive cron runs at 06:05 UTC.** If late-night matches (e.g. midnight ET) aren't reflected, the archive from that day may need a manual re-run.
