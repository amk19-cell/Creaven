import { getVerifiedUser } from "./_firebase-auth.js";
import { runFirestoreQuery, createFirestoreDoc, deleteFirestoreDoc } from "./_firestore.js";
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

async function requirePractitioner(request, env) {
  const user = await getVerifiedUser(request, PROJECT_ID);
  if (!user) return { error: new Response(JSON.stringify({ error: "Non authentifié." }), { status: 401 }) };
  const practitionerId = await resolvePractitionerId(env, user.uid);
  if (!practitionerId) {
    return {
      error: new Response(
        JSON.stringify({ error: "Aucun profil praticien approuvé n'est lié à ce compte." }),
        { status: 403 }
      ),
    };
  }
  return { practitionerId };
}

// GET /api/practitioner-availability → liste les créneaux du praticien connecté
// POST /api/practitioner-availability → { date, time, duration } crée un créneau
// DELETE /api/practitioner-availability?id=XXX → supprime un créneau non réservé
export async function onRequestGet({ request, env }) {
  const { practitionerId, error } = await requirePractitioner(request, env);
  if (error) return error;

  const structuredQuery = {
    from: [{ collectionId: "availability" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "practitionerUid" },
        op: "EQUAL",
        value: { stringValue: practitionerId },
      },
    },
  };

  let results;
  try {
    results = await runFirestoreQuery(env, structuredQuery);
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }

  const slots = (results || []).filter((r) => r.document).map((r) => docToObject(r.document));
  return new Response(JSON.stringify({ slots }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost({ request, env }) {
  const { practitionerId, error } = await requirePractitioner(request, env);
  if (error) return error;

  try {
    const body = await request.json();
    const { date, time, duration } = body;
    if (!date || !time) {
      return new Response(JSON.stringify({ error: "Champs requis manquants (date, time)." }), { status: 400 });
    }

    const { docId } = await createFirestoreDoc(env, "availability", {
      practitionerUid: practitionerId,
      date,
      time,
      duration: Number(duration) || 60,
      status: "open",
      createdAt: new Date(),
    });

    return new Response(JSON.stringify({ success: true, docId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestDelete({ request, env }) {
  const { practitionerId, error } = await requirePractitioner(request, env);
  if (error) return error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response(JSON.stringify({ error: "Paramètre 'id' manquant." }), { status: 400 });

  try {
    const check = await runFirestoreQuery(env, {
      from: [{ collectionId: "availability" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "practitionerUid" },
          op: "EQUAL",
          value: { stringValue: practitionerId },
        },
      },
    });
    const owns = (check || []).some((r) => r.document && r.document.name.split("/").pop() === id);
    if (!owns) {
      return new Response(JSON.stringify({ error: "Ce créneau ne vous appartient pas." }), { status: 403 });
    }

    await deleteFirestoreDoc(env, "availability", id);
    return new Response(JSON.stringify({ success: true }), {
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
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
