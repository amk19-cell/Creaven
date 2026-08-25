// Templates d'emails partagés — Creaven
// Chaque fonction retourne { subject, html } prêt à envoyer via Resend.

const BRAND = {
  name: "Creaven",
  color: "#2A4A2A",
  gold: "#C8A84B",
  logoUrl: "https://creaven.pages.dev/logo-creaven.png",
  siteUrl: "https://creaven.pages.dev",
};

function wrapper(bodyHtml) {
  return `
  <div style="font-family: 'DM Sans', Arial, sans-serif; background:#FAFCFA; padding:32px 16px;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
      <div style="background:${BRAND.color};padding:24px 32px;">
        <span style="font-family:Georgia,serif;font-size:22px;color:#fff;font-weight:600;">${BRAND.name}</span>
      </div>
      <div style="padding:32px;color:#1A2A1A;line-height:1.6;">
        ${bodyHtml}
      </div>
      <div style="padding:20px 32px;background:#F0F5F0;font-size:11px;color:#8A9A8A;">
        © ${new Date().getFullYear()} ${BRAND.name}. Psychological well-being for the creative industry.
      </div>
    </div>
  </div>`;
}

// 1. Confirmation d'inscription
export function signupEmail({ name, lang = "en" }) {
  const subject =
    lang === "fr" ? "Bienvenue chez Creaven" : "Welcome to Creaven";
  const html = wrapper(`
    <h2 style="font-weight:600;">${lang === "fr" ? "Bienvenue" : "Welcome"}, ${name || ""}</h2>
    <p>${
      lang === "fr"
        ? "Votre compte Creaven a été créé avec succès. Vous pouvez dès maintenant accéder à vos évaluations psychologiques et réserver une consultation."
        : "Your Creaven account has been created successfully. You can now access psychological assessments and book a consultation."
    }</p>
    <a href="${BRAND.siteUrl}/account.html" style="display:inline-block;margin-top:16px;background:${BRAND.color};color:#fff;padding:12px 28px;border-radius:30px;text-decoration:none;font-size:14px;">
      ${lang === "fr" ? "Accéder à mon compte" : "Go to my account"}
    </a>
  `);
  return { subject, html };
}

// 2. Confirmation de prise de rendez-vous
export function bookingConfirmedEmail({ name, dateTimeLabel, sessionCode, practitionerName, lang = "en" }) {
  const subject =
    lang === "fr" ? "Confirmation de votre rendez-vous" : "Your appointment is confirmed";
  const html = wrapper(`
    <h2 style="font-weight:600;">${lang === "fr" ? "Rendez-vous confirmé" : "Appointment confirmed"}</h2>
    <p>${lang === "fr" ? "Bonjour" : "Hi"} ${name || ""},</p>
    <p>${
      lang === "fr"
        ? "Votre consultation a bien été enregistrée."
        : "Your consultation has been successfully booked."
    }</p>
    <table style="width:100%;margin:20px 0;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#8A9A8A;font-size:12px;">${lang === "fr" ? "Date" : "Date"}</td><td style="padding:6px 0;font-weight:500;">${dateTimeLabel || ""}</td></tr>
      ${practitionerName ? `<tr><td style="padding:6px 0;color:#8A9A8A;font-size:12px;">${lang === "fr" ? "Praticien" : "Practitioner"}</td><td style="padding:6px 0;font-weight:500;">${practitionerName}</td></tr>` : ""}
      <tr><td style="padding:6px 0;color:#8A9A8A;font-size:12px;">${lang === "fr" ? "Code de session" : "Session code"}</td><td style="padding:6px 0;font-weight:600;color:${BRAND.color};">${sessionCode || ""}</td></tr>
    </table>
    <p style="font-size:13px;color:#4A5A4A;">${
      lang === "fr"
        ? "Gardez ce code : il vous permettra de rejoindre votre session au moment du rendez-vous."
        : "Keep this code — you'll need it to join your session at the scheduled time."
    }</p>
  `);
  return { subject, html };
}

// 3. Confirmation de paiement
export function paymentConfirmedEmail({ name, amountLabel, itemLabel, receiptUrl, lang = "en" }) {
  const subject = lang === "fr" ? "Reçu de paiement Creaven" : "Creaven payment receipt";
  const html = wrapper(`
    <h2 style="font-weight:600;">${lang === "fr" ? "Paiement confirmé" : "Payment confirmed"}</h2>
    <p>${lang === "fr" ? "Bonjour" : "Hi"} ${name || ""},</p>
    <p>${
      lang === "fr"
        ? "Nous avons bien reçu votre paiement."
        : "We've successfully received your payment."
    }</p>
    <table style="width:100%;margin:20px 0;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#8A9A8A;font-size:12px;">${lang === "fr" ? "Article" : "Item"}</td><td style="padding:6px 0;font-weight:500;">${itemLabel || ""}</td></tr>
      <tr><td style="padding:6px 0;color:#8A9A8A;font-size:12px;">${lang === "fr" ? "Montant" : "Amount"}</td><td style="padding:6px 0;font-weight:600;color:${BRAND.color};">${amountLabel || ""}</td></tr>
    </table>
    ${receiptUrl ? `<a href="${receiptUrl}" style="display:inline-block;margin-top:8px;color:${BRAND.color};font-size:13px;">${lang === "fr" ? "Voir le reçu" : "View receipt"}</a>` : ""}
  `);
  return { subject, html };
}

// 4. Rappel de rendez-vous (utilisé par le Worker Cron séparé)
export function appointmentReminderEmail({ name, dateTimeLabel, sessionCode, minutesBefore, lang = "en" }) {
  const subject =
    lang === "fr"
      ? `Rappel : votre rendez-vous Creaven dans ${minutesBefore} min`
      : `Reminder: your Creaven appointment in ${minutesBefore} min`;
  const html = wrapper(`
    <h2 style="font-weight:600;">${lang === "fr" ? "Votre rendez-vous approche" : "Your appointment is coming up"}</h2>
    <p>${lang === "fr" ? "Bonjour" : "Hi"} ${name || ""},</p>
    <p>${
      lang === "fr"
        ? `Votre consultation est prévue à ${dateTimeLabel}.`
        : `Your consultation is scheduled for ${dateTimeLabel}.`
    }</p>
    <div style="margin:20px 0;padding:16px;background:#F0F5F0;border-radius:12px;text-align:center;">
      <div style="font-size:11px;color:#8A9A8A;">${lang === "fr" ? "Code de session" : "Session code"}</div>
      <div style="font-size:20px;font-weight:600;color:${BRAND.color};letter-spacing:1px;">${sessionCode || ""}</div>
    </div>
    <a href="${BRAND.siteUrl}/consultation.html?code=${encodeURIComponent(sessionCode || "")}" style="display:inline-block;background:${BRAND.color};color:#fff;padding:12px 28px;border-radius:30px;text-decoration:none;font-size:14px;">
      ${lang === "fr" ? "Rejoindre la session" : "Join session"}
    </a>
  `);
  return { subject, html };
}
