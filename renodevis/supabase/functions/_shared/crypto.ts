// Hachage et tirage aléatoire (Web Crypto : identique sous Deno et Node 22).

const enc = new TextEncoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let k = keyCache.get(secret);
  if (!k) {
    k = crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    keyCache.set(secret, k);
  }
  return k;
}

/** HMAC-SHA256 en hexadécimal. Le poivre (secret serveur) empêche de retrouver
 *  un numéro ou une IP par force brute à partir de la base. */
export async function hmacHex(secret: string, message: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Code à 6 chiffres uniformément réparti (rejet des valeurs biaisées). */
export function randomOtp(): string {
  const buf = new Uint32Array(1);
  const limit = 4_294_000_000; // multiple de 1 000 000 sous 2^32
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}
