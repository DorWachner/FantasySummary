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

export function compareRankings(today, yesterday) {
  const prior = new Map(yesterday.map((row,i) => [row.playerId, {rank:i+1, gap:row.gap}]));
  return today.filter(row => row.gap > 0).slice(0, SEASON_RANK_LIMIT).map((row,i) => {
    const old = prior.get(row.playerId);
    return {...row, movement: old ? old.rank - (i+1) : null, previousRank: old?.rank, change: old ? row.gap - old.gap : null};
  });
}

export function nightRanking(totals, cards, seasonId, period, teams) {
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
    if (game && Number.isFinite(game.appliedTotal) && actual > game.appliedTotal) {
      night.push({ ...base, actual: game.appliedTotal, expected: actual, gap: actual - game.appliedTotal });
    }
  }
  return night.sort((a,b) => b.gap - a.gap || a.name.localeCompare(b.name));
}
