// Tests navigateur (Playwright préinstallé + axe-core) sur le build, avec l'API simulée.
// Usage : npm run test:e2e   (build puis `vite preview` sur le port 4173)
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const resolveGlobal = (m) => { try { return require.resolve(m); } catch { return require.resolve(`/opt/node22/lib/node_modules/${m}`); } };
const { chromium } = require(resolveGlobal("playwright"));
const { default: AxeBuilder } = await import("@axe-core/playwright");

const BASE = "http://localhost:4173";
const SHOTS = process.env.RD_SHOTS ?? "test-results";
mkdirSync(SHOTS, { recursive: true });

const server = spawn("npx", ["vite", "preview", "--port", "4173", "--strictPort"], { stdio: ["ignore", "pipe", "inherit"] });
await new Promise((resolve, reject) => {
  server.stdout.on("data", (d) => { if (String(d).includes("4173")) resolve(); });
  server.on("exit", reject);
  setTimeout(() => reject(new Error("preview timeout")), 15000);
});

// Arrêt garanti du serveur, même en cas d'erreur inattendue
const stop = (code) => { server.kill(); process.exit(code); };
process.on("uncaughtException", (e) => { console.error(e); stop(1); });
process.on("unhandledRejection", (e) => { console.error(e); stop(1); });
setTimeout(() => { console.error("délai global dépassé"); stop(1); }, 240_000).unref();

const browser = await chromium.launch();
let failures = 0;
const test = async (name, fn) => {
  try { await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error("délai du test dépassé (40 s)")), 40_000))]); console.log(`✔ ${name}`); }
  catch (e) { failures++; console.error(`✘ ${name}\n  ${e.message.split("\n").slice(0, 6).join("\n  ")}`); }
};

const newPage = async (opts = {}) => {
  const ctx = await browser.newContext({ locale: "fr-BE", ...opts });
  const page = await ctx.newPage();
  const external = [];
  page.on("request", (r) => { const u = new URL(r.url()); if (u.hostname !== "localhost") external.push(r.url()); });
  page.external = external;
  // Toute violation de la CSP fait échouer le test
  page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) { failures++; console.error(`✘ CSP : ${m.text()}`); } });
  return page;
};

async function axe(page, label) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const v = r.violations.map((x) => `${x.id} (${x.nodes.length}) : ${x.nodes[0]?.target}`);
  assert.deepEqual(v, [], `${label} — violations axe :\n${v.join("\n")}`);
}

