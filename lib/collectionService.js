import { fetchBGGCollection, fetchBGGThings } from "./bggClient.js";
import { parseBGGCollectionXML, parseThingsXML } from "./parser.js";
import { formatCompactList } from "./formatter.js";
import { EXCLUSION_LIST } from "./exclusions.js";

/**
 * Checks if a game's Best At player count matches any of the selected player count options
 *
 * @param {Object} item
 * @param {Array<string>} selectedCounts - e.g. ['3p', '4p', '5p', '6+p']
 * @returns {boolean}
 */
export function matchesPlayerCounts(item, selectedCounts) {
  if (!selectedCounts || selectedCounts.length === 0) return true;

  let nums = [];
  if (item.bestAt && item.bestAt !== "(Undetermined)") {
    nums = item.bestAt.match(/\d+/g)?.map(Number) || [];
  } else {
    const minP = item.minPlayers || 1;
    const maxP = item.maxPlayers || 1;
    for (let p = minP; p <= maxP; p++) nums.push(p);
  }

  for (const opt of selectedCounts) {
    const cleanOpt = String(opt).toLowerCase().trim();
    if (cleanOpt === "2p" && nums.includes(2)) return true;
    if (cleanOpt === "3p" && nums.includes(3)) return true;
    if (cleanOpt === "4p" && nums.includes(4)) return true;
    if (cleanOpt === "5p" && nums.includes(5)) return true;
    if (cleanOpt === "6+p" && nums.some((n) => n >= 6)) return true;
  }

  return false;
}

/**
 * Core business logic service to process BGG collection queries
 *
 * @param {Object} params
 * @returns {Promise<Object>} Processed collection results & metrics
 */
