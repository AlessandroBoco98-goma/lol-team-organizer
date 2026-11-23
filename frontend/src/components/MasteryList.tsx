import { championIcon } from "../lib/ddragon";
import { formatPoints, timeAgo } from "../lib/riot";
import type { RiotMastery } from "../types";

// Maestria: i campioni su cui il giocatore ha più punti, con livello e ultima partita
export default function MasteryList({ mastery, limit = 5 }: { mastery?: RiotMastery[]; limit?: number }) {
  const top = (mastery ?? []).slice(0, limit);
  if (top.length === 0) return <p className="text-sm text-lol-mist">Nessuna maestria disponibile.</p>;
  const best = top[0].points || 1;

  return (
    <ul className="space-y-2">
      {top.map((m) => (
        <li key={m.championId} className="flex items-center gap-3">
          <div className="relative shrink-0">
            <img src={championIcon(m.championId)} alt={m.championId} loading="lazy" className="h-9 w-9 rounded-md border border-lol-gold/40" />
            <span
              className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-[#0b1424] bg-lol-gold px-1 text-[10px] font-bold text-[#060a12]"
              title={`Livello di maestria ${m.level}`}
            >
              {m.level}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium">{m.championId}</span>
              <span className="tabular shrink-0 text-xs text-lol-text/80">{formatPoints(m.points)}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-lol-gold/70" style={{ width: `${Math.max(4, (m.points / best) * 100)}%` }} />
            </div>
            {m.lastPlayedAt && <span className="text-[11px] text-lol-mist">giocato {timeAgo(m.lastPlayedAt)}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
