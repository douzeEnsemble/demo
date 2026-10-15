import { fullName, uniquePeople } from "../../lib/fake";
import { addDays, normalizeForSearch } from "../../lib/format";
import type { Rng } from "../../lib/random";

export interface PollOption {
  id: string;
  label: string;
}

export interface Vote {
  voter: string;
  /** Ids d'options ; exactement une si le sondage n'est pas à choix
   * multiples. */
  choices: string[];
  date: string;
}

export interface PollState {
  question: string;
  description: string;
  multiple: boolean;
  options: PollOption[];
  /** Du plus ancien au plus récent. */
  votes: Vote[];
  closesOn: string;
  closed: boolean;
}

export const MAX_VOTER_LENGTH = 40;
export const MAX_MULTIPLE_CHOICES = 3;

interface Scenario {
  question: string;
  description: string;
  multiple: boolean;
  pool: readonly string[];
  count: [number, number];
}

// Stryker disable StringLiteral,ArrayDeclaration,ObjectLiteral: réservoir de données
// fictives — aucun test n'a de raison d'en vérifier le texte exact, seulement
// la forme des données produites (voir generator.test.ts).
const SCENARIOS: readonly Scenario[] = [
  {
    question: "Où organiser le repas de fin d'année ?",
    description: "Le comité réserve le restaurant qui arrive en tête à la clôture.",
    multiple: false,
    pool: ["Le Petit Zinc", "Chez Mamie Jo", "La Crêperie du Port", "Bistrot Saint-Jean", "Pizzeria Bella", "Le Comptoir Thaï"],
    count: [3, 5],
  },
  {
    question: "Quel créneau pour la réunion mensuelle ?",
    description: "Coche tous les créneaux qui te conviennent (3 au maximum).",
    multiple: true,
    pool: ["Lundi 9 h", "Lundi 14 h", "Mardi 10 h", "Mercredi 16 h", "Jeudi 9 h", "Jeudi 17 h", "Vendredi 11 h"],
    count: [4, 6],
  },
  {
    question: "Quel thème pour la fête de l'été ?",
    description: "Le thème choisi sera annoncé dans la prochaine lettre d'information.",
    multiple: false,
    pool: ["Années 80", "Pirates", "Soirée tropicale", "Super-héros", "Guinguette", "Western"],
    count: [3, 5],
  },
  {
    question: "Quelle activité pour la sortie du club ?",
    description: "Plusieurs réponses possibles (3 au maximum) : on retiendra les plus demandées.",
    multiple: true,
    pool: ["Accrobranche", "Randonnée", "Bowling", "Escape game", "Kayak", "Laser game", "Visite de château"],
    count: [4, 6],
  },
  {
    question: "Quel nom pour la nouvelle salle de pause ?",
    description: "Proposition retenue à la majorité simple.",
    multiple: false,
    pool: ["La Ruche", "Le Refuge", "L'Escale", "La Cabane", "Le Phare", "L'Atelier"],
    count: [3, 5],
  },
];
// Stryker restore all

export function generatePoll(rng: Rng, today: string): PollState {
  const scenario = rng.pick(SCENARIOS);
  const options = rng.sample(scenario.pool, rng.int(...scenario.count)).map((label, i) => ({ id: `o${i + 1}`, label }));

  // Chaque option a sa propre popularité : les résultats sont nettement
  // contrastés (un favori, des outsiders) plutôt qu'uniformes, comme un vrai
  // sondage.
  const weighted = options.map((o) => [o.id, rng.int(1, 10)] as const);
  const daysOpen = rng.int(3, 12);
  const people = uniquePeople(rng, rng.int(12, 36));

  const votes: Vote[] = people
    .map((person) => {
      let choices: string[];
      if (scenario.multiple) {
        const remaining = [...weighted];
        choices = [];
        const count = rng.int(1, MAX_MULTIPLE_CHOICES);
        while (choices.length < count) {
          const choice = rng.weighted(remaining);
          choices.push(choice);
          remaining.splice(remaining.findIndex(([id]) => id === choice), 1);
        }
      } else {
        choices = [rng.weighted(weighted)];
      }
      return { voter: fullName(person), choices, date: addDays(today, -rng.int(0, daysOpen)) };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    question: scenario.question,
    description: scenario.description,
    multiple: scenario.multiple,
    options,
    votes,
    closesOn: addDays(today, rng.int(2, 10)),
    closed: false,
  };
}

export interface TallyRow {
  option: PollOption;
  count: number;
  /** Part des votants ayant choisi cette option (0–100, arrondie) : avec
   * des choix multiples, la somme peut donc dépasser 100. */
  percent: number;
  leading: boolean;
}

/** Résultats triés par nombre de voix décroissant (ordre d'origine des
 * options en cas d'égalité). Toutes les options à égalité en tête sont
 * marquées `leading` ; aucune tant que personne n'a voté. */
export function tally(poll: PollState): TallyRow[] {
  const counts = new Map(poll.options.map((o) => [o.id, 0]));
  for (const vote of poll.votes) {
    for (const choice of vote.choices) counts.set(choice, counts.get(choice)! + 1);
  }
  const max = Math.max(...counts.values());
  const voters = poll.votes.length;
  return poll.options
    .map((option) => {
      const count = counts.get(option.id)!;
      return { option, count, percent: voters ? Math.round((count / voters) * 100) : 0, leading: max > 0 && count === max };
    })
    .sort((a, b) => b.count - a.count);
}

export type VoteError = "closed" | "noName" | "nameTooLong" | "noChoice" | "tooManyChoices" | "unknownChoice";

export interface VoteResult {
  poll: PollState;
  /** Vrai si la personne avait déjà voté : son ancien vote est remplacé. */
  replaced: boolean;
}

export function castVote(poll: PollState, rawVoter: string, choices: readonly string[], date: string): VoteResult | VoteError {
  if (poll.closed) return "closed";
  const voter = rawVoter.trim().replace(/\s+/g, " ");
  if (voter === "") return "noName";
  if (voter.length > MAX_VOTER_LENGTH) return "nameTooLong";
  const unique = [...new Set(choices)];
  if (unique.length === 0) return "noChoice";
  if (unique.length > (poll.multiple ? MAX_MULTIPLE_CHOICES : 1)) return "tooManyChoices";
  if (!unique.every((c) => poll.options.some((o) => o.id === c))) return "unknownChoice";

  // Une même personne (casse et accents ignorés) ne vote qu'une fois : un
  // nouveau vote remplace l'ancien plutôt que de s'y ajouter.
  const key = normalizeForSearch(voter);
  const others = poll.votes.filter((v) => normalizeForSearch(v.voter) !== key);
  return {
    poll: { ...poll, votes: [...others, { voter, choices: unique, date }] },
    replaced: others.length !== poll.votes.length,
  };
}

export function setClosed(poll: PollState, closed: boolean): PollState {
  return { ...poll, closed };
}
