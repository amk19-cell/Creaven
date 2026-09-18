import { getVerifiedUser } from "./_firebase-auth.js";
import { runFirestoreQuery } from "./_firestore.js";
import { resolvePractitionerId } from "./_practitioner-identity.js";

const PROJECT_ID = "creaven-01";

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

// GET /api/list-emergencies
// Requiert un praticien approuvé authentifié. Retourne les urgences encore
// "waiting" (pas encore prises en charge) — utilisé par practitioner.html
// pour sonner chez tous les praticiens en même temps.
export async function onRequestGet({ request, env }) {
  const user = await getVerifiedUser(request, PROJECT_ID);
  if (!user) return new Response(JSON.stringify({ error: "Non authentifié." }), { status: 401 });

  const practitionerId = await resolvePractitionerId(env, user.uid);
  if (!practitionerId) {
    return new Response(JSON.stringify({ error: "Aucun profil praticien approuvé n'est lié à ce compte." }), { status: 403 });
  }

  try {
    const results = await runFirestoreQuery(env, {
      from: [{ collectionId: "emergencies" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "status" },
          op: "EQUAL",
          value: { stringValue: "waiting" },
        },
      },
    });

    const emergencies = (results || []).filter((r) => r.document).map((r) => docToObject(r.document));
    return new Response(JSON.stringify({ emergencies }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
