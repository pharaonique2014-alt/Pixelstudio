/* Pixie — assistante Pixel Studio */
(function () {
'use strict';

var SHOP = /shop\.html/i.test(location.pathname);
var MAIL = 'projets@pxlstudio.be';
var TEL  = '0470 55 73 56';

var CSS = ''
+ '#pxb{position:fixed;right:18px;bottom:18px;z-index:9998;width:62px;height:62px;border:none;border-radius:50%;'
+ 'background:linear-gradient(145deg,#e8873a,#c25f1c);box-shadow:0 12px 32px rgba(217,119,43,.42),0 3px 10px rgba(0,0,0,.5);'
+ 'cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .25s;padding:0}'
+ '#pxb:active{transform:scale(.94)}#pxb svg{width:38px;height:38px;display:block}'
+ '#pxb .dot{position:absolute;top:2px;right:2px;width:15px;height:15px;border-radius:50%;background:#5fe0a0;'
+ 'border:2.5px solid #0b0a08;opacity:0;transform:scale(.4);transition:.3s}'
+ '#pxb.alert .dot{opacity:1;transform:scale(1)}'
+ '@keyframes pxPulse{0%,100%{box-shadow:0 12px 32px rgba(217,119,43,.42),0 0 0 0 rgba(217,119,43,.5)}'
+ '50%{box-shadow:0 12px 32px rgba(217,119,43,.42),0 0 0 14px rgba(217,119,43,0)}}'
+ '#pxb.ping{animation:pxPulse 2.2s ease-out 3}'
+ '#pxtip{position:fixed;right:88px;bottom:32px;z-index:9997;max-width:210px;background:#12100e;'
+ 'border:1px solid rgba(214,160,96,.4);border-radius:14px;border-bottom-right-radius:4px;padding:11px 14px;'
+ 'color:#e4e1dc;font-size:12.6px;line-height:1.5;font-family:Montserrat,Helvetica,Arial,sans-serif;'
+ 'box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;visibility:hidden;transform:translateX(10px);transition:.3s;cursor:pointer}'
+ '#pxtip.on{opacity:1;visibility:visible;transform:none}'
+ '#pxw{position:fixed;right:18px;bottom:92px;z-index:9999;width:min(374px,calc(100vw - 36px));'
+ 'height:min(580px,calc(100vh - 140px));background:#12100e;border:1px solid rgba(255,255,255,.11);'
+ 'border-radius:18px;box-shadow:0 26px 70px rgba(0,0,0,.6);display:flex;flex-direction:column;'
+ 'overflow:hidden;opacity:0;visibility:hidden;transform:translateY(16px) scale(.97);'
+ 'transition:opacity .26s,transform .26s,visibility .26s;font-family:Montserrat,Helvetica,Arial,sans-serif}'
+ '#pxw.open{opacity:1;visibility:visible;transform:none}'
+ '#pxw .hd{display:flex;align-items:center;gap:11px;padding:14px 16px;'
+ 'background:linear-gradient(135deg,rgba(217,119,43,.2),rgba(217,119,43,.05));'
+ 'border-bottom:1px solid rgba(255,255,255,.09);flex-shrink:0}'
+ '#pxw .hd .av{width:38px;height:38px;flex-shrink:0}'
+ '#pxw .hd b{display:block;color:#edeae5;font-size:14.5px;font-family:"Playfair Display",Georgia,serif;font-weight:600}'
+ '#pxw .hd i{display:block;font-style:normal;color:#5fe0a0;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;margin-top:1px}'
+ '#pxw .hd .x{margin-left:auto;background:transparent;border:1px solid rgba(255,255,255,.13);color:rgba(228,225,220,.6);'
+ 'border-radius:50%;width:29px;height:29px;font-size:13px;cursor:pointer;flex-shrink:0}'
+ '#pxbody{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:11px;scroll-behavior:smooth}'
+ '#pxbody::-webkit-scrollbar{width:5px}#pxbody::-webkit-scrollbar-thumb{background:rgba(255,255,255,.13);border-radius:3px}'
+ '.pxm{max-width:87%;padding:11px 14px;border-radius:15px;font-size:13.3px;line-height:1.62;white-space:pre-wrap;word-break:break-word}'
+ '.pxm.b{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);color:#e4e1dc;'
+ 'border-bottom-left-radius:5px;align-self:flex-start}'
+ '.pxm.u{background:linear-gradient(140deg,#d9772b,#b8571a);color:#fff;border-bottom-right-radius:5px;align-self:flex-end}'
+ '.pxm b{color:#d6a060}.pxm.u b{color:#fff}.pxm a{color:#d6a060}'
+ '.pxq{display:flex;flex-wrap:wrap;gap:6px}'
+ '.pxq button{background:rgba(217,119,43,.11);border:1px solid rgba(214,160,96,.38);color:#d6a060;'
+ 'border-radius:15px;padding:8px 13px;font-size:11.8px;cursor:pointer;font-family:inherit;transition:.15s;text-align:left}'
+ '.pxq button:active{transform:scale(.96);background:rgba(217,119,43,.2)}'
+ '.pxprod{display:flex;gap:10px;align-items:center;background:rgba(255,255,255,.05);'
+ 'border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:10px;cursor:pointer;transition:.15s}'
+ '.pxprod:active{transform:scale(.98);border-color:rgba(214,160,96,.5)}'
+ '.pxprod .e{font-size:21px;flex-shrink:0}.pxprod .t{flex:1;min-width:0}'
+ '.pxprod .t b{display:block;color:#edeae5;font-size:12.8px;font-weight:600}'
+ '.pxprod .t i{font-style:normal;color:rgba(228,225,220,.55);font-size:11px;display:block}'
+ '.pxprod .p{color:#d6a060;font-size:12px;font-weight:700;white-space:nowrap}'
+ '.pxwhy{font-size:11.6px;color:rgba(228,225,220,.6);font-style:italic;margin:-4px 0 2px 4px;align-self:flex-start}'
+ '.pxtyp{align-self:flex-start;display:flex;gap:4px;padding:12px 15px;background:rgba(255,255,255,.06);'
+ 'border-radius:15px;border-bottom-left-radius:5px}'
+ '.pxtyp span{width:6px;height:6px;border-radius:50%;background:rgba(228,225,220,.5);animation:pxT 1.3s infinite}'
+ '.pxtyp span:nth-child(2){animation-delay:.18s}.pxtyp span:nth-child(3){animation-delay:.36s}'
+ '@keyframes pxT{0%,60%,100%{opacity:.28;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}'
+ '#pxfoot{border-top:1px solid rgba(255,255,255,.09);padding:11px 12px;display:flex;gap:8px;flex-shrink:0;background:rgba(0,0,0,.22)}'
+ '#pxin{flex:1;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.11);color:#e4e1dc;'
+ 'border-radius:20px;padding:10px 15px;font-size:13.4px;font-family:inherit;min-width:0}'
+ '#pxin:focus{outline:none;border-color:#d6a060}'
+ '#pxsend{background:linear-gradient(145deg,#e8873a,#c25f1c);border:none;color:#fff;border-radius:50%;'
+ 'width:38px;height:38px;font-size:15px;cursor:pointer;flex-shrink:0}#pxsend:active{transform:scale(.93)}'
+ '@media(max-width:480px){#pxw{right:10px;left:10px;width:auto;bottom:84px;height:min(540px,calc(100vh - 118px))}'
+ '#pxb{right:14px;bottom:14px;width:56px;height:56px}#pxb svg{width:34px;height:34px}#pxtip{display:none}}'
+ '@media (prefers-reduced-motion:reduce){#pxb.ping{animation:none}.pxtyp span{animation:none}}';

/* Avatar « pixel casqué + micro » — 2 palettes :
   clair (pastille orange) / sombre (fond foncé de l'en-tête) */
function avatar(size, dark) {
  var s = size || 38;
  var A = dark ? '#e8873a' : '#fff';      // visage
  var B = dark ? '#d6a060' : '#ffd9b8';   // casque + micro
  var C = dark ? '#12100e' : '#c25f1c';   // yeux + sourire
  return '<svg viewBox="0 0 48 48" width="' + s + '" height="' + s + '" xmlns="http://www.w3.org/2000/svg">'
  + '<path d="M9 26 v-3 a15 15 0 0 1 30 0 v3" stroke="' + B + '" stroke-width="3" fill="none" stroke-linecap="round"/>'
  + '<rect x="4" y="24" width="7" height="11" rx="3.5" fill="' + B + '"/>'
  + '<rect x="37" y="24" width="7" height="11" rx="3.5" fill="' + B + '"/>'
  + '<rect x="13" y="17" width="22" height="22" rx="7" fill="' + A + '"/>'
  + '<rect x="17.5" y="23.5" width="5.4" height="5.4" rx="1.3" fill="' + C + '"/>'
  + '<rect x="25.1" y="23.5" width="5.4" height="5.4" rx="1.3" fill="' + C + '"/>'
  + '<path d="M20 34.5 Q24 37.5 28 34.5" stroke="' + C + '" stroke-width="2" fill="none" stroke-linecap="round"/>'
  + '<path d="M40.5 34 Q42 42 33.5 42.5" stroke="' + B + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
  + '<circle cx="32" cy="42.5" r="2.8" fill="' + B + '"/>'
  + '</svg>';
}

/* ══════════ TON ET VARIATIONS ══════════ */
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

var ACK = ['Très bien.', 'Parfait.', 'D\'accord.', 'Compris.', 'Bonne question.', 'Avec plaisir.'];
var NEXT = [
  'Autre chose que je peux éclaircir ?',
  'Vous voulez que je précise un point ?',
  'Une autre question ?',
  'Je peux vous aider sur autre chose ?'
];
var HOUR = (function () { var h = new Date().getHours(); return h < 6 ? 'nuit' : h < 12 ? 'matin' : h < 18 ? 'jour' : 'soir'; })();
var HELLO = HOUR === 'soir' || HOUR === 'nuit' ? 'Bonsoir' : 'Bonjour';

/* ══════════ PARCOURS GUIDÉS ══════════ */
var FLOWS = {
  anniversaire: {
    q: 'Un anniversaire, chouette 🎉 Dites-moi ce dont vous avez besoin en priorité :',
    o: [
      ['Inviter mes proches', 'inv|Pour les invitations, le format A6 est le grand classique : assez grand pour toutes les infos, assez petit pour l\'enveloppe standard. En 300 g, il a une vraie tenue en main.'],
      ['Décorer la salle', 'affA3,affA2|Une affiche personnalisée au-dessus du buffet, avec une photo ou l\'âge en grand, ça marque toujours. L\'A3 suffit pour une table, l\'A2 pour un mur.'],
      ['Remercier après', 'rem|Les cartes de remerciement font un effet fou et coûtent très peu. Beaucoup de clients y pensent après coup — vous, vous avez de l\'avance.'],
      ['Un peu de tout', 'inv,affA3,rem|Voici l\'ensemble cohérent : invitation, affiche pour la salle, et remerciements. Le même visuel décliné sur les trois, c\'est ce qui fait le plus d\'effet.']
    ]
  },
  mariage: {
    q: 'Félicitations ! 💍 Où en êtes-vous dans les préparatifs ?',
    o: [
      ['Les faire-parts', 'fpm|Le carré 130 × 130 mm est le format de référence pour un mariage. En papier nacré ou texturé, il donne immédiatement le ton.'],
      ['La décoration de table', 'menu|Les menus et marque-places au format 99 × 210 mm s\'intègrent parfaitement à une table dressée, et se déclinent au visuel de vos faire-parts.'],
      ['Les remerciements', 'rem|On les envoie généralement dans le mois. En 300 g nacré, ils sont dans la continuité du faire-part.'],
      ['Tout le nécessaire', 'fpm,menu,rem|La suite complète : faire-part, menus de table et remerciements. Commandez-les ensemble, ils partiront du même fichier et vous gagnerez sur les frais de port.']
    ]
  },
  salon: {
    q: 'Un salon ou une foire ? Bonne idée. Vous avez quoi comme espace ?',
    o: [
      ['Un stand classique', 'rollup|Le roll-up 85 × 200 cm est l\'incontournable : il se monte en 30 secondes, se transporte dans une housse et se réutilise pendant des années.'],
      ['Un grand stand', 'rollup100,band|En 100 cm de large, on vous voit de loin. La banderole complète bien si vous avez une structure ou une barrière à habiller.'],
      ['Un comptoir', 'fla5,cdv|Sur un comptoir, ce sont les flyers et les cartes de visite qui partent. Prévoyez large : un salon consomme vite.'],
      ['Je prépare tout', 'rollup,fla5,cdv|Le trio gagnant du salon : le roll-up qui attire, le flyer qu\'on emporte, la carte qu\'on garde. C\'est la combinaison que je vois le plus souvent fonctionner.']
    ]
  },
  ouverture: {
    q: 'Une ouverture, félicitations ! Vous voulez toucher les gens comment ?',
    o: [
      ['Dans le quartier', 'fla5,fla6|Le toutes-boîtes reste redoutablement efficace en local. L\'A5 laisse la place à une offre d\'ouverture, l\'A6 coûte moins cher au volume.'],
      ['Sur ma vitrine', 'vitro,affA2|La vitrophanie transforme une vitrine vide en publicité, et l\'affiche A2 annonce la date depuis le trottoir.'],
      ['Auprès des pros', 'cdv,dep1|La carte de visite pour les rencontres, le dépliant pour laisser une trace argumentée chez vos futurs partenaires.'],
      ['Le pack complet', 'fla5,vitro,cdv|Ce que je conseille pour une ouverture : le flyer pour le quartier, la vitrophanie pour la façade, les cartes pour le jour J.']
    ]
  },
  naissance: {
    q: 'Félicitations pour ce petit bout 👶 Vous en êtes où ?',
    o: [
      ['Annoncer la naissance', 'fpn|Le faire-part A6 en 300 g. Le papier nacré rend particulièrement bien les photos de nouveau-né.'],
      ['Remercier les cadeaux', 'rem|Une carte de remerciement avec une photo, c\'est le petit geste dont tout le monde se souvient.'],
      ['Les deux', 'fpn,rem|Faire-part et remerciements ensemble : même visuel, une seule commande, frais de port partagés.']
    ]
  },
  artisan: {
    q: 'Vous êtes sur les chantiers ? Voyons ce qui vous servira le plus :',
    o: [
      ['Me faire connaître', 'fla5,cdv|Le flyer dans les boîtes du quartier où vous intervenez, et la carte à laisser après chaque devis. C\'est le duo de base du bâtiment.'],
      ['Signaler mes chantiers', 'band,panneau|Une banderole sur l\'échafaudage ou un panneau devant la maison : vos chantiers deviennent vos meilleures publicités, gratuitement.'],
      ['Look professionnel', 'cdv,entete|Cartes de visite soignées et papier à en-tête pour vos devis. Un devis sur papier à en-tête, ça change la perception du prix.'],
      ['Tout d\'un coup', 'cdv,fla5,band|Le kit artisan : cartes, flyers et banderole de chantier. De quoi être visible partout où vous passez.']
    ]
  },
  restaurant: {
    q: 'Un commerce de bouche ? Voici ce qui fonctionne le mieux :',
    o: [
      ['Ma carte / mes menus', 'fla4,menu|Le A4 pour une carte complète, le format allongé pour les menus de table. En 250 g mat, ils tiennent au service.'],
      ['Attirer les passants', 'affA2,vitro|Une affiche A2 dans la vitrine ou de la vitrophanie : c\'est ce qui fait entrer les gens qui passent.'],
      ['Fidéliser', 'fid,cdv|Une carte de fidélité à tamponner, c\'est le plus vieux truc du monde et il marche toujours.'],
      ['Distribuer autour', 'fla6,fla5|Des flyers avec une offre découverte, distribués dans les rues autour. Le A6 pour le volume, le A5 pour un menu détaillé.']
    ]
  },
  demarrage: {
    q: 'Vous lancez votre activité ? Voici ce que je conseille en priorité :',
    o: [
      ['L\'essentiel d\'abord', 'cdv,fla5|Cartes de visite et flyers. Avec ces deux-là vous pouvez démarcher, distribuer et laisser une trace partout.'],
      ['Faire pro tout de suite', 'cdv,entete,dep1|Cartes, papier à en-tête pour vos devis et un dépliant qui présente vos services. Ça inspire confiance dès le premier contact.'],
      ['Je n\'ai pas de logo', 'design-r|Commençons par là. Nous créons votre visuel pour 65 € HTVA, avec une proposition sous 48 h et une série de retouches incluse.'],
      ['Conseillez-moi', 'cdv,fla5,design-r|Si je devais choisir : un design propre d\'abord, puis les cartes de visite, puis les flyers. Dans cet ordre.']
    ]
  }
};

/* ══════════ CONNAISSANCES ══════════ */
var KB = [
{k:['delai','delais','combien de temps','quand','recevoir','rapide','expedition','expedie','temps de production','ca prend combien','sous combien de jours','arrive quand','pret quand','date de reception','recu quand','temps d attente'],s:'both',
 a:"Voici les délais, en jours ouvrables :\n\n• <b>Cartes de visite</b> — 5 jours\n• <b>Flyers et affiches</b> — 5 jours\n• <b>Roll-up</b> — 5 jours\n• <b>Stickers, banderoles</b> — 6 jours\n• <b>Papeterie</b> — 6 à 7 jours\n• <b>Création de design</b> — proposition sous 48 h, puis impression\n\nLes finitions ajoutent un peu : pelliculage +1, soft-touch +2, vernis +2, dorure +3. L'option <b>Express</b> retire 2 jours.\n\nLa date exacte s'affiche dans le configurateur, week-ends et jours fériés belges déduits.",
 f:'Vous avez une date à tenir ?'},

{k:['fichier','pdf','format','resolution','dpi','cmjn','fond perdu','fonds perdus','preparer','jpg','png','poids fichier','mo','maquette','bat','gabarit','modele','template','bord perdu','marges','taille du fichier','bonne qualite','qualite d image'],s:'both',
 a:"Pour un rendu impeccable :\n\n• <b>PDF</b> de préférence, JPG et PNG acceptés\n• <b>300 dpi</b> minimum\n• Mode <b>CMJN</b>\n• <b>3 mm de fonds perdus</b> sur chaque bord\n• Textes à 5 mm des coupes\n• 8 Mo maximum par fichier\n\nBonne nouvelle : au moment de l'upload, je vérifie automatiquement la résolution et les proportions, et je vous préviens si quelque chose risque de mal sortir.\n\n⚠ Votre fichier est imprimé <b>tel quel</b> — relisez-le bien.",
 f:'Vous avez déjà votre fichier sous la main ?'},

{k:['pas de fichier','pas de visuel','pas de logo','creer','design','graphiste','concevoir','faire mon','sais pas faire','aidez moi a creer'],s:'both',
 a:"Aucun souci, c'est très courant — nous le créons pour vous :\n\n• <b>Recto seul</b> — 65 € HTVA\n• <b>Recto/verso</b> — 90 € HTVA\n\nVous décrivez votre activité et ce que vous aimez, nous vous envoyons une proposition <b>sous 48 h ouvrables</b>. Une série de retouches est comprise, et l'impression ne démarre qu'après votre validation.\n\nBesoin de plus vite ? Une option Express à 24 h existe.",
 q:[['Voir le service création','#design-r']]},

{k:['prix','tarif','cout','combien ca coute','cher','budget','pas cher','moins cher','economique','ca coute','montant','estimation','promotion','promo','reduction','remise','offre'],s:'both',
 a:"Nos prix sont hors TVA et deviennent plus intéressants avec la quantité :\n\n• Cartes de visite — dès <b>17,40 €</b>\n• Flyers A6 — dès <b>26,30 €</b>\n• Flyers A5 — dès <b>33,60 €</b>\n• Affiches A3 — dès <b>18,90 €</b>\n• Roll-up — dès <b>63,40 €</b>\n• Stickers — dès <b>26,10 €</b>\n\nLe prix exact apparaît instantanément selon vos options — sans surprise à la fin.",
 f:'Vous avez un budget en tête ? Je peux vous orienter.'},

{k:['devis','sur mesure','gros volume','grande quantite','format special','particulier'],s:'both',
 a:"Pour un gros volume ou un format qui sort de l'ordinaire, nous établissons un devis personnalisé <b>sous 24 h ouvrables</b>.\n\nDites-nous le produit, le format, la quantité et la date souhaitée — nous revenons vers vous rapidement.",
 q:[['Demander un devis','#devis']]},

{k:['finition','pelliculage','mat','brillant','soft touch','vernis','dorure','coins arrondis','arrondi','luxe','haut de gamme','qualite','plastifie','plastifiee','laminage','effet','rendu','toucher'],s:'both',
 a:"Les finitions font une vraie différence au toucher :\n\n• <b>Pelliculage mat</b> — velouté, couleurs profondes (+1 j)\n• <b>Pelliculage brillant</b> — couleurs éclatantes (+1 j)\n• <b>Soft-touch</b> — effet peau de pêche, très haut de gamme (+2 j)\n• <b>Vernis sélectif UV</b> — brillance sur les zones choisies (+2 j)\n• <b>Dorure à chaud</b> — métallisé prestige (+3 j)\n• <b>Coins arrondis</b> — 3, 6 ou 10 mm\n\nMon conseil : sur une carte de visite, le soft-touch se remarque immédiatement quand on la prend en main. C'est le détail qui fait dire « elle est belle, votre carte ».",
 f:'Vous cherchez plutôt sobre ou marquant ?'},

{k:['paiement','payer','bancontact','carte','virement','ideal','kbc','belfius','moyen de paiement','paypal','regler','payement','cb','mastercard','visa','en plusieurs fois','carte bancaire'],s:'both',
 a:"Vous réglez comme vous préférez :\n\n• <b>Bancontact</b>\n• <b>iDEAL</b>\n• <b>KBC/CBC</b>\n• <b>Belfius</b>\n• <b>Virement bancaire</b>\n\nLes paiements en ligne passent par <b>Mollie</b>, prestataire agréé belge — vos données bancaires ne transitent jamais par notre site.\n\nEn virement, vous recevez les coordonnées par e-mail et la production démarre à réception."},

{k:['tva','htva','tvac','autoliquidation','intracommunautaire','numero de tva','facture','facturation','peppol'],s:'both',
 a:"Les prix affichés sont <b>hors TVA</b> ; la TVA belge de 21 % s'ajoute à la commande.\n\n<b>Professionnel hors Belgique</b> ? Renseignez votre numéro de TVA (Pays-Bas ou Luxembourg) : l'<b>autoliquidation</b> s'applique et la TVA n'est pas facturée. Le numéro est vérifié en direct auprès du registre européen.\n\nVotre <b>facture</b> est disponible dans votre espace client après chaque commande, et les professionnels belges peuvent télécharger un fichier <b>Peppol</b> conforme."},

{k:['livraison','livrer','pays','belgique','pays-bas','luxembourg','benelux','frais de port','port','franco','domicile','envoi','envoyer','expedier chez moi','recevoir chez moi','point relais','bpost','adresse de livraison','livre ou'],s:'both',
 a:"Nous livrons en <b>Belgique</b>, aux <b>Pays-Bas</b> et au <b>Luxembourg</b> :\n\n• Belgique — 5,95 €, <b>offerte dès 49 €</b>\n• Pays-Bas et Luxembourg — 7,95 €, <b>offerte dès 75 €</b> (+1 jour)\n\nPetite astuce : si vous approchez des 49 €, ajouter un second produit revient souvent moins cher que de payer le port séparément plus tard.\n\nVous pouvez aussi faire livrer à une <b>autre adresse</b> — pratique pour un chantier ou un client final."},

{k:['france','livrer en france','livraison france','allemagne','suisse','etranger','hors benelux','international','autre pays'],s:'both',
 a:"Pour l'instant nous livrons en Belgique, aux Pays-Bas et au Luxembourg.\n\nPour ailleurs, écrivez-nous : nous étudions chaque demande et pouvons vous faire un devis avec les frais de port adaptés.",
 q:[['Nous écrire','#mailto']]},

{k:['annuler','annuler ma commande','annulation','remboursement','rembourser','retracter','retractation','retour','je me suis trompe','erreur'],s:'both',
 a:"Nos produits étant <b>personnalisés</b>, le droit de rétractation de 14 jours ne s'applique pas (art. VI.53, 3° du Code de droit économique). Une commande validée et payée est donc définitive.\n\nEn revanche, si le produit arrive avec un <b>défaut qui nous est imputable</b>, écrivez-nous sous 7 jours avec des photos : nous réimprimons ou remboursons, sans discussion.\n\nC'est pour ça que je vous invite à relire vos fichiers avant validation — l'aperçu 3D est là pour ça."},

{k:['suivi','ou est ma commande','suivre ma commande','statut','tracking','colis','avancement','ou en est','commande en cours','ma commande','numero de commande','expediee','pas recu'],s:'shop',
 a:"Je peux retrouver votre commande. Donnez-moi sa <b>référence</b>, du type <b>PX-123456</b> — elle est dans votre e-mail de confirmation.\n\nVotre espace client affiche aussi la progression étape par étape, du paiement à la livraison.",
 q:[['Ouvrir mon espace client','#account']]},

{k:['compte','connexion','inscription','mot de passe','oublie','connecter','creer un compte','identifiant'],s:'shop',
 a:"Le compte sert à suivre vos impressions et retrouver vos factures.\n\n• <b>Créer un compte</b> — e-mail et mot de passe, rien de plus\n• <b>Mot de passe oublié</b> — un lien de réinitialisation arrive par e-mail\n\nLe mot de passe demande 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.",
 q:[['Aller à l\'espace client','#account']]},

{k:['panier','commander','comment commander','comment je commande','passer commande','comment ca marche','etapes','processus','acheter','achat','je veux commander','passer une commande'],s:'shop',
 a:"C'est simple, en quatre étapes :\n\n1. Vous choisissez un produit et vous le configurez\n2. Vous uploadez votre fichier — l'aperçu 3D vous montre le rendu, recto et verso\n3. Vous ajoutez au panier, qui se conserve 30 jours\n4. Vous renseignez vos coordonnées et vous payez\n\nLa confirmation arrive aussitôt par e-mail avec tout le récapitulatif.",
 f:'Vous voulez qu\'on commence par un produit en particulier ?'},

{k:['urgent','rapidement','vite','express','presse','pour demain','au plus vite','delai court','deadline','dernier moment','ce week end','sous 48h','sous 24h','en urgence'],s:'both',
 a:"L'option <b>Express</b> retire 2 jours ouvrables sur la plupart des produits — elle se coche dans le configurateur.\n\nPour une vraie urgence, appelez le <b>" + TEL + "</b> : selon la charge de l'atelier, on arrive parfois à faire mieux. Ça vaut le coup de demander.",
 q:[['Nous appeler','#tel']]},

{k:['papier','support','grammage','kraft','recycle','nacre','texture','epais','matiere','vinyle','pvc','ecologique','environnement'],s:'both',
 a:"Nos supports, selon le produit :\n\n<b>Cartes</b> — couché mat ou brillant 350 g, extra-épais 400 g, recyclé, kraft naturel, PVC\n<b>Flyers, affiches</b> — 135 ou 170 g brillant, 250 g mat, recyclé\n<b>Faire-parts</b> — 300 g mat, nacré, texturé 350 g\n<b>Papeterie</b> — offset 90 ou 120 g, recyclé\n<b>Stickers</b> — vinyle brillant, mat, transparent, papier recyclé\n<b>Roll-up</b> — bâche PVC 510 g, anti-feu M1, toile textile\n\nDes options <b>recyclées</b> existent sur presque tous les produits si c'est important pour vous."},

{k:['ou etes vous','vous etes ou','vous etes situe','adresse','localisation','magasin','boutique physique','region','charleroi','fleurus','ou se trouve'],s:'both',
 a:"Pixel Studio est basé en <b>Belgique</b>, dans la région de Charleroi.\n\nTout se passe en ligne : vous commandez depuis chez vous, nous livrons où vous voulez en Belgique, aux Pays-Bas et au Luxembourg.\n\nPour un rendez-vous, écrivez à <b>" + MAIL + "</b>."},

{k:['contact','contacter','vous contacter','joindre','vous joindre','telephone','appeler','vous appeler','numero de telephone','email','mail','rendez-vous','rdv','parler a quelqu un','parler a un humain','humain','conseiller','un vrai conseiller','logan','patron','gerant','responsable','proprietaire'],s:'both',
 a:"Avec plaisir — Logan répond personnellement :\n\n• E-mail — <b>" + MAIL + "</b>\n• Téléphone — <b>" + TEL + "</b>\n\nRéponse sous 24 h, souvent bien avant.",
 q:[['Écrire un e-mail','#mailto'],['Appeler','#tel']]},

{k:['qui es tu','qui es-tu','qui etes vous','pixie','robot','bot','assistant','tu es qui','tu sers a quoi','presente toi','humaine'],s:'both',
 a:"Je suis <b>Pixie</b>, l'assistante de Pixel Studio 🙂\n\nJe connais le catalogue sur le bout des doigts : formats, délais, finitions, conditions. Je peux vous conseiller un produit selon votre projet, et retrouver une commande à partir de sa référence.\n\nJe ne suis pas humaine, et je ne prétends pas l'être — quand une question me dépasse, je vous passe à Logan plutôt que de raconter n'importe quoi.",
 f:'Sur quoi puis-je vous aider ?'},

{k:['securite','securise','donnees','rgpd','confidentialite','mes donnees','vie privee'],s:'both',
 a:"Vos données sont traitées selon le <b>RGPD</b> et hébergées en Europe, en Irlande.\n\n• Vos fichiers d'impression sont dans un espace privé, accessible à vous seul\n• Les paiements passent par Mollie : aucune donnée bancaire ne transite par notre site\n• Vous pouvez demander la suppression de vos données à tout moment"},

{k:['lead','leads','prospect','campagne','meta','facebook','publicite','marketing','acquisition','formule','client'],s:'index',
 a:"Pixel Studio génère des <b>leads exclusifs et qualifiés</b> pour les métiers du bâtiment et les TPE/PME :\n\n• <b>Initiale</b> — 25 leads/mois, 999 € HTVA\n• <b>Performance</b> — 50 leads/mois, 1 998 € HTVA\n• <b>Intégrale</b> — 100 leads/mois, 3 750 € HTVA\n\n+ 400 € HTVA/mois de gestion et pilotage.\n\nCe qui change vraiment : landing page offerte, exclusivité territoriale, remplacement d'un lead non conforme sous 48 h, reporting mensuel. Engagement 6 mois, puis résiliable avec 30 jours de préavis.",
 q:[['Prendre rendez-vous','#contact']]},

{k:['photo','photographe','photographie','shooting','portrait','drone','aerien','video','image'],s:'index',
 a:"Nos services créatifs :\n\n• <b>Photographie</b> — portraits, chantiers avant/après, événements, produits\n• <b>Drone 4K</b> — captation aérienne certifiée de chantiers, toitures, façades\n• <b>Print</b> — flyers, affiches, cartes de visite, identité visuelle\n• <b>Site web</b> — sites vitrines codés à la main, optimisés pour le référencement\n\nLogan est photographe de formation : c'est lui qui shoote, pas un sous-traitant.",
 q:[['Voir les services','#services']]},

{k:['impression','print','imprimer','imprimerie','flyer','flyers','carte de visite','cartes de visite','affiche','affiches','sticker','stickers','roll','rollup','faire part','papeterie'],s:'index',
 a:"Notre atelier d'impression en ligne couvre tout le print : cartes de visite, flyers, affiches, roll-up, stickers, faire-parts et papeterie.\n\nTout se configure sur la boutique : prix instantan\u00e9 selon vos options, aper\u00e7u 3D de votre fichier, et date de livraison affich\u00e9e avant de payer.",
 q:[['Ouvrir la boutique','#shop']]},

{k:['site web','site internet','landing','seo','referencement','vitrine'],s:'index',
 a:"Nous créons des <b>sites vitrines sur mesure</b>, codés à la main : rapides, optimisés pour le référencement, pensés pour convertir vos visiteurs.\n\nEt une <b>landing page de conversion</b> est offerte dans chaque formule de génération de leads — valeur 1 000 €.",
 q:[['Voir les services','#services']]},

{k:['merci','super','parfait','nickel','genial','cool','top','impec','sympa'],s:'both',
 a:"Avec plaisir 🙂",
 f:'N\'hésitez pas si autre chose vous vient.'},

{k:['bonjour','salut','hello','bonsoir','coucou','hey','bjr'],s:'both',
 a:HELLO + " ! Ravi de vous croiser.",
 f:'Dites-moi ce qui vous amène.'},

{k:['au revoir','bye','a bientot','ciao','bonne journee'],s:'both',
 a:"Bonne " + (HOUR === 'soir' || HOUR === 'nuit' ? 'soirée' : 'journée') + " ! Je reste là si besoin 🙂"},

/* Fiches produits */
{k:['carte de visite','cartes de visite','carte visite','cdv','carte pro','cartes pro','business card'],s:'shop',
 a:"Cinq versions, selon l'effet recherché :",prods:['cdv','cdv-sq','cdv-rd','cdv-pvc','fid'],
 f:'Un conseil : le format carré se remarque tout de suite dans un porte-cartes.'},
{k:['flyer','flyers','tract','depliant','depliants','prospectus','toutes boites'],s:'shop',
 a:"Nos formats de flyers et dépliants :",prods:['fla6','fla5','fla4','dep1','dep3'],
 f:'Pour du toutes-boîtes, l\'A6 offre le meilleur rapport visibilité/prix.'},
{k:['affiche','affiches','poster','a2','a3','vitrine'],s:'shop',
 a:"Nos affiches :",prods:['affA3','affA2','aff70'],
 f:'L\'A2 est le bon compromis vitrine : visible du trottoir sans être encombrant.'},
{k:['roll','rollup','roll-up','kakemono','stand','banderole','signaletique','panneau','bache','enseigne'],s:'shop',
 a:"Pour la signalétique :",prods:['rollup','rollup100','band','panneau'],
 f:'Le roll-up se réutilise pendant des années — c\'est un investissement, pas une dépense.'},
{k:['sticker','stickers','autocollant','vitrophanie','etiquette','adhesif'],s:'shop',
 a:"Nos adhésifs :",prods:['stick-rd','stick-sq','vitro']},
{k:['faire part','faire-part','bapteme','communion','evenement'],s:'shop',
 a:"Pour vos événements :",prods:['fpn','fpm','inv','rem','menu']},
{k:['papeterie','papier a en tete','papier en tete','en-tete','entete','enveloppe','enveloppes','bloc note','bloc notes','papier a lettre','courrier','tete de lettre'],s:'shop',
 a:"Votre papeterie professionnelle :",prods:['entete','enveloppe','bloc'],
 f:'Un devis sur papier à en-tête, ça change la perception du prix.'}
];

/* Détection d'un besoin plutôt que d'un produit */
var NEEDS = [
  [['anniversaire','anniv','fete','40 ans','50 ans','18 ans','bougies'],'anniversaire'],
  [['mariage','marie','noces','se marier','fiancailles'],'mariage'],
  [['salon','foire','stand','exposition','expo','congres'],'salon'],
  [['ouverture de','inauguration','nouveau commerce','je lance mon magasin','j ouvre mon','ouvre mon commerce','ouverture magasin'],'ouverture'],
  [['naissance','bebe','accouchement','nouveau ne','vient de naitre','est ne','est nee','ma fille vient','mon fils vient','faire part de naissance','bapteme'],'naissance'],
  [['chantier','artisan','batiment','macon','peintre','electricien','plombier','couvreur','toiture','renovation','je suis couvreur','je suis macon','je suis artisan','menuisier','carreleur','chauffagiste','jardinier','paysagiste'],'artisan'],
  [['restaurant','brasserie','cafe','food truck','boulangerie','traiteur','pizzeria','snack'],'restaurant'],
  [['je demarre','je me lance','debut d activite','nouvelle entreprise','creation d entreprise','independant','je viens de creer'],'demarrage']
];

var START = SHOP
  ? [['J\'ai un projet, conseillez-moi','__besoin'],['Quels sont les délais ?','delai'],
     ['Comment préparer mon fichier ?','fichier'],['Je n\'ai pas de visuel','pas de visuel'],
     ['Suivre ma commande','suivi'],['Frais de livraison','frais de port']]
  : [['Vos formules de leads','formule'],['Photo & drone','photo'],
     ['Impression et print','flyer'],['Vous contacter','contact']];

/* ══════════ MOTEUR ══════════ */
function norm(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2019]/g, ' ').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function lev(a, b) {
  if (a === b) return 0;
  var m = a.length, n = b.length;
  if (!m || !n) return m + n;
  var d = [], i, j;
  for (i = 0; i <= n; i++) d[i] = i;
  for (i = 1; i <= m; i++) {
    var prev = d[0]; d[0] = i;
    for (j = 1; j <= n; j++) {
      var t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      prev = t;
    }
  }
  return d[n];
}
function wordMatch(w, kw) {
  /* correspondance d'un mot de la question avec un mot-cle simple */
  if (w === kw) return 4;
  var best = 0;
  if (w.length > 3 && (w.indexOf(kw) === 0 || kw.indexOf(w) === 0)) best = 2;
  if (w.length > 3 && kw.length > 4 && Math.abs(w.length - kw.length) <= 2) {
    var d = lev(w, kw);
    if (d <= 1) best = Math.max(best, kw.length >= 6 ? 5 : 4); /* 1 faute */
    else if (d === 2 && kw.length > 7) best = Math.max(best, 3); /* 2 fautes, mot long */
  }
  return best;
}
function score(q, keys) {
  var n = norm(q), sc = 0, words = n.split(' ');
  for (var i = 0; i < keys.length; i++) {
    var kw = norm(keys[i]);
    if (!kw) continue;
    if (n === kw) { sc += 12; continue; }
    if (n.indexOf(kw) >= 0) { sc += kw.indexOf(' ') >= 0 ? 7 : 4; continue; }
    if (kw.indexOf(' ') >= 0) {
      /* mot-cle multi-mots avec fautes : tous ses mots (>3 lettres) doivent matcher */
      var toks = kw.split(' ').filter(function (t) { return t.length > 3; });
      if (!toks.length) continue;
      if (toks.length === 1) {
        var s1 = 0;
        for (var b0 = 0; b0 < words.length; b0++) {
          var m0 = wordMatch(words[b0], toks[0]);
          if (m0 > s1) s1 = m0;
        }
        sc += Math.min(s1, 4);
        continue;
      }
      var hit = 0;
      for (var a = 0; a < toks.length; a++) {
        for (var b = 0; b < words.length; b++) {
          if (wordMatch(words[b], toks[a]) >= 3) { hit++; break; }
        }
      }
      if (hit === toks.length) sc += 7;
    } else if (kw.length > 4) {
      var best = 0;
      for (var j = 0; j < words.length; j++) {
        var m = wordMatch(words[j], kw);
        if (m > best) best = m;
      }
      sc += best;
    }
  }
  return sc;
}
function findNeed(q) {
  var best = null, bs = 0;
  for (var i = 0; i < NEEDS.length; i++) {
    var s = score(q, NEEDS[i][0]);
    if (s > bs) { bs = s; best = NEEDS[i][1]; }
  }
  return bs >= 4 ? best : null;
}
function findScored(q) {
  var out = [];
  for (var i = 0; i < KB.length; i++) {
    var e = KB[i];
    if (e.s === 'shop' && !SHOP) continue;
    if (e.s === 'index' && SHOP) continue;
    var s = score(q, e.k);
    if (s > 0) out.push([s, e]);
  }
  out.sort(function (a, b) { return b[0] - a[0]; });
  return out;
}
function find(q) {
  var r = findScored(q);
  return r.length && r[0][0] >= 3 ? r[0][1] : null;
}
function refIn(t) {
  var m = String(t || '').toUpperCase().match(/PX[\s-]?(\d{5,7})/);
  return m ? 'PX-' + m[1] : null;
}
function dateIn(t) {
  var n = norm(t), r = String(t || '').toLowerCase();
  return /(\d{1,2}\s*(er)?\s*(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre))|demain|apres demain|semaine prochaine|week ?end/.test(n)
    || /\d{1,2}[\/\-.]\d{1,2}/.test(r);
}

/* ══════════ INTERFACE ══════════ */
var win, body, input, opened = false, greeted = false, turns = 0, lastTopic = null, missCount = 0, pending = null;

function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; }
function down() { body.scrollTop = body.scrollHeight; }
function say(h, c) { var m = el('div', 'pxm ' + (c || 'b'), h); body.appendChild(m); down(); return m; }
function why(t) { var m = el('div', 'pxwhy', t); body.appendChild(m); down(); }
function typing() { var t = el('div', 'pxtyp', '<span></span><span></span><span></span>'); body.appendChild(t); down(); return t; }

