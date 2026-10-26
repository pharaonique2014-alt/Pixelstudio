// Page test « châssis » : quiz en 7 étapes (projet, quantité, budget, délai,
// coordonnées, code SMS, confirmation).
import { errorMessage, post } from "./lib/api";
import { prepareCaptcha, takeCaptchaToken } from "./lib/captcha";
import { sessionId, track, utm } from "./lib/tracking";
import { initAdPixels, reportLead } from "./lib/ad-pixels";
import { validateSubmission } from "../supabase/functions/_shared/validation";
import { CONSENT_TEXT, CONSENT_VERSION } from "../supabase/functions/_shared/consent";

const TOTAL = 6;
const form = document.getElementById("quiz") as HTMLFormElement;
const trade = form.dataset.trade ?? "chassis";
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const steps = Array.from(form.querySelectorAll<HTMLElement>(".step"));
const backBtn = $<HTMLButtonElement>("back");
const nextBtn = $<HTMLButtonElement>("next");
const nav = $("quiz-nav");
const status = $("quiz-status");
const live = $("quiz-live");
const progressLabel = $("quiz-progress-label");
const pixels = Array.from(form.querySelectorAll<HTMLElement>(".quiz-pixels span"));
const resendBtn = $<HTMLButtonElement>("resend");

// Le texte affiché doit être exactement la version enregistrée côté serveur.
$("consent-text").textContent = CONSENT_TEXT;

let current = 1;
let started = false;
let requestId: string | null = null;
let busy = false;
let pointerChoice: HTMLInputElement | null = null;
let cooldownTimer: number | undefined;

const NEXT_LABEL: Record<number, string> = { 5: "Recevoir mon code par SMS", 6: "Valider le code" };

function show(n: number, focus = true) {
  current = n;
  steps.forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
  status.textContent = "";
  backBtn.hidden = n === 1 || n >= 6;
  nav.hidden = n === 7;
  nextBtn.textContent = NEXT_LABEL[n] ?? "Suivant";
  const shown = Math.min(n, TOTAL);
  progressLabel.textContent = n === 7 ? "Demande confirmée" : `Étape ${shown} sur ${TOTAL}`;
  pixels.forEach((p, i) => p.classList.toggle("done", i < (n === 7 ? TOTAL : shown)));

  const step = steps.find((s) => Number(s.dataset.step) === n)!;
  const title = step.querySelector("legend, .step-title")?.textContent ?? "";
  live.textContent = n === 7 ? title : `Étape ${shown} sur ${TOTAL} : ${title}`;
  if (n === 5) void prepareCaptcha($("captcha"));
  if (focus) {
    step.setAttribute("tabindex", "-1");
    step.focus({ preventScroll: true });
    const top = $("demande").getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) $("demande").scrollIntoView({ block: "start" });
  }
}

const radioValue = (name: string) =>
  (form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? "");

const RADIO_STEP: Record<number, string> = { 1: "project_type", 2: "detail", 3: "budget", 4: "delay" };

function setFieldErrors(errors: Record<string, string>) {
  const fields = ["postal_code", "commune", "first_name", "phone", "email", "consent"];
  let first: HTMLElement | null = null;
  for (const f of fields) {
    const input = $<HTMLInputElement>(f);
    const msg = errors[f] ?? "";
    $(`err-${f}`).textContent = msg;
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (msg && !first) first = input;
  }
  first?.focus();
  return !first;
}

function payload() {
  const v = (id: string) => $<HTMLInputElement>(id).value;
  return {
    trade,
    project_type: radioValue("project_type"),
    detail: { quantite: radioValue("detail") },
    budget: radioValue("budget"),
    delay: radioValue("delay"),
    postal_code: v("postal_code"),
    commune: v("commune"),
    first_name: v("first_name"),
    phone: v("phone"),
    email: v("email"),
    consent: $<HTMLInputElement>("consent").checked,
    consent_version: CONSENT_VERSION,
    session_id: sessionId,
    utm,
  };
}

function setBusy(on: boolean, label?: string) {
  busy = on;
  nextBtn.disabled = on;
  if (on && label) nextBtn.textContent = label;
  if (!on) nextBtn.textContent = NEXT_LABEL[current] ?? "Suivant";
}

