// Saves every completed scoring period's points per team to data/history.json,
// so the page does not need one ESPN request per day of the season.
import { readFile, writeFile } from "node:fs/promises";
import { getCurrentSeasonId } from "../js/config.js";
import { fetchLeague, fetchPeriodPoints, getLatestPeriod } from "../js/espnApi.js";

const HISTORY_PATH = new URL("../data/history.json", import.meta.url);
// Recent days are fetched again to pick up ESPN stat corrections.
const PERIODS_TO_REFRESH = 3;
const REQUESTS_PER_BATCH = 10;

const readHistory = () =>
  readFile(HISTORY_PATH, "utf8")
    .then((content) => JSON.parse(content))
    .catch(() => null);

const fetchInBatches = (seasonId, periodIds) =>
  periodIds.reduce(
    (previous, _, index) => {
      if (index % REQUESTS_PER_BATCH !== 0) {
        return previous;
      }
      const batch = periodIds.slice(index, index + REQUESTS_PER_BATCH);
      return previous.then((entries) =>
        Promise.all(batch.map((periodId) => fetchPeriodPoints(seasonId, periodId).then((points) => [periodId, points])))
          .then((batchEntries) => [...entries, ...batchEntries])
      );
    },
    Promise.resolve([])
  );

Promise.all([readHistory(), fetchLeague(getCurrentSeasonId())])
  .then(([history, league]) => {
    const seasonId = league.seasonId;
    const lastCompletedPeriod = getLatestPeriod(league) - 1;
    const storedPeriods = history?.seasonId === seasonId ? history.periods : {};
    const refreshFrom = lastCompletedPeriod - PERIODS_TO_REFRESH + 1;
    const periodsToFetch = Array.from({ length: Math.max(lastCompletedPeriod, 0) }, (_, index) => index + 1)
      .filter((periodId) => !storedPeriods[periodId] || periodId >= refreshFrom);
    return fetchInBatches(seasonId, periodsToFetch).then((fetchedEntries) => {
      const periods = { ...storedPeriods, ...Object.fromEntries(fetchedEntries) };
      const sortedPeriods = Object.fromEntries(
        Object.entries(periods).sort(([first], [second]) => Number(first) - Number(second))
      );
      return writeFile(HISTORY_PATH, JSON.stringify({ seasonId, periods: sortedPeriods }, null, 1) + "\n").then(() =>
        console.log(`Season ${seasonId}: stored periods 1-${lastCompletedPeriod}, fetched ${periodsToFetch.length}.`)
      );
    });
  })
  .catch((error) => {
    console.error("History update failed:", error);
    process.exitCode = 1;
  });
