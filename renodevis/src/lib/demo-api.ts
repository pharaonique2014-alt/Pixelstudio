// MODE TEST (build `npm run build:demo`) : serveur simulé DANS le navigateur.
// Aucune donnée ne quitte la page, aucun SMS n'est envoyé. Code SMS : 123456.
import type { ApiResult } from "./api";

const CODE = "123456";
const pending = new Map<string, number>();

export function showDemoBanner() {
  if (document.getElementById("demo-banner")) return;
  const b = document.createElement("div");
  b.id = "demo-banner";
  b.className = "demo-banner";
  b.setAttribute("role", "note");
  b.innerHTML = "<strong>Mode test</strong> · aucune donnée enregistrée, aucun SMS envoyé · code SMS : <strong>123456</strong> · numéro en <strong>00 00 00</strong> = doublon";
  document.body.prepend(b);
}

export async function demoPost(route: string, body: Record<string, any>): Promise<ApiResult> {
  await new Promise((r) => setTimeout(r, 450));
  const digits = String(body.phone ?? "").replace(/\D/g, "");
  switch (route) {
    case "submit": {
      if (digits.endsWith("000000")) return { status: 409, data: { ok: false, error: "duplicate" } };
      const id = crypto.randomUUID();
      pending.set(id, 0);
      return { status: 200, data: { ok: true, request_id: id, phone: "+32 4•• •• •• " + digits.slice(-2) } };
    }
    case "resend": return { status: 200, data: { ok: true } };
    case "verify": {
      if (!pending.has(body.request_id)) return { status: 404, data: { ok: false, error: "not_found" } };
      if (body.code !== CODE) {
        const n = pending.get(body.request_id)! + 1;
        pending.set(body.request_id, n);
        return n >= 5
          ? { status: 423, data: { ok: false, error: "locked" } }
          : { status: 400, data: { ok: false, error: "invalid_code", remaining: 5 - n } };
      }
      return { status: 200, data: { ok: true, ref: "RD-TEST" + String(Math.floor(Math.random() * 9000) + 1000) } };
    }
    case "erase-start": return { status: 200, data: { ok: true } };
    case "erase-confirm":
      return body.code === CODE
        ? { status: 200, data: { ok: true, erased: 1 } }
        : { status: 400, data: { ok: false, error: "invalid_code", remaining: 4 } };
    default: return { status: 204, data: {} };
  }
}