export async function getProcessedCollection(params = {}) {
  const {
    username = process.env.BGG_USERNAME || "bwobbones",
    mode = null,
    own = true,
    played,
    rated,
    wishlist,
    all = false,
    subtype = "boardgame",
    includeExpansions = false,
    query = null,
    minRating = null,
    maxRating = null,
    minPlays = null,
    bestAt = null,
    playerCounts = ["3p", "4p", "5p", "6+p"], // Default to 3+
    noBest = false,
    token = process.env.BGG_TOKEN,
    verbose = true,
    onProgress = null,
  } = params;

  if (!username) {
    throw new Error("BoardGameGeek username is required.");
  }

  const startTime = Date.now();

  // Normalize playerCounts array
  const parsedPlayerCounts = Array.isArray(playerCounts)
    ? playerCounts
    : typeof playerCounts === "string"
    ? playerCounts.split(",").map((s) => s.trim())
    : ["3p", "4p", "5p", "6+p"];

  if (verbose) {
    console.log(`\n==================================================`);
    console.log(`[BGG Service] Starting collection fetch for user: "${username}"`);
    if (mode) console.log(`[BGG Service] Preset mode: "${mode}"`);
    console.log(`[BGG Service] Player Counts: ${parsedPlayerCounts.join(", ")}`);
    console.log(`==================================================`);
  }

  // 1. Fetch raw XML from BGG collection API
  if (onProgress) {
    onProgress({
      step: "collection",
      percentage: 10,
      message: `Fetching collection XML for user "${username}" from BoardGameGeek...`,
    });
  }

  const xmlData = await fetchBGGCollection(username, {
    own: all ? undefined : own,
    played,
    rated,
    wishlist,
    subtype,
    stats: true,
    token,
    verbose,
    onProgress,
  });

  const { totalItems, items } = parseBGGCollectionXML(xmlData);

  if (verbose) {
    console.log(`[BGG Service] Step 1 Complete: Received ${totalItems} raw collection items.`);
  }

  if (items.length === 0) {
    return {
      username,
      mode,
      totalItems: 0,
      totalEligibleCount: 0,
      goldCount: 0,
      goldPercentage: "0.0",
      items: [],
      compactList: "",
    };
  }

  // 2. Fetch authoritative Thing API details early for all items
  if (onProgress) {
    onProgress({
      step: "things_start",
      percentage: 25,
      message: `Enriching ${items.length} items with BGG Thing API details & "Best At" poll data...`,
    });
  }

  let filteredItems = [...items];

  if (!noBest) {
    const ids = filteredItems.map((i) => i.id).filter(Boolean);
    const xmlList = await fetchBGGThings(ids, {
      token,
      verbose,
      onProgress: (p) => {
        if (onProgress) {
          const rawPct =
            p.percentage !== undefined
              ? p.percentage
              : p.total > 0
              ? Math.round((p.current / p.total) * 100)
              : 0;
          const scaledPct = 25 + Math.round(rawPct * 0.6);
          onProgress({ ...p, percentage: scaledPct });
        }
      },
    });

    const detailsMap = parseThingsXML(xmlList);

    for (const item of filteredItems) {
      const details = detailsMap.get(item.id);
      if (details) {
        item.bestAt = details.bestAt;
        item.recommendedAt = details.recommendedAt;
        if (details.type) item.realType = details.type;
      }
    }
  }

  if (verbose) {
    console.log(`[BGG Service] Step 2 Complete: Enriched items with authoritative Thing API details.`);
  }

  if (onProgress) {
    onProgress({
      step: "filtering",
      percentage: 90,
      message: `Applying base filters (ownership, exclusion list, expansion filter)...`,
    });
  }

  // 3. Base Filter 1: Strictly OWNED games (unless all or specific status flags set)
  if (!all && (own || (!played && !rated && !wishlist))) {
    filteredItems = filteredItems.filter((item) => item.status.own);
  }

  // 4. Base Filter 2: Hardcoded EXCLUSION_LIST
  const excludedSet = new Set(
    EXCLUSION_LIST.map((e) => e.trim().toLowerCase())
  );
  filteredItems = filteredItems.filter(
    (item) => !excludedSet.has(item.name.trim().toLowerCase())
  );

  // 5. Base Filter 3: Exclude Expansions using authoritative Thing API type & title regex
  if (!includeExpansions && subtype !== "boardgameexpansion") {
    const expansionRegex = /\b(expansion|promo|map pack|expansion set|mini-expansion|booster pack|promo pack|promo cards)\b/i;

    filteredItems = filteredItems.filter((item) => {
      const isExpansion =
        item.realType === "boardgameexpansion" ||
        item.subtype === "boardgameexpansion" ||
        item.subtype.toLowerCase().includes("expansion") ||
        expansionRegex.test(item.name);

      return !isExpansion;
    });
  }

  const totalEligibleCount = filteredItems.length;

  if (verbose) {
    console.log(`[BGG Service] Step 3 Complete: ${totalEligibleCount} base owned games remain after exclusions & expansion filtering.`);
  }

  // Gold Criteria: Avg Rating >= 7.2 AND > 300 user ratings
  const isGold = (item) =>
    item.averageRating !== null &&
    item.averageRating >= 7.2 &&
    item.usersRated !== null &&
    item.usersRated > 300;

  // Calculate Gold Percentage metrics
  const goldCount = filteredItems.filter((item) => isGold(item)).length;
  const goldPercentage =
    totalEligibleCount > 0
      ? ((goldCount / totalEligibleCount) * 100).toFixed(1)
      : "0.0";

  // Apply Preset Mode filters
  const cleanMode = mode ? mode.trim().toLowerCase() : null;
  if (cleanMode === "shit") {
    filteredItems = filteredItems.filter(
      (item) =>
        item.averageRating !== null &&
        item.averageRating <= 7.1 &&
        matchesPlayerCounts(item, parsedPlayerCounts)
    );
  } else if (cleanMode === "gold") {
    filteredItems = filteredItems.filter(
      (item) => isGold(item) && matchesPlayerCounts(item, parsedPlayerCounts)
    );
  } else if (cleanMode === "allgold") {
    filteredItems = filteredItems.filter((item) => isGold(item));
  } else if (cleanMode === "2p") {
    filteredItems = filteredItems.filter((item) => matchesPlayerCounts(item, ["2p"]));
  } else {
    // General mode: filter by selected player counts
    filteredItems = filteredItems.filter((item) =>
      matchesPlayerCounts(item, parsedPlayerCounts)
    );
  }

  // Filter by bestAt string parameter if explicitly provided
  if (bestAt && !noBest) {
    const targetStr = String(bestAt).trim();
    filteredItems = filteredItems.filter((item) => {
      if (!item.bestAt) return false;
      return item.bestAt.includes(targetStr);
    });
  }

  // Filter by search query
  if (query) {
    const q = String(query).toLowerCase();
    filteredItems = filteredItems.filter((item) =>
      item.name.toLowerCase().includes(q)
    );
  }

  // Filter by min/max rating
  if (minRating !== null && !isNaN(minRating)) {
    filteredItems = filteredItems.filter((item) => {
      const r = item.averageRating ?? 0;
      return r >= minRating;
    });
  }

  if (maxRating !== null && !isNaN(maxRating)) {
    filteredItems = filteredItems.filter((item) => {
      const r = item.averageRating ?? 0;
      return r <= maxRating;
    });
  }

  // Filter by plays
  if (minPlays !== null && !isNaN(minPlays)) {
    filteredItems = filteredItems.filter(
      (item) => item.numPlays >= minPlays
    );
  }

  if (onProgress) {
    onProgress({
      step: "formatting",
      percentage: 95,
      message: `Formatting output and generating compact truncated list...`,
    });
  }

  const compactList = formatCompactList(filteredItems, 1500);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  if (verbose) {
    console.log(`[BGG Service] Step 4 Complete: Returning ${filteredItems.length} games in ${durationSec}s.`);
    console.log(`[BGG Service] Gold Metrics (Avg >= 7.2 & >300 Ratings): ${goldCount} / ${totalEligibleCount} (${goldPercentage}%)`);
    console.log(`==================================================\n`);
  }

  if (onProgress) {
    onProgress({
      step: "complete",
      percentage: 100,
      message: `Complete! Loaded ${filteredItems.length} games in ${durationSec}s.`,
    });
  }

  return {
    username,
    mode: cleanMode,
    totalItems,
    totalEligibleCount,
    goldCount,
    goldPercentage,
    returnedCount: filteredItems.length,
    items: filteredItems,
    compactList,
  };
}
