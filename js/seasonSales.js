import { INJURY_LABELS } from "./config.js";

export const SEASON_RANK_LIMIT = 10;
export const SALES_METRIC = "per-game";

export const GAP_METRIC = { POINTS: "points", PERCENT: "percent" };

// Ranks rows by their gap from the baseline, in points or in percent of the baseline (20 against 40 is 50%).
// Sellers fall below the baseline; leaders rise above it.
export function rankByGap(rows, metric, leaders = false) {
  const direction = leaders ? -1 : 1;
  const ranked = [];
  rows.forEach(row => {
    const pointsGap = direction * (row.expected - row.actual);
    const percentGap = row.expected > 0 ? 100 * pointsGap / row.expected : null;
    const gap = metric === GAP_METRIC.PERCENT ? percentGap : pointsGap;
    if (gap != null) ranked.push({...row, pointsGap, percentGap, gap});
  });
  return ranked.sort((a,b) => b.gap - a.gap || a.playerId - b.playerId);
}

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

export function saveSeasonRanks(history, period, today, key = "seasonRanks", rank = rows => rows) {
  history[key] ??= {};
  const last = history.latest;
  // Older snapshots retained injury status only for the latest scoring period.
  if (last?.projectionsAvailable && !history[key][last.period]) {
    history[key][last.period] = displayedSeasonRows(rank(last.today)).map(row => row.playerId);
  }
  history[key][period] = displayedSeasonRows(rank(today)).map(row => row.playerId);
}

export function compareRankings(today, previousIds = []) {
  const previousRanks = new Map(previousIds.map((id, index) => [id, index + 1]));
  return displayedSeasonRows(today).map(row => ({...row, previousRank: previousRanks.get(row.playerId)}));
}

export function seasonLeaders(rows, metric = GAP_METRIC.POINTS) {
  return displayedSeasonRows(rankByGap(rows, metric, true));
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
