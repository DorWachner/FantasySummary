const visitorPreview = new URLSearchParams(location.search).get("preview") === "visitor";
if (!visitorPreview && ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) {
  // This optional editor exists only in the owner's local checkout.
  import("./salesLabels.local.js").catch(() => {});
}
import { compareRankings, rankByGap, seasonLeaders, GAP_METRIC, SALES_METRIC, SEASON_RANK_LIMIT } from "./seasonSales.js?v=rankings-3";
import { TEAMS_WITH_PHOTOS, getPlayerHeadshotUrl } from "./config.js";
import { formatShortDate, getPeriodDate } from "./dates.js";

const root = document.getElementById("sales-content");
const killsRoot = document.getElementById("kills-content");
const number = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
let context;
let pending;
const tabs = Array.from(document.querySelectorAll("#view-sales [role=tab]"));
const killTabs = Array.from(document.querySelectorAll("#view-kills [role=tab]"));
const selections = new Map([[root, tabs[0]], [killsRoot, killTabs[0]]]);
let boards;
let snapshot;
const metrics = new Map([[root, GAP_METRIC.POINTS], [killsRoot, GAP_METRIC.POINTS]]);
const metricButtons = Array.from(document.querySelectorAll("[data-gap-metric]"));

function setMetric(panel, metric) {
  metrics.set(panel, metric);
  for (const button of metricButtons) {
    if (button.closest("section").contains(panel)) {
      const active = button.dataset.gapMetric === metric;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }
  if (!snapshot) return;
  buildBoards();
  selectTab(selections.get(panel));
}

for (const button of metricButtons) {
  const panel = button.closest("section").querySelector("[role=tabpanel]");
  button.addEventListener("click", () => setMetric(panel, button.dataset.gapMetric));
}

function selectTab(tab) {
  const panel = document.getElementById(tab.getAttribute("aria-controls"));
  selections.set(panel, tab);
  for (const button of tab.parentElement.querySelectorAll("[role=tab]")) {
    const active = button === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  }
  panel.setAttribute("aria-labelledby", tab.id);
  if (boards) {
    panel.replaceChildren(boards.get(tab.id));
  }
}

for (const tab of [...tabs, ...killTabs]) {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", event => {
    const siblings = Array.from(tab.parentElement.querySelectorAll("[role=tab]"));
    const i = siblings.indexOf(tab);
    const next = { Home: siblings[0], End: siblings.at(-1), ArrowLeft: siblings[(i+1)%siblings.length], ArrowRight: siblings[(i+siblings.length-1)%siblings.length] }[event.key];
    if (!next) return;
    event.preventDefault();
    selectTab(next);
    next.focus();
  });
}

function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

export function setSalesContext(value) {
  context = value;
  pending = undefined;
  boards = undefined;
  snapshot = undefined;
  root.replaceChildren(element("p", "טוען נתוני מכירות…"));
  killsRoot.replaceChildren(element("p", "טוען נתוני הריגות…"));
}

function playerIdentity(row) {
  const identity = element("div", "");
  identity.className = "broadcast-header";
  const photo = document.createElement("img");
  const portrait = element("span", "");
  portrait.className = "broadcast-portrait";
  portrait.append(photo);
  photo.className = "headshot";
  photo.alt = "";
  photo.loading = "lazy";
  photo.addEventListener("error", () => portrait.remove(), { once: true });
  photo.src = getPlayerHeadshotUrl(row.playerId);
  const label = element("div", "");
  const heading = element("strong", row.name);
  heading.dir = "auto";
  label.append(heading);
  const team = context.teams.get(row.teamId);
  const teamLine = element("div", "");
  teamLine.className = "broadcast-team";
  const logo = TEAMS_WITH_PHOTOS.has(row.teamId) ? "photos/" + row.teamId + ".jpg" :
    team?.espnLogoUrl?.startsWith("https://g.espncdn.com/") ? team.espnLogoUrl : null;
  if (logo) {
    const badge = document.createElement("img");
    badge.src = logo;
    badge.alt = "";
    badge.loading = "lazy";
    badge.addEventListener("error", () => badge.remove(), {once:true});
    teamLine.append(badge);
  }
  teamLine.append(element("span", team?.teamName || row.team));
  const nba = context.nbaTeams?.[row.proTeamId];
  if (nba) {
    if (/^[a-f\d]{6}$/i.test(nba.color)) identity.style.setProperty("--jersey-color", "#" + nba.color);
    if (/^[a-f\d]{6}$/i.test(nba.alternateColor)) identity.style.setProperty("--jersey-trim", "#" + nba.alternateColor);
    const proLine = element("div", "");
    proLine.className = "broadcast-team nba-team";
    if (nba.logo) {
      const crest = document.createElement("img");
      crest.className = "jersey-crest";
      crest.src = nba.logo;
      crest.alt = "";
      crest.loading = "lazy";
      crest.addEventListener("error", () => crest.remove(), {once:true});
      identity.prepend(crest);
    }
    proLine.append(element("span", nba.name));
    label.append(proLine);
  }
  label.append(teamLine);
  identity.append(portrait, label);
  return { identity, label };
}

