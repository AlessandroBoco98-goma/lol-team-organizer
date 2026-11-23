import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, Trophy, Users } from "lucide-react";
import { apiErrorMessage, getChampionTraits, getPlayerRiot, getPlayers } from "../lib/api";
import { championIcon } from "../lib/ddragon";
import { buildCandidates, roleCoverage, roleGapLabel } from "../lib/comps";
import { TIER_COLORS, formatRank, winRate } from "../lib/riot";
import { ROLES, ROLE_COLORS, ROLE_LABELS, type Player, type RiotProfile } from "../types";
import { pageTitle, sectionTitle } from "../lib/styles";
import LoadingSpinner from "../components/LoadingSpinner";
import MasteryList from "../components/MasteryList";
import RiotStatsButton from "../components/RiotStatsButton";

// Un giocatore alla volta: ogni profilo fa una decina di chiamate a Riot e il limite è basso.
// Il successivo parte quando il precedente ha finito (le risposte già in cache sono immediate).
function useRosterProfiles(players: Player[]) {
  const withRiot = useMemo(() => players.filter((p) => p.riotId && p.region), [players]);
  const [unlocked, setUnlocked] = useState(1);

  const results = useQueries({
    queries: withRiot.map((p, i) => ({
      queryKey: ["riot", p.id],
      queryFn: () => getPlayerRiot(p.id),
      staleTime: 5 * 60_000,
      retry: false,
      enabled: i < unlocked,
    })),
  });

  useEffect(() => {
    const last = results[unlocked - 1];
    if (last && (last.isSuccess || last.isError) && unlocked < withRiot.length) setUnlocked(unlocked + 1);
  }, [results, unlocked, withRiot.length]);

  const byId = new Map(withRiot.map((p, i) => [p.id, results[i]]));
  return (id: string) => byId.get(id);
}

