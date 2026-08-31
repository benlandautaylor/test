"use strict";
/* ------------------------------------------------------------------ *
 * TUNING — every numeric weight in the game lives here.
 * All values are placeholders for tuning (see milestone 2 spec).
 * ------------------------------------------------------------------ */
const TUNING = {
  household: {
    totalTurns: 20,
    familyMouths: 4,          // Penelope, Telemachos, Laertes, Eurykleia
    grainPerMouth: 1,
    clothWear: 2,             // cloth the household wears out per season
    sheepFoodValue: 5,        // grain-equivalent when a sheep is slaughtered
    grainSpoilRate: 0.10,
    value: { grain: 1, wood: 2, cloth: 3, sheep: 5 },
    farmerGrainBase: 4,
    autumnHarvestMult: 1.5,
    woodPerLumber: 2,
    clothPerWeaverBase: 2,
    shepherdCapacityBase: 8,
    shepherdCapacityFold: 12,
    strayRateBase: 0.20,
    strayRateFold: 0.10,
    lambRate: 0.12,
    disorderPenalty: 0.15,
    servantsBase: 2,
    servantsPerHeads: 5,      // +1 serving woman per this many suitor-party heads
    fleePerUnfed: 5,          // one worker flees per this much unmet food
    collapseStaff: 4,         // estate falls at or below this many workers
    staffWealth: 10,          // wealth score per remaining worker
  },

  // Each named suitor brings a retinue that grows over the years, so the
  // table drain escalates like milestone 1's abstract suitor count did.
  retinue: {
    base: 1,                  // hangers-on per suitor at the start
    growEverySeasons: 6,      // +1 hanger-on per suitor every N seasons
    grainPerHead: 1.2,
    headsPerSheep: 5,         // one sheep roasted per this many heads
  },

  expectation: {
    start: [55, 50, 45, 40, 35],  // shuffled onto the cast at game start
    decayPerSeason: 8,
    jealousyFraction: 0.34,   // others lose this share of a public gain
    credulityPerMollify: 0.35,// gain divisor grows: 1 / (1 + k * mollify)
  },

  honor: {
    start: 70,
    regainPerSeason: 1,       // only in seasons with no scandal
    promiseCollisionChance: 0.08, // per active promise per season
    promiseCollisionCost: 12,
    lowServantThreshold: 40,  // below this, hall needs +1 serving woman
  },

  feast: {
    grainPerHead: 0.5,
    headsPerSheep: 10,
    expectationEach: 2,
    suppressesAggression: true, // a well-fed hall doesn't riot this season
  },

  gift: {
    cost: { cloth: 4, sheep: 1 },
    expectationBase: 18,
  },

  promise: {
    expectationBase: 26,
    mollifyCost: 1,
  },

  demand: {
    baseChance: 0.22,         // scaled by expectation × staleness below
    minExpectation: 35,
    stalenessCap: 6,
    payValueBase: 14,         // goods value ≈ base × (1 + exp/100) × (1 + 0.3·mollify)
    payExpectation: 12,
    rePromiseExpectation: 20,
    rePromiseMollify: 2,      // the big credulity burn
    refuseKeepFraction: 0.25, // expectation ×= this on refusal
    refuseRestlessChance: 0.75,
  },

  restless: {
    lowExpectationWeight: 0.30,   // × (50 − exp)/50 when exp < 50
    recentDropWeight: 0.008,      // × points of expectation lost last season
    missedFeastWeight: 0.12,      // × consecutive feastless seasons (capped below)
    missedFeastCap: 4,
    calmBackThreshold: 55,        // a Restless suitor bought above this goes Content
  },

  aggression: {
    base: 0.18,               // chance a season-end Restless suitor turns Aggressive
    hostileRateMult: 0.6,     // the standing bloc raids sometimes, not every season
    missedFeastWeight: 0.08,
    lowHonorWeight: 0.15,     // × (1 − honor/100)
    opposeWeight: 0.9,        // × own expectation/100
    joinWeight: 0.5,          // × (1 − honor/100) × trait honor weight
    theftValuePerAggressor: 30,
    injurySeasons: 2,
    winnerExpectation: 5,
    spentFraction: 0.25,      // aggressor keeps this share of his expectation
    hostileAfter: 2,          // aggressions before he joins the permanent bloc
  },

  plot: {                     // the Telemachos plot — rare and telegraphed
    minRestless: 3,           // restless+hostile suitors needed
    maxHonor: 35,
    successChance: 0.35,
    cooldownSeasons: 4,       // a foiled plot cows the plotters for a while
  },

  marriage: {
    grudgePerMollify: 0.15,   // pKill × (1 + this × his mollify count)
    // honor modifier: 1.5 − honor/100 (honor 100 → ×0.5, honor 0 → ×1.5)
    honorModBase: 1.5,
    pKillMin: 0.02,
    pKillMax: 0.95,
    defaultKillBase: 0.25,    // when neither trait sets one
  },

  odysseus: {
    returnChance: 1 / 3,      // rolled secretly at game start
    martial: 9,
  },

  wealthy: {
    minExpectation: 70,
    giftChance: 0.25,
    gift: { cloth: 5 },
  },
};
