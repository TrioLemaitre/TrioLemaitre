const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const LIMITS = {
  name: 160,
  email: 254,
  date: 40,
  location: 200,
  message: 5000
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/api/contact") {
      return jsonResponse({ success: false, message: "Nicht gefunden." }, 404);
    }

    if (request.method !== "POST") {
      return jsonResponse({ success: false, message: "Methode nicht erlaubt." }, 405, {
        Allow: "POST"
      });
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 20_000) {
      return jsonResponse({ success: false, message: "Anfrage zu groß." }, 413);
    }

    let input;
    try {
      input = await readInput(request);
    } catch {
      return jsonResponse({ success: false, message: "Ungültige Anfrage." }, 400);
    }

    if (clean(input.website, 200)) {
      return jsonResponse({ success: true });
    }

    const data = {
      name: clean(input.name, LIMITS.name),
      email: clean(input.email, LIMITS.email),
      date: clean(input.date, LIMITS.date),
      location: clean(input.location, LIMITS.location),
      message: clean(input.message, LIMITS.message),
      privacyAcknowledged: input.privacy_notice_acknowledged === "Ja"
    };

    if (!data.name || !isValidEmail(data.email) || !data.location || !data.message || !data.privacyAcknowledged) {
      return jsonResponse({ success: false, message: "Bitte alle Pflichtfelder korrekt ausfüllen." }, 400);
    }

    const text = [
      "Neue Kontakt-Anfrage über trio-lemaitre.de",
      "",
      `Name / Veranstalter: ${data.name}`,
      `E-Mail: ${data.email}`,
      `Datum: ${data.date || "Nicht angegeben"}`,
      `Ort / Stadt: ${data.location}`,
      "Datenschutzerklärung zur Kenntnis genommen: Ja",
      "",
      "Nachricht:",
      data.message
    ].join("\n");

    if (!env.CONTACT_DESTINATION) {
      return jsonResponse({ success: false, message: "Der E-Mail-Versand ist noch nicht konfiguriert." }, 503);
    }

    try {
      await env.CONTACT_EMAIL.send({
        to: env.CONTACT_DESTINATION,
        from: "kontakt@trio-lemaitre.de",
        replyTo: data.email,
        subject: "Neue Kontakt-Anfrage – Trio Lemaître",
        text
      });
    } catch {
      return jsonResponse({ success: false, message: "Die Nachricht konnte nicht versendet werden." }, 502);
    }

    return jsonResponse({ success: true });
  }
};

async function readInput(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    return Object.fromEntries(await request.formData());
  }

  throw new Error("Unsupported content type");
}

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function isValidEmail(value) {
  return value.length <= LIMITS.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}
