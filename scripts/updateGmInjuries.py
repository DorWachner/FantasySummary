"""Build the local GM injury history from NBA final games and nightly injury reports. Requires pymupdf."""
import io
import json
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

import pymupdf

DATA = Path(__file__).resolve().parents[1] / "data"


def download(url):
    fetch_js = """const r = await fetch(process.argv[1], {headers: {
      'User-Agent': 'Mozilla/5.0', Referer: 'https://www.nba.com/'}, signal: AbortSignal.timeout(30000)});
      if (!r.ok) throw Error('NBA ' + r.status); process.stdout.write(Buffer.from(await r.arrayBuffer()));"""
    return subprocess.check_output(["node", "--input-type=module", "-e", fetch_js, url])


def injury_names(day, final_matchups):
    url = f"https://ak-static.cms.nba.com/referee/injury/Injury-Report_{day}_11_30PM.pdf"
    names = set()
    with pymupdf.open(stream=io.BytesIO(download(url)), filetype="pdf") as pdf:
        # Page headers and footers must not interrupt a row that spans pages.
        lines = [line.strip() for page in pdf for line in page.get_text().splitlines()
                 if not line.startswith(("Injury Report:", "Page "))]
    game_date = matchup = None
    saw_date = False
    for i, line in enumerate(lines):
        if re.fullmatch(r"\d{2}/\d{2}/\d{4}", line):
            game_date = line
            saw_date |= game_date == day.strftime("%m/%d/%Y")
            matchup = None
        elif re.fullmatch(r"[A-Z]{2,3}@[A-Z]{2,3}", line):
            matchup = line
        elif (game_date == day.strftime("%m/%d/%Y") and matchup in final_matchups
              and line == "Out" and i > 0 and i+1 < len(lines)
              and lines[i+1].startswith("Injury/Illness") and ", " in lines[i-1]):
            last, first = lines[i-1].split(", ", 1)
            names.add(f"{first} {last}")
    if not saw_date:
        raise ValueError(f"Missing report date {day}")
    return sorted(names)


def main():
    schedule = json.loads(download("https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json"))["leagueSchedule"]
    season = int(schedule["seasonYear"][:4]) + 1
    games = [g for d in schedule["gameDates"] for g in d["games"] if g["gameId"].startswith("002")]
    start = min(date.fromisoformat(g["gameDateEst"][:10]) for g in games)
    finals = {}
    for game in games:
        if game["gameStatus"] == 3:
            day = date.fromisoformat(game["gameDateEst"][:10])
            finals.setdefault(day, set()).add(game["awayTeam"]["teamTricode"] + "@" + game["homeTeam"]["teamTricode"])
    path = DATA / f"gm-injuries-{season}.json"
    history = json.loads(path.read_text(encoding="utf8")) if path.exists() else {}
    def collect(day):
        period = str((day - start).days + 1)
        try:
            return period, injury_names(day, finals[day]) if day in finals else []
        except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
            print(f"{day}: {error}", flush=True)
            return period, None
    latest = max(finals)
    days = [start + timedelta(days=i) for i in range((latest-start).days+1)
            if str(i+1) not in history or start + timedelta(days=i) >= latest - timedelta(days=1)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        for period, names in pool.map(collect, days):
            if names is not None:
                history[period] = names
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(history, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    temp.replace(path)
    print(f"{len(history)} periods with confirmed coverage")


if __name__ == "__main__":
    main()
