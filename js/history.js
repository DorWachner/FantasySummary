import { fetchPeriodPoints } from "./espnApi.js";

// Completed days, written once a day by the update-history GitHub Action.
const HISTORY_URL = "data/history.json";

const loadStoredHistory = () =>
  fetch(HISTORY_URL, { cache: "no-cache" })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);

const range = (first, last) => Array.from({ length: Math.max(last - first + 1, 0) }, (_, index) => first + index);

// Points per team for every period from 1 to latestPeriod: { [periodId]: { [teamId]: points } }.
// Stored days come from history.json; anything newer is fetched live from ESPN.
export const loadPeriodPoints = (seasonId, latestPeriod) =>
  loadStoredHistory().then((history) => {
    const storedPeriods = history?.seasonId === seasonId ? history.periods : {};
    const missingPeriods = range(1, latestPeriod).filter((periodId) => !storedPeriods[periodId]);
    return Promise.all(
      missingPeriods.map((periodId) => fetchPeriodPoints(seasonId, periodId).then((points) => [periodId, points]))
    ).then((fetchedEntries) => ({ ...storedPeriods, ...Object.fromEntries(fetchedEntries) }));
  });
