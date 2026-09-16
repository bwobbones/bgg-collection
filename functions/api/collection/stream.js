import convert from "xml-js";

/**
 * Cloudflare Pages Function: /api/collection/stream
 * Server-Sent Events stream using native fetch for Cloudflare Edge Runtime
 */

const EXCLUSIONS = [
  "Agricola (Revised Edition)",
  "Excalibur",
  "Flash Point: Legacy of Flame",
  "GKR: Heavy Hitters",
  "Glen More II: Chronicles",
  "Moon Colony Bloodbath",
  "Pictomania (Second Edition)",
  "Psycho Raiders",
  "Quacks",
  "Ready Set Bet",
  "Sagrada Artisans",
  "Shikoku 1889",
  "The Queen's Dilemma",
  "Through Ice & Snow",
  "Ticket to Ride: Europe",
  "Wingspan",
];

function getAttr(node, attr) {
  return node?._attributes?.[attr] ?? null;
}

function getText(node) {
  if (!node) return null;
  if (typeof node === "string") return node;
  if (node._text !== undefined) return String(node._text);
  if (node._cdata !== undefined) return String(node._cdata);
  return null;
}

function extractBestAt(item) {
  const ps = item["poll-summary"];
  if (ps) {
    const list = Array.isArray(ps) ? ps : [ps];
    for (const p of list) {
      if (getAttr(p, "name") === "suggested_numplayers" || !getAttr(p, "name")) {
        const results = Array.isArray(p.result) ? p.result : p.result ? [p.result] : [];
        const best = results.find(r => getAttr(r, "name") === "bestwith");
        if (best && getAttr(best, "value")) {
          return getAttr(best, "value").replace(/^Best with\s+/i, "").trim();
        }
      }
    }
  }
  return null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const username = url.searchParams.get("username") || env.BGG_USERNAME || "bwobbones";
  const includeExpansions = url.searchParams.get("includeExpansions") === "true";
  const includeExclusions = url.searchParams.get("includeExclusions") === "true";
  const token = env.BGG_TOKEN;

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const sendSSE = async (event, data) => {
    await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };

  // Run collection fetching in background task connected to SSE stream
  (async () => {
    try {
      if (!token) {
        throw new Error("BGG_TOKEN environment variable is not configured in Cloudflare Pages settings.");
      }

      await sendSSE("progress", {
        step: "collection",
        percentage: 10,
        message: `Connecting to BGG for user "${username}"...`,
      });

      // 1. Fetch Collection XML
      const headers = { Authorization: `Bearer ${token.trim()}` };
      let collRes;
      let attempt = 0;
      const maxRetries = 10;

      while (attempt < maxRetries) {
        attempt++;
        const res = await fetch(`https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&own=1&stats=1`, { headers });
        const text = await res.text();

        if (res.status === 202 || text.includes("Your request for this collection has been accepted")) {
          await sendSSE("progress", {
            step: "queue",
            attempt,
            maxRetries,
            percentage: 10 + attempt * 2,
            message: `Collection queued by BGG. Polling (attempt ${attempt}/${maxRetries})...`,
          });
          await new Promise(r => setTimeout(r, 2500));
          continue;
        }

        if (res.status === 401) {
          throw new Error("BGG API Unauthorized (401). Please verify your BGG_TOKEN in Cloudflare Pages environment variables.");
        }
        if (res.status === 404) {
          throw new Error(`User "${username}" not found on BoardGameGeek.`);
        }

        collRes = text;
        break;
      }

      if (!collRes) {
        throw new Error("BGG collection request timed out waiting in queue.");
      }

      const parsedColl = convert.xml2js(collRes, { compact: true });
      const rawItems = parsedColl?.items?.item ? (Array.isArray(parsedColl.items.item) ? parsedColl.items.item : [parsedColl.items.item]) : [];

      if (rawItems.length === 0) {
        await sendSSE("complete", { success: true, data: { username, totalItems: 0, totalEligibleCount: 0, goldCount: 0, goldPercentage: "0.0", playedCount: 0, unplayedCount: 0, playedPercentage: "0.0", items: [] } });
        await writer.close();
        return;
      }

      await sendSSE("progress", {
        step: "things_start",
        percentage: 25,
        message: `Fetched ${rawItems.length} items. Loading Best At poll details...`,
      });

      // Parse base items
      const items = rawItems.map(item => {
        const id = parseInt(getAttr(item, "objectid"), 10);
        const name = getText(item.name) || "Unknown";
        const year = parseInt(getText(item.yearpublished), 10) || null;
        const thumbnail = getText(item.thumbnail) || null;
        const numPlays = parseInt(getText(item.numplays), 10) || 0;
        const own = getAttr(item.status, "own") === "1";
        const avg = parseFloat(getAttr(item.stats?.rating?.average, "value") || "0");
        const usersRated = parseInt(getAttr(item.stats?.rating?.usersrated, "value") || "0", 10);

        return {
          id,
          name,
          year,
          subtype: getAttr(item, "subtype") || "boardgame",
          realType: "boardgame",
          status: { own },
          numPlays,
          averageRating: avg || null,
          usersRated: usersRated || 0,
          bestAt: null,
          thumbnail,
        };
      });

      // 2. Fetch Thing API details in batches of 20
      const ids = items.map(i => i.id).filter(Boolean);
      const chunkSize = 20;
      const chunks = [];
      for (let i = 0; i < ids.length; i += chunkSize) {
        chunks.push(ids.slice(i, i + chunkSize));
      }

      const thingDetails = new Map();
      let fetchedCount = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        let retry = 0;
        let success = false;

        while (retry < 4 && !success) {
          try {
            const tRes = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${chunk.join(",")}&stats=1`, { headers });
            if (tRes.status === 429) {
              await new Promise(r => setTimeout(r, 2000));
              retry++;
              continue;
            }
            const tText = await tRes.text();
            const parsedThing = convert.xml2js(tText, { compact: true });
            const tItems = parsedThing?.items?.item ? (Array.isArray(parsedThing.items.item) ? parsedThing.items.item : [parsedThing.items.item]) : [];

            for (const t of tItems) {
              const tid = parseInt(getAttr(t, "id"), 10);
              const type = getAttr(t, "type");
              const bestAt = extractBestAt(t);
              if (tid) thingDetails.set(tid, { type, bestAt });
            }
            success = true;
          } catch (e) {
            retry++;
            await new Promise(r => setTimeout(r, 1500));
          }
        }

        fetchedCount += chunk.length;
        const pct = 25 + Math.round((fetchedCount / ids.length) * 60);
        await sendSSE("progress", {
          step: "things",
          current: fetchedCount,
          total: ids.length,
          percentage: pct,
          message: `Loaded details for ${fetchedCount}/${ids.length} games (${pct}%)...`,
        });

        await new Promise(r => setTimeout(r, 150));
      }

      // Attach details to items
      for (const item of items) {
        const d = thingDetails.get(item.id);
        if (d) {
          if (d.bestAt) item.bestAt = d.bestAt;
          if (d.type) item.realType = d.type;
        }
      }

      // 3. Filter base owned & exclusions
      await sendSSE("progress", { step: "filtering", percentage: 90, message: "Applying base filters..." });

      let baseGames = items.filter(i => i.status.own);

      // Exclusions
      const userExcl = username.toLowerCase() === "bwobbones" ? EXCLUSIONS : [];
      const exclSet = new Set(userExcl.map(e => e.toLowerCase().trim()));
      const excludedCount = baseGames.filter(i => exclSet.has(i.name.toLowerCase().trim())).length;

      if (!includeExclusions) {
        baseGames = baseGames.filter(i => !exclSet.has(i.name.toLowerCase().trim()));
      }

      // Expansions
      if (!includeExpansions) {
        const expansionRegex = /\b(expansion|promo|map pack|expansion set|mini-expansion|booster pack|promo pack|promo cards)\b/i;
        baseGames = baseGames.filter(i => 
          i.realType !== "boardgameexpansion" &&
          i.subtype !== "boardgameexpansion" &&
          !i.subtype.toLowerCase().includes("expansion") &&
          !expansionRegex.test(i.name)
        );
      }

      const totalEligibleCount = baseGames.length;
      const goldCount = baseGames.filter(i => (i.averageRating ?? 0) >= 7.2 && (i.usersRated ?? 0) > 300).length;
      const goldPercentage = totalEligibleCount > 0 ? ((goldCount / totalEligibleCount) * 100).toFixed(1) : "0.0";
    const playedCount = baseGames.filter(i => (i.numPlays || 0) > 0).length;
    const unplayedCount = totalEligibleCount - playedCount;
    const playedPercentage = totalEligibleCount > 0 ? ((playedCount / totalEligibleCount) * 100).toFixed(1) : "0.0";

      await sendSSE("complete", {
        success: true,
        data: {
          username,
          totalItems: rawItems.length,
          totalEligibleCount,
          userExclusionsCount: userExcl.length,
          activeExcludedCount: excludedCount,
          goldCount,
          goldPercentage,
          playedCount,
          unplayedCount,
          playedPercentage,
          returnedCount: baseGames.length,
          items: baseGames,
        },
      });

      await writer.close();
    } catch (err) {
      await sendSSE("error", {
        success: false,
        error: err.message || "Failed to fetch collection from BGG",
        details: {
          message: err.message,
          name: err.name,
          stack: err.stack,
          timestamp: new Date().toISOString(),
          target: "BoardGameGeek XML API2 (Cloudflare Edge Function)",
        },
      });
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
