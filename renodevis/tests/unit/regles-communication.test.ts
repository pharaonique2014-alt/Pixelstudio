// Règles de communication NON NÉGOCIABLES, vérifiées sur les sources des
// pages particuliers (HTML, scripts, styles).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const PAGES_PARTICULIER = [
  "index.html", "effacement.html",
  "legal/mentions-legales.html", "legal/confidentialite.html",
  "legal/conditions-utilisation.html", "legal/cookies.html",
];
const SCRIPTS_PARTICULIER = ["src/main.ts", "src/erase.ts", "src/lib/api.ts", "src/lib/ad-pixels.ts", "src/lib/tracking.ts"];
const CSS_PARTICULIER = ["src/styles/particulier.css", "src/styles/base.css"];

// Retire les encadrés [DÉCISION JURIDIQUE] (notes internes des brouillons)
const visible = (html: string) =>
  html.replace(/<span class="decision">[\s\S]*?<\/span>/g, "").replace(/<[^>]+>/g, " ");

describe.each(PAGES_PARTICULIER)("%s", (page) => {
  const text = visible(read(page));

  it("ne dit jamais « indépendant », « les meilleures », « sélectionnées pour vous »", () => {
    expect(text).not.toMatch(/indépendant/i);
    expect(text).not.toMatch(/meilleur(e|es|s)?\s+(entreprise|artisan)/i);
    expect(text).not.toMatch(/les meilleur/i);
    expect(text).not.toMatch(/sélectionnées pour vous/i);
  });

  it("ne mentionne ni prix de la plateforme, ni paiement des entreprises", () => {
    expect(text).not.toMatch(/\b35\s?(€|euros?)/i);
    expect(text).not.toMatch(/HTVA|TTC/);
    expect(text).not.toMatch(/tarif|commission|crédit|par contact/i);
    expect(text).not.toMatch(/débloqu/i);
    expect(text).not.toMatch(/entreprises?\s+(paient|payent|paie|payant|achètent)/i);
    expect(text).not.toMatch(/factur/i);
  });

  it("ne promet aucune prime ni aucun montant d'aide", () => {
    expect(text).not.toMatch(/prime (garantie|assurée)|jusqu'à \d[\d\s.]*\s?€ de prime/i);
  });

  it("aucun avis, ni statistique ou nombre d'entreprises inventé", () => {
    expect(text).not.toMatch(/★|étoiles|avis clients|\d+\s?%\s+de clients|\d{2,}\s+entreprises/i);
  });
});

describe("page test châssis", () => {
  const html = read("index.html");
  const text = visible(html);

  it("contient les mentions obligatoires", () => {
    expect(text).toContain("Gratuit pour vous");
    expect(text).toContain("Changez vos fenêtres sans courir après dix devis.");
    expect(text).toMatch(/entreprises partenaires vérifiées/);
    expect(text).toMatch(/ont changé le 1er octobre 2026 et peuvent encore évoluer/);
    expect(text).toContain("Prêt à comparer vos devis ?");
    expect(text).toContain("BCE BE 1032.720.495");
    expect(text).toContain("J'accepte que mes coordonnées soient transmises à 3 entreprises au maximum pour recevoir un devis");
  });

  it("suit exactement le parcours demandé", () => {
    for (const v of ["renovation", "nouvelle_construction", "extension", "1_3", "4_6", "7_10", "plus_10",
      "moins_5000", "5000_10000", "10000_20000", "plus_20000", "inconnu", "asap", "3_mois", "6_mois"]) {
      expect(html).toContain(`value="${v}"`);
    }
    expect(text).not.toMatch(/je me renseigne/i);
    expect(text).not.toMatch(/propriétaire|locataire/i);
    expect(html).toMatch(/autocomplete="one-time-code"/);
  });

  it("aucun lien sortant (page de publicité)", () => {
    expect(html).not.toMatch(/href="(https?:)?\/\//i);
    expect(html).not.toMatch(/fonts\.googleapis|googletagmanager|facebook/i);
  });

  it("aucun style ni script en ligne (CSP stricte)", () => {
    expect(html).not.toMatch(/\sstyle="/);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/\son[a-z]+="/);
  });
});

describe("couleurs : pas d'orange côté particulier", () => {
  const ORANGES = /#(d9772b|d6a060|b5732a|dc7f2e|f2a65a|f08a3c|a8501a|c8691f|f2a065|ff8c00|ffa500)\b|\borange\b/i;
  it.each([...CSS_PARTICULIER, ...SCRIPTS_PARTICULIER, ...PAGES_PARTICULIER])("%s", (f) => {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(ORANGES);
  });
  it("le logo x-pixel.png (pixel orange) n'est pas utilisé côté particulier", () => {
    for (const f of PAGES_PARTICULIER) expect(read(f)).not.toContain("x-pixel");
  });
});

describe("espace entreprise : non-exclusivité affichée", () => {
  const cgv = visible(read("pro/cgv.html"));
  it("CGV : 3 entreprises max, non exclusif, « 1 entreprise sur 3 »", () => {
    expect(cgv).toMatch(/trois entreprises au maximum/);
    expect(cgv).toMatch(/jamais exclusif/);
    expect(cgv).toContain("1 entreprise sur 3 a déjà débloqué");
    expect(cgv).toMatch(/Revente, cession, location ou partage interdits/);
  });
  it("le prix n'apparaît pas sur une page publique", () => {
    expect(cgv).not.toMatch(/\b35\s?€/);
  });
});
