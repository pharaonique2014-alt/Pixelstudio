// Mesure d'audience interne, sans cookie ni stockage : un identifiant de
// session tiré au chargement et gardé en mémoire (perdu à la fermeture).
// Respecte « Do Not Track » / « Global Privacy Control ».
import { post } from "./api";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
export const trackingAllowed = !(nav.doNotTrack === "1" || nav.globalPrivacyControl === true);

export const sessionId: string | null = trackingAllowed ? crypto.randomUUID() : null;

export const utm: Record<string, string> = (() => {
  const q = new URLSearchParams(location.search);
  const out: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = q.get(k);
    if (v) out[k] = v.slice(0, 100);
  }
  return out;
})();

export function track(event: "page_view" | "quiz_start" | "quiz_step", extra: { step?: number; trade?: string } = {}) {
  if (!sessionId) return;
  void post("track", { event, session_id: sessionId, utm, page: location.pathname, ...extra }, { keepalive: true });
}
