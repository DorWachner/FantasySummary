import { BENCH_SLOT_ID, INJURED_RESERVE_SLOT_ID, INJURY_LABELS, POSITION_NAMES, PRO_TEAM_ABBREVIATIONS, getPlayerHeadshotUrl } from "./config.js";
import { fetchRosters } from "./espnApi.js";
import { escapeHtml, formatNumber, renderTeamAvatar } from "./format.js";

const SEASON_SPLIT_ID = 0;
const LAST_7_DAYS_SPLIT_ID = 1;
const ACTUAL_STATS_SOURCE_ID = 0;
const LINEUP_ORDER = { starter: 0, bench: 1, injuredReserve: 2 };
const LINEUP_LABELS = { starter: "פותח", bench: "ספסל", injuredReserve: "פצוע (IR)" };

const dialog = document.getElementById("roster-dialog");
const dialogHeader = document.getElementById("roster-header");
const dialogBody = document.getElementById("roster-body");

let rostersPromise = null;

const getLineupGroup = (slotId) =>
  slotId === INJURED_RESERVE_SLOT_ID ? "injuredReserve" : slotId === BENCH_SLOT_ID ? "bench" : "starter";

const findStat = (player, seasonId, splitId) =>
  (player.stats ?? []).find(
    (stat) => stat.seasonId === seasonId && stat.statSourceId === ACTUAL_STATS_SOURCE_ID && stat.statSplitTypeId === splitId
  );

const toRosterRow = (entry, seasonId) => {
  const player = entry.playerPoolEntry.player;
  const seasonStat = findStat(player, seasonId, SEASON_SPLIT_ID);
  const lastWeekStat = findStat(player, seasonId, LAST_7_DAYS_SPLIT_ID);
  return {
    playerId: player.id,
    name: player.fullName,
    position: POSITION_NAMES[player.defaultPositionId] ?? "—",
    proTeam: PRO_TEAM_ABBREVIATIONS[player.proTeamId] ?? "—",
    injury: INJURY_LABELS[player.injuryStatus],
    lineupGroup: getLineupGroup(entry.lineupSlotId),
    gamesPlayed: seasonStat?.stats?.["42"] ?? 0,
    totalPoints: seasonStat?.appliedTotal ?? 0,
    averagePoints: seasonStat?.appliedAverage ?? 0,
    lastWeekAverage: lastWeekStat?.appliedAverage
  };
};

const renderRows = (rows) =>
  rows
    .map(
      (row) => `
      <tr class="${row.lineupGroup}">
        <td class="player">
          <img class="headshot" src="${getPlayerHeadshotUrl(row.playerId)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
          <span>${escapeHtml(row.name)}${row.injury ? ` <span class="badge">${escapeHtml(row.injury)}</span>` : ""}</span>
        </td>
        <td>${row.position}</td>
        <td>${row.proTeam}</td>
        <td class="muted">${LINEUP_LABELS[row.lineupGroup]}</td>
        <td class="number">${formatNumber(row.gamesPlayed)}</td>
        <td class="number">${formatNumber(row.totalPoints)}</td>
        <td class="number">${formatNumber(row.averagePoints, 1)}</td>
        <td class="number">${row.lastWeekAverage === undefined ? "—" : formatNumber(row.lastWeekAverage, 1)}</td>
      </tr>`
    )
    .join("");

const renderRoster = (league, team) => {
  const rosterTeam = league.teams.find((candidate) => candidate.id === team.teamId);
  const rows = (rosterTeam?.roster?.entries ?? [])
    .map((entry) => toRosterRow(entry, league.seasonId))
    .sort(
      (first, second) =>
        LINEUP_ORDER[first.lineupGroup] - LINEUP_ORDER[second.lineupGroup] || second.totalPoints - first.totalPoints
    );
  dialogBody.innerHTML = `
    <div class="table-scroll">
      <table class="roster-table">
        <thead>
          <tr>
            <th>שחקן</th><th>עמדה</th><th>קבוצה</th><th>הרכב</th>
            <th>משחקים</th><th>נקודות</th><th>ממוצע</th><th>ממוצע 7 ימים</th>
          </tr>
        </thead>
        <tbody>${renderRows(rows)}</tbody>
      </table>
    </div>
    <p class="hint">נקודות וממוצע הם של כל העונה של השחקן, גם אם שיחק בחלק ממנה בקבוצה אחרת.</p>`;
};

export const openRoster = (team, seasonId) => {
  dialogHeader.innerHTML = `${renderTeamAvatar(team)}<div><h2>${escapeHtml(team.teamName)}</h2><span class="muted">${escapeHtml(team.managerName)}</span></div>`;
  dialogBody.innerHTML = `<p class="status">טוען את הסגל...</p>`;
  dialog.showModal();
  rostersPromise ??= fetchRosters(seasonId);
  rostersPromise
    .then((league) => renderRoster(league, team))
    .catch((error) => {
      rostersPromise = null;
      dialogBody.innerHTML = `<p class="status error">לא הצלחנו לטעון את הסגל (${escapeHtml(error.message)}).</p>`;
    });
};

export const resetRosters = () => {
  rostersPromise = null;
};

export const initRoster = () => {
  document.getElementById("roster-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
};
