import { createFirestoreDoc } from "./_firestore.js";

// POST /api/create-order
// body: { email, name, itemLabel, amount (en unité principale, ex: 15.00), currency, lang? }
// → crée un document "orders" avec status "pending", retourne orderId.
//
// Le client utilise ensuite cet orderId comme metadata.orderId lors de
// l'initialisation du paiement Paystack (côté client, avec la clé PUBLIQUE
// Paystack — jamais la clé secrète). Exemple avec PaystackPop côté client :
//
//   const handler = PaystackPop.setup({
//     key: 'pk_xxx', // clé publique, ok de l'exposer
//     email: userEmail,
//     amount: amountInKobo, // Paystack attend le montant en sous-unité
//     currency: 'XOF',
//     metadata: { orderId, itemLabel, lang, name: userName },
//     callback: function(response) {
//       // Le paiement a été initié côté Paystack. La confirmation réelle et
//       // la mise à jour Firestore se font par le WEBHOOK, pas ici.
//     }
//   });
//   handler.openIframe();
//
// C'est le webhook (paystack-webhook.js) qui, en lisant metadata.orderId,
// mettra ce document à jour avec status: "paid".

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { email, name, itemLabel, amount, currency, lang } = body;

    if (!email || !itemLabel || !amount || !currency) {
      return new Response(
        JSON.stringify({ error: "Champs requis manquants (email, itemLabel, amount, currency)." }),
        { status: 400 }
      );
    }

    const { docId } = await createFirestoreDoc(env, "orders", {
      email,
      name: name || "",
      itemLabel,
      amount: Number(amount),
      currency,
      lang: lang || "en",
      status: "pending",
      createdAt: new Date(),
    });

    return new Response(JSON.stringify({ success: true, orderId: docId }), {
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
