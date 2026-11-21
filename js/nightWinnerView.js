import { TEAMS_WITH_PHOTOS } from "./config.js";
import { fetchPeriodScores } from "./espnApi.js?v=night-1";
import { formatShortDate, getPeriodDate } from "./dates.js";
import { isSoundOn, playDrumroll, setSoundOn, stopDrumroll } from "./drumroll.js";

const INTRO_MS = 2800;
// Long enough to read the full night table below the winners.
const WINNERS_SHOWN_MS = 14000;
const SEEN_PERIOD_KEY = "nightWinnerSeenPeriod";
const root = document.getElementById("night-content");
const replayButton = document.getElementById("night-replay");
const tableButton = document.getElementById("night-to-table");
const soundButton = document.getElementById("night-sound");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const number = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 });
const averageNumber = new Intl.NumberFormat("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let context;
let scores;
let introTimer;
let returnTimer;
let isReturningToTable = false;
let sortBy = "points";

function readSeenPeriod() {
  try { return localStorage.getItem(SEEN_PERIOD_KEY); } catch { return null; }
}

function saveSeenPeriod(period) {
  try { localStorage.setItem(SEEN_PERIOD_KEY, String(period)); } catch { /* storage blocked: the intro shows again next visit */ }
}

// The first visit after a new night on this device opens the night winners, then moves on to the table.
export function shouldOpenNightFirst(period) {
  return readSeenPeriod() !== String(period);
}

export function openNightFirst() {
  isReturningToTable = true;
  tableButton.hidden = false;
}

function stopReturning() {
  isReturningToTable = false;
  clearTimeout(returnTimer);
  tableButton.hidden = true;
}

function goToTable() {
  const isOnNight = location.hash === "#night";
  stopReturning();
  if (isOnNight) location.replace("#table");
}

tableButton.addEventListener("click", goToTable);
window.addEventListener("hashchange", () => {
  if (location.hash !== "#night") {
    stopReturning();
    stopDrumroll();
  }
});

function showSoundState() {
  const on = isSoundOn();
  soundButton.textContent = on ? "🔊 צליל" : "🔇 ללא צליל";
  soundButton.setAttribute("aria-pressed", String(on));
}

soundButton.addEventListener("click", () => {
  setSoundOn(!isSoundOn());
  showSoundState();
});
showSoundState();

function element(tag, text = "", className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function teamPhoto(team) {
  const url = TEAMS_WITH_PHOTOS.has(team.teamId) ? "photos/" + team.teamId + ".jpg" : team.espnLogoUrl;
  const photo = element("img", "", "night-photo");
  photo.alt = "";
  if (url) photo.src = url;
  return photo;
}

function winnerCard(title, score, highlight, detail) {
  const team = context.teams.get(score.teamId);
  const card = element("article", "", "night-winner");
  card.append(element("p", title, "night-award"), teamPhoto(team));
  const name = element("h3", team?.teamName ?? "");
  name.dir = "auto";
  const manager = element("p", team?.managerName ?? "", "night-manager");
  manager.dir = "auto";
  const stat = element("p", "", "night-stat");
  stat.append(element("strong", highlight.value), element("span", highlight.label));
  card.append(name, manager, stat, element("p", detail, "night-detail"));
  return card;
}

const average = (score) => score.games > 0 ? score.points / score.games : null;

function compareScores(a, b) {
  if (sortBy === "average") {
    // Teams without games have no average and go last.
    const gap = (average(b) ?? -Infinity) - (average(a) ?? -Infinity);
    if (gap) return gap;
    return b.points - a.points;
  }
  return b.points - a.points || (average(b) ?? -Infinity) - (average(a) ?? -Infinity);
}

function numberCell(label, text, active) {
  const td = element("td", "", "sales-number night-number" + (active ? " active" : ""));
  td.dataset.label = label;
  td.append(element("span", text));
  return td;
}

function renderBoard(board) {
  const date = formatShortDate(getPeriodDate(context.period, context.latestPeriod));
  const header = element("header", "", "sales-board-header");
  const toggle = element("div", "", "segmented");
  toggle.setAttribute("role", "group");
  toggle.setAttribute("aria-label", "מיון טבלת הלילה");
  for (const [key, label] of [["points", "לפי נקודות"], ["average", "לפי ממוצע"]]) {
    const button = element("button", label, key === sortBy ? "active" : "");
    button.type = "button";
    button.setAttribute("aria-pressed", String(key === sortBy));
    button.addEventListener("click", () => {
      sortBy = key;
      renderBoard(board);
    });
    toggle.append(button);
  }
  header.append(element("h3", "טבלת הלילה · " + date), toggle);
  const table = element("table", "", "sales-table night-table");
  const headRow = element("tr");
  const columns = [["מקום"], ["קבוצה"], ["משחקים"], ["נקודות", "points"], ["ממוצע", "average"]];
  for (const [label, key] of columns) {
    const th = element("th");
    th.scope = "col";
    if (key) {
      const isActive = key === sortBy;
      th.className = "sales-number sortable" + (isActive ? " active" : "");
      th.setAttribute("aria-sort", isActive ? "descending" : "none");
      const button = element("button", label);
      button.type = "button";
      button.addEventListener("click", () => {
        sortBy = key;
        renderBoard(board);
      });
      th.append(button);
    } else {
      if (label === "משחקים") th.className = "sales-number";
      th.textContent = label;
    }
    headRow.append(th);
  }
  const thead = element("thead");
  thead.append(headRow);
  const tbody = element("tbody");
  for (const [index, score] of [...scores].sort(compareScores).entries()) {
    const team = context.teams.get(score.teamId);
    const tr = element("tr");
    const standing = element("td", "", "sales-standing");
    standing.dataset.label = "מקום";
    standing.append(element("span", String(index + 1), "sales-rank"));
    const teamCell = element("td", "", "night-team-cell");
    teamCell.dataset.label = "קבוצה";
    const photo = teamPhoto(team);
    photo.className = "night-row-photo";
    const names = element("div", "", "night-team-names");
    const name = element("strong", team?.teamName ?? "");
    name.dir = "auto";
    name.dataset.rank = String(index + 1);
    const manager = element("span", team?.managerName ?? "");
    manager.dir = "auto";
    names.append(name, manager);
    teamCell.append(photo, names);
    const avg = average(score);
    tr.append(standing, teamCell,
      numberCell("משחקים", String(score.games), false),
      numberCell("נקודות", number.format(score.points), sortBy === "points"),
      numberCell("ממוצע", avg == null ? "—" : averageNumber.format(avg), sortBy === "average"));
    tbody.append(tr);
  }
  table.append(thead, tbody);
  const scroll = element("div", "", "sales-table-wrap");
  scroll.append(table);
  board.replaceChildren(header, scroll);
}

function renderWinners() {
  const played = scores.filter((score) => score.games > 0);
  if (!played.length) {
    root.replaceChildren(element("p", "לא היו משחקים בלילה האחרון.", "status"));
    return;
  }
  const byAverage = [...played].sort((a, b) => b.points / b.games - a.points / a.games);
  const byPoints = [...played].sort((a, b) => b.points - a.points);
  const top = byAverage[0];
  const most = byPoints[0];
  const date = formatShortDate(getPeriodDate(context.period, context.latestPeriod));
  const title = top.teamId === most.teamId ? "הכוכב של הלילה" : "הכוכבים של הלילה";
  const stage = element("div", "", "night-stage");
  const intro = element("div", "", "night-intro");
  intro.setAttribute("aria-hidden", "true");
  intro.append(element("span", "★", "night-star"), element("p", title, "night-title"), element("p", date, "night-date"));
  const winners = element("div", "", "night-winners");
  winners.setAttribute("aria-label", title + " · " + date);
  winners.append(
    winnerCard("הממוצע הגבוה ביותר", top,
      { value: averageNumber.format(top.points / top.games), label: "ממוצע למשחק" },
      number.format(top.points) + " נקודות ב-" + top.games + " משחקים"),
    winnerCard("הכי הרבה נקודות", most,
      { value: number.format(most.points), label: "נקודות" },
      most.games + " משחקים · ממוצע " + averageNumber.format(most.points / most.games)));
  stage.append(intro, winners);
  const board = element("section", "", "card sales-board night-board");
  // Reading or sorting the table keeps the page here instead of moving on to the main table.
  board.addEventListener("pointerdown", () => clearTimeout(returnTimer));
  board.addEventListener("focusin", () => clearTimeout(returnTimer));
  renderBoard(board);
  root.replaceChildren(stage, board);
  saveSeenPeriod(context.period);
  play(stage);
}

function play(stage) {
  clearTimeout(introTimer);
  clearTimeout(returnTimer);
  stopDrumroll();
  const board = root.querySelector(".night-board");
  stage.classList.remove("revealed", "playing");
  board?.classList.remove("shown");
  if (reducedMotion.matches) {
    stage.classList.add("revealed");
    board?.classList.add("shown");
    if (isReturningToTable) returnTimer = setTimeout(goToTable, WINNERS_SHOWN_MS);
    return;
  }
  // Restart the CSS animations from their first frame.
  void stage.offsetWidth;
  stage.classList.add("playing");
  playDrumroll(INTRO_MS / 1000);
  introTimer = setTimeout(() => {
    stage.classList.add("revealed");
    board?.classList.add("shown");
  }, INTRO_MS);
  if (isReturningToTable) returnTimer = setTimeout(goToTable, INTRO_MS + WINNERS_SHOWN_MS);
}

replayButton.addEventListener("click", () => {
  const stage = root.querySelector(".night-stage");
  if (stage) play(stage);
});

export function setNightContext(value) {
  context = value;
  scores = undefined;
  root.replaceChildren(element("p", "טוען את הלילה האחרון…", "status"));
}

export function showNightWinner() {
  if (!context) return;
  if (scores) {
    renderWinners();
    return;
  }
  const current = context;
  fetchPeriodScores(current.seasonId, current.period)
    .then((result) => {
      if (current !== context) return;
      scores = result;
      if (!document.getElementById("view-night").hidden) renderWinners();
    })
    .catch(() => {
      if (current !== context) return;
      if (isReturningToTable) {
        goToTable();
        return;
      }
      root.replaceChildren(element("p", "לא הצלחנו לטעון את הלילה האחרון מ-ESPN. נסו לרענן.", "status"));
    });
}
