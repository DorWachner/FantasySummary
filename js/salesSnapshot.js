import { GAP_METRIC, SALES_METRIC, seasonRanking, nightRanking, rankByGap, saveSeasonRanks, seasonLeaders } from "./seasonSales.js";

export function buildSalesSnapshot({ history, season, period, totals, cards, projections, teams, nbaTeams }) {
  if (history?.season !== season || history.metric !== SALES_METRIC) history = {season, metric: SALES_METRIC, periods:{}};
  if (!totals.length || !cards.length) throw Error("ESPN returned no player data");
  const nightlyPoints = new Map();
  for (const {player} of cards) {
    const game = player.stats?.find(s => s.seasonId === season && s.statSourceId === 0 &&
      s.statSplitTypeId === 5 && s.scoringPeriodId === period && s.stats?.["42"] > 0);
    if (Number.isFinite(game?.appliedTotal)) nightlyPoints.set(player.id, game.appliedTotal);
  }
  const today = seasonRanking(totals,cards,projections ?? {},season,period).map(row => ({...row, team:teams.get(row.teamId), nightPoints:nightlyPoints.get(row.playerId) ?? null}));
  history.periods[period] = today.map(({playerId,gap}) => ({playerId,gap}));
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
  history.latest = {period, today, night, nightLeaders, previousNight, nbaTeams,
    projectionsAvailable: Boolean(projections)};
  return history;
}
