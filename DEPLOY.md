# The Group — WC 2026 Fantasy

## Architecture

- **index.html** — single-file static site. Reads `picks.json`, `results.json`, `recap.json` on load.
- **picks.json** — locked draft (commit after the draft ends).
- **results.json** — match results, auto-updated by GitHub Action every 30 min.
- **recap.json** — daily headline + sub, regenerated every night.
- **archive/YYYY-MM-DD.html** — frozen daily snapshots. Linked from `archive/index.html`.
- **scripts/** — Node scripts run by Actions (fetch scores, build recap, build archive).

## One-time setup (do this before deploying)

### 1. Push to GitHub
```bash
cd "C:\Users\steph\Documents\Claude\Projects\World Cup Group tracking website"
git init
git add .
git commit -m "initial site"
git branch -M main
# create empty public repo at github.com/new (PUBLIC = unlimited Actions minutes)
git remote add origin https://github.com/<your-user>/the-group-wc.git
git push -u origin main
```

### 2. Add the API key as a GitHub secret
- Sign up at [football-data.org](https://www.football-data.org/) (free tier).
- In your repo: **Settings → Secrets and variables → Actions → New repository secret**.
- Name: `FOOTBALL_DATA_KEY`. Value: your API key. Save.

### 3. Connect Netlify to the repo
- [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project → GitHub**.
- Pick your repo. Build settings: leave blank (publish dir = `.`). Deploy.
- Netlify auto-redeploys whenever Actions push commits. Hands-off from here.

## What runs automatically

| Workflow | When | What |
|---|---|---|
| `fetch-scores.yml` | every 30 min | Pulls finished WC matches from football-data.org, normalizes, writes `results.json`. Commits if changed. |
| `daily-archive.yml` | 06:05 UTC daily (~2am ET) | Regenerates `recap.json`, snapshots the day into `archive/YYYY-MM-DD.html`, updates `archive/index.html`. |

Each push triggers a Netlify rebuild, so the live site stays current with **zero manual work** once the WC kicks off June 11.

## During the draft (live right now)

Picks live in your browser's localStorage while you record them. When the draft ends:

1. Open the site → **Admin → Export / Import → Download picks.json**.
2. Replace the `picks.json` in the repo with the downloaded file.
3. `git add picks.json && git commit -m "draft locked" && git push`.
4. Netlify redeploys. Now all 8 visitors see the locked roster.

(Or: while you're still doing picks, share the live Netlify URL but let people know the leaderboard is "preview" until you commit.)

## Free-tier usage

- **GitHub Actions**: unlimited minutes for public repos. Scores every 30 min ≈ 30 sec each = ~24 min/day = under any cap even on private (2,000 min/mo).
- **Netlify**: free tier covers 300 build minutes/month and 100GB bandwidth. You'll use ~30 build min/mo.
- **football-data.org**: free tier = 10 requests/min, 24/7. We use 2 requests/hour. Microscopic.

## Scoring rules baked in

- **Group stage**: 1 pt per win, 0.5 per tie, 0 per loss — per match, × tier multiplier (1x/2x/3x/4x).
- **Knockouts**: R32 = 2, R16 = 3, QF = 4, SF = 6, Final = 8 — awarded to the *winning* team's owner, × tier multiplier.
- Source of truth: `scripts/lib/scoring.js` (shared between site and Actions).

## Local testing

```bash
node scripts/generate-recap.js   # writes recap.json from current picks/results
node scripts/generate-archive.js # writes today's archive snapshot
FOOTBALL_DATA_KEY=xxx node scripts/fetch-scores.js  # pulls live results
```

## Troubleshooting

- **Action fails on push**: enable `Settings → Actions → General → Workflow permissions → Read and write` so the bots can commit.
- **A team's name doesn't match the API**: open `scripts/lib/teams.js`, add the API's spelling to the `ALIAS` map. Push. Next fetch will pick it up.
- **You want to back-correct a result**: edit `results.json` directly in the repo and push, or override locally via Admin (your local will diverge from the public site until the next API fetch).
