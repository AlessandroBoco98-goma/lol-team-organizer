import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorMessage, setRsvp } from "./api";
import { CONFIRM_THRESHOLD, type Role, type RsvpStatus } from "../types";

// Salva il voto di un giocatore su una sessione e aggiorna le liste. Chi vota "yes" indica anche il ruolo.
// Se il voto fa raggiungere le conferme necessarie, avvisa che la sessione è stata creata.
export function useRsvpMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playerId, status, role }: { playerId: string; status: RsvpStatus | null; role?: Role }) =>
      setRsvp(sessionId, playerId, status, role),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      if (result.confirmedNow) toast.success(`Con ${CONFIRM_THRESHOLD} conferme la sessione è stata creata: sto compilando la squadra`);
    },
    onError: (e) => {
      // Un ruolo già preso, o altri problemi, arrivano dal server con un messaggio chiaro
      toast.error(apiErrorMessage(e, "La risposta non è stata salvata. Controlla la password del team."));
      // Il ruolo può essere stato preso nel frattempo: si ricaricano i voti per mostrare quelli liberi
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
  });
}