function quick(list) {
  if (!list || !list.length) return;
  var w = el('div', 'pxq');
  list.forEach(function (it) {
    var b = el('button', null, it[0]);
    b.onclick = function () { w.remove(); route(it[1], it[0]); };
    w.appendChild(b);
  });
  body.appendChild(w); down();
}
function actions(list) {
  if (!list) return;
  var w = el('div', 'pxq');
  list.forEach(function (it) {
    var b = el('button', null, it[0]);
    b.onclick = function () { doAction(it[1]); };
    w.appendChild(b);
  });
  body.appendChild(w); down();
}
function fmtPrice(n) { return 'dès ' + Number(n || 0).toFixed(2).replace('.', ',') + ' €'; }
function productCard(p) {
  var c = el('div', 'pxprod'), price = '';
  try { price = fmtPrice(Math.min.apply(null, Object.values(p.price))); } catch (e) {}
  c.innerHTML = '<span class="e">' + p.ico + '</span><span class="t"><b>' + p.name +
    '</b><i>' + p.fmt + '</i></span><span class="p">' + price + '</span>';
  c.onclick = function () { if (typeof openConfig === 'function') { openConfig(p.id); close(); } };
  body.appendChild(c); down();
}
function showProds(ids) {
  if (typeof PRODUCTS === 'undefined') return;
  ids.forEach(function (id) {
    var p = PRODUCTS.filter(function (x) { return x.id === id; })[0];
    if (p) productCard(p);
  });
}
function doAction(a) {
  if (a === '#mailto') { location.href = 'mailto:' + MAIL; return; }
  if (a === '#tel') { location.href = 'tel:' + TEL.replace(/\s/g, ''); return; }
  if (a === '#contact') { location.href = 'contact.html'; return; }
  if (a === '#services') { location.href = 'services.html'; return; }
  if (a === '#shop') { location.href = 'shop.html'; return; }
  if (a === '#devis') { if (typeof askQuote === 'function') { close(); askQuote(); } else location.href = 'mailto:' + MAIL; return; }
  if (a === '#account') { if (typeof go === 'function') { close(); go('account'); } else location.href = 'shop.html'; return; }
  if (a.charAt(0) === '#' && typeof openConfig === 'function') { close(); openConfig(a.slice(1)); return; }
  location.href = 'shop.html';
}

