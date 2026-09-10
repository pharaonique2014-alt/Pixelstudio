const MOLLIE_KEY   = Deno.env.get("MOLLIE_API_KEY") ?? "";
const BREVO_KEY    = Deno.env.get("BREVO_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SITE_URL     = Deno.env.get("SITE_URL") ?? "https://pxlstudio.be";

const SHOP_EMAIL = "projets@pxlstudio.be";
const SHOP_NAME  = "Pixel Studio";
const IBAN       = "BE52 7320 8533 6409";
const BANK       = "CBC";
const BCE        = "BE 1032.720.495";

const ALLOWED = ["https://pxlstudio.be", "https://www.pxlstudio.be"];
const cors = {
  "Access-Control-Allow-Origin": ALLOWED[0],
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function authUser(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch {
    return null;
  }
}

const sendLog = new Map<string, number[]>();
function rateOk(key: string, max = 8, windowMs = 3600000) {
  const now = Date.now();
  const arr = (sendLog.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  sendLog.set(key, arr);
  return true;
}

const HANDLING = 2;

// Codes promo connus. newCustomerOnly = le compte authentifie (payer.id) ne doit
// avoir aucune commande existante dans `orders` — verifie server-side, jamais
// deduit d'un champ envoye par le client.
const PROMO_CODES: Record<string, { percent: number; newCustomerOnly: boolean }> = {
  NEW10: { percent: 10, newCustomerOnly: true },
};

type OptChoice = { n: string; p: number; d: number };
type OptGroup = { k: string; l: string; c: OptChoice[] };
type Product = {
  id: string;
  name: string;
  active: boolean;
  design: boolean;
  sup_days: number;
  price_grid: Record<string, number>;
  opts: OptGroup[];
  // Renseignés uniquement pour les produits catalogués chez FLYERALARM (voir
  // resolveFlyeralarmRef) — absents/null pour les produits "internal".
  supplier?: string;
  supplier_ref?: {
    quantity_ids?: Record<string, number | string>;
    base_variant_id?: number | string;
    option_variant_ids?: Record<string, number | string>;
    // Frais de port fixes hors-gabarit (ex. fret pour un stand), affichés/facturés
    // à part — voir resolveItem(). Absent pour tous les produits standards.
    shipping_flat?: number;
  } | null;
};

const SHIPPING: Record<string, { price: number; free: number; extraDays: number }> = {
  BE: { price: 5.95, free: 49, extraDays: 0 },
  NL: { price: 7.95, free: 75, extraDays: 1 },
  LU: { price: 7.95, free: 75, extraDays: 1 },
};
const VAT = 0.21;
// Marge provisoire appliquee aux prix stockes (base + options), en attendant un vrai
// cout fournisseur (Helloprint Connect ou autre). Sert uniquement a afficher un
// cout/marge indicatifs cote atelier — jamais montre au client.
const MARKUP = 1.25;
const euro = (n: number) => Number(n || 0).toFixed(2).replace(".", ",") + " €";
const esc = (s: unknown) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const STATUS: Record<string, string> = {
  paid: "Payée — en pré-presse",
  failed: "Paiement échoué",
  canceled: "Paiement annulé",
  expired: "Paiement expiré",
  open: "En attente de paiement",
  pending: "Paiement en cours",
};
const PENDING_STATUS = "En attente de paiement";

const db = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

// Référence de commande / communication de virement — générée exclusivement côté
// serveur (jamais acceptée depuis le client) et vérifiée unique en base avant usage.
// `orders.ref` porte désormais une contrainte UNIQUE : si deux commandes partageaient
// la même référence, le webhook Mollie qui fait `orders?ref=eq.X` sans distinguer les
// doublons pouvait faire passer par erreur — ou par abus délibéré — une commande non
// payée au statut "payée" en même temps qu'une autre.
function genRef(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `PX-${n}`;
}
async function uniqueRef(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = genRef();
    const r = await db(`orders?ref=eq.${encodeURIComponent(candidate)}&select=id&limit=1`);
    const rows = r.ok ? await r.json() : [];
    if (!Array.isArray(rows) || rows.length === 0) return candidate;
  }
  return `PX-${Date.now().toString().slice(-6)}`;
}

// --- Product pricing: single source of truth, read from the `products` table
// (service_role only — never exposed to anon/authenticated via PostgREST). ---
async function getProduct(pid: string): Promise<Product | null> {
  const r = await db(`products?id=eq.${encodeURIComponent(pid)}&select=*`);
  if (!r.ok) return null;
  const rows = await r.json();
  return rows?.[0] ?? null;
}

function computeItemPrice(p: Product, qty: number, sel: Record<string, number>): number | null {
  const base = p.price_grid[String(qty)];
  if (base === undefined) return null;
  let mult = 1;
  for (const o of p.opts || []) {
    const idx = Number(sel?.[o.k] ?? 0);
    const c = o.c[idx];
    if (!c) return null;
    mult *= 1 + (c.p || 0);
  }
  return Math.round(base * mult * 100) / 100;
}

function computeItemDays(p: Product, sel: Record<string, number>, extraDays: number): number {
  let d = p.sup_days + HANDLING + extraDays;
  if (p.design) d += 2;
  for (const o of p.opts || []) {
    const idx = Number(sel?.[o.k] ?? 0);
    const c = o.c[idx];
    if (c && c.d) d += c.d;
  }
  return Math.max(2, d);
}

// --- Option "Création de design" cochée sur un produit imprimé -------------------
// Le tarif du supplément n'est PAS redéfini ici : il est lu sur les produits
// `design-r` / `design-rv` du catalogue, qui restent la seule source de vérité.
// Changer le prix de la création se fait donc à un seul endroit (la table
// `products`), et le supplément suit automatiquement.
const DESIGN_PID: Record<1 | 2, string> = { 1: "design-r", 2: "design-rv" };
// Délai annoncé au client pour un article dont nous créons le visuel. Valeur fixe
// qui remplace le calcul habituel sup_days + HANDLING (+ pays). 5 jours ouvrables =
// les 48 h de BAT promises sur les fiches design-r / design-rv, puis l'impression et
// la livraison — c'est ce qui rend les deux promesses cohérentes entre elles.
const DESIGN_DAYS = 5;
const designPriceCache = new Map<string, { price: number; at: number }>();
async function designSupplement(faces: 1 | 2): Promise<number | null> {
  const pid = DESIGN_PID[faces];
  const hit = designPriceCache.get(pid);
  if (hit && Date.now() - hit.at < 300000) return hit.price;
  const p = await getProduct(pid);
  if (!p || !p.active) return null;
  const price = computeItemPrice(p, 1, {});
  if (price === null) return null;
  designPriceCache.set(pid, { price, at: Date.now() });
  return price;
}
// Supplément "créez-le pour moi" pour les stands (fournisseur excelexpo) : un
// forfait unique, quel que soit le modèle de stand — sans rapport avec le
// recto/recto-verso des produits imprimés classiques. Lu sur `design-stand`,
// jamais un montant écrit ici, pour rester modifiable à un seul endroit.
const STAND_DESIGN_PID = "design-stand";
async function standDesignSupplement(): Promise<number | null> {
  const hit = designPriceCache.get(STAND_DESIGN_PID);
  if (hit && Date.now() - hit.at < 300000) return hit.price;
  const p = await getProduct(STAND_DESIGN_PID);
  if (!p || !p.active) return null;
  const price = computeItemPrice(p, 1, {});
  if (price === null) return null;
  designPriceCache.set(STAND_DESIGN_PID, { price, at: Date.now() });
  return price;
}
// Recto seul ou recto/verso : déduit du produit et de la sélection reçue, jamais
// d'un champ déclaratif du client (sinon un recto/verso serait facturé au tarif
// recto). Même règle que l'interface : l'option `sides` dont le libellé mentionne
// "verso".
function facesOf(p: Product, sel: Record<string, number>): 1 | 2 {
  for (const o of p.opts || []) {
    if (o.k !== "sides") continue;
    const c = o.c[Number(sel?.[o.k] ?? 0)];
    if (c && /verso/i.test(String(c.n ?? ""))) return 2;
  }
  return 1;
}

// Résolution complète d'une ligne : produit + prix + délai, supplément design
// compris. C'est le seul chemin utilisé par l'action `price`, l'action `promo`,
// la création de paiement et les relances — pour qu'aucun d'eux ne puisse
// diverger d'un autre.
type ResolvedItem = { prod: Product; base: number; designAdd: number; price: number; days: number; shipFlat: number };
async function resolveItem(it: any, extraDays: number): Promise<ResolvedItem | { error: string }> {
  const prod = await getProduct(String(it?.pid ?? ""));
  if (!prod || !prod.active) return { error: "Produit inconnu : " + it?.pid };
  const sel = it?.sel || {};
  const base = computeItemPrice(prod, Number(it?.qty), sel);
  if (base === null) return { error: "Configuration invalide pour : " + it?.pid };
  let price = base;
  let days = computeItemDays(prod, sel, extraDays);
  let designAdd = 0;
  // `prod.design` = le produit EST une prestation de création (design-r/rv) : le
  // supplément n'a alors aucun sens et est ignoré.
  if (it?.designAdd && !prod.design) {
    const sup = prod.supplier === "excelexpo"
      ? await standDesignSupplement()
      : await designSupplement(facesOf(prod, sel));
    if (sup === null) return { error: "Service de création de design indisponible" };
    // Forfaitaire : jamais multiplié par la quantité, comme design-r/design-rv
    // dont la grille tarifaire est verrouillée sur qty = 1.
    designAdd = sup;
    price = Math.round((base + sup) * 100) / 100;
    days = DESIGN_DAYS;
  }
  // Frais de port fixes propres à certains produits hors-gabarit (ex. stands
  // sourcés chez un fournisseur tiers, palette/fret plutôt que colis standard).
  // Toujours affichés/facturés à part, jamais fondus dans le prix produit —
  // voir supplier_ref.shipping_flat. N'a rien à voir avec la grille SHIPPING
  // par pays (petits colis), qui continue de s'appliquer en plus si due.
  const shipFlat = Number(prod.supplier_ref?.shipping_flat) || 0;
  return { prod, base, designAdd, price, days, shipFlat };
}

// --- Pré-vérification du fichier d'impression chez FLYERALARM -------------------
// Avant paiement, on peut faire vérifier le fichier du client par le VRAI moteur
// de contrôle de FLYERALARM (format, nombre de pages, résolution…) plutôt que de
// se fier uniquement à nos propres heuristiques. Ça exige un identifiant FLYERALARM
// réel (quantity_id ou variant_id) pour la configuration choisie — qu'on n'a que
// pour une partie des combinaisons possibles (voir resolveFlyeralarmRef).
//
// Toutes les correspondances FLYERALARM (products.supplier_ref) ont été relevées
// avec la clé BE : on utilise systématiquement cette clé ici, quel que soit le
// pays de livraison choisi par le client — les identifiants catalogue sont
// partagés entre pays, seuls les prix/délais varient, et on ne s'en sert pas ici.
const FLYERALARM_API_BASE = "https://rest.flyeralarm-esolutions.com";
const FLYERALARM_KEY_BE = Deno.env.get("FLYERALARM_API_KEY_BE") ?? "";

type FaRef = { quantity_id: string } | { variant_id: string; amount: number };

// Ne renvoie un identifiant que dans les cas où on est CERTAIN qu'il correspond à
// la configuration choisie : soit la config par défaut (0 option modifiée), pour
// laquelle le quantity_id exact a été relevé pour chaque palier de quantité, soit
// un seul écart par rapport au défaut, pour lequel on a le variant_id de CETTE
// option précise. Au-delà (plusieurs options modifiées simultanément), on ne
// connaît aucun variant_id combiné fiable — mieux vaut ne pas vérifier que de
// vérifier la mauvaise configuration.
function resolveFlyeralarmRef(prod: Product, sel: Record<string, number>, qty: number): FaRef | null {
  const ref = prod.supplier_ref;
  if (prod.supplier !== "flyeralarm" || !ref) return null;

  const changed: string[] = [];
  for (const o of prod.opts || []) {
    const idx = Number(sel?.[o.k] ?? 0);
    if (idx !== 0) {
      const c = o.c[idx];
      if (!c) return null; // sélection incohérente, on ne devine pas
      changed.push(c.n);
    }
  }

  if (changed.length === 0) {
    const qid = ref.quantity_ids?.[String(qty)];
    if (qid != null) return { quantity_id: String(qid) };
    if (ref.base_variant_id != null) return { variant_id: String(ref.base_variant_id), amount: qty };
    return null;
  }
  if (changed.length === 1) {
    const vid = ref.option_variant_ids?.[changed[0]];
    if (vid != null) return { variant_id: String(vid), amount: qty };
    return null;
  }
  return null; // 2+ options modifiées à la fois : pas de variant combiné connu
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(String(dataUrl ?? ""));
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, mime: m[1] };
  } catch {
    return null;
  }
}

