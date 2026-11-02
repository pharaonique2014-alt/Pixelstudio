# Belora – site de test

Site de démonstration complet pour Belora (sorties et rencontres 50+). Il fonctionne sans serveur :
toutes les données restent dans le navigateur (localStorage). Aucun SMS ni paiement réel.

## Lancer

    cd belora-site
    python3 -m http.server 8000      # puis ouvrir http://localhost:8000

(ou simplement ouvrir `index.html`.)

## Parcours à tester

1. **Inscription** : GSM belge (04…) ou français (06/07…) → code SMS de démo `123456` → profil (50 ans minimum, CGU obligatoires).
2. **Activités** : filtres par ville, distance, catégorie et recherche ; « Je participe ».
3. **Essai gratuit 7 jours** : démarre à la première inscription à une sortie, sans carte bancaire.
   Avant l'essai, les profils des participants sont floutés (seul le prénom est visible).
4. **Messagerie** (abonnés/essai) : réponses automatiques ; alerte anti-arnaque si le message parle de virement, WhatsApp, IBAN, etc.
   Le membre « Gérard » envoie volontairement des messages suspects pour tester l'alerte.
5. **Signaler / bloquer** une personne ou une activité.
6. **Abonnement** : 19,99 €/mois, 49 € / 3 mois, 149 € / 12 mois (paiement simulé), résiliation en un clic.
7. **Mes sorties** : avis après la sortie (« Souhaitez-vous revoir… »).
8. **Profil → Outils de démonstration** : avancer le temps de 1 ou 7 jours pour voir la fin de l'essai et les sorties passées.
9. **Admin** (`#/admin`, code `belora-test`) : statistiques, signalements, ajout manuel d'activités (celles trouvées dans les groupes ou agendas locaux), suspension de membres.

Accessibilité : gros boutons, texte agrandissable (bouton « A » en haut), contraste élevé, navigation simple en 4 onglets.

## Pour passer en vraie version

| Brique | Dans la démo | Vraie version |
|---|---|---|
| Comptes + vérification GSM | code fixe `123456` | Supabase Auth (téléphone) + fournisseur SMS (Twilio Verify…) |
| Données | localStorage | Supabase (Postgres) avec règles RLS : le flou des profils doit être appliqué **côté serveur** |
| Paiement | simulé | Stripe (carte, Bancontact), essai 7 jours et résiliation en un clic |
| Admin | code dans le navigateur | rôle admin protégé côté serveur |
| Activités | saisie manuelle | saisie manuelle + import d'agendas ouverts (OpenAgenda, DATAtourisme) avec l'accord des organisateurs |

Les textes « Conditions » et « Confidentialité » sont des brouillons à faire valider par un juriste.

## Mettre le site en ligne pour un testeur

Le dossier `dist/` contient le site en **un seul fichier** (`index.html`, tout est inclus) et un `vercel.json`
qui demande aux moteurs de recherche de ne pas l'indexer. Trois façons d'obtenir un lien public :

- **Vercel** : importer ce dépôt (GitHub) et choisir `belora-site/dist` comme « Root Directory », sans commande de build.
- **Netlify Drop** (app.netlify.com/drop) : glisser le fichier `dist/index.html` (ou le dossier `dist`), le lien est créé tout de suite.
- **GitHub Pages** : activer Pages sur le dépôt et publier le dossier `belora-site/dist`.

Chaque testeur a ses propres données (elles restent dans son navigateur) : rien n'est partagé entre testeurs.
Pour reconstruire `dist/index.html` après une modification : minifier et assembler `css/style.css`, `js/*.js` et le logo.
