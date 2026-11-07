export const LEAGUE_ID = 450062970;

// ESPN stat id for "games played": the sum of games played by the players on the roster.
export const GAMES_PLAYED_STAT_ID = "42";

// ESPN keys a season by the year it ends, and a new season opens in October.
const FIRST_MONTH_OF_NEW_SEASON = 9;

export const getCurrentSeasonId = (now = new Date()) =>
  now.getMonth() >= FIRST_MONTH_OF_NEW_SEASON ? now.getFullYear() + 1 : now.getFullYear();

export const getLeagueUrl = (seasonId, views, params = {}) => {
  const query = new URLSearchParams(params);
  views.forEach((view) => query.append("view", view));
  return `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${seasonId}/segments/0/leagues/${LEAGUE_ID}?${query}`;
};

export const ESPN_STANDINGS_URL = `https://fantasy.espn.com/basketball/league/standings?leagueId=${LEAGUE_ID}`;

export const getPlayerHeadshotUrl = (playerId) => `https://a.espncdn.com/i/headshots/nba/players/full/${playerId}.png`;

// Photos in ./photos are keyed by ESPN team id, so renaming a team keeps its photo.
export const TEAMS_WITH_PHOTOS = new Set([1, 4, 5, 6, 10, 11, 12]);

export const BENCH_SLOT_ID = 12;
export const INJURED_RESERVE_SLOT_ID = 13;

export const POSITION_NAMES = { 1: "PG", 2: "SG", 3: "SF", 4: "PF", 5: "C" };

export const INJURY_LABELS = { OUT: "בחוץ", DAY_TO_DAY: "יום-יום", SUSPENSION: "מושעה" };

export const PRO_TEAM_ABBREVIATIONS = {
  0: "FA", 1: "ATL", 2: "BOS", 3: "NOP", 4: "CHI", 5: "CLE", 6: "DAL", 7: "DEN", 8: "DET", 9: "GSW", 10: "HOU",
  11: "IND", 12: "LAC", 13: "LAL", 14: "MIA", 15: "MIL", 16: "MIN", 17: "BKN", 18: "NYK", 19: "ORL", 20: "PHI",
  21: "PHX", 22: "POR", 23: "SAC", 24: "SAS", 25: "OKC", 26: "UTA", 27: "WAS", 28: "TOR", 29: "MEM", 30: "CHA"
};
