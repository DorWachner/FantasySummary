import { getLeagueUrl } from "./config.js";

function nameKey(name) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function loadGmSales({seasonId, period, teams}) {
  const response = await fetch("./data/projections-" + seasonId + ".json");
  if (!response.ok) throw Error("Missing projections");
  const {averages} = await response.json();
  const reportResponse = await fetch("./data/gm-injuries-" + seasonId + ".json", {cache:"no-cache"}).catch(() => null);
  const reports = reportResponse?.ok ? await reportResponse.json() : {};
  const uncovered = [];
  const rankings = new Map([...teams.keys()].map(id => [id, {team:teams.get(id), players:new Map(), missing:new Set()}]));
  const drops = new Map();
  // Read historical rosters in small batches rather than attributing old games to today's owner.
  for (let start = 1; start <= period; start += 4) {
    const days = Array.from({length: Math.min(4, period - start + 1)}, (_, i) => start + i);
    await Promise.all(days.map(async day => {
      const url = getLeagueUrl(seasonId, ["mRoster","mTransactions2"], {scoringPeriodId:day});
      const res = await fetch(url);
      if (!res.ok) throw Error("ESPN " + res.status);
      const data = await res.json();
      if (!Array.isArray(reports[day])) uncovered.push(day);
      const injured = new Set((reports[day] ?? []).map(nameKey));
      if (data.scoringPeriodId !== day || data.seasonId !== seasonId || data.teams?.length !== teams.size)
        throw Error("Incomplete roster history");
      for (const t of data.teams) {
        const gm = rankings.get(t.id);
        for (const e of t.roster.entries) {
          const p = e.playerPoolEntry.player;
          const game = p.stats?.find(s => s.seasonId === seasonId && s.statSourceId === 0 &&
            s.statSplitTypeId === 5 && s.scoringPeriodId === day && s.stats?.[42] > 0);
          const missed = !game && injured.has(nameKey(p.fullName));
          if (!game && !missed) continue;
          if (game && !Number.isFinite(game.appliedTotal)) throw Error("Missing game points");
          if (!Number.isFinite(averages[p.id])) { gm.missing.add(p.id); continue; }
          const row = gm.players.get(p.id) ?? {id:p.id, name:p.fullName, games:0, missed:0, points:0, projection:averages[p.id]};
          if (missed) row.missed++;
          else {
            row.games++;
            row.points += game.appliedTotal;
          }
          gm.players.set(p.id, row);
        }
      }
      for (const tx of data.transactions ?? []) {
        if (tx.status !== "EXECUTED" || tx.scoringPeriodId < 1 || tx.scoringPeriodId > period) continue;
        for (const item of tx.items ?? []) {
          if (item.type !== "DROP") continue;
          const key = item.fromTeamId + "/" + item.playerId;
          drops.set(key, Math.max(drops.get(key) ?? 0, tx.scoringPeriodId));
        }
      }
    }));
  }
  return {rankings, drops, uncovered};
}

export function rankGms({rankings, drops}, includeInjuries) {
  return [...rankings].map(([id, gm]) => {
    const contributions = [...gm.players.values()].map(p => ({...p,
      expected:p.projection * (p.games + (includeInjuries ? p.missed : 0)),
      dropped:drops.get(id + "/" + p.id)
    })).map(p => ({...p, gap:Math.max(0, p.expected - p.points)}));
    // The table displays one decimal place. Keep the manager total at full precision.
    const players = contributions.filter(p => p.gap >= 0.05)
      .sort((a,b) => b.gap - a.gap || a.id - b.id);
    return {team:gm.team, players, missing:gm.missing.size, total:contributions.reduce((sum,p) => sum + p.gap, 0)};
  }).sort((a,b) => b.total - a.total || a.team.teamId - b.team.teamId);
}
