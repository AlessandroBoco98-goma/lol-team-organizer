import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getSession, deleteSession, getPlayers, updateSession } from "../lib/api";
import { ROLES, ROLE_COLORS, ROLE_LABELS, RSVP_COLORS, RSVP_LABELS, type SessionPlayer } from "../types";
import { championIcon } from "../lib/ddragon";
import { formatDate, formatTime, isPastSession, googleCalendarUrl, resolveSessionPlayer, rsvpOf, rsvpCounts, playersFromRsvp, whatsappShareUrl } from "../lib/utils";
import { btnPrimary, btnGhost, btnDanger, panel, pageTitle } from "../lib/styles";
import LoadingSpinner from "../components/LoadingSpinner";
import OpggButton from "../components/OpggButton";
import RsvpPanel from "../components/RsvpPanel";

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

  const yesCount = rsvpCounts(session, teamPlayers).yes;

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
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/")} className="text-sm text-lol-text/60 hover:text-lol-gold">
          ← Calendario
        </button>
        <span
          className={`rounded-sm px-3 py-1 font-display text-xs uppercase tracking-widest ${
            past ? "bg-lol-text/10 text-lol-text/60" : "bg-lol-teal/15 text-lol-teal"
          }`}
        >
          {past ? "Conclusa" : "In programma"}
        </span>
      </div>

      <section className={`${panel} space-y-2`}>
        <h1 className={pageTitle}>{formatDate(session.date)}</h1>
        <p className="text-lol-text/70">Ore {formatTime(session.time)}</p>
      </section>

      <RsvpPanel session={session} teamPlayers={teamPlayers} past={past} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg uppercase tracking-widest text-lol-gold">Composizione team</h2>
          {!past && yesCount > 0 && (
            <button type="button" onClick={handleCompose} disabled={composeMutation.isPending} className={btnGhost}>
              {composeMutation.isPending ? "Imposto..." : `Imposta giocatori dai "Ci sono" (${yesCount})`}
            </button>
          )}
        </div>
        {session.players.length === 0 && (
          <p className="text-sm text-lol-text/50">
            Nessun giocatore ancora: condividi la sessione su WhatsApp e, quando hanno risposto, imposta la squadra
            dai "Ci sono".
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {session.players.map((raw, i) => {
            const p = resolveSessionPlayer(raw, teamPlayers);
            const status = rsvpOf(session, raw, teamPlayers);
            return (
            <div
              key={i}
              className="rounded-md border border-lol-gold-dark bg-lol-panel/80 p-5"
              style={{ borderTop: `4px solid ${ROLE_COLORS[p.role]}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-lg font-bold">{p.name}</p>
                <OpggButton riotId={p.riotId} region={p.region} />
              </div>
              <p
                className="mb-4 font-display text-xs uppercase tracking-widest"
                style={{ color: ROLE_COLORS[p.role] }}
              >
                {ROLE_LABELS[p.role]}
              </p>
              {status && (
                <p className="mb-3 text-xs font-medium" style={{ color: RSVP_COLORS[status] }}>
                  {RSVP_LABELS[status]}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                {p.champions.map((c) => (
                  <div key={c.id} className="flex w-16 flex-col items-center gap-1">
                    <img src={championIcon(c.id)} alt={c.name} className="h-14 w-14 rounded-md border border-lol-gold-dark" />
                    <span className="text-center text-[11px] leading-tight text-lol-text/70">{c.name}</span>
                  </div>
                ))}
                {p.champions.length === 0 && <span className="text-sm text-lol-text/40">Nessun campione</span>}
              </div>
            </div>
            );
          })}
        </div>
      </section>

      {session.notes && (
        <section className={panel}>
          <h2 className="mb-2 font-display text-lg uppercase tracking-widest text-lol-gold">Note</h2>
          <p className="whitespace-pre-line text-lol-text/80">{session.notes}</p>
        </section>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {!past && (
          <a href={whatsappShareUrl(session, window.location.origin)} target="_blank" rel="noreferrer" className={btnPrimary}>
            Condividi su WhatsApp
          </a>
        )}
        <a href={googleCalendarUrl(session)} target="_blank" rel="noreferrer" className={btnGhost}>
          + Google Calendar
        </a>
        <Link to={`/edit/${session.id}`} className={btnGhost}>Modifica</Link>
        <button onClick={handleDelete} className={btnDanger}>Elimina</button>
      </div>
    </div>
  );
}
