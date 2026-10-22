// Generated avatars: a mirrored 5×5 pattern in one hue, drawn from `users.avatar_seed`. Pure, so
// the profile form's shuffle previews it in the browser; the same seed always draws the same one.

/** What a stored seed may look like (the DB default makes 8 hex chars, the dev seed digits). */
export const AVATAR_SEED_RE = /^[0-9a-z]{1,16}$/;

/** A fresh random seed (shuffle). */
export const newAvatarSeed = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

/** Hue (0-359) and the filled cells ([column, row], 0-4), mirrored left to right. */
export function avatarPattern(seed: string) {
  // FNV-1a hash of the seed feeds mulberry32, a small deterministic PRNG.
  let x = 0x811c9dc5;
  for (const c of seed) x = Math.imul(x ^ c.codePointAt(0)!, 0x01000193);
  const next = () => {
    x = (x + 0x6d2b79f5) | 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
  const hue = Math.floor(next() * 360);
  const cells: [number, number][] = [];
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 3; col++)
      if (next() < 0.5) {
        cells.push([col, row]);
        if (col < 2) cells.push([4 - col, row]);
      }
  return { hue, cells };
}
