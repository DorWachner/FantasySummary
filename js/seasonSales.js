import { INJURY_LABELS } from "./config.js";

export const SEASON_RANK_LIMIT = 10;
export const SALES_METRIC = "per-game";

export function seasonRanking(totals, cards, projections, seasonId, period) {
  const stats = new Map(cards.map(card => [card.player.id, card.player.stats ?? []]));
  const rows = [];
  for (const {player, onTeamId} of totals) {
    const expected = projections[player.id];
    if (!Number.isFinite(expected)) continue;
    const total = player.stats?.find(s => s.id === "00" + seasonId);
    const later = (stats.get(player.id) ?? []).filter(s => s.seasonId === seasonId && s.statSourceId === 0 &&
      s.statSplitTypeId === 5 && s.scoringPeriodId > period && s.stats?.["42"] > 0);
    const count = (total?.stats?.["42"] ?? 0) - later.length;
    if (count <= 0 || !Number.isFinite(total?.appliedTotal)) continue;
    const points = (total?.appliedTotal ?? 0) - later.reduce((sum, s) => sum + s.appliedTotal, 0);
    const actual = points / count;
    rows.push({playerId: player.id, proTeamId: player.proTeamId, name: player.fullName, teamId: onTeamId, expected, actual,
      count, gap: expected - actual,
      injury: INJURY_LABELS[player.injuryStatus] ?? (player.injured ? "פצוע" : null)});
  }
  return rows.sort((a,b) => b.gap - a.gap || a.playerId - b.playerId);
}

export function displayedSeasonRows(rows) {
  return rows.filter(row => row.gap > 0 && (!row.injury || row.injury === "מושעה"))
    .slice(0, SEASON_RANK_LIMIT);
}

export function saveSeasonRanks(history, period, today) {
  history.seasonRanks ??= {};
  const last = history.latest;
  // Older snapshots retained injury status only for the latest scoring period.
  if (last?.projectionsAvailable && !history.seasonRanks[last.period]) {
    history.seasonRanks[last.period] = displayedSeasonRows(last.today).map(row => row.playerId);
  }
  history.seasonRanks[period] = displayedSeasonRows(today).map(row => row.playerId);
}

export function compareRankings(today, previousIds = []) {
  const previousRanks = new Map(previousIds.map((id, index) => [id, index + 1]));
  return displayedSeasonRows(today).map(row => ({...row, previousRank: previousRanks.get(row.playerId)}));
}

export function seasonLeaders(rows) {
  return displayedSeasonRows(rows.map(row => ({...row, gap:row.actual - row.expected}))
    .sort((a,b) => b.gap - a.gap || a.playerId - b.playerId));
}

export function nightRanking(totals, cards, seasonId, period, teams, aboveAverage = false) {
  const night = [];
  const games = new Map(cards.map(card => [card.player.id, card.player.stats ?? []]));
  for (const { player, onTeamId } of totals) {
    const total = player.stats?.find(s => s.id === "00" + seasonId);
    const count = total?.stats?.["42"];
    if (!(count > 0) || !Number.isFinite(total.appliedTotal) || !teams.has(onTeamId)) continue;
    const base = { playerId: player.id, proTeamId: player.proTeamId, name: player.fullName, team: teams.get(onTeamId), teamId: onTeamId, count };
    const later = (games.get(player.id) ?? []).filter(s => s.seasonId === seasonId && s.statSourceId === 0 &&
      s.statSplitTypeId === 5 && s.scoringPeriodId > period && s.stats?.["42"] > 0);
    if (count <= later.length) continue;
    const actual = (total.appliedTotal - later.reduce((sum,s) => sum + s.appliedTotal, 0)) / (count - later.length);
    const game = (games.get(player.id) ?? []).find(s => s.seasonId === seasonId && s.statSourceId === 0 &&
      s.statSplitTypeId === 5 && s.scoringPeriodId === period && s.stats?.["42"] > 0);
    if (game && Number.isFinite(game.appliedTotal)) {
      const gap = aboveAverage ? game.appliedTotal - actual : actual - game.appliedTotal;
      if (gap > 0) night.push({ ...base, actual: game.appliedTotal, expected: actual, gap });
    }
  }
  return night.sort((a,b) => b.gap - a.gap || a.name.localeCompare(b.name));
}
