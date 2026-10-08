// Corpus du spike 0.2 : 10 phrases par langue, données fictives, avec pièges : noms polonais et turcs,
// noms communs allemands capitalisés, prénoms seuls, cellules de tableau (texte court sans contexte).
export type Gold = readonly [text: string, type: "PERSON" | "ORGANIZATION" | "LOCATION"];
export interface Sample {
  lang: "fr" | "de" | "en";
  text: string;
  gold: readonly Gold[];
}

export const NER_CORPUS: readonly Sample[] = [
  {
    lang: "fr",
    text: "Paulina Kowalski a rencontré Mehmet Yılmaz à Lyon la semaine dernière.",
    gold: [
      ["Paulina Kowalski", "PERSON"],
      ["Mehmet Yılmaz", "PERSON"],
      ["Lyon", "LOCATION"],
    ],
  },
  {
    lang: "fr",
    text: "Le contrat avec la Société Générale a été signé par Jean-Baptiste Morel.",
    gold: [
      ["Société Générale", "ORGANIZATION"],
      ["Jean-Baptiste Morel", "PERSON"],
    ],
  },
  { lang: "fr", text: "Merci de transmettre le dossier à Agnieszka avant vendredi.", gold: [["Agnieszka", "PERSON"]] },
  {
    lang: "fr",
    text: "Ayşe Demir travaille désormais pour Arte France à Issy-les-Moulineaux.",
    gold: [
      ["Ayşe Demir", "PERSON"],
      ["Arte France", "ORGANIZATION"],
      ["Issy-les-Moulineaux", "LOCATION"],
    ],
  },
  {
    lang: "fr",
    text: "Selon Grzegorz Brzęczyszczykiewicz, la mairie de Strasbourg a validé le budget.",
    gold: [
      ["Grzegorz Brzęczyszczykiewicz", "PERSON"],
      ["Strasbourg", "LOCATION"],
    ],
  },
  {
    lang: "fr",
    text: "Martin a appelé ce matin depuis la Martinique.",
    gold: [
      ["Martin", "PERSON"],
      ["Martinique", "LOCATION"],
    ],
  },
  { lang: "fr", text: "Claire Dubois", gold: [["Claire Dubois", "PERSON"]] },
  {
    lang: "fr",
    text: "La réunion avec l'équipe de Radio France est reportée à jeudi.",
    gold: [["Radio France", "ORGANIZATION"]],
  },
  {
    lang: "fr",
    text: "Mme Nguyen Thi Lan a déposé sa demande à la préfecture de Marseille.",
    gold: [
      ["Nguyen Thi Lan", "PERSON"],
      ["Marseille", "LOCATION"],
    ],
  },
  {
    lang: "fr",
    text: "Le Président de la Commission a reçu Olivier Petit et Fatma Kaya.",
    gold: [
      ["Olivier Petit", "PERSON"],
      ["Fatma Kaya", "PERSON"],
    ],
  },
  {
    lang: "de",
    text: "Paulina Kowalski hat Mehmet Yılmaz letzte Woche in Hamburg getroffen.",
    gold: [
      ["Paulina Kowalski", "PERSON"],
      ["Mehmet Yılmaz", "PERSON"],
      ["Hamburg", "LOCATION"],
    ],
  },
  {
    lang: "de",
    text: "Der Vertrag mit der Deutschen Bahn wurde von Klaus Müller unterschrieben.",
    gold: [
      ["Deutschen Bahn", "ORGANIZATION"],
      ["Klaus Müller", "PERSON"],
    ],
  },
  { lang: "de", text: "Bitte schicken Sie die Unterlagen bis Freitag an Sabine.", gold: [["Sabine", "PERSON"]] },
  { lang: "de", text: "Die Abteilung Verwaltung hat die Rechnung an die Buchhaltung weitergeleitet.", gold: [] },
  {
    lang: "de",
    text: "Laut Zbigniew Wiśniewski hat die Stadt München das Budget genehmigt.",
    gold: [
      ["Zbigniew Wiśniewski", "PERSON"],
      ["München", "LOCATION"],
    ],
  },
  {
    lang: "de",
    text: "Emre Öztürk arbeitet jetzt für das ZDF in Mainz.",
    gold: [
      ["Emre Öztürk", "PERSON"],
      ["ZDF", "ORGANIZATION"],
      ["Mainz", "LOCATION"],
    ],
  },
  { lang: "de", text: "Jürgen Schmidt", gold: [["Jürgen Schmidt", "PERSON"]] },
  { lang: "de", text: "Die Sitzung mit dem Team der ARD findet am Donnerstag statt.", gold: [["ARD", "ORGANIZATION"]] },
  {
    lang: "de",
    text: "Frau Weber hat ihren Antrag beim Landratsamt Freiburg eingereicht.",
    gold: [
      ["Weber", "PERSON"],
      ["Landratsamt Freiburg", "ORGANIZATION"],
    ],
  },
  { lang: "de", text: "Der Bäcker und der Schmied wohnen in der Mühlenstraße.", gold: [["Mühlenstraße", "LOCATION"]] },
  {
    lang: "en",
    text: "Paulina Kowalski met Mehmet Yılmaz in Manchester last week.",
    gold: [
      ["Paulina Kowalski", "PERSON"],
      ["Mehmet Yılmaz", "PERSON"],
      ["Manchester", "LOCATION"],
    ],
  },
  {
    lang: "en",
    text: "The contract with Barclays was signed by Oliver Hughes.",
    gold: [
      ["Barclays", "ORGANIZATION"],
      ["Oliver Hughes", "PERSON"],
    ],
  },
  { lang: "en", text: "Please send the files to Emily before Friday.", gold: [["Emily", "PERSON"]] },
  { lang: "en", text: "Bill will bill the client next month.", gold: [["Bill", "PERSON"]] },
  {
    lang: "en",
    text: "According to Małgorzata Zielińska, the city of Leeds approved the budget.",
    gold: [
      ["Małgorzata Zielińska", "PERSON"],
      ["Leeds", "LOCATION"],
    ],
  },
  {
    lang: "en",
    text: "Burak Çelik now works for the BBC in Cardiff.",
    gold: [
      ["Burak Çelik", "PERSON"],
      ["BBC", "ORGANIZATION"],
      ["Cardiff", "LOCATION"],
    ],
  },
  { lang: "en", text: "Sarah Johnson", gold: [["Sarah Johnson", "PERSON"]] },
  {
    lang: "en",
    text: "The meeting with the Channel 4 team has been moved to Thursday.",
    gold: [["Channel 4", "ORGANIZATION"]],
  },
  {
    lang: "en",
    text: "Ms Chen submitted her application to Bristol City Council.",
    gold: [
      ["Chen", "PERSON"],
      ["Bristol City Council", "ORGANIZATION"],
    ],
  },
  {
    lang: "en",
    text: "Hope and Faith were the names of the two boats in Portsmouth.",
    gold: [["Portsmouth", "LOCATION"]],
  },
];