const mobile = { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

await test("mobile clair : parcours complet au toucher (auto-avance), code faux puis bon", async () => {
  const page = await newPage({ ...mobile, colorScheme: "light" });
  const resp = await page.goto(`${BASE}/?utm_source=meta&utm_campaign=chassis-test`);
  assert.match(resp.headers()["content-security-policy"] ?? "", /default-src 'self'/, "CSP présente");
  await page.screenshot({ path: `${SHOTS}/mobile-clair-haut.png` });
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  assert.ok(noHScroll, "pas de défilement horizontal à 360 px");
  assert.ok(!(await page.getByRole("button", { name: "Retour" }).isVisible()), "pas de « Retour » à l'étape 1");

  await page.locator('label:has(input[value="renovation"])').tap();
  await page.getByRole("group", { name: "Combien de fenêtres et de portes ?" }).waitFor();
  await page.locator('label:has(input[value="4_6"])').tap();
  await page.getByRole("group", { name: /budget/ }).waitFor();
  await page.locator('label:has(input[value="inconnu"])').tap();
  await page.getByRole("group", { name: /Quand souhaitez-vous/ }).waitFor();
  await page.locator('label:has(input[value="3_mois"])').tap();
  await page.getByRole("group", { name: "Où et comment vous joindre ?" }).waitFor();
  assert.equal(await page.locator("#quiz-progress-label").textContent(), "Étape 5 sur 6");

  // Erreurs de validation côté navigateur
  await page.getByRole("button", { name: "Recevoir mon code par SMS" }).click();
  assert.match(await page.locator("#err-phone").textContent(), /GSM belge/);
  assert.match(await page.locator("#err-consent").textContent(), /accord/);

  await page.getByLabel("Code postal").fill("6000");
  await page.getByLabel("Commune").fill("Charleroi");
  await page.getByLabel("Prénom").fill("Chloé");
  await page.getByLabel("Téléphone mobile").fill("0470 12 34 56");
  await page.getByLabel("E-mail").fill("chloe@exemple.be");
  await page.getByLabel(/J'accepte que mes coordonnées/).check();
  await page.screenshot({ path: `${SHOTS}/mobile-clair-coordonnees.png` });
  await page.getByRole("button", { name: "Recevoir mon code par SMS" }).click();

  await page.getByRole("group", { name: "Entrez le code reçu par SMS" }).waitFor();
  assert.equal(await page.locator("#code-phone").textContent(), "+32 4•• •• •• 56");
  assert.match(await page.locator("#resend").textContent(), /\(\d+ s\)/);
  await page.getByLabel("Code à 6 chiffres").fill("000000");
  await page.getByRole("button", { name: "Valider le code" }).click();
  await page.locator("#err-code", { hasText: "Code incorrect" }).waitFor();
  assert.match(await page.locator("#err-code").textContent(), /4 essais/);
  await page.getByLabel("Code à 6 chiffres").fill("123456");
  await page.getByRole("button", { name: "Valider le code" }).click();
  await page.getByRole("heading", { name: "C'est confirmé, merci !" }).waitFor();
  assert.equal(await page.locator("#confirm-ref").textContent(), "RD-DEMO1234");
  await page.locator("#demande").screenshot({ path: `${SHOTS}/mobile-clair-confirmation.png` });

  // Événements de suivi envoyés (avec UTM), aucune requête vers un tiers
  const events = await (await page.request.post(`${BASE}/api/__events`, { data: {} })).json();
  const names = events.map((e) => e.event + (e.step ? `:${e.step}` : ""));
  for (const n of ["page_view", "quiz_start", "quiz_step:1", "quiz_step:2", "quiz_step:3", "quiz_step:4", "quiz_step:5"]) {
    assert.ok(names.includes(n), `événement ${n} manquant (${names})`);
  }
  assert.equal(events[0].utm.utm_campaign, "chassis-test");
  assert.deepEqual(page.external, [], "aucune requête vers un domaine tiers");
  await page.context().close();
});

await test("clavier : les flèches ne font pas avancer, « Suivant » oui ; retour possible", async () => {
  const page = await newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE);
  await page.getByRole("button", { name: "Suivant" }).click();
  assert.match(await page.locator("#quiz-status").textContent(), /Choisissez une réponse/);
  await page.locator('input[value="renovation"]').focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(400);
  assert.ok(await page.locator('[data-step="1"]').isVisible(), "reste à l'étape 1");
  assert.ok(await page.locator('input[value="nouvelle_construction"]').isChecked());
  await page.keyboard.press("Enter");
  await page.locator('[data-step="2"]').waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Retour" }).click();
  await page.locator('[data-step="1"]').waitFor({ state: "visible" });
  await page.context().close();
});

await test("doublon : message clair", async () => {
  const page = await newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE);
  for (const v of ["renovation", "1_3", "moins_5000", "asap"]) {
    await page.locator(`label:has(input[value="${v}"])`).click();
    await page.locator(`input[value="${v}"]`).waitFor({ state: "hidden" });
  }
  await page.getByLabel("Code postal").fill("7000");
  await page.getByLabel("Commune").fill("Mons");
  await page.getByLabel("Prénom").fill("Dan");
  await page.getByLabel("Téléphone mobile").fill("0470 00 00 00");
  await page.getByLabel("E-mail").fill("dan@exemple.be");
  await page.getByLabel(/J'accepte/).check();
  await page.getByRole("button", { name: "Recevoir mon code par SMS" }).click();
  await page.locator("#quiz-status", { hasText: "déjà en cours" }).waitFor();
  await page.context().close();
});

for (const scheme of ["light", "dark"]) {
  await test(`accessibilité (axe, WCAG 2.2 AA) — ${scheme}`, async () => {
    const page = await newPage({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
    for (const p of ["/", "/effacement.html", "/legal/mentions-legales.html", "/legal/confidentialite.html",
      "/legal/conditions-utilisation.html", "/legal/cookies.html", "/pro/cgv.html"]) {
      await page.goto(BASE + p);
      await axe(page, `${p} (${scheme})`);
    }
    // Étape coordonnées et étape code aussi
    await page.goto(BASE);
    for (const v of ["extension", "plus_10", "plus_20000", "6_mois"]) await page.locator(`label:has(input[value="${v}"])`).click();
    await page.locator('[data-step="5"]').waitFor({ state: "visible" });
    await axe(page, `étape 5 (${scheme})`);
    await page.screenshot({ path: `${SHOTS}/desktop-${scheme}-haut.png` });
    await page.screenshot({ path: `${SHOTS}/desktop-${scheme}-page.png`, fullPage: true });
    await page.context().close();
  });
}

await test("effacement : numéro → code → suppression", async () => {
  const page = await newPage(mobile);
  await page.goto(`${BASE}/effacement.html`);
  await page.getByLabel("Numéro de GSM").fill("0470123456");
  await page.getByRole("button", { name: "Recevoir un code par SMS" }).click();
  await page.getByLabel("Code reçu par SMS").fill("123456");
  await page.getByRole("button", { name: "Supprimer définitivement mes données" }).click();
  await page.getByText("C'est fait.").waitFor();
  assert.match(await page.locator("#erase-result").textContent(), /supprimées/);
  await page.context().close();
});

await test("mobile sombre : capture", async () => {
  const page = await newPage({ ...mobile, colorScheme: "dark" });
  await page.goto(BASE);
  await page.screenshot({ path: `${SHOTS}/mobile-sombre-page.png`, fullPage: true });
  await page.context().close();
});

await browser.close();
if (failures) { console.error(`\n${failures} test(s) navigateur en échec`); stop(1); }
console.log("\nTous les tests navigateur passent.");
stop(0);
