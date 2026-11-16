import { Link, NavLink } from "react-router-dom";

export default function Navbar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `font-display uppercase tracking-widest text-sm transition ${
      isActive ? "text-lol-gold" : "text-lol-text/70 hover:text-lol-gold"
    }`;

  return (
    <nav className="sticky top-0 z-40 border-b border-lol-gold-dark bg-[#010a13]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 rotate-45 items-center justify-center border-2 border-lol-gold bg-lol-panel">
            <span className="-rotate-45 font-display text-xs font-bold text-lol-gold">LoL</span>
          </div>
          <span className="font-display text-lg font-bold uppercase tracking-widest text-lol-gold">
            Team Organizer
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <NavLink to="/" end className={linkClass}>Calendario</NavLink>
          <NavLink to="/players" className={linkClass}>Giocatori</NavLink>
          <Link
            to="/new"
            className="rounded-sm border border-[#f0e6d2]/50 bg-linear-to-b from-[#c8aa6e] to-[#785a28] px-4 py-2 font-display text-sm font-bold uppercase tracking-widest text-[#010a13] hover:brightness-110"
          >
            + Sessione
          </Link>
        </div>
      </div>
    </nav>
  );
}
