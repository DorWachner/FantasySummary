import { readFile, writeFile } from "node:fs/promises";
import { getCurrentSeasonId } from "../js/config.js";
import { fetchLeague, getLatestPeriod, fetchSeasonCards, fetchRosteredPlayerCards } from "../js/espnApi.js";
import { GAP_METRIC, SALES_METRIC, seasonRanking, nightRanking, rankByGap, saveSeasonRanks, seasonLeaders } from "../js/seasonSales.js";

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
const rank = day => seasonRanking(totals,cards,projections ?? {},season,day);
const compact = rows => rows.map(({playerId,gap}) => ({playerId,gap}));
let history;
try { history = JSON.parse(await readFile(file,"utf8")); } catch (e) { if (e.code !== "ENOENT") throw e; }
if (history?.season !== season || history.metric !== SALES_METRIC) history = {season, metric: SALES_METRIC, periods:{}};
if (!totals.length || !cards.length) throw Error("ESPN returned no player data");
const nightlyPoints = new Map();
for (const {player} of cards) {
  const game = player.stats?.find(s => s.seasonId === season && s.statSourceId === 0 &&
    s.statSplitTypeId === 5 && s.scoringPeriodId === period && s.stats?.["42"] > 0);
  if (Number.isFinite(game?.appliedTotal)) nightlyPoints.set(player.id, game.appliedTotal);
}
const today = rank(period).map(row => ({...row, team:teams.get(row.teamId), nightPoints:nightlyPoints.get(row.playerId) ?? null}));
history.periods[period] = compact(today);
saveSeasonRanks(history, period, today);
const byPercent = (rows, leaders) => rankByGap(rows, GAP_METRIC.PERCENT, leaders);
saveSeasonRanks(history, period, today, "percentSeasonRanks", rows => byPercent(rows));
const night = nightRanking(totals,cards,season,period,teams);
const nightLeaders = nightRanking(totals,cards,season,period,teams,true);
history.leaderRanks ??= {};
history.leaderRanks[period] = {
  night: nightLeaders.map(row => row.playerId),
  season: seasonLeaders(today).map(row => row.playerId)
};
history.percentLeaderRanks ??= {};
history.percentLeaderRanks[period] = {
  night: byPercent(nightLeaders, true).map(row => row.playerId),
  season: seasonLeaders(today, GAP_METRIC.PERCENT).map(row => row.playerId)
};
history.nightRanks ??= {};
const previousNight = history.nightRanks[period-1] ?? nightRanking(totals,cards,season,period-1,teams).map(row => row.playerId);
history.nightRanks[period] = night.map(row => row.playerId);
history.percentNightRanks ??= {};
history.percentNightRanks[period] = byPercent(night).map(row => row.playerId);
const nbaResponse = await fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=50");
if (!nbaResponse.ok) throw Error("ESPN NBA teams: " + nbaResponse.status);
const nba = await nbaResponse.json();
const nbaTeams = Object.fromEntries(nba.sports[0].leagues[0].teams.map(({team}) =>
  [team.id, {name: team.displayName, logo: team.logos?.[0]?.href, color: team.color, alternateColor: team.alternateColor}]));
history.latest = {period, today, night, nightLeaders, previousNight, nbaTeams,
  projectionsAvailable: Boolean(projections)};
await writeFile(file, JSON.stringify(history) + "\n");
