import { CalendarCheck, Check, Clock, MessageCircle, X } from "lucide-react";
import { RSVP_COLORS, RSVP_LABELS, RSVP_STATUSES, type Player, type Session } from "../types";
import { rsvpCounts, sessionInviteText, whatsappChatUrl } from "../lib/utils";
import { label, input, panel, sectionTitle } from "../lib/styles";
import { useMe } from "../lib/me";
import { useRsvpMutation } from "../lib/useRsvp";

// Riepilogo delle risposte e, per le sessioni future, i pulsanti per rispondere.
// Non ci sono account: ognuno sceglie "Chi sei?" e la scelta resta nel suo browser.
export default function RsvpPanel({ session, teamPlayers, past }: { session: Session; teamPlayers: Player[]; past: boolean }) {
  const [me, chooseMe] = useMe();

  // Rispondono tutti i giocatori del roster, anche se non sono ancora nella composizione
  const meCandidate = teamPlayers.find((p) => p.id === me);
  const counts = rsvpCounts(session, teamPlayers);
  const pending = teamPlayers.filter((p) => !session.rsvp?.[p.id]);
  const current = meCandidate ? session.rsvp?.[meCandidate.id] : undefined;

  const mutation = useRsvpMutation(session.id);

  // Per le sessioni passate il riepilogo sta già nell'intestazione e non si può più rispondere
  if (teamPlayers.length === 0 || past) return null;

  return (
    <section className={`${panel} space-y-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={sectionTitle}>
          <CalendarCheck size={20} aria-hidden /> Disponibilità
        </h2>
        <p className="text-sm text-lol-text/60">
          <span className="font-medium text-lol-teal">{counts.yes}</span> su {teamPlayers.length} hanno confermato
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
                  className="chamfer inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40 [--c:9px]"
                  style={{
                    color: active ? "#060a12" : RSVP_COLORS[s],
                    backgroundColor: active ? RSVP_COLORS[s] : `${RSVP_COLORS[s]}12`,
                    // Il bordo è un'ombra interna: il clip-path taglierebbe un bordo normale agli angoli
                    boxShadow: `inset 0 0 0 1px ${RSVP_COLORS[s]}${active ? "" : "80"}`,
                  }}
                  aria-pressed={active}
                >
                  {s === "yes" ? <Check size={15} aria-hidden /> : s === "no" ? <X size={15} aria-hidden /> : <Clock size={15} aria-hidden />}
                  {RSVP_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {!past && <p className="text-xs text-lol-mist">Clicca di nuovo sulla tua risposta per annullarla.</p>}

      {!past && pending.length > 0 && (
        <div className="space-y-2 border-t border-lol-gold/15 pt-4">
          <p className="text-sm text-lol-text/70">Non hanno ancora risposto (tocca per sollecitare su WhatsApp):</p>
          <ul className="flex flex-wrap gap-2">
            {pending.map((p) => (
              <li key={p.id}>
                {p.phone ? (
                  <a
                    href={whatsappChatUrl(p.phone, `Ciao ${p.name}! ${sessionInviteText(session, window.location.origin)}`)}
                    target="_blank"
                    rel="noreferrer"
                    title={`Manda un promemoria a ${p.name} su WhatsApp`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-lol-teal/50 bg-lol-teal/5 px-3 py-1 text-sm text-lol-teal transition hover:-translate-y-0.5 hover:bg-lol-teal/15"
                  >
                    <MessageCircle size={13} aria-hidden /> {p.name}
                  </a>
                ) : (
                  <span className="rounded-full border border-lol-text/20 px-3 py-1 text-sm text-lol-text/60">{p.name}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
