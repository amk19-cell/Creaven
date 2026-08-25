import { paymentConfirmedEmail } from "./_email-templates.js";
import { sendEmail } from "./_resend.js";
import { updateFirestoreDoc, getFirestoreDoc } from "./_firestore.js";

// POST /api/paystack-webhook
// À configurer dans le dashboard Paystack : Settings → API Keys & Webhooks
// → Webhook URL = https://creaven.pages.dev/api/paystack-webhook
//
// Variables d'environnement requises (secrets Cloudflare) :
//   PAYSTACK_SECRET_KEY        (pour vérifier la signature)
//   RESEND_API_KEY
//   FIREBASE_SERVICE_ACCOUNT
//
// IMPORTANT : c'est CE endpoint, et uniquement lui, qui doit confirmer un
// paiement. Ne jamais faire confiance à un appel venant directement du
// navigateur du client pour marquer une commande comme payée.

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
      // On accuse réception de tout autre événement sans traitement.
      return new Response("ok", { status: 200 });
    }

    const data = event.data;
    const reference = data.reference;
    const customerEmail = data.customer?.email;
    const amountLabel = `${(data.amount / 100).toFixed(2)} ${data.currency}`;
    const metadata = data.metadata || {};
    const itemLabel = metadata.itemLabel || "Creaven";
    const orderId = metadata.orderId || reference;
    const lang = metadata.lang || "en";
    const name = metadata.name || "";

    // 1. Marquer la commande comme payée dans Firestore.
    //    Suppose une collection "orders" avec un document par commande,
    //    créé au moment de l'initialisation du paiement côté client.
    await updateFirestoreDoc(env, "orders", orderId, {
      status: "paid",
      paystackReference: reference,
      paidAt: new Date(),
    });

    // 2. Envoyer l'email de confirmation.
    if (customerEmail) {
      const { subject, html } = paymentConfirmedEmail({ name, amountLabel, itemLabel, lang });
      await sendEmail(env, { to: customerEmail, subject, html });
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    // On log l'erreur côté Cloudflare mais on répond 200 pour éviter que
    // Paystack ne renvoie le même événement en boucle si le problème vient
    // de notre côté (ex: Firestore down) — à ajuster selon ta tolérance.
    console.error("paystack-webhook error:", err.message);
    return new Response("error logged", { status: 200 });
  }
}
