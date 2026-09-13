import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getProcessedCollection } from "./lib/collectionService.js";
import { getExclusionsForUser } from "./lib/exclusions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/**
 * Cloudflare Access JWT Middleware
 * Prevents direct access via onrender.com URLs by enforcing Cloudflare JWT header
 */
app.use((req, res, next) => {
  const enforceAuth =
    process.env.ENFORCE_CLOUDFLARE_AUTH === "true" ||
    Boolean(process.env.CLOUDFLARE_AUD);

  if (enforceAuth) {
    const jwtToken = req.headers["cf-access-jwt-assertion"];

    if (!jwtToken) {
      return res
        .status(403)
        .send(
          "<!DOCTYPE html><html><head><title>403 Forbidden</title>" +
            "<style>body{font-family:sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}" +
            ".box{background:#1e293b;padding:2rem;border-radius:1rem;border:1px solid #334155;max-width:480px;text-align:center;}" +
            "h1{color:#f59e0b;margin-top:0;}p{color:#94a3b8;font-size:0.9rem;}</style></head>" +
            "<body><div class='box'><h1>403 Forbidden</h1>" +
            "<p>Direct access to this server is not allowed. You must access this application through Cloudflare Access.</p>" +
            "</div></body></html>"
        );
    }

    try {
      const parts = jwtToken.split(".");
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], "base64url").toString("utf-8");
        const payload = JSON.parse(payloadJson);

        if (
          process.env.CLOUDFLARE_AUD &&
          payload.aud !== process.env.CLOUDFLARE_AUD
        ) {
          return res
            .status(403)
            .send("<h1>403 Forbidden</h1><p>Invalid Cloudflare Access Audience tag.</p>");
        }

        req.cfUser = {
          email: payload.email,
          sub: payload.sub,
        };
      }
    } catch (e) {
      return res
        .status(403)
        .send("<h1>403 Forbidden</h1><p>Invalid Cloudflare Access JWT assertion.</p>");
    }
  }

  next();
});

app.use(express.static(path.join(__dirname, "public")));

/**
 * Cloudflare Access User Info & Logout Route
 * Returns user email if passed through Cloudflare Access
 */
app.get("/api/auth/me", (req, res) => {
  const email =
    req.cfUser?.email ||
    req.headers["cf-access-authenticated-user-email"] ||
    null;

  res.json({
    authenticated: Boolean(email),
    email,
  });
});

/**
 * Server-Sent Events (SSE) Stream Route: GET /api/collection/stream
 */
app.get("/api/collection/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendSSE = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const {
      username,
      mode,
      query,
      minRating,
      maxRating,
      minPlays,
      bestAt,
      playerCounts,
      includeExpansions,
      includeExclusions,
    } = req.query;

    const result = await getProcessedCollection({
      username: username ? String(username).trim() : undefined,
      mode: mode ? String(mode).trim() : undefined,
      query: query ? String(query).trim() : undefined,
      minRating: minRating ? parseFloat(minRating) : null,
      maxRating: maxRating ? parseFloat(maxRating) : null,
      minPlays: minPlays ? parseInt(minPlays, 10) : null,
      bestAt: bestAt ? String(bestAt).trim() : null,
      playerCounts: playerCounts
        ? Array.isArray(playerCounts)
          ? playerCounts
          : String(playerCounts).split(",")
        : undefined,
      includeExpansions: includeExpansions === "true" || includeExpansions === "1",
      includeExclusions: includeExclusions === "true" || includeExclusions === "1",
      verbose: true,
      onProgress: (p) => sendSSE("progress", p),
    });

    sendSSE("complete", { success: true, data: result });
    res.end();
  } catch (err) {
    const errorPayload = {
      success: false,
      error: err.message || "Failed to process collection",
      details: {
        message: err.message,
        name: err.name,
        code: err.code,
        status: err.response?.status,
        statusText: err.response?.statusText,
        url: err.config?.url,
        stack: err.stack,
      },
    };
    sendSSE("error", errorPayload);
    res.end();
  }
});

/**
 * Standard API Route: GET /api/collection
 */
app.get("/api/collection", async (req, res) => {
  try {
    const {
      username,
      mode,
      query,
      minRating,
      maxRating,
      minPlays,
      bestAt,
      playerCounts,
      includeExpansions,
      includeExclusions,
    } = req.query;

    const result = await getProcessedCollection({
      username: username ? String(username).trim() : undefined,
      mode: mode ? String(mode).trim() : undefined,
      query: query ? String(query).trim() : undefined,
      minRating: minRating ? parseFloat(minRating) : null,
      maxRating: maxRating ? parseFloat(maxRating) : null,
      minPlays: minPlays ? parseInt(minPlays, 10) : null,
      bestAt: bestAt ? String(bestAt).trim() : null,
      playerCounts: playerCounts
        ? Array.isArray(playerCounts)
          ? playerCounts
          : String(playerCounts).split(",")
        : undefined,
      includeExpansions: includeExpansions === "true" || includeExpansions === "1",
      includeExclusions: includeExclusions === "true" || includeExclusions === "1",
      verbose: true,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || "Failed to process collection",
    });
  }
});

// In-memory persistent exclusions store for local development server
const localExclusionsStore = new Map();

/**
 * Exclusions API Routes: GET & POST /api/exclusions
 */
app.get("/api/exclusions", (req, res) => {
  const normUser = String(req.query.username || "bwobbones").trim().toLowerCase();
  const exclusions = localExclusionsStore.get(normUser) || getExclusionsForUser(normUser);
  res.json({ success: true, username: normUser, exclusions });
});

app.post("/api/exclusions", (req, res) => {
  const normUser = String(req.body.username || "bwobbones").trim().toLowerCase();
  const exclusions = Array.isArray(req.body.exclusions) ? req.body.exclusions : [];
  localExclusionsStore.set(normUser, exclusions);
  res.json({ success: true, username: normUser, exclusions, count: exclusions.length });
});

app.listen(PORT, () => {
  console.log(`🚀 BoardGameGeek Collection Web App running at http://localhost:${PORT}`);
});
