// Fonction serveur `public-api` : seule porte d'entrée du parcours particulier.
// Écrite sans dépendance à Deno pour être testée sous Node avec une vraie base.
//
// Protections : liste blanche d'origines (CSRF), JSON obligatoire, taille
// limitée, validation serveur, captcha, limites de débit (en base), codes et
// numéros hachés avec un poivre secret.

import type { CaptchaVerifier, EmailSender, SmsSender } from "./providers.ts";
import { hmacHex, randomOtp } from "./crypto.ts";
import {
  maskPhone, normalizeBelgianMobile, validateCode, validateSubmission, validateTrack, validateUuid,
} from "./validation.ts";
import { BUDGETS, DELAYS, PROJECT_TYPES, TRADES } from "./trades.ts";

export type Rpc = (fn: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;

export type Deps = {
  rpc: Rpc;
  sendSms: SmsSender;
  notifyAdmin: EmailSender;
  verifyCaptcha: CaptchaVerifier;
  pepper: string;
  allowedOrigins: string[];
  log?: (msg: string, extra?: unknown) => void;
};

const MAX_BODY = 8 * 1024;

// Codes d'erreur métier → statut HTTP (le navigateur traduit le code en message)
const STATUS: Record<string, number> = {
  invalid_input: 400, captcha: 400, consent_outdated: 409, duplicate: 409,
  rate_limited: 429, too_soon: 429, invalid_code: 400, expired: 410, locked: 423,
  not_found: 404, sms_failed: 502,
};

export function createHandler(deps: Deps) {
  const log = deps.log ?? (() => {});

  function headers(origin: string | null): Headers {
    const h = new Headers({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      vary: "Origin",
    });
    if (origin && deps.allowedOrigins.includes(origin)) {
      h.set("access-control-allow-origin", origin);
      h.set("access-control-allow-methods", "POST, OPTIONS");
      h.set("access-control-allow-headers", "content-type, authorization, apikey, x-client-info");
      h.set("access-control-max-age", "600");
    }
    return h;
  }

  const reply = (origin: string | null, body: unknown, status = 200) =>
    new Response(status === 204 ? null : JSON.stringify(body), { status, headers: headers(origin) });

  const fail = (origin: string | null, error: string, extra: Record<string, unknown> = {}) =>
    reply(origin, { ok: false, error, ...extra }, STATUS[error] ?? 400);

  const clientIp = (req: Request) =>
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ?? "";

  const hash = (kind: string, v: string) => hmacHex(deps.pepper, `${kind}:${v}`);

  const smsText = (code: string) =>
    `RénoDevis : votre code de confirmation est ${code}. Il expire dans 10 minutes. Ne le communiquez à personne.`;

  return async function handle(req: Request): Promise<Response> {
    const origin = req.headers.get("origin");
    const allowed = origin !== null && deps.allowedOrigins.includes(origin);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: allowed ? 204 : 403, headers: headers(origin) });
    }
    if (req.method !== "POST") return reply(origin, { ok: false, error: "method" }, 405);
    // Protection CSRF : seules nos pages peuvent appeler l'API
    if (!allowed) return reply(origin, { ok: false, error: "origin" }, 403);
    if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
      return reply(origin, { ok: false, error: "content_type" }, 415);
    }

    const raw = await req.text();
    if (raw.length > MAX_BODY) return reply(origin, { ok: false, error: "too_large" }, 413);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    } catch {
      return fail(origin, "invalid_input");
    }

    const route = new URL(req.url).pathname.split("/").filter(Boolean).pop();
    const ip = clientIp(req);
    const ip_hash = ip ? await hash("ip", ip) : null;

    try {
      switch (route) {
        case "submit": {
          const v = validateSubmission(body);
          if (!v.ok) return fail(origin, "invalid_input", { fields: v.errors });
          if (!(await deps.verifyCaptcha(v.value.captcha_token, ip))) return fail(origin, "captcha");

          const code = randomOtp();
          const { captcha_token: _t, ...data } = v.value;
          const res = await deps.rpc("rd_api_submit", {
            ...data,
            phone_hash: await hash("phone", data.phone_e164),
            code_hash: await hash("otp", code),
            ip_hash,
          });
          if (!res.ok) return fail(origin, String(res.error));
          if (!(await deps.sendSms(data.phone_e164, smsText(code)))) {
            log("sms_failed", { request_id: res.request_id });
            return fail(origin, "sms_failed");
          }
          return reply(origin, { ok: true, request_id: res.request_id, phone: maskPhone(data.phone_e164) });
        }

        case "resend": {
          const request_id = validateUuid(body.request_id);
          if (!request_id) return fail(origin, "not_found");
          const code = randomOtp();
          const res = await deps.rpc("rd_api_resend", { request_id, code_hash: await hash("otp", code), ip_hash });
          if (!res.ok) return fail(origin, String(res.error));
          if (!(await deps.sendSms(String(res.phone_e164), smsText(code)))) return fail(origin, "sms_failed");
          return reply(origin, { ok: true });
        }

        case "verify": {
          const request_id = validateUuid(body.request_id);
          const code = validateCode(body.code);
          if (!request_id || !code) return fail(origin, "invalid_code");
          const res = await deps.rpc("rd_api_verify", { request_id, code_hash: await hash("otp", code), ip_hash });
          if (!res.ok) return fail(origin, String(res.error), res.remaining !== undefined ? { remaining: res.remaining } : {});
          if (!res.already) {
            const ok = await deps
              .notifyAdmin(`Nouvelle demande validée ${res.ref}`, adminEmail(res))
              .catch(() => false);
            if (!ok) log("admin_email_failed", { ref: res.ref });
          }
          return reply(origin, { ok: true, ref: res.ref });
        }

        case "track": {
          const t = validateTrack(body);
          if (t) await deps.rpc("rd_api_track", { ...t, ip_hash });
          return reply(origin, null, 204);
        }

        case "erase-start": {
          const phone = normalizeBelgianMobile(body.phone);
          if (!phone) return fail(origin, "invalid_input", { fields: { phone: "Numéro de GSM belge." } });
          if (!(await deps.verifyCaptcha(String(body.captcha_token ?? ""), ip))) return fail(origin, "captcha");
          const code = randomOtp();
          const res = await deps.rpc("rd_api_erase_start", {
            phone_hash: await hash("phone", phone), code_hash: await hash("otp", code), ip_hash,
          });
          if (res.ok && res.send) await deps.sendSms(phone, smsText(code));
          // Même réponse que le numéro soit connu ou non (pas d'énumération)
          return reply(origin, { ok: true });
        }

        case "erase-confirm": {
          const phone = normalizeBelgianMobile(body.phone);
          const code = validateCode(body.code);
          if (!phone || !code) return fail(origin, "invalid_code");
          const res = await deps.rpc("rd_api_erase_confirm", {
            phone_hash: await hash("phone", phone), code_hash: await hash("otp", code), ip_hash,
          });
          if (!res.ok) return fail(origin, String(res.error), res.remaining !== undefined ? { remaining: res.remaining } : {});
          return reply(origin, { ok: true, erased: res.erased });
        }

        default:
          return reply(origin, { ok: false, error: "not_found" }, 404);
      }
    } catch (e) {
      log("internal_error", { route, message: e instanceof Error ? e.message : String(e) });
      return reply(origin, { ok: false, error: "internal" }, 500);
    }
  };
}

const label = (opts: { value: string; label: string }[], v: unknown) =>
  opts.find((o) => o.value === v)?.label ?? String(v);

/** E-mail admin : résumé ANONYME (aucune coordonnée du particulier). */
export function adminEmail(res: Record<string, unknown>): string {
  const s = (res.summary ?? {}) as Record<string, unknown>;
  const trade = TRADES[String(s.trade)];
  const detail = (s.detail ?? {}) as Record<string, string>;
  const utm = (s.utm ?? {}) as Record<string, string>;
  return [
    `Demande ${res.ref} confirmée par SMS.`,
    "",
    `Métier : ${trade?.label ?? s.trade}`,
    `Projet : ${label(PROJECT_TYPES, s.project_type)}`,
    trade ? `${trade.detail.legend} ${label(trade.detail.options, detail[trade.detail.key])}` : "",
    `Budget : ${label(BUDGETS, s.budget)}`,
    `Délai : ${label(DELAYS, s.delay)}`,
    `Localisation : ${s.postal_code} ${s.commune}`,
    `Entreprises attribuées : ${res.assigned}`,
    `Source : ${utm.utm_source ?? "(directe)"} / ${utm.utm_campaign ?? "-"}`,
  ].filter((l) => l !== "").join("\n");
}
