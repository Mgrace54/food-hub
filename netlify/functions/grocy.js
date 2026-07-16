/**
 * Grocy API proxy — keeps the API key server-side.
 *
 * REQUIRED Netlify env vars:
 *   GROCY_URL      → your Tailscale Funnel URL, e.g. https://your-machine.ts.net
 *                    (run: tailscale funnel 9283   on your WSL2 box)
 *   GROCY_API_KEY  → Grocy → Manage API keys
 *
 * Client usage:
 *   GET  /api/grocy?path=/stock
 *   POST /api/grocy?path=/stock/products/42/inventory   body: {new_amount: 4, ...}
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const GROCY_URL = process.env.GROCY_URL?.replace(/\/$/, "");
  const GROCY_API_KEY = process.env.GROCY_API_KEY;

  if (!GROCY_URL || !GROCY_API_KEY) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...CORS },
      body: JSON.stringify({ error: "GROCY_URL and GROCY_API_KEY env vars must be set in Netlify" }),
    };
  }

  // path comes from query string: /api/grocy?path=/stock/products/1/inventory
  const params = new URLSearchParams(event.rawQuery || "");
  const path = params.get("path") || "/system/info";
  const grocy_path = path.startsWith("/api") ? path : `/api${path}`;
  const target = `${GROCY_URL}${grocy_path}`;

  const fetchOptions = {
    method: event.httpMethod,
    headers: {
      "GROCY-API-KEY": GROCY_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };

  if (event.body && event.httpMethod !== "GET") {
    fetchOptions.body = event.body;
  }

  try {
    const response = await fetch(target, fetchOptions);
    const text = await response.text();
    return {
      statusCode: response.status,
      headers: { "Content-Type": "application/json", ...CORS },
      body: text,
    };
  } catch (err) {
    console.error("Grocy proxy error:", err);
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json", ...CORS },
      body: JSON.stringify({
        error: `Cannot reach Grocy at ${GROCY_URL}. Is Tailscale Funnel running on your WSL2 box?`,
        detail: err.message,
      }),
    };
  }
};
