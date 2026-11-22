import { readFile, writeFile } from "node:fs/promises";
import { getCurrentSeasonId } from "../js/config.js";
import { fetchLeague, getLatestPeriod, fetchSeasonCards, fetchRosteredPlayerCards } from "../js/espnApi.js";
import { buildSalesSnapshot } from "../js/salesSnapshot.js";

const league = await fetchLeague(getCurrentSeasonId());
const season = league.seasonId;
const period = getLatestPeriod(league) - (league.status?.isExpired ? 0 : 1);
const file = new URL("../data/sales-history.json", import.meta.url);
let projections;
try {
  projections = JSON.parse(await readFile(new URL("../data/projections-" + season + ".json", import.meta.url))).averages;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const [totals, cards] = await Promise.all([fetchSeasonCards(season), fetchRosteredPlayerCards(season)]);
const teams = new Map(league.teams.map(team => [team.id,team.name]));
let history;
try { history = JSON.parse(await readFile(file,"utf8")); } catch (e) { if (e.code !== "ENOENT") throw e; }
const nbaResponse = await fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=50");
if (!nbaResponse.ok) throw Error("ESPN NBA teams: " + nbaResponse.status);
const nba = await nbaResponse.json();
const nbaTeams = Object.fromEntries(nba.sports[0].leagues[0].teams.map(({team}) =>
  [team.id, {name: team.displayName, logo: team.logos?.[0]?.href, color: team.color, alternateColor: team.alternateColor}]));
history = buildSalesSnapshot({ history, season, period, totals, cards, projections, teams, nbaTeams });
await writeFile(file, JSON.stringify(history) + "\n");
