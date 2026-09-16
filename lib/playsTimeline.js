/**
 * BGG play history.
 *
 * The collection API only exposes a per-game play count, so building a
 * "share of the collection played over time" series requires walking the
 * paginated /xmlapi2/plays endpoint and tracking each game's first play date.
 *
 * Shared by the Cloudflare Worker (src/worker.js) and the local dev server
 * (server.js).
 */

export const PLAYS_PER_PAGE = 100;
export const MAX_PAGES = 100; // safety cap: 10,000 plays
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
 * Parse one page of the plays XML with regexes (same approach as the collection
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
    const typeMatch = body.match(/<item\b[^>]*\bobjecttype="([^"]+)"/);
    if (!date || !itemMatch) continue;
    plays.push({
      date,
      objectId: parseInt(itemMatch[1], 10),
      quantity,
      type: typeMatch ? typeMatch[1] : "thing",
    });
  }

  return { plays, total };
}

async function fetchPlaysPage(username, token, page) {
  const url = `${BGG_PLAYS_URL}?username=${encodeURIComponent(username)}&page=${page}`;
  let retries = 0;

  while (true) {
    const res = await fetch(url, { headers: bggHeaders(token) });

    if (res.status === 401) {
      throw new Error("BGG API Unauthorized (401). Invalid BGG_TOKEN.");
    }
    if (res.status === 404) {
      throw new Error(`User "${username}" not found on BoardGameGeek.`);
    }
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
    if (!res.ok) {
      throw new Error(`BGG play history request failed (HTTP ${res.status}).`);
    }

    return res.text();
  }
}

/**
 * Fetch every logged play for a user, page by page.
 *
 * @param {object} options
 * @param {string} options.username
 * @param {string} options.token       BGG bearer token
 * @param {Function} [options.onProgress] Called with { page, totalPages, plays }
 * @param {number} [options.maxPages]
 * @returns {Promise<{ plays: object[], total: number, pages: number, truncated: boolean }>}
 */
export async function fetchAllPlays({ username, token, onProgress, maxPages = MAX_PAGES }) {
  const first = await fetchPlaysPage(username, token, 1);
  const { plays: firstPlays, total } = parsePlaysPage(first);
  const totalPlays = total ?? firstPlays.length;

  const plays = [...firstPlays];
  const totalPages = Math.max(1, Math.ceil(totalPlays / PLAYS_PER_PAGE));
  const pageCount = Math.min(totalPages, maxPages);

  if (onProgress) {
    onProgress({ page: 1, totalPages: pageCount, plays: plays.length });
  }

  for (let start = 2; start <= pageCount; start += PAGE_CONCURRENCY) {
    const batch = [];
    for (let p = start; p < Math.min(start + PAGE_CONCURRENCY, pageCount + 1); p++) {
      batch.push(p);
    }

    const results = await Promise.all(
      batch.map(async (page) => {
        const xml = await fetchPlaysPage(username, token, page);
        return parsePlaysPage(xml).plays;
      })
    );

    for (const pagePlays of results) plays.push(...pagePlays);

    if (onProgress) {
      onProgress({ page: Math.min(start + PAGE_CONCURRENCY - 1, pageCount), totalPages: pageCount, plays: plays.length });
    }
  }

  return {
    plays,
    total: totalPlays,
    pages: pageCount,
    truncated: pageCount < totalPages,
  };
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

function monthStart(monthStr) {
  return `${monthStr}-01`;
}

function addMonth(monthStr, delta) {
  const [y, m] = monthStr.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function lastDayOfMonth(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const day = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthStr}-${String(day).padStart(2, "0")}`;
}

/**
 * Turn raw plays into a monthly cumulative "share of collection played" series.
 *
 * The denominator is the CURRENT eligible collection size, because BGG does not
 * expose acquisition dates (this user has none set), so a historically accurate
 * denominator is impossible. Games that were sold on are excluded from both the
 * numerator and denominator by intersecting with the eligible id set.
 *
 * @param {object} options
 * @param {object[]} options.plays
 * @param {Set<number>|null} [options.eligibleIds] Owned + eligible game ids
 * @param {number} [options.eligibleCount]
 * @param {Date} [options.now]
 */
export function buildPlayTimeline({ plays, eligibleIds = null, eligibleCount = 0, now = new Date() }) {
  const firstPlayByGame = new Map();
  let totalPlaysAllTime = 0;
  let totalPlaysInCollection = 0;
  let playRecordsInCollection = 0;
  let lastPlayDate = null;

  for (const play of plays) {
    totalPlaysAllTime += play.quantity || 1;
    if (!lastPlayDate || play.date > lastPlayDate) lastPlayDate = play.date;

    if (eligibleIds && !eligibleIds.has(play.objectId)) continue;

    totalPlaysInCollection += play.quantity || 1;
    playRecordsInCollection++;

    const previous = firstPlayByGame.get(play.objectId);
    if (!previous || play.date < previous) firstPlayByGame.set(play.objectId, play.date);
  }

  const firstDates = [...firstPlayByGame.values()].sort();
  const points = [];

  if (firstDates.length > 0) {
    const todayMonth = monthKey(now.toISOString().slice(0, 10));
    const lastPlayMonth = monthKey(lastPlayDate);
    const endMonth = todayMonth > lastPlayMonth ? todayMonth : lastPlayMonth;

    let cursor = 0;
    for (let month = monthKey(firstDates[0]); month <= endMonth; month = addMonth(month, 1)) {
      const monthEnd = lastDayOfMonth(month);
      while (cursor < firstDates.length && firstDates[cursor] <= monthEnd) cursor++;
      points.push({
        date: monthStart(month),
        playedCount: cursor,
        percentage: eligibleCount > 0 ? Number(((cursor / eligibleCount) * 100).toFixed(2)) : 0,
      });
    }
  }

  const distinctPlayedGames = firstDates.length;
  const firstPlayDate = firstDates[0] || null;
  const years =
    firstPlayDate && lastPlayDate
      ? Number(((new Date(lastPlayDate) - new Date(firstPlayDate)) / (365.25 * 24 * 3600 * 1000)).toFixed(1))
      : 0;

  return {
    eligibleCount,
    distinctPlayedGames,
    unplayedCount: Math.max(0, eligibleCount - distinctPlayedGames),
    playedPercentage: eligibleCount > 0 ? Number(((distinctPlayedGames / eligibleCount) * 100).toFixed(1)) : 0,
    totalPlays: totalPlaysInCollection,
    playRecords: playRecordsInCollection,
    totalPlaysAllTime,
    firstPlayDate,
    lastPlayDate,
    years,
    points,
  };
}
