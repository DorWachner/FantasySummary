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
if (["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) {
  const gmTab = tabs[1].cloneNode(false);
  gmTab.id = "gm-tab";
  gmTab.textContent = "איזה GM הכי נמכר?";
  tabs[1].after(gmTab);
  tabs.push(gmTab);
}
let selected = tabs.find(tab => tab.id === "gm-tab" && new URLSearchParams(location.search).get("ranking") === "gm") ?? tabs[0];
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
    if (tab.id === "gm-tab") showGmSales(boards.get(tab.id));
  }
}

for (const tab of tabs) {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", event => {
    const i = tabs.indexOf(tab);
    const next = { Home: tabs[0], End: tabs.at(-1), ArrowLeft: tabs[(i+1)%tabs.length], ArrowRight: tabs[(i+tabs.length-1)%tabs.length] }[event.key];
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

function gmPhoto(src, name, className) {
  const frame = element("span", name.split(/\s+/).slice(0, 2).map(word => word[0]).join(""));
  frame.className = className;
  frame.setAttribute("aria-hidden", "true");
  if (src) {
    const img = new Image();
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove(), {once:true});
    img.src = src;
    frame.append(img);
  }
  return frame;
}

async function showGmSales(panel) {
  if (panel.childElementCount) return;
  panel.append(element("p", "טוען סגלים היסטוריים ושחרורים לווייברס…"));
  try {
    const current = context;
    const {loadGmSales, rankGms} = await import("./gmSales.js?v=injuries-2");
    const data = await loadGmSales(current);
    const toggle = element("label", "");
    toggle.className = "gm-injury-switch";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.setAttribute("role", "switch");
    toggle.append("לכלול משחקים שהוחמצו בגלל פציעה", checkbox);
    const results = element("div", "");
    const render = () => {
      const previous = new Map([...results.querySelectorAll("details")].map(detail =>
        [detail.dataset.team, {open:detail.open, waivers:detail.querySelector('input[value="waivers"]')?.checked}]));
      results.replaceChildren(gmList(rankGms(data, checkbox.checked), current, checkbox.checked, previous));
    };
    checkbox.onchange = render;
    panel.replaceChildren(element("h3", "דירוג המנהלים"), toggle, results);
    if (data.uncovered.length) {
      toggle.after(element("small", "אין דוח פציעות זמין עבור " + data.uncovered.length + " ימי משחק."));
    }
    render();
  } catch {
    const retry = element("button", "נסה שוב");
    retry.type = "button";
    retry.onclick = () => { panel.replaceChildren(); showGmSales(panel); };
    panel.replaceChildren(element("p", "לא ניתן לטעון דירוג עונתי מלא כרגע."), retry);
  }
}

function gmList(rows, current, includeInjuries, previous) {
    const list = element("ol", "");
    rows.forEach(({team, players, total, missing}, i) => {
      const item = element("li", "");
      const detail = element("details", "");
      detail.dataset.team = String(team.teamId);
      const state = previous.get(detail.dataset.team);
      detail.open = state?.open ?? i === 0;
      const summary = element("summary", "");
      const manager = element("span", "");
      manager.append(element("bdi", team.managerName), element("small", team.teamName));
      const score = element("strong", "");
      score.append(element("bdi", number.format(total)), element("small", "נק׳ חסרות"));
      const identity = element("div", "");
      identity.className = "gm-identity";
      identity.append(gmPhoto(TEAMS_WITH_PHOTOS.has(team.teamId) ? "photos/" + team.teamId + ".jpg" : team.espnLogoUrl,
        team.teamName, "gm-team-photo"), manager);
      summary.append(element("b", String(i + 1)), identity, score);
      detail.append(summary);
      const table = document.createElement("table");
      table.setAttribute("aria-label", "פירוט השחקנים של " + team.managerName);
      const header = table.createTHead().insertRow();
      for (const title of ["שחקן", "מש׳", "צפי", "בפועל", "חוסר"]) {
        const th = element("th", title);
        th.scope = "col";
        header.append(th);
      }
      const body = table.createTBody();
      for (const p of players) {
        const line = body.insertRow();
        const player = line.insertCell();
        const playerInfo = element("div", "");
        const text = element("div", "");
        text.append(element("bdi", p.name));
        if (includeInjuries && p.missed) {
          text.append(element("small", "משחקים שהחמיץ: " + p.missed + " · צפי למשחק: " +
            number.format(p.projection) + " · צפי שהוחמץ: " + number.format(p.missed * p.projection) + " נק׳"));
        }
        if (p.dropped) text.append(element("small", "שוחרר לווייברס · " + formatShortDate(getPeriodDate(p.dropped, current.latestPeriod))));
        playerInfo.className = "gm-identity";
        playerInfo.append(gmPhoto(getPlayerHeadshotUrl(p.id), p.name, "gm-player-photo"), text);
        player.append(playerInfo);
        for (const value of [p.games, p.expected, p.points, p.gap]) {
          line.insertCell().append(element("bdi", number.format(value)));
        }
      }
      if (players.length) {
        const dropped = players.filter(p => p.dropped).length;
        if (dropped) {
          const filter = element("div", "");
          filter.className = "gm-player-filter";
          filter.setAttribute("role", "radiogroup");
          filter.setAttribute("aria-label", "הצגת שחקנים אצל " + team.managerName);
          const apply = waivers => players.forEach((p, index) => {
            body.rows[index].hidden = waivers && !p.dropped;
          });
          for (const [value, title, count] of [["all","כל השחקנים",players.length],["waivers","שוחררו לווייברס",dropped]]) {
            const label = element("label", "");
            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "gm-players-" + team.teamId;
            radio.value = value;
            radio.checked = (value === "waivers") === Boolean(state?.waivers);
            radio.onchange = () => apply(value === "waivers");
            label.append(radio, element("span", title), element("bdi", String(count)));
            filter.append(label);
          }
          apply(Boolean(state?.waivers));
          detail.append(filter);
        }
        detail.append(table);
      }
      if (!players.length) detail.append(element("p", "אין שחקנים עם חוסר מצטבר."));
      if (missing) detail.append(element("small", "שחקנים ששיחקו ללא תחזית זמינה: " + missing));
      item.append(detail);
      list.append(item);
    });
    return list;
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
      ["season-tab", seasonPanel],
      ["gm-tab", Object.assign(element("section", ""), {className:"gm-sales"})]
    ]);
    selectTab(selected);
  }).catch(() => {
    if (current !== context) return;
    pending = undefined;
    root.replaceChildren(element("p", "נתוני העדכון היומי אינם זמינים כרגע. נסו לרענן."));
  });
}
