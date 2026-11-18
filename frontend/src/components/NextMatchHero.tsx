import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { Player, Session } from "../types";
import { dateBadge, formatDate, formatTime, lobbySlots, rsvpCounts } from "../lib/utils";
import { btnGhost, btnPrimary } from "../lib/styles";
import Lobby from "./Lobby";
import LiveCountdown from "./LiveCountdown";
import RsvpBar from "./RsvpBar";

// L'elemento principale del calendario: la prossima sessione, il tempo che manca e la lobby che si riempie
export default function NextMatchHero({ session, teamPlayers }: { session: Session; teamPlayers: Player[] }) {
  const start = new Date(`${session.date}T${session.time}:00`);
  const slots = lobbySlots(session, teamPlayers);
  const counts = rsvpCounts(session, teamPlayers);
  const badge = dateBadge(session.date);
  const confirmed = slots.filter((s) => s.name).length;

  return (
    <section className="panel relative overflow-hidden p-6 sm:p-8 [--c:22px]" aria-label="Prossima sessione">
      <div className="hex-bg pointer-events-none absolute inset-0 -z-10 opacity-90 [mask-image:linear-gradient(100deg,transparent_25%,black)]" />
      <div className="pointer-events-none absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full bg-lol-teal/10 blur-3xl" />

      <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div className="space-y-6">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-lol-teal">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lol-teal/60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lol-teal" />
              </span>
              Prossima sessione
            </p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-none tracking-tight first-letter:uppercase sm:text-5xl">
              {formatDate(session.date).split(" ").slice(0, 3).join(" ")}
            </h2>
            <p className="mt-2 text-lg text-lol-mist">
              ore <span className="tabular font-semibold text-lol-text">{formatTime(session.time)}</span>
              <span className="mx-2 text-lol-gold/40">/</span>
              {badge.weekday} {badge.day} {badge.month}
            </p>
          </div>

          <LiveCountdown target={start} />
        </div>

        <div className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-2xl font-bold">Lobby</h3>
            <p className="text-sm text-lol-mist">
              {confirmed} su {slots.length} posti
            </p>
          </div>
          <Lobby slots={slots} />
          {teamPlayers.length > 0 && <RsvpBar counts={counts} />}
          <div className="flex flex-wrap gap-3 pt-1">
            <Link to={`/session/${session.id}`} className={btnPrimary}>
              Apri la sessione <ArrowRight size={16} aria-hidden />
            </Link>
            <Link to={`/edit/${session.id}`} className={btnGhost}>
              Modifica
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
