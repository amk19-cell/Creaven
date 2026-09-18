// POST /api/tts-speak
// body: { text, voiceId }
// → retourne l'audio MP3 généré par ElevenLabs avec la voix clonée du
//   praticien. La clé ElevenLabs ne quitte jamais le serveur.
//
// Variable d'environnement requise (secret Cloudflare) : ELEVENLABS_API_KEY

export async function onRequestPost({ request, env }) {
  try {
    if (!env.ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY manquante." }), { status: 500 });
    }

    const body = await request.json();
    const { text, voiceId } = body;

    if (!text || !voiceId) {
      return new Response(JSON.stringify({ error: "Champs requis manquants (text, voiceId)." }), { status: 400 });
    }

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `ElevenLabs error (${res.status}): ${errText}` }), { status: 502 });
    }

    const audioBuffer = await res.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
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
