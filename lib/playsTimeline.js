/**
 * BGG play history (server side).
 *
 * The collection API only exposes a per-game play count, so play *dates* have to
 * come from the paginated /xmlapi2/plays endpoint (100 plays per page).
 *
 * Workers cap subrequests per invocation (50 on the free plan), so this module
 * never walks the whole history in one call: callers ask for a bounded bundle of
 * pages, and each page is cached in KV so repeat requests cost no BGG fetches at
 * all. The browser pages through the bundles and assembles the timeline.
 */

export const PLAYS_PER_PAGE = 100;
export const MAX_PAGES = 100; // safety cap: 10,000 plays
export const DEFAULT_PAGES_PER_REQUEST = 6;
export const MAX_PAGES_PER_REQUEST = 8; // keeps each invocation far below the 50 subrequest limit
export const PLAYS_PAGE_CACHE_TTL = 43200; // 12 hours

const PAGE_CONCURRENCY = 4;
const MAX_RETRIES = 5;

const BGG_PLAYS_URL = "https://boardgamegeek.com/xmlapi2/plays";

function bggHeaders(token) {
  return {
    Authorization: `Bearer ${String(token).trim()}`,
    "User-Agent": "bgg-collection-app/1.0",
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Parse one page of plays XML with regexes (same approach as the collection
 * parser: far cheaper than a full XML parse on Workers).
 */
export function parsePlaysPage(xml) {
  const plays = [];
  const totalMatch = xml.match(/<plays\b[^>]*\btotal="(\d+)"/);
  const total = totalMatch ? parseInt(totalMatch[1], 10) : null;

  const playRegex = /<play\b([^>]*)>([\s\S]*?)<\/play>/g;
  let match;
  while ((match = playRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const body = match[2];
    const date = (attrs.match(/\bdate="([\d-]+)"/) || [])[1] || null;
    const quantity = parseInt((attrs.match(/\bquantity="(\d+)"/) || [])[1] || "1", 10) || 1;
    // Match the first <item> only: <player> elements also carry ids
    const itemMatch = body.match(/<item\b[^>]*\bobjectid="(\d+)"/);
    if (!date || !itemMatch) continue;
    plays.push({ date, objectId: parseInt(itemMatch[1], 10), quantity });
  }

  return { plays, total };
}

export function totalPagesFor(total) {
  return Math.max(1, Math.ceil((total ?? 0) / PLAYS_PER_PAGE));
}

async function fetchPlaysPageXml(username, token, page) {
  const url = `${BGG_PLAYS_URL}?username=${encodeURIComponent(username)}&page=${page}`;
  let retries = 0;

  while (true) {
    const res = await fetch(url, { headers: bggHeaders(token) });

    if (res.status === 401) throw new Error("BGG API Unauthorized (401). Invalid BGG_TOKEN.");
    if (res.status === 404) throw new Error(`User "${username}" not found on BoardGameGeek.`);
    if (res.status === 202) {
      // Occasionally queued, same as the collection endpoint
      await sleep(2000);
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      retries++;
      if (retries > MAX_RETRIES) {
        throw new Error("BGG rate limited the play history request too many times.");
      }
      await sleep(retries * 1500 + Math.floor(Math.random() * 500));
      continue;
    }
    if (!res.ok) throw new Error(`BGG play history request failed (HTTP ${res.status}).`);

    return res.text();
  }
}

/**
 * Fetch a bounded bundle of play-history pages, using the cache where possible.
 *
 * @param {object} options
 * @param {string} options.username
 * @param {string} options.token
 * @param {number} [options.from]            First page (1-based)
 * @param {number} [options.count]           Pages to return (clamped to MAX_PAGES_PER_REQUEST)
 * @param {object} [options.cache]           Optional { get(key, "json"), put(key, value, opts) }
 * @param {string} [options.cachePrefix]
 * @param {boolean} [options.forceRefresh]   Bypass the cache
 * @returns {Promise<{plays: object[], total: number|null, totalPages: number, from: number, count: number, cacheHits: number}>}
 */
export async function fetchPlaysPages({
  username,
  token,
  from = 1,
  count = DEFAULT_PAGES_PER_REQUEST,
  cache = null,
  cachePrefix = "cache:playspage",
  forceRefresh = false,
}) {
  const firstPage = Math.max(1, Math.min(MAX_PAGES, Math.floor(from) || 1));
  const pageCount = Math.max(1, Math.min(MAX_PAGES_PER_REQUEST, Math.floor(count) || 1));
  const pages = [];
  for (let p = firstPage; p < firstPage + pageCount && p <= MAX_PAGES; p++) pages.push(p);

  const cacheKey = (page) => `${cachePrefix}:${String(username).toLowerCase()}:${page}`;
  const pageResults = new Map();
  const misses = [];

  if (cache && !forceRefresh) {
    await Promise.all(
      pages.map(async (page) => {
        try {
          const hit = await cache.get(cacheKey(page), "json");
          if (hit && Array.isArray(hit.plays)) pageResults.set(page, hit);
          else misses.push(page);
        } catch {
          misses.push(page);
        }
      })
    );
  } else {
    misses.push(...pages);
  }

  const cacheHits = pageResults.size;
  let total = null;
  for (const hit of pageResults.values()) {
    if (typeof hit.total === "number") total = hit.total;
  }

  // Fetch the misses a few at a time so one bundle never fans out too wide
  for (let i = 0; i < misses.length; i += PAGE_CONCURRENCY) {
    const slice = misses.slice(i, i + PAGE_CONCURRENCY);
    const fetched = await Promise.all(
      slice.map(async (page) => {
        const xml = await fetchPlaysPageXml(username, token, page);
        return { page, ...parsePlaysPage(xml) };
      })
    );

    for (const item of fetched) {
      if (typeof item.total === "number") total = item.total;
      const entry = { page: item.page, total: item.total, plays: item.plays };
      pageResults.set(item.page, entry);

      if (cache) {
        try {
          await cache.put(cacheKey(item.page), JSON.stringify(entry), {
            expirationTtl: PLAYS_PAGE_CACHE_TTL,
          });
        } catch {
          // A failed cache write must not fail the request
        }
      }
    }
  }

  // Preserve page order so the caller sees plays newest-first
  const plays = [];
  for (const page of pages) {
    const entry = pageResults.get(page);
    if (entry) plays.push(...entry.plays);
  }

  return {
    plays,
    total,
    totalPages: totalPagesFor(total),
    from: firstPage,
    count: pages.length,
    cacheHits,
  };
}
