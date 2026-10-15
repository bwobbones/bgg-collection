/**
 * BGG guild members (server side).
 *
 * The collection API can load any user's collection, and the guild endpoint
 * exposes a guild's member list. We fetch it once and cache it so the web UI
 * can present every guild member as a one-click shortcut, just like the
 * "Recent" usernames list.
 */

export const DEFAULT_GUILD_ID = "3998";
export const GUILD_CACHE_TTL = 86400; // 24 hours — membership changes rarely

const BGG_GUILD_URL = "https://boardgamegeek.com/xmlapi2/guild";
const MAX_RETRIES = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function bggHeaders(token) {
  const headers = { "User-Agent": "bgg-collection-app/1.0" };
  if (token) headers.Authorization = `Bearer ${String(token).trim()}`;
  return headers;
}

/**
 * Parse a guild XML response into { id, name, members, count }.
 * Regex-based to match the lightweight parsing used elsewhere on Workers.
 */
export function parseGuildXml(xml) {
  const idMatch = xml.match(/<guild\b[^>]*\bid="(\d+)"/);
  const nameMatch = xml.match(/<guild\b[^>]*\bname="([^"]*)"/);

  const members = [];
  const memberRegex = /<member\b[^>]*\bname="([^"]+)"/g;
  let match;
  while ((match = memberRegex.exec(xml)) !== null) {
    const name = match[1];
    if (name && !members.includes(name)) members.push(name);
  }

  return {
    id: idMatch ? idMatch[1] : null,
    name: nameMatch ? nameMatch[1] : null,
    members,
    count: members.length,
  };
}

/**
 * Fetch a guild's member list, using the cache where possible.
 *
 * @param {object} options
 * @param {string} [options.guildId]        BGG guild id
 * @param {string} [options.token]          BGG API bearer token
 * @param {object} [options.cache]          Optional { get(key, "json"), put(key, value, opts) }
 * @param {boolean} [options.forceRefresh]  Bypass the cache
 * @returns {Promise<{id: string|null, name: string|null, members: string[], count: number}>}
 */
export async function fetchGuildMembers({
  guildId = DEFAULT_GUILD_ID,
  token,
  cache = null,
  forceRefresh = false,
} = {}) {
  const id = String(guildId || DEFAULT_GUILD_ID).trim() || DEFAULT_GUILD_ID;
  const cacheKey = `cache:guild:${id}`;

  if (cache && !forceRefresh) {
    try {
      const hit = await cache.get(cacheKey, "json");
      if (hit && Array.isArray(hit.members)) return hit;
    } catch {
      // A failed cache read must not fail the request — fall through to BGG.
    }
  }

  const url = `${BGG_GUILD_URL}?id=${encodeURIComponent(id)}&members=1`;
  let retries = 0;

  while (true) {
    const res = await fetch(url, { headers: bggHeaders(token) });

    if (res.status === 401) throw new Error("BGG API Unauthorized (401). Invalid BGG_TOKEN.");
    if (res.status === 404) throw new Error(`Guild "${id}" not found on BoardGameGeek.`);
    if (res.status === 202) {
      // Occasionally queued, same as the collection endpoint
      await sleep(2000);
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      retries++;
      if (retries > MAX_RETRIES) {
        throw new Error("BGG rate limited the guild request too many times.");
      }
      await sleep(retries * 1500 + Math.floor(Math.random() * 500));
      continue;
    }
    if (!res.ok) throw new Error(`BGG guild request failed (HTTP ${res.status}).`);

    const result = parseGuildXml(await res.text());

    if (cache) {
      try {
        await cache.put(cacheKey, JSON.stringify(result), {
          expirationTtl: GUILD_CACHE_TTL,
        });
      } catch {
        // A failed cache write must not fail the request
      }
    }

    return result;
  }
}