export default function Roster() {
  const { data: players = [], isLoading } = useQuery({ queryKey: ["players"], queryFn: getPlayers });
  // I tratti servono a capire in quali ruoli si gioca un campione; senza, la maestria vale per ogni ruolo
  const { data: traits = {} } = useQuery({ queryKey: ["traits"], queryFn: getChampionTraits, staleTime: Infinity, retry: 1 });
  const resultOf = useRosterProfiles(players);

  if (isLoading) return <LoadingSpinner />;

  const profileOf = (id: string): RiotProfile | undefined => resultOf(id)?.data;
  const coverage = roleCoverage(players.map((p) => ({ playerId: p.id, name: p.name, profile: profileOf(p.id) })), traits);
  const loadedCount = players.filter((p) => profileOf(p.id)).length;
  const gaps = loadedCount > 0 ? roleGapLabel(coverage) : null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className={pageTitle}>Roster</h1>
        <div className="title-rule mt-4" />
        <p className="mt-3 max-w-2xl text-lol-mist">
          Chi gioca cosa: maestrie, campioni più giocati per ruolo e ruoli scoperti, dai loro account Riot.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className={sectionTitle}>
          <Users size={20} aria-hidden /> Copertura dei ruoli
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {coverage.map((c) => {
            const color = ROLE_COLORS[c.role];
            return (
              <div
                key={c.role}
                className="panel space-y-3 p-4 [--c:10px]"
                style={{ "--edge-a": `${color}99`, "--edge-b": `${color}22` } as CSSProperties}
              >
                <p className="font-display text-xl font-bold leading-none" style={{ color }}>{ROLE_LABELS[c.role]}</p>
                {loadedCount === 0 ? (
                  <p className="text-xs text-lol-mist">In caricamento…</p>
                ) : c.players.length === 0 ? (
                  <p className="text-sm text-lol-mist">Nessuno lo gioca.</p>
                ) : (
                  <ul className="space-y-2">
                    {c.players.map((p) => (
                      <li key={p.playerId} className="flex items-center gap-2">
                        <img src={championIcon(p.best.championId)} alt={p.best.championId} loading="lazy" className="h-8 w-8 rounded-md border border-lol-gold/40" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.07]" title={`Comfort ${Math.round(p.best.comfort * 100)}%`}>
                            <div className="h-full rounded-full" style={{ width: `${Math.round(p.best.comfort * 100)}%`, backgroundColor: color }} />
                          </div>
                        </div>
                        <span className="tabular text-xs text-lol-mist" title="Campioni giocabili">{p.depth}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        {gaps && (
          <p className="flex items-center gap-2 text-sm text-lol-gold" role="status">
            <AlertTriangle size={15} aria-hidden /> Ruoli senza nessuno con dati sufficienti: {gaps}.
          </p>
        )}
        <p className="text-xs text-lol-mist">
          La barra è il comfort (maestria e partite recenti nel ruolo); il numero a destra sono i campioni a cui il giocatore è a suo agio in quel ruolo.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className={sectionTitle}>
          <Trophy size={20} aria-hidden /> Giocatori
        </h2>
        {players.length === 0 && <div className="panel p-10 text-center text-lol-mist">Nessun giocatore nel roster.</div>}
        <div className="grid gap-5 md:grid-cols-2">
          {players.map((p) => {
            const result = resultOf(p.id);
            const profile = result?.data;
            const solo = profile?.ranks.find((r) => r.queue === "solo") ?? profile?.ranks[0];
            const hasRiot = !!p.riotId && !!p.region;
            const waiting = hasRiot && !result?.isSuccess && !result?.isError;
            return (
              <article key={p.id} className="panel space-y-5 p-5">
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-3xl font-bold leading-none">{p.name}</p>
                    {hasRiot ? <p className="mt-1.5 truncate text-xs text-lol-mist">{p.riotId} · {p.region}</p> : null}
                  </div>
                  <RiotStatsButton playerId={p.id} name={p.name} riotId={p.riotId} region={p.region} />
                </header>

                {!hasRiot ? (
                  <p className="text-sm text-lol-mist">
                    Riot ID non impostato. <Link to="/players" className="text-lol-gold underline-offset-2 hover:underline">Aggiungilo nei Giocatori</Link>
                  </p>
                ) : waiting ? (
                  <div className="space-y-3">
                    <div className="skeleton h-5 w-1/2 rounded" />
                    <div className="skeleton h-24 w-full rounded" />
                  </div>
                ) : result?.isError || !profile ? (
                  <p className="text-sm text-lol-mist">{apiErrorMessage(result?.error, "Dati Riot non disponibili.")}</p>
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

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <h3 className="mb-2 font-display text-lg font-bold">Maestria</h3>
                        <MasteryList mastery={profile.mastery} />
                      </div>
                      <div>
                        <h3 className="mb-2 font-display text-lg font-bold">Pool per ruolo</h3>
                        <ul className="space-y-2.5">
                          {ROLES.map((role) => {
                            const picks = buildCandidates(profile, role, traits, 3);
                            if (picks.length === 0) return null;
                            return (
                              <li key={role} className="flex items-center gap-2">
                                <span className="w-14 shrink-0 text-xs font-semibold" style={{ color: ROLE_COLORS[role] }}>{ROLE_LABELS[role]}</span>
                                <div className="flex gap-1.5">
                                  {picks.map((c) => (
                                    <img
                                      key={c.championId}
                                      src={championIcon(c.championId)}
                                      alt={c.championId}
                                      title={`${c.championId} · comfort ${Math.round(c.comfort * 100)}%`}
                                      loading="lazy"
                                      className="h-8 w-8 rounded-md border border-lol-gold/40"
                                    />
                                  ))}
                                </div>
                              </li>
                            );
                          })}
                          {ROLES.every((role) => buildCandidates(profile, role, traits, 1).length === 0) && (
                            <li className="text-sm text-lol-mist">Nessun dato per i ruoli.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