// Dépôt temporaire dans le même bucket privé que les fichiers de commande, sous
// un préfixe dédié — pour obtenir une URL signée que FLYERALARM peut aller
// chercher. Le client n'est pas forcément connecté à ce stade (la vérification a
// lieu avant le paiement/la connexion), donc l'upload passe en service_role,
// jamais par le chemin client habituel (qui exige un user_id).
async function uploadPrecheckFile(bytes: Uint8Array, mime: string, fileName: string): Promise<string | null> {
  const safe = String(fileName || "fichier").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const path = `precheck/${crypto.randomUUID()}/${safe}`;
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/fichiers/${path}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": mime || "application/octet-stream",
    },
    body: bytes,
  });
  if (!up.ok) return null;
  const sign = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/fichiers/${path}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!sign.ok) return null;
  const signed = await sign.json();
  const signedUrl = signed?.signedURL;
  if (!signedUrl) return null;
  return `${SUPABASE_URL}/storage/v1${signedUrl}`;
}

// --- Localisation des e-mails client (pas les e-mails atelier, qui restent en
// français — usage interne). La langue vient de la préférence de compte
// enregistrée à la création (auth user_metadata.lang), capturée dans
// order.data.lang au moment de la commande pour rester disponible plus tard
// (webhook Mollie asynchrone, renvoi manuel) sans nouvelle consultation du compte.
type Lang = "fr" | "en" | "nl";
function pickLang(v: unknown): Lang {
  return v === "en" || v === "nl" ? v : "fr";
}
const EMAIL_TXT: Record<string, Record<Lang, string>> = {
  badgePaid:      { fr: "Paiement confirmé",       en: "Payment confirmed",        nl: "Betaling bevestigd" },
  badgeRegistered:{ fr: "Commande enregistrée",    en: "Order registered",         nl: "Bestelling geregistreerd" },
  badgeReceived:  { fr: "Commande reçue",          en: "Order received",           nl: "Bestelling ontvangen" },
  thanks:         { fr: "Merci",                   en: "Thank you",                nl: "Bedankt" },
  bodyPaid: {
    fr: "Votre paiement a bien été reçu. Vos fichiers partent en pré-presse et votre commande entre en production.",
    en: "Your payment has been received. Your files are being sent to prepress and your order is now in production.",
    nl: "Uw betaling is ontvangen. Uw bestanden gaan naar de prepress en uw bestelling gaat in productie.",
  },
  bodyVirPending: {
    fr: "Votre commande est enregistrée. Il ne reste qu'à effectuer le virement pour lancer la production.",
    en: "Your order is registered. Simply complete the bank transfer to start production.",
    nl: "Uw bestelling is geregistreerd. Voer de overschrijving uit om de productie te starten.",
  },
  bodyOtherPending: {
    fr: "Nous avons bien reçu votre commande. Vous recevrez une confirmation dès validation du paiement.",
    en: "We have received your order. You will receive a confirmation as soon as payment is validated.",
    nl: "We hebben uw bestelling ontvangen. U ontvangt een bevestiging zodra de betaling is gevalideerd.",
  },
  orderLabel:  { fr: "Commande",       en: "Order",             nl: "Bestelling" },
  totalVat:    { fr: "Total TVAC",     en: "Total incl. VAT",   nl: "Totaal incl. btw" },
  discount:    { fr: "Réduction",      en: "Discount",          nl: "Korting" },
  bankTitle:   { fr: "Paiement par virement", en: "Bank transfer payment", nl: "Betaling per overschrijving" },
  amount:      { fr: "Montant",        en: "Amount",            nl: "Bedrag" },
  bank:        { fr: "Banque",         en: "Bank",              nl: "Bank" },
  beneficiary: { fr: "Bénéficiaire",   en: "Beneficiary",       nl: "Begunstigde" },
  communication:{ fr: "Communication", en: "Payment reference", nl: "Mededeling" },
  deliveryTitle:{ fr: "Livraison",     en: "Delivery",          nl: "Levering" },
  deliverySpecific:{ fr: "— adresse spécifique", en: "— specific address", nl: "— specifiek adres" },
  note:        { fr: "Remarque",       en: "Note",              nl: "Opmerking" },
  estDelivery: { fr: "Livraison estimée",  en: "Estimated delivery", nl: "Geschatte levering" },
  trackBtn:    { fr: "Suivre ma commande", en: "Track my order",    nl: "Mijn bestelling volgen" },
  trackPara: {
    fr: "Connectez-vous à votre espace client pour suivre l'avancement de votre impression, étape par étape.",
    en: "Log in to your customer area to track your print job step by step.",
    nl: "Log in op uw klantenzone om de voortgang van uw afdruk stap voor stap te volgen.",
  },
  legalNotice: {
    fr: "Vos fichiers sont imprimés tels quels, sans retouche. Conformément à l'article VI.53, 3° du Code de droit économique, les produits personnalisés ne bénéficient pas du droit de rétractation.",
    en: "Your files are printed as submitted, without retouching. In accordance with Belgian consumer law (Code of Economic Law, Art. VI.53, 3°), personalized products are not eligible for the right of withdrawal.",
    nl: "Uw bestanden worden ongewijzigd afgedrukt. Overeenkomstig artikel VI.53, 3° van het Belgisch Wetboek van economisch recht hebben gepersonaliseerde producten geen herroepingsrecht.",
  },
  signoff: {
    fr: "Une question ? Répondez simplement à cet e-mail.<br><br>À très vite,<br><b style=\"color:#edeae5\">Logan — Pixel Studio</b>",
    en: "Any questions? Just reply to this email.<br><br>Talk soon,<br><b style=\"color:#edeae5\">Logan — Pixel Studio</b>",
    nl: "Vragen? Antwoord gewoon op deze e-mail.<br><br>Tot snel,<br><b style=\"color:#edeae5\">Logan — Pixel Studio</b>",
  },
  subjectPaid:    { fr: "Paiement confirmé — commande", en: "Payment confirmed — order", nl: "Betaling bevestigd — bestelling" },
  subjectPending: { fr: "Votre commande",  en: "Your order",  nl: "Uw bestelling" },

  // --- Relance 48 h : commande enregistrée mais toujours pas payée ---
  badgeUnpaid:  { fr: "Paiement en attente", en: "Payment pending", nl: "Betaling in afwachting" },
  unpaidTitle:  { fr: "Il ne manque que le paiement", en: "Only the payment is missing", nl: "Alleen de betaling ontbreekt nog" },
  unpaidBodyVir: {
    fr: "Votre commande est bien enregistrée chez nous, mais nous n'avons pas encore reçu le virement. Dès qu'il arrive, la production démarre.",
    en: "Your order is registered with us, but we have not received your bank transfer yet. Production starts as soon as it arrives.",
    nl: "Uw bestelling staat bij ons geregistreerd, maar we hebben uw overschrijving nog niet ontvangen. Zodra die binnen is, start de productie.",
  },
  unpaidBodyLink: {
    fr: "Votre commande est bien enregistrée chez nous, mais le paiement n'a pas abouti. Votre lien de paiement initial a expiré — en voici un nouveau, valable dès maintenant.",
    en: "Your order is registered with us, but the payment did not go through. Your original payment link has expired — here is a fresh one, valid right now.",
    nl: "Uw bestelling staat bij ons geregistreerd, maar de betaling is niet afgerond. Uw oorspronkelijke betaallink is verlopen — hier is een nieuwe, nu geldig.",
  },
  unpaidPayBtn: { fr: "Payer ma commande", en: "Pay my order", nl: "Mijn bestelling betalen" },
  unpaidHelp: {
    fr: "Vous avez changé d'avis ou vous avez une question sur cette commande ? Répondez simplement à cet e-mail, nous nous en occupons.",
    en: "Changed your mind, or have a question about this order? Just reply to this email and we will take care of it.",
    nl: "Van gedachten veranderd of een vraag over deze bestelling? Antwoord gewoon op deze e-mail, wij regelen het.",
  },
  unpaidSubject: { fr: "Votre commande n'attend que le paiement —", en: "Your order is only waiting for payment —", nl: "Uw bestelling wacht alleen nog op betaling —" },

  // --- Relance 24 h : panier laissé en plan ---
  badgeCart:  { fr: "Panier en attente", en: "Cart waiting", nl: "Winkelmand in afwachting" },
  cartTitle:  { fr: "Votre panier vous attend", en: "Your cart is waiting", nl: "Uw winkelmand wacht op u" },
  cartBody: {
    fr: "Vous avez laissé des articles dans votre panier. Ils y sont toujours — votre configuration et vos fichiers sont conservés.",
    en: "You left items in your cart. They are still there — your configuration and your files are saved.",
    nl: "U hebt artikelen in uw winkelmand achtergelaten. Ze staan er nog — uw configuratie en bestanden zijn bewaard.",
  },
  cartLabel:  { fr: "Votre panier", en: "Your cart", nl: "Uw winkelmand" },
  cartSubtotal:{ fr: "Sous-total HTVA", en: "Subtotal excl. VAT", nl: "Subtotaal excl. btw" },
  cartBtn:    { fr: "Reprendre ma commande", en: "Resume my order", nl: "Mijn bestelling hervatten" },
  cartPriceNote: {
    fr: "Les prix ci-dessus sont ceux d'aujourd'hui, hors TVA et hors livraison.",
    en: "The prices above are today's prices, excluding VAT and delivery.",
    nl: "Bovenstaande prijzen zijn de prijzen van vandaag, exclusief btw en levering.",
  },
  cartSubject: { fr: "Vous avez laissé quelque chose dans votre panier", en: "You left something in your cart", nl: "U hebt iets in uw winkelmand laten staan" },
};
function t(key: string, lang: Lang): string {
  return EMAIL_TXT[key]?.[lang] ?? EMAIL_TXT[key]?.fr ?? "";
}
const BANK_NOTE: Record<Lang, (ref: string) => string> = {
  fr: (ref) => `Indiquez bien <b style="color:#d6a060">${ref}</b> en communication. La production démarre dès réception du paiement.`,
  en: (ref) => `Please make sure to include <b style="color:#d6a060">${ref}</b> as the payment reference. Production starts as soon as payment is received.`,
  nl: (ref) => `Vermeld zeker <b style="color:#d6a060">${ref}</b> als mededeling. De productie start zodra de betaling ontvangen is.`,
};

