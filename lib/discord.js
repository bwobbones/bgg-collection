/**
 * Discord spin-result sharing.
 *
 * Shared by the Cloudflare Worker (src/worker.js) and the local dev server
 * (server.js) so both behave identically. The webhook URL is always supplied by
 * the caller from server-side config and is never exposed to the browser.
 */

// Discord's default (non-boosted) upload limit
export const DISCORD_GIF_MAX_BYTES = 8 * 1024 * 1024;

const BGG_BASE_URL = "https://boardgamegeek.com/boardgame";

/**
 * Convert a base64 string (bare or data URL) into a Uint8Array.
 */
export function base64ToBytes(base64) {
  const raw = String(base64).replace(/^data:image\/gif;base64,/, "");
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function buildSpinEmbed(winner = {}) {
  const name = String(winner.name || "Unknown game").slice(0, 200);
  const fields = [];

  if (winner.bestAt) {
    fields.push({
      name: winner.isCommunityBest === false ? "Players (publisher)" : "Best at",
      value: String(winner.bestAt).slice(0, 100),
      inline: true,
    });
  }
  if (winner.averageRating) {
    fields.push({
      name: "Average rating",
      value: Number(winner.averageRating).toFixed(1),
      inline: true,
    });
  }
  if (winner.year) {
    fields.push({ name: "Year", value: String(winner.year), inline: true });
  }
  if (winner.numPlays !== undefined && winner.numPlays !== null) {
    fields.push({ name: "Your plays", value: String(winner.numPlays), inline: true });
  }

  const embed = {
    title: `🎲 ${name}`.slice(0, 256),
    color: 0xf59e0b,
    fields,
    footer: { text: "Wheel of Fortune • BGG Collection Explorer" },
    timestamp: new Date().toISOString(),
  };

  if (winner.id) {
    embed.url = `${BGG_BASE_URL}/${winner.id}`;
  }

  return { embed, name, bggUrl: embed.url || null };
}

/**
 * Post a spin result to a Discord webhook, optionally attaching an animated GIF.
 *
 * @param {object} options
 * @param {string} options.webhookUrl  Discord webhook URL (required)
 * @param {object} options.winner      Winner metadata for the embed
 * @param {string} [options.gifBase64] Base64 (or data URL) animated GIF
 * @returns {Promise<{winner: string, gifBytes: number}>}
 */
export async function shareSpinToDiscord({ webhookUrl, winner, gifBase64 } = {}) {
  if (!webhookUrl) {
    throw new Error(
      "DISCORD_WEBHOOK_URL is not configured. Run: npx wrangler secret put DISCORD_WEBHOOK_URL"
    );
  }

  const { embed, name, bggUrl } = buildSpinEmbed(winner);

  let gifBytes = null;
  if (gifBase64) {
    gifBytes = base64ToBytes(gifBase64);
    if (gifBytes.length === 0) {
      throw new Error("The animated GIF payload was empty.");
    }
    if (gifBytes.length > DISCORD_GIF_MAX_BYTES) {
      throw new Error(
        `Animated GIF is ${(gifBytes.length / 1024 / 1024).toFixed(2)} MB, which exceeds Discord's 8 MB limit.`
      );
    }
  }

  const form = new FormData();
  if (gifBytes) {
    embed.image = { url: "attachment://spin.gif" };
    form.append("files[0]", new Blob([gifBytes], { type: "image/gif" }), "spin.gif");
  }

  form.append(
    "payload_json",
    JSON.stringify({
      content: `🎉 **${name}** won the spin!${bggUrl ? `\n${bggUrl}` : ""}`.slice(0, 2000),
      embeds: [embed],
    })
  );

  const res = await fetch(webhookUrl, { method: "POST", body: form });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Discord is rate limiting the webhook. Try again in a few seconds.");
    }
    const body = (await res.text().catch(() => "")).slice(0, 400);
    throw new Error(`Discord rejected the post (HTTP ${res.status}): ${body}`);
  }

  return { winner: name, gifBytes: gifBytes ? gifBytes.length : 0 };
}
