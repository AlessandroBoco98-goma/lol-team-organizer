import type { CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarPlus, Clock, ExternalLink, MessageCircle, Pencil, Sparkles, StickyNote, Swords, Trash2 } from "lucide-react";
import { getSession, deleteSession, getPlayers, updateSession, getChampions } from "../lib/api";
import { blockReason, BLOCK_LABELS } from "../lib/composition";
import { ROLES, ROLE_COLORS, ROLE_LABELS, RSVP_COLORS, RSVP_LABELS, type SessionPlayer } from "../types";
import { championIcon } from "../lib/ddragon";
import {
  countdownLabel,
  formatDate,
  formatTime,
  isPastSession,
  googleCalendarUrl,
  resolveSessionPlayer,
  rsvpOf,
  rsvpCounts,
  playersFromRsvp,
  probuildUrl,
  whatsappShareUrl,
} from "../lib/utils";
import { btnPrimary, btnGhost, btnDanger, panel, pageTitle, sectionTitle } from "../lib/styles";
import LoadingSpinner from "../components/LoadingSpinner";
import OpggButton from "../components/OpggButton";
import RiotStatsButton from "../components/RiotStatsButton";
import RsvpPanel from "../components/RsvpPanel";
import RsvpBar from "../components/RsvpBar";
import DraftPanel from "../components/DraftPanel";

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: session, isLoading, error } = useQuery({
    queryKey: ["session", id],
    queryFn: () => getSession(id!),
    enabled: !!id,
  });

  // Il roster aggiorna nome, Riot ID e regione; se non carica restano i dati salvati nella sessione
  const { data: teamPlayers = [] } = useQuery({ queryKey: ["players"], queryFn: getPlayers });

  const { data: champions = [] } = useQuery({
    queryKey: ["champions"],
    queryFn: () => getChampions(undefined, "it_IT"),
  });

  const composeMutation = useMutation({
    mutationFn: (players: SessionPlayer[]) =>
      updateSession(id!, { date: session!.date, time: session!.time, notes: session!.notes, players }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", id] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      // Ruoli e campioni vanno scelti nel form di modifica
      navigate(`/edit/${id}`);
    },
    onError: () => alert("Impossibile impostare i giocatori. Controlla la password del team."),
  });

  if (isLoading) return <LoadingSpinner />;
  if (error || !session) return <p className="text-red-400">Sessione non trovata.</p>;

  const past = isPastSession(session);
  const counts = rsvpCounts(session, teamPlayers);
  const yesCount = counts.yes;
  const label = countdownLabel(session);

  const handleCompose = () => {
    const composed = playersFromRsvp(session, teamPlayers);
    if (!composed) {
      alert(`Hanno risposto "Ci sono" in ${yesCount}, ma i ruoli sono ${ROLES.length}: scegli la squadra a mano da "Modifica".`);
      return;
    }
    if (session.players.length > 0 && !confirm('Sostituire la composizione con chi ha risposto "Ci sono"? Chi non c\'è verrà tolto dalla sessione.')) {
      return;
    }
    composeMutation.mutate(composed);
  };

  const handleDelete = async () => {
    if (!confirm("Eliminare questa sessione?")) return;
    try {
      await deleteSession(session.id);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      navigate("/");
    } catch {
      alert("Impossibile eliminare la sessione.");
    }
  };

  return (
    <div className="space-y-8">
      <button
        onClick={() => navigate("/")}
        className="group flex items-center gap-2 text-sm text-lol-text/60 transition hover:text-lol-gold"
      >
        <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" aria-hidden /> Calendario
      </button>

      <section className={`${panel} relative space-y-5 overflow-hidden`}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-lol-gold/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-lol-teal/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className={`${pageTitle} first-letter:uppercase`}>{formatDate(session.date)}</h1>
            <div className="title-rule mt-3" />
            <p className="mt-3 flex items-center gap-2 text-lg text-lol-text/70">
              <Clock size={18} className="text-lol-gold" aria-hidden /> Ore {formatTime(session.time)}
            </p>
          </div>
          <span
            className={`rounded-full px-4 py-1.5 font-display text-xs uppercase tracking-widest ${
              past
                ? "bg-white/10 text-lol-text/60"
                : label === "In corso"
                  ? "animate-pulse-glow bg-lol-teal/20 text-lol-teal"
                  : "bg-lol-teal/15 text-lol-teal"
            }`}
          >
            {label}
          </span>
        </div>
        {teamPlayers.length > 0 && (
          <div className="relative max-w-xl">
            <RsvpBar counts={counts} />
          </div>
        )}
      </section>

      <RsvpPanel session={session} teamPlayers={teamPlayers} past={past} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={sectionTitle}>
            <Swords size={20} aria-hidden /> Composizione team
          </h2>
          {!past && yesCount > 0 && (
            <button type="button" onClick={handleCompose} disabled={composeMutation.isPending} className={btnGhost}>
              <Sparkles size={15} aria-hidden />
              {composeMutation.isPending ? "Imposto..." : `Imposta dai "Ci sono" (${yesCount})`}
            </button>
          )}
        </div>
        {session.players.length === 0 && (
          <div className="glass rounded-xl border-dashed p-8 text-center text-sm text-lol-text/50">
            Nessun giocatore ancora: condividi la sessione su WhatsApp e, quando hanno risposto, imposta la squadra
            dai "Ci sono".
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {session.players.map((raw, i) => {
            const p = resolveSessionPlayer(raw, teamPlayers);
            const status = rsvpOf(session, raw, teamPlayers);
            const color = ROLE_COLORS[p.role];
            return (
              <div
                key={i}
                style={{ "--role": color, animationDelay: `${i * 80}ms` } as CSSProperties}
                className="glass glass-hover animate-fade-up relative overflow-hidden rounded-xl p-5 hover:shadow-[0_20px_44px_-18px_var(--role)]"
              >
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl" style={{ backgroundColor: color }} />

                <div className="relative flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold">{p.name}</p>
                    <p className="mt-0.5 font-display text-xs uppercase tracking-widest" style={{ color }}>
                      {ROLE_LABELS[p.role]}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    <RiotStatsButton playerId={p.playerId} name={p.name} riotId={p.riotId} region={p.region} />
                    <OpggButton riotId={p.riotId} region={p.region} />
                  </div>
                </div>

                {status && (
                  <p
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ color: RSVP_COLORS[status], backgroundColor: `${RSVP_COLORS[status]}1f` }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: RSVP_COLORS[status] }} />
                    {RSVP_LABELS[status]}
                  </p>
                )}

                <div className="relative mt-4 flex flex-wrap gap-3">
                  {p.champions.map((c) => {
                    const blocked = blockReason(c.id, session.draft);
                    return (
                      <a
                        key={c.id}
                        href={probuildUrl(c.id)}
                        target="_blank"
                        rel="noreferrer"
                        className={`group/champ flex w-16 flex-col items-center gap-1 ${blocked ? "opacity-40 grayscale" : ""}`}
                        title={`${blocked ? `${c.name} · ${BLOCK_LABELS[blocked]}` : c.name} — build dei pro su Probuilds Stats`}
                      >
                        <img
                          src={championIcon(c.id)}
                          alt={c.name}
                          loading="lazy"
                          className="h-14 w-14 rounded-lg border border-lol-gold/40 shadow-lg transition duration-200 group-hover/champ:scale-110 group-hover/champ:border-lol-gold"
                        />
                        <span className={`text-center text-[11px] leading-tight text-lol-text/70 ${blocked ? "line-through" : ""}`}>
                          {c.name}
                        </span>
                        {blocked && <span className="text-center text-[9px] leading-tight text-red-400">{BLOCK_LABELS[blocked]}</span>}
                        <span className="flex items-center gap-0.5 text-[9px] uppercase tracking-wider text-lol-gold/60 transition group-hover/champ:text-lol-gold">
                          build <ExternalLink size={8} aria-hidden />
                        </span>
                      </a>
                    );
                  })}
                  {p.champions.length === 0 && <span className="text-sm text-lol-text/40">Nessun campione</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {champions.length > 0 && (
        <DraftPanel
          key={JSON.stringify(session.draft ?? null)}
          session={session}
          players={session.players.map((p) => resolveSessionPlayer(p, teamPlayers))}
          champions={champions}
        />
      )}

      {session.notes && (
        <section className={`${panel} border-l-4 border-l-lol-gold/60`}>
          <h2 className={`${sectionTitle} mb-3`}>
            <StickyNote size={18} aria-hidden /> Note
          </h2>
          <p className="whitespace-pre-line leading-relaxed text-lol-text/80">{session.notes}</p>
        </section>
      )}

      <div className="flex flex-wrap justify-center gap-3 pb-4">
        {!past && (
          <a href={whatsappShareUrl(session, window.location.origin)} target="_blank" rel="noreferrer" className={btnPrimary}>
            <MessageCircle size={16} aria-hidden /> Condividi su WhatsApp
          </a>
        )}
        <a href={googleCalendarUrl(session)} target="_blank" rel="noreferrer" className={btnGhost}>
          <CalendarPlus size={16} aria-hidden /> Google Calendar
        </a>
        <Link to={`/edit/${session.id}`} className={btnGhost}>
          <Pencil size={15} aria-hidden /> Modifica
        </Link>
        <button onClick={handleDelete} className={btnDanger}>
          <Trash2 size={15} aria-hidden /> Elimina
        </button>
      </div>
    </div>
  );
}
