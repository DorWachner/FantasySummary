import { formatNumber } from "./format.js";
import { formatShortDate, getPeriodDate } from "./dates.js";

const SERIES_COUNT = 7;
const canvas = document.getElementById("season-chart");
const chartRoot = document.getElementById("chart-section");
const metricButtons = [...document.querySelectorAll("[data-chart-metric]")];

let chart = null;
let chartData = null;
let metric = "points";

const readCssVariable = (name) => getComputedStyle(chartRoot).getPropertyValue(name).trim();

// Colors follow the team (ordered by ESPN team id), never its rank, so a team keeps its color.
const getTeamColor = (teamIndex) => readCssVariable(`--series-${(teamIndex % SERIES_COUNT) + 1}`);

const buildDatasets = () => {
  const { teams, seasonHistory } = chartData;
  const valuesByTeam = metric === "points" ? seasonHistory.cumulativeByTeam : seasonHistory.rankByTeam;
  return [...teams]
    .sort((first, second) => first.teamId - second.teamId)
    .map((team, teamIndex) => ({
      label: team.teamName,
      data: valuesByTeam[team.teamId].slice(0, seasonHistory.lastGameDay),
      borderColor: getTeamColor(teamIndex),
      backgroundColor: getTeamColor(teamIndex),
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBorderWidth: 2,
      pointHoverBorderColor: readCssVariable("--surface"),
      stepped: metric === "rank" ? "middle" : false,
      tension: 0
    }));
};

const buildOptions = () => {
  const textColor = readCssVariable("--text-secondary");
  const gridColor = readCssVariable("--grid");
  const isRank = metric === "rank";
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "bottom",
        rtl: true,
        labels: { color: textColor, usePointStyle: true, pointStyle: "line", boxWidth: 24, padding: 14 }
      },
      tooltip: {
        rtl: true,
        textDirection: "rtl",
        itemSort: (first, second) => (isRank ? first.parsed.y - second.parsed.y : second.parsed.y - first.parsed.y),
        callbacks: {
          label: (item) => ` ${item.dataset.label}: ${isRank ? `מקום ${item.parsed.y}` : formatNumber(item.parsed.y)}`
        }
      }
    },
    scales: {
      x: {
        reverse: true,
        ticks: { color: textColor, maxRotation: 0, autoSkipPadding: 16 },
        grid: { display: false },
        border: { color: gridColor }
      },
      y: {
        position: "right",
        reverse: isRank,
        min: isRank ? 1 : undefined,
        max: isRank ? chartData.teams.length : undefined,
        ticks: { color: textColor, stepSize: isRank ? 1 : undefined, callback: (value) => formatNumber(value) },
        grid: { color: gridColor },
        border: { display: false }
      }
    }
  };
};

const render = () => {
  if (!chartData) {
    return;
  }
  if (!window.Chart) {
    chartRoot.querySelector(".chart-status").textContent = "לא הצלחנו לטעון את ספריית הגרפים.";
    return;
  }
  chartRoot.querySelector(".chart-status").textContent = "";
  const { seasonHistory, latestPeriod } = chartData;
  const labels = seasonHistory.periods
    .slice(0, seasonHistory.lastGameDay)
    .map((periodId) => formatShortDate(getPeriodDate(periodId, latestPeriod)));
  chart?.destroy();
  chart = new window.Chart(canvas, {
    type: "line",
    data: { labels, datasets: buildDatasets() },
    options: buildOptions()
  });
  metricButtons.forEach((button) => button.classList.toggle("active", button.dataset.chartMetric === metric));
};

export const setChartData = (nextChartData) => {
  chartData = nextChartData;
  render();
};

export const renderChartStatus = (message) => {
  chartRoot.querySelector(".chart-status").textContent = message;
};

export const initChart = () => {
  metricButtons.forEach((button) =>
    button.addEventListener("click", () => {
      metric = button.dataset.chartMetric;
      render();
    })
  );
  // The palette has separate light and dark steps, so redraw when the theme flips.
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
};
