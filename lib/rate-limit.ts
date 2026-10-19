// In-memory sliding-window limiter for reads that write nothing to count (search). Per server
// process: with N replicas a user can get up to N times the limit, and a restart resets it.
// Writes are limited in Postgres instead (assertCanWrite in lib/services.ts).
import { RATE } from "@/lib/limits";

const hits = new Map<string, number[]>();

/** Records a search by this user; false if they are over RATE.search. */
export function allowSearch(userId: string, now = Date.now()) {
  const { max, minutes } = RATE.search;
  const since = now - minutes * 60_000;
  const recent = (hits.get(userId) ?? []).filter((t) => t > since);
  const ok = recent.length < max;
  if (ok) recent.push(now);
  hits.set(userId, recent);
  // Keep the map from growing with users who stopped searching.
  if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((t) => t > since)) hits.delete(k);
  return ok;
}
