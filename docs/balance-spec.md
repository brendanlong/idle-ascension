# Balance spec

What we want the game's pacing to feel like, written as checks the sim can
grade. The numbers live in [`scripts/balance/spec.json`](../scripts/balance/spec.json);
this doc explains them. When the game feels wrong, first make this spec say
what we actually want, then re-run the tooling until the game meets it.

```sh
python3 scripts/balance/spec.py                  # grade the game as it is
python3 scripts/balance/build_costs.py 20 p.json  # build base breakthrough costs from play
python3 scripts/balance/bake.py p.json            # write them into src/content
```

## Overall shape

- A short game full of content beats a long, boring one. A few hours is fine;
  if it feels too short, add content rather than stretching waits.
- Each stage takes a little longer than the last. The first few are quick
  and lean on activity (they're the most novel); by mid-game you can idle
  through stages.
- Being active (gathering motes) is always worthwhile: much stronger than
  idling early on, only a little stronger late. Gathering upgrades are kept
  deliberately weaker than idle ones so active players don't blast through.
- Each system carries you further: resources and techniques alone get you to
  about Core Formation, cores to about where regressing starts to pay, and
  regressing about once per realm to the end. Skipping cores or regression is
  a slog.
- Regressing a second time in a realm is worth it for a very active player,
  but nobody has to.
- No bursts where you can suddenly buy everything at once.

## The reference player

Balance targets are set for one player (`SIM_PLAYER=reference` in
`scripts/sim.ts`). It buys whatever pays for itself soonest, gathers motes the
whole time for the first `reference.activeUntilStage` stages and fades to
idle by `reference.idleFromStage`, and regresses once per realm: on first
reaching each realm from Nascent Soul on, i.e. after finishing the one before.

Other bots check the edges: **active** (gathers all the time) and
**passive** (only gathers to get started and while replaying). Both regress
once bored, if regressing would at least triple their Memory bonus.

## Breakthrough costs are built in layers

Content is defined first, and prices are built on top of it:

- **Resources** form a fixed ladder (`RESOURCE_LADDER` in
  `src/content/generators.ts`): each tier a fixed multiple pricier than the
  last, at a fixed fraction of its qi/s per qi, meant to arrive every
  `stagesPerTier` stages.
- **A resource's techniques** are priced from the resource (its first
  technique arrives soon after it, its revival later).
- **Realm techniques** are priced from a stage within their realm, staggered
  so a realm's upgrades arrive one at a time.
- **Cores** (`content/progress.ts`): each realm's new core forms a third of
  the way through its realm and gets its first refine two thirds of the way
  through; every core gains a grade per realm after that, with the older
  cores' refines spread over the rest of each realm. Forming or refining a
  core always doubles qi gain, so cores grow exponentially like Memories. The
  generating cycle adds a small bonus (+25% per adjacent pair).

Then the layers:

1. **Base costs** (`BASE_STAGE_COSTS` in `src/content/realms.ts`) come from
   resources and techniques alone. `build_costs.py` plays the reference
   player without cores or regressions and prices each stage so it takes its
   target time (a stage takes about its cost ÷ income), smoothing the cost
   steps so they don't follow one bot's quirks. It also fits the resource
   ladder: its cost ratio so a new resource arrives on schedule, and its
   efficiency step so each one lands at about "all the others combined".
2. **Progress** (`progressMultipliers` in `content/progress.ts`) is what the
   reference player's cores and Memories multiply income by at each stage.
   It follows from their schedules, so it needs no playing: ×2 per scheduled
   core purchase, plus the Memory bonus from regressing on entering each
   realm from Nascent Soul on, slid smoothly between regressions.
3. **Every breakthrough and resource price** is its base price × progress at
   its stage. Cores, Memories and your income all scale together, so
   resources and techniques feel the same as they do alone, and the base
   layer is where to tune them. A player who skips cores or regressions faces
   prices scaled for a bonus they don't have, and falls steadily behind.

If a stage is still off target, look at the content around it (a burst of
income from several upgrades at once, or a drought).

## Checks

### 1. The ramp (`ramp`)

The reference player's stage times (measured within the life that first
reaches each stage, so replays don't count) follow a ramp: `first` seconds
for the first `flatUntil` stages, then rising linearly to `last` at Godhood,
each within `tolerance`×. Within a life, each stage takes at least
`monotoneSlack`× as long as the one before.

### Layers (`layers`)

Each system carries a player who never regresses further before they fall
behind (the first stage whose median time is over twice its target):

- **Resources and techniques alone** (no cores): around stage
  `resourcesOnlySlowFrom`, about Core Formation.
- **Plus cores:** around stage `withCoresSlowFrom`, about where the reference
  player's first regression pays.

### 2. Always something to buy (`somethingToBuy`)

Something new is a technique, a core grade, a resource you haven't owned
before, a breakthrough or an insight level.

- Never longer than `maxGapShareOfStage` of the current stage's time (or
  `minGapSeconds`, if that's longer) without something new.
- Never more than `maxBurst` new techniques bought in the same moment.

### 3. Every upgrade is meaningful (`minUpgradeGain`, `newResource`)

We assume players buy the most effective thing available, and rework or drop
upgrades that don't earn their place.

- Each technique and core adds at least `minUpgradeGain`× income when bought.
  Gathering upgrades are judged by gathering income, and the others by
  whichever income they raise more. Deliberate jokes (the Sunflower Manual)
  are listed in `upgradeExempt`.
- A new resource, with its first technique and `spendSeconds` of income spent
  on it, makes about as much as all your other resources combined (within
  `shareOfOthers`). This is measured at its first purchase.

### 4. Gathering's edge over idling (`activeRatio`)

Gathering income ÷ idle income at the frontier (not while replaying), for
the active bot. It slides smoothly from `first` (about 20× in Qi
Condensation) to `last` (about 2× in Immortal Ascension), each realm within
`tolerance`×. Gathering upgrades are what shape this slide, so be stingy
with them. Idle income is weak, so temporary buffs to it (encounters,
events) can be generous, as long as they multiply idle income only.

### 5. Regression (`regression`)

- Never regressing is at least `neverSlowdownAtLeast`× slower than the
  reference player (or doesn't finish within the sim's cap): a slog.
- Regressing twice per realm (on entering it and halfway through) is
  `twicePerRealmFaster`× faster: worth it, but optional.
- A second regression from the same place multiplies income by at most
  `maxRepeatGain`×.
- Replaying a finished realm takes at most `maxReplayShare` of the time its
  first visit took.

Memories are exponential in stage index and qi gain grows logarithmically
with them (`src/content/memories.ts`): each doubling of your Memories
multiplies qi by the same small factor. Regressing again from the same stage
only doubles them, so it's barely worth it, while each stage deeper is worth
`growthPerStage` ^ `memoryPower`, so regressing a realm later is a good boost.
The reference player's once-per-realm schedule is what breakthrough costs are
built around.

### 6. Treasures (`treasures`)

- Each treasure that changes income adds `levelOneGain`× when found at level
  1. Treasures that affect something else (encounters, tribulations) aren't
     graded yet.
- Treasure luck matters, but not too much: finishing with every treasure vs
  none changes total time by at most `maxLuckSpread`×.

## Not yet specified

- **Idle and offline time.** Nothing stops a player from leaving the game for
  hours. We might cap offline gains to match the target game length.
- **Total length.** It follows from the ramp: about 2.5–3 hours of play for
  the reference player, plus replays.
