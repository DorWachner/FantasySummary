import test from "node:test";
import assert from "node:assert/strict";
import {rankGms} from "../js/gmSales.js";

test("missed games count at the player's projected average only when injuries are included", () => {
  const players = new Map([
    [11, {id:11, games:0, missed:3, projection:30, points:0}],
    [12, {id:12, games:2, missed:1, projection:20, points:45}],
    [13, {id:13, games:1, missed:0, projection:15, points:10}]
  ]);
  const data = {rankings:new Map([[1, {team:{teamId:1}, players, missing:new Set()}]]), drops:new Map([["1/11", 4]])};
  assert.equal(rankGms(data, false)[0].total, 5);
  const [gm] = rankGms(data, true);
  assert.equal(gm.total, 110);
  assert.equal(gm.players[0].expected, 90);
  assert.equal(gm.players[0].dropped, 4);
  assert.equal(rankGms(data, false)[0].total, 5);
});

test("injury and waiver details only list deficits visible at one decimal place", () => {
  const players = new Map([
    [1, {id:1, games:3, missed:1, projection:22.4, points:117}],
    [2, {id:2, games:1, missed:0, projection:10.04, points:10}],
    [3, {id:3, games:1, missed:0, projection:10.06, points:10}]
  ]);
  const data = {rankings:new Map([[1, {team:{teamId:1}, players, missing:new Set()}]]), drops:new Map([[1 + "/1", 4]])};
  for (const includeInjuries of [false, true]) {
    const [gm] = rankGms(data, includeInjuries);
    assert.deepEqual(gm.players.map(p => p.id), [3]);
    assert.ok(Math.abs(gm.total - 0.1) < 1e-9);
  }
});
