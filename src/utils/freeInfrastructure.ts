/** Optional free-tier infrastructure adapters. All functions fail closed to the local fallback. */

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, '') || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_STATE_TABLE = process.env.SUPABASE_STATE_TABLE || 'growpilot_state';
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '') || '';
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

export const remoteInfrastructure = {
  supabase: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
  redis: Boolean(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN),
};

export async function loadSupabaseState<T>(): Promise<T | null> {
  if (!remoteInfrastructure.supabase) return null;
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${SUPABASE_STATE_TABLE}?tenant_id=eq.default&select=state`,
      { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
    );
    if (!response.ok) return null;
    const rows = (await response.json()) as Array<{ state?: T }>;
    return rows[0]?.state || null;
  } catch {
    return null;
  }
}

export async function saveSupabaseState(state: unknown): Promise<boolean> {
  if (!remoteInfrastructure.supabase) return false;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_STATE_TABLE}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ tenant_id: 'default', state, updated_at: new Date().toISOString() }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function redisPipeline(commands: Array<Array<string | number>>): Promise<unknown[] | null> {
  if (!remoteInfrastructure.redis) return null;
  try {
    const response = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown[];
  } catch {
    return null;
  }
}

/** Distributed fixed-window limiter. Null means Redis is not configured/unavailable. */
export async function checkRedisRateLimit(key: string, max: number, windowMs: number): Promise<boolean | null> {
  const safeKey = `growpilot:rate:${key.slice(0, 120)}`;
  const result = await redisPipeline([
    ['INCR', safeKey],
    ['EXPIRE', safeKey, Math.max(1, Math.ceil(windowMs / 1000))],
  ]);
  if (!result) return null;
  const count = Number((result[0] as { result?: unknown })?.result ?? result[0]);
  return Number.isFinite(count) ? count <= max : null;
}

export function infrastructureStatus() {
  return { ...remoteInfrastructure, stateStore: remoteInfrastructure.supabase ? 'supabase' : 'local-json', coordination: remoteInfrastructure.redis ? 'upstash-redis' : 'process-local' };
}
