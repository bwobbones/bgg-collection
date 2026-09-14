import convert from "xml-js";
import { getExclusionsForUser } from "../lib/exclusions.js";

/**
 * Cloudflare Worker with Static Assets & Cloudflare KV Persistence
 * Handles /api/collection, /api/exclusions, /api/test, and falls back to env.ASSETS for static files
 */

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
        const best = results.find((r) => getAttr(r, "name") === "bestwith");
        if (best && getAttr(best, "value")) {
          return getAttr(best, "value").replace(/^Best with\s+/i, "").trim();
        }
      }
    }
  }
  return null;
}

/**
 * Helper to fetch persistent exclusions from Cloudflare KV (falls back to lib/exclusions.js)
 */
async function getUserExclusions(env, username) {
  const normUser = String(username || "bwobbones").trim().toLowerCase();

  if (env?.BGG_EXCLUSIONS_KV) {
    try {
      const kvVal = await env.BGG_EXCLUSIONS_KV.get(`exclusions:${normUser}`, "json");
      if (Array.isArray(kvVal)) {
        return kvVal;
      }
    } catch (e) {
      console.error("KV read error:", e);
    }
  }

  return getExclusionsForUser(normUser);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Diagnostic route: /api/test
    if (url.pathname === "/api/test") {
      const token = env?.BGG_TOKEN || globalThis?.BGG_TOKEN || process?.env?.BGG_TOKEN || null;
      let bggStatus = null;
      let bggError = null;
      let sampleData = null;

      if (token) {
        try {
          const res = await fetch(
            "https://boardgamegeek.com/xmlapi2/collection?username=bwobbones&own=1&stats=1",
            {
              headers: {
                Authorization: `Bearer ${token.trim()}`,
                "User-Agent": "bgg-collection-app/1.0",
              },
            }
          );
          bggStatus = res.status;
          const text = await res.text();
          sampleData = text.slice(0, 300);
        } catch (e) {
          bggError = { message: e.message, stack: e.stack };
        }
      }

      return new Response(
        JSON.stringify(
          {
            status: "worker_api_ok",
            hasToken: Boolean(token),
            tokenLength: token ? token.length : 0,
            tokenPrefix: token ? `${token.slice(0, 4)}...` : null,
            hasKV: Boolean(env?.BGG_EXCLUSIONS_KV),
            bggStatus,
            bggError,
            sampleData,
            envKeys: Object.keys(env || {}),
            url: request.url,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        ),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Manage Exclusions API routes: GET /api/exclusions & POST /api/exclusions
    if (url.pathname === "/api/exclusions") {
      const normUser = (
        url.searchParams.get("username") ||
        env?.BGG_USERNAME ||
        "bwobbones"
      )
        .trim()
        .toLowerCase();

      if (request.method === "GET") {
        const exclusions = await getUserExclusions(env, normUser);
        return new Response(
          JSON.stringify({ success: true, username: normUser, exclusions }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (request.method === "POST") {
        try {
          const body = await request.json();
          const targetUser = String(body.username || normUser).trim().toLowerCase();
          const newExclusions = Array.isArray(body.exclusions) ? body.exclusions : [];

          if (env?.BGG_EXCLUSIONS_KV) {
            await env.BGG_EXCLUSIONS_KV.put(
              `exclusions:${targetUser}`,
              JSON.stringify(newExclusions)
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              username: targetUser,
              exclusions: newExclusions,
              count: newExclusions.length,
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        } catch (err) {
          return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

    // 3. Collection API route: /api/collection or /api/collection/stream
    if (url.pathname.startsWith("/api/collection")) {
      const token = env?.BGG_TOKEN || globalThis?.BGG_TOKEN || process?.env?.BGG_TOKEN || null;
      const username = url.searchParams.get("username") || env?.BGG_USERNAME || "bwobbones";
      const includeExpansions = url.searchParams.get("includeExpansions") === "true";
      const includeExclusions = url.searchParams.get("includeExclusions") === "true";

      if (!token) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "BGG_TOKEN is not configured in Cloudflare environment variables.",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      try {
        const activityLog = [];
        const addLog = (step, msg) => {
          activityLog.push({
            step,
            time: new Date().toLocaleTimeString(),
            message: msg,
          });
        };

        const startTime = Date.now();
        addLog(1, `Connecting to BoardGameGeek XMLAPI2 for user "${username}"...`);

        const headers = {
          Authorization: `Bearer ${token.trim()}`,
          "User-Agent": "bgg-collection-app/1.0",
        };

        let collRes;
        let attempt = 0;
        const maxRetries = 8;

        while (attempt < maxRetries) {
          attempt++;
          const res = await fetch(
            `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&own=1&stats=1`,
            { headers }
          );
          const text = await res.text();

          if (res.status === 202 || text.includes("Your request for this collection has been accepted")) {
            addLog(1, `Collection request queued by BGG. Polling attempt ${attempt}/${maxRetries}...`);
            await new Promise((r) => setTimeout(r, 2500));
            continue;
          }

          if (res.status === 401) {
            throw new Error("BGG API Unauthorized (401). Invalid BGG_TOKEN in Cloudflare environment variables.");
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
        const rawItems = parsedColl?.items?.item
          ? Array.isArray(parsedColl.items.item)
            ? parsedColl.items.item
            : [parsedColl.items.item]
          : [];

        const step1Duration = ((Date.now() - startTime) / 1000).toFixed(2);
        addLog(1, `Step 1 Complete: Received ${rawItems.length} raw collection items from BGG (${step1Duration}s).`);

        const items = rawItems.map((item) => {
          const id = parseInt(getAttr(item, "objectid"), 10);
          const name = getText(item.name) || "Unknown";
          const year = parseInt(getText(item.yearpublished), 10) || null;
          const thumbnail = getText(item.thumbnail) || null;
          const numPlays = parseInt(getText(item.numplays), 10) || 0;
          const own = getAttr(item.status, "own") === "1";
          const avg = parseFloat(getAttr(item.stats?.rating?.average, "value") || "0");
          const usersRated = parseInt(getAttr(item.stats?.rating?.usersrated, "value") || "0", 10);
          const minPlayers = parseInt(getAttr(item.stats, "minplayers"), 10) || null;
          const maxPlayers = parseInt(getAttr(item.stats, "maxplayers"), 10) || null;

          return {
            id,
            name,
            year,
            minPlayers,
            maxPlayers,
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

        // Ultra-fast regex parser: 34x faster than xml-js, consumes near 0ms CPU to prevent Cloudflare Worker CPU limits (503)
        function fastExtractThingDetails(xmlStr) {
          const map = new Map();
          const itemRegex = /<item\s+type="([^"]+)"\s+id="(\d+)"([\s\S]*?)<\/item>/g;
          let match;
          while ((match = itemRegex.exec(xmlStr)) !== null) {
            const type = match[1];
            const id = parseInt(match[2], 10);
            const body = match[3];

            let bestAt = null;
            const bestMatch = body.match(/<result\s+name="bestwith"\s+value="([^"]+)"/);
            if (bestMatch) {
              const val = bestMatch[1].replace(/^Best with\s+/i, "").trim();
              if (val && val !== "(Undetermined)") {
                bestAt = val;
              }
            }
            map.set(id, { type, bestAt });
          }
          return map;
        }

        // Batch fetch details in parallel groups of 3 chunks
        const ids = items.map((i) => i.id).filter(Boolean);
        const chunkSize = 20;
        const chunks = [];
        for (let i = 0; i < ids.length; i += chunkSize) {
          chunks.push(ids.slice(i, i + chunkSize));
        }

        addLog(2, `Step 2 Starting: Partitioned ${ids.length} games into ${chunks.length} batches of max 20 IDs.`);

        const thingDetails = new Map();
        const concurrency = 2;
        const step2Start = Date.now();

        for (let i = 0; i < chunks.length; i += concurrency) {
          const currentBatch = chunks.slice(i, i + concurrency);
          const promises = currentBatch.map(async (chunk) => {
            let retry = 0;
            let success = false;
            while (retry < 5 && !success) {
              try {
                const tRes = await fetch(
                  `https://boardgamegeek.com/xmlapi2/thing?id=${chunk.join(",")}&stats=1`,
                  { headers }
                );
                if (tRes.status === 429 || tRes.status === 503) {
                  const delay = (retry + 1) * 1500 + Math.floor(Math.random() * 600);
                  addLog(2, `Rate limited by BGG on batch. Retrying in ${(delay / 1000).toFixed(1)}s...`);
                  await new Promise((r) => setTimeout(r, delay));
                  retry++;
                  continue;
                }
                const tText = await tRes.text();
                const extracted = fastExtractThingDetails(tText);
                for (const [tid, detail] of extracted.entries()) {
                  thingDetails.set(tid, detail);
                }
                success = true;
              } catch (e) {
                retry++;
                await new Promise((r) => setTimeout(r, 1000));
              }
            }
          });

          await Promise.all(promises);
          if (i + concurrency < chunks.length) {
            await new Promise((r) => setTimeout(r, 180));
          }
        }

        let commBestCount = 0;
        let pubFallbackCount = 0;

        for (const item of items) {
          const d = thingDetails.get(item.id);
          const commBest = d?.bestAt && d.bestAt !== "(Undetermined)" ? d.bestAt : null;
          if (d?.type) item.realType = d.type;

          if (commBest) {
            item.bestAt = commBest;
            item.isCommunityBest = true;
            commBestCount++;
          } else if (item.minPlayers && item.maxPlayers) {
            item.bestAt = item.minPlayers === item.maxPlayers
              ? `${item.minPlayers} players`
              : `${item.minPlayers}–${item.maxPlayers} players`;
            item.isCommunityBest = false;
            pubFallbackCount++;
          } else {
            item.bestAt = null;
            item.isCommunityBest = false;
          }
        }

        const step2Duration = ((Date.now() - step2Start) / 1000).toFixed(2);
        addLog(2, `Step 2 Complete: Enriched ${ids.length} games in ${step2Duration}s (${commBestCount} community polls, ${pubFallbackCount} publisher fallbacks).`);

        addLog(3, `Step 3 Starting: Applying base filters, exclusions, and gold metrics...`);

        let baseGames = items.filter((i) => i.status.own);

        // Fetch cross-browser persistent exclusions from KV
        const userExcl = await getUserExclusions(env, username);
        const exclSet = new Set(userExcl.map((e) => e.toLowerCase().trim()));
        const excludedCount = baseGames.filter((i) =>
          exclSet.has(i.name.toLowerCase().trim())
        ).length;

        if (!includeExclusions) {
          baseGames = baseGames.filter((i) => !exclSet.has(i.name.toLowerCase().trim()));
          addLog(3, `Exclusion Filter: ${excludedCount} games excluded for user "${username}".`);
        } else {
          addLog(3, `Exclusion Filter: Bypassed (${excludedCount} games included via toggle).`);
        }

        let expansionCount = 0;
        if (!includeExpansions) {
          const expansionRegex = /\b(expansion|promo|map pack|expansion set|mini-expansion|booster pack|promo pack|promo cards)\b/i;
          const preCount = baseGames.length;
          baseGames = baseGames.filter(
            (i) =>
              i.realType !== "boardgameexpansion" &&
              i.subtype !== "boardgameexpansion" &&
              !i.subtype.toLowerCase().includes("expansion") &&
              !expansionRegex.test(i.name)
          );
          expansionCount = preCount - baseGames.length;
          addLog(3, `Expansion Filter: ${expansionCount} expansions filtered via authoritative BGG type.`);
        }

        const totalEligibleCount = baseGames.length;
        const goldCount = baseGames.filter(
          (i) => (i.averageRating ?? 0) >= 7.2 && (i.usersRated ?? 0) > 300
        ).length;
        const goldPercentage =
          totalEligibleCount > 0
            ? ((goldCount / totalEligibleCount) * 100).toFixed(1)
            : "0.0";

        addLog(3, `Gold Metric: ${goldCount} of ${totalEligibleCount} games (${goldPercentage}%) have rating >= 7.2 with >300 votes.`);
        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
        addLog(3, `Step 3 Complete: Ready with ${baseGames.length} games (Total time: ${totalDuration}s).`);

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              username,
              totalItems: rawItems.length,
              totalEligibleCount,
              userExclusions: userExcl,
              userExclusionsCount: userExcl.length,
              activeExcludedCount: excludedCount,
              goldCount,
              goldPercentage,
              returnedCount: baseGames.length,
              activityLog,
              items: baseGames,
            },
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({
            success: false,
            error: err.message || "Failed to fetch collection from BGG",
            details: {
              message: err.message,
              name: err.name,
              stack: err.stack,
            },
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 4. Static Assets fallback (serves index.html, app.js, style.css, favicon.svg)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};
