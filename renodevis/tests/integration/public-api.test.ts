// Test de bout en bout de la fonction serveur contre un vrai Postgres local
// (shim Supabase + migrations). SMS, e-mail et captcha sont simulés.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";
import { createHandler } from "../../supabase/functions/_shared/handler.ts";
import { CONSENT_VERSION } from "../../supabase/functions/_shared/consent.ts";

const conn = { host: process.env.PGHOST ?? "127.0.0.1", port: Number(process.env.PGPORT ?? 54329), user: process.env.PGUSER ?? "postgres" };
const DB = "rd_integration";
const ORIGIN = "https://connect.pxlstudio.be";
let db: pg.Client;

const sms: { to: string; text: string }[] = [];
const emails: { subject: string; text: string }[] = [];
const lastCode = (to: string) => sms.filter((s) => s.to === to).at(-1)?.text.match(/\b(\d{6})\b/)?.[1];

let handle: (r: Request) => Promise<Response>;

const call = async (route: string, body: unknown, init: { origin?: string | null; ip?: string; type?: string } = {}) => {
  const headers: Record<string, string> = { "content-type": init.type ?? "application/json", "x-forwarded-for": init.ip ?? "203.0.113.7" };
  if (init.origin !== null) headers.origin = init.origin ?? ORIGIN;
  const res = await handle(new Request(`https://x.supabase.co/functions/v1/public-api/${route}`, {
    method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body),
  }));
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, headers: res.headers };
};

const body = (patch: Record<string, unknown> = {}) => ({
  trade: "chassis", project_type: "renovation", budget: "10000_20000", delay: "3_mois",
  detail: { quantite: "4_6" }, postal_code: "6000", commune: "Charleroi",
  first_name: "Chloé", phone: "0470 12 34 56", email: "chloe@exemple.be",
  consent: true, consent_version: CONSENT_VERSION, captcha_token: "ok",
  session_id: "33333333-3333-4333-8333-333333333333",
  utm: { utm_source: "meta", utm_campaign: "chassis-test" },
  ...patch,
});

beforeAll(async () => {
  const admin = new pg.Client({ ...conn, database: "postgres" });
  await admin.connect();
  await admin.query(`drop database if exists ${DB}`);
  await admin.query(`create database ${DB}`);
  await admin.end();

  db = new pg.Client({ ...conn, database: DB });
  await db.connect();
  await db.query(readFileSync("tests/sql/supabase-shim.sql", "utf8"));
  for (const f of readdirSync("supabase/migrations").sort()) {
    await db.query(readFileSync(`supabase/migrations/${f}`, "utf8"));
  }
  // Une entreprise validée sur Charleroi pour vérifier l'attribution
  await db.query(`
    insert into public.companies (id, name, bce_number, email_pro, status)
    values ('a0000000-0000-0000-0000-000000000000', 'Châssis A', '0100000001', 'a@test.be', 'validated');
    insert into public.company_profiles (company_id, trades, zone_prefixes) values ('a0000000-0000-0000-0000-000000000000', '{chassis}', '{60}');
  `);

  // Connexion « API » : rôle service_role, comme la fonction déployée
  const api = new pg.Client({ ...conn, database: DB });
  await api.connect();
  await api.query("set role service_role");

  handle = createHandler({
    rpc: async (fn, args) => (await api.query(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(args)])).rows[0].r,
    sendSms: async (to, text) => { sms.push({ to, text }); return true; },
    notifyAdmin: async (subject, text) => { emails.push({ subject, text }); return true; },
    verifyCaptcha: async (token) => token === "ok",
    pepper: "poivre-de-test",
    allowedOrigins: [ORIGIN],
  });
});

afterAll(async () => { await db?.end(); });
beforeEach(() => { sms.length = 0; emails.length = 0; });

describe("protections HTTP", () => {
  it("refuse une origine inconnue (CSRF)", async () => {
    expect((await call("submit", body(), { origin: "https://evil.example" })).status).toBe(403);
    expect((await call("submit", body(), { origin: null })).status).toBe(403);
  });
  it("exige du JSON", async () => {
    expect((await call("submit", "a=b", { type: "application/x-www-form-urlencoded" })).status).toBe(415);
  });
  it("limite la taille", async () => {
    expect((await call("submit", { x: "a".repeat(9000) })).status).toBe(413);
  });
  it("pré-requête CORS seulement pour nos origines", async () => {
    const ok = await handle(new Request("https://x/public-api/submit", { method: "OPTIONS", headers: { origin: ORIGIN } }));
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    const ko = await handle(new Request("https://x/public-api/submit", { method: "OPTIONS", headers: { origin: "https://evil.example" } }));
    expect(ko.status).toBe(403);
    expect(ko.headers.get("access-control-allow-origin")).toBeNull();
  });
  it("captcha obligatoire", async () => {
    const r = await call("submit", body({ captcha_token: "faux" }));
    expect(r.json.error).toBe("captcha");
    expect(sms).toHaveLength(0);
  });
  it("validation serveur avec messages par champ", async () => {
    const r = await call("submit", body({ phone: "071 12 34 56", postal_code: "abc" }));
    expect(r.status).toBe(400);
    expect(Object.keys(r.json.fields)).toEqual(expect.arrayContaining(["phone", "postal_code"]));
  });
});

