// Petit wrapper autour de l'API Resend.
// RESEND_API_KEY doit être configurée comme variable d'environnement SECRÈTE
// dans Cloudflare Pages → Settings → Environment variables (pas en clair dans le code).

const FROM_ADDRESS = "Creaven <notifications@creaven.pages.dev>"; // à remplacer par un domaine vérifié dans Resend si possible

export async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY manquante dans les variables d'environnement Cloudflare.");
  }
  if (!to || !subject || !html) {
    throw new Error("Paramètres manquants pour l'envoi d'email (to, subject, html requis).");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error (${res.status}): ${errText}`);
  }

  return res.json();
}
