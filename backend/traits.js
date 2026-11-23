// Tratti dei campioni per le comp: danno, resistenza, controllo, mobilità, utilità (0-3, da Community Dragon),
// tipo di danno e ruoli in cui il campione si gioca (da Meraki). Fonti gratuite, senza chiave.
const CDRAGON_URL = (key) => `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/${key}.json`;
const MERAKI_URL = 'https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json';

// Ruoli di Meraki -> ruoli dell'app
const APP_POSITIONS = { TOP: 'TOP', JUNGLE: 'JUNGLE', MIDDLE: 'MID', BOTTOM: 'ADC', SUPPORT: 'SUPPORT', UTILITY: 'SUPPORT' };

const DAMAGE_TYPES = { kPhysical: 'physical', kMagic: 'magic', kMixed: 'mixed' };

// Ripiego quando Community Dragon non ha il campione: si ricava il possibile da Data Dragon
function fromDataDragon(champ) {
  const info = champ.info ?? { attack: 0, defense: 0, magic: 0 };
  const known = info.attack + info.magic > 0;
  const damageType = !known ? 'mixed' : info.attack > info.magic + 2 ? 'physical' : info.magic > info.attack + 2 ? 'magic' : 'mixed';
  const tags = champ.tags ?? [];
  return {
    damage: known ? Math.min(3, Math.round(Math.max(info.attack, info.magic) / 3.4)) : 2,
    durability: tags.includes('Tank') ? 3 : tags.includes('Fighter') ? 2 : known ? Math.min(3, Math.round(info.defense / 3.4)) : 1,
    crowdControl: tags.includes('Tank') || tags.includes('Support') ? 2 : 1,
    mobility: tags.includes('Assassin') ? 2 : 1,
    utility: tags.includes('Support') ? 2 : 1,
    damageType,
  };
}

// Unisce le fonti in un unico oggetto per campione
function buildTraits(champ, cdragon, merakiEntry) {
  const p = cdragon?.playstyleInfo;
  const t = cdragon?.tacticalInfo;
  const base = p && t
    ? {
        damage: p.damage,
        durability: p.durability,
        crowdControl: p.crowdControl,
        mobility: p.mobility,
        utility: p.utility,
        damageType: DAMAGE_TYPES[t.damageType] ?? 'mixed',
      }
    : fromDataDragon(champ);
  const positions = Array.isArray(merakiEntry?.positions) && merakiEntry.positions.length > 0
    ? [...new Set(merakiEntry.positions.map((x) => APP_POSITIONS[x]).filter(Boolean))]
    : null; // sconosciuti: nessun limite di ruolo
  return { ...base, positions, source: p && t ? 'communitydragon' : 'datadragon' };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Servizio con cache in memoria (24 ore). Le richieste parallele condividono lo stesso caricamento.
// listChampions: async () => [{ id, key, tags, info }] (da Data Dragon)
function createTraitsService({ listChampions, fetchFn = fetch, ttlMs = 24 * 60 * 60 * 1000, now = () => Date.now(), concurrency = 8 }) {
  let cache = null;
  let loading = null;

  async function getJson(url) {
    try {
      const res = await fetchFn(url);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  async function load() {
    const champs = await listChampions();
    // Meraki è un file solo e serve solo per i ruoli: se manca, i ruoli restano "sconosciuti"
    const meraki = (await getJson(MERAKI_URL)) ?? {};
    const merakiByKey = new Map(Object.values(meraki).map((m) => [String(m.id), m]));

    const entries = await mapLimit(champs, concurrency, async (champ) => {
      const cdragon = await getJson(CDRAGON_URL(champ.key));
      return [champ.id, buildTraits(champ, cdragon, merakiByKey.get(String(champ.key)))];
    });
    return Object.fromEntries(entries);
  }

  async function getTraits() {
    if (cache && now() - cache.at < ttlMs) return cache.value;
    loading ??= load()
      .then((value) => {
        cache = { at: now(), value };
        return value;
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  }

  return { getTraits };
}

module.exports = { APP_POSITIONS, buildTraits, createTraitsService };
