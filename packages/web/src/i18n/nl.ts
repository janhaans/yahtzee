import type { BoxId } from '@yahtzee/game-logic';
import type { ActionError } from '@yahtzee/server/protocol';

/** All Dutch user-facing text. More sections are added per milestone. */
export const nl = {
  appName: 'Yahtzee Party',

  boxes: {
    ones: 'Enen',
    twos: 'Tweeën',
    threes: 'Drieën',
    fours: 'Vieren',
    fives: 'Vijven',
    sixes: 'Zessen',
    threeOfAKind: 'Drie gelijke',
    fourOfAKind: 'Vier gelijke',
    fullHouse: 'Full House',
    smallStraight: 'Kleine straat',
    largeStraight: 'Grote straat',
    yahtzee: 'Yahtzee',
    chance: 'Kans',
  } satisfies Record<BoxId, string>,

  /** One-line explanation plus an example for the (i) button next to each box. */
  boxInfo: {
    ones: {
      text: 'Tel alle enen bij elkaar op.',
      example: '1 1 1 4 6 geeft 3 punten.',
    },
    twos: {
      text: 'Tel alle tweeën bij elkaar op.',
      example: '2 2 3 5 6 geeft 4 punten.',
    },
    threes: {
      text: 'Tel alle drieën bij elkaar op.',
      example: '3 3 3 1 2 geeft 9 punten.',
    },
    fours: {
      text: 'Tel alle vieren bij elkaar op.',
      example: '4 4 1 2 6 geeft 8 punten.',
    },
    fives: {
      text: 'Tel alle vijven bij elkaar op.',
      example: '5 5 5 5 2 geeft 20 punten.',
    },
    sixes: {
      text: 'Tel alle zessen bij elkaar op.',
      example: '6 6 6 1 3 geeft 18 punten.',
    },
    threeOfAKind: {
      text: 'Minstens 3 dezelfde? Dan tel je alle dobbelstenen op.',
      example: '4 4 4 2 5 geeft 19 punten.',
    },
    fourOfAKind: {
      text: 'Minstens 4 dezelfde? Dan tel je alle dobbelstenen op.',
      example: '6 6 6 6 2 geeft 26 punten.',
    },
    fullHouse: {
      text: 'Drie van het ene getal en twee van een ander getal.',
      example: '3 3 3 5 5 geeft 25 punten.',
    },
    smallStraight: {
      text: 'Vier getallen op een rij.',
      example: '1 2 3 4 6 geeft 30 punten.',
    },
    largeStraight: {
      text: 'Vijf getallen op een rij.',
      example: '2 3 4 5 6 geeft 40 punten.',
    },
    yahtzee: {
      text: 'Alle vijf dobbelstenen hetzelfde!',
      example: '5 5 5 5 5 geeft 50 punten.',
    },
    chance: {
      text: 'Alles mag: tel alle dobbelstenen op.',
      example: '1 3 4 5 6 geeft 19 punten.',
    },
  } satisfies Record<BoxId, { text: string; example: string }>,

  start: {
    newGame: 'Nieuw spel',
    tagline: 'Gooien, gooien en nog eens gooien!',
    connecting: 'Verbinden met de spelcomputer...',
  },

  setup: {
    title: 'Wie doen er mee?',
    playerCount: 'Aantal spelers',
    playerLabel: (n: number) => `Speler ${n}`,
    namePlaceholder: 'Naam',
    whoStarts: 'Wie begint?',
    start: 'Start!',
    back: 'Terug',
  },

  game: {
    round: (round: number, total: number) => `Ronde ${round} van ${total}`,
    turn: (name: string) => `${name} is aan de beurt!`,
    roll: 'Gooien!',
    rollsLeft: (n: number) => (n === 1 ? 'nog 1 worp' : `nog ${n} worpen`),
    chooseBox: 'Kies een vakje',
    rollFirst: 'Gooi eerst de dobbelstenen',
    holdHint: 'Tik op een dobbelsteen om hem vast te houden.',
    die: (n: number, value: number | null, held: boolean) =>
      `Dobbelsteen ${n}${value === null ? '' : `: ${value}`}${held ? ', vastgehouden' : ''}`,
    held: 'Vast',
    rules: 'Regels',
    stop: 'Stop spel',
    scores: 'Stand',
    info: (box: string) => `Uitleg ${box}`,
  },

  scorecard: {
    box: 'Vakje',
    upperTotal: 'Boven totaal',
    upperBonus: 'Bonus (63 of meer)',
    bonusProgress: (total: number) => `${total} van 63`,
    lowerTotal: 'Onder totaal',
    yahtzeeBonus: 'Yahtzee-bonus',
    grandTotal: 'Totaal',
  },

  confirm: {
    score: (points: number, box: string) =>
      `${points} ${points === 1 ? 'punt' : 'punten'} bij ${box}?`,
    scratch: (box: string) => `0 punten bij ${box}? Dit vakje is dan gebruikt.`,
    yahtzeeBonus: 'Nog een Yahtzee: je krijgt er 100 bonuspunten bij!',
    yes: 'Ja!',
    no: 'Nee, terug',
    stop: 'Weet je zeker dat je wilt stoppen?',
    stopYes: 'Ja, stoppen',
    stopNo: 'Nee, verder spelen',
    close: 'Sluiten',
  },

  end: {
    title: 'Het spel is klaar!',
    winner: (name: string) => `${name} wint! Gefeliciteerd!`,
    tie: (names: string) => `Gelijkspel! ${names} winnen samen!`,
    and: 'en',
    points: (n: number) => `${n} punten`,
    rematch: 'Nog een keer (zelfde spelers)',
    newGame: 'Nieuw spel',
  },

  rules: {
    title: 'Zo speel je Yahtzee',
    lines: [
      'Het spel heeft 13 rondes. Iedere ronde is iedereen één keer aan de beurt.',
      'Je mag de vijf dobbelstenen tot 3 keer gooien. Tik op een dobbelsteen om hem vast te houden; die wordt dan niet opnieuw gegooid.',
      'Daarna kies je een leeg vakje op je scorekaart. Je ziet al hoeveel punten elk vakje oplevert.',
      'Levert niets punten op? Dan kies je toch een vakje en krijg je daar 0 punten.',
      'Haal je in het bovenste deel samen 63 punten of meer? Dan krijg je 35 bonuspunten!',
      'Gooi je nog een Yahtzee terwijl er al 50 in je Yahtzee-vakje staat? Dan krijg je 100 bonuspunten!',
      'Bij een extra Yahtzee vul je eerst het bijpassende vakje in het bovenste deel. Is dat al vol? Dan mag de Yahtzee als joker in het onderste deel: Full House en de straten tellen dan volledig mee.',
      'Wie aan het eind de meeste punten heeft, wint. Evenveel punten? Dan winnen jullie samen!',
    ],
  },

  errors: {
    too_few_players: 'Je hebt minstens 2 spelers nodig.',
    too_many_players: 'Er kunnen maximaal 4 spelers meedoen.',
    duplicate_player_id: 'Er ging iets mis met de spelers. Probeer het nog eens.',
    name_required: 'Iedere speler heeft een naam nodig.',
    name_too_long: 'Een naam mag maximaal 15 tekens zijn.',
    duplicate_name: 'Twee spelers hebben dezelfde naam. Maak ze een beetje anders!',
    game_over: 'Dit spel is al klaar.',
    no_rolls_left: 'Je hebt al 3 keer gegooid. Kies een vakje!',
    not_rolled_yet: 'Gooi eerst de dobbelstenen.',
    invalid_die_index: 'Die dobbelsteen bestaat niet.',
    box_not_allowed: 'Dat vakje kan nu niet. Kies een ander vakje.',
    no_game: 'Er is nog geen spel. Start een nieuw spel!',
    game_in_progress: 'Er wordt al een spel gespeeld.',
    game_not_finished: 'Het spel is nog niet klaar.',
    invalid_input: 'Er ging iets mis. Probeer het nog eens.',
    disconnected: 'Even geen verbinding met de spelcomputer...',
  } satisfies Record<ActionError | 'disconnected', string>,
} as const;
