import { useMemo, type CSSProperties } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Layers } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage, getChampionTraits, getPlayerRiot, getProMeta, updateSession } from "../lib/api";
import { championIcon } from "../lib/ddragon";
import { buildCandidates, proposeComps, type Candidate, type Comp, type CompPlayer } from "../lib/comps";
import { MAX_CHAMPIONS, ROLE_COLORS, ROLE_LABELS, type Champion, type Session, type SessionPlayer } from "../types";
import { btnGhost, panel, sectionTitle } from "../lib/styles";

const LEVEL_COLOR = { ok: "#4fbf66", warn: "#f2a93b", info: "#4aa3e0" } as const;
const LEVEL_ICON = { ok: "✓", warn: "!", info: "i" } as const;

// Comp proposte dai campioni che i giocatori della sessione sanno giocare nel loro ruolo.
// Si basano su maestria e partite recenti (Riot) e sui tratti dei campioni (danno, resistenza, controllo, mobilità).
export default function CompProposals({
  session,
  players,
  champions,
}: {
  session: Session;
  players: SessionPlayer[]; // già aggiornati con Riot ID e regione del roster
  champions: Champion[];
}) {
  const queryClient = useQueryClient();
  const names = useMemo(() => new Map(champions.map((c) => [c.id, c.name])), [champions]);

  const { data: traits = {} } = useQuery({ queryKey: ["traits"], queryFn: getChampionTraits, staleTime: Infinity, retry: 1 });

  // Meta dei tornei: opzionale, se il server non lo ha le comp si calcolano senza
  const { data: proMeta } = useQuery({ queryKey: ["pro-meta"], queryFn: getProMeta, staleTime: 60 * 60_000, retry: 1 });

  // Stessa chiave della situazione dei giocatori: i profili vengono dalla cache, nessuna chiamata in più
  const profiles = useQueries({
    queries: players.map((p) => ({
      queryKey: ["riot", p.playerId],
      queryFn: () => getPlayerRiot(p.playerId!),
      enabled: !!p.playerId && !!p.riotId && !!p.region,
      staleTime: 5 * 60_000,
      retry: false,
    })),
  });
  const loading = profiles.some((q) => q.isLoading);
  const profileKey = profiles.map((q) => q.dataUpdatedAt).join(",");

  const compPlayers: CompPlayer[] = useMemo(
    () =>
      players.map((p, i) => {
        let candidates: Candidate[] = buildCandidates(profiles[i]?.data, p.role, traits, 8, proMeta);
        // Senza dati Riot si parte dai campioni già scelti per il giocatore, con un comfort neutro
        if (candidates.length === 0) {
          candidates = p.champions.map((c) => ({ championId: c.id, comfort: 0.35, points: 0, roleGames: 0 }));
        }
        return { playerId: p.playerId, name: p.name, role: p.role, candidates };
      }),
    // profileKey cambia quando arrivano i dati di un profilo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, traits, proMeta, profileKey],
  );

  const comps = useMemo(
    () => proposeComps(compPlayers, traits, { hasMeta: !!proMeta, names: (id) => names.get(id) ?? id }),
    [compPlayers, traits, proMeta, names],
  );

  const apply = useMutation({
    mutationFn: (comp: Comp) => {
      // Il pick della comp passa in prima posizione; gli altri campioni già scelti restano dopo (massimo 3)
      const next = session.players.map((sp) => {
        const pick = comp.picks.find((p) => p.role === sp.role)?.championId;
        if (!pick) return sp;
        const champions = [{ id: pick, name: names.get(pick) ?? pick }, ...sp.champions.filter((c) => c.id !== pick)].slice(0, MAX_CHAMPIONS);
        return { ...sp, champions };
      });
      return updateSession(session.id, { date: session.date, time: session.time, notes: session.notes, players: next });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", session.id] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Comp applicata: i pick sono i primi campioni di ogni giocatore");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "La comp non è stata applicata. Controlla la password del team.")),
  });

  if (players.length === 0) return null;
  const hasPicks = comps.some((c) => c.picks.some((p) => p.championId));

  return (
    <section className="space-y-4">
      <div>
        <h2 className={sectionTitle}>
          <Layers size={20} aria-hidden /> Comp proposte
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-lol-mist">
          Combinazioni dei campioni che i giocatori sanno giocare nel loro ruolo (maestria e partite recenti), valutate su equilibrio tra danno
          fisico e magico, prima linea, controllo e mobilità.
        </p>
      </div>

      {loading && !hasPicks ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-64 rounded-lg" />
          ))}
        </div>
      ) : !hasPicks ? (
        <div className="panel p-6 text-sm text-lol-mist">
          Non ci sono ancora dati per proporre una comp. Servono Riot ID e regione dei giocatori, oppure campioni già scelti per loro.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {comps.map((comp, idx) => (
            <article key={idx} className={`${panel} flex flex-col gap-4 !p-5`}>
              <header className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-2xl font-bold">Comp {idx + 1}</h3>
                <span className="tabular text-sm text-lol-mist" title="Punteggio complessivo">
                  <span className="font-semibold text-lol-gold-bright">{Math.round(comp.score * 100)}</span>/100
                </span>
              </header>

              <ul className="space-y-2">
                {comp.picks.map((p) => (
                  <li key={p.role} className="flex items-center gap-3">
                    {p.championId ? (
                      <img
                        src={championIcon(p.championId)}
                        alt={p.championId}
                        loading="lazy"
                        className="h-10 w-10 shrink-0 rounded-md border"
                        style={{ borderColor: ROLE_COLORS[p.role] } as CSSProperties}
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-lol-mist/50 text-lol-mist">?</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.championId ? names.get(p.championId) ?? p.championId : "Da scegliere"}</p>
                      <p className="truncate text-xs text-lol-mist">
                        <span style={{ color: ROLE_COLORS[p.role] }}>{ROLE_LABELS[p.role]}</span> · {p.name}
                        {p.offRole && <span className="text-lol-gold"> · fuori ruolo</span>}
                        {p.meta && p.meta.pickRate >= 0.03 && (
                          <span title={`Nei tornei: ${p.meta.games} partite, ${Math.round(p.meta.winRate * 100)}% di vittorie`}>
                            {" "}· pro {Math.round(p.meta.pickRate * 100)}%
                          </span>
                        )}
                      </p>
                    </div>
                    {p.championId && (
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-white/[0.08]" title={`Comfort ${Math.round(p.comfort * 100)}%`}>
                        <div className="h-full rounded-full bg-lol-gold/80" style={{ width: `${Math.round(p.comfort * 100)}%` }} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <ul className="space-y-1 border-t border-lol-gold/10 pt-3 text-xs">
                {comp.notes.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-3 shrink-0 text-center font-bold" style={{ color: LEVEL_COLOR[n.level] }}>{LEVEL_ICON[n.level]}</span>
                    <span className="text-lol-text/80">{n.text}</span>
                  </li>
                ))}
              </ul>

              <button type="button" onClick={() => apply.mutate(comp)} disabled={apply.isPending} className={`${btnGhost} mt-auto`}>
                <Check size={15} aria-hidden /> Usa questa comp
              </button>
            </article>
          ))}
        </div>
      )}
      {proMeta && hasPicks && (
        <p className="text-xs text-lol-mist">
          Meta dei tornei: ultimi {proMeta.windowDays} giorni, {proMeta.games} partite. Dati:{" "}
          <a href={proMeta.sourceUrl} target="_blank" rel="noreferrer" className="underline">{proMeta.source}</a> ({proMeta.license}).
        </p>
      )}
    </section>
  );
}
