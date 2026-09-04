// Vérifie un ID token Firebase Auth envoyé par le client (Authorization: Bearer <token>).
// Utilisé par les endpoints "praticien" pour s'assurer que chaque praticien
// ne voit et ne modifie QUE ses propres données — contrairement au token
// admin partagé, ici chaque praticien a sa propre identité vérifiée.
//
// Fonctionne sans le SDK Firebase Admin (indisponible dans Cloudflare
// Workers) en vérifiant nous-mêmes la signature RS256 du JWT avec les
// certificats publics de Google, via Web Crypto.

const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

function base64urlToArrayBuffer(b64url) {
  const b64 = b64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), "=");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\s/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// Extrait la cle publique depuis un certificat X.509 PEM (format renvoye par
// l'endpoint de certificats Google) en important le certificat comme une cle
// SPKI n'est pas supporte directement par WebCrypto pour du X.509 complet ;
// on utilise donc l'import "x509" via une astuce : la plupart des runtimes
// modernes (dont Cloudflare Workers) supportent l'algorithme "RSASSA-PKCS1-v1_5"
// avec des cles importees depuis un certificat converti en SPKI. Cloudflare
// Workers expose crypto.subtle.importKey avec le format "spki" ; les certs
// Google sont au format X.509 dont le corps public key est extrayable tel quel
// dans la plupart des cas recents. On tente l'import direct.
async function importPublicKeyFromCert(pem) {
  const der = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    "spki",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

// Verifie un ID token Firebase et retourne son payload decode si valide,
// ou null si invalide/expire. projectId doit correspondre a ton projet
// Firebase (ex: "creaven-01").
export async function verifyFirebaseIdToken(idToken, projectId) {
  if (!idToken) return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  let header, payload;
  try {
    header = JSON.parse(
      new TextDecoder().decode(base64urlToArrayBuffer(headerB64))
    );
    payload = JSON.parse(
      new TextDecoder().decode(base64urlToArrayBuffer(payloadB64))
    );
  } catch {
    return null;
  }

  // Verifications de base sur les claims, avant meme de verifier la signature.
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) return null;
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)
    return null;
  if (payload.exp < now) return null;
  if (payload.iat > now + 60) return null;
  if (!payload.sub) return null;

  // Recupere le certificat correspondant au "kid" du header.
  const certsRes = await fetch(GOOGLE_CERTS_URL);
  if (!certsRes.ok) return null;
  const certs = await certsRes.json();
  const cert = certs[header.kid];
  if (!cert) return null;

  try {
    const publicKey = await importPublicKeyFromCert(cert);
    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64urlToArrayBuffer(sigB64);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      signature,
      signedData
    );
    if (!valid) return null;
  } catch (err) {
    console.error(
      "verifyFirebaseIdToken: erreur de verification:",
      err.message
    );
    return null;
  }

  return { uid: payload.sub, email: payload.email || null };
}

// Extrait et verifie le token depuis l'en-tete Authorization d'une requete.
export async function getVerifiedUser(request, projectId) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) return null;
  return verifyFirebaseIdToken(match[1], projectId);
}
