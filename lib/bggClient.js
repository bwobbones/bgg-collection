import axios from "axios";
import convert from "xml-js";

/**
 * Fetch collection XML from BoardGameGeek XML API2 with retry/polling support.
 *
 * @param {string} username - BoardGameGeek username
 * @param {Object} options - API parameters and options
 * @returns {Promise<string>} Raw XML response string
 */
export async function fetchBGGCollection(username, options = {}) {
  const {
    own,
    played,
    rated,
    wishlist,
    subtype = "boardgame",
    stats = true,
    token = process.env.BGG_TOKEN,
    maxRetries = 10,
    retryDelay = 3000,
    verbose = true,
    onProgress = null,
  } = options;

  if (!username) {
    throw new Error("BGG username is required.");
  }

  const url = "https://boardgamegeek.com/xmlapi2/collection";
  const params = {
    username,
    subtype,
    stats: stats ? 1 : 0,
  };

  if (typeof own === "boolean") params.own = own ? 1 : 0;
  if (typeof played === "boolean") params.played = played ? 1 : 0;
  if (typeof rated === "boolean") params.rated = rated ? 1 : 0;
  if (typeof wishlist === "boolean") params.wishlist = wishlist ? 1 : 0;

  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token.trim()}`;
  }

  if (verbose) {
    console.log(`[BGG Client] [1/3] Requesting collection XML for user "${username}"...`);
  }

  if (onProgress) {
    onProgress({
      step: "collection",
      message: `Requesting collection for "${username}" from BoardGameGeek...`,
    });
  }

  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const response = await axios.get(url, {
        params,
        headers,
        validateStatus: (status) => status === 200 || status === 202,
      });

      const xmlData = response.data;

      const isQueued =
        response.status === 202 ||
        (typeof xmlData === "string" &&
          xmlData.includes("Your request for this collection has been accepted"));

      if (isQueued) {
        const queueMsg = `Collection request queued by BGG. Polling in ${retryDelay / 1000}s (attempt ${attempt}/${maxRetries})...`;
        if (verbose) {
          console.log(`[BGG Client] ${queueMsg}`);
        }
        if (onProgress) {
          onProgress({
            step: "queue",
            attempt,
            maxRetries,
            message: queueMsg,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      if (typeof xmlData === "string" && xmlData.includes("<errors>")) {
        try {
          const parsed = convert.xml2js(xmlData, { compact: true });
          const errMsg =
            parsed?.errors?.error?.message?._text || "Unknown BGG API error";
          throw new Error(`BGG API Error: ${errMsg}`);
        } catch (e) {
          if (e.message.startsWith("BGG API Error:")) throw e;
        }
      }

      if (verbose) {
        console.log(`[BGG Client] Collection XML successfully received for "${username}".`);
      }

      return xmlData;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const statusText = err.response?.statusText;

        if (status === 401) {
          throw new Error(
            "BGG API Unauthorized (401). BoardGameGeek requires an API Bearer Token.\n" +
              "Please specify BGG_TOKEN in your .env file or pass --token <your_token>."
          );
        }

        if (status === 404) {
          throw new Error(`User "${username}" not found on BoardGameGeek.`);
        }

        if (attempt >= maxRetries) {
          throw new Error(
            `Network error fetching BGG collection (${status || "No Status"}: ${statusText || err.message}).`
          );
        }
      } else {
        throw err;
      }

      if (attempt >= maxRetries) {
        throw new Error(`Failed to fetch collection after ${maxRetries} attempts.`);
      }

      if (verbose) {
        console.log(`[BGG Client] Attempt ${attempt} failed (${err.message}). Retrying...`);
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error(`Request timed out after ${maxRetries} attempts waiting for BGG queue.`);
}

/**
 * Fetch detailed thing XML for a list of game IDs (max 20 per request)
 * Handles rate limits (HTTP 429) automatically with retry backoff.
 *
 * @param {Array<number>} ids - Game IDs
 * @param {Object} options
 * @returns {Promise<Array<string>>} Array of XML response strings
 */
export async function fetchBGGThings(ids, options = {}) {
  const {
    token = process.env.BGG_TOKEN,
    verbose = true,
    onProgress = null,
  } = options;

  if (!ids || ids.length === 0) return [];

  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token.trim()}`;
  }

  // BGG enforces a hard limit of max 20 IDs per /xmlapi2/thing call
  const maxPerChunk = 20;
  const chunks = [];
  for (let i = 0; i < ids.length; i += maxPerChunk) {
    chunks.push(ids.slice(i, i + maxPerChunk));
  }

  if (verbose) {
    console.log(
      `[BGG Client] [3/3] Fetching details & "Best At" poll data for ${ids.length} games in ${chunks.length} batches...`
    );
  }

  const xmlResults = [];
  let fetchedCount = 0;

  const fetchChunkWithRetry = async (chunk, retryCount = 0) => {
    const url = `https://boardgamegeek.com/xmlapi2/thing?id=${chunk.join(",")}&stats=1`;
    try {
      const res = await axios.get(url, { headers });
      return res.data;
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        (err.response?.status === 429 || err.response?.status === 503)
      ) {
        if (retryCount < 5) {
          const delay = (retryCount + 1) * 2000;
          const currentPct = Math.min(100, Math.round((fetchedCount / ids.length) * 100));
          const rateMsg = `Rate limited by BGG (${fetchedCount}/${ids.length} loaded). Retrying batch in ${delay / 1000}s...`;

          if (verbose) {
            console.log(`[BGG Client] ${rateMsg}`);
          }
          if (onProgress) {
            onProgress({
              step: "ratelimit",
              current: fetchedCount,
              total: ids.length,
              percentage: currentPct,
              message: rateMsg,
            });
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
          return fetchChunkWithRetry(chunk, retryCount + 1);
        }
      }
      throw err;
    }
  };

  // Process chunks in small batches with gentle delays
  const batchSize = 2;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const currentBatches = chunks.slice(i, i + batchSize);
    const promises = currentBatches.map((chunk) => fetchChunkWithRetry(chunk));

    const results = await Promise.all(promises);
    xmlResults.push(...results);

    for (const chunk of currentBatches) {
      fetchedCount += chunk.length;
    }

    const pct = Math.min(100, Math.round((fetchedCount / ids.length) * 100));
    const progressMsg = `Fetching game details: ${fetchedCount} of ${ids.length} games loaded (${pct}%)...`;

    if (verbose) {
      console.log(`[BGG Client] ${progressMsg}`);
    }

    if (onProgress) {
      onProgress({
        step: "things",
        current: fetchedCount,
        total: ids.length,
        percentage: pct,
        message: progressMsg,
      });
    }

    if (i + batchSize < chunks.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return xmlResults;
}
