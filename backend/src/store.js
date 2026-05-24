import { createClient } from "redis";

function parseHashReply(reply) {
  if (!Array.isArray(reply)) return reply || {};
  const hash = {};
  for (let index = 0; index < reply.length; index += 2) {
    hash[reply[index]] = reply[index + 1];
  }
  return hash;
}

function parseScorePairs(reply) {
  const pairs = [];
  for (let index = 0; index < reply.length; index += 2) {
    pairs.push({ value: reply[index], score: Number(reply[index + 1]) });
  }
  return pairs;
}

class MemoryValkey {
  constructor() {
    this.hashes = new Map();
    this.zsets = new Map();
    this.lists = new Map();
    this.strings = new Map();
    this.sets = new Map();
    this.expiries = new Map();
  }

  isExpired(key) {
    const expiresAt = this.expiries.get(key);
    if (expiresAt && expiresAt <= Date.now()) {
      this.hashes.delete(key);
      this.zsets.delete(key);
      this.lists.delete(key);
      this.strings.delete(key);
      this.sets.delete(key);
      this.expiries.delete(key);
      return true;
    }
    const item = this.strings.get(key);
    if (item?.expiresAt && item.expiresAt <= Date.now()) {
      this.strings.delete(key);
      return true;
    }
    return false;
  }

  async hgetall(key) {
    if (this.isExpired(key)) return {};
    return Object.fromEntries(this.hashes.get(key) || []);
  }

  async hset(key, field, value) {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    this.hashes.get(key).set(field, String(value));
  }

  async hdel(key, field) {
    this.hashes.get(key)?.delete(field);
  }

  async zincrby(key, amount, member) {
    if (!this.zsets.has(key)) this.zsets.set(key, new Map());
    const zset = this.zsets.get(key);
    zset.set(member, (zset.get(member) || 0) + Number(amount));
  }

  async zrevrangeWithScores(key, limit = 10) {
    if (this.isExpired(key)) return [];
    return [...(this.zsets.get(key) || new Map()).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value, score]) => ({ value, score }));
  }

  async lpushTrim(key, value, limit = 40) {
    const list = this.lists.get(key) || [];
    list.unshift(value);
    this.lists.set(key, list.slice(0, limit));
  }

  async lrange(key, limit = 20) {
    if (this.isExpired(key)) return [];
    return (this.lists.get(key) || []).slice(0, limit);
  }

  async get(key) {
    if (this.isExpired(key)) return null;
    return this.strings.get(key)?.value || null;
  }

  async setex(key, seconds, value) {
    this.strings.set(key, { value });
    this.expiries.set(key, Date.now() + Number(seconds) * 1000);
  }

  async incr(key) {
    this.isExpired(key);
    const value = Number(this.strings.get(key)?.value || 0) + 1;
    this.strings.set(key, { value: String(value) });
    return value;
  }

  async expire(key, seconds) {
    this.expiries.set(key, Date.now() + Number(seconds) * 1000);
  }

  async sadd(key, member) {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    this.sets.get(key).add(member);
  }

  async smembers(key) {
    if (this.isExpired(key)) return [];
    return [...(this.sets.get(key) || new Set())];
  }
}

class RedisValkey {
  constructor(client) {
    this.client = client;
  }

  async hgetall(key) {
    return parseHashReply(await this.client.sendCommand(["HGETALL", key]));
  }

  async hset(key, field, value) {
    await this.client.sendCommand(["HSET", key, field, String(value)]);
  }

  async hdel(key, field) {
    await this.client.sendCommand(["HDEL", key, field]);
  }

  async zincrby(key, amount, member) {
    await this.client.sendCommand(["ZINCRBY", key, String(amount), member]);
  }

  async zrevrangeWithScores(key, limit = 10) {
    return parseScorePairs(
      await this.client.sendCommand(["ZREVRANGE", key, "0", String(limit - 1), "WITHSCORES"])
    );
  }

  async lpushTrim(key, value, limit = 40) {
    await this.client.sendCommand(["LPUSH", key, value]);
    await this.client.sendCommand(["LTRIM", key, "0", String(limit - 1)]);
  }

  async lrange(key, limit = 20) {
    return this.client.sendCommand(["LRANGE", key, "0", String(limit - 1)]);
  }

  async get(key) {
    return this.client.sendCommand(["GET", key]);
  }

  async setex(key, seconds, value) {
    await this.client.sendCommand(["SETEX", key, String(seconds), value]);
  }

  async incr(key) {
    return Number(await this.client.sendCommand(["INCR", key]));
  }

  async expire(key, seconds) {
    await this.client.sendCommand(["EXPIRE", key, String(seconds)]);
  }

  async sadd(key, member) {
    await this.client.sendCommand(["SADD", key, member]);
  }

  async smembers(key) {
    return this.client.sendCommand(["SMEMBERS", key]);
  }
}

export async function createStore() {
  const url = process.env.VALKEY_URL || "redis://localhost:6379";
  const client = createClient({
    url,
    socket: {
      connectTimeout: 1000,
      reconnectStrategy: false
    }
  });
  client.on("error", () => {});

  try {
    await client.connect();
    await client.sendCommand(["PING"]);
    return {
      mode: "valkey",
      url,
      connected: true,
      db: new RedisValkey(client),
      async close() {
        await client.quit();
      }
    };
  } catch (error) {
    return {
      mode: "memory-fallback",
      url,
      connected: false,
      error: error.message,
      db: new MemoryValkey(),
      async close() {}
    };
  }
}
