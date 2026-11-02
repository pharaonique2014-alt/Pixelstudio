/* Données de démonstration – personnes et activités fictives */
window.BELORA_CITIES = {
  "Bruxelles": [50.8503, 4.3517],
  "Louvain-la-Neuve": [50.6684, 4.6125],
  "Namur": [50.4674, 4.8720],
  "Liège": [50.6326, 5.5797],
  "Charleroi": [50.4108, 4.4446],
  "Mons": [50.4542, 3.9523],
  "Tournai": [50.6071, 3.3893],
  "Lille": [50.6292, 3.0573]
};
window.BELORA_CATS = ["Marche", "Repas", "Culture", "Danse", "Jeux", "Voyage"];
window.BELORA_BUT = {
  amitie: { label: "Des amis pour sortir", short: "Amitié" },
  couple: { label: "Une relation amoureuse", short: "Rencontre" },
  ouvert: { label: "Les deux, je verrai", short: "Ouvert(e)" }
};
window.BELORA_AMB = { amis: "Entre amis", rencontres: "Rencontres", tous: "Pour tous" };
window.BELORA_INTERESTS = ["Marche", "Cuisine", "Musique", "Danse", "Voyages", "Lecture", "Cinéma", "Jardinage", "Jeux de société", "Musées", "Bénévolat", "Sport doux"];

window.BELORA_USERS = [
  { id: "u1", but: "amitie", genre: "F", cherche: "",  prenom: "Monique",      age: 67, ville: "Bruxelles",        color: "#1F3A5F", bio: "Retraitée de l'enseignement. J'aime marcher, les expositions et refaire le monde autour d'un thé.", interets: ["Marche", "Musées", "Lecture"] },
  { id: "u2", but: "ouvert", genre: "H", cherche: "femmes",  prenom: "Jean-Claude",  age: 64, ville: "Bruxelles",        color: "#D9503A", bio: "Ancien ingénieur, passionné de photo et de balades en forêt.", interets: ["Marche", "Cinéma", "Voyages"] },
  { id: "u3", but: "couple", genre: "F", cherche: "hommes",  prenom: "Nicole",       age: 58, ville: "Namur",            color: "#4F7F6A", bio: "Je cherche des gens simples et souriants pour sortir le week-end.", interets: ["Cuisine", "Jardinage", "Danse"] },
  { id: "u4", but: "couple", genre: "H", cherche: "femmes",  prenom: "Patrick",      age: 61, ville: "Liège",            color: "#2B4C7A", bio: "Veuf depuis 3 ans, j'ai envie de me remettre à sortir.", interets: ["Sport doux", "Musique", "Marche"] },
  { id: "u5", but: "amitie", genre: "F", cherche: "",  prenom: "Françoise",    age: 71, ville: "Lille",            color: "#B5651D", bio: "Grande lectrice, j'adore les musées et les cafés philo.", interets: ["Lecture", "Musées", "Cinéma"] },
  { id: "u6", but: "amitie", genre: "H", cherche: "",  prenom: "Daniel",       age: 69, ville: "Charleroi",        color: "#6B4C9A", bio: "Cuisinier amateur, toujours partant pour un bon repas partagé.", interets: ["Cuisine", "Jeux de société", "Voyages"] },
  { id: "u7", but: "ouvert", genre: "F", cherche: "hommes",  prenom: "Martine",      age: 55, ville: "Mons",             color: "#C0457A", bio: "La danse en ligne, c'est ma vie ! Venez essayer.", interets: ["Danse", "Musique", "Bénévolat"] },
  { id: "u8", but: "amitie", genre: "H", cherche: "",  prenom: "Alain",        age: 63, ville: "Bruxelles",        color: "#2E7D5B", bio: "Retraité actif, pétanque, vélo et bonne humeur.", interets: ["Sport doux", "Jeux de société", "Marche"] },
  { id: "u9", but: "couple", genre: "H", cherche: "femmes",  prenom: "Gérard",       age: 66, ville: "Bruxelles",        color: "#7A7A7A", bio: "Nouveau sur Belora.", interets: ["Voyages"], suspect: true },
  { id: "u10", but: "amitie", genre: "F", cherche: "", prenom: "Colette",      age: 73, ville: "Tournai",          color: "#1F3A5F", bio: "Pétanque le mardi, jeux de cartes le jeudi. Et vous ?", interets: ["Jeux de société", "Cuisine"] },
  { id: "u11", but: "ouvert", genre: "H", cherche: "femmes", prenom: "Bernard",      age: 59, ville: "Louvain-la-Neuve", color: "#D9503A", bio: "Grand marcheur, je connais tous les sentiers du Brabant wallon.", interets: ["Marche", "Jardinage"] },
  { id: "u13", situation: "couple", but: "amitie", genre: "", cherche: "", prenom: "Marie et Paul", age: 61, ville: "Bruxelles", color: "#2E7D5B", bio: "Mariés depuis 35 ans, nous cherchons des amis pour partager balades, bons repas et voyages.", interets: ["Marche", "Cuisine", "Voyages"] },
  { id: "u14", situation: "couple", but: "amitie", genre: "", cherche: "", prenom: "Christine et Luc", age: 58, ville: "Namur", color: "#6B4C9A", bio: "Nouveaux retraités, nous découvrons la région et aimerions rencontrer d'autres couples et des amis.", interets: ["Jeux de société", "Marche", "Musées"] },
  { id: "u12", but: "ouvert", genre: "F", cherche: "hommes", prenom: "Sylvie",       age: 56, ville: "Bruxelles",        color: "#4F7F6A", bio: "Les voyages, la cuisine du monde et les belles rencontres.", interets: ["Voyages", "Cuisine", "Musées"] }
];

