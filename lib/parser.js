import convert from "xml-js";

/**
 * Safely extract text content from xml-js parsed node
 */
function getText(node) {
  if (!node) return null;
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (node._text !== undefined) return String(node._text);
  if (node._cdata !== undefined) return String(node._cdata);
  return null;
}

/**
 * Safely extract attribute value from xml-js node
 */
function getAttr(node, attrName) {
  if (!node || !node._attributes) return null;
  return node._attributes[attrName] ?? null;
}

/**
 * Extract "Best At" player count recommendation from a thing XML item node
 */
function extractBestAtFromThing(thingItem) {
  // 1. Check poll-summary (fastest & most accurate BGG summary)
  const pollSummaryNode = thingItem["poll-summary"];
  if (pollSummaryNode) {
    const pollSummaries = Array.isArray(pollSummaryNode)
      ? pollSummaryNode
      : [pollSummaryNode];

    for (const ps of pollSummaries) {
      if (getAttr(ps, "name") === "suggested_numplayers" || !getAttr(ps, "name")) {
        const results = Array.isArray(ps.result)
          ? ps.result
          : ps.result
          ? [ps.result]
          : [];

        const bestRes = results.find((r) => getAttr(r, "name") === "bestwith");
        if (bestRes) {
          const val = getAttr(bestRes, "value");
          if (val) {
            return val.replace(/^Best with\s+/i, "").trim();
          }
        }
      }
    }
  }

  // 2. Fallback to raw poll results for suggested_numplayers
  const pollNode = thingItem.poll;
  if (pollNode) {
    const polls = Array.isArray(pollNode) ? pollNode : [pollNode];
    const playerPoll = polls.find(
      (p) => getAttr(p, "name") === "suggested_numplayers"
    );

    if (playerPoll && playerPoll.results) {
      const resultsList = Array.isArray(playerPoll.results)
        ? playerPoll.results
        : [playerPoll.results];

      let maxVotes = 0;
      let bestNum = null;

      for (const resNode of resultsList) {
        const numPlayers = getAttr(resNode, "numplayers");
        const options = Array.isArray(resNode.result)
          ? resNode.result
          : resNode.result
          ? [resNode.result]
          : [];

        const bestOpt = options.find((o) => getAttr(o, "value") === "Best");
        if (bestOpt) {
          const votes = parseInt(getAttr(bestOpt, "numvotes") || "0", 10);
          if (votes > maxVotes) {
            maxVotes = votes;
            bestNum = numPlayers;
          }
        }
      }

      if (bestNum && maxVotes > 0) {
        return `${bestNum} players`;
      }
    }
  }

  return null;
}

/**
 * Extract "Recommended At" player count from a thing XML item node
 */
function extractRecommendedAtFromThing(thingItem) {
  const pollSummaryNode = thingItem["poll-summary"];
  if (pollSummaryNode) {
    const pollSummaries = Array.isArray(pollSummaryNode)
      ? pollSummaryNode
      : [pollSummaryNode];

    for (const ps of pollSummaries) {
      if (getAttr(ps, "name") === "suggested_numplayers" || !getAttr(ps, "name")) {
        const results = Array.isArray(ps.result)
          ? ps.result
          : ps.result
          ? [ps.result]
          : [];

        const recRes = results.find((r) => getAttr(r, "name") === "recommmendedwith");
        if (recRes) {
          const val = getAttr(recRes, "value");
          if (val) {
            return val.replace(/^Recommended with\s+/i, "").trim();
          }
        }
      }
    }
  }

  return null;
}

/**
 * Parses raw XML string from BGG collection API into standard JavaScript objects.
 *
 * @param {string} xmlString
 * @returns {{ totalItems: number, items: Array<Object> }}
 */
