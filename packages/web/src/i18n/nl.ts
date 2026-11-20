import type { BoxId } from '@yahtzee/game-logic';
import type { AvatarId, Colour, ThemeId } from '@yahtzee/server/looks';
import type { ActionError } from '@yahtzee/server/protocol';
import type { MessageKind } from '../fun/messages';

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
    tagline: 'Kies een thema en gooi de dobbelstenen!',
    chooseTheme: 'Kies je thema',
    connecting: 'Verbinden met de spelcomputer...',
  },

  themes: {
    voetbal: { name: 'Voetbalstadion', description: 'Groen veld, juichend publiek' },
    snoep: { name: 'Snoepwinkel', description: 'Zoet, vrolijk en kleurig' },
  } satisfies Record<ThemeId, { name: string; description: string }>,

  setup: {
    title: 'Wie doen er mee?',
    subtitle: (theme: string) => `2 tot 4 spelers · thema ${theme}`,
    playerLabel: (n: number) => `Speler ${n}`,
    namePlaceholder: 'Naam',
    addPlayer: '+ Speler toevoegen',
    removePlayer: (n: number) => `Speler ${n} weghalen`,
    whoStarts: 'Wie begint? Gooi!',
    start: { voetbal: 'Aftrappen!', snoep: 'Start het spel' } satisfies Record<ThemeId, string>,
    back: 'Terug',
    recent: 'Eerder gespeeld:',
    addRecent: (name: string) => `${name} meedoen`,
    chooseAvatar: (n: number) => `Kies een plaatje voor speler ${n}`,
    avatarTitle: 'Kies je plaatje',
    colours: (n: number) => `Kleur van speler ${n}`,
    colourTaken: (colour: string) => `${colour} (al gekozen)`,
    onPhone: '📱 op de telefoon',
    phoneOffline: '📱 even weg...',
  },

  avatars: {
    football: 'Voetbal',
    glove: 'Keepershandschoen',
    trophy: 'Beker',
    shirt: 'Voetbalshirt',
    cupcake: 'Cupcake',
    lollipop: 'Lolly',
    donut: 'Donut',
    icecream: 'IJsje',
    gummybear: 'Beertje',
    cat: 'Kat',
    dog: 'Hond',
    unicorn: 'Eenhoorn',
    panda: 'Panda',
    fox: 'Vos',
  } satisfies Record<AvatarId, string>,

  colours: {
    '#e8457c': 'Roze',
    '#2e8b57': 'Groen',
    '#7b4fd6': 'Paars',
    '#d66a00': 'Oranje',
    '#1f6fd1': 'Blauw',
    '#c62828': 'Rood',
    '#00838f': 'Blauwgroen',
    '#8d5a2b': 'Bruin',
  } satisfies Record<Colour, string>,

  unfinished: {
    title: 'Je hebt een onafgemaakt spel. Verder spelen of stoppen?',
    round: (round: number, total: number) => `Jullie waren in ronde ${round} van ${total}.`,
    startedAt: (time: string) => `Begonnen op ${time}`,
    stopNote: 'Stoppen bewaart het spel als afgebroken.',
    continue: 'Verder spelen',
    stop: 'Stoppen',
  },

  history: {
    saveFailed:
      'Oeps, het spel kon even niet bewaard worden. Na de volgende beurt proberen we het opnieuw!',
  },

  /** Short, positive reactions per theme. Never mean, and never about boys or girls only. */
  messages: {
    voetbal: {
      yahtzee: [
        'GOOOAL! Vijf op een rij, wat een wereldgoal!',
        'Yahtzee! Het hele stadion staat op de banken!',
        'Hattrick? Nee, een Yahtzee! Nog beter!',
        'Wat een doelpunt! Vijf dezelfde!',
      ],
      yahtzeeBonus: [
        'Nóg een Yahtzee! 100 bonuspunten, wat een kampioen!',
        'Weer raak! Dit gaat de geschiedenisboeken in!',
      ],
      bonus: [
        'Bonus binnen! 35 extra punten, net als een strafschop die erin gaat!',
        'De bovenste rij is af: bonus voor de topper!',
        'Extra tijd? Nee, extra punten!',
      ],
      largeStraight: [
        'Grote straat... recht op het doel af!',
        'Wat een sprint over de hele vleugel!',
        'Van achteren opgebouwd en keihard raak!',
      ],
      smallStraight: [
        'Kleine straat! Mooie combinatie op het middenveld.',
        'Tik-tak-tik-tak... en raak!',
        'Netjes overgespeeld, 30 punten!',
      ],
      fullHouse: [
        'Full House! Het stadion is uitverkocht!',
        'Volle tribunes, volle punten!',
        'Drie plus twee: een perfect team!',
      ],
      high: [
        'Wat een knaller!',
        'Die zat in de kruising!',
        'Een omhaal van jewelste!',
        'Daar kon de keeper niks aan doen!',
        'Topscorer in actie!',
      ],
      good: [
        'Mooi schot!',
        'Netjes gespeeld!',
        'Punten op het scorebord!',
        'Lekker bezig, de trainer is trots!',
        'Goede pass!',
        'Zo bouw je een overwinning!',
        'Zo, die zit!',
      ],
      zero: [
        'Oei, nul punten. Dat was buitenspel!',
        'Net naast! Volgende keer zit hij erin.',
        'Paal! Pech, maar je komt terug.',
        'Even op adem komen op de bank. Volgende ronde beter!',
        'De keeper had hem. Kop op, nieuwe kans!',
      ],
    },
    snoep: {
      yahtzee: [
        'YAHTZEE! Een hele zak snoep voor jou!',
        'Vijf dezelfde: zo zoet als een suikerspin!',
        'Jackpot in de snoepwinkel!',
        'Yahtzee! Het regent snoepjes!',
      ],
      yahtzeeBonus: [
        'Nóg een Yahtzee! 100 extra snoeppunten!',
        'Weer een Yahtzee! De snoeppot is leeg!',
      ],
      bonus: [
        'Bonus! 35 punten extra, als een kers op de taart!',
        'De bovenste rij is af: extra toetje!',
        'Bonuspunten, zo lekker als warme chocolademelk!',
      ],
      largeStraight: [
        "Grote straat! Een hele rij lolly's!",
        'Vijf op een rij, als een ketting van snoepjes!',
        'Grote straat, zo lang als een dropveter!',
      ],
      smallStraight: [
        'Kleine straat! Een rijtje zuurtjes!',
        'Vier op een rij, zo netjes als een doos bonbons!',
        '30 punten, wat een smakelijke straat!',
      ],
      fullHouse: [
        'Full House! Zoet als een snoepje!',
        'Een vol snoepzakje!',
        'Drie en twee: een perfecte mix!',
      ],
      high: [
        'Mmm, wat een lekkere worp!',
        'Wat een smulpunten!',
        'Dat is een dubbele bol ijs waard!',
        'Kassa! Snoepjes voor iedereen!',
        'Zo zoet als suikerspin!',
      ],
      good: [
        'Lekker gedaan!',
        'Smakelijk!',
        'Weer een paar snoepjes in je zak!',
        'Mooi zo, nog een snoepje erbij!',
        'Hap, punten!',
        'Dat smaakt naar meer!',
      ],
      zero: [
        'Nul punten... die dobbelstenen hebben te veel suiker op.',
        'Oeps, de snoeppot was even leeg. Volgende keer beter!',
        'Geen punten, maar wel een gratis lolly voor de moeite!',
        'Die worp was een zure mat. De volgende is vast zoet!',
        'Even geen snoep, wel een glimlach!',
      ],
    },
  } satisfies Record<ThemeId, Record<MessageKind, readonly string[]>>,

  /** Titles at the winner party. Gender-neutral, because everybody plays. */
  titles: {
    voetbal: {
      winner: 'Speler van de wedstrijd',
      yahtzee: 'Hattrick-held',
      bonus: 'Bonusjager',
      straights: 'Straatmeester',
      bestBox: 'Topscorer',
      bravest: 'Durfal van het veld',
      extra: ['Teamspeler', 'Supporter van het jaar', 'Talent van de toekomst'],
    },
    snoep: {
      winner: 'Snoepkampioen',
      yahtzee: 'Jackpot-snoeper',
      bonus: 'Toetjesjager',
      straights: 'Straatmeester',
      bestBox: 'Lekkerbek',
      bravest: 'Zuurtjesheld',
      extra: ['Lollyliefhebber', 'Chocoladefan', 'Snoepproever'],
    },
  } satisfies Record<
    ThemeId,
    Record<'winner' | 'yahtzee' | 'bonus' | 'straights' | 'bestBox' | 'bravest', string> & {
      extra: readonly string[];
    }
  >,

  celebrate: {
    yahtzee: 'YAHTZEE!!!',
    goal: 'GOOOAL!',
    sweets: 'Het regent snoep!',
    skip: 'Tik om verder te gaan',
  },

  sound: {
    label: 'Geluid',
    on: 'Geluid aan',
    off: 'Geluid uit',
    turnOn: 'Geluid aan',
    turnOff: 'Geluid uit',
  },

  game: {
    round: (round: number, total: number) => `Ronde ${round} van ${total}`,
    turn: (name: string) => `${name} is aan de beurt`,
    rollOf: (n: number, max: number) => `Worp ${n} van ${max}`,
    chooseBoxHint: 'Kies een vakje op je scorekaart',
    menu: 'Menu',
    roll: 'Gooien!',
    rollsLeft: (n: number) => (n === 1 ? 'nog 1 worp' : `nog ${n} worpen`),
    chooseBox: 'Kies een vakje',
    rollFirst: 'Gooi eerst de dobbelstenen',
    holdHint: 'tik op een dobbelsteen om hem vast te houden',
    die: (n: number, value: number | null, held: boolean) =>
      `Dobbelsteen ${n}${value === null ? '' : `: ${value}`}${held ? ', vastgehouden' : ''}`,
    held: 'Vast',
    rules: 'Regels',
    stop: 'Stop spel',
    scores: 'Stand',
    info: (box: string) => `Uitleg ${box}`,
  },

  scorecard: {
    title: (name: string) => `Scorekaart ${name}`,
    tapToChoose: 'tik om te kiezen',
    bonusAt: (threshold: number) => `Bonus bij ${threshold}`,
    box: 'Vakje',
    upper: 'Boven',
    lower: 'Onder',
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
    title: 'Eindstand',
    place: (place: number) => `Plek ${place}`,
    winner: (name: string) => `${name} wint!`,
    congrats: 'Gefeliciteerd! Wat een wedstrijd.',
    tie: 'Gelijkspel!',
    tieNames: (names: string) => `${names} winnen samen!`,
    and: 'en',
    points: (n: number) => `${n} punten`,
    rematch: 'Nog een keer',
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
    duplicate_colour: 'Twee spelers hebben dezelfde kleur. Kies voor iedereen een eigen kleur!',
    unfinished_game:
      'Er staat nog een onafgemaakt spel klaar. Kies eerst: verder spelen of stoppen.',
    no_unfinished_game: 'Er is al gekozen wat er met het oude spel gebeurt.',
    not_allowed: 'Dat kan alleen op de laptop.',
    not_your_turn: 'Even geduld, je bent nog niet aan de beurt!',
    seat_taken: 'Die speler speelt al op een andere telefoon.',
    too_early: 'Nog heel even wachten, misschien komt de telefoon zo terug.',
    no_lobby: 'Er wordt nu geen nieuw spel klaargezet.',
    disconnected: 'Even geen verbinding met de spelcomputer...',
  } satisfies Record<ActionError | 'disconnected', string>,
} as const;
