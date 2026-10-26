#!/usr/bin/env python3
"""Génère les pages légales (brouillons) à partir d'un gabarit commun.
Usage : python3 tools/build-legal.py   (réécrit legal/*.html et pro/cgv.html)"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TODO = lambda t: f'<span class="todo">[À COMPLÉTER : {t}]</span>'
DEC = lambda t: f'<span class="decision"><strong>[DÉCISION JURIDIQUE]</strong> {t}</span>'

FOOT_PART = """
  <footer class="site-footer">
    <div class="container">
      <p><strong>RénoDevis</strong> est un service de Pixel Studio (Logan Fontaine), BCE BE 1032.720.495.</p>
      <nav aria-label="Informations légales"><ul>
        <li><a href="/legal/mentions-legales.html">Mentions légales</a></li>
        <li><a href="/legal/confidentialite.html">Confidentialité</a></li>
        <li><a href="/legal/conditions-utilisation.html">Conditions d'utilisation</a></li>
        <li><a href="/legal/cookies.html">Cookies</a></li>
        <li><a href="/effacement.html">Supprimer mes données</a></li>
      </ul></nav>
    </div>
  </footer>"""

FOOT_PRO = """
  <footer class="site-footer">
    <div class="container">
      <p><strong>RénoDevis Pro</strong> est un service de Pixel Studio (Logan Fontaine), BCE BE 1032.720.495.</p>
    </div>
  </footer>"""

def page(title, desc, body, css="particulier", brand="RénoDevis", foot=FOOT_PART):
    return f"""<!doctype html>
<html lang="fr-BE">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} | {brand}</title>
  <meta name="description" content="{desc}">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/src/styles/{css}.css">
</head>
<body>
  <a class="skip-link" href="#contenu">Aller au contenu</a>
  <header class="page-top">
    <div class="container"><span class="brand brand-dark"><span class="brand-pixel" aria-hidden="true"></span>{brand}</span></div>
  </header>
  <main id="contenu" class="legal">
    <div class="container">
      <p class="draft-note"><strong>Brouillon — à faire valider par un juriste avant toute mise en ligne.</strong>
      Les mentions <span class="todo">[À COMPLÉTER]</span> sont des données manquantes ; les encadrés « décision juridique » sont des choix à trancher.</p>
{body}
      <p><em>Version : brouillon du 27 octobre 2026.</em></p>
    </div>
  </main>{foot}
