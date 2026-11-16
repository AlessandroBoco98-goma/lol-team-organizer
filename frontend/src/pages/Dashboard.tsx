import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getSessions, deleteSession } from "../lib/api";
import { ROLE_COLORS, ROLE_LABELS } from "../types";
import { championIcon } from "../lib/ddragon";
import { formatDate, formatTime, isPastSession, googleCalendarUrl } from "../lib/utils";
import { btnPrimary, btnGhost, btnDanger, pageTitle } from "../lib/styles";
import LoadingSpinner from "../components/LoadingSpinner";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: sessions = [], isLoading, error } = useQuery({
    queryKey: ["sessions"],
    queryFn: getSessions,
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <p className="text-red-400">Errore nel caricamento delle sessioni.</p>;

  const sorted = [...sessions].sort(
    (a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime(),
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questa sessione?")) return;
    try {
      await deleteSession(id);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch {
      alert("Impossibile eliminare la sessione.");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={pageTitle}>Calendario Team</h1>
          <p className="mt-1 text-lol-text/60">Le sessioni programmate del tuo team</p>
        </div>
        <Link to="/new" className={btnPrimary}>+ Nuova sessione</Link>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-md border border-lol-gold-dark bg-lol-panel/80 p-12 text-center">
          <h3 className="font-display text-xl uppercase tracking-widest text-lol-gold">Nessuna sessione</h3>
          <p className="mt-2 text-lol-text/60">Crea la prima sessione per iniziare.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((s) => {
            const past = isPastSession(s);
            return (
              <article
                key={s.id}
                className={`overflow-hidden rounded-md border border-lol-gold-dark bg-lol-panel/80 ${past ? "opacity-50" : ""}`}
              >
                <header className="flex items-center justify-between border-b border-lol-gold-dark bg-linear-to-r from-[#1e2d3d] to-transparent px-5 py-3">
                  <div>
                    <p className="font-display text-sm uppercase tracking-wider text-lol-gold">{formatDate(s.date)}</p>
                    <p className="text-sm text-lol-text/70">{formatTime(s.time)}</p>
                  </div>
                  <span
                    className={`rounded-sm px-2 py-1 font-display text-[10px] uppercase tracking-widest ${
                      past ? "bg-lol-text/10 text-lol-text/60" : "bg-lol-teal/15 text-lol-teal"
                    }`}
                  >
                    {past ? "Conclusa" : "In programma"}
                  </span>
                </header>

                <ul className="space-y-3 p-5">
                  {s.players.map((p, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span
                        className="w-16 shrink-0 border py-0.5 text-center font-display text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: ROLE_COLORS[p.role], borderColor: ROLE_COLORS[p.role] }}
                      >
                        {ROLE_LABELS[p.role]}
                      </span>
                      <span className="w-24 truncate text-sm font-medium">{p.name}</span>
                      <div className="flex -space-x-2">
                        {p.champions.map((c) => (
                          <img
                            key={c.id}
                            src={championIcon(c.id)}
                            alt={c.name}
                            title={c.name}
                            className="h-8 w-8 rounded-full border-2 border-lol-gold-dark"
                          />
                        ))}
                      </div>
                    </li>
                  ))}
                  {s.players.length === 0 && <li className="text-sm text-lol-text/50">Nessun giocatore</li>}
                </ul>

                {s.notes && <p className="px-5 pb-3 text-sm italic text-lol-text/60 line-clamp-2">{s.notes}</p>}

                <footer className="flex flex-wrap gap-2 border-t border-lol-gold-dark px-5 py-3">
                  <Link to={`/session/${s.id}`} className="text-sm text-lol-gold hover:underline">Dettagli</Link>
                  <Link to={`/edit/${s.id}`} className="text-sm text-lol-gold hover:underline">Modifica</Link>
                  <a
                    href={googleCalendarUrl(s)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-lol-teal hover:underline"
                  >
                    Google Calendar
                  </a>
                  <button onClick={() => handleDelete(s.id)} className="ml-auto text-sm text-red-400 hover:underline">
                    Elimina
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
