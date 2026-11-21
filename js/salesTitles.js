import { SEASON_RANK_LIMIT } from "./seasonSales.js";
let sharedTitles = [];
let titles;
export async function loadSharedTitles() {
  const response = await fetch(new URL("../data/season-titles.json", import.meta.url), { cache: "no-cache" });
  if (!response.ok) throw Error("Rank titles: " + response.status);
  const data = await response.json();
  sharedTitles = Array.from({length: SEASON_RANK_LIMIT}, (_, i) =>
    typeof data[i + 1] === "string" ? data[i + 1].trim().slice(0, 60) : "");
  window.dispatchEvent(new Event("sales-rank-titles"));
}
export function getRankTitle(rank) {
  return (titles ?? sharedTitles)[rank - 1] ?? "";
}
export function previewRankTitles(values) {
  titles = values == null ? undefined : values.slice(0, SEASON_RANK_LIMIT).map(value => typeof value === "string" ? value.trim().slice(0, 60) : "");
  window.dispatchEvent(new Event("sales-rank-titles"));
}
