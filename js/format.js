import { TEAMS_WITH_PHOTOS } from "./config.js";

export const escapeHtml = (text) => {
  const element = document.createElement("span");
  element.textContent = String(text);
  return element.innerHTML;
};

export const formatNumber = (value, digits = 0) =>
  new Intl.NumberFormat("he-IL", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

// ESPN's custom-upload logos need a logged-in user, so only its public vector logos are used.
const isPublicEspnLogo = (url) => typeof url === "string" && url.startsWith("https://g.espncdn.com/");

// A team photo opens full size on click; otherwise the ESPN logo, otherwise the first letter.
export const renderTeamAvatar = (team, size = "regular") => {
  const name = escapeHtml(team.teamName);
  const sizeClass = size === "small" ? "avatar small" : "avatar";
  if (TEAMS_WITH_PHOTOS.has(team.teamId)) {
    return `<button type="button" class="avatar-button" data-photo="photos/${team.teamId}-full.jpg" data-caption="${name}">` +
      `<img class="${sizeClass}" src="photos/${team.teamId}.jpg" alt="${name}" loading="lazy"></button>`;
  }
  if (isPublicEspnLogo(team.espnLogoUrl)) {
    return `<img class="${sizeClass}" src="${escapeHtml(team.espnLogoUrl)}" alt="${name}" loading="lazy">`;
  }
  return `<span class="${sizeClass} avatar-initial">${escapeHtml(team.teamName.charAt(0).toUpperCase())}</span>`;
};
