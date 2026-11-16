import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPlayers, createPlayer, updatePlayer, deletePlayer } from "../lib/api";
import type { Player } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import { btnPrimary, btnGhost, panel, input, label, pageTitle } from "../lib/styles";

export default function Players() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Player | null>(null);
  const [editName, setEditName] = useState("");

  const { data: players = [], isLoading, error } = useQuery({
    queryKey: ["players"],
    queryFn: getPlayers,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["players"] });

  const createMutation = useMutation({
    mutationFn: createPlayer,
    onSuccess: () => {
      refresh();
      setNewName("");
    },
    onError: () => alert("Errore nella creazione. Controlla la password del team."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updatePlayer(id, { name }),
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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) createMutation.mutate({ name: newName.trim() });
  };

  const openEdit = (player: Player) => {
    setEditing(player);
    setEditName(player.name);
  };

  const handleSaveEdit = () => {
    if (editing && editName.trim()) updateMutation.mutate({ id: editing.id, name: editName.trim() });
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <p className="text-red-400">Errore nel caricamento dei giocatori.</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className={pageTitle}>Giocatori</h1>
        <p className="mt-1 text-lol-text/60">I membri del tuo team</p>
      </div>

      <form onSubmit={handleCreate} className={`${panel} flex flex-col gap-4 sm:flex-row sm:items-end`}>
        <div className="flex-1">
          <label className={label}>Nuovo giocatore</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Es: Faker"
            className={input}
          />
        </div>
        <button type="submit" disabled={createMutation.isPending || !newName.trim()} className={btnPrimary}>
          {createMutation.isPending ? "Aggiungo..." : "Aggiungi"}
        </button>
      </form>

      <section className={`${panel} space-y-3`}>
        <h2 className="font-display uppercase tracking-widest text-lol-gold">Roster ({players.length})</h2>
        {players.length === 0 && <p className="py-6 text-center text-lol-text/50">Nessun giocatore registrato</p>}
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between rounded-sm border border-lol-gold-dark/50 bg-[#010a13]/60 px-4 py-3"
          >
            <span className="font-medium">{player.name}</span>
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
          <div className={`${panel} w-full max-w-md space-y-4`}>
            <h3 className="font-display text-lg uppercase tracking-widest text-lol-gold">Modifica giocatore</h3>
            <div>
              <label className={label}>Nome</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={input} />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className={btnGhost}>Annulla</button>
              <button onClick={handleSaveEdit} className={btnPrimary}>Salva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
