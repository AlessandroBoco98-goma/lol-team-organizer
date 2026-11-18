import { Link, NavLink } from "react-router-dom";
import { CalendarDays, Plus, Users } from "lucide-react";

export default function Navbar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group relative flex items-center gap-2 py-2 font-display text-sm uppercase tracking-widest transition-colors ${
      isActive ? "text-lol-gold" : "text-lol-text/70 hover:text-lol-gold"
    }`;

  // Filetto oro sotto il link attivo, che appare all'hover per gli altri
  const underline = (isActive: boolean) =>
    `absolute inset-x-0 -bottom-0.5 h-0.5 origin-left rounded bg-linear-to-r from-lol-gold to-transparent transition-transform duration-300 ${
      isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
    }`;

  return (
    <nav className="sticky top-0 z-40 border-b border-lol-gold/20 bg-[#010a13]/70 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-lol-gold/60 to-transparent" />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 rotate-45 items-center justify-center rounded-[3px] border-2 border-lol-gold bg-linear-to-br from-lol-panel to-[#0a323c] shadow-[0_0_18px_-4px_rgb(200_170_110/0.6)] transition duration-300 group-hover:rotate-[135deg] group-hover:shadow-[0_0_24px_-2px_rgb(200_170_110/0.9)]">
            <span className="-rotate-45 font-display text-xs font-bold text-lol-gold transition duration-300 group-hover:-rotate-[135deg]">
              LoL
            </span>
          </div>
          <span className="hidden font-display text-lg font-bold uppercase tracking-widest text-gold-gradient sm:block">
            Team Organizer
          </span>
        </Link>

        <div className="flex items-center gap-4 sm:gap-7">
          <NavLink to="/" end className={linkClass}>
            {({ isActive }) => (
              <>
                <CalendarDays size={16} aria-hidden />
                <span className="hidden sm:inline">Calendario</span>
                <span className={underline(isActive)} />
              </>
            )}
          </NavLink>
          <NavLink to="/players" className={linkClass}>
            {({ isActive }) => (
              <>
                <Users size={16} aria-hidden />
                <span className="hidden sm:inline">Giocatori</span>
                <span className={underline(isActive)} />
              </>
            )}
          </NavLink>
          <Link
            to="/new"
            className="btn-shine inline-flex items-center gap-1.5 rounded-md border border-[#f0e6d2]/40 bg-linear-to-b from-[#e0c488] via-[#c8aa6e] to-[#8a6a2e] px-3 py-2 font-display text-sm font-bold uppercase tracking-widest text-[#010a13] shadow-[0_6px_20px_-6px_rgb(200_170_110/0.55)] transition duration-200 hover:-translate-y-0.5 sm:px-4"
          >
            <Plus size={16} aria-hidden />
            <span>Sessione</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
