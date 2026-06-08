# Project Notes — World Cup 2026 Fantasy Site

> Handoff doc. Start a new chat in this project and Claude should read this first to get instant context. Includes architecture, current state, pre-draft checklist, risks, and the "I need to tweak this" cheat sheet.

---

## What this is

A static single-page website for an 8-friend World Cup 2026 fantasy league. Snake draft over 6 rounds = 48 teams across 4 tiers. Tier multiplier × round result = points. Auto-updates from a free football API. Magazine-style cover page with daily recap. Archived snapshots of each day's leaderboard.

**Players (snake draft, R1 order):** Teddy, Rob, Jim, Stev, James, Nick, Joe, Max
**Admin:** Stephen (= Stev? — see "things to confirm")

---

## Current state

- ✅ Site code complete: `index.html` + scoring engine + admin console
- ✅ GitHub Actions written: fetch-scores (every 30 min), daily-archive (~2am ET)
- ✅ Pushed to GitHub: `github.com/StephenScarcella/World-Cup-2026` (or similar name — Stephen, paste exact URL here)
- ✅ Public repo (unlimited free Actions minutes)
- ✅ API key added as `FOOTBALL_DATA_KEY` secret on GitHub
- ⏳ Workflow write permissions — needs setting (Settings → Actions → General → Read and write)
- ⏳ Netlify deployment — needs first connect (Add new site → Import from GitHub)
- ⏳ Manual test fetch via Actions tab — confirm green check
- ⏳ Draft picks entry — pending draft completion

---

## Architecture (1-minute version)

```
index.html         ← The whole site. Renders leaderboard, rosters, draft board, etc.
picks.json         ← Locked draft. Source of truth for who owns which team.
results.json       ← Match results. Auto-written by GitHub Action every 30 min.
recap.json         ← Today's headline + sub. Auto-written nightly.
archive/
  index.html       ← List of all archived days
  YYYY-MM-DD.html  ← Frozen snapshot of each day (front page from that day)
.github/workflows/
  fetch-scores.yml ← Cron every 30 min: pull from football-data.org → commit results.json
  daily-archive.yml← Cron 06:05 UTC: regenerate recap + snapshot day → commit
scripts/
  fetch-scores.js  ← Pulls + normalizes match data
  generate-recap.js← Builds the daily headline
  generate-archive.js ← Writes the snapshot HTML
  lib/
    teams.js       ← 48 teams + tier + API name aliases
    scoring.js     ← Shared scoring logic (mirror of what's in index.html)
DEPLOY.md          ← Setup + troubleshooting reference
PROJECT_NOTES.md   ← This file
```

The site loads `picks.json`/`results.json`/`recap.json` on every page load. Whatever's committed to the repo = what all 8 visitors see.

---

## Scoring rules (baked in)

| Round | Win | Tie | Loss |
|---|---|---|---|
| Group Stage (per match) | 1 pt | 0.5 pt | 0 pt |
| Round of 32 | 2 pts | — | — |
| Round of 16 | 3 pts | — | — |
| Quarterfinal | 4 pts | — | — |
| Semifinal | 6 pts | — | — |
| Final | 8 pts | — | — |

All multiplied by tier: T1 = 1x, T2 = 2x, T3 = 3x, T4 = 4x.
Knockout points go to the *winning* team's owner only. Losing team's owner gets 0 for that round + team marked eliminated.

---

## Pre-draft checklist (do these before entering any picks)

### 1. Deployment health
- [ ] Open the Netlify URL in a fresh browser tab → site loads, no errors
- [ ] Hard refresh (Ctrl+Shift+R) → still loads
- [ ] Open on phone → mobile layout looks reasonable
- [ ] Click each nav link (Leaderboard, Rosters, Draft, Matches, Groups, Admin, Archive) → smooth scroll works, sections appear

### 2. GitHub Action sanity
- [ ] Go to repo → **Actions** tab → "Fetch WC Scores" workflow listed
- [ ] Click into it → **Run workflow** dropdown → **Run workflow** button → wait ~1 min → green check
- [ ] Open `results.json` in the repo — should show `fetchedAt` updated and (probably) empty matches array since WC hasn't started

### 3. Admin save behavior (CRITICAL — see "Risks" below)
- [ ] Go to live site → Admin → Draft Picks → record 1 test pick (anyone, any team)
- [ ] Refresh page → pick should still be there (localStorage)
- [ ] Open same URL on phone → pick is **NOT** there (localStorage is per-device)
- [ ] On laptop: Admin → Export/Import → Download picks.json → confirm file downloads with the test pick inside
- [ ] Admin → Reset Everything → confirm cleared
- [ ] Refresh → empty again

### 4. End-to-end scoring sim
- [ ] Use bulk picks paste to load all 48 teams in snake order (test names)
- [ ] Admin → Match Results → enter 3 fake group results
- [ ] Leaderboard updates with correct points (cross-check by hand for one player)
- [ ] Reset Everything before going live

---

## RISKS — read carefully before draft

### Risk 1: Picks live in localStorage, not the cloud
**What this means:** when Stephen records picks in Admin during the draft, they save to *his browser's* localStorage only. If he clears the browser, switches devices, or his localStorage expires, **all picks vanish**.

**Mitigation (do this religiously):**
- After EVERY round of picks (or every 5–10 picks), click **Admin → Export/Import → Download picks.json**.
- Save those files somewhere safe (Downloads folder, Dropbox, email to self).
- Pick a number — e.g. after every round, commit the latest `picks.json` to the GitHub repo (drag-drop replace in the web UI, or via GitHub Desktop).
- Worst case if browser dies mid-draft: drop the last `picks.json` back in via Import From Box.

