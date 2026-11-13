// /functions/api/get-gemini-token.js
// Génère un ephemeral token Gemini (durée 90 min, uses: 30) pour le navigateur.
// La vraie GEMINI_API_KEY reste un secret Cloudflare.

const ALLOWED_ORIGINS = [
  "https://creaven.pages.dev"
  // Ajoute ici ton domaine personnalisé si tu en as un plus tard
];

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.GEMINI_API_KEY) {
      return json({ error: "Server misconfigured: GEMINI_API_KEY missing." }, 500);
    }

    const origin = request.headers.get("Origin") || "";
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: "Forbidden" }, 403);
    }

    const now = Date.now();
    // 90 min = séance d'1h + marge pour les reconnexions
    const expireTime = new Date(now + 90 * 60 * 1000).toISOString();
    // Il faut démarrer la session dans les 2 min après récupération du token
    const newSessionExpireTime = new Date(now + 2 * 60 * 1000).toISOString();

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1alpha/auth_tokens",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          uses: 30,  // 30 reconnexions max sur 90 min (large marge)
          expireTime,
          newSessionExpireTime
        })
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini auth_tokens error:", res.status, errText);
      return json({ error: "Token generation failed.", details: errText }, 502);
    }

    const data = await res.json();
    return json({ token: data.name, expireTime });

  } catch (err) {
    console.error("get-gemini-token error:", err);
    return json({ error: "Internal error.", details: err.message }, 500);
  }
}