function cell(title, className) {
  const td = element("td", "");
  td.className = className;
  td.dataset.label = title;
  return td;
}

function group(title, rows, nightly, leaders, panel) {
  const box = element("section", "");
  box.className = "card sales-board";
  const header = element("header", "");
  header.className = "sales-board-header";
  header.append(element("h3", title));
  box.append(header);
  if (!rows.length) {
    box.append(element("p", leaders ? "אין שחקנים עם פער חיובי בתקופה הזאת." : "אין מוכר עם פער שלילי ונתוני השוואה לתקופה הזאת."));
    return box;
  }
  const scoreLabel = nightly ? "הלילה" : "ממוצע";
  const baselineLabel = nightly ? "ממוצע" : "תחזית";
  const metric = metrics.get(panel);
  const columns = ["מקום", "שחקן", scoreLabel + " מול " + baselineLabel, "פער בנקודות", "פער באחוזים"];
  const gapColumns = new Map([[3, GAP_METRIC.POINTS], [4, GAP_METRIC.PERCENT]]);
  // Bars share one scale across the board, so a longer bar is always a bigger number.
  const scale = Math.max(1, ...rows.map(row => Math.max(row.expected, row.actual)));
  const table = element("table", "");
  table.className = "sales-table";
  const headRow = element("tr", "");
  columns.forEach((column, index) => {
    const th = element("th", "");
    th.scope = "col";
    const columnMetric = gapColumns.get(index);
    if (columnMetric) {
      const isActive = columnMetric === metric;
      th.className = "sales-number sortable" + (isActive ? " active" : "");
      th.setAttribute("aria-sort", isActive ? "descending" : "none");
      const sortButton = element("button", column);
      sortButton.type = "button";
      sortButton.addEventListener("click", () => setMetric(panel, columnMetric));
      th.append(sortButton);
    } else th.textContent = column;
    headRow.append(th);
  });
  const thead = element("thead", "");
  thead.append(headRow);
  const tbody = element("tbody", "");
  for (const [index, row] of rows.entries()) {
    const tr = element("tr", "");
    const rankNow = index + 1;
    const old = row.previousRank;
    const improved = old != null && rankNow > old;
    const worsened = old != null && rankNow < old;
    const standing = cell(columns[0], "sales-standing");
    standing.append(element("span", String(rankNow)));
    standing.firstChild.className = "sales-rank";
    if (improved || worsened) {
      const arrow = element("span", improved ? "▼" : "▲");
      arrow.className = improved ? "sales-movement down" : "sales-movement up";
      arrow.setAttribute("role", "img");
      arrow.setAttribute("aria-label", (improved ? "ירידה" : "עלייה") + " ממקום " + old + " למקום " + rankNow);
      standing.append(arrow);
    }
    const { identity, label } = playerIdentity(row);
    if (!nightly && row.injury) label.append(element("small", row.injury));
    const player = cell(columns[1], "sales-player-cell");
    player.append(identity);
    const comparison = cell(columns[2], "sales-comparison");
    const bars = element("dl", "");
    function bar(title, points, series) {
      const pair = element("div", "");
      pair.className = "broadcast-metric " + series;
      const track = element("span", "");
      track.className = "broadcast-track";
      track.setAttribute("aria-hidden", "true");
      const fill = element("i", "");
      fill.style.width = (100 * Math.max(0, points) / scale) + "%";
      track.append(fill);
      pair.append(element("dt", title), track, element("dd", number.format(points)));
      bars.append(pair);
    }
    bar(scoreLabel, row.actual, nightly ? "night" : "average");
    bar(baselineLabel, row.expected, nightly ? "average" : "projection");
    comparison.append(bars);
    const sign = leaders ? "+" : "−";
    const pointsGap = cell(columns[3], "sales-number sales-gap");
    pointsGap.append(element("span", sign + number.format(row.pointsGap)));
    const percentGap = cell(columns[4], "sales-number sales-gap");
    percentGap.append(element("span", row.percentGap == null ? "—" : sign + percent.format(row.percentGap) + "%"));
    (metric === GAP_METRIC.POINTS ? pointsGap : percentGap).classList.add("active");
    tr.append(standing, player, comparison, pointsGap, percentGap);
    tbody.append(tr);
  }
  table.append(thead, tbody);
  const scroll = element("div", "");
  scroll.className = "sales-table-wrap";
  scroll.append(table);
  box.append(scroll);
  return box;
}