**Better fix (post-draft tweak):** add a "save to repo" button that uses the GitHub API to commit picks.json directly. Worth doing after draft if you want to skip manual exports going forward.

### Risk 2: localStorage in incognito = nothing saves
Don't use incognito/private mode for the admin work. Use a normal Chrome window.

### Risk 3: Team-name mismatches from the API
football-data.org might call teams differently than our list (e.g. "Korea Republic" vs "South Korea"). Common ones are already aliased in `scripts/lib/teams.js`, but new variants surface only once matches start.

**Mitigation:** check the first Actions run after Group A starts. The log prints `Unmatched names (add to ALIAS in lib/teams.js): [...]`. Edit `scripts/lib/teams.js`, add the alias, commit. Next fetch picks up the fix.

### Risk 4: Group assignments aren't entered yet
The Groups section will show "No teams assigned" until you assign each team to a group letter (A–L) via Admin → Group Assignments. Do this after the FIFA draw (which has presumably happened by now). Without this, the Group Standings table is empty but everything else works fine.

### Risk 5: Workflow can't push commits
If you forgot to enable "Read and write permissions" (Settings → Actions → General), the fetch-scores Action will fail at the push step. Symptoms: Action shows red X, last step "Commit if changed" errors with "Permission denied".

**Mitigation:** verify this flag is on before the WC starts.

### Risk 6: Score-bot loop / Netlify build spam
Every score fetch that commits = a Netlify rebuild. Netlify free tier is 300 build minutes/mo. A 30-second rebuild × 48 fetches/day × 30 days ≈ 12 hours = 720 min — over the cap.

**Mitigation:** Netlify usually only rebuilds on file changes, not every fetch. Most fetches will be "No score changes" and skip the commit, so this is unlikely to be a problem. But if you see build-minute warnings, change the cron in `fetch-scores.yml` from `*/30` to `0,30 * * * *` during off-days or `0 */2 * * *` (every 2 hours) when no matches are scheduled.

---

## Things to confirm / decide

- [ ] Is "Stev" = Stephen, or is Stephen a 9th person + admin only? (Player list assumes 8 including Stephen as Stev.)
- [ ] Confirm draft order R1: Teddy → Rob → Jim → Stev → James → Nick → Joe → Max. Update `PLAYERS` array in `scripts/lib/scoring.js` AND inside `index.html` if wrong.
- [ ] Player avatars: defaults to colored circle with first initial. After draft, swap for fun images via Admin → Player Avatars (or just paste image URLs into a future picks.json commit).
- [ ] Group letter assignments (A–L) per team — fill in via Admin → Group Assignments once you have the FIFA draw in front of you.
- [ ] Daily recap timing: current cron is 06:05 UTC = 02:05 ET. If WC matches in Mexico run later, may need to push back to 09:00 UTC.

---

## Common tasks cheat sheet

### Recording draft picks live
1. Open Netlify URL → Admin tab → "Draft Picks" sub-tab.
2. "Next pick" field shows whose turn (auto-tracks snake order).
3. Pick a team from dropdown → **Record Pick**.
4. After every round, download picks.json + save as backup.

### Bulk-loading picks from an Excel column
1. Admin → Draft Picks → paste one team per line into the bulk textarea (in snake-draft order: Teddy R1, Rob R1, …, Max R1, Max R2, Joe R2, …).
2. Click **Load Bulk Picks**.

### Locking the draft (everyone sees the same picks)
1. Admin → Export/Import → **Download picks.json**.
2. Go to repo on GitHub → click `picks.json` → click pencil (edit) icon → paste downloaded JSON → commit.
3. Wait ~1 min for Netlify rebuild. All visitors now see locked draft.

### Entering a match result manually
Admin → Match Results → choose round, two teams, scores, (optional knockout winner if PK/ET) → Record Result.

### Adding a team-name alias
Edit `scripts/lib/teams.js`, add to the `ALIAS` object: `"weird api name": "Our Canonical Name"`. Commit, push. Next fetch uses it.

### Forcing a fresh score fetch (don't wait for cron)
Repo → Actions tab → "Fetch WC Scores" → "Run workflow" dropdown → Run workflow.

---

## Visual / functional tweaks to consider

Low-effort wins worth discussing:
- **Color palette per player** — currently auto-assigned, change in `PLAYERS` array (`color` field) in both `index.html` and `scripts/lib/scoring.js`.
- **Custom hero font** — currently Playfair Display + Bebas Neue. Swap via Google Fonts link.
- **Sound effect on goal** — fetch script could detect new results, set a flag, site plays a chime when a player's team scores.
- **Twitter/X recap auto-post** — daily-archive action could post the recap headline to a group account.
- **GroupMe/Slack webhook** — workflow could ping the group chat with recap headline.
- **Bracket view** — currently only group standings. Adding R32→Final bracket visualization would be nice once knockouts start.
- **"My team" view** — let each player toggle "show only my picks" so the rosters page doesn't have to render all 8.

---

## Reference links

- Repo: `https://github.com/StephenScarcella/World-Cup-2026` (confirm/update)
- Netlify dashboard: `https://app.netlify.com`
- football-data.org: `https://www.football-data.org/`
- football-data WC competition: `https://api.football-data.org/v4/competitions/WC`
- DEPLOY.md (in repo) — setup walkthrough
