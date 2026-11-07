// ESPN scoring periods are NBA calendar days, counted in US Eastern time.
const NBA_TIME_ZONE = "America/New_York";
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const getTodayInNbaTime = () => {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: NBA_TIME_ZONE })
    .format(new Date())
    .split("-")
    .map(Number);
  return Date.UTC(year, month - 1, day);
};

// The date of a scoring period, given that latestPeriod is today's.
export const getPeriodDate = (periodId, latestPeriod) =>
  new Date(getTodayInNbaTime() - (latestPeriod - periodId) * DAY_IN_MILLISECONDS);

const shortDateFormat = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", timeZone: "UTC" });

export const formatShortDate = (date) => shortDateFormat.format(date);

// ESPN returns dates as [year, month, day] with a 1-based month.
export const fromEspnDate = (parts) => (Array.isArray(parts) ? new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])) : null);
