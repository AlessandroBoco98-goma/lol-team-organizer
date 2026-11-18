import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarPlus, Clock, Eye, Pencil, Swords, Trash2 } from "lucide-react";
import { getSessions, deleteSession, getPlayers } from "../lib/api";
import { ROLE_COLORS, ROLE_LABELS, type Session } from "../types";
import { championIcon } from "../lib/ddragon";
import {
  countdownLabel,
  dateBadge,
  formatTime,
  isPastSession,
  googleCalendarUrl,
  resolveSessionPlayer,
  rsvpCounts,
} from "../lib/utils";
import { btnPrimary, pageTitle } from "../lib/styles";
import RsvpBar from "../components/RsvpBar";

type Tab = "upcoming" | "past" | "all";

const TABS: { id: Tab; label: string }[] = [
  { id: "upcoming", label: "Prossime" },
  { id: "past", label: "Passate" },
  { id: "all", label: "Tutte" },
];

function SessionSkeleton() {
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center gap-4">
        <div className="skeleton h-16 w-16 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-2/3 rounded" />
          <div className="skeleton h-3 w-1/3 rounded" />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-8 rounded" />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("upcoming");

  const { data: sessions = [], isLoading, error } = useQuery({
    queryKey: ["sessions"],
    queryFn: getSessions,
  });
  // Il roster serve solo ad aggiornare i nomi e le risposte: se non carica si usano i dati salvati nelle sessioni
  const { data: teamPlayers = [] } = useQuery({ queryKey: ["players"], queryFn: getPlayers });

  const { upcoming, past } = useMemo(() => {
    const byStart = (a: Session, b: Session) =>
      new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
    const up = sessions.filter((s) => !isPastSession(s)).sort(byStart);
    const pa = sessions.filter(isPastSession).sort((a, b) => byStart(b, a));
    return { upcoming: up, past: pa };
  }, [sessions]);

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questa sessione?")) return;
    try {
      await deleteSession(id);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch {
      alert("Impossibile eliminare la sessione.");
    }
  };

  if (error) return <p className="text-red-400">Errore nel caricamento delle sessioni.</p>;

  const visible = tab === "upcoming" ? upcoming : tab === "past" ? past : [...upcoming, ...past];
  const next = upcoming[0];
  const counts = { upcoming: upcoming.length, past: past.length, all: sessions.length };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className={pageTitle}>Calendario Team</h1>
          <div className="title-rule mt-3" />
          <p className="mt-3 text-lol-text/60">Le sessioni programmate del tuo team</p>
        </div>
        <Link to="/new" className={btnPrimary}>
          <CalendarPlus size={16} aria-hidden /> Nuova sessione
        </Link>
      </header>

      {next && (
        <Link
          to={`/session/${next.id}`}
          className="glass glass-hover group flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl px-5 py-4"
        >
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lol-teal/60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-lol-teal" />
          </span>
          <div className="flex-1">
            <p className="font-display text-xs uppercase tracking-[0.25em] text-lol-teal">Prossima sessione</p>
            <p className="mt-0.5 text-lg font-medium">
              {dateBadge(next.date).weekday} {dateBadge(next.date).day} {dateBadge(next.date).month} · {formatTime(next.time)}
            </p>
          </div>
          <span className="font-display text-2xl font-bold uppercase tracking-wider text-gold-gradient">
            {countdownLabel(next)}
          </span>
          <span className="text-lol-gold transition-transform duration-300 group-hover:translate-x-1">→</span>
        </Link>
      )}

      <div role="tablist" aria-label="Filtra sessioni" className="glass inline-flex rounded-lg p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 font-display text-xs uppercase tracking-widest transition ${
              tab === t.id
                ? "bg-linear-to-b from-[#e0c488] to-[#8a6a2e] font-bold text-[#010a13] shadow-md"
                : "text-lol-text/60 hover:text-lol-gold"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 text-[10px] ${tab === t.id ? "bg-black/20" : "bg-white/10"}`}>
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SessionSkeleton key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="glass animate-fade-in rounded-xl p-14 text-center">
          <Swords size={40} className="mx-auto animate-float text-lol-gold/70" aria-hidden />
          <h3 className="mt-4 font-display text-xl uppercase tracking-widest text-lol-gold">
            {tab === "past" ? "Nessuna sessione passata" : "Nessuna sessione in programma"}
          </h3>
          <p className="mt-2 text-lol-text/60">
            {tab === "past" ? "Qui comparirà lo storico." : "Crea la prima sessione per iniziare."}
          </p>
          {tab !== "past" && (
            <Link to="/new" className={`${btnPrimary} mt-6`}>
              <CalendarPlus size={16} aria-hidden /> Nuova sessione
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((s, idx) => {
            const isPast = isPastSession(s);
            const badge = dateBadge(s.date);
            const label = countdownLabel(s);
            const rsvp = rsvpCounts(s, teamPlayers);
            return (
              <article
                key={s.id}
                style={{ animationDelay: `${Math.min(idx, 8) * 70}ms` }}
                className={`glass glass-hover animate-fade-up flex flex-col overflow-hidden rounded-xl ${
                  isPast ? "opacity-60 saturate-50 hover:opacity-100 hover:saturate-100" : ""
                }`}
              >
                <div className={`h-1 ${isPast ? "bg-lol-text/15" : "bg-linear-to-r from-lol-gold via-lol-teal to-lol-blue"}`} />

                <header className="flex items-center gap-4 px-5 pt-5">
                  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg border border-lol-gold/30 bg-black/30">
                    <span className="font-display text-2xl font-bold leading-none text-gold-gradient">{badge.day}</span>
                    <span className="mt-1 text-[10px] font-medium uppercase tracking-widest text-lol-text/60">{badge.month}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm uppercase tracking-wider text-lol-gold">{badge.weekday}</p>
                    <p className="flex items-center gap-1.5 text-lg font-medium">
                      <Clock size={15} className="text-lol-text/50" aria-hidden /> {formatTime(s.time)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 font-display text-[10px] uppercase tracking-widest ${
                      isPast
                        ? "bg-white/10 text-lol-text/60"
                        : label === "In corso"
                          ? "animate-pulse-glow bg-lol-teal/20 text-lol-teal"
                          : "bg-lol-teal/15 text-lol-teal"
                    }`}
                  >
                    {label}
                  </span>
                </header>

                <ul className="space-y-2.5 px-5 py-5">
                  {s.players.map((raw, i) => {
                    const p = resolveSessionPlayer(raw, teamPlayers);
                    return (
                      <li key={i} className="flex items-center gap-3">
                        <span
                          className="w-[4.5rem] shrink-0 rounded-sm border py-0.5 text-center font-display text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            color: ROLE_COLORS[p.role],
                            borderColor: `${ROLE_COLORS[p.role]}80`,
                            backgroundColor: `${ROLE_COLORS[p.role]}14`,
                          }}
                        >
                          {ROLE_LABELS[p.role]}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                        <div className="flex -space-x-2 transition-all duration-300 hover:space-x-1">
                          {p.champions.map((c) => (
                            <img
                              key={c.id}
                              src={championIcon(c.id)}
                              alt={c.name}
                              title={c.name}
                              loading="lazy"
                              className="h-8 w-8 rounded-full border-2 border-[#0a1428] ring-1 ring-lol-gold/50 transition-transform duration-200 hover:z-10 hover:scale-125"
                            />
                          ))}
                        </div>
                      </li>
                    );
                  })}
                  {s.players.length === 0 && (
                    <li className="rounded-md border border-dashed border-lol-gold/25 px-3 py-3 text-center text-sm text-lol-text/50">
                      Squadra da comporre in base alle disponibilità
                    </li>
                  )}
                </ul>

                {!isPast && teamPlayers.length > 0 && (
                  <div className="px-5 pb-4">
                    <RsvpBar counts={rsvp} />
                  </div>
                )}

                {s.notes && (
                  <p className="mx-5 mb-4 line-clamp-3 border-l-2 border-lol-gold/40 pl-3 text-sm italic text-lol-text/60">
                    {s.notes}
                  </p>
                )}

                <footer className="mt-auto flex items-center gap-4 border-t border-lol-gold/15 bg-black/20 px-5 py-3 text-sm">
                  <Link to={`/session/${s.id}`} className="flex items-center gap-1.5 text-lol-gold transition hover:text-lol-text">
                    <Eye size={15} aria-hidden /> Dettagli
                  </Link>
                  <Link to={`/edit/${s.id}`} className="flex items-center gap-1.5 text-lol-gold transition hover:text-lol-text">
                    <Pencil size={14} aria-hidden /> Modifica
                  </Link>
                  <a
                    href={googleCalendarUrl(s)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lol-teal transition hover:brightness-125"
                  >
                    Calendar
                  </a>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="ml-auto flex items-center gap-1.5 text-red-400/80 transition hover:text-red-400"
                    aria-label="Elimina sessione"
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
