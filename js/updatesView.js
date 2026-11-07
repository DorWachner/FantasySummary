import { getPlayerHeadshotUrl } from "./config.js";
import { fetchFreeAgentCards, fetchRosteredPlayerCards } from "./espnApi.js";
import { escapeHtml, formatNumber, renderTeamAvatar } from "./format.js";
import { formatShortDate, getPeriodDate } from "./dates.js";
import { getColdPlayers, getHotPlayers, getInjuredPlayers } from "./players.js";

const panel = document.getElementById("updates-content");
const tabButtons = [...document.querySelectorAll("[data-updates-tab]")];

let context = null;
let dataPromise = null;
let activeTab = "hot";
let isReturnAscending = true;

const renderPlayerCell = (row) => `
  <td class="player">
    <img class="headshot" src="${getPlayerHeadshotUrl(row.playerId)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
    <span>${escapeHtml(row.name)}${row.injuryLabel && row.lastGames ? ` <span class="badge">${escapeHtml(row.injuryLabel)}</span>` : ""}<small class="muted">${row.position} · ${row.proTeam}</small></span>
  </td>`;

const renderFantasyTeamCell = (row) => {
  const team = context.teamsById.get(row.fantasyTeamId);
  return team
    ? `<td class="fantasy-team">${renderTeamAvatar(team, "small")}<span>${escapeHtml(team.teamName)}</span></td>`
    : `<td class="muted">—</td>`;
};

const renderLastGames = (row) =>
  row.lastGames
    .map((game) => {
      const date = formatShortDate(getPeriodDate(game.periodId, context.latestPeriod));
      return `<span class="game" title="${date}">${formatNumber(game.points)}</span>`;
    })
    .join("");

const renderFormTable = (rows, { showFantasyTeam }) => `
  <div class="table-scroll">
    <table class="players-table">
      <thead>
        <tr>
          <th>#</th><th>שחקן</th>${showFantasyTeam ? "<th>קבוצה בליגה</th>" : ""}
          <th>ממוצע 3 משחקים</th><th>3 המשחקים האחרונים</th><th>משחק אחרון</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row, index) => `
          <tr>
            <td class="rank">${index + 1}</td>
            ${renderPlayerCell(row)}
            ${showFantasyTeam ? renderFantasyTeamCell(row) : ""}
            <td class="number strong">${formatNumber(row.averagePoints, 1)}</td>
            <td class="games">${renderLastGames(row)}</td>
            <td class="muted">${formatShortDate(getPeriodDate(row.lastGames[0].periodId, context.latestPeriod))}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </div>`;

const compareReturnDates = (first, second) => {
  if (!first.returnDate || !second.returnDate) {
    return (first.returnDate ? 0 : 1) - (second.returnDate ? 0 : 1);
  }
  const difference = first.returnDate - second.returnDate;
  return isReturnAscending ? difference : -difference;
};

const renderReturnDate = (row) => {
  if (row.isOutForSeason) {
    return `<span class="badge">לכל העונה</span>`;
  }
  return row.returnDate ? formatShortDate(row.returnDate) : `<span class="muted">לא ידוע</span>`;
};

const renderInjuriesTable = (rows) => `
  <div class="table-scroll">
    <table class="players-table">
      <thead>
        <tr>
          <th>שחקן</th><th>קבוצה בליגה</th><th>סטטוס</th><th>פציעה</th>
          <th class="sortable active" id="return-date-header" aria-sort="${isReturnAscending ? "ascending" : "descending"}">
            תאריך חזרה <span class="arrow">${isReturnAscending ? "▲" : "▼"}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        ${[...rows]
          .sort(compareReturnDates)
          .map(
            (row) => `
          <tr>
            ${renderPlayerCell(row)}
            ${renderFantasyTeamCell(row)}
            <td><span class="badge">${escapeHtml(row.status)}</span></td>
            <td>${escapeHtml(row.injuryType)}</td>
            <td>${renderReturnDate(row)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </div>
  <p class="hint">תאריך החזרה הוא ההערכה של ESPN. לחיצה על "תאריך חזרה" הופכת את סדר המיון.</p>`;

const DESCRIPTIONS = {
  hot: "20 השחקנים החופשיים עם הממוצע הגבוה ביותר ב-3 המשחקים האחרונים שלהם העונה.",
  cold: "20 השחקנים בסגלים של הליגה עם הממוצע הנמוך ביותר ב-3 המשחקים האחרונים שלהם העונה.",
  injuries: "כל השחקנים הפצועים בסגלים של הליגה."
};

const renderEmpty = (message) => `<p class="status">${escapeHtml(message)}</p>`;

const renderActiveTab = (data) => {
  const intro = `<p class="hint intro">${DESCRIPTIONS[activeTab]}</p>`;
  if (activeTab === "hot") {
    panel.innerHTML = intro + (data.hot.length ? renderFormTable(data.hot, { showFantasyTeam: false }) : renderEmpty("אין עדיין שחקנים חופשיים עם 3 משחקים העונה."));
    return;
  }
  if (activeTab === "cold") {
    panel.innerHTML = intro + (data.cold.length ? renderFormTable(data.cold, { showFantasyTeam: true }) : renderEmpty("אין עדיין שחקנים עם 3 משחקים העונה."));
    return;
  }
  panel.innerHTML = intro + (data.injuries.length ? renderInjuriesTable(data.injuries) : renderEmpty("אין כרגע פצועים בסגלים. 🎉"));
  document.getElementById("return-date-header")?.addEventListener("click", () => {
    isReturnAscending = !isReturnAscending;
    renderActiveTab(data);
  });
};

const loadData = () => {
  const { seasonId } = context;
  return Promise.all([fetchFreeAgentCards(seasonId), fetchRosteredPlayerCards(seasonId)]).then(([freeAgents, rostered]) => ({
    hot: getHotPlayers(freeAgents, seasonId),
    cold: getColdPlayers(rostered, seasonId),
    injuries: getInjuredPlayers(rostered)
  }));
};

const render = () => {
  tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.updatesTab === activeTab));
  if (!context) {
    panel.innerHTML = renderEmpty("טוען...");
    return;
  }
  panel.innerHTML = renderEmpty("טוען נתוני שחקנים מ-ESPN...");
  dataPromise ??= loadData();
  dataPromise.then(renderActiveTab).catch((error) => {
    dataPromise = null;
    panel.innerHTML = `<p class="status error">לא הצלחנו לטעון את נתוני השחקנים (${escapeHtml(error.message)}).</p>`;
  });
};

// Called after every league load; player data reloads the next time the view is shown.
export const setUpdatesContext = (nextContext) => {
  context = nextContext;
  dataPromise = null;
};

export const showUpdates = render;

export const initUpdates = () => {
  tabButtons.forEach((button) =>
    button.addEventListener("click", () => {
      activeTab = button.dataset.updatesTab;
      render();
    })
  );
};
