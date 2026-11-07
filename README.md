# FantasySummary

A live summary site for the ESPN fantasy basketball league
[450062970](https://fantasy.espn.com/basketball/league/standings?leagueId=450062970),
published at https://dorwachner.github.io/FantasySummary/.

The page fetches the league from ESPN's public API in the browser on every open. The league is
public and ESPN allows cross-origin requests, so no login and no server are needed.

## Views

**טבלה** (`#table`)

- One row per team: rank change since yesterday and days at the current rank, photo, team, manager,
  games played, points, average per game, and the gap from first place.
- Sort by points or by average; click again to flip the direction.
- Click a team to open its roster: lineup slot, season points, average and last-7-days average.
- A season chart of cumulative points or rank per day.
- Below 1100px the table turns into cards.

**עדכוני שחקנים** (`#updates`)

- **שחקנים חמים**: the 20 free agents with the best average over their last 3 games this season.
  Candidates are ESPN's top 100 free agents of the last 7 days.
- **שחקנים קרים**: the 20 rostered players with the worst average over their last 3 games.
- **עדכוני פציעות**: every injured rostered player with ESPN's expected return date, sortable.

Players need 3 games this season to appear in the hot and cold lists.

## Daily history

Rank changes and the chart need every team's points for every day of the season. ESPN serves that
one day per request, so the `Update league history` GitHub Action saves completed days to
`data/history.json` every day at 06:30 UTC (08:30 in Israel in winter). The page reads that file and
fetches only the newer days live, so it still works if the Action has not run yet.

Run it by hand:

```bash
node scripts/updateHistory.mjs
```

## Layout

| File | Role |
| --- | --- |
| `index.html`, `css/styles.css` | Page shell and styles |
| `js/config.js` | League id, ESPN URLs, team photos, lookup tables |
| `js/espnApi.js` | Every ESPN request |
| `js/history.js` | Daily points from `data/history.json` plus missing days from ESPN |
| `js/standings.js` | Team rows, daily ranks, rank movement |
| `js/tableView.js`, `js/chartView.js`, `js/rosterView.js` | The table view |
| `js/players.js`, `js/updatesView.js` | The player updates view |
| `scripts/updateHistory.mjs`, `.github/workflows/update-history.yml` | Daily history job |

## Team photos

`photos/<teamId>.jpg` is the 200px square shown in the table, and `photos/<teamId>-full.jpg` opens on
click. Photos are keyed by ESPN team id, listed in `TEAMS_WITH_PHOTOS` in `js/config.js`. A team
without a photo falls back to its public ESPN logo, then to the first letter of its name.

## Notes

- "Games played" is ESPN stat 42: games played by the players on each roster.
- ESPN keys seasons by the year they end (2026-27 is `2027`) and the page switches in October.
- The chart colors are a categorical palette checked for color-blind separation in both themes.
- If the league is ever made private, the API needs the `espn_s2` and `SWID` cookies of a logged-in
  ESPN user, and a static page can no longer fetch it directly.
- The modules load over HTTP only. To test locally, run `python3 -m http.server` in this folder.
