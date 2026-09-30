export const INTRO_TEXT = [
  "You are the youngest child of the Lin clan's branch family, and its greatest embarrassment. At sixteen your meridians are still sealed. The elders have stopped calling you by name. They just call you trash.",
  'Tonight, sitting alone in the woodshed, you notice something strange. The qi of heaven and earth drifts around you like fireflies. And the jade pendant your mother left you is warm.',
  'Gather qi. Break through. Ascend to godhood.',
  'They will regret calling you trash.',
];

/**
 * The regression story is one random line from each part, in order. Each
 * death is a self-contained scene so it can't clash with the other parts.
 * Placeholders come from NAME_TABLES (names.ts).
 */
export const REGRESSION_STORY: readonly (readonly string[])[] = [
  [
    'You stand before the Blood Demon Sect Master, knowing exactly how this ends. His palm caves in your chest.',
    'You insult the {elderTitle} of the {sect} to their face, on purpose. They do not take it well.',
    'You walk into {place}, where an ancient {beast} the size of a mountain sleeps. It wakes up hungry.',
    "You challenge Young Master {surname}'s {relative} to a duel you cannot win. You do not win.",
    'You swallow an untested pill from a rival alchemist. Your meridians light up like fireworks, then go dark.',
    'You face a heavenly tribulation three realms too early. The ninth bolt finds you.',
    'You stop breathing during closed-door cultivation and simply do not start again. Your disciples assume you are concentrating very hard.',
  ],
  [
    'As darkness takes you, the jade pendant at your throat blazes with white light...',
    "Your mother's jade pendant cracks. Light pours out of it, and the world folds in on itself...",
    'At your throat, the jade pendant grows warm. Time begins to run backward...',
  ],
  [
    'You open your eyes in the woodshed. You are sixteen again.',
    'You wake to the smell of damp straw and a cousin kicking the woodshed door. You are sixteen again.',
    'Rain drums on the woodshed roof, exactly as it did the first time. You are sixteen again.',
  ],
  [
    'But you remember everything.',
    'The elders still call you trash. They have no idea.',
    'This time, you know which cliffs to fall off.',
    'Somewhere, Young Master {surname} does not yet know he is doomed.',
  ],
];

export const VICTORY_TEXT = [
  'Eighty-one bolts of heavenly lightning fall, and you walk through them as through spring rain.',
  'The Gate of Heaven opens. The gods who once looked down on the mortal world kneel as you pass.',
  'You have become a God.',
  'And yet... beyond the edge of the heavens, you glimpse other worlds. Other skies. A truck, inexplicably, on a road that should not exist.',
];

export const OLD_MASTER_QUIPS = [
  '"Hmph. At this rate you\'ll reach Foundation Establishment by the time I reincarnate."',
  '"In my day we cultivated uphill. Both ways. In the snow."',
  '"That young master is looking at you. Want me to teach you a technique for crippling him?"',
  '"Pay attention, brat! Qi flows *into* the dantian, not out your ears."',
  '"I once slapped a god. It was a small god, but still."',
];
