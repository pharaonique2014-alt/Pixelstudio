// Pixels publicitaires (Meta, Google) : chargés UNIQUEMENT après consentement.
// Sans identifiant configuré, aucun bandeau ne s'affiche (aucun traceur non essentiel).
// [À COMPLÉTER] VITE_META_PIXEL_ID / VITE_GOOGLE_TAG_ID + domaines dans la CSP.

const META_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const GOOGLE_ID = import.meta.env.VITE_GOOGLE_TAG_ID as string | undefined;
const KEY = "rd-consent-pixels-v1";

declare global {
  interface Window { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; dataLayer?: unknown[] }
}

const configured = () => Boolean(META_ID || GOOGLE_ID);

function read(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function write(v: "accepted" | "refused") {
  try { localStorage.setItem(KEY, v); } catch { /* navigation privée : choix non mémorisé */ }
}

function inject(src: string) {
  const s = document.createElement("script");
  s.src = src; s.async = true;
  document.head.appendChild(s);
}

function loadPixels() {
  if (META_ID && !window.fbq) {
    const q: unknown[] = [];
    const fbq = (...a: unknown[]) => { q.push(a); };
    Object.assign(fbq, { queue: q, loaded: true, version: "2.0", push: fbq });
    window.fbq = fbq;
    inject("https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", META_ID);
    window.fbq("track", "PageView");
  }
  if (GOOGLE_ID && !window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer!.push(arguments); };
    inject(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_ID)}`);
    window.gtag("js", new Date());
    window.gtag("config", GOOGLE_ID);
  }
}

/** Conversion « demande validée » envoyée aux régies, si consentement. */
export function reportLead() {
  if (read() !== "accepted") return;
  window.fbq?.("track", "Lead");
  window.gtag?.("event", "generate_lead");
}

export function showBanner() {
  if (!configured() || document.getElementById("cookie-banner")) return;
  const el = document.createElement("div");
  el.id = "cookie-banner";
  el.className = "cookie-banner";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Cookies publicitaires");
  el.innerHTML = `<div class="container">
    <p>Avec votre accord, nous utilisons des traceurs publicitaires (Meta, Google) pour mesurer l'efficacité de nos annonces.
    Refuser n'a aucun effet sur votre demande. <a href="/legal/cookies.html">En savoir plus</a></p>
    <div class="btns"><button type="button" class="btn btn-ghost" data-v="refused">Refuser</button>
    <button type="button" class="btn btn-ghost" data-v="accepted">Accepter</button></div></div>`;
  el.addEventListener("click", (e) => {
    const v = (e.target as HTMLElement).closest("button")?.dataset.v as "accepted" | "refused" | undefined;
    if (!v) return;
    write(v);
    el.remove();
    if (v === "accepted") loadPixels();
  });
  document.body.appendChild(el);
}

export function initAdPixels() {
  if (!configured()) return;
  const v = read();
  if (v === "accepted") loadPixels();
  else if (v !== "refused") showBanner();
  document.querySelectorAll<HTMLElement>("[data-cookie-settings]").forEach((b) => {
    b.hidden = false;
    b.addEventListener("click", () => { try { localStorage.removeItem(KEY); } catch { /* */ } showBanner(); });
  });
}
