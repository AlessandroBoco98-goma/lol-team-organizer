import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Clock, MessageCircle, X } from "lucide-react";
import { getPlayers, getSessions } from "../lib/api";
import {
  CONFIRM_THRESHOLD,
  ROLE_COLORS,
  ROLE_LABELS,
  RSVP_COLORS,
  RSVP_LABELS,
  RSVP_STATUSES,
  type Player,
  type Role,
  type RsvpStatus,
  type Session,
} from "../types";
import { dateBadge, formatTime, rsvpCounts, takenRoles, voteInviteUrl, votingSessions, weekdayName } from "../lib/utils";
import { useMe } from "../lib/me";
import { useRsvpMutation } from "../lib/useRsvp";
import { btnPrimary, input, label, pageTitle } from "../lib/styles";
import LoadingSpinner from "../components/LoadingSpinner";
import RolePicker from "../components/RolePicker";

const ICONS: Record<RsvpStatus, typeof Check> = { yes: Check, maybe: Clock, no: X };

// Un giorno da votare: quante conferme ha, chi ha detto sì e i pulsanti per votare
function DayRow({ session, team, me }: { session: Session; team: Player[]; me: Player | undefined }) {
  const mutation = useRsvpMutation(session.id);
  const [picking, setPicking] = useState(false);
  const counts = rsvpCounts(session, team);
  const confirmed = session.status !== "proposal";
  const missing = Math.max(0, CONFIRM_THRESHOLD - counts.yes);
  const current = me ? session.rsvp?.[me.id] : undefined;
  const myRole = me ? session.voteRoles?.[me.id] : undefined;
  const yesVoters = team.filter((p) => session.rsvp?.[p.id] === "yes");

  // "Ci sono" apre la scelta del ruolo tra quelli liberi; gli altri voti partono subito
  const vote = (status: RsvpStatus) => {
    if (!me) return;
    if (status === "yes" && current !== "yes") {
      setPicking(true);
      return;
    }
    setPicking(false);
    mutation.mutate({ playerId: me.id, status: current === status ? null : status });
  };

  const pickRole = (role: Role) => {
    if (me) mutation.mutate({ playerId: me.id, status: "yes", role }, { onSuccess: () => setPicking(false) });
  };
  const badge = dateBadge(session.date);
  const edge = confirmed ? "#19d3c0" : "#c9a96a";

  return (
    <article
      style={{ "--edge-a": `${edge}b3`, "--edge-b": `${edge}2a` } as CSSProperties}
      className="panel grid gap-5 p-5 md:grid-cols-[10.5rem_1fr_auto] md:items-center"
    >
      <div>
        <h2 className="font-display text-3xl font-extrabold capitalize leading-none">{weekdayName(session.date)}</h2>
        <p className="mt-1.5 text-sm text-lol-mist">
          {badge.day} {badge.month} · <span className="tabular">{formatTime(session.time)}</span>
        </p>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5" role="img" aria-label={`${Math.min(counts.yes, CONFIRM_THRESHOLD)} su ${CONFIRM_THRESHOLD} conferme`}>
            {Array.from({ length: CONFIRM_THRESHOLD }, (_, i) => (
              <span
                key={i}
                className="chamfer h-3 w-8 transition-colors duration-500 [--c:4px]"
                style={{ backgroundColor: i < counts.yes ? (confirmed ? "#19d3c0" : "#c9a96a") : "rgb(255 255 255 / 0.09)" }}
              />
            ))}
          </div>
          <p className={`text-sm font-medium ${confirmed ? "text-lol-teal" : "text-lol-text"}`}>
            {confirmed
              ? "Sessione creata"
              : missing === 1
                ? "Manca 1 conferma"
                : `Mancano ${missing} conferme`}
          </p>
        </div>

        {yesVoters.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {yesVoters.map((p) => {
              const role = session.voteRoles?.[p.id];
              const color = role ? ROLE_COLORS[role] : "#8f9bb0";
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs"
                  style={{ backgroundColor: `${color}1f`, color: "#e9e4d6" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                  {p.name}
                  {role && <span style={{ color }}>{ROLE_LABELS[role]}</span>}
                </li>
              );
            })}
            {counts.maybe > 0 && <li className="py-0.5 text-xs text-lol-mist">{counts.maybe} forse</li>}
          </ul>
        ) : (
          <p className="text-sm text-lol-mist">{counts.maybe > 0 ? `${counts.maybe} forse, nessuna conferma` : "Nessuna conferma"}</p>
        )}

        {confirmed && (
          <Link to={`/session/${session.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-lol-gold transition hover:text-lol-gold-bright">
            Apri la sessione <ArrowRight size={14} aria-hidden />
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {RSVP_STATUSES.map((s) => {
          const Icon = ICONS[s];
          const active = current === s;
          return (
            <button
              key={s}
              type="button"
              disabled={!me || mutation.isPending}
              title={me ? undefined : "Scegli prima chi sei"}
              onClick={() => vote(s)}
              aria-pressed={active}
              className="chamfer inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40 [--c:9px]"
              style={{
                color: active ? "#060a12" : RSVP_COLORS[s],
                backgroundColor: active ? RSVP_COLORS[s] : `${RSVP_COLORS[s]}12`,
                boxShadow: `inset 0 0 0 1px ${RSVP_COLORS[s]}${active ? "" : "80"}`,
              }}
            >
              <Icon size={15} aria-hidden /> {RSVP_LABELS[s]}
              {s === "yes" && active && myRole && <span className="text-xs font-medium opacity-80">· {ROLE_LABELS[myRole]}</span>}
            </button>
          );
        })}
        {current === "yes" && !picking && (
          <button type="button" onClick={() => setPicking(true)} className="self-center px-1 text-xs text-lol-mist underline-offset-2 transition hover:text-lol-text hover:underline">
            Cambia ruolo
          </button>
        )}
      </div>

      {picking && me && (
        <div className="md:col-span-3">
          <RolePicker
            taken={takenRoles(session, team, me.id)}
            current={myRole}
            disabled={mutation.isPending}
            onPick={pickRole}
            onCancel={() => setPicking(false)}
          />
        </div>
      )}
    </article>
  );
}

// Pagina del link che si manda sul gruppo: i giorni della settimana da votare.
// Un giorno diventa una sessione vera (e compare nel calendario) quando arriva alle conferme necessarie.
export default function Vote() {
  const { data: sessions = [], isLoading, error } = useQuery({ queryKey: ["sessions"], queryFn: getSessions });
  const { data: team = [], isLoading: loadingTeam } = useQuery({ queryKey: ["players"], queryFn: getPlayers });
  const [meId, chooseMe] = useMe();

  if (isLoading || loadingTeam) return <LoadingSpinner />;
  if (error) return <p className="text-red-400">Non riesco a caricare la votazione.</p>;

  const days = votingSessions(sessions);
  const me = team.find((p) => p.id === meId);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className={pageTitle}>Votazione</h1>
          <div className="title-rule mt-4" />
          <p className="mt-3 max-w-xl text-lol-mist">
            Segna i giorni in cui ci sei. Quando un giorno arriva a {CONFIRM_THRESHOLD} conferme, la sessione viene creata e
            compare nel calendario.
          </p>
        </div>
        <a href={voteInviteUrl(window.location.origin, CONFIRM_THRESHOLD)} target="_blank" rel="noreferrer" className={btnPrimary}>
          <MessageCircle size={16} aria-hidden /> Invia il link sul gruppo
        </a>
      </header>

      <section className="panel grid gap-4 p-5 sm:grid-cols-[minmax(0,18rem)_1fr] sm:items-end">
        <div>
          <label className={label} htmlFor="vote-me">Chi sei?</label>
          <select id="vote-me" value={me ? me.id : ""} onChange={(e) => chooseMe(e.target.value)} className={input}>
            <option value="">Seleziona...</option>
            {team.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <p className="text-sm text-lol-mist">
          {me ? `Voti come ${me.name}. Tocca di nuovo la tua risposta per toglierla.` : "Scegli il tuo nome per poter votare: la scelta resta salvata su questo dispositivo."}
        </p>
      </section>

      {days.length === 0 ? (
        <div className="panel p-12 text-center">
          <h2 className="font-display text-2xl font-bold">Nessuna votazione aperta</h2>
          <p className="mt-2 text-lol-mist">I giorni della settimana compaiono qui ogni domenica sera.</p>
          <Link to="/" className="mt-5 inline-block text-sm font-medium text-lol-gold hover:text-lol-gold-bright">
            Vai al calendario
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((s) => (
            <DayRow key={s.id} session={s} team={team} me={me} />
          ))}
        </div>
      )}
    </div>
  );
}
