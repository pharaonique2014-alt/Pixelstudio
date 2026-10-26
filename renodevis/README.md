# RénoDevis — prototype (phase 1)

Plateforme de mise en relation « particuliers / entreprises de rénovation », service de
Pixel Studio (Logan Fontaine, BCE BE 1032.720.495).

> **Statut : prototype de TEST, rien n'est en ligne.** Aucun projet Supabase, aucun
> déploiement, aucun DNS n'a été créé. Ce dossier est indépendant du site pxlstudio.be :
> aucune page ni aucune table existante n'est modifiée.
>
> ⚠️ Le site pxlstudio.be est publié par GitHub Pages depuis la racine du dépôt : si ce
> dossier est fusionné dans `main`, ses fichiers *sources* deviendraient accessibles sous
> `pxlstudio.be/renodevis/`. À héberger à part (voir « Mise en ligne ») ou à exclure.

## Décisions validées

| Sujet | Décision |
|---|---|
| Nom / domaine de test | RénoDevis, `connect.pxlstudio.be` |
| SMS + e-mails | Brevo (France, UE) |
| Prix d'un déblocage | **35 € TTC**, fixe, 1 crédit (crédits manuels au départ) |
| Remboursement | **1 crédit rendu** si le particulier reste injoignable après **3 appels horodatés** (date + heure de chaque appel), après revue manuelle |
| Paiement en ligne (phase 3) | Mollie (Bancontact) |
| Conservation | non confirmées : 24 h · demandes : 12 mois après la fin · consentement : 5 ans · facturation : 7 ans |
| Hébergement | front statique (Vercel ou Cloudflare Pages) + projet Supabase **dédié** (UE) |
| Polices | Montserrat + Playfair Display (celles de pxlstudio.be), auto-hébergées |
| Section « Qui est derrière » | oui, avec la photo (copie WebP 14 Ko) |

Hypothèses à confirmer : expiration d'une demande à **30 jours** ; signalement possible
**7 jours** après le déblocage ; **1 h minimum** entre deux appels ; un budget « Je ne sais
pas » n'est proposé qu'aux entreprises qui l'acceptent (`accept_unknown_budget`) ; seuls les
**GSM belges** (046x à 049x) sont acceptés ; le formulaire demande **code postal ET
commune** (deux champs) pour afficher les deux aux entreprises.

## Architecture

```
navigateur (pages statiques Vite, sans cookie)
   │  POST JSON (origine vérifiée)
   ▼
Supabase Edge Function `public-api`  ── Turnstile (captcha) · Brevo (SMS, e-mail admin)
   │  service_role, fonctions SQL rd_api_*
   ▼
Postgres + RLS (projet dédié)
   requests (anonyme) │ request_contacts (PII, aucune policy) │ consent_logs │ otp_attempts …
   companies │ assignments │ unlocks │ credit_ledger │ reports │ audit_log
```

- **anon** (visiteur) : aucun droit sur aucune table ni fonction. Tout passe par `public-api`.
- **Entreprise** : voit uniquement les demandes qui lui sont attribuées, et seulement si elle
  est *validée* **et** connectée en double authentification (`aal2`). Colonnes visibles :
  aperçu anonyme. Les coordonnées ne sortent que via `rd_unlock` / `rd_get_contact`, après
  débit d'un crédit.
- **Admin** : fonctions `rd_admin_*` (valider une entreprise, créditer, traiter un
  signalement), toutes journalisées dans `audit_log`.

### Arborescence

| Chemin | Contenu |
|---|---|
| `index.html`, `src/main.ts` | page test châssis (quiz 7 étapes) |
| `effacement.html`, `src/erase.ts` | droit à l'effacement (code SMS → suppression) |
| `legal/*.html`, `pro/cgv.html` | brouillons juridiques (générés par `tools/build-legal.py`) |
| `src/styles/` | `base.css` (commun), `particulier.css` (bleu), `pro.css` (orange) |
| `supabase/migrations/` | schéma, RLS, API, matching, crédits, maintenance |
| `supabase/functions/_shared/` | logique serveur sans dépendance Deno (testée sous Node) |
| `supabase/functions/public-api/` | point d'entrée Deno |
| `dev/` | API simulée (dev/preview uniquement) et en-têtes de sécurité |
| `tests/` | SQL (RLS), unitaires, intégration (vraie base), navigateur (Playwright + axe) |

