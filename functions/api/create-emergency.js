import { createFirestoreDoc } from "./_firestore.js";

// POST /api/create-emergency
// body: { clientName, sessionLang, mode }
// → crée une session d'urgence en attente ("waiting"), gratuite / paiement
//   différé (aucun paiement requis pour accéder à la session). Retourne un
//   code de session, immédiatement utilisable sur consultation.html.
//
// Le paiement différé lui-même (facturation après coup) N'EST PAS géré ici
// — c'est un chantier séparé (facturation manuelle par l'admin pour l'instant).

function generateSessionCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { clientName, sessionLang, mode } = body;

    if (!clientName) {
      return new Response(JSON.stringify({ error: "Champ requis manquant (clientName)." }), { status: 400 });
    }

    const sessionCode = generateSessionCode();

    const { docId } = await createFirestoreDoc(env, "emergencies", {
      clientName,
      sessionLang: sessionLang || "English",
      mode: mode === "audio" ? "audio" : "video",
      sessionCode,
      status: "waiting", // waiting -> claimed -> completed
      practitionerId: "",
      createdAt: new Date(),
    });

    return new Response(JSON.stringify({ success: true, emergencyId: docId, sessionCode }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
