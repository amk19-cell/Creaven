import { updateFirestoreDoc, getFirestoreDoc } from "./_firestore.js";
import { bookingConfirmedEmail } from "./_email-templates.js";
import { sendEmail } from "./_resend.js";

// POST /api/admin-confirm-booking
// body: { token, bookingId }
//
// À utiliser UNIQUEMENT après que Dani a vérifié elle-même la réception
// réelle du paiement Wave/MTN/PayPal (relevé bancaire, notification PayPal,
// etc.) — cet endpoint ne vérifie aucun paiement lui-même, contrairement au
// webhook Paystack. Il se contente de faire confiance à l'admin humaine.

function extractValue(field) {
  if (!field) return undefined;
  const key = Object.keys(field)[0];
  return field[key];
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { token, bookingId } = body;

    if (!env.ADMIN_DASHBOARD_TOKEN || token !== env.ADMIN_DASHBOARD_TOKEN) {
      return new Response(JSON.stringify({ error: "Non autorisé." }), { status: 401 });
    }
    if (!bookingId) {
      return new Response(JSON.stringify({ error: "bookingId manquant." }), { status: 400 });
    }

    const bookingDoc = await getFirestoreDoc(env, "bookings", bookingId);
    if (!bookingDoc) {
      return new Response(JSON.stringify({ error: "Réservation introuvable." }), { status: 404 });
    }
    const f = bookingDoc.fields || {};
    const clientName = extractValue(f.clientName);
    const clientEmail = extractValue(f.clientEmail);
    const practitionerName = extractValue(f.practitionerName);
    const date = extractValue(f.date);
    const time = extractValue(f.time);
    const sessionCode = extractValue(f.sessionCode);
    const lang = extractValue(f.sessionLang) === "Francais" ? "fr" : "en";

    await updateFirestoreDoc(env, "bookings", bookingId, {
      status: "confirmed",
      paymentStatus: "paid",
      confirmedByAdminAt: new Date(),
    });

    if (clientEmail) {
      const { subject, html } = bookingConfirmedEmail({
        name: clientName,
        dateTimeLabel: `${date} ${time}`,
        sessionCode,
        practitionerName,
        lang,
      });
      await sendEmail(env, { to: clientEmail, subject, html });
    }

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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

