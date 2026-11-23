import { useState } from "react";

const ME_KEY = "lol-team-me";

function readMe(): string {
  try {
    return localStorage.getItem(ME_KEY) ?? "";
  } catch {
    return "";
  }
}

// "Chi sei?": non ci sono account, quindi ognuno sceglie il proprio giocatore e la scelta resta nel suo browser.
// Condivisa tra la pagina di votazione e il pannello di disponibilità della sessione.
export function useMe(): [string, (playerId: string) => void] {
  const [me, setMeState] = useState(readMe);
  const setMe = (playerId: string) => {
    setMeState(playerId);
    try {
      localStorage.setItem(ME_KEY, playerId);
    } catch {
      // senza localStorage la scelta vale solo finché la pagina resta aperta
    }
  };
  return [me, setMe];
}
