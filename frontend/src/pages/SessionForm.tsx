import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getSession, createSession, updateSession, getChampions, getPlayers } from "../lib/api";
import { ArrowLeft, Plus, Trash2, Users } from "lucide-react";
import { ROLES, ROLE_COLORS, ROLE_LABELS, MAX_CHAMPIONS, type Role, type SessionPlayer, type Champion } from "../types";
import { todayISO, findTeamPlayer, resolveSessionPlayer, nextFreeRole } from "../lib/utils";
import { championIcon } from "../lib/ddragon";
import { btnPrimary, btnGhost, panel, input, label, pageTitle, sectionTitle } from "../lib/styles";
import LoadingSpinner from "../components/LoadingSpinner";
import OpggButton from "../components/OpggButton";

export default function SessionForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(todayISO);
  const [time, setTime] = useState("20:00");
  const [notes, setNotes] = useState("");
  const [players, setPlayers] = useState<SessionPlayer[]>([]);

  const { data: existingSession } = useQuery({
    queryKey: ["session", id],
    queryFn: () => getSession(id!),
    enabled: !!id,
  });
  const { data: champions = [], isLoading: loadingChampions } = useQuery({
    queryKey: ["champions"],
    queryFn: () => getChampions(undefined, "it_IT"),
  });
  const { data: teamPlayers = [], isLoading: loadingPlayers } = useQuery({
    queryKey: ["players"],
    queryFn: getPlayers,
  });

  useEffect(() => {
    if (existingSession) {
      setDate(existingSession.date);
      setTime(existingSession.time);
      setNotes(existingSession.notes || "");
      setPlayers(existingSession.players);
    }
  }, [existingSession]);

  const mutation = useMutation({
    mutationFn: (payload: { date: string; time: string; players: SessionPlayer[]; notes: string }) =>
      id ? updateSession(id, payload) : createSession(payload),
    onSuccess: (saved, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["session", saved.id] });
      // Senza giocatori la sessione serve a raccogliere le disponibilità: si va al dettaglio per condividerla
      navigate(variables.players.length === 0 ? `/session/${saved.id}` : "/");
    },
    onError: () => alert("Errore nel salvataggio. Controlla la password del team."),
  });

  const patchPlayer = (index: number, patch: Partial<SessionPlayer>) =>
    setPlayers(players.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const addPlayer = () => {
    if (players.length >= ROLES.length) return;
    setPlayers([...players, { name: "", role: nextFreeRole(players), champions: [] }]);
  };

  // Scegliendo un giocatore del roster si salvano id, nome e (se presenti) Riot ID e regione
  const selectTeamPlayer = (index: number, teamPlayerId: string) => {
    const team = teamPlayers.find((p) => p.id === teamPlayerId);
    if (!team) return;
    setPlayers(players.map((p, i) => (i === index ? resolveSessionPlayer({ ...p, playerId: team.id }, teamPlayers) : p)));
  };

  const removePlayer = (index: number) => setPlayers(players.filter((_, i) => i !== index));

  const addChampion = (index: number, champ: Champion) => {
    const current = players[index];
    if (current.champions.length >= MAX_CHAMPIONS) return;
    if (current.champions.some((c) => c.id === champ.id)) return;
    patchPlayer(index, { champions: [...current.champions, { id: champ.id, name: champ.name }] });
  };

  const removeChampion = (index: number, championId: string) =>
    patchPlayer(index, { champions: players[index].champions.filter((c) => c.id !== championId) });

  const isRoleTaken = (role: Role, index: number) =>
    players.some((p, i) => i !== index && p.role === role);

  const isValid =
    !!date &&
    !!time &&
    players.every((p) => p.name && p.champions.length >= 1) &&
    new Set(players.map((p) => p.role)).size === players.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      alert("Compila tutti i campi: ogni giocatore aggiunto deve avere un nome, un ruolo univoco e almeno un campione.");
      return;
    }
    // Allinea nomi e Riot ID dei giocatori ai dati attuali del roster prima di salvare
    mutation.mutate({ date, time, players: players.map((p) => resolveSessionPlayer(p, teamPlayers)), notes });
  };

  if (loadingChampions || loadingPlayers) return <LoadingSpinner />;

  const sortedChampions = [...champions].sort((a, b) => a.name.localeCompare(b.name, "it"));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={pageTitle}>{id ? "Modifica sessione" : "Nuova sessione"}</h1>
          <div className="title-rule mt-3" />
        </div>
        <button
          onClick={() => navigate("/")}
          className="group flex items-center gap-2 text-sm text-lol-text/60 transition hover:text-lol-gold"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" aria-hidden /> Torna al calendario
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className={`${panel} grid gap-4 md:grid-cols-2`}>
          <div>
            <label className={label}>Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} min={todayISO()} />
          </div>
          <div>
            <label className={label}>Ora</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={sectionTitle}>
              <Users size={20} aria-hidden /> Composizione
            </h2>
            {players.length < ROLES.length && (
              <button type="button" onClick={addPlayer} className={btnGhost}>
                <Plus size={16} aria-hidden /> Giocatore
              </button>
            )}
          </div>

          {players.length === 0 && (
            <p className="text-sm text-lol-text/50">
              Aggiungi i giocatori della sessione, oppure lascia vuoto: condividi la sessione su WhatsApp e componi
              la squadra dai "Ci sono".
            </p>
          )}

          {players.map((player, index) => {
            const full = player.champions.length >= MAX_CHAMPIONS;
            const shown = resolveSessionPlayer(player, teamPlayers);
            const inRoster = !!findTeamPlayer(player, teamPlayers);
            const available = sortedChampions.filter((c) => !player.champions.some((p) => p.id === c.id));
            return (
              <div
                key={index}
                className={`${panel} animate-pop space-y-4 border-l-4`}
                style={{ borderLeftColor: ROLE_COLORS[player.role] }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display uppercase tracking-widest text-lol-gold">Giocatore {index + 1}</h3>
                  <button
                    type="button"
                    onClick={() => removePlayer(index)}
                    className="flex items-center gap-1.5 text-sm text-red-400/80 transition hover:text-red-400"
                  >
                    <Trash2 size={14} aria-hidden /> Rimuovi
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className={label}>Giocatore</label>
                      <OpggButton riotId={shown.riotId} region={shown.region} />
                    </div>
                    <select
                      value={inRoster ? findTeamPlayer(player, teamPlayers)!.id : player.name ? "__removed" : ""}
                      onChange={(e) => selectTeamPlayer(index, e.target.value)}
                      className={input}
                    >
                      <option value="">Seleziona...</option>
                      {!inRoster && player.name && (
                        <option value="__removed" disabled>{player.name} (non più nel roster)</option>
                      )}
                      {teamPlayers.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label}>Ruolo</label>
                    <select value={player.role} onChange={(e) => patchPlayer(index, { role: e.target.value as Role })} className={input}>
                      {ROLES.map((role) => (
                        <option key={role} value={role} disabled={isRoleTaken(role, index)}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                    {isRoleTaken(player.role, index) && (
                      <p className="mt-1 text-xs text-red-400">Ruolo già assegnato</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className={label}>Campioni ({player.champions.length}/{MAX_CHAMPIONS})</label>
                  <div className="mb-3 flex min-h-8 flex-wrap gap-2">
                    {player.champions.map((c) => (
                      <span
                        key={c.id}
                        className="animate-pop flex items-center gap-2 rounded-full border border-lol-gold/30 bg-[#010a13]/70 py-1 pl-1 pr-3 text-sm transition hover:border-lol-gold/60"
                      >
                        <img src={championIcon(c.id)} alt="" className="h-6 w-6 rounded-full ring-1 ring-lol-gold/40" />
                        {c.name}
                        <button
                          type="button"
                          onClick={() => removeChampion(index, c.id)}
                          className="text-lol-text/50 hover:text-red-400"
                          aria-label={`Rimuovi ${c.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {player.champions.length === 0 && (
                      <span className="text-sm text-lol-text/40">Nessun campione scelto</span>
                    )}
                  </div>
                  <select
                    disabled={full}
                    value=""
                    onChange={(e) => {
                      const champ = champions.find((c) => c.id === e.target.value);
                      if (champ) addChampion(index, champ);
                    }}
                    className={input}
                  >
                    <option value="">{full ? "Limite di 3 campioni raggiunto" : "Aggiungi campione..."}</option>
                    {available.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </section>

        <div className={`${panel} space-y-2`}>
          <label className={label}>Note (opzionale)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Es: focus su Baron, strategia di inizio partita..."
            className={`${input} min-h-24 resize-y`}
          />
        </div>

        <div className="flex justify-end gap-4">
          <button type="button" onClick={() => navigate("/")} className={btnGhost}>Annulla</button>
          <button type="submit" disabled={mutation.isPending || !isValid} className={btnPrimary}>
            {mutation.isPending ? "Salvataggio..." : id ? "Salva modifiche" : "Crea sessione"}
          </button>
        </div>
      </form>
    </div>
  );
}
