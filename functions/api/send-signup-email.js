import { signupEmail } from "./_email-templates.js";
import { sendEmail } from "./_resend.js";

// POST /api/send-signup-email
// body: { to: string, name?: string, lang?: "en"|"fr" }
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { to, name, lang } = body;

    if (!to) {
      return new Response(JSON.stringify({ error: "Champ 'to' requis." }), { status: 400 });
    }

    const { subject, html } = signupEmail({ name, lang });
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
