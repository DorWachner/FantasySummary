# FantasySummary

A one-page live summary of the ESPN fantasy basketball league
[450062970](https://fantasy.espn.com/basketball/league/standings?leagueId=450062970).

`index.html` is the whole project. On every open it fetches the league from ESPN's public API and
shows one row per team: team name, manager, games played, total points and average points per game.
Click "נקודות" or "ממוצע למשחק" to sort; click again to flip the direction. The league is public,
so no ESPN login is needed, and ESPN allows cross-origin requests, so the page works from any
static host or straight from disk.

## Hosting

The page is published with GitHub Pages from the `main` branch root. Any change to `index.html`
pushed to `main` goes live within a minute or two.

## Notes

- "Games played" is ESPN stat 42: the sum of games played by the players on each roster, the same
  number the ESPN standings page shows.
- ESPN keys seasons by the year they end (2026-27 is `2027`). The page switches to the next year's
  id from October, and falls back one year if ESPN has not opened the new season yet.
- If the league is ever made private, the API will need the `espn_s2` and `SWID` cookies of a
  logged-in ESPN user, and a static page can no longer fetch it directly.
