// Cloudflare Turnstile (captcha invisible), chargé seulement à l'étape des
// coordonnées. Sans clé de site (développement local), renvoie un jeton vide.

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
let widgetId: string | null = null;
let token = "";
let loading: Promise<void> | null = null;

function load(): Promise<void> {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error("turnstile")); };
    document.head.appendChild(s);
  });
  return loading;
}

export async function prepareCaptcha(container: HTMLElement) {
  if (!SITE_KEY || widgetId) return;
  try {
    await load();
    widgetId = window.turnstile!.render(container, {
      sitekey: SITE_KEY,
      language: "fr",
      appearance: "interaction-only",
      callback: (t: string) => { token = t; },
      "expired-callback": () => { token = ""; },
      "error-callback": () => { token = ""; },
    });
  } catch {
    /* le serveur refusera sans jeton : message « réessayez » */
  }
}

/** Jeton à usage unique : attend jusqu'à 8 s, puis réinitialise le widget. */
export async function takeCaptchaToken(): Promise<string> {
  if (!SITE_KEY) return "";
  for (let i = 0; i < 40 && !token; i++) await new Promise((r) => setTimeout(r, 200));
  const t = token;
  token = "";
  if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
  return t;
}
