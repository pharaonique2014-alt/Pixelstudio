// API simulée pour le développement local et les tests navigateur.
// Utilisée seulement par `vite` / `vite preview` quand VITE_API_URL n'est pas
// défini. N'est JAMAIS incluse dans le build. Code SMS fixe : 123456.
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

const CODE = "123456";

export function mockApi(): Plugin {
  const pending = new Map<string, { attempts: number }>();
  const events: unknown[] = [];

  const handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith("/api/")) return next();
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const route = req.url!.slice(5).split("?")[0];
      const body = raw ? JSON.parse(raw) : {};
      const send = (status: number, data?: unknown) => {
        res.statusCode = status;
        res.setHeader("content-type", "application/json");
        res.end(data === undefined ? "" : JSON.stringify(data));
      };
      switch (route) {
        case "submit": {
          if (body.phone?.replace(/\D/g, "").endsWith("0000000")) return send(409, { ok: false, error: "duplicate" });
          const id = crypto.randomUUID();
          pending.set(id, { attempts: 0 });
          console.log(`[mock-api] SMS simulé : code ${CODE}`);
          return send(200, { ok: true, request_id: id, phone: "+32 4•• •• •• " + String(body.phone).replace(/\D/g, "").slice(-2) });
        }
        case "resend": return send(429, { ok: false, error: "too_soon" });
        case "verify": {
          const p = pending.get(body.request_id);
          if (!p) return send(404, { ok: false, error: "not_found" });
          if (body.code !== CODE) { p.attempts++; return send(400, { ok: false, error: "invalid_code", remaining: 5 - p.attempts }); }
          return send(200, { ok: true, ref: "RD-DEMO1234" });
        }
        case "track": events.push(body); return send(204);
        case "erase-start": return send(200, { ok: true });
        case "erase-confirm": return body.code === CODE ? send(200, { ok: true, erased: 1 }) : send(400, { ok: false, error: "invalid_code", remaining: 4 });
        case "__events": return send(200, events);
        default: return send(404, { ok: false, error: "not_found" });
      }
    });
  };

  return {
    name: "rd-mock-api",
    apply: (_config, env) => !process.env.VITE_API_URL && (env.command === "serve" || env.isPreview === true),
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}
