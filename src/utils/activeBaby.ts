import { kvGet, kvSet } from '../db/kv';

const ACTIVE_BABY_KEY = 'active_baby_id';

export async function getActiveBabyId(): Promise<number | null> {
  const raw = await kvGet(ACTIVE_BABY_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function setActiveBabyId(id: number): Promise<void> {
  await kvSet(ACTIVE_BABY_KEY, String(id));
}