/* Parcours guidé */
function startFlow(name) {
  var f = FLOWS[name];
  if (!f) return false;
  lastTopic = name;
  var t = typing();
  setTimeout(function () {
    t.remove();
    say(f.q);
    var w = el('div', 'pxq');
    f.o.forEach(function (o) {
      var b = el('button', null, o[0]);
      b.onclick = function () {
        w.remove();
        say(o[0], 'u');
        var parts = o[1].split('|');
        var t2 = typing();
        setTimeout(function () {
          t2.remove();
          say(parts[1]);
          showProds(parts[0].split(','));
          why('Touchez un produit pour le configurer directement.');
          setTimeout(function () {
            quick([['Voir d\'autres idées', '__besoin'], ['Les délais', 'delai'], ['Parler à Logan', '__contact']]);
          }, 400);
        }, 520);
      };
      w.appendChild(b);
    });
    body.appendChild(w); down();
  }, 480);
  return true;
}

function askNeed() {
  var t = typing();
  setTimeout(function () {
    t.remove();
    say('Racontez-moi votre projet, je vous oriente. C\'est pour quelle occasion ?');
    quick([['Un anniversaire', 'anniversaire'], ['Un mariage', 'mariage'],
           ['Un salon, une foire', 'salon'], ['Une ouverture de commerce', 'ouverture'],
           ['Une naissance', 'naissance'], ['Je suis artisan', 'artisan'],
           ['Un restaurant, un café', 'restaurant'], ['Je démarre mon activité', 'demarrage']]);
  }, 460);
}