function wrap(title: string, body: string, preheader = "") {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#0b0a08;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<span style="display:none;font-size:1px;color:#0b0a08">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0a08;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
  style="max-width:580px;background:#131110;border:1px solid rgba(255,255,255,.10);border-radius:16px;overflow:hidden">
  <tr><td style="padding:32px 34px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,.08)">
    <div style="font-family:Georgia,serif;font-size:19px;letter-spacing:6px;text-transform:uppercase;color:#edeae5">
      <span style="color:#d6a060">PIXEL</span> <span style="color:#dc7f2e">S</span><span style="color:#d9a23b">T</span><span style="color:#9c9077">U</span><span style="color:#6b7f8c">D</span><span style="color:#46687d">I</span><span style="color:#2c5f82">O</span></div>
  </td></tr>
  <tr><td style="padding:32px 34px">${body}</td></tr>
  <tr><td style="padding:22px 34px 30px;border-top:1px solid rgba(255,255,255,.08);text-align:center">
    <div style="font-size:11.5px;color:rgba(228,225,220,.55);line-height:1.9">
      <b style="color:#d6a060">PIXEL STUDIO</b><br>
      Photographie · Print · Site web · Drone 4K · Marketing digital<br>
      BCE ${BCE} · <a href="${SITE_URL}" style="color:#d6a060;text-decoration:none">pxlstudio.be</a><br>
      <a href="mailto:${SHOP_EMAIL}" style="color:#d6a060;text-decoration:none">${SHOP_EMAIL}</a>
    </div>
  </td></tr>
</table></td></tr></table></body></html>`;
}

function h1(t: string) {
  return `<h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:23px;font-weight:normal;color:#edeae5">${esc(t)}</h1>`;
}
function p(t: string, c = "rgba(228,225,220,.72)") {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.75;color:${c}">${t}</p>`;
}
function badge(t: string) {
  return `<div style="display:inline-block;background:rgba(217,119,43,.13);border:1px solid rgba(214,160,96,.45);color:#d6a060;border-radius:999px;padding:6px 16px;font-size:11px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:18px">${esc(t)}</div>`;
}
function button(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0">
    <tr><td style="background:#d9772b;border-radius:26px">
      <a href="${href}" style="display:inline-block;padding:14px 32px;color:#111;font-size:12px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;text-decoration:none">${esc(label)}</a>
    </td></tr></table>`;
}

function cropLabel(pos: any): string {
  if (!pos) return "";
  const x = Math.round(pos.x ?? 50), y = Math.round(pos.y ?? 50), z = Math.round((pos.zoom || 1) * 100);
  return `décalage ${x}%/${y}%, zoom ${z}%`;
}

// N'accepte comme lien de fichier "atelier" qu'une URL de téléchargement signée
// pointant réellement vers le bucket privé `fichiers` de ce projet Supabase. Sans ce
// filtre, un client authentifié (via une commande manipulée ou l'action `emails`)
// pouvait glisser n'importe quelle URL externe dans l'e-mail que l'atelier reçoit et
// ouvre en confiance pour récupérer les fichiers à imprimer — un vecteur direct de
// phishing/malware contre l'équipe. Toute URL hors de ce préfixe est simplement omise.
const SAFE_FILE_PREFIX = `${SUPABASE_URL}/storage/v1/object/sign/fichiers/`;
function safeFileLink(url: unknown): string | null {
  const u = String(url ?? "");
  return SAFE_FILE_PREFIX && u.startsWith(SAFE_FILE_PREFIX) ? u : null;
}

function itemsTable(order: any, showMargin = false, lang: Lang = "fr") {
  let marginTotal = 0;
  const rows = (order.items || []).map((it: any) => {
    const crop: string[] = [];
    if (it.posR) crop.push("Recto — " + cropLabel(it.posR));
    if (it.posV) crop.push("Verso — " + cropLabel(it.posV));
    const cropLine = crop.length
      ? `<div style="color:rgba(228,225,220,.5);font-size:11px;margin-top:3px">🎯 Cadrage client : ${crop.map(esc).join(" · ")}</div>`
      : "";
    // Article dont NOUS créons le visuel : ni fichier ni cadrage à vérifier, mais un
    // brief à lire. On le signale explicitement pour que l'atelier ne le prenne pas
    // pour une commande sans fichier.
    const designLine = it.designAdd
      ? `<div style="color:#d6a060;font-size:11px;margin-top:3px">✎ Création de design demandée${it.designAddPrice ? " (" + euro(it.designAddPrice) + ")" : ""}${it.brief ? " — brief : " + esc(String(it.brief).slice(0, 300)) : ""}</div>`
      : "";
    const confirmLine = it.designAdd
      ? ""
      : it.fileConfirmed
        ? `<div style="color:#6fcf97;font-size:11px;margin-top:3px">✔ Fichier vérifié par le client${it.fileConfirmedAt ? " le " + esc(new Date(it.fileConfirmedAt).toLocaleString("fr-BE")) : ""}</div>`
        : (it.fileR ? `<div style="color:#ff6b81;font-size:11px;margin-top:3px">⚠ Non confirmé par le client</div>` : "");
    let marginLine = "";
    if (showMargin && typeof it.price === "number") {
      const cost = Math.round((it.price / MARKUP) * 100) / 100;
      const margin = Math.round((it.price - cost) * 100) / 100;
      marginTotal += margin;
      marginLine = `<div style="color:#8fd0ff;font-size:11px;margin-top:3px">Coût provisoire : ${euro(cost)} · Marge : ${euro(margin)}</div>`;
    }
    return `
    <tr>
      <td style="padding:13px 0;border-bottom:1px solid rgba(255,255,255,.07)">
        <div style="color:#edeae5;font-size:14px;font-weight:bold">${esc(it.name)}</div>
        <div style="color:rgba(228,225,220,.6);font-size:12.5px;margin-top:3px">${esc(it.conf)}</div>
        <div style="color:rgba(228,225,220,.45);font-size:11.5px;margin-top:3px">
          ${esc(it.fileR || "")}${it.fileV ? " + " + esc(it.fileV) : ""}</div>
        ${cropLine}
        ${designLine}
        ${confirmLine}
        ${marginLine}
      </td>
      <td align="right" style="padding:13px 0;border-bottom:1px solid rgba(255,255,255,.07);color:#d6a060;font-size:14px;font-weight:bold;white-space:nowrap;vertical-align:top">
        ${euro(it.price)}</td>
    </tr>`;
  }).join("");
  const marginRow = showMargin
    ? `<tr>
      <td style="padding:4px 0 14px;color:#8fd0ff;font-size:12.5px">Marge totale (provisoire, avant vrai coût fournisseur)</td>
      <td align="right" style="padding:4px 0 14px;color:#8fd0ff;font-size:13px;font-weight:bold">${euro(marginTotal)}</td>
    </tr>`
    : "";
  const promoRow = order.promo && typeof order.promo.discount === "number" && order.promo.discount > 0
    ? `<tr>
      <td style="padding:4px 0;color:#6fcf97;font-size:12.5px">${t("discount", lang)} -${esc(order.promo.percent)}% (code ${esc(order.promo.code)})</td>
      <td align="right" style="padding:4px 0;color:#6fcf97;font-size:13px;font-weight:bold">-${euro(order.promo.discount)}</td>
    </tr>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:6px 18px;margin:20px 0">
    <tr><td colspan="2" style="padding:14px 0 4px;font-size:10.5px;letter-spacing:2.4px;text-transform:uppercase;color:#d9772b;font-weight:bold">
      ${t("orderLabel", lang)} ${esc(order.ref)}</td></tr>
    ${rows}
    ${promoRow}
    <tr>
      <td style="padding:16px 0 14px;color:#edeae5;font-size:15px;font-weight:bold">${t("totalVat", lang)}</td>
      <td align="right" style="padding:16px 0 14px;color:#d6a060;font-size:20px;font-weight:bold">${euro(order.total)}</td>
    </tr>
    ${marginRow}
  </table>`;
}

function bankBlock(order: any, lang: Lang = "fr") {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background:rgba(217,119,43,.07);border:1px solid rgba(214,160,96,.35);border-radius:12px;margin:20px 0">
    <tr><td style="padding:20px 22px">
      <div style="font-size:10.5px;letter-spacing:2.4px;text-transform:uppercase;color:#d9772b;font-weight:bold;margin-bottom:14px">
        ${t("bankTitle", lang)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13.5px;color:rgba(228,225,220,.72)">
        <tr><td style="padding:5px 0">${t("amount", lang)}</td><td align="right" style="color:#d6a060;font-weight:bold">${euro(order.total)}</td></tr>
        <tr><td style="padding:5px 0">${t("bank", lang)}</td><td align="right" style="color:#edeae5">${BANK}</td></tr>
        <tr><td style="padding:5px 0">IBAN</td><td align="right" style="color:#edeae5;font-weight:bold">${IBAN}</td></tr>
        <tr><td style="padding:5px 0">${t("beneficiary", lang)}</td><td align="right" style="color:#edeae5">Pixel Studio</td></tr>
        <tr><td style="padding:5px 0">${t("communication", lang)}</td><td align="right" style="color:#d6a060;font-weight:bold">${esc(order.ref)}</td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:12px;color:rgba(228,225,220,.6);line-height:1.7">
        ${BANK_NOTE[lang](esc(order.ref))}</p>
    </td></tr></table>`;
}