describe("parcours complet", () => {
  let requestId: string;
  let code: string;

  it("envoie le formulaire → SMS, sans renvoyer de coordonnées", async () => {
    const r = await call("submit", body());
    expect(r.status).toBe(200);
    expect(r.json.phone).toBe("+32 4•• •• •• 56");
    expect(JSON.stringify(r.json)).not.toMatch(/chloe|Chloé|470123456/);
    requestId = r.json.request_id;
    expect(sms).toHaveLength(1);
    expect(sms[0].to).toBe("+32470123456");
    code = lastCode("+32470123456")!;
    expect(code).toMatch(/^\d{6}$/);

    // Le code en clair n'est jamais stocké ; le numéro est haché
    const otp = await db.query("select code_hash from public.otp_attempts where request_id = $1", [requestId]);
    expect(otp.rows[0].code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(otp.rows[0].code_hash).not.toContain(code);
    const c = await db.query("select phone_hash from public.request_contacts where request_id = $1", [requestId]);
    expect(c.rows[0].phone_hash).toMatch(/^[0-9a-f]{64}$/);
    const cl = await db.query("select consent_version, ip_hash from public.consent_logs where request_id = $1", [requestId]);
    expect(cl.rows[0].consent_version).toBe(CONSENT_VERSION);
    expect(cl.rows[0].ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(cl.rows[0].ip_hash).not.toContain("203.0.113.7");
  });

  it("renvoi trop rapide refusé", async () => {
    const r = await call("resend", { request_id: requestId });
    expect(r.status).toBe(429);
    expect(r.json.error).toBe("too_soon");
  });

  it("mauvais code → essais restants, aucun e-mail", async () => {
    const wrong = code === "000000" ? "111111" : "000000";
    const r = await call("verify", { request_id: requestId, code: wrong });
    expect(r.json).toMatchObject({ ok: false, error: "invalid_code", remaining: 4 });
    expect(emails).toHaveLength(0);
  });

  it("bon code → demande validée, attribuée, e-mail admin sans coordonnées", async () => {
    const r = await call("verify", { request_id: requestId, code });
    expect(r.status).toBe(200);
    expect(r.json.ref).toMatch(/^RD-[0-9A-F]{8}$/);
    const req = await db.query("select status from public.requests where id = $1", [requestId]);
    expect(req.rows[0].status).toBe("validated");
    const a = await db.query("select company_id from public.assignments where request_id = $1", [requestId]);
    expect(a.rows.map((x) => x.company_id)).toEqual(["a0000000-0000-0000-0000-000000000000"]);
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toContain(r.json.ref);
    expect(emails[0].text).toContain("6000 Charleroi");
    expect(emails[0].text).toContain("Entreprises attribuées : 1");
    expect(emails[0].text).not.toMatch(/Chloé|chloe@|\+32/);
    const ev = await db.query("select event from public.tracking_events where request_id = $1 order by id", [requestId]);
    expect(ev.rows.map((x) => x.event)).toEqual(["request_submitted", "sms_validated"]);
  });

  it("doublon : même GSM + même métier dans les 30 jours", async () => {
    const r = await call("submit", body({ phone: "+32 470 12 34 56" }), { ip: "203.0.113.8" });
    expect(r.status).toBe(409);
    expect(r.json.error).toBe("duplicate");
    expect(sms).toHaveLength(0);
  });

  it("suivi : événements du quiz acceptés, faux événements ignorés", async () => {
    const sid = "44444444-4444-4444-8444-444444444444";
    expect((await call("track", { event: "quiz_step", step: 2, session_id: sid, trade: "chassis" })).status).toBe(204);
    expect((await call("track", { event: "sms_validated", session_id: sid })).status).toBe(204);
    const ev = await db.query("select event from public.tracking_events where session_id = $1", [sid]);
    expect(ev.rows.map((x) => x.event)).toEqual(["quiz_step"]);
  });
});

describe("droit à l'effacement", () => {
  it("numéro inconnu : même réponse, aucun SMS", async () => {
    const r = await call("erase-start", { phone: "0499 00 00 00", captcha_token: "ok" }, { ip: "203.0.113.20" });
    expect(r.json).toEqual({ ok: true });
    expect(sms).toHaveLength(0);
  });

  it("numéro connu : code SMS puis suppression effective", async () => {
    const r = await call("erase-start", { phone: "0470123456", captcha_token: "ok" }, { ip: "203.0.113.20" });
    expect(r.json).toEqual({ ok: true });
    const code = lastCode("+32470123456")!;
    expect(code).toMatch(/^\d{6}$/);

    const done = await call("erase-confirm", { phone: "0470123456", code }, { ip: "203.0.113.20" });
    expect(done.json).toEqual({ ok: true, erased: 1 });
    const left = await db.query("select count(*)::int n from public.request_contacts");
    expect(left.rows[0].n).toBe(0);
    const req = await db.query("select count(*)::int n from public.requests");
    expect(req.rows[0].n).toBe(0);
    const cl = await db.query("select count(*)::int n from public.consent_logs where request_id is not null or ip_hash is not null");
    expect(cl.rows[0].n).toBe(0);
  });
});