function lookupOrder(ref) {
  var t = typing();
  setTimeout(function () {
    t.remove();
    if (typeof supa === 'undefined' || !supa || typeof user === 'undefined' || !user) {
      say('Pour consulter une commande, connectez-vous d\'abord — c\'est ce qui garantit que personne d\'autre n\'y accède.');
      actions([['Me connecter', '#account']]);
      return;
    }
    supa.from('orders').select('data').eq('ref', ref).limit(1).then(function (r) {
      var row = r && r.data && r.data[0];
      if (!row || !row.data) {
        say('Je ne trouve pas <b>' + ref + '</b> sur votre compte 🤔\n\nVérifiez la référence dans votre e-mail de confirmation, ou écrivez-nous à ' + MAIL + '.');
        return;
      }
      var o = row.data;
      var items = (o.items || []).map(function (i) { return '• ' + i.name + ' — ' + i.conf; }).join('\n');
      say('Voici votre commande <b>' + o.ref + '</b> :\n\n' + items +
        '\n\nStatut : <b>' + (o.status || '—') + '</b>\nPassée le ' + (o.date || '—') +
        '\nLivraison estimée : <b>' + (o.deliv || '—') + '</b>' +
        (o.tracking ? '\nSuivi colis : <b>' + o.tracking + '</b>' : '') +
        '\nTotal : <b>' + (typeof euro === 'function' ? euro(o.total) : o.total + ' €') + '</b>');
      actions([['Voir dans mon espace', '#account']]);
    }).catch(function () {
      say('Je n\'arrive pas à interroger le suivi à l\'instant. Réessayez dans un moment, ou écrivez-nous à ' + MAIL + '.');
    });
  }, 600);
}

