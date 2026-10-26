import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  maskPhone, normalizeBelgianMobile, sanitizeUtm, validateCode, validateSubmission, validateTrack,
} from "../../supabase/functions/_shared/validation.ts";
import { randomOtp, hmacHex } from "../../supabase/functions/_shared/crypto.ts";
import { CONSENT_TEXT, CONSENT_VERSION } from "../../supabase/functions/_shared/consent.ts";
import { provinceOf } from "../../supabase/functions/_shared/provinces.ts";
import { adminEmail } from "../../supabase/functions/_shared/handler.ts";

export const validBody = () => ({
  trade: "chassis", project_type: "renovation", budget: "5000_10000", delay: "asap",
  detail: { quantite: "4_6" }, postal_code: "6000", commune: "Charleroi",
  first_name: "Chloé", phone: "0470 12 34 56", email: "Chloe@Exemple.be",
  consent: true, consent_version: CONSENT_VERSION, captcha_token: "ok",
});

describe("numéro de GSM belge", () => {
  it.each([
    ["0470 12 34 56", "+32470123456"],
    ["0470/12.34.56", "+32470123456"],
    ["+32 470 12 34 56", "+32470123456"],
    ["0032470123456", "+32470123456"],
    ["32470123456", "+32470123456"],
    ["0499-99-99-99", "+32499999999"],
  ])("%s → %s", (input, out) => expect(normalizeBelgianMobile(input)).toBe(out));

  it.each(["071 12 34 56", "0450 12 34 56", "047012345", "04701234567", "+33612345678", "", null, 470123456])(
    "refuse %s", (input) => expect(normalizeBelgianMobile(input)).toBeNull(),
  );

  it("masque le numéro", () => expect(maskPhone("+32470123456")).toBe("+32 4•• •• •• 56"));
});

describe("validation du formulaire", () => {
  it("accepte une demande complète et normalise", () => {
    const r = validateSubmission(validBody());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.phone_e164).toBe("+32470123456");
      expect(r.value.email).toBe("chloe@exemple.be");
      expect(r.value.detail).toEqual({ quantite: "4_6" });
    }
  });

  it.each([
    ["trade", { trade: "toiture" }],          // métier inactif sur la page test
    ["trade", { trade: "plomberie" }],
    ["project_type", { project_type: "locataire" }],
    ["budget", { budget: "1000000" }],
    ["delay", { delay: "je_me_renseigne" }],  // option volontairement absente
    ["detail", { detail: { quantite: "50" } }],
    ["postal_code", { postal_code: "60000" }],
    ["postal_code", { postal_code: "0600" }],
    ["commune", { commune: "<script>" }],
    ["commune", { commune: "" }],
    ["commune", { commune: "   " }],
    ["commune", { commune: "M" }],
    ["postal_code", { postal_code: "" }],
    ["first_name", { first_name: "" }],
    ["first_name", { first_name: "Robert'); DROP TABLE" }],
    ["phone", { phone: "071123456" }],
    ["email", { email: "pas-un-email" }],
    ["consent", { consent: false }],
    ["consent", { consent: "true" }],
    ["consent", { consent_version: "v0" }],
  ])("refuse un %s invalide", (field, patch) => {
    const r = validateSubmission({ ...validBody(), ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toContain(field);
  });

  it("ignore les champs inconnus et nettoie les UTM", () => {
    expect(sanitizeUtm({ utm_source: "meta<script>", utm_campaign: "chassis-test", gclid: "x", evil: 1 }))
      .toEqual({ utm_source: "metascript", utm_campaign: "chassis-test" });
  });

  it("code SMS : exactement 6 chiffres", () => {
    expect(validateCode("123 456")).toBe("123456");
    expect(validateCode("12345")).toBeNull();
    expect(validateCode("abcdef")).toBeNull();
  });

  it("tracking : refuse les événements serveur depuis le navigateur", () => {
    expect(validateTrack({ event: "sms_validated", session_id: crypto.randomUUID() })).toBeNull();
    expect(validateTrack({ event: "quiz_step", session_id: "x" })).toBeNull();
    expect(validateTrack({ event: "quiz_step", step: 3, session_id: crypto.randomUUID() })?.step).toBe(3);
  });
});

describe("provinces", () => {
  it.each([["1000", "BRU"], ["1348", "WBR"], ["1500", "VBR"], ["2000", "VAN"], ["3000", "VBR"], ["3500", "VLI"],
    ["4000", "WLG"], ["5000", "WNA"], ["6000", "WHT"], ["6700", "WLX"], ["7000", "WHT"], ["8000", "VWV"], ["9000", "VOV"]])(
    "%s → %s", (cp, code) => expect(provinceOf(cp)?.code).toBe(code));
  it("couvre tous les codes de 1000 à 9999", () => {
    for (let n = 1000; n <= 9999; n++) expect(provinceOf(String(n))).not.toBeNull();
  });
  it("mêmes plages que la fonction SQL rd_province", () => {
    const sql = readFileSync(new URL("../../supabase/migrations/20261027090400_rd_zones_provinces.sql", import.meta.url), "utf8");
    const pairs = [...sql.matchAll(/between (\d{4}) and (\d{4}) then '([A-Z]{3})'/g)].map((m) => [m[1], m[3]]);
    expect(pairs.length).toBe(12);
    for (const [start, code] of pairs) expect(provinceOf(start)?.code).toBe(code);
  });
});

describe("crypto", () => {
  it("code à 6 chiffres", () => {
    for (let i = 0; i < 500; i++) expect(randomOtp()).toMatch(/^[0-9]{6}$/);
  });
  it("HMAC stable et dépendant du poivre", async () => {
    const a = await hmacHex("poivre", "phone:+32470123456");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hmacHex("poivre", "phone:+32470123456")).toBe(a);
    expect(await hmacHex("autre", "phone:+32470123456")).not.toBe(a);
  });
});

describe("consentement", () => {
  it("le texte affiché est identique à la version enregistrée en base", () => {
    const sql = readFileSync(new URL("../../supabase/migrations/20261027090000_rd_schema.sql", import.meta.url), "utf8");
    const seeded = sql.match(/'demande-devis-2026-10-v1', 'demande_devis',\s*'((?:[^']|'')*)'/)?.[1]?.replace(/''/g, "'");
    expect(CONSENT_VERSION).toBe("demande-devis-2026-10-v1");
    expect(seeded).toBe(CONSENT_TEXT);
    expect(CONSENT_TEXT).toBe("J'accepte que mes coordonnées soient transmises à 3 entreprises au maximum pour recevoir un devis");
  });
});

describe("e-mail admin", () => {
  it("résumé lisible, sans coordonnées", () => {
    const txt = adminEmail({
      ref: "RD-ABC", assigned: 2,
      summary: { trade: "chassis", project_type: "extension", budget: "inconnu", delay: "3_mois",
                 detail: { quantite: "plus_10" }, postal_code: "7000", commune: "Mons", utm: { utm_source: "meta" } },
    });
    expect(txt).toContain("Projet : Extension");
    expect(txt).toContain("Combien de fenêtres et de portes ? Plus de 10");
    expect(txt).toContain("7000 Mons");
    expect(txt).not.toMatch(/\+32|@/);
  });
});
