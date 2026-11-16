import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getSession, createSession, updateSession, getChampions, getPlayers } from "../lib/api";
import { ROLES, ROLE_LABELS, MAX_CHAMPIONS, type Role, type SessionPlayer, type Champion } from "../types";
import { todayISO } from "../lib/utils";
import { championIcon } from "../lib/ddragon";
import { btnPrimary, btnGhost, panel, input, label, pageTitle } from "../lib/styles";
import LoadingSpinner from "../components/LoadingSpinner";
import OpggButton from "../components/OpggButton";

// Primo ruolo ancora libero, per il nuovo giocatore
function nextFreeRole(players: SessionPlayer[]): Role {
  const used = players.map((p) => p.role);
  return ROLES.find((r) => !used.includes(r)) ?? ROLES[0];
}

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      navigate("/");
    },
    onError: () => alert("Errore nel salvataggio. Controlla la password del team."),
  });

  const patchPlayer = (index: number, patch: Partial<SessionPlayer>) =>
    setPlayers(players.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const addPlayer = () => {
    if (players.length >= ROLES.length) return;
    setPlayers([...players, { name: "", role: nextFreeRole(players), champions: [] }]);
  };

  // Scegliendo un giocatore del team si copiano anche Riot ID e regione (se presenti)
  const selectTeamPlayer = (index: number, name: string) => {
    const team = teamPlayers.find((p) => p.name === name);
    const { riotId: _r, region: _g, ...rest } = players[index];
    setPlayers(
      players.map((p, i) =>
        i === index ? { ...rest, name, ...(team?.riotId && team.region ? { riotId: team.riotId, region: team.region } : {}) } : p,
      ),
    );
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
    players.length > 0 &&
    players.every((p) => p.name && p.champions.length >= 1) &&
    new Set(players.map((p) => p.role)).size === players.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      alert("Compila tutti i campi: ogni giocatore deve avere un nome, un ruolo univoco e almeno un campione.");
      return;
    }
    mutation.mutate({ date, time, players, notes });
  };

  if (loadingChampions || loadingPlayers) return <LoadingSpinner />;

  const sortedChampions = [...champions].sort((a, b) => a.name.localeCompare(b.name, "it"));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className={pageTitle}>{id ? "Modifica sessione" : "Nuova sessione"}</h1>
        <button onClick={() => navigate("/")} className="text-sm text-lol-text/60 hover:text-lol-gold">
          ← Torna al calendario
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
            <h2 className="font-display text-lg uppercase tracking-widest text-lol-gold">Composizione</h2>
            {players.length < ROLES.length && (
              <button type="button" onClick={addPlayer} className={btnGhost}>+ Giocatore</button>
            )}
          </div>

          {players.length === 0 && (
            <p className="text-sm text-lol-text/50">Aggiungi i giocatori della sessione.</p>
          )}

          {players.map((player, index) => {
            const full = player.champions.length >= MAX_CHAMPIONS;
            const available = sortedChampions.filter((c) => !player.champions.some((p) => p.id === c.id));
            return (
              <div key={index} className={`${panel} space-y-4`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-display uppercase tracking-widest text-lol-gold">Giocatore {index + 1}</h3>
                  <button type="button" onClick={() => removePlayer(index)} className="text-sm text-red-400 hover:underline">
                    Rimuovi
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className={label}>Giocatore</label>
                      <OpggButton riotId={player.riotId} region={player.region} />
                    </div>
                    <select value={player.name} onChange={(e) => selectTeamPlayer(index, e.target.value)} className={input}>
                      <option value="">Seleziona...</option>
                      {teamPlayers.map((p) => (
                        <option key={p.id} value={p.name}>{p.name}</option>
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
                        className="flex items-center gap-2 rounded-sm border border-lol-gold-dark bg-[#010a13] py-1 pl-1 pr-2 text-sm"
                      >
                        <img src={championIcon(c.id)} alt="" className="h-6 w-6 rounded-full" />
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
