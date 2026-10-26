// Appels à la fonction serveur `public-api` (seule API utilisée par les pages publiques).

import { demoPost, showDemoBanner } from "./demo-api";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
const DEMO = import.meta.env.VITE_DEMO === "1";
if (DEMO) showDemoBanner();

export type ApiResult = { status: number; data: Record<string, any> };

export async function post(route: string, body: unknown, opts: { keepalive?: boolean } = {}): Promise<ApiResult> {
  if (DEMO) return demoPost(route, body as Record<string, any>);
  try {
    const res = await fetch(`${BASE}/${route}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "omit",
      keepalive: opts.keepalive,
    });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : {} };
  } catch {
    return { status: 0, data: { ok: false, error: "network" } };
  }
}

const MESSAGES: Record<string, string> = {
  rate_limited: "Trop de tentatives. Réessayez dans un moment.",
  too_soon: "Patientez une minute avant de demander un nouveau code.",
  duplicate: "Une demande avec ce numéro est déjà en cours pour ces travaux. Les entreprises vont vous recontacter.",
  consent_outdated: "La page a été mise à jour. Rechargez-la puis réessayez.",
  captcha: "La vérification anti-robot n'a pas abouti. Réessayez.",
  expired: "Ce code a expiré. Demandez un nouveau code.",
  locked: "Trop d'essais avec ce code. Demandez un nouveau code.",
  sms_failed: "L'envoi du SMS a échoué. Vérifiez votre numéro et réessayez.",
  not_found: "Demande introuvable. Recommencez le formulaire.",
  invalid_input: "Certaines informations sont à corriger.",
  network: "Connexion impossible. Vérifiez votre réseau et réessayez.",
};

export function errorMessage(data: Record<string, any>): string {
  if (data.error === "invalid_code") {
    const n = Number(data.remaining);
    return Number.isFinite(n) && n > 0
      ? `Code incorrect. Il vous reste ${n} essai${n > 1 ? "s" : ""}.`
      : "Code incorrect.";
  }
  return MESSAGES[data.error] ?? "Une erreur est survenue. Réessayez.";
}