/* Reponse du client a une question posee par Pixie (date, budget, oui/non...) */
function pendingReply(q) {
  if (!pending) return false;
  var p = pending; pending = null;
  var n = norm(q);
  if (/^(oui|ouais|yes|ok|d accord|volontiers|pourquoi pas|je veux bien|avec plaisir)$/.test(n)) {
    say('Parfait \ud83d\ude42 Dites-m\'en un peu plus, ou choisissez :');
    quick([['D\u00e9crire mon projet', '__besoin'], ['Les questions fr\u00e9quentes', '__faq'], ['Parler \u00e0 Logan', '__contact']]);
    return true;
  }
  if (/^(non|nan|nope|pas vraiment|pas encore|pas specialement|pas pour l instant)$/.test(n)) {
    say('Pas de souci \ud83d\ude42 ' + pick(NEXT));
    return true;
  }
  if (p === 'delai' && (dateIn(q) || /\d/.test(n))) {
    say('C\'est not\u00e9 \ud83d\udcc5 Pour \u00eatre tranquille, comptez la production \u2014 5 \u00e0 7 jours ouvrables selon le produit et les finitions \u2014 plus la livraison. Id\u00e9alement, commandez <b>au moins 2 semaines avant</b> votre date.\n\nSi \u00e7a devient juste, l\'option <b>Express</b> retire 2 jours, et pour les cas critiques appelez le <b>' + TEL + '</b>.');
    quick([['D\u00e9crire mon projet', '__besoin'], ['Vous appeler', '__contact']]);
    return true;
  }
  if (p === 'prix' && /\d/.test(n)) {
    say('Bien not\u00e9 \ud83d\udcb6 Le meilleur levier, c\'est la quantit\u00e9 et le format : le prix unitaire baisse vite quand le volume monte. D\u00e9crivez-moi votre projet et je vous oriente vers ce qui rentre dans votre budget.');
    quick([['D\u00e9crire mon projet', '__besoin'], ['Demander un devis', 'devis']]);
    return true;
  }
  say('Merci, c\'est not\u00e9 \ud83d\ude42 Voici comment on peut avancer :');
  quick([['D\u00e9crire mon projet', '__besoin'], ['Les questions fr\u00e9quentes', '__faq'], ['Parler \u00e0 Logan', '__contact']]);
  return true;
}

