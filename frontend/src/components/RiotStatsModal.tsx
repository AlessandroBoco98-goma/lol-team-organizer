import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw, Trophy, X } from "lucide-react";
import { apiErrorMessage, getPlayerRiot } from "../lib/api";
import { championIcon, getItemNames, getKeystones, getLatestVersion, itemIcon, type KeystoneInfo } from "../lib/ddragon";
import { TIER_COLORS, formatDuration, formatRank, kdaRatio, timeAgo, winRate } from "../lib/riot";
import { sectionTitle } from "../lib/styles";

const ROLE_SHORT: Record<string, string> = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "ADC", UTILITY: "Support" };

function ItemIcons({ ids, version, names }: { ids: number[]; version?: string; names?: Record<number, string> }) {
  return (
    <div className="flex gap-1">
      {ids.map((id, i) => (
        <span
          key={`${id}-${i}`}
          title={names?.[id] ?? `Oggetto ${id}`}
          className="h-7 w-7 overflow-hidden rounded border border-lol-gold/30 bg-black/40"
        >
          {version && <img src={itemIcon(version, id)} alt={names?.[id] ?? ""} loading="lazy" className="h-full w-full" />}
        </span>
      ))}
    </div>
  );
}

function Keystone({ id, keystones }: { id: number | null; keystones?: Record<number, KeystoneInfo> }) {
  const info = id ? keystones?.[id] : undefined;
  if (!info) return <span className="h-7 w-7" />;
  return <img src={info.icon} alt={info.name} title={info.name} loading="lazy" className="h-7 w-7 rounded-full bg-black/40" />;
}

