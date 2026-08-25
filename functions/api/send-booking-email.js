import { bookingConfirmedEmail } from "./_email-templates.js";
import { sendEmail } from "./_resend.js";

// POST /api/send-booking-email
// body: { to, name?, dateTimeLabel, sessionCode, practitionerName?, lang? }
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { to, name, dateTimeLabel, sessionCode, practitionerName, lang } = body;

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