/* Repli : une relance de precision, puis passage de relais a Logan */
function fallback(q) {
  var scored = findScored(q);
  if (scored.length && missCount === 0) {
    missCount++;
    say('Je ne suis pas certaine d\'avoir bien saisi 🤔 Vous pensiez à :');
    quick(scored.slice(0, 3).map(function (x) { return [x[1].k[0].charAt(0).toUpperCase() + x[1].k[0].slice(1), x[1].k[0]]; })
      .concat([['Rien de tout ça', '__logan']]));
    return;
  }
  missCount = 0;
  handoff();
}
function handoff() {
  say('Voyons voir… Je ne peux malheureusement pas vous répondre, mais je vous transmets les coordonnées de Logan afin de vous orienter au mieux 😊\n\n• E-mail — <b>' + MAIL + '</b>\n• Téléphone — <b>' + TEL + '</b>\n\nRéponse sous 24 h, souvent bien avant.');
  actions([['Écrire à Logan', '#mailto'], ['Appeler Logan', '#tel']]);
}

function faq() {
  say('Les questions qui reviennent le plus souvent :');
  quick(SHOP
    ? [['Délais de livraison', 'delai'], ['Préparer mon fichier', 'fichier'],
       ['Les finitions', 'finition'], ['Les prix', 'prix'],
       ['Moyens de paiement', 'paiement'], ['Suivre ma commande', 'suivi']]
    : [['Vos formules', 'formule'], ['Photo et drone', 'photo'],
       ['Sites web', 'site web'], ['Vous contacter', 'contact']]);
}

