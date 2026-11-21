import { ESPN_STANDINGS_URL, getCurrentSeasonId } from "./config.js";
import { fetchLeague, getLatestPeriod } from "./espnApi.js?v=night-1";
import { loadPeriodPoints } from "./history.js";
import { buildSeasonHistory, getRankMovement, toTeamSummaries } from "./standings.js";
import { initTable, renderStatus, setMovements, setTeams } from "./tableView.js";
import { initChart, renderChartStatus, setChartData } from "./chartView.js";
import { initRoster, openRoster, resetRosters } from "./rosterView.js";
import { initUpdates, setUpdatesContext, showUpdates } from "./updatesView.js";

import { setSalesContext, showSales } from "./salesView.js?v=rankings-6";
import { openNightFirst, setNightContext, shouldOpenNightFirst, showNightWinner } from "./nightWinnerView.js?v=night-3";
const VIEWS = ["table", "night", "updates", "sales", "kills"];
const refreshButton = document.getElementById("refresh");
const updatedAtElement = document.getElementById("updated-at");
const lightbox = document.getElementById("lightbox");

let teams = [];
let seasonId = getCurrentSeasonId();
// Follow the same 06:30 UTC daily cutoff as the league history workflow.
const salesUpdateDay = () => new Date(Date.now() - 390 * 60000).toISOString().slice(0, 10);
let loadedDay;

const showView = () => {
  const requestedView = location.hash.replace("#", "");
  const view = VIEWS.includes(requestedView) ? requestedView : "table";
  VIEWS.forEach((name) => {
    document.getElementById(`view-${name}`).hidden = name !== view;
    document.querySelector(`[data-nav="${name}"]`).classList.toggle("active", name === view);
  });
  if (view === "sales" || view === "kills") showSales();
  if (view === "night") showNightWinner();
  if (view === "updates") {
    showUpdates();
  }
};

const loadHistory = (latestPeriod) =>
  loadPeriodPoints(seasonId, latestPeriod)
    .then((periodPoints) => {
      const seasonHistory = buildSeasonHistory(periodPoints, teams.map((team) => team.teamId), latestPeriod);
      setMovements(Object.fromEntries(teams.map((team) => [team.teamId, getRankMovement(seasonHistory, team.teamId)])));
      setChartData({ teams, seasonHistory, latestPeriod });
    })
    .catch(() => {
      setMovements(Object.fromEntries(teams.map((team) => [team.teamId, null])));
      renderChartStatus("לא הצלחנו לטעון את היסטוריית העונה מ-ESPN.");
    });

const load = () => {
  refreshButton.disabled = true;
  updatedAtElement.textContent = "טוען...";
  resetRosters();
  return fetchLeague(getCurrentSeasonId())
    .then((league) => {
      seasonId = league.seasonId;
      loadedDay = salesUpdateDay();
      teams = toTeamSummaries(league);
      const leagueName = league.settings?.name ?? "Fantasy Summary";
      document.getElementById("league-name").textContent = leagueName;
      document.title = `Fantasy Summary · ${leagueName}`;
      updatedAtElement.textContent =
        "עודכן: " + new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
      setTeams(teams);
      const latestPeriod = getLatestPeriod(league);
      const lastNight = league.status?.isExpired ? latestPeriod : latestPeriod - 1;
      const teamsById = new Map(teams.map((team) => [team.teamId, team]));
      setSalesContext({ seasonId, latestPeriod, period: lastNight, teams: teamsById });
      setNightContext({ seasonId, latestPeriod, period: lastNight, teams: teamsById });
      const isOnTable = ["", "#table"].includes(location.hash);
      if (isOnTable && shouldOpenNightFirst(lastNight)) {
        openNightFirst();
        history.replaceState(null, "", "#night");
      }
      setUpdatesContext({ seasonId, latestPeriod, teamsById: new Map(teams.map((team) => [team.teamId, team])) });
      showView();
      return loadHistory(latestPeriod);
    })
    .catch((error) => {
      updatedAtElement.textContent = "הטעינה נכשלה";
      renderStatus(`לא הצלחנו לטעון את הנתונים מ-ESPN (${error.message}). נסו לרענן.`, true);
    })
    .finally(() => {
      document.body.classList.remove("is-booting");
      refreshButton.disabled = false;
    });
};

const initLightbox = () => {
  document.addEventListener("click", (event) => {
    const photoButton = event.target.closest("[data-photo]");
    if (!photoButton) {
      return;
    }
    document.getElementById("lightbox-image").src = photoButton.dataset.photo;
    document.getElementById("lightbox-caption").textContent = photoButton.dataset.caption;
    lightbox.showModal();
  });
  lightbox.addEventListener("click", () => lightbox.close());
};

document.getElementById("espn-link").href = ESPN_STANDINGS_URL;
refreshButton.addEventListener("click", load);
window.addEventListener("hashchange", showView);
function refreshSalesDay() {
  if (["#sales", "#kills"].includes(location.hash) && !document.hidden && !refreshButton.disabled && loadedDay !== salesUpdateDay()) load();
}
window.addEventListener("hashchange", refreshSalesDay);
document.addEventListener("visibilitychange", refreshSalesDay);
setInterval(refreshSalesDay, 60000);
setInterval(() => {
  if (!document.hidden && ["#sales", "#kills"].includes(location.hash)) showSales();
}, 5 * 60000);
initTable({
  onTeamSelected: (teamId) => {
    const team = teams.find((candidate) => candidate.teamId === teamId);
    if (team) {
      openRoster(team, seasonId);
    }
  }
});
initChart();
initRoster();
initUpdates();
initLightbox();
showView();
load();
