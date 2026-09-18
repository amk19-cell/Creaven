import { getVerifiedUser } from "./_firebase-auth.js";
import { getFirestoreDoc, updateFirestoreDoc } from "./_firestore.js";
import { resolvePractitionerId } from "./_practitioner-identity.js";

const PROJECT_ID = "creaven-01";

function extractValue(field) {
  if (!field) return undefined;
  const key = Object.keys(field)[0];
  return field[key];
}

// POST /api/claim-emergency
// body: { emergencyId }
// Le praticien authentifié prend en charge une urgence "waiting". Si un
// autre praticien l'a déjà prise entre-temps, renvoie une erreur claire.
//
// LIMITE HONNÊTE : cette vérification n'est pas parfaitement atomique (lire
// puis écrire, pas une vraie transaction). Avec 4 praticiens humains, le
// risque de collision au même instant est très faible, mais pas nul.
export async function onRequestPost({ request, env }) {
  const user = await getVerifiedUser(request, PROJECT_ID);
  if (!user) return new Response(JSON.stringify({ error: "Non authentifié." }), { status: 401 });

  const practitionerId = await resolvePractitionerId(env, user.uid);
  if (!practitionerId) {
    return new Response(JSON.stringify({ error: "Aucun profil praticien approuvé n'est lié à ce compte." }), { status: 403 });
  }

  try {
    const body = await request.json();
    const { emergencyId } = body;
    if (!emergencyId) {
      return new Response(JSON.stringify({ error: "emergencyId manquant." }), { status: 400 });
    }

    const doc = await getFirestoreDoc(env, "emergencies", emergencyId);
    if (!doc) {
      return new Response(JSON.stringify({ error: "Urgence introuvable." }), { status: 404 });
    }
    const status = extractValue((doc.fields || {}).status);
    if (status !== "waiting") {
      return new Response(
        JSON.stringify({ error: "Cette urgence a déjà été prise en charge par quelqu'un d'autre." }),
        { status: 409 }
      );
    }

    await updateFirestoreDoc(env, "emergencies", emergencyId, {
      status: "claimed",
      practitionerId,
      claimedAt: new Date(),
    });

    const sessionCode = extractValue((doc.fields || {}).sessionCode);
    return new Response(JSON.stringify({ success: true, sessionCode }), {
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
