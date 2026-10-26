// Construit la version « mode test » autonome (serveur simulé dans la page,
// code SMS 123456) : chaque page devient un seul fichier HTML, CSS, JS et
// polices intégrés. Sortie : dist-demo/site/.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const PAGES = [
  "index.html", "effacement.html",
  "legal/mentions-legales.html", "legal/confidentialite.html",
  "legal/conditions-utilisation.html", "legal/cookies.html",
];
const OUT = "dist-demo/site";

for (const p of PAGES) {
  execFileSync("npx", ["vite", "build", "--logLevel", "warn"], {
    stdio: "inherit", env: { ...process.env, VITE_DEMO: "1", VITE_API_URL: "", RD_DEMO_PAGE: p },
  });
  const dir = `dist-demo/${p.replace(/\W/g, "_")}`;
  let html = readFileSync(join(dir, p), "utf8");
  const local = (href) => readFileSync(join(dir, dirname(p), href), "utf8");

  // CSS et JS intégrés ; on retire les polices .woff (le .woff2 suffit)
  html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) =>
    `<style>${local(href).replace(/,\s*url\(data:font\/woff;base64,[^)]+\) format\("woff"\)/g, "")}</style>`);
  html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_, src) =>
    `<script type="module">${local(src).replace(/<\/script/gi, "<\\/script")}</script>`);
  html = html.replace(/<link rel="icon"[^>]*>\s*/g, "");
  // Images du dossier public/ intégrées en data: URI
  html = html.replace(/src="(?:\.\/|\/)([\w.-]+\.webp)"/g, (_, f) =>
    `src="data:image/webp;base64,${readFileSync(join("public", f)).toString("base64")}"`);

  // Liens internes absolus → relatifs à la page
  const up = "../".repeat(p.split("/").length - 1);
  html = html.replace(/href="\/(?!\/)([^"]*)"/g, (_, rest) => `href="${up || "./"}${rest}"`);

  if (p === "index.html") {
    // Page principale : le contenu seul (l'hébergeur ajoute doctype/html/head/body)
    html = html.replace(/<title>[^<]*<\/title>/, "<title>RénoDevis mode test</title>");
    const head = html.match(/<head>([\s\S]*)<\/head>/)[1]
      .replace(/<meta charset[^>]*>\s*/, "").replace(/<meta name="viewport"[^>]*>\s*/, "");
    const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
    html = head.trim() + "\n" + body.trim() + "\n";
  }
  const target = join(OUT, p);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  console.log(`✔ ${target} (${Math.round(html.length / 1024)} Ko)`);
}
console.log(readdirSync(OUT));
