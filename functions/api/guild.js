import { fetchGuildMembers, DEFAULT_GUILD_ID } from "../../lib/guild.js";

/**
 * Cloudflare Pages Function: /api/guild
 * Returns the configured guild's members so the UI can offer one-click
 * collection shortcuts. Mirrors the Worker route in src/worker.js.
 */
export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const guildId = (url.searchParams.get("id") || env.BGG_GUILD_ID || DEFAULT_GUILD_ID).trim();
  const forceRefresh = url.searchParams.get("forceRefresh") === "true";
  const cache = env.BGG_EXCLUSIONS_KV || null;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const data = await fetchGuildMembers({
      guildId,
      token: env.BGG_TOKEN,
      cache,
      forceRefresh,
    });

    return new Response(JSON.stringify({ success: true, data }), { headers });
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Failed to load the guild members",
      }),
      { status: 502, headers }
    );
  }
}
