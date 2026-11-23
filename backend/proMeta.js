// Meta dei tornei professionistici: quanto e con che esito si giocano i campioni nei ruoli, dagli ultimi tornei principali.
// Fonte: Leaguepedia (lol.fandom.com), API Cargo, gratuita. Contenuti con licenza CC BY-SA 3.0: va citata.
const CARGO_URL = 'https://lol.fandom.com/api.php';
const USER_AGENT = 'lol-team-organizer/1.0 (strumento per un team amatoriale; letture rare e in cache)';

// Ruoli di Leaguepedia -> ruoli dell'app
const ROLE_MAP = { Top: 'TOP', Jungle: 'JUNGLE', Mid: 'MID', Bot: 'ADC', Support: 'SUPPORT' };

const DAY_MS = 24 * 60 * 60 * 1000;

// Escape per le stringhe nelle condizioni Cargo
const quote = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const sqlDate = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));

// Punteggio 0-1 di "forza in meta": presenza (65%) e vittorie (35%).
// Un pick rate del 25% vale il massimo; il winrate conta da 8 partite in su (da 40% a 60%), altrimenti è neutro.
function metaScore({ games, wins, total }) {
  const pickRate = total > 0 ? games / total : 0;
  const presence = clamp(pickRate / 0.25);
  const winComponent = games >= 8 ? clamp((wins / games - 0.4) / 0.2) : 0.5;
  return 0.65 * presence + 0.35 * winComponent;
}

// Servizio con cache in memoria (6 ore) e al più 3-4 richieste a Leaguepedia per aggiornamento.
// nameToId: async () => ({ 'Lee Sin': 'LeeSin' }) con i nomi inglesi di Data Dragon.
function createProMetaService({
  fetchFn = fetch,
  nameToId,
  now = () => Date.now(),
  ttlMs = 6 * 60 * 60 * 1000,
  windows = [45, 120],
  minGames = 40,
  retryDelayMs = 1500,
}) {
  let cache = null;
  let loading = null;

  // Una richiesta Cargo con un nuovo tentativo: Fandom risponde 503 a volte, soprattutto alle richieste pesanti
  async function cargo(params) {
    const url = `${CARGO_URL}?${new URLSearchParams({ format: 'json', action: 'cargoquery', ...params })}`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await fetchFn(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json?.cargoquery)) return json.cargoquery.map((x) => x.title);
        }
      } catch {
        // si riprova una volta
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, retryDelayMs));
    }
    return null;
  }

  // Calcola il meta per una finestra di giorni; null se i dati mancano o sono troppo pochi
  async function computeWindow(days) {
    const end = now();
    const from = sqlDate(end - days * DAY_MS);
    const to = sqlDate(end);

    const tournaments = await cargo({
      tables: 'Tournaments=T',
      fields: 'T.OverviewPage,T.Name',
      where: `T.TournamentLevel='Primary' AND T.DateStart <= ${quote(to.slice(0, 10))} AND T.Date >= ${quote(from.slice(0, 10))}`,
      limit: '100',
    });
    if (!tournaments || tournaments.length === 0) return null;

    const where = `SP.DateTime_UTC >= ${quote(from)} AND SP.DateTime_UTC < ${quote(to)} AND SP.OverviewPage IN (${tournaments.map((t) => quote(t.OverviewPage)).join(',')})`;
    const [totalRows, champRows] = await Promise.all([
      cargo({ tables: 'ScoreboardPlayers=SP', fields: 'COUNT(DISTINCT SP.GameId)=Games', where }),
      cargo({
        tables: 'ScoreboardPlayers=SP',
        fields: 'SP.Champion=Champion,SP.Role=Role,COUNT(*)=Games,SUM(SP.PlayerWin="Yes")=Wins',
        where,
        group_by: 'SP.Champion,SP.Role',
        order_by: 'Games DESC',
        limit: '500',
      }),
    ]);
    const total = Number(totalRows?.[0]?.Games ?? 0);
    if (!champRows || total < minGames) return null;

    const ids = await nameToId();
    const champions = {};
    for (const r of champRows) {
      const id = ids[r.Champion];
      const role = ROLE_MAP[r.Role];
      if (!id || !role) continue;
      const games = Number(r.Games);
      const wins = Number(r.Wins);
      (champions[id] ??= {})[role] = {
        games,
        wins,
        pickRate: total > 0 ? games / total : 0,
        winRate: games > 0 ? wins / games : 0,
        score: metaScore({ games, wins, total }),
      };
    }
    return {
      updatedAt: new Date(end).toISOString(),
      windowDays: days,
      games: total,
      tournaments: tournaments.map((t) => t.Name),
      source: 'Leaguepedia',
      sourceUrl: 'https://lol.fandom.com',
      license: 'CC BY-SA 3.0',
      champions,
    };
  }

  async function load() {
    // Se nei 45 giorni c'è poco (pausa tra le stagioni) si allarga la finestra
    for (const days of windows) {
      const result = await computeWindow(days);
      if (result) return result;
    }
    return null;
  }

  // Ritorna il meta, oppure null se non disponibile (nessun errore: l'app funziona anche senza)
  async function getMeta() {
    if (cache && now() - cache.at < ttlMs) return cache.value;
    loading ??= load()
      .then((value) => {
        // Un fallimento si ricorda poco, così si riprova presto
        cache = { at: value ? now() : now() - ttlMs + 10 * 60 * 1000, value };
        return value;
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  }

  return { getMeta };
}

module.exports = { ROLE_MAP, metaScore, createProMetaService };
