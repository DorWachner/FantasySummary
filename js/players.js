import { INJURY_LABELS, POSITION_NAMES, PRO_TEAM_ABBREVIATIONS } from "./config.js";
import { fromEspnDate } from "./dates.js";

const GAMES_FOR_FORM = 3;
const LIST_SIZE = 20;
const PER_GAME_SPLIT_ID = 5;
const ACTUAL_STATS_SOURCE_ID = 0;

const hasPlayed = (stat) => (stat.stats?.["42"] ?? 0) > 0;

// The player's last games this season, newest first.
const getLastGames = (player, seasonId) =>
  (player.stats ?? [])
    .filter(
      (stat) =>
        stat.statSplitTypeId === PER_GAME_SPLIT_ID &&
        stat.statSourceId === ACTUAL_STATS_SOURCE_ID &&
        stat.seasonId === seasonId &&
        hasPlayed(stat)
    )
    .sort((first, second) => second.scoringPeriodId - first.scoringPeriodId)
    .slice(0, GAMES_FOR_FORM)
    .map((stat) => ({ periodId: stat.scoringPeriodId, points: stat.appliedTotal }));

const toPlayerSummary = (playerCard) => ({
  playerId: playerCard.player.id,
  name: playerCard.player.fullName,
  position: POSITION_NAMES[playerCard.player.defaultPositionId] ?? "—",
  proTeam: PRO_TEAM_ABBREVIATIONS[playerCard.player.proTeamId] ?? "—",
  fantasyTeamId: playerCard.onTeamId,
  injuryLabel: INJURY_LABELS[playerCard.player.injuryStatus]
});

// Players with GAMES_FOR_FORM games this season and the average of those games.
const toFormRows = (playerCards, seasonId) =>
  playerCards
    .map((playerCard) => ({ ...toPlayerSummary(playerCard), lastGames: getLastGames(playerCard.player, seasonId) }))
    .filter((row) => row.lastGames.length === GAMES_FOR_FORM)
    .map((row) => ({
      ...row,
      averagePoints: row.lastGames.reduce((total, game) => total + game.points, 0) / GAMES_FOR_FORM
    }));

export const getHotPlayers = (freeAgentCards, seasonId) =>
  toFormRows(freeAgentCards, seasonId)
    .sort((first, second) => second.averagePoints - first.averagePoints)
    .slice(0, LIST_SIZE);

export const getColdPlayers = (rosteredCards, seasonId) =>
  toFormRows(rosteredCards, seasonId)
    .sort((first, second) => first.averagePoints - second.averagePoints)
    .slice(0, LIST_SIZE);

const INJURY_TYPE_NAMES = {
  Knee: "ברך", Ankle: "קרסול", Hamstring: "המסטרינג", Back: "גב", Foot: "כף רגל", Calf: "שוק", Groin: "מפשעה",
  Shoulder: "כתף", Wrist: "שורש כף היד", Hip: "ירך", Illness: "מחלה", Concussion: "זעזוע מוח", Achilles: "אכילס",
  Hand: "יד", Finger: "אצבע", Thumb: "אגודל", Elbow: "מרפק", Toe: "בוהן", Rest: "מנוחה", Quadriceps: "ארבע ראשי",
  Neck: "צוואר", Abdomen: "בטן", Rib: "צלעות", Leg: "רגל", Face: "פנים", Eye: "עין", Personal: "סיבה אישית"
};

export const getInjuredPlayers = (rosteredCards) =>
  rosteredCards
    .filter((playerCard) => playerCard.player.injured || (playerCard.player.injuryStatus ?? "ACTIVE") !== "ACTIVE")
    .map((playerCard) => {
      const details = playerCard.player.injuryDetails ?? {};
      return {
        ...toPlayerSummary(playerCard),
        status: INJURY_LABELS[playerCard.player.injuryStatus] ?? playerCard.player.injuryStatus ?? "—",
        injuryType: INJURY_TYPE_NAMES[details.type] ?? details.type ?? "—",
        isOutForSeason: !!details.outForSeason,
        returnDate: fromEspnDate(details.expectedReturnDate)
      };
    });
