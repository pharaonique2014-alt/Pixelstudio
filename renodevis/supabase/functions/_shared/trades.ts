// Configuration des métiers et des questions du quiz.
// Partagée entre le navigateur (affichage) et le serveur (validation) :
// une seule source de vérité pour les valeurs acceptées.

export type Option = { value: string; label: string };

export type DetailQuestion = {
  key: string;
  legend: string;
  options: Option[];
};

export type Trade = {
  code: string;
  label: string;
  /** Actif sur la plateforme (la page test ne propose que les châssis). */
  active: boolean;
  detail: DetailQuestion;
};

export const PROJECT_TYPES: Option[] = [
  { value: "renovation", label: "Rénovation" },
  { value: "nouvelle_construction", label: "Nouvelle construction" },
  { value: "extension", label: "Extension" },
];

export const BUDGETS: Option[] = [
  { value: "moins_5000", label: "Moins de 5 000 €" },
  { value: "5000_10000", label: "5 000 à 10 000 €" },
  { value: "10000_20000", label: "10 000 à 20 000 €" },
  { value: "plus_20000", label: "Plus de 20 000 €" },
  { value: "inconnu", label: "Je ne sais pas" },
];

// Pas de « je me renseigne » : uniquement des projets avec une échéance.
export const DELAYS: Option[] = [
  { value: "asap", label: "Dès que possible" },
  { value: "3_mois", label: "Dans les 3 mois" },
  { value: "6_mois", label: "Dans les 6 mois" },
];

export const TRADES: Record<string, Trade> = {
  chassis: {
    code: "chassis",
    label: "Châssis",
    active: true,
    detail: {
      key: "quantite",
      legend: "Combien de fenêtres et de portes ?",
      options: [
        { value: "1_3", label: "1 à 3" },
        { value: "4_6", label: "4 à 6" },
        { value: "7_10", label: "7 à 10" },
        { value: "plus_10", label: "Plus de 10" },
      ],
    },
  },
  // Versions multi-métiers (inactives tant que la page test tourne)
  isolation: {
    code: "isolation",
    label: "Isolation",
    active: false,
    detail: {
      key: "zone",
      legend: "Que souhaitez-vous isoler ?",
      options: [
        { value: "toiture", label: "Toiture ou combles" },
        { value: "murs", label: "Murs" },
        { value: "sol", label: "Sol ou cave" },
        { value: "plusieurs", label: "Plusieurs zones" },
      ],
    },
  },
  toiture: {
    code: "toiture",
    label: "Toiture",
    active: false,
    detail: {
      key: "travaux",
      legend: "Quels travaux de toiture ?",
      options: [
        { value: "refection", label: "Réfection complète" },
        { value: "reparation", label: "Réparation" },
        { value: "isolation", label: "Isolation de la toiture" },
        { value: "autre", label: "Autre" },
      ],
    },
  },
  chauffage: {
    code: "chauffage",
    label: "Chauffage",
    active: false,
    detail: {
      key: "type",
      legend: "Quel type de chauffage ?",
      options: [
        { value: "pompe_a_chaleur", label: "Pompe à chaleur" },
        { value: "chaudiere", label: "Chaudière" },
        { value: "poele", label: "Poêle" },
        { value: "je_ne_sais_pas", label: "Je ne sais pas encore" },
      ],
    },
  },
};

export const values = (opts: Option[]): string[] => opts.map((o) => o.value);
