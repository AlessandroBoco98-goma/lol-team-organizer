import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPlayers, createPlayer, updatePlayer, deletePlayer } from "../lib/api";
import { REGIONS, RIOT_ID_REGEX, type Player, type Region } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import OpggButton from "../components/OpggButton";
import { btnPrimary, btnGhost, panel, input, label, pageTitle } from "../lib/styles";

interface PlayerDraft {
  name: string;
  riotId: string;
  region: Region | "";
}

const emptyDraft: PlayerDraft = { name: "", riotId: "", region: "" };

// Riot ID e regione sono opzionali, ma vanno indicati insieme e in formato valido
function draftError(d: PlayerDraft): string | null {
  const riotId = d.riotId.trim();
  if (!riotId && !d.region) return null;
  if (!riotId || !d.region) return "Indica sia il Riot ID sia la regione, oppure lascia vuoti entrambi.";
  if (!RIOT_ID_REGEX.test(riotId)) return "Riot ID non valido: usa il formato Nome#TAG (es. Faker#KR1).";
  return null;
}

function toPayload(d: PlayerDraft) {
  const riotId = d.riotId.trim();
  return {
    name: d.name.trim(),
    ...(riotId && d.region ? { riotId, region: d.region } : {}),
  };
}

function RiotFields({ draft, onChange }: { draft: PlayerDraft; onChange: (d: PlayerDraft) => void }) {
  const error = draftError(draft);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label className={label}>Riot ID (opzionale)</label>
        <input
          type="text"
          value={draft.riotId}
          onChange={(e) => onChange({ ...draft, riotId: e.target.value })}
          placeholder="Es: Faker#KR1"
          className={input}
        />
        <p className="mt-1 text-xs text-lol-text/50">
          Formato Nome#TAG (es. Faker#KR1). Il tag è la parte dopo il #: lo trovi nel client LoL o su Riot Account
          Management.
        </p>
      </div>
      <div>
        <label className={label}>Regione (opzionale)</label>
        <select
          value={draft.region}
          onChange={(e) => onChange({ ...draft, region: e.target.value as Region | "" })}
          className={input}
        >
          <option value="">Seleziona...</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-lol-text/50">Il server su cui giochi.</p>
      </div>
      {error && <p className="text-xs text-red-400 md:col-span-2">{error}</p>}
    </div>
  );
}

export default function Players() {
  const queryClient = useQueryClient();
  const [newPlayer, setNewPlayer] = useState<PlayerDraft>(emptyDraft);
  const [editing, setEditing] = useState<Player | null>(null);
  const [editDraft, setEditDraft] = useState<PlayerDraft>(emptyDraft);

  const { data: players = [], isLoading, error } = useQuery({
    queryKey: ["players"],
    queryFn: getPlayers,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["players"] });

  const createMutation = useMutation({
    mutationFn: createPlayer,
    onSuccess: () => {
      refresh();
      setNewPlayer(emptyDraft);
    },
    onError: () => alert("Errore nella creazione. Controlla la password del team e il Riot ID."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: PlayerDraft }) => updatePlayer(id, toPayload(draft)),
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
    onError: () => alert("Errore nell'aggiornamento."),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlayer,
    onSuccess: refresh,
    onError: () => alert("Errore nell'eliminazione."),
  });

  const createInvalid = !newPlayer.name.trim() || !!draftError(newPlayer);
  const editInvalid = !editDraft.name.trim() || !!draftError(editDraft);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createInvalid) createMutation.mutate(toPayload(newPlayer));
  };

  const openEdit = (player: Player) => {
    setEditing(player);
    setEditDraft({ name: player.name, riotId: player.riotId ?? "", region: player.region ?? "" });
  };

  const handleSaveEdit = () => {
    if (editing && !editInvalid) updateMutation.mutate({ id: editing.id, draft: editDraft });
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <p className="text-red-400">Errore nel caricamento dei giocatori.</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className={pageTitle}>Giocatori</h1>
        <p className="mt-1 text-lol-text/60">I membri del tuo team</p>
      </div>

      <form onSubmit={handleCreate} className={`${panel} space-y-4`}>
        <div>
          <label className={label}>Nuovo giocatore</label>
          <input
            type="text"
            value={newPlayer.name}
            onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
            placeholder="Es: Faker"
            className={input}
          />
        </div>
        <RiotFields draft={newPlayer} onChange={setNewPlayer} />
        <div className="flex justify-end">
          <button type="submit" disabled={createMutation.isPending || createInvalid} className={btnPrimary}>
            {createMutation.isPending ? "Aggiungo..." : "Aggiungi"}
          </button>
        </div>
      </form>

      <section className={`${panel} space-y-3`}>
        <h2 className="font-display uppercase tracking-widest text-lol-gold">Roster ({players.length})</h2>
        {players.length === 0 && <p className="py-6 text-center text-lol-text/50">Nessun giocatore registrato</p>}
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between rounded-sm border border-lol-gold-dark/50 bg-[#010a13]/60 px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium">{player.name}</span>
              {player.riotId && player.region && (
                <span className="text-xs text-lol-text/50">{player.riotId} · {player.region}</span>
              )}
              <OpggButton riotId={player.riotId} region={player.region} />
            </div>
            <div className="flex gap-4 text-sm">
              <button onClick={() => openEdit(player)} className="text-lol-gold hover:underline">Modifica</button>
              <button
                onClick={() => confirm("Eliminare questo giocatore?") && deleteMutation.mutate(player.id)}
                className="text-red-400 hover:underline"
              >
                Elimina
              </button>
            </div>
          </div>
        ))}
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className={`${panel} max-h-full w-full max-w-2xl space-y-4 overflow-y-auto`}>
            <h3 className="font-display text-lg uppercase tracking-widest text-lol-gold">Modifica giocatore</h3>
            <div>
              <label className={label}>Nome</label>
              <input
                type="text"
                value={editDraft.name}
                onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                className={input}
              />
            </div>
            <RiotFields draft={editDraft} onChange={setEditDraft} />
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className={btnGhost}>Annulla</button>
              <button onClick={handleSaveEdit} disabled={editInvalid || updateMutation.isPending} className={btnPrimary}>
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
