// Tiny storage adapter. Uses Upstash Redis (REST) when configured, otherwise memory.
// Memory mode is for local development / demos only: on Vercel it is wiped on cold starts.
const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

function createMemoryStore() {
  const kv = new Map();
  const sets = new Map();
  const lists = new Map();
  return {
    mode: "memory",
    async get(key) { return kv.has(key) ? kv.get(key) : null; },
    async set(key, value) { kv.set(key, value); },
    async setIfAbsent(key, value) { if (kv.has(key)) return false; kv.set(key, value); return true; },
    async del(key) { kv.delete(key); },
    async sadd(key, member) { if (!sets.has(key)) sets.set(key, new Set()); sets.get(key).add(member); },
    async smembers(key) { return [...(sets.get(key) || [])]; },
    async lpush(key, value, max = 200) {
      const list = lists.get(key) || [];
      list.unshift(value);
      lists.set(key, list.slice(0, max));
    },
    async lrange(key, count = 50) { return (lists.get(key) || []).slice(0, count); },
  };
}

function createUpstashStore(url, token) {
  async function cmd(...args) {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error("Storage request failed.");
    return data.result;
  }
  return {
    mode: "upstash",
    get: (key) => cmd("GET", key),
    set: (key, value) => cmd("SET", key, value),
    async setIfAbsent(key, value) { return (await cmd("SET", key, value, "NX")) === "OK"; },
    del: (key) => cmd("DEL", key),
    sadd: (key, member) => cmd("SADD", key, member),
    async smembers(key) { return (await cmd("SMEMBERS", key)) || []; },
    async lpush(key, value, max = 200) { await cmd("LPUSH", key, value); await cmd("LTRIM", key, 0, max - 1); },
    async lrange(key, count = 50) { return (await cmd("LRANGE", key, 0, count - 1)) || []; },
  };
}

export function createStore() {
  return REST_URL && REST_TOKEN ? createUpstashStore(REST_URL, REST_TOKEN) : createMemoryStore();
}
export { createMemoryStore };

// JSON helpers so callers deal in objects.
export async function getJson(store, key) {
  const raw = await store.get(key);
  if (raw === null || raw === undefined) return null;
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return null; }
}
export const setJson = (store, key, value) => store.set(key, JSON.stringify(value));
