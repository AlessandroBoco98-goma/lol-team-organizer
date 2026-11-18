import { Link, NavLink } from "react-router-dom";
import { CalendarDays, Plus, Users } from "lucide-react";
import { btnPrimary } from "../lib/styles";

// Marchio: un esagono ottone con le iniziali, richiamo del reticolo dell'hero
function Mark() {
  return (
    <svg viewBox="0 0 40 46" className="h-10 w-9 shrink-0 drop-shadow-[0_0_10px_rgb(201_169_106/0.35)]" aria-hidden>
      <path d="M20 1.5 38 12v22L20 44.5 2 34V12Z" fill="#0c1422" stroke="#c9a96a" strokeWidth="1.8" />
      <path d="M20 7 33 14.5v17L20 39 7 31.5v-17Z" fill="none" stroke="#c9a96a" strokeOpacity="0.35" />
      <text x="20" y="28" textAnchor="middle" fontFamily="'Big Shoulders Display', sans-serif" fontWeight="800" fontSize="16" fill="#ecd9a8">
        LoL
      </text>
    </svg>
  );
}

export default function Navbar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group relative flex items-center gap-2 py-2 text-sm font-semibold transition-colors ${
      isActive ? "text-lol-gold-bright" : "text-lol-mist hover:text-lol-text"
    }`;

  // Filetto ottone sotto la voce attiva
  const underline = (isActive: boolean) =>
    `absolute inset-x-0 -bottom-px h-0.5 origin-left bg-lol-gold transition-transform duration-300 ${
      isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-50"
    }`;

  return (
    <nav className="sticky top-0 z-40 border-b border-lol-gold/15 bg-[#060a12]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <Link to="/" className="flex items-center gap-3">
          <Mark />
          <span className="hidden font-display text-2xl font-bold tracking-tight text-lol-text sm:block">Team Organizer</span>
        </Link>

        <div className="flex items-center gap-5 sm:gap-8">
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
          <Link to="/new" className={`${btnPrimary} !px-3.5 !py-2 sm:!px-4`}>
            <Plus size={16} aria-hidden /> Nuova sessione
          </Link>
        </div>
      </div>
    </nav>
  );
}
