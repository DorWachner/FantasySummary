import { TEAMS_WITH_PHOTOS } from "./config.js";
import { fetchPeriodScores } from "./espnApi.js?v=night-1";
import { formatShortDate, getPeriodDate } from "./dates.js";

const INTRO_MS = 2800;
const WINNERS_SHOWN_MS = 7000;
const SEEN_PERIOD_KEY = "nightWinnerSeenPeriod";
const root = document.getElementById("night-content");
const replayButton = document.getElementById("night-replay");
const tableButton = document.getElementById("night-to-table");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const number = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 });
let context;
let scores;
let introTimer;
let returnTimer;
let isReturningToTable = false;

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
  if (location.hash !== "#night") stopReturning();
});

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
      { value: number.format(top.points / top.games), label: "ממוצע למשחק" },
      number.format(top.points) + " נקודות ב-" + top.games + " משחקים"),
    winnerCard("הכי הרבה נקודות", most,
      { value: number.format(most.points), label: "נקודות" },
      most.games + " משחקים · ממוצע " + number.format(most.points / most.games)));
  stage.append(intro, winners);
  root.replaceChildren(stage);
  saveSeenPeriod(context.period);
  play(stage);
}

function play(stage) {
  clearTimeout(introTimer);
  clearTimeout(returnTimer);
  stage.classList.remove("revealed", "playing");
  if (reducedMotion.matches) {
    stage.classList.add("revealed");
    if (isReturningToTable) returnTimer = setTimeout(goToTable, WINNERS_SHOWN_MS);
    return;
  }
  // Restart the CSS animations from their first frame.
  void stage.offsetWidth;
  stage.classList.add("playing");
  introTimer = setTimeout(() => stage.classList.add("revealed"), INTRO_MS);
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
