// Point d'entrée Deno (Supabase Edge Functions) de `public-api`.
// Déploiement : `supabase functions deploy public-api --no-verify-jwt`
// (l'API est publique ; la protection repose sur l'origine, le captcha et les limites).

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { createHandler } from "../_shared/handler.ts";
import { brevoEmail, brevoSms, turnstile } from "../_shared/providers.ts";

const env = (k: string, required = true): string => {
  const v = Deno.env.get(k) ?? "";
  if (required && !v) throw new Error(`Variable d'environnement manquante : ${k}`);
  return v;
};

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const handler = createHandler({
  rpc: async (fn, args) => {
    const { data, error } = await supabase.rpc(fn, { p: args });
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as Record<string, unknown>;
  },
  sendSms: brevoSms(env("BREVO_API_KEY"), env("SMS_SENDER", false) || "RenoDevis"),
  notifyAdmin: brevoEmail(env("BREVO_API_KEY"), env("EMAIL_FROM"), env("ADMIN_NOTIFY_EMAIL")),
  verifyCaptcha: turnstile(env("TURNSTILE_SECRET_KEY")),
  pepper: env("HASH_PEPPER"),
  allowedOrigins: env("ALLOWED_ORIGINS").split(",").map((s) => s.trim()).filter(Boolean),
  log: (msg, extra) => console.log(JSON.stringify({ msg, ...(extra as object) })),
});

Deno.serve(handler);
