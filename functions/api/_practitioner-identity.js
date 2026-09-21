import { runFirestoreQuery } from "./_firestore.js";

// Les documents Practitioners sont identifiés par un nom lisible ("Dani",
// "Audrey"), PAS par l'UID Firebase Auth du praticien. Pour que
// practitioner-bookings.js / practitioner-availability.js / les endpoints
// Emergency sachent "qui est connecté", chaque document Practitioners doit
// avoir un champ authUid contenant le vrai UID Firebase Auth du praticien
// (à ajouter une fois, manuellement, dans Firestore Console — voir
// practitioner.html qui affiche cet UID pour faciliter la copie).
//
// Retourne l'ID du document Practitioners (ex: "Dani") correspondant à cet
// authUid, ou null si aucun praticien approuvé n'y correspond.
export async function resolvePractitionerId(env, authUid) {
  if (!authUid) return null;

  const structuredQuery = {
    from: [{ collectionId: "Practitioners" }],
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: "authUid" },
              op: "EQUAL",
              value: { stringValue: authUid },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "status" },
              op: "EQUAL",
              value: { stringValue: "approved" },
            },
          },
        ],
      },
    },
  };

  const results = await runFirestoreQuery(env, structuredQuery);
  const doc = (results || []).find((r) => r.document)?.document;
  if (!doc) return null;

  return doc.name.split("/").pop();
}
