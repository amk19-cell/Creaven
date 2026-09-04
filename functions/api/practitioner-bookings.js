import { getVerifiedUser } from "./_firebase-auth.js";
import { runFirestoreQuery } from "./_firestore.js";

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

// GET /api/practitioner-bookings
// Header requis : Authorization: Bearer <Firebase ID token>
// Retourne uniquement les réservations où practitionerUid correspond au
// praticien authentifié — jamais celles des autres praticiens.
export async function onRequestGet({ request, env }) {
  const user = await getVerifiedUser(request, PROJECT_ID);
  if (!user) {
    return new Response(JSON.stringify({ error: "Non authentifié." }), {
      status: 401,
    });
  }

  const structuredQuery = {
    from: [{ collectionId: "bookings" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "practitionerUid" },
        op: "EQUAL",
        value: { stringValue: user.uid },
      },
    },
  };

  let results;
  try {
    results = await runFirestoreQuery(env, structuredQuery);
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }

  const bookings = (results || [])
    .filter((r) => r.document)
    .map((r) => docToObject(r.document));

  return new Response(JSON.stringify({ bookings }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
