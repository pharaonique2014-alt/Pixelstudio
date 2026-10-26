// Validation et normalisation CÔTÉ SERVEUR de tout ce qui vient du navigateur.
// Le navigateur valide aussi (confort), mais seul ce fichier fait foi.

import { BUDGETS, DELAYS, PROJECT_TYPES, TRADES, values } from "./trades.ts";
import { CONSENT_VERSION } from "./consent.ts";
import { provinceOf } from "./provinces.ts";

export type Submission = {
  trade: string;
  project_type: string;
  budget: string;
  delay: string;
  detail: Record<string, string>;
  postal_code: string;
  commune: string;
  first_name: string;
  phone_e164: string;
  email: string;
  consent_version: string;
  session_id: string | null;
  utm: Record<string, string>;
  captcha_token: string;
};

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_RE = /^[\p{L}][\p{L}\p{M}' ’\-]{0,59}$/u;
const COMMUNE_RE = /^[\p{L}][\p{L}\p{M}0-9' ’\-.()]{1,79}$/u; // 2 caractères minimum
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

const str = (v: unknown): string => (typeof v === "string" ? v.normalize("NFC").trim() : "");

/**
 * Numéro de GSM belge → format E.164 (+324xxxxxxxx), ou null.
 * Accepte 0470 12 34 56, 0470/12.34.56, +32 470 12 34 56, 0032470123456.
 * [À CONFIRMER] seuls les GSM belges (046x à 049x) sont acceptés pour le test.
 */
export function normalizeBelgianMobile(input: unknown): string | null {
  let s = str(input).replace(/[\s./()\-]/g, "");
  if (s.startsWith("0032")) s = "+32" + s.slice(4);
  else if (s.startsWith("32") && s.length === 11) s = "+" + s;
  else if (s.startsWith("0")) s = "+32" + s.slice(1);
  return /^\+324[6-9][0-9]{7}$/.test(s) ? s : null;
}

/** Masque pour l'affichage : +32 4•• •• •• 56 */
export function maskPhone(e164: string): string {
  return `+32 ${e164.slice(3, 4)}•• •• •• ${e164.slice(-2)}`;
}

export function sanitizeUtm(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object") return out;
  for (const k of UTM_KEYS) {
    const v = str((input as Record<string, unknown>)[k]).replace(/[^\p{L}\p{N} _\-.+~%]/gu, "").slice(0, 100);
    if (v) out[k] = v;
  }
  return out;
}

export function validateSubmission(body: unknown): Result<Submission> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const trade = TRADES[str(b.trade)];
  if (!trade || !trade.active) errors.trade = "Métier non disponible.";

  const project_type = str(b.project_type);
  if (!values(PROJECT_TYPES).includes(project_type)) errors.project_type = "Choisissez le type de projet.";

  const budget = str(b.budget);
  if (!values(BUDGETS).includes(budget)) errors.budget = "Choisissez un budget.";

  const delay = str(b.delay);
  if (!values(DELAYS).includes(delay)) errors.delay = "Choisissez un délai.";

  const detail: Record<string, string> = {};
  if (trade) {
    const raw = b.detail && typeof b.detail === "object" ? (b.detail as Record<string, unknown>) : {};
    const v = str(raw[trade.detail.key]);
    if (values(trade.detail.options).includes(v)) detail[trade.detail.key] = v;
    else errors.detail = "Répondez à la question sur vos travaux.";
  }

  // Localité obligatoire : sans elle, la demande ne peut être attribuée à personne
  const postal_code = str(b.postal_code);
  if (!postal_code) errors.postal_code = "Le code postal est obligatoire.";
  else if (!provinceOf(postal_code)) errors.postal_code = "Code postal belge à 4 chiffres.";

  const commune = str(b.commune).replace(/\s+/g, " ");
  if (!commune) errors.commune = "La commune est obligatoire.";
  else if (!COMMUNE_RE.test(commune)) errors.commune = "Indiquez le nom de votre commune.";

  const first_name = str(b.first_name).replace(/\s+/g, " ");
  if (!NAME_RE.test(first_name)) errors.first_name = "Indiquez votre prénom.";

  const phone_e164 = normalizeBelgianMobile(b.phone);
  if (!phone_e164) errors.phone = "Numéro de GSM belge (ex. 0470 12 34 56).";

  const email = str(b.email).toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = "Adresse e-mail invalide.";

  if (b.consent !== true) errors.consent = "Votre accord est nécessaire pour transmettre la demande.";
  const consent_version = str(b.consent_version);
  if (consent_version !== CONSENT_VERSION) errors.consent = "Rechargez la page puis réessayez.";

  const sid = str(b.session_id);
  const session_id = UUID_RE.test(sid) ? sid.toLowerCase() : null;

  const captcha_token = str(b.captcha_token).slice(0, 2048);

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      trade: trade!.code, project_type, budget, delay, detail, postal_code, commune,
      first_name, phone_e164: phone_e164!, email, consent_version, session_id,
      utm: sanitizeUtm(b.utm), captcha_token,
    },
  };
}

export function validateCode(v: unknown): string | null {
  const s = str(v).replace(/\s/g, "");
  return /^[0-9]{6}$/.test(s) ? s : null;
}

export function validateUuid(v: unknown): string | null {
  const s = str(v);
  return UUID_RE.test(s) ? s.toLowerCase() : null;
}

export function validateTrack(body: unknown) {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const event = str(b.event);
  if (!["page_view", "quiz_start", "quiz_step"].includes(event)) return null;
  const session_id = validateUuid(b.session_id);
  if (!session_id) return null;
  const step = typeof b.step === "number" && Number.isInteger(b.step) && b.step >= 1 && b.step <= 7 ? b.step : null;
  const trade = TRADES[str(b.trade)] ? str(b.trade) : null;
  const page = str(b.page).replace(/[^a-z0-9/_\-.]/gi, "").slice(0, 120) || null;
  return { event, session_id, step, trade, page, utm: sanitizeUtm(b.utm) };
}
