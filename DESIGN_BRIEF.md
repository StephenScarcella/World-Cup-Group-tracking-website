# The Group — Design Brief (for claude.design)

Drop **`the-group-DESIGN.html`** into claude.design. It's a single self-contained
file — no build step, no data fetching, no dependencies. It renders the full site
with a baked-in snapshot of real data, so what you see is what the league sees.

## Paste this as your opening prompt

> This is "The Group" — a fantasy site for an 8-friend World Cup 2026 pool. The
> attached `the-group-DESIGN.html` is the entire site in one file: all HTML, CSS,
> and JS inline, with a snapshot of real data baked in at the top (a `fetch`
> shim — leave it alone). The tournament is live, so treat this as a polish job,
> not a rebuild.
>
> I want to work on **design only** — visual hierarchy, typography, color,
> spacing, motion, mobile layout. Do **not** change the scoring logic, the data
> shapes, the section structure, or the IDs/classes the JS depends on. Keep it a
> single file that renders standalone.
>
> Current look: dark navy editorial/magazine style (Playfair Display + Bebas Neue
> + Inter), gold accent, tier colors gold/silver/bronze/grey. Sections in order:
> Hero recap → Outlook → Leaderboard → Rosters → Matches → Bracket → Groups →
> Chirps → Archive → Admin.
>
> Start by giving me a quick read on what's working and what's weak, then show me
> 2–3 directions for the hero and leaderboard before we go deep.

## Guardrails (tell it to respect these)

- **Single file.** Everything stays inline; output must render on its own.
- **Don't touch the shim.** The first `<script>` block (the "claude.design
  self-contained data shim") feeds the page its data. Leave it.
- **Keep element IDs/classes.** The render code looks up things like
  `heroHeadline`, `projStandings`, `storyGrid`, `blurbGrid`, `gamesWatchBox`,
  `.admin-tab`, `.tier-chip`. Renaming them silently breaks rendering.
- **Don't rewrite scoring or data.** Tier multipliers, point values, draft order
  are correct and load-bearing. Design only.
- **Mobile matters.** Half the league checks it on a phone — verify narrow widths.

## Bringing changes back to the live site

The live site is `index.html` in the code repo. When you're happy with a design
change in claude.design:

1. Copy the changed CSS / markup (everything **except** the shim) out of
   `the-group-DESIGN.html`.
2. Paste the equivalent change into `index.html` in the repo (same section).
3. Commit & push — Netlify redeploys; the GitHub Actions keep feeding live data.

To re-snapshot fresh data into the design file later, run:
`node scripts/build-design-file.js`

## Safe to redesign vs. leave alone

| Safe to redesign | Leave alone |
|---|---|
| Colors, fonts, spacing, shadows, radii | `STATE`, scoring functions, tier math |
| Hero / card / table layouts | `loadRemote`, the fetch shim, data shapes |
| Animations, hover states, transitions | Element IDs & classes the JS queries |
| Mobile breakpoints, nav | Draft order, point values, group letters |
| Iconography, badges, chips | Admin save/export logic |