// Statistiche dalla Riot API: rank, campioni più giocati con la build abituale e ultime partite
export default function RiotStatsModal({
  playerId,
  name,
  riotId,
  onClose,
}: {
  playerId: string;
  name: string;
  riotId: string;
  onClose: () => void;
}) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["riot", playerId],
    queryFn: () => getPlayerRiot(playerId),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const { data: version } = useQuery({ queryKey: ["ddragon-version"], queryFn: getLatestVersion, staleTime: Infinity });
  const { data: itemNames } = useQuery({
    queryKey: ["ddragon-items", version],
    queryFn: () => getItemNames(version!),
    enabled: !!version,
    staleTime: Infinity,
  });
  const { data: keystones } = useQuery({
    queryKey: ["ddragon-keystones", version],
    queryFn: () => getKeystones(version!),
    enabled: !!version,
    staleTime: Infinity,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Nel body, perché dentro una card con transform "fixed" non coprirebbe tutta la pagina
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`Statistiche di ${name}`}
    >
      <div className="glass animate-pop w-full max-w-3xl space-y-6 rounded-xl p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className={sectionTitle}>
              <Activity size={20} aria-hidden /> {name}
            </h2>
            <p className="mt-1 text-sm text-lol-text/50">{riotId}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 text-xs text-lol-text/60 transition hover:text-lol-gold disabled:opacity-40"
              title="Ricarica (i dati restano in cache sul server per qualche minuto)"
            >
              <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} aria-hidden /> Aggiorna
            </button>
            <button onClick={onClose} className="text-lol-text/60 transition hover:text-lol-gold" aria-label="Chiudi">
              <X size={20} aria-hidden />
            </button>
          </div>
        </header>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-14 rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-300">
            {apiErrorMessage(error, "Impossibile caricare le statistiche. Controlla la password del team.")}
          </p>
        )}

        {data && (
          <>
            <section className="flex flex-wrap gap-3">
              {data.ranks.length === 0 && (
                <p className="rounded-lg border border-lol-gold/15 bg-black/20 px-4 py-3 text-sm text-lol-text/60">Senza rank</p>
              )}
              {data.ranks.map((r) => (
                <div key={r.queue} className="min-w-44 flex-1 rounded-lg border border-lol-gold/20 bg-black/20 px-4 py-3">
                  <p className="font-display text-[10px] uppercase tracking-widest text-lol-text/50">
                    {r.queue === "solo" ? "Classificata Solo/Duo" : "Classificata Flex"}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-lg font-medium" style={{ color: TIER_COLORS[r.tier] }}>
                    <Trophy size={16} aria-hidden /> {formatRank(r)}
                    <span className="text-sm text-lol-text/60">{r.lp} PL</span>
                  </p>
                  <p className="text-xs text-lol-text/60">
                    {r.wins}V {r.losses}S · {winRate(r.wins, r.wins + r.losses)}% vittorie
                  </p>
                </div>
              ))}
            </section>

            {data.gamesAnalyzed === 0 ? (
              <p className="text-sm text-lol-text/60">Nessuna partita recente su Summoner's Rift.</p>
            ) : (
              <>
                <section className="space-y-3">
                  <h3 className="font-display text-sm uppercase tracking-widest text-lol-gold">Campioni più giocati</h3>
                  <ul className="space-y-2">
                    {data.champions.slice(0, 5).map((c) => (
                      <li key={c.championId} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-lol-gold/15 bg-black/20 p-3">
                        <img src={championIcon(c.championId)} alt={c.championId} className="h-10 w-10 rounded-lg border border-lol-gold/40" />
                        <div className="w-28">
                          <p className="text-sm font-medium">{c.championId}</p>
                          <p className="text-xs text-lol-text/60">{c.games} {c.games === 1 ? "partita" : "partite"}</p>
                        </div>
                        <div className="w-24 text-xs">
                          <p className={winRate(c.wins, c.games) >= 50 ? "text-lol-teal" : "text-red-400"}>{winRate(c.wins, c.games)}% vittorie</p>
                          <p className="text-lol-text/60">KDA {kdaRatio(c.kills, c.deaths, c.assists)}</p>
                        </div>
                        <div className="flex flex-1 items-center gap-2" title="Build abituale">
                          <Keystone id={c.keystone} keystones={keystones} />
                          <ItemIcons ids={c.topItems} version={version} names={itemNames} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="space-y-3">
                  <h3 className="font-display text-sm uppercase tracking-widest text-lol-gold">
                    Ultime partite <span className="font-sans text-xs normal-case text-lol-text/40">({data.recent.length} su {data.gamesAnalyzed})</span>
                  </h3>
                  <ul className="space-y-2">
                    {data.recent.map((m) => (
                      <li
                        key={m.matchId}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border-l-4 bg-black/20 p-3"
                        style={{ borderLeftColor: m.win ? "#4fbf66" : "#e84057" }}
                      >
                        <img src={championIcon(m.championId)} alt={m.championId} className="h-9 w-9 rounded-lg border border-lol-gold/40" />
                        <div className="w-24">
                          <p className={`text-sm font-medium ${m.win ? "text-[#4fbf66]" : "text-[#e84057]"}`}>{m.win ? "Vittoria" : "Sconfitta"}</p>
                          <p className="text-xs text-lol-text/50">{ROLE_SHORT[m.role] ?? "—"} · {formatDuration(m.durationSec)}</p>
                        </div>
                        <div className="w-24 text-sm">
                          <p>{m.kills}/{m.deaths}/{m.assists}</p>
                          <p className="text-xs text-lol-text/50">{m.cs} CS</p>
                        </div>
                        <ItemIcons ids={m.items} version={version} names={itemNames} />
                        <span className="ml-auto text-xs text-lol-text/40">{timeAgo(m.endedAt)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            <p className="border-t border-lol-gold/10 pt-4 text-[11px] leading-relaxed text-lol-text/40">
              Dati dalla Riot API, aggiornati alle {new Date(data.updatedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}.
              Questa app non è sostenuta da Riot Games e non riflette il pensiero o le opinioni di Riot Games o di chiunque sia coinvolto
              nella produzione o gestione di League of Legends.
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