export function parseBGGCollectionXML(xmlString) {
  if (!xmlString) {
    return { totalItems: 0, items: [] };
  }

  const parsed = convert.xml2js(xmlString, { compact: true });
  const itemsContainer = parsed?.items;

  if (!itemsContainer) {
    return { totalItems: 0, items: [] };
  }

  const totalItems = parseInt(getAttr(itemsContainer, "totalitems") || "0", 10);
  let rawItems = itemsContainer.item;

  if (!rawItems) {
    return { totalItems: 0, items: [] };
  }

  if (!Array.isArray(rawItems)) {
    rawItems = [rawItems];
  }

  const items = rawItems.map((item) => {
    const id = parseInt(getAttr(item, "objectid"), 10) || null;
    const subtype = getAttr(item, "subtype") || "boardgame";
    const name = getText(item.name) || "Unknown Title";
    const year = parseInt(getText(item.yearpublished), 10) || null;
    const image = getText(item.image) || null;
    const thumbnail = getText(item.thumbnail) || null;
    const numPlays = parseInt(getText(item.numplays), 10) || 0;
    const comment = getText(item.comment) || null;

    // Parse Status
    const statusNode = item.status;
    const status = {
      own: getAttr(statusNode, "own") === "1",
      prevowned: getAttr(statusNode, "prevowned") === "1",
      fortrade: getAttr(statusNode, "fortrade") === "1",
      want: getAttr(statusNode, "want") === "1",
      wanttoplay: getAttr(statusNode, "wanttoplay") === "1",
      wanttobuy: getAttr(statusNode, "wanttobuy") === "1",
      wishlist: getAttr(statusNode, "wishlist") === "1",
      preordered: getAttr(statusNode, "preordered") === "1",
    };

    // Parse Stats & Ratings
    const statsNode = item.stats;
    let minPlayers = null;
    let maxPlayers = null;
    let playingTime = null;
    let userRating = null;
    let averageRating = null;
    let bayesAverage = null;
    let rank = null;

    if (statsNode) {
      minPlayers = parseInt(getAttr(statsNode, "minplayers"), 10) || null;
      maxPlayers = parseInt(getAttr(statsNode, "maxplayers"), 10) || null;
      playingTime = parseInt(getAttr(statsNode, "playingtime"), 10) || null;

      const ratingNode = statsNode.rating;
      if (ratingNode) {
        const rawUserRating = getAttr(ratingNode, "value");
        if (rawUserRating && rawUserRating !== "N/A") {
          userRating = parseFloat(rawUserRating);
        }

        const avgNode = ratingNode.average;
        if (avgNode) {
          const rawAvg = getAttr(avgNode, "value");
          if (rawAvg && rawAvg !== "N/A") averageRating = parseFloat(rawAvg);
        }

        const bayesNode = ratingNode.bayesaverage;
        if (bayesNode) {
          const rawBayes = getAttr(bayesNode, "value");
          if (rawBayes && rawBayes !== "N/A") bayesAverage = parseFloat(rawBayes);
        }

        // Parse Ranks
        let ranksNode = ratingNode.ranks?.rank;
        if (ranksNode) {
          if (!Array.isArray(ranksNode)) ranksNode = [ranksNode];

          const mainRankObj =
            ranksNode.find(
              (r) =>
                getAttr(r, "name") === "boardgame" ||
                getAttr(r, "type") === "subtype"
            ) || ranksNode[0];

          if (mainRankObj) {
            const rawRankVal = getAttr(mainRankObj, "value");
            if (rawRankVal && rawRankVal !== "Not Ranked" && rawRankVal !== "N/A") {
              rank = parseInt(rawRankVal, 10);
            }
          }
        }
      }
    }

    return {
      id,
      name,
      year,
      subtype,
      realType: subtype,
      status,
      numPlays,
      userRating,
      averageRating,
      bayesAverage,
      rank,
      minPlayers,
      maxPlayers,
      playingTime,
      bestAt: null,
      recommendedAt: null,
      comment,
      image,
      thumbnail,
    };
  });

  return {
    totalItems: totalItems || items.length,
    items,
  };
}

/**
 * Parse thing XML string(s) to map game IDs to authoritative item type, "best at", and "recommended at"
 *
 * @param {Array<string>} thingXmlList - Array of XML strings from BGG thing API
 * @returns {Map<number, { type: string|null, bestAt: string|null, recommendedAt: string|null }>}
 */
export function parseThingsXML(thingXmlList) {
  const detailsMap = new Map();

  if (!thingXmlList || thingXmlList.length === 0) return detailsMap;

  for (const xmlString of thingXmlList) {
    if (!xmlString) continue;

    try {
      const parsed = convert.xml2js(xmlString, { compact: true });
      const itemsContainer = parsed?.items;
      if (!itemsContainer) continue;

      let rawItems = itemsContainer.item;
      if (!rawItems) continue;
      if (!Array.isArray(rawItems)) rawItems = [rawItems];

      for (const item of rawItems) {
        const id = parseInt(getAttr(item, "id"), 10);
        if (!id) continue;

        const type = getAttr(item, "type");
        const bestAt = extractBestAtFromThing(item);
        const recommendedAt = extractRecommendedAtFromThing(item);

        detailsMap.set(id, { type, bestAt, recommendedAt });
      }
    } catch (e) {
      // Ignore XML parse errors for individual batches
    }
  }

  return detailsMap;
}
