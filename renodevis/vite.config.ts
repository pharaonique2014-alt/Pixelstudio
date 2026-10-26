import { defineConfig } from "vite";
import { resolve } from "node:path";
import { mockApi } from "./dev/mock-api.ts";
import { securityHeaders } from "./dev/security-headers.ts";

const page = (p: string) => resolve(import.meta.dirname, p);

export default defineConfig({
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
