const visitorPreview = new URLSearchParams(location.search).get("preview") === "visitor";
if (!visitorPreview && ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) {
  // This optional editor exists only in the owner's local checkout.
  import("./salesLabels.local.js").catch(() => {});
}
import { compareRankings, SALES_METRIC, SEASON_RANK_LIMIT } from "./seasonSales.js";
import { TEAMS_WITH_PHOTOS, getPlayerHeadshotUrl } from "./config.js";
import { formatShortDate, getPeriodDate } from "./dates.js";

const root = document.getElementById("sales-content");
const number = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 });
let context;
let pending;
const tabs = Array.from(document.querySelectorAll("#view-sales [role=tab]"));
let selected = tabs[0];
let boards;

function selectTab(tab) {
  selected = tab;
  for (const button of tabs) {
    const active = button === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  }
  root.setAttribute("aria-labelledby", tab.id);
  if (boards) {
    root.replaceChildren(boards.get(tab.id));
  }
}

for (const tab of tabs) {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", event => {
    const next = { Home: tabs[0], End: tabs[1], ArrowLeft: tabs.find(t => t !== tab), ArrowRight: tabs.find(t => t !== tab) }[event.key];
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
  root.replaceChildren(element("p", "טוען נתוני מכירות…"));
}

function group(title, rows, nightly, absent) {
  const box = element("section", "");
  box.className = "card sales-board";
  const header = element("header", "");
  header.className = "sales-board-header";
  header.append(element("h3", title));
  box.append(header);
  if (!rows.length) box.append(element("p", "אין מוכר עם פער שלילי ונתוני השוואה לתקופה הזאת."));
  const list = element("ol", "");
  for (const [index, row] of rows.entries()) {
    const item = element("li", "");
    const heading = element("strong", row.name);
    heading.dir = "auto";
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
    const team = context.teams.get(row.teamId);
    const teamName = team?.teamName || row.team;
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
    teamLine.append(element("span", teamName));
    label.append(heading);
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
    const rank = element("span", "מקום " + (index + 1));
    rank.className = "sales-rank";
    identity.append(portrait, label);
    const line = element("div", "");
    line.className = "broadcast-card";
    line.append(identity);
    const comparison = element("dl", "");
    comparison.className = "broadcast-stats";
    const scale = Math.max(1, row.expected, row.actual);
    function metric(title, value, series, points) {
      const pair = element("div", "");
      pair.append(element("dt", title), element("dd", value));
      if (series) {
        pair.className = "broadcast-metric " + series;
        const track = element("span", "");
        track.className = "broadcast-track";
        track.setAttribute("aria-hidden", "true");
        const bar = element("i", "");
        bar.style.width = (100 * Math.max(0, points ?? 0) / scale) + "%";
        track.append(bar);
        pair.append(track);
      }
      comparison.append(pair);
    }
    metric(nightly ? "ממוצע עונתי" : "תחזית העונה", number.format(row.expected),
      nightly ? "average" : "projection", row.expected);
    metric(nightly ? "נקודות הלילה" : "ממוצע עונתי", number.format(row.actual),
      nightly ? "night" : "average", row.actual);
    metric(nightly ? "פער מהממוצע" : "פער מהתחזית", "−" + number.format(row.gap));
    comparison.lastElementChild.className = "score-deficit";
    const rankNow = index + 1;
    const old = row.previousRank;
    const improved = old != null && rankNow > old;
    const worsened = old != null && rankNow < old;
    const standing = element("div", "");
    standing.className = "sales-standing";
    standing.append(rank);
    if (improved || worsened) {
      const arrow = element("span", improved ? "▼" : "▲");
      arrow.className = improved ? "sales-movement down" : "sales-movement up";
      arrow.setAttribute("role", "img");
      arrow.setAttribute("aria-label", (improved ? "שיפור" : "הרעה") + " ממקום " + old + " למקום " + rankNow);
      standing.append(arrow);
    }
    if (!nightly && row.injury) label.append(element("small", row.injury));
    line.append(standing);
    line.append(comparison);
    item.append(line);
    list.append(item);
  }
  box.append(list);
  if (absent.length) box.append(element("small", "ללא מוכר מדורג: " + absent.join(" · ")));
  return box;
}

export function showSales() {
  if (!context || pending) return;
  const current = context;
  const { seasonId, latestPeriod } = current;
  pending = fetch("./data/sales-history.json", {cache:"no-cache"}).then(async response => {
    if (!response.ok) throw Error("Sales snapshot " + response.status);
    return response.json();
  }).then(history => {
    if (current !== context) return;
    if (history.season !== seasonId || history.metric !== SALES_METRIC || !history.latest) throw Error("Sales snapshot unavailable");
    const { period, night, today, projectionsAvailable } = history.latest;
    current.nbaTeams = history.latest.nbaTeams;
    const seasonPanel = element("div", "");
    if (projectionsAvailable) {
      const season = compareRankings(today, history.seasonRanks?.[period - 1]);
      seasonPanel.append(group("טופ " + SEASON_RANK_LIMIT + " המוכרים העונתיים · " + formatShortDate(getPeriodDate(period, latestPeriod)),
        season, false, []));
    } else seasonPanel.append(element("p", "טרם נשמרו תחזיות פתיחה לעונה הזאת."));
    boards = new Map([
      ["night-tab", group("המוכר של הלילה · " + formatShortDate(getPeriodDate(period, latestPeriod)),
        night.map(row => {
          const prior = history.latest.previousNight;
          return {...row, previousRank: prior ? (prior.indexOf(row.playerId) + 1 || null) : undefined};
        }), true, [])],
      ["season-tab", seasonPanel]
    ]);
    selectTab(selected);
  }).catch(() => {
    if (current !== context) return;
    pending = undefined;
    root.replaceChildren(element("p", "נתוני העדכון היומי אינם זמינים כרגע. נסו לרענן."));
  });
}
