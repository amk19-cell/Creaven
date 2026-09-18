import { paymentConfirmedEmail } from "./_email-templates.js";
import { sendEmail } from "./_resend.js";

// POST /api/send-payment-email
// body: { to, name?, amountLabel, itemLabel, receiptUrl?, lang? }
//
// NOTE: la mise à jour du document Firestore après paiement (marquer la
// commande comme payée, débloquer l'accès au test/à la consultation) doit se
// faire dans le webhook Paystack lui-même (endpoint séparé, ex:
// functions/api/paystack-webhook.js) qui vérifie la signature Paystack AVANT
// de déclencher cet envoi d'email. Ne jamais déclencher cet email directement
// depuis le client — un utilisateur pourrait l'appeler sans avoir payé.
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { to, name, amountLabel, itemLabel, receiptUrl, lang } = body;

    if (!to || !amountLabel || !itemLabel) {
      return new Response(
        JSON.stringify({ error: "Champs requis manquants (to, amountLabel, itemLabel)." }),
        { status: 400 }
      );
    }

    const { subject, html } = paymentConfirmedEmail({ name, amountLabel, itemLabel, receiptUrl, lang });
    const result = await sendEmail(env, { to, subject, html });

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
