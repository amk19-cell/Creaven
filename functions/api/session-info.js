import { runFirestoreQuery, getFirestoreDoc } from "./_firestore.js";

// GET /api/session-info?code=XXXX
// Utilisé par consultation.html pour savoir quel praticien anime la session
// et s'il a une voix clonée ElevenLabs disponible. Cherche d'abord dans les
// réservations normales, puis dans les urgences (une fois prises en charge).

function extractValue(field) {
  if (!field) return undefined;
  const key = Object.keys(field)[0];
  return field[key];
}

async function findByCode(env, collection, code) {
  const results = await runFirestoreQuery(env, {
    from: [{ collectionId: collection }],
    where: {
      fieldFilter: {
        field: { fieldPath: "sessionCode" },
        op: "EQUAL",
        value: { stringValue: code.toUpperCase() },
      },
    },
  });
  return (results || []).find((r) => r.document)?.document || null;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response(JSON.stringify({ error: "Paramètre 'code' manquant." }), { status: 400 });
  }

  try {
    let practitionerUid = null;
    let practitionerName = null;
    let sessionLang = null;
    let isEmergency = false;
    let emergencyStatus = null;

    const bookingDoc = await findByCode(env, "bookings", code);
    if (bookingDoc) {
      const f = bookingDoc.fields || {};
      practitionerUid = extractValue(f.practitionerUid);
      practitionerName = extractValue(f.practitionerName);
      sessionLang = extractValue(f.sessionLang);
    } else {
      const emergencyDoc = await findByCode(env, "emergencies", code);
      if (!emergencyDoc) {
        return new Response(JSON.stringify({ error: "Session introuvable pour ce code." }), { status: 404 });
      }
      const f = emergencyDoc.fields || {};
      isEmergency = true;
      emergencyStatus = extractValue(f.status);
      practitionerUid = extractValue(f.practitionerId) || null;
      sessionLang = extractValue(f.sessionLang);
    }

    let elevenLabsVoiceId = null;
    if (practitionerUid) {
      const practDoc = await getFirestoreDoc(env, "Practitioners", practitionerUid);
      if (practDoc) {
        elevenLabsVoiceId = extractValue((practDoc.fields || {}).elevenLabsVoiceId) || null;
        if (!practitionerName) practitionerName = extractValue((practDoc.fields || {}).fullName) || null;
      }
    }

    return new Response(
      JSON.stringify({ practitionerUid, practitionerName, sessionLang, elevenLabsVoiceId, isEmergency, emergencyStatus }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
