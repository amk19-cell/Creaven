import { createFirestoreDoc } from "./_firestore.js";

// POST /api/create-booking
// body: { uid, clientName, clientEmail, practitionerUid, practitionerName,
//         consultationType, date, time, duration, sessionLang, note,
//         currency, displayPrice, amountXofCharged, slotDocId }
// → crée le document dans "bookings" avec status "pending_payment", génère
//   le sessionCode côté serveur, le retourne pour servir de référence
//   Paystack. C'est CE document, une fois payé, que le webhook confirmera.

function generateSessionCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const {
      uid, clientName, clientEmail, practitionerUid, practitionerName,
      consultationType, date, time, duration, sessionLang, note,
      currency, displayPrice, amountXofCharged, slotDocId,
    } = body;

    if (!uid || !clientEmail || !practitionerUid || !date || !time) {
      return new Response(
        JSON.stringify({ error: "Champs requis manquants (uid, clientEmail, practitionerUid, date, time)." }),
        { status: 400 }
      );
    }

    const sessionCode = generateSessionCode();
    const sessionLink = `https://creaven.pages.dev/consultation.html?code=${sessionCode}`;

    const { docId } = await createFirestoreDoc(env, "bookings", {
      uid,
      clientName: clientName || "",
      clientEmail,
      practitionerUid,
      practitionerName: practitionerName || "",
      consultationType: consultationType || "",
      date: date || "",
      time: time || "",
      duration: Number(duration) || 60,
      sessionLang: sessionLang || "en",
      note: note || "",
      sessionCode,
      sessionLink,
      currency: currency || "",
      displayPrice: displayPrice || "",
      amountXofCharged: Number(amountXofCharged) || 0,
      slotDocId: slotDocId || "",
      paymentMethod: "paystack",
      paymentStatus: "pending",
      status: "pending_payment",
      createdAt: new Date(),
    });

    return new Response(JSON.stringify({ success: true, bookingId: docId, sessionCode, sessionLink }), {
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