function addressBlock(order: any, cust: any, lang: Lang = "fr") {
  const sp = order.ship;
  const who = sp
    ? `${esc(sp.name)}${sp.company ? " — " + esc(sp.company) : ""}<br>
       ${esc(sp.street)} ${esc(sp.num)}<br>
       ${esc(sp.zip)} ${esc(sp.city)} · ${esc(sp.country || order.country || "Belgique")}`
    : `${esc(cust.first)} ${esc(cust.last)}${cust.company ? " — " + esc(cust.company) : ""}<br>
       ${esc(cust.street)} ${esc(cust.num)}<br>
       ${esc(cust.zip)} ${esc(cust.city)} · ${esc(order.country || "Belgique")}`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;margin:20px 0">
    <tr><td style="padding:18px 22px">
      <div style="font-size:10.5px;letter-spacing:2.4px;text-transform:uppercase;color:#d9772b;font-weight:bold;margin-bottom:10px">
        ${t("deliveryTitle", lang)}${sp ? " " + t("deliverySpecific", lang) : ""}</div>
      <div style="font-size:13.5px;color:rgba(228,225,220,.75);line-height:1.85">${who}
        ${cust.notes ? `<br><span style="color:rgba(228,225,220,.55)">${t("note", lang)} : ${esc(cust.notes)}</span>` : ""}
      </div>
      <div style="margin-top:12px;font-size:13px;color:rgba(228,225,220,.6)">
        ${t("estDelivery", lang)} : <b style="color:#d6a060">${esc(order.deliv)}</b></div>
    </td></tr></table>`;
}

function clientEmail(order: any, cust: any, paid: boolean) {
  const lang = pickLang(order.lang);
  const isVir = order.pay === "Virement";
  const body = `
    ${badge(paid ? t("badgePaid", lang) : (isVir ? t("badgeRegistered", lang) : t("badgeReceived", lang)))}
    ${h1(t("thanks", lang) + " " + esc(cust.first) + " !")}
    ${p(paid
      ? t("bodyPaid", lang)
      : (isVir ? t("bodyVirPending", lang) : t("bodyOtherPending", lang)))}
    ${itemsTable(order, false, lang)}
    ${isVir && !paid ? bankBlock(order, lang) : ""}
    ${addressBlock(order, cust, lang)}
    ${button(t("trackBtn", lang), SITE_URL + "/shop.html")}
    ${p(t("trackPara", lang), "rgba(228,225,220,.55)")}
    ${p(`<span style="font-size:12px">${t("legalNotice", lang)}</span>`, "rgba(228,225,220,.45)")}
    ${p(t("signoff", lang))}
  `;
  return {
    subject: paid
      ? `${t("subjectPaid", lang)} ${order.ref} · Pixel Studio`
      : `${t("subjectPending", lang)} ${order.ref} · Pixel Studio`,
    html: wrap("Commande " + order.ref, body,
      `${(order.items || []).length} article(s) · ${euro(order.total)} TVAC`),
  };
}

// Relance 48 h — variante "toujours pas payé" du mail client. Volontairement PAS
// un renvoi de la confirmation initiale : le client l'a déjà reçue, ce qu'il lui
// faut ici c'est le moyen de payer (IBAN ou lien Mollie neuf).
function unpaidReminderEmail(order: any, cust: any, checkoutUrl: string | null) {
  const lang = pickLang(order.lang);
  const isVir = order.pay === "Virement";
  const body = `
    ${badge(t("badgeUnpaid", lang))}
    ${h1(t("unpaidTitle", lang))}
    ${p(t("thanks", lang) + " " + esc(cust.first) + " — " + (isVir ? t("unpaidBodyVir", lang) : t("unpaidBodyLink", lang)))}
    ${itemsTable(order, false, lang)}
    ${isVir ? bankBlock(order, lang) : ""}
    ${!isVir && checkoutUrl ? button(t("unpaidPayBtn", lang), checkoutUrl) : ""}
    ${!isVir && !checkoutUrl ? bankBlock(order, lang) : ""}
    ${p(t("unpaidHelp", lang), "rgba(228,225,220,.55)")}
    ${p(t("signoff", lang))}
  `;
  return {
    subject: `${t("unpaidSubject", lang)} ${order.ref}`,
    html: wrap("Commande " + order.ref, body, `${euro(order.total)} — ${order.ref}`),
  };
}

// Relance 24 h — panier laissé en plan. Ton transactionnel : c'est un rappel de
// leur propre action, pas une publicité. Les prix affichés sont RECALCULÉS au
// moment de l'envoi, jamais repris du panier stocké (ils ont pu changer depuis).
function cartReminderEmail(lines: { name: string; conf: string; qty: number; price: number }[], subtotal: number, lang: Lang, first: string) {
  const rows = lines.map((l) => `
    <tr>
      <td style="padding:13px 0;border-bottom:1px solid rgba(255,255,255,.07)">
        <div style="color:#edeae5;font-size:14px;font-weight:bold">${esc(l.name)}</div>
        <div style="color:rgba(228,225,220,.6);font-size:12.5px;margin-top:3px">${esc(l.qty)} ex.${l.conf ? " · " + esc(l.conf) : ""}</div>
      </td>
      <td align="right" style="padding:13px 0;border-bottom:1px solid rgba(255,255,255,.07);color:#d6a060;font-size:14px;font-weight:bold;white-space:nowrap;vertical-align:top">
        ${euro(l.price)}</td>
    </tr>`).join("");
  const body = `
    ${badge(t("badgeCart", lang))}
    ${h1(t("cartTitle", lang))}
    ${p((first ? t("thanks", lang) + " " + esc(first) + " — " : "") + t("cartBody", lang))}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:6px 18px;margin:20px 0">
      <tr><td colspan="2" style="padding:14px 0 4px;font-size:10.5px;letter-spacing:2.4px;text-transform:uppercase;color:#d9772b;font-weight:bold">
        ${t("cartLabel", lang)}</td></tr>
      ${rows}
      <tr>
        <td style="padding:16px 0 14px;color:#edeae5;font-size:15px;font-weight:bold">${t("cartSubtotal", lang)}</td>
        <td align="right" style="padding:16px 0 14px;color:#d6a060;font-size:20px;font-weight:bold">${euro(subtotal)}</td>
      </tr>
    </table>
    ${button(t("cartBtn", lang), SITE_URL + "/shop.html#panier")}
    ${p(t("cartPriceNote", lang), "rgba(228,225,220,.55)")}
    ${p(t("signoff", lang))}
  `;
  return {
    subject: t("cartSubject", lang) + " · Pixel Studio",
    html: wrap(t("cartTitle", lang), body, `${lines.length} article(s) · ${euro(subtotal)} HTVA`),
  };
}

function atelierEmail(order: any, cust: any, paid: boolean, fileLinks: any[]) {
  const safeLinks = (fileLinks || [])
    .map((f: any) => ({ label: f?.label, url: safeFileLink(f?.url) }))
    .filter((f: any) => f.url);
  const links = safeLinks.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;margin:20px 0">
        <tr><td style="padding:18px 22px">
        <div style="font-size:10.5px;letter-spacing:2.4px;text-transform:uppercase;color:#d9772b;font-weight:bold;margin-bottom:12px">
          Fichiers à imprimer</div>
        ${safeLinks.map((f: any) =>
          `<div style="margin:8px 0"><a href="${String(f.url).replace(/"/g, "%22")}" style="color:#d6a060;font-size:13px;text-decoration:none">⬇ ${esc(f.label)}</a></div>`).join("")}
        </td></tr></table>`
    : p(`<b style="color:#ff6b81">Aucun lien de fichier</b> — récupérez-les dans l'Espace Atelier.`);

  const body = `
    ${badge(paid ? "PAYÉE — à produire" : "Nouvelle commande")}
    ${h1("Commande " + esc(order.ref))}
    ${p(`<b style="color:#edeae5">${esc(cust.first)} ${esc(cust.last)}</b>${cust.company ? " — " + esc(cust.company) : ""}${cust.vat ? `<br>TVA ${esc(cust.vat)}` : ""}<br>
        ${esc(cust.email)} · ${esc(cust.phone)}`)}
    ${itemsTable(order, true)}
    ${links}
    ${addressBlock(order, cust)}
    ${order.pay === "Virement" && !paid ? bankBlock(order) : p(`Paiement : <b style="color:#d6a060">${esc(order.pay)}</b>${paid ? " — encaissé" : ""}`)}
    ${button("Ouvrir l'Espace Atelier", SITE_URL + "/shop.html")}
  `;
  return {
    subject: `${paid ? "💰 PAYÉE" : "🖨 Nouvelle commande"} ${order.ref} — ${euro(order.total)} — ${cust.first} ${cust.last}`,
    html: wrap("Commande " + order.ref, body, `${euro(order.total)} · ${esc(order.pay)}`),
  };
}

