// Tells the scheduled workflow whether ESPN has finished a night that
// data/sales-history.json does not have yet, so most runs can stop early.
import { appendFile, readFile } from "node:fs/promises";
import { getCurrentSeasonId } from "../js/config.js";
import { fetchLeague, getLatestPeriod } from "../js/espnApi.js";

const league = await fetchLeague(getCurrentSeasonId());
const period = getLatestPeriod(league) - (league.status?.isExpired ? 0 : 1);
let history;
try {
  history = JSON.parse(await readFile(new URL("../data/sales-history.json", import.meta.url), "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const published = history?.season === league.seasonId ? history.latest?.period : undefined;
const stale = !(published >= period);
console.log(`Season ${league.seasonId}: ESPN finished period ${period}, published ${published ?? "none"}, stale=${stale}`);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `stale=${stale}\n`);
