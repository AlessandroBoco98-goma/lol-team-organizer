import { RSVP_COLORS, RSVP_LABELS, RSVP_STATUSES } from "../types";
import type { RsvpCounts } from "../lib/utils";

// Barra a segmenti con le risposte (sì / forse / no / in attesa); la larghezza si anima al cambio dei dati
export default function RsvpBar({ counts, legend = true }: { counts: RsvpCounts; legend?: boolean }) {
  const total = counts.yes + counts.maybe + counts.no + counts.pending;
  if (total === 0) return null;
  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="space-y-2">
      <div
        className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]"
        role="img"
        aria-label={`${counts.yes} ci sono, ${counts.maybe} forse, ${counts.no} non ci sono, ${counts.pending} in attesa`}
      >
        {RSVP_STATUSES.map((s) => (
          <div
            key={s}
            className="h-full transition-[width] duration-700 ease-out"
            style={{ width: pct(counts[s]), backgroundColor: RSVP_COLORS[s] }}
          />
        ))}
      </div>
      {legend && (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {RSVP_STATUSES.map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-lol-text/70">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RSVP_COLORS[s] }} />
              <span className="font-medium" style={{ color: RSVP_COLORS[s] }}>{counts[s]}</span>
              {RSVP_LABELS[s].toLowerCase()}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-lol-text/50">
            <span className="h-2 w-2 rounded-full bg-lol-text/25" />
            <span className="font-medium">{counts.pending}</span> in attesa
          </span>
        </p>
      )}
    </div>
  );
}
