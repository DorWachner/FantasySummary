import { GAMES_PLAYED_STAT_ID } from "./config.js";

const getManagerName = (team, membersById) => {
  const owner = (team.owners ?? []).map((ownerId) => membersById.get(ownerId)).find(Boolean);
  if (!owner) {
    return "—";
  }
  const fullName = [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim();
  return fullName || owner.displayName;
};

export const toTeamSummaries = (league) => {
  const membersById = new Map(league.members.map((member) => [member.id, member]));
  return league.teams.map((team) => {
    const gamesPlayed = team.valuesByStat?.[GAMES_PLAYED_STAT_ID] ?? 0;
    const totalPoints = team.points ?? 0;
    return {
      teamId: team.id,
      espnLogoUrl: team.logo,
      teamName: team.name.trim(),
      managerName: getManagerName(team, membersById),
      gamesPlayed,
      totalPoints,
      averagePointsPerGame: gamesPlayed > 0 ? totalPoints / gamesPlayed : 0
    };
  });
};

// Competition ranking: equal points share a rank, and the next rank skips ahead.
const rankByPoints = (pointsByTeam) => {
  const sortedPoints = Object.values(pointsByTeam).sort((first, second) => second - first);
  return Object.fromEntries(
    Object.entries(pointsByTeam).map(([teamId, points]) => [teamId, sortedPoints.indexOf(points) + 1])
  );
};

// Cumulative points and rank of every team at the end of each period from 1 to latestPeriod.
export const buildSeasonHistory = (periodPoints, teamIds, latestPeriod) => {
  const periods = Array.from({ length: latestPeriod }, (_, index) => index + 1);
  const runningTotals = Object.fromEntries(teamIds.map((teamId) => [teamId, 0]));
  const cumulativeByTeam = Object.fromEntries(teamIds.map((teamId) => [teamId, []]));
  const rankByTeam = Object.fromEntries(teamIds.map((teamId) => [teamId, []]));
  periods.forEach((periodId) => {
    teamIds.forEach((teamId) => {
      runningTotals[teamId] += periodPoints[periodId]?.[teamId] ?? 0;
      cumulativeByTeam[teamId].push(runningTotals[teamId]);
    });
    const ranks = rankByPoints(runningTotals);
    teamIds.forEach((teamId) => rankByTeam[teamId].push(ranks[teamId]));
  });
  const lastGameDay = periods.findLast((periodId) => teamIds.some((teamId) => (periodPoints[periodId]?.[teamId] ?? 0) > 0));
  return { periods, cumulativeByTeam, rankByTeam, lastGameDay: lastGameDay ?? 0 };
};

// Rank change since the day before the last game day, and how many days the team has held its rank.
export const getRankMovement = (seasonHistory, teamId) => {
  const ranks = seasonHistory.rankByTeam[teamId];
  const lastIndex = seasonHistory.lastGameDay - 1;
  if (!ranks || lastIndex < 0) {
    return null;
  }
  const currentRank = ranks[lastIndex];
  const previousRank = lastIndex > 0 ? ranks[lastIndex - 1] : currentRank;
  let firstIndexAtRank = lastIndex;
  while (firstIndexAtRank > 0 && ranks[firstIndexAtRank - 1] === currentRank) {
    firstIndexAtRank -= 1;
  }
  return {
    rank: currentRank,
    change: previousRank - currentRank,
    daysAtRank: lastIndex - firstIndexAtRank + 1
  };
};
