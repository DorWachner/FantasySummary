import { escapeHtml, formatNumber, renderTeamAvatar } from "./format.js";

const tableBody = document.getElementById("rows");
const cardsContainer = document.getElementById("cards");
const sortHeaders = [...document.querySelectorAll("th.sortable")];

const SORT_DIGITS = { totalPoints: 0, averagePointsPerGame: 2 };

let teams = [];
let movementsByTeam = {};
let sortKey = "totalPoints";
let isDescending = true;

const renderMovement = (movement) => {
  if (movement === undefined) {
    return `<span class="movement muted">…</span>`;
  }
  if (!movement) {
    return `<span class="movement muted">—</span>`;
  }
  const days = movement.daysAtRank === 1 ? "יום אחד" : `${movement.daysAtRank} ימים`;
  const change =
    movement.change > 0
      ? `<span class="up" title="עלה ${movement.change} מקומות מאתמול">▲${movement.change}</span>`
      : movement.change < 0
        ? `<span class="down" title="ירד ${-movement.change} מקומות מאתמול">▼${-movement.change}</span>`
        : `<span class="same" title="ללא שינוי מאתמול">●</span>`;
  return `<span class="movement">${change}<small title="מספר הימים במקום ה-${movement.rank}">${days} במקום</small></span>`;
};

const getSortedTeams = () => {
  const direction = isDescending ? -1 : 1;
  return [...teams].sort((first, second) => (first[sortKey] - second[sortKey]) * direction);
};

const renderGap = (team, leaderValue) => {
  const gap = leaderValue - team[sortKey];
  return gap === 0 ? "—" : `<span dir="ltr">-${formatNumber(gap, SORT_DIGITS[sortKey])}</span>`;
};

const renderTableRow = (team, index, leaderValue) => `
  <tr class="${team[sortKey] === leaderValue ? "leader" : ""}" data-team-id="${team.teamId}" tabindex="0">
    <td class="rank">${index + 1}</td>
    <td>${renderMovement(movementsByTeam[team.teamId])}</td>
    <td class="photo">${renderTeamAvatar(team)}</td>
    <td class="team-name">${escapeHtml(team.teamName)}</td>
    <td>${escapeHtml(team.managerName)}</td>
    <td class="number">${formatNumber(team.gamesPlayed)}</td>
    <td class="number">${formatNumber(team.totalPoints)}</td>
    <td class="number">${formatNumber(team.averagePointsPerGame, 2)}</td>
    <td class="number muted">${renderGap(team, leaderValue)}</td>
  </tr>`;

const renderCard = (team, index, leaderValue) => `
  <article class="team-card ${team[sortKey] === leaderValue ? "leader" : ""}" data-team-id="${team.teamId}" tabindex="0">
    <header>
      <span class="rank">${index + 1}</span>
      ${renderTeamAvatar(team)}
      <div class="titles">
        <strong>${escapeHtml(team.teamName)}</strong>
        <span class="muted">${escapeHtml(team.managerName)}</span>
      </div>
      ${renderMovement(movementsByTeam[team.teamId])}
    </header>
    <dl>
      <div><dt>משחקים</dt><dd>${formatNumber(team.gamesPlayed)}</dd></div>
      <div><dt>נקודות</dt><dd>${formatNumber(team.totalPoints)}</dd></div>
      <div><dt>ממוצע</dt><dd>${formatNumber(team.averagePointsPerGame, 2)}</dd></div>
      <div><dt>פער</dt><dd>${renderGap(team, leaderValue)}</dd></div>
    </dl>
  </article>`;

const render = () => {
  const sortedTeams = getSortedTeams();
  const leaderValue = Math.max(...teams.map((team) => team[sortKey]));
  tableBody.innerHTML = sortedTeams.map((team, index) => renderTableRow(team, index, leaderValue)).join("");
  cardsContainer.innerHTML = sortedTeams.map((team, index) => renderCard(team, index, leaderValue)).join("");
  sortHeaders.forEach((header) => {
    const isActive = header.dataset.sort === sortKey;
    header.classList.toggle("active", isActive);
    header.setAttribute("aria-sort", isActive ? (isDescending ? "descending" : "ascending") : "none");
    header.querySelector(".arrow").textContent = isActive ? (isDescending ? "▼" : "▲") : "";
  });
  document.querySelectorAll("[data-sort-button]").forEach((button) => {
    button.classList.toggle("active", button.dataset.sortButton === sortKey);
  });
};

export const renderStatus = (message, isError = false) => {
  const statusHtml = `<span class="status ${isError ? "error" : ""}">${escapeHtml(message)}</span>`;
  tableBody.innerHTML = `<tr><td colspan="9">${statusHtml}</td></tr>`;
  cardsContainer.innerHTML = statusHtml;
};

export const setTeams = (nextTeams) => {
  teams = nextTeams;
  movementsByTeam = {};
  render();
};

export const setMovements = (nextMovements) => {
  movementsByTeam = nextMovements;
  render();
};

const changeSort = (clickedKey) => {
  isDescending = clickedKey === sortKey ? !isDescending : true;
  sortKey = clickedKey;
  render();
};

export const initTable = ({ onTeamSelected }) => {
  sortHeaders.forEach((header) => header.addEventListener("click", () => changeSort(header.dataset.sort)));
  document.querySelectorAll("[data-sort-button]").forEach((button) =>
    button.addEventListener("click", () => changeSort(button.dataset.sortButton))
  );
  const selectTeam = (event) => {
    if (event.target.closest("[data-photo]")) {
      return;
    }
    const teamElement = event.target.closest("[data-team-id]");
    if (teamElement) {
      onTeamSelected(Number(teamElement.dataset.teamId));
    }
  };
  [tableBody, cardsContainer].forEach((container) => {
    container.addEventListener("click", selectTeam);
    container.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        selectTeam(event);
      }
    });
  });
};
