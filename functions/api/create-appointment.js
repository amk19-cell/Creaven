import { createFirestoreDoc } from "./_firestore.js";

// POST /api/create-appointment
// body: { email, name, startTimeISO, practitionerName?, lang? }
// → crée le document dans Firestore ("appointments"), génère un code de
//   session à 6 caractères, retourne { docId, sessionCode } pour que le
//   client appelle ensuite /api/send-booking-email avec ces infos.
//
// NOTE: ceci ne gère PAS le paiement. Si la consultation est payante,
// utilise /api/create-order en parallèle et ne marque le rendez-vous comme
// définitivement confirmé qu'après le webhook Paystack (adapte le champ
// "status" ci-dessous selon ton flux réel : "pending_payment" vs "confirmed").

function generateSessionCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // évite les caractères ambigus (0/O, 1/I)
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { email, name, startTimeISO, practitionerName, lang } = body;

    if (!email || !startTimeISO) {
      return new Response(
        JSON.stringify({ error: "Champs requis manquants (email, startTimeISO)." }),
        { status: 400 }
      );
    }

    const startTime = new Date(startTimeISO);
    if (isNaN(startTime.getTime())) {
      return new Response(JSON.stringify({ error: "startTimeISO invalide." }), { status: 400 });
    }

    const sessionCode = generateSessionCode();

    const { docId } = await createFirestoreDoc(env, "appointments", {
      email,
      name: name || "",
      practitionerName: practitionerName || "",
      lang: lang || "en",
      sessionCode,
      startTime,
      status: "confirmed", // adapte à "pending_payment" si la consultation est payante
      reminderSent: false,
      createdAt: new Date(),
    });

    return new Response(JSON.stringify({ success: true, docId, sessionCode }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
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
