import test from "node:test";
import assert from "node:assert/strict";
import { compareRankings, saveSeasonRanks } from "../js/seasonSales.js";

const yesterday = Array.from({length: 12}, (_, i) => ({playerId: i + 1, gap: 20 - i}));
const today = yesterday.map(row => row.playerId === 2 ? {...row, injury: "בחוץ"} : row);

test("an injury moves third place to second against the actual previous top ten", () => {
  const history = {latest: {period: 29, today: yesterday, projectionsAvailable: true}};
  saveSeasonRanks(history, 30, today);
  const result = compareRankings(today, history.seasonRanks[29]);
  assert.deepEqual(result.map(row => row.playerId), [1,3,4,5,6,7,8,9,10,11]);
  assert.equal(result[0].previousRank, 1);
  assert.equal(result[1].previousRank, 3);
  assert.equal(result[9].previousRank, undefined);
  assert.deepEqual(history.seasonRanks[30], result.map(row => row.playerId));
});

test("same-day reruns preserve yesterday and use the final published order for tomorrow", () => {
  const h = {};
  saveSeasonRanks(h, 29, yesterday);
  saveSeasonRanks(h, 30, yesterday);
  saveSeasonRanks(h, 30, today);
  saveSeasonRanks(h, 30, today);
  assert.deepEqual(h.seasonRanks[29], yesterday.slice(0,10).map(r => r.playerId));
  const recovered = compareRankings(yesterday, h.seasonRanks[30]);
  assert.equal(recovered[1].previousRank, undefined);
  assert.equal(recovered[2].previousRank, 2);
});

test("missing days and legacy gap-only history never create speculative arrows", () => {
  const h = {periods: {29: yesterday}};
  saveSeasonRanks(h, 31, today);
  assert.ok(compareRankings(today, h.seasonRanks[30]).every(r => r.previousRank === undefined));
});
