// Droit à l'effacement : numéro → code SMS → suppression effective en base.
import { errorMessage, post } from "./lib/api";
import { prepareCaptcha, takeCaptchaToken } from "./lib/captcha";
import { normalizeBelgianMobile } from "../supabase/functions/_shared/validation";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const start = $<HTMLFormElement>("erase-start");
const confirm = $<HTMLFormElement>("erase-confirm");
const status = $("erase-status");
let phone = "";

void prepareCaptcha($("captcha"));

start.addEventListener("submit", async (e) => {
  e.preventDefault();
  status.textContent = "";
  const input = $<HTMLInputElement>("phone");
  if (!normalizeBelgianMobile(input.value)) {
    $("err-phone").textContent = "Numéro de GSM belge (ex. 0470 12 34 56).";
    input.setAttribute("aria-invalid", "true");
    input.focus();
    return;
  }
  $("err-phone").textContent = "";
  input.setAttribute("aria-invalid", "false");
  const btn = start.querySelector("button")!;
  btn.disabled = true;
  const { data } = await post("erase-start", { phone: input.value, captcha_token: await takeCaptchaToken() });
  btn.disabled = false;
  if (!data.ok) { status.textContent = errorMessage(data); return; }
  phone = input.value;
  start.hidden = true;
  confirm.hidden = false;
  $<HTMLInputElement>("code").focus();
});

confirm.addEventListener("submit", async (e) => {
  e.preventDefault();
  status.textContent = "";
  const input = $<HTMLInputElement>("code");
  const code = input.value.replace(/\s/g, "");
  if (!/^[0-9]{6}$/.test(code)) {
    $("err-code").textContent = "Le code contient 6 chiffres.";
    input.focus();
    return;
  }
  const btn = confirm.querySelector("button")!;
  btn.disabled = true;
  const { data } = await post("erase-confirm", { phone, code });
  btn.disabled = false;
  if (!data.ok) { $("err-code").textContent = errorMessage(data); input.select(); return; }
  confirm.hidden = true;
  const n = Number(data.erased) || 0;
  $("erase-result").textContent = n > 0
    ? `${n} demande${n > 1 ? "s" : ""} et les coordonnées associées ont été supprimées de notre base.`
    : "Aucune donnée n'était enregistrée pour ce numéro.";
  $("erase-done").hidden = false;
  $("erase-done").focus();
});
