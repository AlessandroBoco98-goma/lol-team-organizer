export const DDRAGON_VERSION = '16.22.1';

const BASE = 'https://ddragon.leagueoflegends.com';

export const championIcon = (id: string) => `${BASE}/cdn/${DDRAGON_VERSION}/img/champion/${id}.png`;

// Per oggetti e rune serve la versione più recente: gli oggetti nuovi non esistono nelle patch vecchie
export async function getLatestVersion(): Promise<string> {
  try {
    const versions: string[] = await fetch(`${BASE}/api/versions.json`).then((r) => r.json());
    return versions[0] ?? DDRAGON_VERSION;
  } catch {
    return DDRAGON_VERSION;
  }
}

export const itemIcon = (version: string, itemId: number) => `${BASE}/cdn/${version}/img/item/${itemId}.png`;

// id oggetto -> nome, per i suggerimenti al passaggio del mouse
export async function getItemNames(version: string): Promise<Record<number, string>> {
  const json = await fetch(`${BASE}/cdn/${version}/data/it_IT/item.json`).then((r) => r.json());
  return Object.fromEntries(Object.entries(json.data as Record<string, { name: string }>).map(([id, i]) => [Number(id), i.name]));
}

export interface KeystoneInfo {
  name: string;
  icon: string;
}

// id runa principale -> nome e icona
export async function getKeystones(version: string): Promise<Record<number, KeystoneInfo>> {
  const trees: { slots: { runes: { id: number; name: string; icon: string }[] }[] }[] = await fetch(
    `${BASE}/cdn/${version}/data/it_IT/runesReforged.json`,
  ).then((r) => r.json());
  const result: Record<number, KeystoneInfo> = {};
  for (const tree of trees) {
    for (const rune of tree.slots[0]?.runes ?? []) result[rune.id] = { name: rune.name, icon: `${BASE}/cdn/img/${rune.icon}` };
  }
  return result;
}
