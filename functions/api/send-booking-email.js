import { bookingConfirmedEmail, adminBookingNotifyEmail } from "./_email-templates.js";
import { sendEmail } from "./_resend.js";

// POST /api/send-booking-email
// body: { to, name?, dateTimeLabel, sessionCode, practitionerName?, lang?,
//         typeName?, payNote?, notifyAdmin? }
//
// Utilisé pour les réservations payées manuellement (Wave/MTN) ou via
// PayPal.me — méthodes auto-déclarées côté client, pas de webhook de
// vérification serveur possible pour elles. Le paiement Paystack, lui,
// passe exclusivement par paystack-webhook.js, qui envoie ses propres
// emails et n'appelle jamais cette route.
const ADMIN_EMAIL = "creavenconnect@gmail.com";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { to, name, dateTimeLabel, sessionCode, practitionerName, lang, typeName, payNote, notifyAdmin } = body;

    if (!to || !dateTimeLabel || !sessionCode) {
      return new Response(
        JSON.stringify({ error: "Champs requis manquants (to, dateTimeLabel, sessionCode)." }),
        { status: 400 }
      );
    }

    const { subject, html } = bookingConfirmedEmail({
      name,
      dateTimeLabel,
      sessionCode,
      practitionerName,
      lang,
    });
    const result = await sendEmail(env, { to, subject, html });

    if (notifyAdmin) {
      const { subject: aSubject, html: aHtml } = adminBookingNotifyEmail({
        clientName: name,
        clientEmail: to,
        typeName: typeName || "",
        dateLabel: dateTimeLabel,
        timeLabel: "",
        practitionerName,
        sessionCode,
        payNote: payNote || "",
      });
      await sendEmail(env, { to: ADMIN_EMAIL, subject: aSubject, html: aHtml });
    }

    return new Response(JSON.stringify({ success: true, result }), {
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