async function sendMail(to: string, toName: string, subject: string, html: string, replyTo?: string) {
  if (!BREVO_KEY) return { ok: false, error: "BREVO_API_KEY absente" };
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_KEY, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: SHOP_NAME, email: SHOP_EMAIL },
        to: [{ email: to, name: toName || to }],
        replyTo: { email: replyTo || SHOP_EMAIL, name: SHOP_NAME },
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) return { ok: false, error: "Brevo " + res.status + " " + (await res.text()).slice(0, 200) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

async function sendBoth(order: any, cust: any, paid: boolean, fileLinks: any[]) {
  const c = clientEmail(order, cust, paid);
  const a = atelierEmail(order, cust, paid, fileLinks || order.fileLinks || []);
  const r1 = await sendMail(cust.email, `${cust.first} ${cust.last}`, c.subject, c.html);
  const r2 = await sendMail(SHOP_EMAIL, "Atelier Pixel Studio", a.subject, a.html, cust.email);
  return { client: r1, atelier: r2 };
}

function partnerThankYouEmail(contact: string, code: string) {
  const body = `
    ${badge("Partenariat")}
    ${h1("Merci " + esc(contact) + " !")}
    ${p("Nous avons bien reçu votre demande de partenariat et revenons vers vous rapidement pour la mise en avant de votre logo sur notre page partenaires.")}
    ${p(`En attendant, voici votre code personnel : <b style="color:#d6a060">-30% sur votre prochaine commande</b>, valable sur le compte associé à cette adresse e-mail. Connectez-vous ou créez un compte avec cette adresse pour qu'il s'applique automatiquement.`)}
    <div style="text-align:center;margin:26px 0">
      <div style="display:inline-block;background:rgba(217,119,43,.13);border:1px solid rgba(214,160,96,.45);border-radius:12px;padding:16px 30px;font-size:22px;font-weight:bold;letter-spacing:2px;color:#d6a060">${esc(code)}</div>
    </div>
    ${button("Voir la boutique", SITE_URL + "/shop.html")}
    ${p(`À très vite,<br><b style="color:#edeae5">Logan — Pixel Studio</b>`)}
  `;
  return {
    subject: "Merci pour votre demande de partenariat — votre code -30%",
    html: wrap("Merci pour votre demande de partenariat", body, "Votre code -30% Pixel Studio"),
  };
}

function partnerNotifyEmail(d: { company: string; contact: string; email: string; vat: string; phone: string; web: string; event: string }) {
  const body = `
    ${badge("Nouvelle demande")}
    ${h1("Demande de partenariat")}
    ${p(`<b style="color:#edeae5">${esc(d.company)}</b><br>${esc(d.contact)} · ${esc(d.email)}${d.phone ? " · " + esc(d.phone) : ""}${d.vat ? "<br>TVA " + esc(d.vat) : ""}`)}
    ${d.web ? p("Site / réseaux : " + esc(d.web)) : ""}
    ${d.event ? p("Salon ou événement : " + esc(d.event)) : ""}
  `;
  return {
    subject: "Nouvelle demande de partenariat — " + d.company,
    html: wrap("Demande de partenariat", body),
  };
}

// --- Création de paiement Mollie -------------------------------------------------
// Extrait du tunnel de commande pour être partagé avec la relance 48 h, qui doit
// pouvoir régénérer un lien de checkout sans redupliquer cette logique.
type MollieLine = {
  description: string;
  quantity: number;
  unitPrice: { currency: string; value: string };
  totalAmount: { currency: string; value: string };
  vatRate: string;
  vatAmount: { currency: string; value: string };
};
async function createMolliePayment(opts: {
  ref: string;
  total: number;
  lines: MollieLine[];
  cust: any;
  country: string;
  method?: string;
}): Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }> {
  if (!MOLLIE_KEY) return { ok: false, error: "MOLLIE_API_KEY absente des secrets" };
  const c = opts.cust ?? {};
  const mp: Record<string, unknown> = {
    amount: { currency: "EUR", value: opts.total.toFixed(2) },
    description: `Pixel Studio — commande ${opts.ref}`,
    redirectUrl: `${SITE_URL}/shop.html?paiement=retour&ref=${encodeURIComponent(opts.ref)}`,
    webhookUrl: `${SUPABASE_URL}/functions/v1/mollie`,
    metadata: { ref: opts.ref },
    locale: "fr_BE",
    lines: opts.lines,
    billingAddress: {
      givenName: c.first || "",
      familyName: c.last || "",
      email: c.email || "",
      streetAndNumber: `${c.street || ""} ${c.num || ""}`.trim(),
      postalCode: c.zip || "",
      city: c.city || "",
      country: opts.country,
    },
  };
  if (opts.method) mp.method = opts.method;
  const res = await fetch("https://api.mollie.com/v2/payments", {
    method: "POST",
    headers: { Authorization: `Bearer ${MOLLIE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(mp),
  });
  const payment = await res.json();
  if (!res.ok || !payment?._links?.checkout?.href) {
    return { ok: false, error: "MOLLIE: " + (payment?.detail ?? JSON.stringify(payment)).slice(0, 300) };
  }
  return { ok: true, checkoutUrl: payment._links.checkout.href };
}

// --- Relances automatiques (appelées par pg_cron via l'action `cron`) -------------
// Règle commune aux deux batchs : une relance qui échoue ne bloque JAMAIS les
// suivantes — chaque itération est isolée dans son propre try/catch et le batch
// rend un compte-rendu chiffré.

const REMINDER_BATCH = 40;

async function runOrderReminders() {
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const q = `orders?select=ref,created_at,data&created_at=lt.${encodeURIComponent(cutoff)}` +
    `&data->>status=eq.${encodeURIComponent(PENDING_STATUS)}&order=created_at.asc&limit=${REMINDER_BATCH}`;
  const r = await db(q);
  if (!r.ok) return { scanned: 0, sent: 0, error: "select " + r.status };
  const rows = await r.json();
  let sent = 0, skipped = 0;
  const errors: string[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    try {
      const data = row?.data ?? {};
      // Une seule relance, jamais deux — même marqueur idempotent que mailPaid.
      if (data.reminder48Sent) { skipped++; continue; }
      const cust = data.cust;
      if (!cust?.email) { skipped++; continue; }
      const ref = String(row.ref);
      const order = { ...data, ref };
      let checkoutUrl: string | null = null;
      if (data.pay !== "Virement") {
        // Le lien Mollie initial a expiré depuis longtemps : on en crée un neuf pour
        // le même montant, avec la MÊME référence en metadata pour que le webhook
        // existant marque la commande payée sans traitement particulier.
        const vatRate = typeof data.vatRate === "number" ? data.vatRate : VAT;
        const total = Number(data.total) || 0;
        if (total <= 0) { skipped++; continue; }
        const net = Math.round((total / (1 + vatRate)) * 100) / 100;
        const created = await createMolliePayment({
          ref,
          total,
          lines: [{
            description: `Pixel Studio — commande ${ref}`,
            quantity: 1,
            unitPrice: { currency: "EUR", value: total.toFixed(2) },
            totalAmount: { currency: "EUR", value: total.toFixed(2) },
            vatRate: (vatRate * 100).toFixed(2),
            vatAmount: { currency: "EUR", value: (Math.round((total - net) * 100) / 100).toFixed(2) },
          }],
          cust,
          country: String(data.country || "BE"),
        });
        if (created.ok) checkoutUrl = created.checkoutUrl;
        else errors.push(ref + ": " + created.error);
      }
      const mail = unpaidReminderEmail(order, cust, checkoutUrl);
      const res = await sendMail(cust.email, `${cust.first ?? ""} ${cust.last ?? ""}`.trim(), mail.subject, mail.html);
      if (!res.ok) { errors.push(ref + ": " + res.error); continue; }
      await db(`orders?ref=eq.${encodeURIComponent(ref)}`, {
        method: "PATCH",
        body: JSON.stringify({ data: { ...data, reminder48Sent: true, reminder48At: new Date().toISOString() } }),
      });
      sent++;
    } catch (e) {
      errors.push(String((e as Error)?.message ?? e));
    }
  }
  return { scanned: Array.isArray(rows) ? rows.length : 0, sent, skipped, errors: errors.slice(0, 10) };
}

async function authUserById(id: string): Promise<{ email: string; name: string; lang: Lang } | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u?.email) return null;
    const m = u.user_metadata ?? {};
    return { email: String(u.email), name: String(m.first ?? m.name ?? "").trim(), lang: pickLang(m.lang) };
  } catch {
    return null;
  }
}

async function runCartReminders() {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  // reminded_at non nul = déjà relancé pour ce cycle ; le trigger SQL le remet à
  // NULL dès que le client retouche son panier, donc un panier réellement repris
  // puis réabandonné peut être relancé à nouveau.
  const q = `carts?select=user_id,items,updated_at&reminded_at=is.null` +
    `&updated_at=lt.${encodeURIComponent(cutoff)}&order=updated_at.asc&limit=${REMINDER_BATCH}`;
  const r = await db(q);
  if (!r.ok) return { scanned: 0, sent: 0, error: "select " + r.status };
  const rows = await r.json();
  let sent = 0, skipped = 0;
  const errors: string[] = [];
  const markDone = async (uid: string) =>
    db(`carts?user_id=eq.${encodeURIComponent(uid)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ reminded_at: new Date().toISOString() }),
    });
  for (const row of Array.isArray(rows) ? rows : []) {
    try {
      const uid = String(row.user_id);
      const items = Array.isArray(row.items) ? row.items : [];
      if (!items.length) { skipped++; continue; }
      // Le client a-t-il commandé depuis ? Alors ce n'est pas un abandon : on
      // marque la ligne comme traitée pour ne plus la rescanner, sans e-mail.
      const ord = await db(`orders?user_id=eq.${encodeURIComponent(uid)}&created_at=gt.${encodeURIComponent(row.updated_at)}&select=id&limit=1`);
      const ordRows = ord.ok ? await ord.json() : [];
      if (Array.isArray(ordRows) && ordRows.length) { await markDone(uid); skipped++; continue; }

      const who = await authUserById(uid);
      if (!who) { skipped++; continue; }

      // Prix RECALCULÉS maintenant, jamais repris du panier stocké.
      const lines: { name: string; conf: string; qty: number; price: number }[] = [];
      let subtotal = 0;
      for (const it of items) {
        const res = await resolveItem(it, 0);
        if ("error" in res) continue;
        lines.push({
          name: res.prod.name || res.prod.id,
          conf: String(it?.conf ?? ""),
          qty: Number(it?.qty) || 1,
          price: res.price,
        });
        subtotal += res.price;
      }
      if (!lines.length) { await markDone(uid); skipped++; continue; }
      subtotal = Math.round(subtotal * 100) / 100;

      const mail = cartReminderEmail(lines, subtotal, who.lang, who.name);
      const res = await sendMail(who.email, who.name || who.email, mail.subject, mail.html);
      if (!res.ok) { errors.push(uid + ": " + res.error); continue; }
      await markDone(uid);
      sent++;
    } catch (e) {
      errors.push(String((e as Error)?.message ?? e));
    }
  }
  return { scanned: Array.isArray(rows) ? rows.length : 0, sent, skipped, errors: errors.slice(0, 10) };
}