function startCooldown(seconds = 60) {
  window.clearInterval(cooldownTimer);
  let left = seconds;
  resendBtn.disabled = true;
  resendBtn.textContent = `Renvoyer le code (${left} s)`;
  cooldownTimer = window.setInterval(() => {
    left -= 1;
    if (left <= 0) {
      window.clearInterval(cooldownTimer);
      resendBtn.disabled = false;
      resendBtn.textContent = "Renvoyer le code";
    } else {
      resendBtn.textContent = `Renvoyer le code (${left} s)`;
    }
  }, 1000);
}

async function submitDetails() {
  const data = payload();
  const check = validateSubmission({ ...data, captcha_token: "-" });
  if (!check.ok) {
    setFieldErrors(check.errors);
    status.textContent = "Certaines informations sont à corriger.";
    return;
  }
  setFieldErrors({});
  setBusy(true, "Envoi en cours…");
  const captcha_token = await takeCaptchaToken();
  const { data: res } = await post("submit", { ...data, captcha_token });
  setBusy(false);
  if (!res.ok) {
    if (res.fields) setFieldErrors(res.fields);
    status.textContent = errorMessage(res);
    return;
  }
  track("quiz_step", { step: 5, trade });
  requestId = res.request_id;
  $("code-phone").textContent = res.phone;
  $<HTMLInputElement>("code").value = "";
  show(6);
  startCooldown();
  $<HTMLInputElement>("code").focus();
}

async function verifyCode() {
  const input = $<HTMLInputElement>("code");
  const code = input.value.replace(/\s/g, "");
  if (!/^[0-9]{6}$/.test(code)) {
    $("err-code").textContent = "Le code contient 6 chiffres.";
    input.setAttribute("aria-invalid", "true");
    input.focus();
    return;
  }
  $("err-code").textContent = "";
  input.setAttribute("aria-invalid", "false");
  setBusy(true, "Vérification…");
  const { data: res } = await post("verify", { request_id: requestId, code });
  setBusy(false);
  if (!res.ok) {
    $("err-code").textContent = errorMessage(res);
    input.setAttribute("aria-invalid", "true");
    input.select();
    return;
  }
  $("confirm-ref").textContent = res.ref;
  reportLead();
  show(7);
}

// Retient la réponse touchée / cliquée : seule elle déclenche l'avance automatique
form.addEventListener("pointerdown", (e) => {
  pointerChoice = (e.target as HTMLElement).closest(".choice")?.querySelector("input") ?? null;
});
form.addEventListener("keydown", () => { pointerChoice = null; });

form.addEventListener("change", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.type !== "radio") return;
  if (!started) { started = true; track("quiz_start", { trade }); }
  status.textContent = "";
  // Avance automatique au clic / toucher, jamais au clavier (flèches)
  if (pointerChoice === t && current <= 4) {
    pointerChoice = null;
    window.setTimeout(() => { if (radioValue(RADIO_STEP[current]) === t.value) goNext(); }, 160);
  }
});

function goNext() {
  if (busy) return;
  if (current <= 4) {
    if (!radioValue(RADIO_STEP[current])) {
      status.textContent = "Choisissez une réponse pour continuer.";
      return;
    }
    track("quiz_step", { step: current, trade });
    show(current + 1);
  } else if (current === 5) {
    void submitDetails();
  } else if (current === 6) {
    void verifyCode();
  }
}

form.addEventListener("submit", (e) => { e.preventDefault(); goNext(); });
backBtn.addEventListener("click", () => { if (!busy && current > 1) show(current - 1); });

resendBtn.addEventListener("click", async () => {
  if (!requestId || resendBtn.disabled) return;
  resendBtn.disabled = true;
  const { data: res } = await post("resend", { request_id: requestId });
  if (res.ok) {
    $("err-code").textContent = "";
    status.textContent = "";
    live.textContent = "Un nouveau code vous a été envoyé.";
    startCooldown();
  } else {
    $("err-code").textContent = errorMessage(res);
    resendBtn.disabled = false;
  }
});

$("change-phone").addEventListener("click", () => {
  requestId = null;
  window.clearInterval(cooldownTimer);
  show(5);
  $<HTMLInputElement>("phone").focus();
});

$("cta-final").addEventListener("click", (e) => {
  e.preventDefault();
  $("demande").scrollIntoView({ block: "start" });
  show(current);
});

initAdPixels();
track("page_view", { trade });
show(1, false);
