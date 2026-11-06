const fetch = require("node-fetch");
const FormData = require("form-data");
const config = require("../config");

/**
 * Analizza un buffer immagine/frame con SightEngine (nudity + gore).
 * Se le API key non sono configurate, funziona in modalità "placeholder":
 * non blocca nulla ma logga un avviso, così il bot parte comunque out-of-the-box.
 *
 * Ritorna: { flagged: boolean, reason: string|null }
 */
async function checkMediaBuffer(buffer) {
  const { sightengineUser, sightengineSecret, threshold, enabled } = config.nsfw;

  if (!enabled) return { flagged: false, reason: null };

  if (!sightengineUser || !sightengineSecret) {
    console.log(
      "[anti-nsfw] SIGHTENGINE_USER/SIGHTENGINE_SECRET non configurati: controllo saltato (modalità placeholder). Vedi README."
    );
    return { flagged: false, reason: null };
  }

  try {
    const form = new FormData();
    form.append("media", buffer, { filename: "media.jpg" });
    form.append("models", "nudity-2.1,gore");
    form.append("api_user", sightengineUser);
    form.append("api_secret", sightengineSecret);

    const res = await fetch("https://api.sightengine.com/1.0/check.json", {
      method: "POST",
      body: form,
    });
    const data = await res.json();

    if (data.status !== "success") {
      console.log("[anti-nsfw] Risposta API non valida:", data);
      return { flagged: false, reason: null };
    }

    const nudityScore = Math.max(
      data?.nudity?.sexual_activity || 0,
      data?.nudity?.sexual_display || 0,
      data?.nudity?.erotica || 0
    );
    const goreScore = data?.gore?.prob || 0;

    if (nudityScore >= threshold) return { flagged: true, reason: "contenuto NSFW" };
    if (goreScore >= threshold) return { flagged: true, reason: "contenuto gore" };

    return { flagged: false, reason: null };
  } catch (err) {
    console.log("[anti-nsfw] Errore durante il controllo:", err.message);
    return { flagged: false, reason: null };
  }
}

module.exports = { checkMediaBuffer };
