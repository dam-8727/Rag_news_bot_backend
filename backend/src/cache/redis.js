// Import Redis client for conversation storage
import { createClient } from "redis";

// How long to keep conversation sessions (default: 24 hours)
// You can set SESSION_TTL_SECONDS=7200 in .env for 2 hours
const TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24);

// ---- Redis client setup (optional) ----
let client = null;

// Check if we have Redis configured
const hasRedis = () => !!process.env.REDIS_URL;

/**
 * Get or create the Redis client
 * Returns null if Redis isn't configured (we'll use in-memory storage instead)
 */
async function getClient() {
  if (!hasRedis()) return null;
  
  if (!client) {
    // Create Redis client with connection details
    client = createClient({
      url: process.env.REDIS_URL,                    // e.g. rediss://default:<PASS>@host:port
      password: process.env.REDIS_PASSWORD || undefined,
    });
    client.on("error", (e) => console.error("Redis error:", e));
  }
  
  // Make sure we're connected
  if (!client.isOpen) await client.connect();
  return client;
}

// Helper to create Redis keys for sessions
const KEY = (sid) => `chat:${sid}`;

// ---- In-memory fallback storage (when Redis isn't available) ----
const mem = new Map();     // key -> [messages]
const timers = new Map();  // key -> TTL timer

/**
 * Reset the TTL timer for in-memory storage
 * This ensures sessions don't stay in memory forever
 */
function touchMem(k) {
  if (timers.has(k)) clearTimeout(timers.get(k));
  timers.set(k, setTimeout(() => { 
    mem.delete(k); 
    timers.delete(k); 
  }, TTL_SECONDS * 1000));
}

/**
 * Add a message to a conversation session
 * This is the main function you were asking about
 */
export async function appendMessage(sessionId, msg) {
  const k = KEY(sessionId);
  const value = JSON.stringify({ ...msg, ts: Date.now() });

  const r = await getClient();
  if (r) {
    // Use Redis if available
    await r.rPush(k, value);        // Append to the end of the list
    await r.expire(k, TTL_SECONDS); // Refresh the TTL
    return;
  }

  // Fallback to in-memory storage
  const arr = mem.get(k) || [];
  arr.push(JSON.parse(value));
  mem.set(k, arr);
  touchMem(k);
}

/**
 * Get all messages from a conversation session
 */
export async function getHistory(sessionId) {
  const k = KEY(sessionId);
  const r = await getClient();
  
  if (r) {
    // Get all messages from Redis
    const arr = await r.lRange(k, 0, -1);
    return arr.map(s => { 
      try { 
        return JSON.parse(s); 
      } catch { 
        return null; 
      } 
    }).filter(Boolean);
  }
  
  // Fallback to in-memory storage
  return mem.get(k) || [];
}

/**
 * Clear/reset a conversation session
 */
export async function resetSession(sessionId) {
  const k = KEY(sessionId);
  const r = await getClient();
  
  if (r) { 
    await r.del(k); 
    return; 
  }
  
  // Clean up in-memory storage
  mem.delete(k);
  if (timers.has(k)) { 
    clearTimeout(timers.get(k)); 
    timers.delete(k); 
  }
}