function route(q, label) {
  if (q === '__besoin') { say(label || 'J\'ai un projet', 'u'); askNeed(); return; }
  if (q === '__contact') { say(label || 'Parler à quelqu\'un', 'u'); handle('contact'); return; }
  if (q === '__faq') { say(label || 'Questions fréquentes', 'u'); faq(); return; }
  if (q === '__logan') { say(label || 'Rien de tout ça', 'u'); handoff(); return; }
  if (FLOWS[q]) { say(label || q, 'u'); startFlow(q); return; }
  handle(q, label);
}

function handle(q, label) {
  turns++;
  if (label !== false) say(label || q, 'u');

  var ref = refIn(q);
  if (ref && SHOP) { lookupOrder(ref); return; }

  var need = findNeed(q);
  if (need && SHOP) { startFlow(need); return; }

  var all = findScored(q);
  var e = all.length && all[0][0] >= 3 ? all[0][1] : null;
  /* memoire de contexte : "et en A5 ?" apres une question sur les flyers */
  if (!e && lastTopic) e = find(lastTopic + ' ' + q);
  var second = e && all.length > 1 && all[1][0] >= 5 && all[1][1] !== e ? all[1][1] : null;
  var t = typing();
  setTimeout(function () {
    t.remove();
    if (!e) { if (pendingReply(q)) return; fallback(q); return; }
    pending = null;

    var head = (turns > 1 && Math.random() < .45) ? pick(ACK) + ' ' : '';
    say(head + e.a);
    lastTopic = e.k[0];
    missCount = 0;

    if (e.prods) { showProds(e.prods); why('Touchez un produit pour l\'ouvrir directement.'); }
    if (e.q) actions(e.q);

    if (e.f) { pending = e.k[0]; setTimeout(function () { say(e.f); }, 620); }
    else if (turns >= 2 && Math.random() < .4 && !e.prods)
      setTimeout(function () { say(pick(NEXT)); }, 700);

    /* multi-intentions : la question touchait aussi un second sujet */
    if (second) setTimeout(function () {
      quick([['Aussi : ' + second.k[0], second.k[0]]]);
    }, 950);
  }, 460 + Math.random() * 300);
}

