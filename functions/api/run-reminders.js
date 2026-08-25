import { appointmentReminderEmail } from "./_email-templates.js";
import { sendEmail } from "./_resend.js";
import { runFirestoreQuery, updateFirestoreDoc } from "./_firestore.js";

// GET /api/run-reminders?token=XXXX
//
// Pensé pour être appelé par un service de cron externe et gratuit comme
// cron-job.org (utile si tu n'as pas d'ordinateur/terminal pour déployer un
// Worker séparé avec Wrangler). Aucune installation nécessaire — cette route
// se déploie automatiquement avec le reste de functions/api/ quand tu
// uploades sur GitHub / Cloudflare Pages.
//
// Configuration sur cron-job.org (gratuit, compte en 2 min) :
//   1. Crée un compte sur https://cron-job.org
//   2. "Create cronjob"
//   3. URL : https://creaven.pages.dev/api/run-reminders?token=TON_TOKEN_SECRET
//   4. Intervalle : toutes les 15 minutes
//   5. Sauvegarde — c'est tout, ça tourne tout seul.
//
// Variable d'environnement supplémentaire requise (secret Cloudflare) :
//   REMINDERS_CRON_TOKEN → choisis une chaîne aléatoire longue toi-même
//   (ex: génère-en une sur https://www.uuidgenerator.net/) et mets EXACTEMENT
//   la même valeur dans l'URL cron-job.org ci-dessus. Ça empêche n'importe
//   qui d'appeler cette route et de spammer des emails.

const REMINDER_MINUTES_BEFORE = 60;

function extractValue(field) {
  if (!field) return undefined;
  const key = Object.keys(field)[0];
  return field[key];
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!env.REMINDERS_CRON_TOKEN || token !== env.REMINDERS_CRON_TOKEN) {
    return new Response("Non autorisé.", { status: 401 });
  }

  try {
    const sentCount = await processReminders(env);
    return new Response(JSON.stringify({ success: true, remindersSent: sentCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("run-reminders error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

async function processReminders(env) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_MINUTES_BEFORE * 60000);

  const structuredQuery = {
    from: [{ collectionId: "appointments" }],
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: "startTime" },
              op: "GREATER_THAN_OR_EQUAL",
              value: { timestampValue: now.toISOString() },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "startTime" },
              op: "LESS_THAN_OR_EQUAL",
              value: { timestampValue: windowEnd.toISOString() },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "reminderSent" },
              op: "EQUAL",
              value: { booleanValue: false },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "status" },
              op: "EQUAL",
              value: { stringValue: "confirmed" },
            },
          },
        ],
      },
    },
  };

  const results = await runFirestoreQuery(env, structuredQuery);
  const docs = (results || []).filter((r) => r.document);
  let sentCount = 0;

  for (const item of docs) {
    const doc = item.document;
    const docId = doc.name.split("/").pop();
    const f = doc.fields || {};

    const email = extractValue(f.email);
    const name = extractValue(f.name);
    const sessionCode = extractValue(f.sessionCode);
    const lang = extractValue(f.lang) || "en";
    const startTime = extractValue(f.startTime);

    if (!email || !sessionCode || !startTime) {
      console.error(`Document ${docId} incomplet, rappel ignoré.`);
      continue;
    }

    const dateTimeLabel = new Date(startTime).toLocaleString(lang === "fr" ? "fr-FR" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    try {
      const { subject, html } = appointmentReminderEmail({
        name,
        dateTimeLabel,
        sessionCode,
        minutesBefore: REMINDER_MINUTES_BEFORE,
        lang,
      });
      await sendEmail(env, { to: email, subject, html });
      await updateFirestoreDoc(env, "appointments", docId, { reminderSent: true });
      sentCount++;
    } catch (err) {
      console.error(`Échec d'envoi du rappel pour ${docId}:`, err.message);
    }
  }

  return sentCount;
}
