import { getLeagueUrl } from "./config.js";

const fetchJson = (url) =>
  fetch(url, { headers: { accept: "application/json" } }).then((response) => {
    if (!response.ok) {
      const error = new Error(`ESPN החזיר ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  });

const LEAGUE_VIEWS = ["mTeam", "mSettings", "mStatus"];

// Before ESPN opens a new season the current id answers 404, so fall back one year.
export const fetchLeague = (seasonId) =>
  fetchJson(getLeagueUrl(seasonId, LEAGUE_VIEWS)).catch((error) => {
    if (error.status === 404) {
      return fetchJson(getLeagueUrl(seasonId - 1, LEAGUE_VIEWS));
    }
    throw error;
  });

// The scoring period in progress: today's games, often not started yet.
export const getLatestPeriod = (league) => league.status?.latestScoringPeriod ?? league.scoringPeriodId;

const toPeriodPoints = (league) => {
  const teamEntries = (league.schedule ?? []).flatMap((matchup) => matchup.teams ?? [matchup.home, matchup.away]);
  return Object.fromEntries(
    teamEntries
      .filter(Boolean)
      .map((entry) => [entry.teamId, entry.rosterForCurrentScoringPeriod?.appliedStatTotal ?? 0])
  );
};

// Fantasy points each team scored in one scoring period (one NBA day): { [teamId]: points }.
export const fetchPeriodPoints = (seasonId, periodId) =>
  fetchJson(getLeagueUrl(seasonId, ["mMatchupScore"], { scoringPeriodId: periodId })).then(toPeriodPoints);

export const fetchRosters = (seasonId) => fetchJson(getLeagueUrl(seasonId, ["mRoster"]));

// Per-game stats come from the player card; enough recent periods to find a player's last 3 games.
const RECENT_PERIODS_WINDOW = 15;
const MAX_FREE_AGENTS = 100;

const fetchPlayerCards = (seasonId, playersFilter) =>
  fetch(getLeagueUrl(seasonId, ["kona_playercard"]), {
    headers: {
      accept: "application/json",
      "x-fantasy-filter": JSON.stringify({
        players: { ...playersFilter, filterStatsForTopScoringPeriodIds: { value: RECENT_PERIODS_WINDOW } }
      })
    }
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`ESPN החזיר ${response.status}`);
    }
    return response.json().then((data) => data.players ?? []);
  });

export const fetchRosteredPlayerCards = (seasonId) =>
  fetchPlayerCards(seasonId, { filterStatus: { value: ["ONTEAM"] } });

// The best free agents of the last 7 days: a superset of the best ones over their last 3 games.
export const fetchFreeAgentCards = (seasonId) =>
  fetchPlayerCards(seasonId, {
    filterStatus: { value: ["FREEAGENT", "WAIVERS"] },
    filterActive: { value: true },
    limit: MAX_FREE_AGENTS,
    sortAppliedStatTotal: { sortAsc: false, sortPriority: 1, value: `01${seasonId}` }
  });
