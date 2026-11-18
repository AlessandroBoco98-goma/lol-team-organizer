import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setRsvp } from "../lib/api";
import { RSVP_COLORS, RSVP_LABELS, RSVP_STATUSES, type Player, type RsvpStatus, type Session } from "../types";
import { rsvpCounts } from "../lib/utils";
import { label, input, panel } from "../lib/styles";

const ME_KEY = "lol-team-me";

function readMe(): string {
  try {
    return localStorage.getItem(ME_KEY) ?? "";
  } catch {
    return "";
  }
}

// Riepilogo delle risposte e, per le sessioni future, i pulsanti per rispondere.
// Non ci sono account: ognuno sceglie "Chi sei?" e la scelta resta nel suo browser.
export default function RsvpPanel({ session, teamPlayers, past }: { session: Session; teamPlayers: Player[]; past: boolean }) {
  const queryClient = useQueryClient();
  const [me, setMe] = useState(readMe);

  // Rispondono tutti i giocatori del roster, anche se non sono ancora nella composizione
  const meCandidate = teamPlayers.find((p) => p.id === me);
  const counts = rsvpCounts(session, teamPlayers);
  const current = meCandidate ? session.rsvp?.[meCandidate.id] : undefined;

  const mutation = useMutation({
    mutationFn: ({ playerId, status }: { playerId: string; status: RsvpStatus | null }) =>
      setRsvp(session.id, playerId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", session.id] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: () => alert("Impossibile salvare la risposta. Controlla la password del team."),
  });

  const chooseMe = (playerId: string) => {
    setMe(playerId);
    try {
      localStorage.setItem(ME_KEY, playerId);
    } catch {
      // senza localStorage la scelta vale solo finché la pagina resta aperta
    }
  };

  if (teamPlayers.length === 0) return null;

  return (
    <section className={`${panel} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg uppercase tracking-widest text-lol-gold">Disponibilità</h2>
        <p className="flex flex-wrap gap-3 text-sm">
          {RSVP_STATUSES.map((s) => (
            <span key={s} style={{ color: RSVP_COLORS[s] }}>{counts[s]} {RSVP_LABELS[s].toLowerCase()}</span>
          ))}
          <span className="text-lol-text/60">{counts.pending} in attesa</span>
        </p>
      </div>

      {!past && (
        <div className="grid gap-4 md:grid-cols-[minmax(0,16rem)_1fr] md:items-end">
          <div>
            <label className={label}>Chi sei?</label>
            <select value={meCandidate ? meCandidate.id : ""} onChange={(e) => chooseMe(e.target.value)} className={input}>
              <option value="">Seleziona...</option>
              {teamPlayers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {RSVP_STATUSES.map((s) => {
              const active = current === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!meCandidate || mutation.isPending}
                  onClick={() => meCandidate && mutation.mutate({ playerId: meCandidate.id, status: active ? null : s })}
                  className="rounded-sm border px-4 py-2 font-display text-xs uppercase tracking-widest transition disabled:opacity-40"
                  style={{
                    color: active ? "#010a13" : RSVP_COLORS[s],
                    backgroundColor: active ? RSVP_COLORS[s] : "transparent",
                    borderColor: RSVP_COLORS[s],
                  }}
                  aria-pressed={active}
                >
                  {RSVP_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {!past && <p className="text-xs text-lol-text/50">Clicca di nuovo sulla tua risposta per annullarla.</p>}
    </section>
  );
}