/* jours = décalage par rapport à aujourd'hui, heure = "HH:MM" */
window.BELORA_ACTIVITIES_SEED = [
  { id: "a1", ambiance: "amis",  titre: "Balade au Bois de la Cambre",            cat: "Marche",  ville: "Bruxelles",        lieu: "Parking de l'étang, Bois de la Cambre", jours: 2,  heure: "14:00", prix: 0,  places: 14, orga: "Groupe Marcheurs du Brabant", source: "Groupe Facebook", desc: "Une balade tranquille de 5 km autour des étangs, à votre rythme. On termine par un café en terrasse (à votre charge).", inscrits: ["u1", "u2", "u8", "u12", "u13"] },
  { id: "a2", ambiance: "rencontres",  titre: "Thé dansant du dimanche",                cat: "Danse",   ville: "Bruxelles",        lieu: "Salle des fêtes, centre-ville",         jours: 4,  heure: "15:00", prix: 8,  places: 40, orga: "Cercle Les Joyeux Danseurs",  source: "Association locale", desc: "Valses, tangos et chansons françaises avec un orchestre. Boisson comprise. Aucun partenaire nécessaire !", inscrits: ["u1", "u7", "u9", "u12"] },
  { id: "a3", ambiance: "tous",  titre: "Déjeuner convivial au Sablon",           cat: "Repas",   ville: "Bruxelles",        lieu: "Brasserie du Sablon",                   jours: 5,  heure: "12:30", prix: 0,  places: 10, orga: "Convivia",                      source: "Convivia",           desc: "Un repas en petit groupe pour faire connaissance. Chacun règle son repas (menu à partir de 22 €).", inscrits: ["u2", "u12", "u13"], parts: { u13: 1 } },
  { id: "a4", ambiance: "tous",  titre: "Visite guidée des Musées royaux",        cat: "Culture", ville: "Bruxelles",        lieu: "Musées royaux des Beaux-Arts",          jours: 8,  heure: "10:30", prix: 12, places: 15, orga: "Guide indépendante",          source: "Agenda culturel",  desc: "Visite commentée de 1h30 suivie d'un moment libre au café du musée.", inscrits: ["u1", "u5"] },
  { id: "a5", ambiance: "amis",  titre: "Après-midi jeux de société",             cat: "Jeux",    ville: "Namur",            lieu: "Café La Belle Époque",                  jours: 3,  heure: "14:30", prix: 0,  places: 10, orga: "Club Les Joueurs de Namur",   source: "Groupe Facebook",  desc: "Belote, scrabble, jeux d'ambiance… on s'adapte à qui vient. Ambiance garantie.", inscrits: ["u3", "u11", "u14"] },
  { id: "a6", ambiance: "amis",  titre: "Randonnée douce sur les rives de la Meuse", cat: "Marche", ville: "Namur",          lieu: "Départ de la gare de Namur",            jours: 6,  heure: "10:00", prix: 0,  places: 15, orga: "Les Pieds Légers",            source: "Groupe Facebook",  desc: "Parcours plat de 6 km, pause pique-nique prévue (apportez votre sandwich).", inscrits: ["u3", "u14"], parts: { u14: 1 } },
  { id: "a7", ambiance: "tous",  titre: "Visite de la Citadelle de Namur",        cat: "Culture", ville: "Namur",            lieu: "Entrée de la Citadelle",                jours: 9,  heure: "14:00", prix: 7,  places: 20, orga: "Office du tourisme",          source: "Agenda ouvert",    desc: "Histoire et panorama exceptionnel. Prévoir de bonnes chaussures.", inscrits: [] },
  { id: "a8", ambiance: "rencontres",  titre: "Thé dansant du dimanche",                cat: "Danse",   ville: "Liège",            lieu: "Salle Les Tilleuls",                    jours: 7,  heure: "15:00", prix: 9,  places: 50, orga: "Association Soleil d'Automne", source: "Association locale", desc: "Après-midi dansant avec orchestre, café et tarte offerts.", inscrits: ["u4"] },
  { id: "a9", ambiance: "amis",  titre: "Marche nordique – découverte",           cat: "Marche",  ville: "Liège",            lieu: "Parc de la Boverie",                    jours: 3,  heure: "09:30", prix: 0,  places: 12, orga: "Club Sport Santé Seniors",    source: "Association locale", desc: "Bâtons prêtés sur place. Une initiation en douceur, pour tous niveaux.", inscrits: ["u4"] },
  { id: "a10", ambiance: "tous", titre: "Repas partagé au bord de l'eau",         cat: "Repas",   ville: "Charleroi",        lieu: "Terrasse du Parc Reine Astrid",         jours: 5,  heure: "12:00", prix: 0,  places: 16, orga: "Collectif Table Ouverte",     source: "Groupe Facebook",  desc: "Chacun apporte un plat à partager. On se retrouve autour d'une grande table.", inscrits: ["u6"] },
  { id: "a11", ambiance: "tous", titre: "Ciné-club : les classiques",             cat: "Culture", ville: "Charleroi",        lieu: "Cinéma Le Parc",                        jours: 10, heure: "14:00", prix: 6,  places: 60, orga: "Ciné-club de Charleroi",      source: "Agenda ouvert",    desc: "Projection d'un film classique, suivie d'un café-discussion.", inscrits: ["u6"] },
  { id: "a12", ambiance: "tous", titre: "Initiation à la danse en ligne",         cat: "Danse",   ville: "Mons",             lieu: "Maison des associations",               jours: 4,  heure: "18:00", prix: 5,  places: 25, orga: "Martine & Les Country Girls", source: "Association locale", desc: "Cours d'essai pour débutants, ambiance festive et sans prise de tête.", inscrits: ["u7"] },
  { id: "a13", ambiance: "tous", titre: "Atelier cuisine : tartes d'automne",     cat: "Repas",   ville: "Mons",             lieu: "Atelier de cuisine du centre",          jours: 11, heure: "10:00", prix: 25, places: 8,  orga: "Chef à domicile",             source: "Partenaire",       desc: "On prépare, on cuisine, on déguste ensemble. Tout le matériel est fourni.", inscrits: ["u7"] },
  { id: "a14", ambiance: "amis", titre: "Pétanque entre amis",                    cat: "Jeux",    ville: "Tournai",          lieu: "Terrain de pétanque du Parc",           jours: 4,  heure: "15:00", prix: 0,  places: 16, orga: "Pétanque Club Tournaisien",   source: "Association locale", desc: "Boules prêtées. Venez même sans expérience !", inscrits: ["u10"] },
  { id: "a15", ambiance: "tous", titre: "Balade dans le Vieux-Lille",             cat: "Culture", ville: "Lille",            lieu: "Place du Général de Gaulle",            jours: 6,  heure: "14:30", prix: 0,  places: 14, orga: "Les Flâneurs lillois",        source: "Groupe Facebook",  desc: "Un parcours de 2h dans les ruelles du Vieux-Lille, avec un goûter à la fin.", inscrits: ["u5"] },
  { id: "a16", ambiance: "amis", titre: "Café philo & gâteaux",                   cat: "Jeux",    ville: "Lille",            lieu: "Salon de thé Les Délices",              jours: 3,  heure: "16:00", prix: 0,  places: 12, orga: "Café Philo Lille",            source: "Agenda ouvert",    desc: "On discute d'un thème simple, sans prétention. Chacun prend la parole s'il le souhaite.", inscrits: ["u5"] },
  { id: "a17", ambiance: "amis", titre: "Marche autour du lac",                   cat: "Marche",  ville: "Louvain-la-Neuve", lieu: "Parking du lac",                        jours: 5,  heure: "10:00", prix: 0,  places: 15, orga: "Randonneurs du Brabant wallon", source: "Groupe Facebook", desc: "Tour du lac (4 km) puis café à la Grand-Place.", inscrits: ["u11"] },
  { id: "a18", ambiance: "tous", titre: "Croisière sur le canal",                 cat: "Voyage",  ville: "Bruxelles",        lieu: "Embarcadère, quai des Péniches",        jours: 12, heure: "11:00", prix: 18, places: 20, orga: "Bateaux de Bruxelles",        source: "Partenaire",       desc: "Une promenade commentée de 2h sur le canal, collation à bord.", inscrits: ["u1", "u12"] },
  { id: "a19", ambiance: "tous", titre: "Journée à Bruges (autocar)",             cat: "Voyage",  ville: "Bruxelles",        lieu: "Départ gare du Midi",                   jours: 20, heure: "08:00", prix: 45, places: 30, orga: "Voyages Horizon",             source: "Partenaire",       desc: "Aller-retour en autocar, visite guidée et temps libre. Déjeuner non compris.", inscrits: ["u2", "u8", "u9"] },
  { id: "a20", ambiance: "rencontres", titre: "Soirée rencontres pour célibataires 50+", cat: "Repas", ville: "Bruxelles", lieu: "Restaurant La Table Ronde, centre-ville", jours: 9, heure: "19:30", prix: 15, places: 20, orga: "Convivia", source: "Convivia", desc: "Un dîner en petites tables qui changent entre les plats, pour discuter avec plusieurs personnes. Pour celles et ceux qui souhaitent faire une rencontre amoureuse.", inscrits: ["u2", "u12"] },
  { id: "a21", ambiance: "rencontres", titre: "Dîner des célibataires", cat: "Repas", ville: "Namur", lieu: "Auberge de la Citadelle", jours: 13, heure: "19:00", prix: 18, places: 16, orga: "Convivia", source: "Convivia", desc: "Une soirée conviviale et sans pression, avec un animateur pour briser la glace.", inscrits: ["u3"] }
];

