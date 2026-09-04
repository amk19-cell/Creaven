import { sendEmail } from "./_resend.js";

// POST /api/send-contact-message
// body: { name, email, reason, message, lang? }
const ADMIN_EMAIL = "creavenconnect@gmail.com";

function wrapper(bodyHtml) {
  return ` <div style="font-family:'DM Sans',Arial,sans-serif;background:#FAFCFA;padding:32px 16px;"> <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);"> <div style="background:#2A4A2A;padding:24px 32px;"> <span style="font-family:Georgia,serif;font-size:22px;color:#fff;font-weight:600;">Creaven</span> </div> <div style="padding:32px;color:#1A2A1A;line-height:1.6;"> ${bodyHtml} </div> </div> </div>`;
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { name, email, reason, message, lang } = body;

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({
          error: "Champs requis manquants (name, email, message).",
        }),
        { status: 400 }
      );
    }

    // 1. Notifie l'admin avec le contenu du message.
    const adminHtml = wrapper(` <h2 style="font-weight:600;">Nouveau message de contact</h2> <table style="width:100%;margin:16px 0;border-collapse:collapse;"> <tr><td style="padding:6px 0;color:#8A9A8A;font-size:12px;">De</td><td style="padding:6px 0;font-weight:500;">${name} (${email})</td></tr> <tr><td style="padding:6px 0;color:#8A9A8A;font-size:12px;">Sujet</td><td style="padding:6px 0;font-weight:500;">${ reason || "Non précisé" }</td></tr> </table> <p style="white-space:pre-wrap;background:#F0F5F0;padding:16px;border-radius:8px;">${message}</p> `);
    await sendEmail(env, {
      to: ADMIN_EMAIL,
      subject: `Nouveau message - ${reason || "Contact"}`,
      html: adminHtml,
    });

    // 2. Accusé de réception au visiteur.
    const isFr = lang === "fr";
    const clientHtml = wrapper(` <h2 style="font-weight:600;">${ isFr ? "Message bien reçu" : "Message received" }</h2> <p>${isFr ? `Bonjour ${name},` : `Hi ${name},`}</p> <p>${ isFr ? "Merci pour votre message. Nous vous répondrons dans les 48 heures à cette adresse." : "Thank you for your message. We will get back to you within 48 hours at this address." }</p> `);
    await sendEmail(env, {
      to: email,
      subject: isFr
        ? "Nous avons bien reçu votre message - Creaven"
        : "We received your message - Creaven",
      html: clientHtml,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
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
