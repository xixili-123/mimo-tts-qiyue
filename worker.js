const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

function getBearer(request) {
  const h = request.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

function decodeBase64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "MiMo TTS Cloudflare Worker",
        model: env.MIMO_MODEL || "mimo-v2.5-tts",
      });
    }

    if (request.method !== "POST" || url.pathname !== "/tts") {
      return json({
        ok: true,
        message: "MiMo TTS proxy is running.",
        endpoints: {
          health: "GET /health",
          tts: "POST /tts",
        },
      });
    }

    if (!env.MIMO_API_KEY) {
      return json({ ok: false, error: "Cloudflare Secret MIMO_API_KEY is not configured." }, 500);
    }

    try {
      const body = await request.json();

      const text = String(body.text ?? body.content ?? "").trim();
      if (!text) return json({ ok: false, error: "text is required" }, 400);
      if (text.length > 12000) {
        return json({ ok: false, error: "text is too long; maximum 12000 characters" }, 400);
      }

      // Optional protection: if TTS_CLIENT_TOKEN is configured, callers must send
      // Authorization: Bearer <token>. Leave it unset if you do not need it.
      if (env.TTS_CLIENT_TOKEN) {
        const supplied = getBearer(request) || String(body.token || "");
        if (supplied !== env.TTS_CLIENT_TOKEN) {
          return json({ ok: false, error: "Unauthorized" }, 401);
        }
      }

      const voice = String(body.voice || env.MIMO_VOICE || "冰糖");
      const style = String(
        body.style ||
        "自然、清晰、连贯的中文有声小说朗读。语速适中，吐字清楚，人物对白有轻微情绪变化，不要播报腔。"
      );

      const payload = {
        model: env.MIMO_MODEL || "mimo-v2.5-tts",
        messages: [
          { role: "user", content: style },
          { role: "assistant", content: text },
        ],
        audio: {
          format: "wav",
          voice,
        },
      };

      const upstream = await fetch("https://api.xiaomimimo.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "api-key": env.MIMO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const raw = await upstream.text();

      if (!upstream.ok) {
        return new Response(raw, {
          status: upstream.status,
          headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
        });
      }

      let result;
      try {
        result = JSON.parse(raw);
      } catch {
        return json({ ok: false, error: "MiMo returned invalid JSON", raw: raw.slice(0, 2000) }, 502);
      }

      const b64 = result?.choices?.[0]?.message?.audio?.data;
      if (!b64) {
        return json({
          ok: false,
          error: "MiMo response did not contain audio data",
          response: result,
        }, 502);
      }

      return new Response(decodeBase64ToBytes(b64), {
        status: 200,
        headers: {
          ...CORS,
          "Content-Type": "audio/wav",
          "Content-Disposition": 'inline; filename="mimo-tts.wav"',
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      return json({
        ok: false,
        error: String(err?.message || err),
      }, 500);
    }
  },
};