/* Questionnaire (QCM) : 13 questions, toutes facultatives */
window.BELORA_QUESTIONS = [
  { id: "rythme", label: "Rythme", q: "Votre rythme idéal ?", opts: ["Tranquille", "Actif", "Sportif"] },
  { id: "dispo", label: "Disponible", q: "Quand sortez-vous le plus facilement ?", multi: true, opts: ["Journées en semaine", "Soirs de semaine", "Week-ends", "Flexible"] },
  { id: "deplacement", label: "Déplacement", q: "Comment vous déplacez-vous ?", opts: ["Voiture (covoiturage possible)", "Transports en commun", "À pied ou à vélo", "Plutôt près de chez moi"] },
  { id: "sorties", label: "Sorties préférées", q: "Vos sorties préférées ?", multi: true, opts: ["Nature et balades", "Restaurant", "Musées et expos", "Danse et musique", "Jeux et cartes", "Voyages"] },
  { id: "contact", label: "Contact", q: "Face aux nouvelles personnes, vous êtes…", opts: ["Je me lie vite", "Je prends mon temps", "Plutôt discret(e)"] },
  { id: "amitie", label: "Compte le plus", q: "Qu'est-ce qui compte le plus chez un ami ?", opts: ["L'humour", "L'écoute", "La fiabilité", "La curiosité"] },
  { id: "situation", label: "Situation", q: "Votre situation ?", opts: ["Retraité(e)", "En activité", "À temps partiel"] },
  { id: "animaux", label: "Animaux", q: "Les animaux ?", opts: ["J'en ai un", "J'adore", "Plutôt pas fan", "Allergique"] },
  { id: "famille", label: "Famille", q: "Votre entourage familial ?", opts: ["Très présent (petits-enfants…)", "Un peu présent", "Peu disponible"] },
  { id: "repas", label: "Repas", q: "Au restaurant, vous mangez…", opts: ["De tout", "Végétarien", "Régime particulier"] },
  { id: "tabac", label: "Tabac", q: "Le tabac ?", pub: true, opts: ["Non-fumeur", "Fume occasionnellement", "Fume régulièrement"], short: { "Non-fumeur": "Non-fumeur", "Fume occasionnellement": "Fume parfois", "Fume régulièrement": "Fumeur" } },
  { id: "alcool", label: "Alcool", q: "L'alcool ?", pub: true, opts: ["Jamais", "Occasionnellement", "Volontiers"], short: { "Jamais": "Sans alcool", "Occasionnellement": "Alcool occasionnel", "Volontiers": "Boit volontiers" } },
  { id: "voyages", label: "Voyages", q: "Voyages ?", opts: ["Pas vraiment", "Quelques escapades", "Plusieurs voyages par an"] }
];
(function () {
  function rng(seed) { var h = 2166136261; for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; }; }
  window.BELORA_USERS.forEach(function (u) {
    var r = rng(u.id + "belora"); u.rep = {};
    u.likesMe = { amitie: r() < 0.6, amour: r() < 0.55 };
    if (u.id === "u1") u.likesMe = { amitie: true, amour: false };
    if (u.id === "u9") u.likesMe = { amitie: false, amour: true };
    window.BELORA_QUESTIONS.forEach(function (q) {
      if (q.id === "famille" && r() < 0.2) return;
      if (q.multi) { var n = 1 + Math.floor(r() * Math.min(3, q.opts.length)), pool = q.opts.slice(), pick = [];
        while (pick.length < n) pick.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); u.rep[q.id] = pick; }
      else u.rep[q.id] = q.opts[Math.floor(r() * q.opts.length)];
    });
  });
})();
