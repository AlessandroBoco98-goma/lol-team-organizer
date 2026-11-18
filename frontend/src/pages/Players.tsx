import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPlayers, createPlayer, updatePlayer, deletePlayer } from "../lib/api";
import { REGIONS, RIOT_ID_REGEX, type Player, type Region } from "../types";
import { normalizePhone } from "../lib/utils";
import LoadingSpinner from "../components/LoadingSpinner";
import OpggButton from "../components/OpggButton";
import RiotStatsButton from "../components/RiotStatsButton";
import Modal, { ModalTitle } from "../components/Modal";
import { toast } from "sonner";
import { MessageCircle, Pencil, Trash2, Users } from "lucide-react";
import { btnPrimary, btnGhost, panel, input, label, pageTitle, sectionTitle } from "../lib/styles";

interface PlayerDraft {
  name: string;
  riotId: string;
  region: Region | "";
  phone: string;
  // Il numero esiste ma il backend non l'ha inviato (password non ancora inserita): non va toccato
  phoneLocked?: boolean;
}

const emptyDraft: PlayerDraft = { name: "", riotId: "", region: "", phone: "" };

// Riot ID e regione sono opzionali, ma vanno indicati insieme e in formato valido; il telefono è opzionale
function draftError(d: PlayerDraft): string | null {
  const riotId = d.riotId.trim();
  if (riotId || d.region) {
    if (!riotId || !d.region) return "Indica sia il Riot ID sia la regione, oppure lascia vuoti entrambi.";
    if (!RIOT_ID_REGEX.test(riotId)) return "Riot ID non valido: usa il formato Nome#TAG (es. Faker#KR1).";
  }
  if (!d.phoneLocked && normalizePhone(d.phone) === null) {
    return "Numero non valido: usa il formato internazionale, es. +39 333 1234567.";
  }
  return null;
}

function toPayload(d: PlayerDraft) {
  const riotId = d.riotId.trim();
  return {
    name: d.name.trim(),
    ...(riotId && d.region ? { riotId, region: d.region } : {}),
    // Se il numero è nascosto non si invia il campo, così resta com'è
    ...(d.phoneLocked ? {} : { phone: normalizePhone(d.phone) ?? "" }),
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
      <div className="md:col-span-2">
        <label className={label}>Telefono WhatsApp (opzionale)</label>
        <input
          type="tel"
          value={draft.phoneLocked ? "" : draft.phone}
          disabled={draft.phoneLocked}
          onChange={(e) => onChange({ ...draft, phone: e.target.value })}
          placeholder={draft.phoneLocked ? "Numero già salvato: inserisci la password del team e ricarica" : "Es: +39 333 1234567"}
          className={input}
        />
        <p className="mt-1 text-xs text-lol-text/50">
          Formato internazionale con il +. Serve per mandare un promemoria su WhatsApp a chi non ha risposto; lo vede
          solo chi ha la password del team.
        </p>
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
      toast.success("Giocatore aggiunto");
    },
    onError: () => toast.error("Il giocatore non è stato aggiunto. Controlla la password del team e il Riot ID."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: PlayerDraft }) => updatePlayer(id, toPayload(draft)),
    onSuccess: () => {
      refresh();
      setEditing(null);
      toast.success("Modifiche salvate");
    },
    onError: () => toast.error("Le modifiche non sono state salvate. Controlla la password del team."),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlayer,
    onSuccess: () => {
      refresh();
      toast.success("Giocatore eliminato");
    },
    onError: () => toast.error("Il giocatore non è stato eliminato. Controlla la password del team."),
  });

  const createInvalid = !newPlayer.name.trim() || !!draftError(newPlayer);
  const editInvalid = !editDraft.name.trim() || !!draftError(editDraft);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createInvalid) createMutation.mutate(toPayload(newPlayer));
  };

  const openEdit = (player: Player) => {
    setEditing(player);
    setEditDraft({
      name: player.name,
      riotId: player.riotId ?? "",
      region: player.region ?? "",
      phone: player.phone ?? "",
      phoneLocked: !!player.hasPhone && !player.phone,
    });
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
        <div className="title-rule mt-4" />
        <p className="mt-3 text-lol-mist">Chi fa parte del team e come trovarlo su Riot.</p>
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

      <section className="space-y-4">
        <h2 className={sectionTitle}>
          <Users size={20} aria-hidden /> Roster
          <span className="tabular rounded-full bg-white/10 px-2.5 py-0.5 font-sans text-xs font-medium text-lol-mist">{players.length}</span>
        </h2>
        {players.length === 0 && (
          <div className="panel p-10 text-center text-lol-mist">Nessun giocatore nel roster. Aggiungine uno qui sopra.</div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => (
            <div key={player.id} className="panel panel-hover flex flex-col gap-4 p-5">
              <div className="flex items-center gap-4">
                <div className="chamfer flex h-12 w-12 shrink-0 items-center justify-center bg-linear-to-b from-[#ecd9a8] to-[#a58545] font-display text-2xl font-extrabold text-[#060a12] [--c:10px]">
                  {player.name.trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-2xl font-bold leading-none">{player.name}</p>
                  {player.riotId && player.region ? (
                    <p className="mt-1 truncate text-xs text-lol-mist">{player.riotId} · {player.region}</p>
                  ) : (
                    <p className="mt-1 text-xs text-lol-mist/60">Riot ID non impostato</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <OpggButton riotId={player.riotId} region={player.region} />
                <RiotStatsButton playerId={player.id} name={player.name} riotId={player.riotId} region={player.region} />
                {(player.phone || player.hasPhone) && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-lol-teal/40 bg-lol-teal/10 px-2.5 py-0.5 text-[11px] text-lol-teal">
                    <MessageCircle size={11} aria-hidden /> WhatsApp
                  </span>
                )}
              </div>
              <div className="mt-auto flex items-center gap-4 border-t border-lol-gold/15 pt-3 text-sm">
                <button
                  onClick={() => openEdit(player)}
                  className="flex items-center gap-1.5 text-lol-gold transition hover:text-lol-text"
                >
                  <Pencil size={14} aria-hidden /> Modifica
                </button>
                <button
                  onClick={() => confirm("Eliminare questo giocatore?") && deleteMutation.mutate(player.id)}
                  className="ml-auto flex items-center gap-1.5 text-red-400/80 transition hover:text-red-400"
                  aria-label={`Elimina ${player.name}`}
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Modal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} className="max-w-2xl space-y-4">
        <ModalTitle asChild>
          <h3 className="font-display text-2xl font-bold">Modifica giocatore</h3>
        </ModalTitle>
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
            Salva modifiche
          </button>
        </div>
      </Modal>
    </div>
  );
}