function greet() {
  if (greeted) return;
  greeted = true;
  var t = typing();
  setTimeout(function () {
    t.remove();
    say(HELLO + ', moi c\'est <b>Pixie</b> 👋\n\n' + (SHOP
      ? 'Je suis là pour vous aider à choisir, préparer vos fichiers ou suivre une commande. Décrivez-moi votre projet et je vous oriente.'
      : 'Je réponds à vos questions sur Pixel Studio : génération de leads, photo, drone, print et sites web.'));
    quick(START);
  }, 560);
}

function open() {
  win.classList.add('open'); opened = true;
  var b = document.getElementById('pxb');
  b.classList.remove('alert', 'ping');
  var tip = document.getElementById('pxtip');
  if (tip) tip.classList.remove('on');
  greet();
  setTimeout(function () { if (window.innerWidth > 640) input.focus(); }, 320);
}
function close() { win.classList.remove('open'); opened = false; }
function toggle() { opened ? close() : open(); }

function mount() {
  if (document.getElementById('pxb')) return;
  var st = el('style'); st.textContent = CSS; document.head.appendChild(st);

  var b = el('button', null, avatar(38) + '<span class="dot"></span>');
  b.id = 'pxb'; b.setAttribute('aria-label', 'Ouvrir l\'assistante Pixie'); b.onclick = toggle;
  document.body.appendChild(b);

  var tip = el('div', null, SHOP ? 'Un projet en tête ? Je vous oriente 🙂' : 'Une question ? Je suis là 🙂');
  tip.id = 'pxtip'; tip.onclick = open;
  document.body.appendChild(tip);

  win = el('aside'); win.id = 'pxw'; win.setAttribute('aria-label', 'Assistante Pixie');
  win.innerHTML = '<div class="hd"><span class="av">' + avatar(38, true) + '</span>' +
    '<span><b>Pixie</b><i>● en ligne</i></span><button class="x" aria-label="Fermer">✕</button></div>' +
    '<div id="pxbody"></div><div id="pxfoot">' +
    '<input id="pxin" placeholder="Écrivez votre question…" autocomplete="off">' +
    '<button id="pxsend" aria-label="Envoyer">➤</button></div>';
  document.body.appendChild(win);

  body = win.querySelector('#pxbody');
  input = win.querySelector('#pxin');
  win.querySelector('.x').onclick = close;

  function send() {
    var v = input.value.trim();
    if (!v) return;
    input.value = '';
    handle(v);
  }
  win.querySelector('#pxsend').onclick = send;
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && opened) close(); });

  var seen = false;
  try { seen = sessionStorage.getItem('pixie-vu') === '1'; } catch (e) {}
  if (!seen) {
    setTimeout(function () {
      if (opened) return;
      b.classList.add('alert', 'ping');
      tip.classList.add('on');
      try { sessionStorage.setItem('pixie-vu', '1'); } catch (e) {}
      setTimeout(function () { tip.classList.remove('on'); }, 9000);
    }, 6000);
  }

  window.Pixie = { open: open, close: close,
    ask: function (q) { open(); setTimeout(function () { handle(q); }, 500); } };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();

})();
