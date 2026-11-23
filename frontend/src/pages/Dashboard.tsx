import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { toast } from "sonner";
import { ArrowRight, CalendarPlus, Clock, Eye, ListChecks, Pencil, Swords, Trash2 } from "lucide-react";
import { getSessions, deleteSession, getPlayers } from "../lib/api";
import { CONFIRM_THRESHOLD, ROLE_COLORS, ROLE_LABELS, type Session } from "../types";
import { championIcon } from "../lib/ddragon";
import {
  countdownLabel,
  dateBadge,
  formatTime,
  isPastSession,
  isProposal,
  votingSessions,
  googleCalendarUrl,
  lobbySlots,
  resolveSessionPlayer,
  rsvpCounts,
} from "../lib/utils";
import { btnPrimary, pageTitle } from "../lib/styles";
import RsvpBar from "../components/RsvpBar";
import Lobby from "../components/Lobby";
import NextMatchHero from "../components/NextMatchHero";

type Tab = "upcoming" | "past" | "all";

const TABS: { id: Tab; label: string }[] = [
  { id: "upcoming", label: "Prossime" },
  { id: "past", label: "Passate" },
  { id: "all", label: "Tutte" },
];

function SessionSkeleton() {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-4">
        <div className="skeleton h-14 w-14" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-2/3 rounded" />
          <div className="skeleton h-3 w-1/3 rounded" />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-7 rounded" />
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

  // Le proposte della votazione non sono sessioni: stanno nella pagina "Votazione" finché non arrivano alle conferme
  const { upcoming, past, realCount, openVotes } = useMemo(() => {
    const byStart = (a: Session, b: Session) =>
      new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
    const real = sessions.filter((s) => !isProposal(s));
    return {
      upcoming: real.filter((s) => !isPastSession(s)).sort(byStart),
      past: real.filter(isPastSession).sort((a, b) => byStart(b, a)),
      realCount: real.length,
      openVotes: votingSessions(sessions).filter(isProposal).length,
    };
  }, [sessions]);

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questa sessione?")) return;
    try {
      await deleteSession(id);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Sessione eliminata");
    } catch {
      toast.error("Non sono riuscito a eliminare la sessione. Controlla la password del team.");
    }
  };

  if (error) return <p className="text-red-400">Errore nel caricamento delle sessioni.</p>;

  // La prossima sessione ha già il suo spazio nell'hero: non si ripete tra le card
  const next = upcoming[0];
  const base = tab === "upcoming" ? upcoming : tab === "past" ? past : [...upcoming, ...past];
  const visible = base.filter((s) => s.id !== next?.id);
  const counts = { upcoming: upcoming.length, past: past.length, all: realCount };
  const showEmpty = !isLoading && visible.length === 0 && !(next && tab !== "past");

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className={pageTitle}>Calendario</h1>
          <div className="title-rule mt-4" />
          <p className="mt-3 text-lol-mist">Le sessioni del team, in ordine di data.</p>
        </div>
      </header>

      {openVotes > 0 && (
        <Link to="/vota" className="panel panel-hover flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <ListChecks size={22} className="text-lol-gold" aria-hidden />
            <div>
              <p className="font-display text-xl font-bold leading-tight">Votazione della settimana aperta</p>
              <p className="text-sm text-lol-mist">
                {openVotes === 1 ? "1 giorno" : `${openVotes} giorni`} da votare. Con {CONFIRM_THRESHOLD} conferme nasce la sessione.
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-lol-gold">
            Vota i giorni <ArrowRight size={15} aria-hidden />
          </span>
        </Link>
      )}

      {next && <NextMatchHero session={next} teamPlayers={teamPlayers} />}

      <div role="tablist" aria-label="Filtra sessioni" className="inline-flex gap-1 border-b border-lol-gold/15">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id ? "text-lol-gold-bright" : "text-lol-mist hover:text-lol-text"
            }`}
          >
            {t.label}
            <span className="tabular text-xs text-lol-mist">{counts[t.id]}</span>
            {tab === t.id && (
              <m.span layoutId="dashboard-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-lol-gold" transition={{ type: "spring", stiffness: 500, damping: 36 }} />
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SessionSkeleton key={i} />
          ))}
        </div>
      ) : showEmpty ? (
        <div className="panel animate-fade-in p-14 text-center">
          <Swords size={36} className="mx-auto text-lol-gold/70" aria-hidden />
          <h3 className="mt-4 font-display text-2xl font-bold">
            {tab === "past" ? "Nessuna sessione passata" : "Nessuna sessione in programma"}
          </h3>
          <p className="mt-2 text-lol-mist">{tab === "past" ? "Qui comparirà lo storico." : "Crea la prima sessione e condividila sul gruppo."}</p>
          {tab !== "past" && (
            <Link to="/new" className={`${btnPrimary} mt-6`}>
              <CalendarPlus size={16} aria-hidden /> Nuova sessione
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((s) => {
              const isPast = isPastSession(s);
              const badge = dateBadge(s.date);
              const label = countdownLabel(s);
              const slots = lobbySlots(s, teamPlayers);
              const rsvp = rsvpCounts(s, teamPlayers);
              return (
                <m.article
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: isPast ? 0.62 : 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.22 }}
                  className="panel panel-hover flex flex-col"
                >
                  <header className="flex items-center gap-4 px-5 pt-5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-6xl font-extrabold leading-none text-gold-gradient">{badge.day}</span>
                      <span className="leading-tight">
                        <span className="block text-sm font-semibold capitalize">{badge.month}</span>
                        <span className="block text-xs capitalize text-lol-mist">{badge.weekday}</span>
                      </span>
                    </div>
                    <p className="tabular ml-1 flex items-center gap-1.5 text-lg font-medium">
                      <Clock size={15} className="text-lol-mist" aria-hidden /> {formatTime(s.time)}
                    </p>
                    <span
                      className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${
                        isPast ? "bg-white/10 text-lol-mist" : label === "In corso" ? "animate-pulse-glow bg-lol-teal/20 text-lol-teal" : "bg-lol-teal/15 text-lol-teal"
                      }`}
                    >
                      {label}
                    </span>
                  </header>

                  <div className="space-y-4 px-5 py-5">
                    <Lobby slots={slots} variant="mini" />

                    <ul className="space-y-2.5">
                      {s.players.map((raw, i) => {
                        const p = resolveSessionPlayer(raw, teamPlayers);
                        return (
                          <li key={i} className="flex items-center gap-3">
                            <span className="h-6 w-1 shrink-0" style={{ backgroundColor: ROLE_COLORS[p.role] }} aria-hidden />
                            <span className="w-14 shrink-0 text-xs font-semibold" style={{ color: ROLE_COLORS[p.role] }}>
                              {ROLE_LABELS[p.role]}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                            <div className="flex -space-x-2">
                              {p.champions.map((c) => (
                                <img
                                  key={c.id}
                                  src={championIcon(c.id)}
                                  alt={c.name}
                                  title={c.name}
                                  loading="lazy"
                                  className="h-8 w-8 rounded-full border-2 border-[#0b1424] ring-1 ring-lol-gold/40 transition-transform duration-200 hover:z-10 hover:scale-125"
                                />
                              ))}
                            </div>
                          </li>
                        );
                      })}
                      {s.players.length === 0 && (
                        <li className="text-sm text-lol-mist">La squadra si compone in base alle disponibilità.</li>
                      )}
                    </ul>

                    {!isPast && teamPlayers.length > 0 && <RsvpBar counts={rsvp} />}

                    {s.notes && (
                      <p className="line-clamp-3 border-l-2 border-lol-gold/40 pl-3 text-sm italic leading-relaxed text-lol-mist">{s.notes}</p>
                    )}
                  </div>

                  <footer className="mt-auto flex items-center gap-5 border-t border-lol-gold/12 bg-black/20 px-5 py-3 text-sm">
                    <Link to={`/session/${s.id}`} className="flex items-center gap-1.5 font-medium text-lol-gold transition hover:text-lol-gold-bright">
                      <Eye size={15} aria-hidden /> Apri
                    </Link>
                    <Link to={`/edit/${s.id}`} className="flex items-center gap-1.5 text-lol-mist transition hover:text-lol-text">
                      <Pencil size={14} aria-hidden /> Modifica
                    </Link>
                    <a href={googleCalendarUrl(s)} target="_blank" rel="noreferrer" className="text-lol-mist transition hover:text-lol-text">
                      Calendar
                    </a>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="ml-auto text-lol-mist transition hover:text-red-400"
                      aria-label="Elimina sessione"
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </footer>
                </m.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
