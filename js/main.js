import { ESPN_STANDINGS_URL, getCurrentSeasonId } from "./config.js";
import { fetchLeague, getLatestPeriod } from "./espnApi.js";
import { loadPeriodPoints } from "./history.js";
import { buildSeasonHistory, getRankMovement, toTeamSummaries } from "./standings.js";
import { initTable, renderStatus, setMovements, setTeams } from "./tableView.js";
import { initChart, renderChartStatus, setChartData } from "./chartView.js";
import { initRoster, openRoster, resetRosters } from "./rosterView.js";
import { initUpdates, setUpdatesContext, showUpdates } from "./updatesView.js";

const VIEWS = ["table", "updates"];
const refreshButton = document.getElementById("refresh");
const updatedAtElement = document.getElementById("updated-at");
const lightbox = document.getElementById("lightbox");

let teams = [];
let seasonId = getCurrentSeasonId();

const showView = () => {
  const requestedView = location.hash.replace("#", "");
  const view = VIEWS.includes(requestedView) ? requestedView : "table";
  VIEWS.forEach((name) => {
    document.getElementById(`view-${name}`).hidden = name !== view;
    document.querySelector(`[data-nav="${name}"]`).classList.toggle("active", name === view);
  });
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
      teams = toTeamSummaries(league);
      const leagueName = league.settings?.name ?? "Fantasy Summary";
      document.getElementById("league-name").textContent = leagueName;
      document.title = `Fantasy Summary · ${leagueName}`;
      updatedAtElement.textContent =
        "עודכן: " + new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
      setTeams(teams);
      const latestPeriod = getLatestPeriod(league);
      setUpdatesContext({ seasonId, latestPeriod, teamsById: new Map(teams.map((team) => [team.teamId, team])) });
      showView();
      return loadHistory(latestPeriod);
    })
    .catch((error) => {
      updatedAtElement.textContent = "הטעינה נכשלה";
      renderStatus(`לא הצלחנו לטעון את הנתונים מ-ESPN (${error.message}). נסו לרענן.`, true);
    })
    .finally(() => {
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
