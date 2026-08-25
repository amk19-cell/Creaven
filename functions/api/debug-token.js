// GET /api/debug-token?token=XXXX
//
// ⚠️ TEMPORAIRE — sert uniquement à diagnostiquer le problème de token.
// Ne révèle JAMAIS les valeurs réelles, seulement des métadonnées (longueur,
// présence d'espaces, égalité). À SUPPRIMER une fois le problème résolu.

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const receivedToken = url.searchParams.get("token") || "";
  const storedToken = env.REMINDERS_CRON_TOKEN || "";

  return new Response(
    JSON.stringify(
      {
        storedTokenExists: !!env.REMINDERS_CRON_TOKEN,
        storedTokenLength: storedToken.length,
        storedTokenHasLeadingOrTrailingWhitespace: storedToken !== storedToken.trim(),
        receivedTokenLength: receivedToken.length,
        receivedTokenHasLeadingOrTrailingWhitespace: receivedToken !== receivedToken.trim(),
        exactMatch: receivedToken === storedToken,
        matchAfterTrim: receivedToken.trim() === storedToken.trim(),
        // Affiche seulement les 2 premiers et 2 derniers caractères, jamais le reste.
        storedTokenPreview:
          storedToken.length > 4
            ? `${storedToken.slice(0, 2)}...${storedToken.slice(-2)}`
            : "(trop court pour preview)",
        receivedTokenPreview:
          receivedToken.length > 4
            ? `${receivedToken.slice(0, 2)}...${receivedToken.slice(-2)}`
            : "(trop court pour preview)",
      },
      null,
      2
    ),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
