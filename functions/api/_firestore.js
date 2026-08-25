// Client Firestore REST minimal pour Cloudflare Pages Functions.
// Utilise un compte de service Google (JSON) stocké comme secret Cloudflare
// pour générer un JWT signé (RS256) via Web Crypto, échangé contre un access
// token OAuth2, puis utilisé pour appeler l'API REST Firestore.
//
// Variable d'environnement requise (secret, JSON complet en une ligne) :
//   FIREBASE_SERVICE_ACCOUNT
// → Générée depuis Firebase Console → Paramètres du projet → Comptes de
//   service → "Générer une nouvelle clé privée".

function base64url(input) {
  let str;
  if (typeof input === "string") {
    str = btoa(unescape(encodeURIComponent(input)));
  } else {
    // ArrayBuffer -> base64
    const bytes = new Uint8Array(input);
    let bin = "";
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    str = btoa(bin);
  }
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT manquant dans les variables d'environnement.");
  }
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );

  const jwt = `${unsigned}.${base64url(signature)}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Échec d'obtention du token OAuth2: ${await tokenRes.text()}`);
  }
  const { access_token, project_id } = await tokenRes.json().then(async (d) => ({
    ...d,
    project_id: sa.project_id,
  }));
  return { accessToken: access_token, projectId: sa.project_id };
}

// Convertit un objet JS simple en champs Firestore REST
function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") fields[k] = { stringValue: v };
    else if (typeof v === "number") fields[k] = { doubleValue: v };
    else if (typeof v === "boolean") fields[k] = { booleanValue: v };
    else if (v === null) fields[k] = { nullValue: null };
    else if (v instanceof Date) fields[k] = { timestampValue: v.toISOString() };
    else fields[k] = { stringValue: String(v) };
  }
  return fields;
}

// Crée un nouveau document Firestore avec un ID auto-généré.
// Retourne l'ID généré.
export async function createFirestoreDoc(env, collection, data) {
  const { accessToken, projectId } = await getAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });

  if (!res.ok) {
    throw new Error(`Firestore create failed (${res.status}): ${await res.text()}`);
  }
  const result = await res.json();
  const docId = result.name.split("/").pop();
  return { docId, raw: result };
}

// PATCH (merge) un document Firestore, ex: collection="orders", docId="abc123"
export async function updateFirestoreDoc(env, collection, docId, data) {
  const { accessToken, projectId } = await getAccessToken(env);
  const fieldPaths = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}?${fieldPaths}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });

  if (!res.ok) {
    throw new Error(`Firestore update failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

// GET un document Firestore
export async function getFirestoreDoc(env, collection, docId) {
  const { accessToken, projectId } = await getAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore get failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// Requête simple (runQuery) — utilisée par le Worker de rappels pour lister
// les rendez-vous à venir.
export async function runFirestoreQuery(env, structuredQuery) {
  const { accessToken, projectId } = await getAccessToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(`Firestore query failed (${res.status}): ${await res.text()}`);
  return res.json();
}
