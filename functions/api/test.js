export async function onRequestGet(context) {
  const { env, request } = context;
  const token = env.BGG_TOKEN;

  let bggStatus = null;
  let bggError = null;
  let sampleData = null;

  if (token) {
    try {
      const res = await fetch("https://boardgamegeek.com/xmlapi2/collection?username=bwobbones&own=1&stats=1", {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "User-Agent": "Mozilla/5.0 (compatible; CloudflarePages/1.0)",
        },
      });
      bggStatus = res.status;
      const text = await res.text();
      sampleData = text.slice(0, 300);
    } catch (e) {
      bggError = {
        message: e.message,
        name: e.name,
        stack: e.stack,
      };
    }
  }

  return new Response(
    JSON.stringify({
      status: "diagnostic_ok",
      hasToken: Boolean(token),
      tokenLength: token ? token.length : 0,
      bggStatus,
      bggError,
      sampleData,
      envKeys: Object.keys(env || {}),
      url: request.url,
      timestamp: new Date().toISOString(),
    }, null, 2),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