## Tests

```bash
npm ci
# Postgres local jetable (16+) : PGHOST/PGPORT/PGUSER, défaut 127.0.0.1:54329 postgres
npm run test:sql     # 6 fichiers : anonyme, isolation A/B, coordonnées, matching, parcours, signalements
npm run test:unit    # validation, règles de communication, intégration API ↔ base
npm run test:e2e     # build + navigateur : parcours complet, clavier, axe WCAG 2.2 AA, CSP
```

Ce que les tests prouvent :

- un **anonyme ne lit rien** (toutes les tables, vues et fonctions) ;
- l'entreprise **A ne voit pas** les demandes, déblocages ou crédits de **B**, et rien du tout
  sans TOTP ou tant qu'elle n'est pas validée ;
- **aucune coordonnée avant déblocage** ; déblocage = 1 crédit, 35 € TTC enregistrés,
  idempotent, 3 maximum puis demande clôturée ;
- matching 3 maximum, métier + zone + budget + statut, **rotation 3/3/3/3** ;
- code SMS haché, 5 essais, expiration, renvoi limité, doublons 30 jours, limites par IP ;
- effacement réel (coordonnées, demandes, codes, compteurs) ;
- **règles de communication** : jamais « indépendant », « les meilleures »,
  « sélectionnées pour vous », ni prix, crédit ou paiement des entreprises côté particulier ;
  mention des aides wallonnes présente ; aucun lien sortant ; **aucun orange** côté particulier.

Lighthouse (build local) : performance 99 (mobile) / 100 (bureau), accessibilité 100,
bonnes pratiques 100. Le SEO est volontairement bas : page de pub en `noindex`.

## Mise en ligne (NON faite — à lancer seulement sur feu vert)

1. Créer un projet Supabase dédié (région UE) + un projet de développement.
2. `supabase db push` (migrations), activer `pg_cron` (maintenance horaire).
3. `supabase secrets set …` (voir `.env.example`), puis
   `supabase functions deploy public-api --no-verify-jwt`.
4. Remplacer `[PROJET]` dans `vercel.json`, déployer `dist/`, DNS `connect.pxlstudio.be`.
5. Remplir tous les `[À COMPLÉTER]` et faire valider les pages légales.

## [À COMPLÉTER]

Adresse et e-mail de contact affichés · e-mail de notification admin · numéro / régime de TVA ·
hébergeur final · texte « Qui est derrière RénoDevis » · durée exacte d'expiration ·
identifiants Meta / Google (si pixels) · arrondissement judiciaire des CGV.

## Décisions juridiques signalées (détail dans les brouillons)

1. **Ne jamais dire aux particuliers que les entreprises paient** : à faire confirmer
   (risque d'omission trompeuse, Code de droit économique livre VI).
2. Base légale de la transmission : consentement ou mesures précontractuelles.
3. Communiquer ou non au particulier le nom des entreprises qui ont reçu ses coordonnées.
4. Trace anonyme du consentement après effacement ; durées de conservation.
5. Mesure d'audience sans cookie sans consentement (art. 10/2 loi du 13 juin 2005).
6. Turnstile « strictement nécessaire » ; transferts hors UE (Cloudflare, hébergeur).
7. Vérifications réelles des entreprises (BCE seule ?) — ne rien promettre de plus.
8. Limitations de responsabilité (B2C : art. VI.82 s. CDE ; B2B : loi du 4 avril 2019).
9. Qualification RGPD entreprise ↔ plateforme après déblocage.
10. Validité des crédits, TVA, facturation ; nom « RénoDevis » (marque, domaine).

## Phase 2 (prête côté base, pas d'interface)

Inscription entreprise (Supabase Auth + TOTP obligatoire), validation manuelle, liste des
demandes avec filtres, bouton « Débloquer » (`rd_unlock`), « Signaler » (`rd_report`),
notification aux entreprises en cas d'effacement, acceptation versionnée des CGV.
