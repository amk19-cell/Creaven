import { runFirestoreQuery } from "./_firestore.js";

// GET /api/admin-list-bookings?token=XXXX
// Utilise le même principe de token partagé que /api/run-reminders — adapté
// puisqu'il n'y a qu'une seule admin (Dani), contrairement aux endpoints
// praticien qui doivent distinguer plusieurs identités différentes.
//
// Variable d'environnement requise (secret Cloudflare) : ADMIN_DASHBOARD_TOKEN

function extractValue(field) {
  if (!field) return undefined;
  const key = Object.keys(field)[0];
  return field[key];
}

function docToObject(doc) {
  const f = doc.fields || {};
  const obj = { id: doc.name.split("/").pop() };
  for (const k of Object.keys(f)) obj[k] = extractValue(f[k]);
  return obj;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!env.ADMIN_DASHBOARD_TOKEN || token !== env.ADMIN_DASHBOARD_TOKEN) {
    return new Response(JSON.stringify({ error: "Non autorisé." }), { status: 401 });
  }

  // Pas de filtre côté requête : on récupère tout et on trie côté client
  // (le volume attendu reste petit pour ce projet).
  const structuredQuery = { from: [{ collectionId: "bookings" }] };

  let results;
  try {
    results = await runFirestoreQuery(env, structuredQuery);
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }

  const bookings = (results || []).filter((r) => r.document).map((r) => docToObject(r.document));

  return new Response(JSON.stringify({ bookings }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
