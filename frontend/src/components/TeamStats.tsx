import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { apiErrorMessage, getPlayerRiot } from "../lib/api";
import { championIcon } from "../lib/ddragon";
import { TIER_COLORS, formatRank, recentForm, winRate } from "../lib/riot";
import { ROLE_COLORS, ROLE_LABELS, type RiotProfile, type SessionPlayer } from "../types";
import { sectionTitle } from "../lib/styles";
import RiotStatsButton from "./RiotStatsButton";

// Campioni più giocati nel ruolo della sessione, poi quelli in assoluto
function roleChampions(profile: RiotProfile, role: SessionPlayer["role"]) {
  const inRole = profile.roles?.find((r) => r.role === role)?.champions ?? [];
  const picks = inRole.slice(0, 3).map((c) => ({ id: c.championId, games: c.games, inRole: true }));
  for (const c of profile.champions) {
    if (picks.length >= 3) break;
    if (!picks.some((p) => p.id === c.championId)) picks.push({ id: c.championId, games: c.games, inRole: false });
  }
  return picks;
}

function Card({ player, profile, loading, error }: { player: SessionPlayer; profile?: RiotProfile; loading: boolean; error: unknown }) {
  const color = ROLE_COLORS[player.role];
  const solo = profile?.ranks.find((r) => r.queue === "solo") ?? profile?.ranks[0];
  const form = profile ? recentForm(profile.recent) : undefined;

  return (
    <article className="panel space-y-4 p-4" style={{ "--edge-a": `${color}99`, "--edge-b": `${color}22` } as React.CSSProperties}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-bold leading-none">{player.name}</p>
          <p className="mt-1 text-xs font-semibold" style={{ color }}>{ROLE_LABELS[player.role]}</p>
        </div>
        <RiotStatsButton playerId={player.playerId} name={player.name} riotId={player.riotId} region={player.region} />
      </header>

      {!player.riotId || !player.region ? (
        <p className="text-sm text-lol-mist">
          Riot ID non impostato. <Link to="/players" className="text-lol-gold underline-offset-2 hover:underline">Aggiungilo nei Giocatori</Link>
        </p>
      ) : loading ? (
        <div className="space-y-2">
          <div className="skeleton h-5 w-2/3 rounded" />
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-9 w-3/4 rounded" />
        </div>
      ) : error || !profile ? (
        <p className="text-sm text-lol-mist">{apiErrorMessage(error, "Dati Riot non disponibili.")}</p>
      ) : (
        <>
          {solo ? (
            <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium" style={{ color: TIER_COLORS[solo.tier] }}>
              <Trophy size={14} aria-hidden /> {formatRank(solo)} <span className="text-lol-mist">{solo.lp} PL</span>
              <span className="text-xs font-normal text-lol-mist">· {winRate(solo.wins, solo.wins + solo.losses)}% su {solo.wins + solo.losses}</span>
            </p>
          ) : (
            <p className="text-sm text-lol-mist">Senza rank</p>
          )}

          {form && form.games > 0 ? (
            <div className="space-y-1.5">
              <div className="flex gap-1" role="img" aria-label={`${form.wins} vittorie e ${form.losses} sconfitte nelle ultime ${form.games}`}>
                {form.results.map((won, i) => (
                  <span key={i} className="h-3 flex-1 rounded-[2px]" style={{ backgroundColor: won ? "#4fbf66" : "#e84057" }} />
                ))}
              </div>
              <p className="text-xs text-lol-mist">
                Ultime {form.games}: <span className="text-lol-text">{form.wins}V {form.losses}S</span> · KDA <span className="text-lol-text">{form.kda}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-lol-mist">Nessuna partita recente su Summoner's Rift.</p>
          )}

          {roleChampions(profile, player.role).length > 0 && (
            <div>
              <p className="mb-1.5 text-xs text-lol-mist">Più giocati {profile.roles?.some((r) => r.role === player.role) ? `a ${ROLE_LABELS[player.role]}` : "in assoluto"}</p>
              <ul className="flex gap-3">
                {roleChampions(profile, player.role).map((c) => (
                  <li key={c.id} className="flex flex-col items-center gap-0.5" title={`${c.id}: ${c.games} partite`}>
                    <img src={championIcon(c.id)} alt={c.id} loading="lazy" className="h-10 w-10 rounded-md border border-lol-gold/40" />
                    <span className="tabular text-[11px] text-lol-mist">{c.games}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </article>
  );
}

// Situazione dei giocatori della sessione: rank, forma recente e campioni più giocati nel loro ruolo.
// I dati vengono dal backend (Riot API), in cache: la stessa richiesta serve anche alla finestra "Stats".
export default function TeamStats({ players }: { players: SessionPlayer[] }) {
  const results = useQueries({
    queries: players.map((p) => ({
      queryKey: ["riot", p.playerId],
      queryFn: () => getPlayerRiot(p.playerId!),
      enabled: !!p.playerId && !!p.riotId && !!p.region,
      staleTime: 5 * 60_000,
      retry: false,
    })),
  });

  if (players.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className={sectionTitle}>
          <Trophy size={20} aria-hidden /> Situazione dei giocatori
        </h2>
        <p className="mt-1 text-sm text-lol-mist">Rank, ultime partite e campioni più giocati, dal loro account Riot.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p, i) => (
          <Card key={p.playerId ?? p.name} player={p} profile={results[i].data} loading={results[i].isLoading} error={results[i].error} />
        ))}
      </div>
    </section>
  );
}
