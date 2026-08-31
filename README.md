# Penelope's Household

A turn-based strategy game where you play as Penelope, managing the estate of
Odysseus while he is away — and the suitors who won't leave.

**Milestone 2: household layer + social layer prototype.** Five named suitors
with stats, traits, Expectation, and an aggression state machine sit on top of
the milestone-1 economic sim.

## Playing

Open `index.html` in a browser. No build step, no dependencies.

- `tuning.js` — every numeric constant in one `TUNING` object.
- `social.js` — traits, cast, social event engine, state machines, endgame.
- `index.html` — the household sim (milestone 1) plus UI and integration.

### Social layer in brief

- **Five suitors** (Antinous, Eurymachus, Amphinomus, Ctesippus, Peisandros),
  each with charisma/stewardship/martial stats and two data-driven traits
  (Proud, Greedy, Pious, Violent, Wealthy). Each brings a retinue that grows
  over the years — the estate's escalating table drain.
- **Expectation** (his belief he'll marry you) decays each season, is raised
  by **feasts** (broadcast, suppresses unrest), **gifts** (public — triggers
  jealousy in the others), and **promises** (private and free, but each live
  promise risks surfacing and costing **Honor**). Buying the same man off
  repeatedly yields less each time.
- **Fulfillment demands**: a hopeful, long-unrewarded suitor demands your
  hand between seasons — marry, pay, re-promise, or refuse him (refusal
  crashes his hopes; it's how you cut an uneconomic suitor loose).
- **Aggression**: neglected suitors go Restless, then Aggressive — the others
  oppose, stand aside, or join based on their own hopes and your Honor.
  Brawls resolve on martial stats; unopposed raids strip your stores. Repeat
  aggressors become a permanent hostile bloc. At rock-bottom Honor with a
  restless hall, a plot against Telemachos is telegraphed — and if it lands,
  you lose.
- **Endgame**: marry and the hall empties, but your new husband may remove
  Telemachos (traits, your Honor at the wedding, and how often you strung
  *him* along all weigh in) — and Odysseus, secretly fated at game start
  (1-in-3), may come home to a hall he doesn't like. Stay faithful for 20
  seasons and either ending of his is a victory.

### Playtest tools

The **Debug & playtest tools** panel (bottom of the page, or press `` ` ``)
inspects and sets any stat, reveals the Odysseus roll, and fast-forwards
seasons with default choices. `window.PENELOPE` exposes state in the console.

## Rules of the household layer (milestone 1)

- **20 seasons** (10 years), alternating Spring and Autumn. Autumn harvests
  yield 1.5× grain.
- **Men** are allocated between farming (grain), shepherding (tend the flock —
  tended sheep breed, untended sheep stray), and the lumberyard (wood).
- **Women** are allocated between farming, weaving (cloth), and serving. The
  hall needs a minimum number of serving women — more as suitors multiply —
  or the whole estate suffers a production penalty the next season
  (a stand-in for the social layer's respect mechanic).
- **Each season**: production comes in, the suitors feast (grain + sheep — if
  the table runs short they ransack the stores for double the shortfall), the
  household eats (slaughtering sheep if grain runs out; if people go unfed,
  staff flee), grain spoils, and occasionally a random event strikes.
- **Upgrades** (plows, terraced fields, sheepfold, loom, granary) are bought
  with wood and cloth and improve conversions.
- **Lose** by letting the household scatter through hunger; final wealth is
  your score on any victory.

## Spec interpretation notes

- Milestone 1 had no servant loyalty stats (deliberately), so "keep the
  existing loyalty model" is read as keeping the serving-women/disorder
  mechanic, with Honor added as its one modest social input (low Honor
  requires an extra serving woman).
- Milestone 1's abstract growing suitor count is replaced by the named cast's
  growing retinues, so the escalating table drain now tracks who is actually
  still in the hall.
- Marriage is available both as a demand response (per the milestone-2 spec)
  and from the roster (the overview grants "the option to marry one of the
  suitors" as a player choice).

## Design sources

`Penelope_overview_1.1.docx` (overview + milestone 1) and
`penelope_social_layer_spec.md` (milestone 2). Deferred by spec: shroud
mechanic, discovery/rumor system, per-character Honor perception, trait
discovery, xenia/beggars, traits beyond the starter five.
