// Fournisseurs externes : SMS + e-mail (Brevo, France/UE) et captcha (Cloudflare Turnstile).
// Aucune clé ici : tout vient des variables d'environnement de la fonction.

export type SmsSender = (toE164: string, text: string) => Promise<boolean>;
export type EmailSender = (subject: string, text: string) => Promise<boolean>;
export type CaptchaVerifier = (token: string, ip: string) => Promise<boolean>;

const BREVO = "https://api.brevo.com/v3";

/** SMS transactionnel Brevo. [À VÉRIFIER au branchement] expéditeur
 *  alphanumérique (11 caractères max) autorisé pour la Belgique. */
export function brevoSms(apiKey: string, sender: string): SmsSender {
  return async (to, text) => {
    const res = await fetch(`${BREVO}/transactionalSMS/sms`, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        type: "transactional",
        sender: sender.slice(0, 11),
        recipient: to.replace(/^\+/, ""),
        content: text,
      }),
    });
    return res.ok;
  };
}

export function brevoEmail(apiKey: string, from: string, to: string): EmailSender {
  return async (subject, text) => {
    const res = await fetch(`${BREVO}/smtp/email`, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "RénoDevis", email: from },
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });
    return res.ok;
  };
}

export function turnstile(secret: string): CaptchaVerifier {
  return async (token, ip) => {
    if (!token) return false;
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  };
}