function previousRank(ids, playerId) {
  return ids ? (ids.indexOf(playerId) + 1 || null) : undefined;
}

function buildBoards() {
  const { latestPeriod } = context;
  const { period, projectionsAvailable, nbaTeams } = snapshot.latest;
  context.nbaTeams = nbaTeams;
  const date = formatShortDate(getPeriodDate(period, latestPeriod));
  const salesMetric = metrics.get(root);
  const killsMetric = metrics.get(killsRoot);
  const isSalesPercent = salesMetric === GAP_METRIC.PERCENT;
  const isKillsPercent = killsMetric === GAP_METRIC.PERCENT;
  const previousNight = isSalesPercent ? snapshot.percentNightRanks?.[period - 1] : snapshot.latest.previousNight;
  const previousSeason = (isSalesPercent ? snapshot.percentSeasonRanks : snapshot.seasonRanks)?.[period - 1];
  const previousLeaders = (isKillsPercent ? snapshot.percentLeaderRanks : snapshot.leaderRanks)?.[period - 1];
  const night = rankByGap(snapshot.latest.night, salesMetric).slice(0, 15)
    .map(row => ({...row, previousRank: previousRank(previousNight, row.playerId)}));
  const seasonPanel = projectionsAvailable ? group("טופ " + SEASON_RANK_LIMIT + " המוכרים העונתיים · " + date,
    compareRankings(rankByGap(snapshot.latest.today, salesMetric), previousSeason), false, false, root) :
    element("p", "טרם נשמרו תחזיות פתיחה לעונה הזאת.");
  const daily = snapshot.latest.nightLeaders;
  boards = new Map([
    ["night-tab", group("המוכר של הלילה · " + date, night, true, false, root)],
    ["season-tab", seasonPanel],
    ["kills-night", daily ? group("ההורג היומי · " + date, rankByGap(daily, killsMetric, true).map(row => ({
      ...row, previousRank: previousRank(previousLeaders?.night ?? [], row.playerId)
    })), true, true, killsRoot) : element("p", "הדירוג היומי יופיע אחרי עדכון הנתונים הבא.")],
    ["kills-season", projectionsAvailable ? group("טופ 10 עונתי · " + date,
      compareRankings(seasonLeaders(snapshot.latest.today, killsMetric), previousLeaders?.season), false, true, killsRoot) :
      element("p", "טרם נשמרו תחזיות לעונה הזאת.")]
  ]);
}

export function showSales() {
  if (!context || pending) return;
  const current = context;
  const { seasonId } = current;
  pending = fetch("./data/sales-history.json", {cache:"no-cache"}).then(async response => {
    if (!response.ok) throw Error("Sales snapshot " + response.status);
    return response.json();
  }).then(history => {
    if (current !== context) return;
    if (history.season !== seasonId || history.metric !== SALES_METRIC || !history.latest) throw Error("Sales snapshot unavailable");
    snapshot = history;
    buildBoards();
    for (const tab of selections.values()) selectTab(tab);
    if (history.latest.period < current.period) {
      // The scheduled job can finish after the visitor has already opened the page.
      // Keep the last published rankings visible until the new snapshot arrives.
      pending = undefined;
    }
  }).catch(() => {
    if (current !== context) return;
    pending = undefined;
    if (boards) return;
    root.replaceChildren(element("p", "נתוני העדכון היומי אינם זמינים כרגע. נסו לרענן."));
    killsRoot.replaceChildren(element("p", "נתוני העדכון היומי אינם זמינים כרגע. נסו לרענן."));
  });
}
