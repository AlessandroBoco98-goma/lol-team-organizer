import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { setRsvp } from "./api";
import { CONFIRM_THRESHOLD, type RsvpStatus } from "../types";

// Salva il voto di un giocatore su una sessione e aggiorna le liste.
// Se il voto fa raggiungere le conferme necessarie, avvisa che la sessione è stata creata.
export function useRsvpMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playerId, status }: { playerId: string; status: RsvpStatus | null }) => setRsvp(sessionId, playerId, status),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      if (result.confirmedNow) toast.success(`Con ${CONFIRM_THRESHOLD} conferme la sessione è stata creata: sto compilando la squadra`);
    },
    onError: () => toast.error("La risposta non è stata salvata. Controlla la password del team."),
  });
}
