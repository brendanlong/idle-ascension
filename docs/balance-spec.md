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
- Early stages are fast. Within a life every stage takes longer than the last,
  until it gets boring and regressing resets the climb (the sawtooth, below).
- Being active (gathering motes) always feels worthwhile. It's much stronger
  than idling early on and only a little stronger late.
- Idling still makes sense, and the game never strands an idle player.
- Regressing at any point dramatically speeds the game back up; regressing
  again from the same point barely helps.
- No bursts where you can suddenly buy everything at once.

## Breakthrough costs are a smooth curve

Each stage costs a fixed multiple of the one before. That multiple blends
smoothly from an early value to a late one around Core Formation, where
regression unlocks, so the first life can climb gently and later lives
steeply (`CostCurve` in `scripts/sim.ts`). Only the curve's few parameters
get tuned, never individual stages. That way the curve doesn't depend on
when anyone happens to regress: regressing only resets the sawtooth.

If a stage is off target even though the curve is smooth, the content
around it is to blame (a burst of income from several upgrades at once, or a
drought), and that's what to fix.

## Content follows the curve

The game's content is priced from the breakthrough curve too, so it stays
evenly spread whatever the curve's numbers are:

- **Resources** form a ladder (`RESOURCE_LADDER` in
  `src/content/generators.ts`): a new tier every couple of stages all game,
  priced as a share of the breakthrough at its stage, each a fixed fraction as
  efficient (qi/s per qi) as the tier before. Realm locks are flavor and match
  where each tier lands.
- **A resource's techniques** are priced from the resource (its first
  technique arrives soon after it, its revival later).
- **Realm techniques** are priced from a stage within their realm, staggered
  so a realm's upgrades arrive one at a time.
- **Cores** (`engine/cores.ts`): each realm's new core forms a third of the
  way through its realm and gets its first refine two thirds of the way
  through; every core gains a grade per realm after that, with the older
  cores' refines spread over the rest of each realm. Each costs half the
  breakthrough cost at its point in the climb.

`tune_curve.py` fits the curve, the ladder and the Memory weight together.

## Reference players

Checks are measured on bots that buy whatever pays for itself soonest, and
regress once bored, if regressing would at least triple their Memory bonus
(see `SIM_REGRESS` in `scripts/sim.ts`):

- **active**: gathers motes the whole time. Pacing targets are set for this
  player, because its progress depends only on prices.
- **passive**: never gathers, except to get started and while replaying
  after a regression. It shows the game still works for idle play.

The "active early, idle late" bot (`SIM_PLAYER=taper`) is a sanity check,
not a target. It checks in only every 10 minutes late in the game, so its
times there stop depending on prices.

## Checks

### 1. The sawtooth (`sawtooth`)

Stages climb steeply within a life, and regressing knocks them back down:

> stage time = floor × growth ^ (stages past your reach)

- **Floor:** how long a stage takes right after regressing just below it.
  Rises linearly from `floorFirst` (10s at the first stage) to `floorLast`
  (at Godhood), so later climbs start a bit slower.
- **Growth:** each stage past your reach takes `growth`× longer than the one
  before (about ×1.25). The first life, before any regression, climbs more
  gently (`firstLifeGrowth`, about ×1.11), so it lasts until regression is
  worth it (see the layers below).
- **Reach:** the deepest stage you've regressed from, i.e. where your Memories
  carry you. It starts at 0.

So the first life speeds through the early realms and starts to drag around
Core Formation, where regression unlocks. Regressing at stage X resets stage
X+1 to the floor. A player who never regresses faces ever-longer stages (the
last would take hours), while regressing again from the same place barely
helps.

This is measured on the reference player: the time from first reaching a
stage to first reaching the next, including any regressions in between. Its
reach is the deepest stage it regressed from before reaching that stage.

- Every stage's time is within `tolerance`× of floor × growth ^ (stages past
  reach), with the last realm's stages `lastRealmLonger`× longer: the final
  realm should feel a bit long. The first stages are the most novel, so they
  may drag and lean on activity: up to `earlyUntilStage` they're allowed
  `earlyTolerance`×, with targeted tuning if they turn out too slow.
- Within a life, each stage takes at least `monotoneSlack`× as long as the
  previous one (both players).
- Players regress once they're bored: when the next stage is more than
  `boredSeconds` away and the Memory gain looks big. The reference bot does
  this.
- A second regression from the same place moves reach by at most
  `maxRepeatStages` stages.

For this to work, Memories are exponential in stage index
(`src/content/memories.ts`): each stage deeper you regress from yields
`growthPerStage` times as many, matching `growth`, and `weight` sets how far
the reset knocks stage times down.

### Layers (`layers`)

Each system carries the player further before stages get boring (take over
`boredSeconds`), measured on the active bot with systems switched off:

- **Resources and techniques alone** (no cores, never regressing): around
  Core Formation, stage `resourcesOnlyBoredBy`.
- **Plus cores** (never regressing): around where the first regression should
  happen, stage `withCoresBoredBy`.
- **Plus regression:** the whole game stays on the sawtooth.
- **Without regressing**, from stage `neverRegressClimbFrom` on, stages keep
  climbing `growth`× per stage from `boredSeconds`, so regressing is what
  resets the climb.

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
  income, and the others by whichever income they raise more. Deliberate
  jokes (the Sunflower Manual) are listed in `upgradeExempt`.
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

### 5. Regression (`regression`)

Regression is how the climb resets, so not regressing should be tedious.
Constantly regressing is a fine strategy too, as long as it isn't the only one.

- An active player who never regresses is at least `withoutSlowdownAtLeast`×
  slower than the reference player (or doesn't finish within the cap).
- Regressing when bored pays off: each of the reference player's
  regressions reaches the next new stage at least `minPayoff`× sooner than
  waiting would have (estimated from income at the time of regressing).
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
- **Total length.** It follows from the sawtooth: roughly the number of climbs
  times how long each takes before it gets boring. Adjust the floor, growth
  and boredom threshold to change it.
