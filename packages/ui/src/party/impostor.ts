/* Reparto de roles de «El Impostor» (puro y probado). Se hace en el dispositivo: no hay efectos económicos ni se guardan nombres. */

export interface ImpostorDeal {
  category: string;
  word: string;
  /** Posiciones (0-based) de quienes son impostores. */
  impostors: number[];
  /** Quién habla primero. */
  starter: number;
}

export function dealImpostor(
  players: number,
  impostors: number,
  categories: ReadonlyArray<{ name: string; words: readonly string[] }>,
  chosenCategory: number | null,
  rng: () => number = Math.random,
): ImpostorDeal {
  const int = (n: number) => Math.min(n - 1, Math.floor(rng() * n));
  const cat = categories[chosenCategory ?? int(categories.length)] ?? (categories[0] as (typeof categories)[number]);
  const word = cat.words[int(cat.words.length)] as string;
  const count = Math.max(1, Math.min(impostors, players - 2));
  const pool = Array.from({ length: players }, (_, i) => i);
  const picked: number[] = [];
  while (picked.length < count) picked.push(pool.splice(int(pool.length), 1)[0] as number);
  return { category: cat.name, word, impostors: picked.sort((a, b) => a - b), starter: int(players) };
}