</body>
</html>
"""

MENTIONS = f"""
      <h1>Mentions légales</h1>
      <h2>Éditeur du service</h2>
      <ul>
        <li>Service : RénoDevis (nom de travail) {DEC("vérifier la disponibilité du nom (marques Benelux, dénominations) et du nom de domaine.")}</li>
        <li>Exploitant : Pixel Studio, entreprise de Logan Fontaine {DEC("préciser la forme juridique exacte (personne physique ou société) telle qu'inscrite à la BCE.")}</li>
        <li>Numéro d'entreprise (BCE) : BE 1032.720.495</li>
        <li>Adresse du siège : {TODO("adresse géographique complète")}</li>
        <li>E-mail : {TODO("adresse de contact")}</li>
        <li>Téléphone : {TODO("facultatif")}</li>
        <li>TVA : {TODO("numéro de TVA, ou mention du régime de franchise si applicable")}</li>
        <li>Responsable de la publication : Logan Fontaine</li>
      </ul>
      <h2>Rôle de RénoDevis</h2>
      <p>RénoDevis est un service de mise en relation entre des particuliers qui ont un projet de rénovation et des entreprises partenaires vérifiées. RénoDevis n'exécute aucun travail, n'établit aucun devis et n'est pas partie aux contrats conclus entre les particuliers et les entreprises.</p>
      <h2>Hébergement et prestataires techniques</h2>
      <ul>
        <li>Hébergement du site : {TODO("Vercel Inc. ou Cloudflare, Inc. — selon le choix final, avec adresse")}</li>
        <li>Base de données : Supabase (serveurs dans l'Union européenne, région {TODO("région du projet")})</li>
        <li>Envoi des SMS et e-mails : Brevo (Sendinblue SAS, France)</li>
        <li>Protection anti-robot : Cloudflare Turnstile (Cloudflare, Inc.)</li>
      </ul>
      {DEC("vérifier les conventions de sous-traitance (art. 28 RGPD) et les garanties de transfert hors UE pour chaque prestataire.")}
      <h2>Propriété intellectuelle</h2>
      <p>Les textes, visuels et éléments graphiques de ce site appartiennent à Pixel Studio. Toute reproduction sans autorisation est interdite.</p>
"""

CONFID = f"""
      <h1>Politique de confidentialité</h1>
      <p>Cette politique concerne la plateforme RénoDevis. Elle est distincte de la politique de confidentialité du site pxlstudio.be.</p>

      <h2>1. Qui est responsable de vos données ?</h2>
      <p>Pixel Studio (Logan Fontaine), BCE BE 1032.720.495, {TODO("adresse")}, {TODO("e-mail de contact pour la vie privée")}.</p>

      <h2>2. Quelles données ?</h2>
      <ul>
        <li><strong>Votre projet</strong> : type de projet, nombre de fenêtres et de portes, budget estimé, délai, code postal et commune.</li>
        <li><strong>Vos coordonnées</strong> : prénom, numéro de GSM, adresse e-mail.</li>
        <li><strong>La preuve de votre accord</strong> : date et heure, version exacte du texte accepté, adresse IP sous forme hachée (non réversible).</li>
        <li><strong>Sécurité</strong> : codes SMS (enregistrés uniquement sous forme hachée), compteurs anti-abus basés sur l'IP et le numéro hachés.</li>
        <li><strong>Mesure d'audience</strong> : étapes du formulaire parcourues, page, source de la campagne publicitaire (paramètres « utm »), rattachées à un identifiant aléatoire qui disparaît quand vous fermez la page. Aucun cookie n'est utilisé pour cela.</li>
      </ul>

      <h2>3. Pourquoi et sur quelle base ?</h2>
      <table>
        <thead><tr><th>Finalité</th><th>Base légale</th></tr></thead>
        <tbody>
          <tr><td>Transmettre votre demande à trois entreprises partenaires au maximum pour qu'elles vous proposent un devis</td><td>Votre consentement (case à cocher) {DEC("consentement (art. 6.1.a) ou mesures précontractuelles à votre demande (art. 6.1.b) ; le choix change les conséquences d'un retrait.")}</td></tr>
          <tr><td>Vérifier votre numéro par SMS, éviter les fausses demandes et les abus</td><td>Intérêt légitime (sécurité du service)</td></tr>
          <tr><td>Conserver la preuve de votre accord</td><td>Intérêt légitime / obligation de preuve</td></tr>
          <tr><td>Mesurer l'efficacité de nos campagnes (statistiques internes, sans cookie)</td><td>Intérêt légitime {DEC("confirmer qu'aucun consentement n'est requis pour cette mesure sans stockage sur l'appareil (art. 10/2 de la loi du 13 juin 2005).")}</td></tr>
          <tr><td>Traceurs publicitaires (Meta, Google), s'ils sont activés</td><td>Votre consentement (bandeau), voir la page Cookies</td></tr>
        </tbody>
      </table>

      <h2>4. Qui reçoit vos données ?</h2>
      <ul>
        <li><strong>Trois entreprises partenaires vérifiées au maximum</strong>, choisies selon le type de travaux, votre commune et votre budget, à tour de rôle. Avant de vous contacter, elles voient uniquement un aperçu anonyme (projet, budget, délai, commune) ; vos coordonnées ne leur sont communiquées que lorsqu'elles décident de donner suite à votre demande.
        Une fois vos coordonnées reçues, chaque entreprise est responsable de leur utilisation pour vous recontacter. {DEC("faut-il communiquer au particulier le nom des entreprises qui ont reçu ses coordonnées (recommandé pour l'exercice de ses droits) ?")}</li>
        <li><strong>Nos prestataires techniques</strong>, qui agissent sur nos instructions : Supabase (base de données, UE), {TODO("hébergeur du site")}, Brevo (SMS et e-mails, France), Cloudflare (protection anti-robot). {DEC("lister les transferts hors UE éventuels (Cloudflare, hébergeur) et leurs garanties (décision d'adéquation EU-US, clauses types).")}</li>
      </ul>
      <p>Nous ne vendons jamais vos données.</p>

      <h2>5. Combien de temps ?</h2>
      <table>
        <thead><tr><th>Données</th><th>Durée</th></tr></thead>
        <tbody>
          <tr><td>Demande jamais confirmée par SMS</td><td>Supprimée après 24 heures</td></tr>
          <tr><td>Demande et coordonnées</td><td>12 mois après la fin de la demande (clôture ou expiration après {TODO("30 jours, à confirmer")})</td></tr>
          <tr><td>Codes SMS et compteurs anti-abus</td><td>48 heures</td></tr>
          <tr><td>Statistiques d'audience</td><td>12 mois</td></tr>
          <tr><td>Preuve de consentement</td><td>5 ans ; en cas d'effacement, seule une trace anonyme (date et version du texte) est conservée</td></tr>
        </tbody>
      </table>
      {DEC("valider ces durées, et le principe de garder une trace anonyme du consentement après effacement.")}

      <h2>6. Vos droits</h2>
      <p>Vous pouvez demander l'accès à vos données, leur rectification, leur effacement, la limitation du traitement, vous opposer au traitement fondé sur l'intérêt légitime et retirer votre consentement à tout moment (sans effet sur les transmissions déjà faites).</p>
      <p><strong>Effacement</strong> : directement depuis la page <a href="/effacement.html">Supprimer mes données</a> (confirmation par code SMS) ; vos données sont alors réellement supprimées de notre base. Pour les autres droits : {TODO("e-mail de contact")}. Nous répondons dans un délai d'un mois.</p>
      <p>Vous pouvez introduire une réclamation auprès de l'Autorité de protection des données, rue de la Presse 35, 1000 Bruxelles.</p>

      <h2>7. Sécurité</h2>
      <p>Connexions chiffrées, accès strictement limités, coordonnées stockées séparément du reste de la demande et accessibles uniquement aux entreprises auxquelles votre demande est attribuée, après leur décision d'y donner suite. Les numéros, adresses IP et codes servant aux contrôles anti-abus sont hachés.</p>

      <h2>8. Décision automatisée</h2>
      <p>Le choix des entreprises qui reçoivent votre demande est automatique (type de travaux, commune, budget, rotation). Il ne produit aucun effet juridique à votre égard : vous restez libre d'accepter ou non un devis.</p>

      <h2>9. Âge</h2>
      <p>Le service est réservé aux personnes majeures.</p>
"""

CGU = f"""
      <h1>Conditions d'utilisation</h1>
      <p>Ces conditions s'appliquent aux particuliers qui utilisent RénoDevis pour demander un devis.</p>

      <h2>1. Le service</h2>
      <p>RénoDevis met gratuitement en relation des particuliers qui ont un projet de rénovation avec des entreprises partenaires vérifiées. Vous décrivez votre projet, vous confirmez votre numéro par SMS, et votre demande est proposée à trois entreprises au maximum, qui peuvent vous recontacter pour établir un devis.</p>
      <p>RénoDevis n'exécute aucun travail et n'est pas partie au contrat que vous concluez éventuellement avec une entreprise.</p>
      {DEC("informations à donner au consommateur sur le modèle économique de la plateforme et sur les principaux paramètres de choix des entreprises (Code de droit économique, livre VI). Votre consigne actuelle est de ne jamais mentionner sur les pages particuliers que les entreprises paient : un juriste doit confirmer que cette absence de mention n'est pas une omission trompeuse.")}

      <h2>2. Gratuit et sans engagement</h2>
      <p>Le service est gratuit pour vous. Vous n'êtes jamais obligé d'accepter un devis.</p>

      <h2>3. Comment les entreprises sont choisies</h2>
      <p>Votre demande est proposée à trois entreprises au maximum, choisies parmi les entreprises partenaires vérifiées selon : le type de travaux, la zone où elles interviennent (votre commune ou code postal) et le budget qu'elles acceptent. Quand plus de trois entreprises correspondent, les demandes sont réparties à tour de rôle. Avant d'activer une entreprise, nous vérifions à la main son inscription à la Banque-Carrefour des Entreprises.</p>
      {DEC("préciser les vérifications réellement effectuées (BCE seule, ou aussi assurance, accès à la profession…) et ne jamais en promettre davantage.")}

      <h2>4. Vos engagements</h2>
      <ul>
        <li>Être majeur et utiliser votre propre numéro de GSM.</li>
        <li>Donner des informations exactes et ne faire qu'une demande réelle par projet.</li>
        <li>Ne pas utiliser le service à des fins de démarchage, de test ou de nuisance.</li>
      </ul>
      <p>Une même demande (même numéro, même type de travaux) ne peut être envoyée qu'une fois par période de 30 jours.</p>

      <h2>5. Aides et primes</h2>
      <p>RénoDevis ne promet aucune prime et aucun montant d'aide. Les règles des aides wallonnes ont changé le 1er octobre 2026 et peuvent encore évoluer ; renseignez-vous auprès du Service public de Wallonie avant de signer un devis.</p>

      <h2>6. Responsabilité</h2>
      <p>Les devis, prix, délais et travaux relèvent uniquement des entreprises. RénoDevis s'engage à vérifier les entreprises comme décrit ci-dessus et à faire fonctionner le service avec soin.</p>
      {DEC("étendue de la limitation de responsabilité vis-à-vis d'un consommateur (clauses abusives, art. VI.82 et suivants CDE).")}

      <h2>7. Données personnelles</h2>
      <p>Voir notre <a href="/legal/confidentialite.html">politique de confidentialité</a>. Vous pouvez faire supprimer vos données à tout moment depuis la page <a href="/effacement.html">Supprimer mes données</a>.</p>

      <h2>8. Droit applicable et litiges</h2>
      <p>Ces conditions sont soumises au droit belge. En cas de difficulté, contactez-nous d'abord : {TODO("e-mail de contact")}. Vous pouvez aussi vous adresser au Service de médiation pour le consommateur.</p>
      {DEC("valider la clause de juridiction applicable aux consommateurs.")}
"""

COOKIES = f"""
      <h1>Cookies et traceurs</h1>
      <h2>Par défaut : aucun cookie</h2>
      <p>Le formulaire de demande de devis ne dépose aucun cookie et n'enregistre rien sur votre appareil. Nos statistiques internes (étapes du formulaire, source de la campagne) utilisent un identifiant aléatoire gardé en mémoire le temps de votre visite, puis oublié.</p>
      <p>Si votre navigateur envoie le signal « Do Not Track » ou « Global Privacy Control », ces statistiques ne sont pas enregistrées.</p>

      <h2>Protection anti-robot</h2>
      <p>À l'étape des coordonnées, le service Cloudflare Turnstile vérifie que la demande ne vient pas d'un robot. Ce contrôle est nécessaire à la sécurité du service.</p>
      {DEC("confirmer que Turnstile relève de l'exemption « strictement nécessaire » et décrire ce qu'il lit ou dépose sur l'appareil, selon la documentation de Cloudflare.")}

      <h2>Traceurs publicitaires (uniquement avec votre accord)</h2>
      <p>Si nous activons la mesure de nos annonces, les traceurs de Meta (Facebook, Instagram) et de Google ne sont chargés <strong>qu'après votre accord</strong>, donné dans un bandeau où « Refuser » est aussi simple qu'« Accepter ». Votre choix est mémorisé dans votre navigateur et vous pouvez le modifier à tout moment depuis le lien « Gérer les cookies » en bas de page.</p>
      <table>
        <thead><tr><th>Traceur</th><th>Finalité</th><th>Durée</th></tr></thead>
        <tbody>
          <tr><td>Meta Pixel</td><td>Mesurer les demandes issues de nos annonces Meta</td><td>{TODO("selon la documentation Meta")}</td></tr>
          <tr><td>Google (gtag)</td><td>Mesurer les demandes issues de nos annonces Google</td><td>{TODO("selon la documentation Google")}</td></tr>
          <tr><td>rd-consent-pixels-v1 (stockage local)</td><td>Mémoriser votre choix</td><td>Jusqu'à ce que vous le changiez</td></tr>
        </tbody>
      </table>
      {DEC("durée de validité du choix (souvent 6 à 12 mois) et liste exacte des cookies déposés par Meta et Google.")}
"""

CGV = f"""
      <h1>Conditions générales — entreprises</h1>
      <p>Version <strong>cgv-entreprises-2026-10-v1</strong> (brouillon). Chaque version est acceptée en ligne et conservée avec sa date d'acceptation.</p>

      <h2>1. Objet</h2>
      <p>RénoDevis propose aux entreprises de rénovation des demandes de devis de particuliers, confirmées par SMS. L'entreprise peut <strong>débloquer</strong> les coordonnées d'un particulier pour le recontacter.</p>

      <h2>2. Inscription et vérification</h2>
      <ul>
        <li>Inscription avec le nom de l'entreprise, son numéro BCE, une adresse e-mail professionnelle vérifiée, les métiers, la zone d'intervention et le budget minimum accepté.</li>
        <li>Mot de passe robuste et <strong>double authentification (application TOTP) obligatoire</strong>.</li>
        <li>Chaque inscription est <strong>validée manuellement</strong> par RénoDevis (vérification BCE) avant activation. RénoDevis peut refuser une inscription.</li>
      </ul>
      {DEC("vérifications complémentaires à exiger (assurance responsabilité civile, accès à la profession) et conséquences si elles manquent.")}

      <h2>3. Les demandes : un contact NON exclusif</h2>
      <ul>
        <li><strong>Chaque demande est partagée avec trois entreprises au maximum.</strong> Le contact n'est jamais exclusif.</li>
        <li>Sur chaque demande, l'espace entreprise indique combien d'entreprises l'ont déjà débloquée (par exemple : « 1 entreprise sur 3 a déjà débloqué »).</li>
        <li>Les demandes sont attribuées selon le métier, la zone, le budget minimum et le statut « validée » de l'entreprise, avec une répartition à tour de rôle entre entreprises éligibles.</li>
        <li>Avant déblocage, l'entreprise voit un aperçu anonyme : projet, travaux, détail, budget, délai, commune et code postal.</li>
        <li>Une demande expire après {TODO("30 jours, à confirmer")} ou dès que trois entreprises l'ont débloquée.</li>
        <li>RénoDevis ne garantit ni un volume de demandes, ni la signature d'un contrat.</li>
      </ul>

      <h2>4. Prix et crédits</h2>
      <ul>
        <li>Le prix d'un déblocage est fixe, quel que soit le délai du projet. Il est affiché dans l'espace entreprise, TVA comprise, avant chaque déblocage.</li>
        <li>Au lancement, l'entreprise achète des crédits par virement, sur facture. Un déblocage consomme un crédit.</li>
        <li>Un second affichage d'un contact déjà débloqué ne consomme pas de nouveau crédit.</li>
        <li>Le paiement en ligne (Mollie, Bancontact) sera proposé ultérieurement.</li>
      </ul>
      {DEC("durée de validité des crédits, remboursement du solde en cas de résiliation, mentions de facturation et régime de TVA applicable.")}

      <h2>5. Signalement et remboursement en crédit</h2>
      <p>L'entreprise peut signaler un contact dans les 7 jours qui suivent son déblocage :</p>
      <ul>
        <li><strong>Faux numéro</strong> : le numéro n'est pas attribué ou n'appartient pas au demandeur.</li>
        <li><strong>Injoignable</strong> : le particulier reste injoignable après <strong>3 appels</strong>, à des moments différents (au moins une heure d'intervalle). L'entreprise indique la date et l'heure de chaque appel.</li>
      </ul>
      <p>Chaque signalement est examiné par RénoDevis. S'il est accepté, <strong>1 crédit est rendu</strong>. Un seul signalement par déblocage. Les signalements abusifs peuvent entraîner une suspension.</p>

      <h2>6. Utilisation des contacts</h2>
      <ul>
        <li>Le contact sert <strong>uniquement</strong> à répondre à la demande reçue.</li>
        <li><strong>Revente, cession, location ou partage interdits</strong>, de même que l'ajout à une liste de prospection ou de newsletter.</li>
        <li>Après déblocage, l'entreprise est responsable du traitement des données qu'elle a reçues (RGPD). Elle répond aux demandes d'effacement que RénoDevis lui transmet.</li>
      </ul>
      {DEC("qualification RGPD de la relation (responsables distincts ou conjoints) et éventuel accord de transfert de données.")}

      <h2>7. Suspension et résiliation</h2>
      <p>RénoDevis peut suspendre un compte en cas de manquement (usage abusif des contacts, signalements abusifs, informations inexactes). L'entreprise peut fermer son compte à tout moment.</p>

      <h2>8. Responsabilité</h2>
      <p>RénoDevis s'engage à faire fonctionner le service avec soin (obligation de moyens) et à vérifier les demandes par SMS. RénoDevis ne garantit pas que le particulier signera un devis.</p>
      {DEC("plafond de responsabilité B2B (loi du 4 avril 2019 sur les clauses abusives entre entreprises).")}

      <h2>9. Données de l'entreprise</h2>
      <p>RénoDevis traite les données des utilisateurs entreprises (identité, e-mail, journal de connexion, factures) pour gérer le compte, la facturation et la sécurité. Les données de facturation sont conservées 7 ans (obligation comptable).</p>

      <h2>10. Modifications</h2>
      <p>Toute nouvelle version des présentes conditions est notifiée et doit être acceptée en ligne avant de continuer à débloquer des demandes.</p>

      <h2>11. Droit applicable</h2>
      <p>Droit belge. Tribunaux de {TODO("arrondissement judiciaire du siège")}.</p>
"""

out = {
  "legal/mentions-legales.html": page("Mentions légales", "Mentions légales de RénoDevis, service de Pixel Studio.", MENTIONS),
  "legal/confidentialite.html": page("Politique de confidentialité", "Comment RénoDevis traite vos données personnelles.", CONFID),
  "legal/conditions-utilisation.html": page("Conditions d'utilisation", "Conditions d'utilisation de RénoDevis pour les particuliers.", CGU),
  "legal/cookies.html": page("Cookies", "Cookies et traceurs utilisés par RénoDevis.", COOKIES),
  "pro/cgv.html": page("Conditions générales entreprises", "Conditions générales de RénoDevis pour les entreprises partenaires.", CGV, css="pro", brand="RénoDevis Pro", foot=FOOT_PRO),
}
for path, html in out.items():
    (ROOT / path).write_text(html, encoding="utf-8")
    print("écrit", path)