Deno.serve(async (req) => {
  try { return await handler(req); }
  catch (e) {
    return json({
      error: "CRASH: " + String((e as Error)?.message ?? e),
      mollieKey: MOLLIE_KEY ? "ok" : "VIDE",
      brevoKey: BREVO_KEY ? "ok" : "VIDE",
    }, 200);
  }
});

async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ctype = req.headers.get("content-type") ?? "";

  if (!ctype.includes("application/json")) {
    try {
      const form = await req.formData();
      const id = String(form.get("id") ?? "");
      if (!id) return new Response("ok");

      const res = await fetch(`https://api.mollie.com/v2/payments/${id}`, {
        headers: { Authorization: `Bearer ${MOLLIE_KEY}` },
      });
      const payment = await res.json();
      const ref = payment?.metadata?.ref;
      if (!ref) return new Response("ok");

      const status = STATUS[payment.status] ?? payment.status;
      const cur = await db(`orders?ref=eq.${encodeURIComponent(ref)}&select=data`);
      const rows = await cur.json();
      const prev = rows?.[0]?.data ?? {};
      const data = { ...prev, status, paidAt: payment.paidAt ?? null };

      await db(`orders?ref=eq.${encodeURIComponent(ref)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, data }),
      });

      if (payment.status === "paid" && !prev.mailPaid && prev.cust) {
        await sendBoth({ ...data, ref }, prev.cust, true, prev.fileLinks || []);
        await db(`orders?ref=eq.${encodeURIComponent(ref)}`, {
          method: "PATCH",
          body: JSON.stringify({ data: { ...data, mailPaid: true } }),
        });
      }
      return new Response("ok");
    } catch { return new Response("ok"); }
  }

  const payload = await req.json();
  const ip = req.headers.get("x-forwarded-for") ?? "anon";

  // Batch de relances déclenché par pg_cron. Authentifié par un secret partagé
  // stocké dans la table privée `app_secrets` (RLS sans policy = service_role
  // uniquement) : le job SQL lit la même ligne, il n'y a donc aucun secret à
  // provisionner à la main ni à exposer côté client.
  if (payload.action === "cron") {
    const provided = String(payload.key ?? "");
    const kr = await db("app_secrets?k=eq.cron&select=v&limit=1");
    const krows = kr.ok ? await kr.json() : [];
    const expected = String(krows?.[0]?.v ?? "");
    if (!expected || provided.length !== expected.length || provided !== expected) {
      return json({ error: "forbidden" }, 403);
    }
    if (!rateOk("cron", 12, 3600000)) return json({ error: "Trop d'exécutions" }, 429);
    const out: Record<string, unknown> = { at: new Date().toISOString() };
    try { out.orders48 = await runOrderReminders(); }
    catch (e) { out.orders48 = { error: String((e as Error)?.message ?? e) }; }
    try { out.carts24 = await runCartReminders(); }
    catch (e) { out.carts24 = { error: String((e as Error)?.message ?? e) }; }
    return json(out);
  }

  if (payload.action === "vat") {
    if (!rateOk("vat:" + ip, 30)) return json({ valid: false, reason: "rate" }, 429);
    const raw = String(payload.vat ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const cc = raw.slice(0, 2), nb = raw.slice(2);
    if (!/^[A-Z]{2}$/.test(cc) || nb.length < 2) {
      return json({ valid: false, reason: "format" });
    }
    try {
      const r = await fetch("https://ec.europa.eu/taxation_customs/vies/rest-api/ms/" + cc + "/vat/" + nb, {
        headers: { accept: "application/json" },
      });
      if (!r.ok) return json({ valid: false, reason: "service", status: r.status });
      const d = await r.json();
      return json({
        valid: !!d.isValid,
        country: cc,
        vat: raw,
        name: d.name && d.name !== "---" ? d.name : "",
        address: d.address && d.address !== "---" ? d.address : "",
        checked: new Date().toISOString(),
      });
    } catch (e) {
      return json({ valid: false, reason: "service", error: String((e as Error)?.message ?? e) });
    }
  }

  // Public catalog: product metadata + option NAMES only, no pricing formula.
  // Backed by the products_public view, which already redacts price_grid and opts[].c[].p/d.
  if (payload.action === "catalog") {
    if (!rateOk("catalog:" + ip, 60, 3600000)) return json({ error: "Trop de requêtes" }, 429);
    const r = await db("products_public?select=*&order=sort_order.asc");
    if (!r.ok) return json({ error: "Catalogue indisponible" }, 500);
    const rows = await r.json();
    return json({ products: rows });
  }

  // Formulaire "Devenir partenaire" (page d'accueil) : génère un code -30% unique
  // lié à l'e-mail du contact, l'enregistre, envoie le mail de remerciement au
  // partenaire et une notification interne. Idempotent par e-mail (index UNIQUE
  // sur partner_codes) : une nouvelle soumission avec le même e-mail renvoie le
  // même code plutôt que d'en générer un second.
  if (payload.action === "partner") {
    if (payload._gotcha) return json({ ok: true });
    if (!rateOk("partner:" + ip, 5, 3600000)) return json({ error: "Trop de demandes, réessayez plus tard." }, 429);
    const company = String(payload.company ?? "").trim();
    const contact = String(payload.contact ?? "").trim();
    const email = String(payload.email ?? "").trim().toLowerCase();
    const vat = String(payload.vat ?? "").trim();
    const phone = String(payload.phone ?? "").trim();
    const web = String(payload.web ?? "").trim();
    const event = String(payload.event ?? "").trim();
    if (!company || !contact || !email || !payload.consent) {
      return json({ error: "Merci de compléter les champs obligatoires." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Adresse e-mail invalide." }, 400);

    const existing = await db(`partner_codes?email=eq.${encodeURIComponent(email)}&select=code&limit=1`);
    const existingRows = existing.ok ? await existing.json() : [];
    let code: string = existingRows?.[0]?.code;
    if (!code) {
      code = "PART-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      const insertRes = await db("partner_codes", {
        method: "POST",
        body: JSON.stringify({ email, code, company, contact_name: contact, percent: 30 }),
      });
      if (!insertRes.ok) {
        console.error("partner_codes insert failed", insertRes.status, await insertRes.text());
        return json({ error: "Erreur serveur, réessayez." }, 500);
      }
    }

    const clientMail = partnerThankYouEmail(contact, code);
    const internalMail = partnerNotifyEmail({ company, contact, email, vat, phone, web, event });
    await sendMail(email, contact, clientMail.subject, clientMail.html);
    await sendMail(SHOP_EMAIL, "Atelier Pixel Studio", internalMail.subject, internalMail.html, email);
    return json({ ok: true });
  }

  // Exact price for one configured item. This is the ONLY place a numeric price
  // for a specific configuration is ever computed and sent to the browser.
  if (payload.action === "price") {
    if (!rateOk("price:" + ip, 240, 300000)) return json({ error: "Trop de requêtes" }, 429);
    const { pid, qty, sel, country } = payload;
    if (!pid || !qty) return json({ error: "Paramètres invalides" }, 400);
    const sh = SHIPPING[country] ?? SHIPPING.BE;
    const res = await resolveItem({ pid, qty, sel: sel || {}, designAdd: !!payload.designAdd }, sh.extraDays);
    if ("error" in res) return json({ error: res.error }, 400);
    return json({ price: res.price, days: res.days, base: res.base, designAdd: res.designAdd, shipFlat: res.shipFlat });
  }

  // Pré-vérification du fichier client par le moteur de contrôle FLYERALARM
  // (format, nombre de pages, résolution…), avant paiement — jamais bloquant :
  // toute impossibilité (produit non catalogué chez FLYERALARM, configuration
  // sans identifiant connu, service indisponible) renvoie simplement "skipped",
  // et le client garde la main via la confirmation manuelle habituelle.
  // Non authentifié par design (l'upload a lieu avant connexion) : protégé par un
  // taux limité et par une taille de fichier plafonnée.
  if (payload.action === "printcheck") {
    if (!rateOk("printcheck:" + ip, 20, 3600000)) return json({ error: "Trop de vérifications, réessayez plus tard." }, 429);
    if (!FLYERALARM_KEY_BE) return json({ skipped: true, reason: "unavailable" });
    const { pid, qty, sel, fileName } = payload;
    const prod = pid ? await getProduct(String(pid)) : null;
    if (!prod || !prod.active) return json({ skipped: true, reason: "unknown_product" });
    const ref = resolveFlyeralarmRef(prod, sel || {}, Number(qty));
    if (!ref) return json({ skipped: true, reason: "no_mapping" });

    const decoded = dataUrlToBytes(String(payload.fileBase64 ?? ""));
    if (!decoded) return json({ error: "Fichier invalide" }, 400);
    if (decoded.bytes.length > 15 * 1024 * 1024) return json({ error: "Fichier trop volumineux" }, 400);

    const url = await uploadPrecheckFile(decoded.bytes, decoded.mime, String(fileName || "fichier"));
    if (!url) return json({ skipped: true, reason: "upload_failed" });

    try {
      const r = await fetch(`${FLYERALARM_API_BASE}/be/v2/orders/check_print_data`, {
        method: "POST",
        headers: { Authorization: `Bearer ${FLYERALARM_KEY_BE}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...ref, print_data_url: url }),
      });
      if (!r.ok) return json({ skipped: true, reason: "upstream_error" });
      const d = await r.json();
      if (!d?.data_check_id) return json({ skipped: true, reason: "upstream_error" });
      return json({ checkId: String(d.data_check_id) });
    } catch {
      return json({ skipped: true, reason: "upstream_unavailable" });
    }
  }

  // Statut d'une vérification lancée via `printcheck`. Interrogé par le
  // navigateur en polling le temps que FLYERALARM traite le fichier.
  if (payload.action === "printcheck_status") {
    if (!rateOk("printcheck_status:" + ip, 120, 3600000)) return json({ error: "Trop de requêtes" }, 429);
    const checkId = String(payload.checkId ?? "").trim();
    if (!checkId || !FLYERALARM_KEY_BE) return json({ status: "unknown" });
    try {
      const r = await fetch(`${FLYERALARM_API_BASE}/be/v2/orders/print_data_checks/${encodeURIComponent(checkId)}`, {
        headers: { Authorization: `Bearer ${FLYERALARM_KEY_BE}`, Accept: "application/json" },
      });
      if (!r.ok) return json({ status: "unknown" });
      const d = await r.json();
      return json({ status: d?.order_status ?? "unknown", reasons: Array.isArray(d?.reasons) ? d.reasons.slice(0, 5) : [] });
    } catch {
      return json({ status: "unknown" });
    }
  }

  // Live preview of a promo code, WITHOUT creating any order or Mollie payment.
  // Recomputes the real subtotal from the products table (never trusts a
  // client-supplied amount). Items are optional: if the frontend cannot read
  // the current cart, this still confirms code validity/eligibility with a
  // percent-only response (discount: null) rather than failing.
  if (payload.action === "promo") {
    const u = await authUser(req);
    if (!u) return json({ error: "Connectez-vous pour utiliser un code promo." }, 401);
    if (!rateOk("promoCheck:" + u.id, 20, 300000)) return json({ error: "Trop de tentatives, réessayez dans un instant." }, 429);
    const code = String(payload.code ?? "").trim().toUpperCase();
    if (!code) return json({ error: "Entrez un code." }, 400);
    const def = PROMO_CODES[code];
    let percent: number;
    if (def) {
      if (def.newCustomerOnly) {
        const prevRes = await db(`orders?user_id=eq.${u.id}&select=id&limit=1`);
        const prevRows = prevRes.ok ? await prevRes.json() : [];
        if (Array.isArray(prevRows) && prevRows.length > 0) {
          return json({ error: "Ce code est réservé aux nouveaux clients — une commande existe déjà sur ce compte." }, 400);
        }
      }
      percent = def.percent;
    } else {
      const pr = await db(`partner_codes?code=eq.${encodeURIComponent(code)}&select=email,percent,used&limit=1`);
      const prows = pr.ok ? await pr.json() : [];
      const prow = prows?.[0];
      if (!prow) return json({ error: "Code promo invalide." }, 400);
      if (prow.used) return json({ error: "Ce code a déjà été utilisé." }, 400);
      if (String(prow.email).toLowerCase() !== String(u.email).toLowerCase()) {
        return json({ error: "Ce code n'est pas associé à ce compte." }, 400);
      }
      percent = Number(prow.percent) || 30;
    }
    const items = Array.isArray(payload.items) ? payload.items : [];
    let subtotal = 0;
    for (const it of items) {
      const res = await resolveItem(it, 0);
      if ("error" in res) continue;
      subtotal += res.price;
    }
    const discount = subtotal > 0 ? Math.round(subtotal * (percent / 100) * 100) / 100 : null;
    return json({ valid: true, code, percent, discount });
  }

  // Renvoi des e-mails de confirmation pour une commande déjà existante. Ne fait
  // JAMAIS confiance au contenu (montant, statut payé, liens de fichiers) envoyé par
  // le client : la commande réelle est relue en base par référence + utilisateur
  // authentifié, et c'est cette version-là qui est utilisée pour composer les
  // e-mails. Sans cela, n'importe quel compte pouvait faire envoyer par le système
  // un e-mail "officiel" à lui-même et à l'atelier avec un montant, un statut
  // "payé" et des liens de fichiers entièrement fabriqués.
  if (payload.action === "emails") {
    const u = await authUser(req);
    if (!u) return json({ error: "Authentification requise" }, 401);
    if (!rateOk("mail:" + u.id)) return json({ error: "Trop d'envois, réessayez plus tard" }, 429);

    const ref = String(payload.ref ?? payload.order?.ref ?? "").trim();
    if (!ref) return json({ error: "Référence de commande manquante" }, 400);

    const r = await db(`orders?ref=eq.${encodeURIComponent(ref)}&user_id=eq.${u.id}&select=data&limit=1`);
    const rows = r.ok ? await r.json() : [];
    const data = rows?.[0]?.data;
    if (!data || !data.cust || !data.cust.email) return json({ error: "Commande introuvable" }, 404);

    const paid = !!data.paidAt;
    const result = await sendBoth({ ...data, ref }, data.cust, paid, data.fileLinks || []);
    return json({ sent: result });
  }

  const { items, country, order, method } = payload;
  if (!Array.isArray(items) || !items.length) return json({ error: "Commande invalide" }, 400);
  if (items.length > 40) return json({ error: "Trop d'articles" }, 400);
  if (!MOLLIE_KEY) return json({ error: "MOLLIE_API_KEY absente des secrets" }, 500);
  // Klarna réservé aux particuliers — vérifié ici, pas seulement caché côté interface,
  // pour qu'une requête forgée ne puisse pas contourner la restriction.
  if (method === "klarna" && order?.custKind === "pro") {
    return json({ error: "Klarna n'est pas disponible pour les comptes professionnels." }, 400);
  }
  const payer = await authUser(req);
  if (!payer) return json({ error: "Authentification requise" }, 401);
  if (!rateOk("pay:" + payer.id, 15)) return json({ error: "Trop de tentatives" }, 429);

  const ref = await uniqueRef();
  // Langue de préférence du compte (choisie à l'inscription, voir shop-app-source.js
  // signUp) — stockée dans la commande pour rester disponible aux envois d'e-mail
  // asynchrones (webhook Mollie, renvoi manuel) sans re-consulter le compte.
  const custLang = pickLang(payer.user_metadata?.lang);

  // Code promo : verifie et resolu ici, jamais a partir d'un montant envoye par le
  // client. "Reserve aux nouveaux clients" = aucune ligne dans `orders` pour ce
  // user_id authentifie (JWT), pas un champ declaratif du payload.
  let promo: { code: string; percent: number } | null = null;
  let partnerCodeUsed: string | null = null;
  const promoRaw = String((payload as any).promo ?? "").trim().toUpperCase();
  if (promoRaw) {
    const def = PROMO_CODES[promoRaw];
    if (def) {
      if (def.newCustomerOnly) {
        const prevRes = await db(`orders?user_id=eq.${payer.id}&select=id&limit=1`);
        const prevRows = prevRes.ok ? await prevRes.json() : [];
        if (Array.isArray(prevRows) && prevRows.length > 0) {
          return json({ error: "Ce code est réservé aux nouveaux clients — une commande existe déjà sur ce compte." }, 400);
        }
      }
      promo = { code: promoRaw, percent: def.percent };
    } else {
      const pr = await db(`partner_codes?code=eq.${encodeURIComponent(promoRaw)}&select=email,percent,used&limit=1`);
      const prows = pr.ok ? await pr.json() : [];
      const prow = prows?.[0];
      if (!prow) return json({ error: "Code promo invalide." }, 400);
      if (prow.used) return json({ error: "Ce code a déjà été utilisé." }, 400);
      if (String(prow.email).toLowerCase() !== String(payer.email).toLowerCase()) {
        return json({ error: "Ce code n'est pas associé à ce compte." }, 400);
      }
      promo = { code: promoRaw, percent: Number(prow.percent) || 30 };
      partnerCodeUsed = promoRaw;
    }
  }

  // Recompute every line server-side from the product's full option formula
  // (paper, sides, pelliculage, finition prestige, express...) — never trust
  // the client's displayed price. Le supplément "création de design" passe par
  // le même chemin (resolveItem) et reste forfaitaire.
  const sh = SHIPPING[country] ?? SHIPPING.BE;
  const lineItems: { name: string; price: number }[] = [];
  const flatShipItems: { name: string; price: number }[] = [];
  let subtotal = 0;
  for (const it of items) {
    const res = await resolveItem(it, sh.extraDays);
    if ("error" in res) return json({ error: res.error }, 400);
    subtotal += res.price;
    lineItems.push({
      name: String(res.prod.name || res.prod.id) + (res.designAdd ? " + création de design" : ""),
      price: res.price,
    });
    // Frais de port hors-gabarit : toujours une ligne à part, jamais mélangés
    // au prix produit ni à la ligne "Livraison" générique par pays.
    if (res.shipFlat > 0) {
      flatShipItems.push({ name: "Frais de port — " + String(res.prod.name || res.prod.id), price: res.shipFlat });
    }
  }
  const discount = promo ? Math.round(subtotal * (promo.percent / 100) * 100) / 100 : 0;
  const shipping = subtotal >= sh.free ? 0 : sh.price;

  // Autoliquidation (TVA 0%) pour un professionnel hors Belgique avec un numéro de TVA
  // valide — revérifiée ici via VIES, jamais déduite du champ envoyé par le client.
  // order.reverseVat n'est qu'indicatif : lui faire confiance permettrait à n'importe
  // qui de se déclarer "en autoliquidation" pour payer 21 % de moins.
  const custKind = order?.custKind === "pro" ? "pro" : "part";
  const rawVat = String(order?.cust?.vat ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const vatPrefix = rawVat.slice(0, 2), vatDigits = rawVat.slice(2);
  let reverseCharge = false;
  if (custKind === "pro" && country !== "BE" && vatPrefix === country && vatDigits.length >= 2) {
    try {
      const vr = await fetch(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${vatPrefix}/vat/${vatDigits}`, {
        headers: { accept: "application/json" },
      });
      if (vr.ok) {
        const vd = await vr.json();
        reverseCharge = !!vd.isValid;
      }
    } catch (_) { /* VIES indisponible — TVA belge appliquée par défaut */ }
  }
  const vatRate = reverseCharge ? 0 : VAT;
  const vatRateStr = reverseCharge ? "0.00" : "21.00";

  // Lignes de commande — obligatoires pour Klarna (paiement différé) et une bonne
  // pratique pour toutes les méthodes. Le total est reconstruit à partir de la somme
  // exacte des lignes pour garantir la correspondance au centime près (Mollie rejette
  // la demande si lines[].totalAmount ne totalise pas amount.value).
  const lines: MollieLine[] = lineItems.map((it) => {
    const gross = Math.round(it.price * (1 + vatRate) * 100) / 100;
    const vatAmount = Math.round((gross - it.price) * 100) / 100;
    return {
      description: it.name,
      quantity: 1,
      unitPrice: { currency: "EUR", value: gross.toFixed(2) },
      totalAmount: { currency: "EUR", value: gross.toFixed(2) },
      vatRate: vatRateStr,
      vatAmount: { currency: "EUR", value: vatAmount.toFixed(2) },
    };
  });
  if (promo && discount > 0) {
    const discGross = Math.round(discount * (1 + vatRate) * 100) / 100;
    const discVat = Math.round((discGross - discount) * 100) / 100;
    lines.push({
      description: `Réduction -${promo.percent}% (code ${promo.code})`,
      quantity: 1,
      unitPrice: { currency: "EUR", value: (-discGross).toFixed(2) },
      totalAmount: { currency: "EUR", value: (-discGross).toFixed(2) },
      vatRate: vatRateStr,
      vatAmount: { currency: "EUR", value: (-discVat).toFixed(2) },
    });
  }
  let extraShipping = 0;
  for (const fs of flatShipItems) {
    const fsGross = Math.round(fs.price * (1 + vatRate) * 100) / 100;
    const fsVat = Math.round((fsGross - fs.price) * 100) / 100;
    lines.push({
      description: fs.name,
      quantity: 1,
      unitPrice: { currency: "EUR", value: fsGross.toFixed(2) },
      totalAmount: { currency: "EUR", value: fsGross.toFixed(2) },
      vatRate: vatRateStr,
      vatAmount: { currency: "EUR", value: fsVat.toFixed(2) },
    });
    extraShipping += fs.price; // net, pour rester cohérent avec subtotal/shipping ci-dessous
  }
  let total = lines.reduce((s, l) => s + Number(l.totalAmount.value), 0);
  if (shipping > 0) {
    const shipGross = Math.round(shipping * (1 + vatRate) * 100) / 100;
    const shipVat = Math.round((shipGross - shipping) * 100) / 100;
    lines.push({
      description: "Livraison",
      quantity: 1,
      unitPrice: { currency: "EUR", value: shipGross.toFixed(2) },
      totalAmount: { currency: "EUR", value: shipGross.toFixed(2) },
      vatRate: vatRateStr,
      vatAmount: { currency: "EUR", value: shipVat.toFixed(2) },
    });
    total += shipGross;
  }
  total = Math.round(total * 100) / 100;
  if (total < 0) return json({ error: "Montant invalide" }, 400);

  const cust = order?.cust ?? {};
  const created = await createMolliePayment({ ref, total, lines, cust, country, method });
  if (!created.ok) return json({ error: created.error }, 200);

  // NB: la table `orders` n'a que id/user_id/ref/created_at/data — payment_id/amount/
  // status ne sont PAS des colonnes réelles. `ref` porte une contrainte UNIQUE et est
  // généré ci-dessus côté serveur : l'insert est vérifié (r.ok) pour ne jamais échouer
  // en silence.
  try {
    const insertRes = await db("orders", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        ref,
        user_id: payer.id,
        data: {
          ...order, ref, total, lang: custLang,
          subtotal: Math.round(subtotal * 100) / 100,
          shipping: shipping,
          extraShipping: Math.round(extraShipping * 100) / 100,
          vat: Math.round((total - (subtotal - discount) - shipping - extraShipping) * 100) / 100,
          vatRate, reverseVat: reverseCharge,
          promo: promo ? { code: promo.code, percent: promo.percent, discount } : null,
          status: PENDING_STATUS,
        },
      }),
    });
    if (!insertRes.ok) {
      console.error("orders insert failed", insertRes.status, await insertRes.text());
    } else if (partnerCodeUsed) {
      const markRes = await db(`partner_codes?code=eq.${encodeURIComponent(partnerCodeUsed)}`, {
        method: "PATCH",
        body: JSON.stringify({ used: true, used_at: new Date().toISOString() }),
      });
      if (!markRes.ok) console.error("partner_codes mark-used failed", markRes.status, await markRes.text());
    }
  } catch (e) {
    console.error("orders insert threw", String((e as Error)?.message ?? e));
  }

  return json({ checkoutUrl: created.checkoutUrl, total, ref, promo: promo ? { code: promo.code, discount } : null });
}
