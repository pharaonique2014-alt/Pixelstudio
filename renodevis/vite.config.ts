import { defineConfig } from "vite";
import { resolve } from "node:path";
import { mockApi } from "./dev/mock-api.ts";
import { securityHeaders } from "./dev/security-headers.ts";

const page = (p: string) => resolve(import.meta.dirname, p);

// Build « mode test » : une page à la fois, tout intégré dans le HTML
// (voir tools/build-demo.mjs). Jamais utilisé pour la vraie mise en ligne.
const demoPage = process.env.RD_DEMO_PAGE;

export default defineConfig(demoPage ? {
  base: "./",
  build: {
    outDir: `dist-demo/${demoPage.replace(/\W/g, "_")}`,
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { input: page(demoPage), output: { codeSplitting: false } },
  },
} : {
  plugins: [mockApi()],
  // HSTS / upgrade-insecure-requests sans effet en http://localhost
  preview: { headers: securityHeaders() },
  build: {
    target: "es2022",
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        index: page("index.html"),
        effacement: page("effacement.html"),
        mentions: page("legal/mentions-legales.html"),
        confidentialite: page("legal/confidentialite.html"),
        conditions: page("legal/conditions-utilisation.html"),
        cookies: page("legal/cookies.html"),
        cgv: page("pro/cgv.html"),
      },
    },
  },
});
