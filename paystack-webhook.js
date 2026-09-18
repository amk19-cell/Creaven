import { bookingConfirmedEmail, adminBookingNotifyEmail } from "./_email-templates.js";
import { sendEmail } from "./_resend.js";
import { updateFirestoreDoc, getFirestoreDoc } from "./_firestore.js";

// POST /api/paystack-webhook
// Configuré dans le dashboard Paystack (Settings → API Keys & Webhooks) :
//   https://creaven.pages.dev/api/paystack-webhook
//
// C'EST CET ENDPOINT, ET LUI SEUL, QUI CONFIRME UN PAIEMENT.
// Le client (booking.html) ne doit JAMAIS marquer une réservation comme
// payée lui-même — il crée la réservation en "pending_payment" via
// /api/create-booking AVANT le paiement, et attend que ce webhook la passe
// à "confirmed" après vérification cryptographique de la signature Paystack.
//
// Variables d'environnement requises (secrets Cloudflare) :
//   PAYSTACK_SECRET_KEY, RESEND_API_KEY, FIREBASE_SERVICE_ACCOUNT

const ADMIN_EMAIL = "creavenconnect@gmail.com";

async function verifyPaystackSignature(request, secretKey) {
  const signature = request.headers.get("x-paystack-signature");
  if (!signature) return null;

  const rawBody = await request.clone().text();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const computedHex = [...new Uint8Array(sigBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return { valid: computedHex === signature, rawBody };
}

function extractValue(field) {
  if (!field) return undefined;
  const key = Object.keys(field)[0];
  return field[key];
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.PAYSTACK_SECRET_KEY) {
      return new Response("PAYSTACK_SECRET_KEY manquant", { status: 500 });
    }

    const verification = await verifyPaystackSignature(request, env.PAYSTACK_SECRET_KEY);
    if (!verification || !verification.valid) {
      return new Response("Signature invalide", { status: 401 });
    }

    const event = JSON.parse(verification.rawBody);

    if (event.event !== "charge.success") {
      return new Response("ok", { status: 200 });
    }

    const data = event.data;
    const metadata = data.metadata || {};
    const bookingId = metadata.bookingId;
    const slotDocId = metadata.slotDocId;

    if (!bookingId) {
      console.error("paystack-webhook: bookingId manquant dans metadata, événement ignoré.");
      return new Response("ok (bookingId manquant)", { status: 200 });
    }

    // Récupère la réservation pour avoir toutes les infos nécessaires aux emails.
    const bookingDoc = await getFirestoreDoc(env, "bookings", bookingId);
    if (!bookingDoc) {
      console.error(`paystack-webhook: réservation ${bookingId} introuvable.`);
      return new Response("ok (booking introuvable)", { status: 200 });
    }
    const f = bookingDoc.fields || {};
    const clientName = extractValue(f.clientName);
    const clientEmail = extractValue(f.clientEmail);
    const practitionerName = extractValue(f.practitionerName);
    const consultationType = extractValue(f.consultationType);
    const date = extractValue(f.date);
    const time = extractValue(f.time);
    const sessionCode = extractValue(f.sessionCode);
    const sessionLink = extractValue(f.sessionLink);
    const lang = extractValue(f.sessionLang) === "Francais" ? "fr" : "en";

    // 1. Confirme la réservation — SEULE cette route a le droit d'écrire ce statut.
    await updateFirestoreDoc(env, "bookings", bookingId, {
      status: "confirmed",
      paymentStatus: "paid",
      paystackReference: data.reference,
      paidAt: new Date(),
    });

    // 2. Marque le créneau comme réservé (déplacé ici, plus côté client).
    if (slotDocId) {
      try {
        await updateFirestoreDoc(env, "availability", slotDocId, {
          status: "booked",
          clientName: clientName || "",
          clientEmail: clientEmail || "",
          sessionCode: sessionCode || "",
        });
      } catch (err) {
        console.error("paystack-webhook: échec mise à jour du créneau:", err.message);
      }
    }

    // 3. Emails — client + notification interne.
    const payNote = `Payment confirmed via Paystack. Ref: ${data.reference}`;
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
    const { subject: adminSubject, html: adminHtml } = adminBookingNotifyEmail({
      clientName,
      clientEmail,
      typeName: consultationType,
      dateLabel: date,
      timeLabel: time,
      practitionerName,
      sessionCode,
      payNote,
    });
    await sendEmail(env, { to: ADMIN_EMAIL, subject: adminSubject, html: adminHtml });

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("paystack-webhook error:", err.message);
    return new Response("error logged", { status: 200 });
  }
}
