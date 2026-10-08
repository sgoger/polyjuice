// 20 phrases FR/DE/EN. Positions : début, milieu, fin de phrase. Données fictives.
export const TOKENS = ["⟦P-K7M2X⟧", "⟦O-R4N8Q⟧", "⟦E-W3X9Z⟧"] as const;
const [P, O, E] = TOKENS;

export const SENTENCES: readonly string[] = [
  `${P} a présenté le budget au comité de direction.`,
  `Le contrat signé par ${P} avec ${O} expire en mars.`,
  `Merci d'adresser vos questions à ${E}.`,
  `${O} a confirmé la date de livraison.`,
  `Selon ${P}, le projet est en avance sur le calendrier.`,
  `La réunion de lundi est annulée, voir avec ${P}.`,
  `${E} ne répond plus depuis vendredi.`,
  `${P} hat das Budget dem Vorstand vorgestellt.`,
  `Der Vertrag zwischen ${O} und ${P} läuft im März aus.`,
  `Bitte senden Sie Ihre Fragen an ${E}.`,
  `${O} hat den Liefertermin bestätigt.`,
  `Laut ${P} liegt das Projekt vor dem Zeitplan.`,
  `Die Besprechung am Montag entfällt, bitte mit ${P} abstimmen.`,
  `${P} presented the budget to the board.`,
  `The agreement between ${O} and ${P} expires in March.`,
  `Please send your questions to ${E}.`,
  `${O} confirmed the delivery date.`,
  `According to ${P}, the project is ahead of schedule.`,
  `Monday's meeting is cancelled, please check with ${P}.`,
  `${E} has not replied since Friday (${O}, ${P}).`,
];

export const TABLE_ROWS: readonly (readonly string[])[] = [
  ["Rôle / Rolle / Role", "Personne", "Contact"],
  ["Direction", P, E],
  ["Partenaire", O, `${P} (${O})`],
];

export const FOOTNOTE = `Note : ${P} représente ${O} ; contact ${E}.`;
