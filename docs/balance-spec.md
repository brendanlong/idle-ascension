# Balance spec

What we want the game's pacing to feel like, written as checks the sim can
grade. The numbers live in [`scripts/balance/spec.json`](../scripts/balance/spec.json);
this doc explains them. When the game feels wrong, first make this spec say
what we actually want, then re-run the tooling until the game meets it.

```sh
python3 scripts/balance/spec.py            # grade the game as it is
python3 scripts/balance/spec.py params.json # grade a SIM_TUNE candidate
```

## Overall shape

- A short game full of content beats a long, boring one. A few hours is fine;
  if it feels too short, add content rather than stretching waits.
- Early stages are fast, and every stage takes a bit longer than the last.
- Being active (gathering motes) always feels worthwhile. It's much stronger
  than idling early on and only a little stronger late.
- Idling still makes sense, and the game never strands an idle player.
- Progress plateaus a few times, and regressing gets you past each plateau.
- No bursts where you can suddenly buy everything at once.

## Reference players

Checks are measured on bots that buy whatever pays for itself soonest, and
regress when stuck or when regressing is clearly worth it (see
`scripts/sim.ts`):

- **active**: gathers motes the whole time. Pacing targets are set for this
  player, because its progress depends only on prices.
- **passive**: never gathers, except to get started and while replaying
  after a regression. It shows the game still works for idle play.

The "active early, idle late" bot (`SIM_PLAYER=taper`) is a sanity check,
not a target. It checks in only every 10 minutes late in the game, so its
times there stop depending on prices.

## Checks

### 1. Every stage takes longer than the last (`stageSeconds`)

Measured on the reference player: the time from first reaching a stage to
first reaching the next, including any regressions in between. That includes
everything the player has bought and remembered by then.

- Active stage times follow a smooth curve, from `first` (10s for the first
  breakthrough) to `last` (10 minutes for Godhood), each within `tolerance`×.
- For both players, each stage takes at least `monotoneSlack`× as long as the
  previous one.

### 2. Always something to buy (`somethingToBuy`)

Something new is a technique, a core grade, a resource you haven't owned
before, a breakthrough or an insight level.

- Never longer than `maxGapShareOfStage` of the current stage's time (or
  `minGapSeconds`, if that's longer) without something new. So most stages
  have a purchase or two between breakthroughs.
- Never more than `maxBurst` new techniques bought in the same moment.

### 3. Every upgrade is meaningful (`minUpgradeGain`, `newResource`)

We assume players buy the most effective thing available, and rework or drop
upgrades that don't earn their place.

- Each technique and core adds at least `minUpgradeGain`× income when the
  reference player buys it. Gathering upgrades are judged by gathering
  income, and the others by whichever income they raise more.
- A new resource, with its first technique and `spendSeconds` of income spent
  on it, makes about as much as all your other resources combined (within
  `shareOfOthers`). This is measured at its first purchase.

### 4. Gathering's edge over idling (`activeRatio`)

Gathering income ÷ idle income at the frontier (not while replaying). It
slides smoothly from `first` (about 20× in Qi Condensation) to `last` (about
2× in Immortal Ascension), each realm within `tolerance`×.

- Gathering is already strong, so be stingy with upgrades that boost it.
  Gathering upgrades are what shape this slide.
- Idle income is weak, so temporary buffs to it (encounters, events) can be
  generous. Buffs should multiply idle income only, not mote value.

### 5. Plateaus that regression fixes (`regression`)

- The active player regresses `count` times over the game.
- Each regression reaches the next new stage at least `minPayoff`× sooner
  than waiting would have (estimated from income when regressing).
- Replaying a finished realm takes at most `maxReplayShare` of the time its
  first visit took.

### 6. Treasures (`treasures`)

- Each treasure that changes income adds `levelOneGain`× when found at level
  1. Treasures that affect something else (encounters, tribulations) aren't
  graded yet.
- Treasure luck matters, but not too much: finishing with every treasure vs
  none changes total time by at most `maxLuckSpread`×.

## Not yet specified

- **Idle and offline time.** Nothing stops a player from leaving the game for
  4+ hours. We might cap offline gains to match the target game length.
- **Total length.** It follows from the stage curve: about 1.5h of active
  play if every stage hits its target. Adjust `stageSeconds` to change it.
