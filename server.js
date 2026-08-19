import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getProcessedCollection } from "./lib/collectionService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/**
 * API Route: GET /api/collection
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
      includeExpansions,
    } = req.query;

    const result = await getProcessedCollection({
      username: username ? String(username).trim() : undefined,
      mode: mode ? String(mode).trim() : undefined,
      query: query ? String(query).trim() : undefined,
      minRating: minRating ? parseFloat(minRating) : null,
      maxRating: maxRating ? parseFloat(maxRating) : null,
      minPlays: minPlays ? parseInt(minPlays, 10) : null,
      bestAt: bestAt ? String(bestAt).trim() : null,
      includeExpansions: includeExpansions === "true" || includeExpansions === "1",
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

app.listen(PORT, () => {
  console.log(`🚀 BoardGameGeek Collection Web App running at http://localhost:${PORT}`);
});
