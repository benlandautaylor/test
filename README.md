# Penelope's Household

A turn-based strategy game where you play as Penelope, managing the estate of
Odysseus while he is away — and feeding the suitors who won't leave.

**This is the first-step prototype from the design doc: the household
(economic) layer only.** No social layer yet — no named characters, no loyalty
or respect stats. Suitors appear purely as an economic drain that grows over
time.

## Playing

Open `index.html` in a browser. No build step, no dependencies.

## Rules of the prototype

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
- **Lose** by letting the household scatter through hunger. **Survive** 20
  seasons and the estate's final wealth is your score. (Win/loss around
  Odysseus, remarriage, and Telemachos belongs to the social layer, to come.)

## Design source

Based on `Penelope_overview_1.1.docx` — "First Step: make a basic playable
prototype in JS of the household layer only."
