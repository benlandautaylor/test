"use strict";
/* ------------------------------------------------------------------ *
 * Social layer — named suitors, Expectation/Honor dynamics, demands,
 * aggression, and the marriage/Odysseus endgame. Plugs into the
 * household sim in index.html: consumes its resources and adds steps
 * to the seasonal turn. All numbers live in TUNING (tuning.js).
 * ------------------------------------------------------------------ */

/* ---------- traits: pure data ----------
 * deltaMult.*  — multipliers the event engine applies to deltas
 * weightMult.* — multipliers on behavior-roll weights
 * honorWeight  — how strongly global Honor sways his rolls (default 1)
 * brawlBonus   — added to martial in brawls
 * husbandKillBase — endgame base rate for P(kills Telemachos)
 * behavior.*   — autonomous behaviors (Wealthy gift checks)
 */
const TRAITS = {
  proud: {
    name: "Proud", blurb: "Slights wound him doubly; a safer husband.",
    deltaMult: { expectationLoss: 2 },
    husbandKillBase: 0.12,
  },
  greedy: {
    name: "Greedy", blurb: "Gifts sway him doubly; heedless of honor; a dangerous husband.",
    deltaMult: { giftGain: 2 },
    honorWeight: 0,
    husbandKillBase: 0.50,
  },
  pious: {
    name: "Pious", blurb: "Weighs your honor heavily; a safer husband.",
    honorWeight: 2,
    husbandKillBase: 0.08,
  },
  violent: {
    name: "Violent", blurb: "Quick to aggression, deadly in a brawl.",
    weightMult: { aggression: 2 },
    brawlBonus: 2,
    husbandKillBase: 0.40,
  },
  wealthy: {
    name: "Wealthy", blurb: "Sends gifts when his hopes run high.",
    behavior: { giver: true },
  },
};

const CAST = [
  { key: "antinous",   name: "Antinous",   epithet: "loudest in the hall",   charisma: 8, stewardship: 4, martial: 7, traits: ["proud", "violent"] },
  { key: "eurymachus", name: "Eurymachus", epithet: "the honey-tongued",     charisma: 9, stewardship: 6, martial: 4, traits: ["greedy", "wealthy"] },
  { key: "amphinomus", name: "Amphinomus", epithet: "the mild",              charisma: 6, stewardship: 7, martial: 5, traits: ["pious", "proud"] },
  { key: "ctesippus",  name: "Ctesippus",  epithet: "the mocker",            charisma: 3, stewardship: 3, martial: 8, traits: ["violent", "greedy"] },
  { key: "peisandros", name: "Peisandros", epithet: "of the many flocks",    charisma: 5, stewardship: 8, martial: 3, traits: ["wealthy", "pious"] },
];

const Social = (() => {

  /* ---------- trait hooks ---------- */

  function traitMult(su, table, key) {
    let m = 1;
    for (const t of su.traits) {
      const trait = TRAITS[t];
      if (trait[table] && trait[table][key] != null) m *= trait[table][key];
    }
    return m;
  }
  function honorWeightOf(su) {
    let w = 1;
    for (const t of su.traits) if (TRAITS[t].honorWeight != null) w *= TRAITS[t].honorWeight;
    return w;
  }
  function brawlPower(su) {
    let b = su.martial;
    for (const t of su.traits) b += TRAITS[t].brawlBonus || 0;
    return b;
  }
  function killBase(su) {
    const bases = su.traits.map(t => TRAITS[t].husbandKillBase).filter(x => x != null);
    if (!bases.length) return TUNING.marriage.defaultKillBase;
    return bases.reduce((a, b) => a + b, 0) / bases.length;
  }
  function hasBehavior(su, key) {
    return su.traits.some(t => TRAITS[t].behavior && TRAITS[t].behavior[key]);
  }

  /* ---------- state ---------- */

  function init(S) {
    const starts = TUNING.expectation.start.slice();
    S.cast = CAST.map((c, i) => ({
      ...c,
      expectation: starts[i % starts.length],
      mollify: 0,
      state: "content",          // content | restless | aggressive (transient)
      activePromises: 0,
      seasonsSinceToken: 0,
      recentDrop: 0,
      injuredSeasons: 0,
      aggressions: 0,
      hostile: false,
      dispersed: false,
    }));
    S.honor = TUNING.honor.start;
    S.scandalThisSeason = false;
    S.feastedThisSeason = false;
    S.missedFeasts = 0;
    S.demandQueue = [];
    S.married = null;            // { key, pKill }
    S.plotArmed = null;          // suitor key when the plot is telegraphed
    S.plotCooldown = 0;
    S.odysseusReturns = Math.random() < TUNING.odysseus.returnChance; // secret
  }

  const active = S => S.cast.filter(su => !su.dispersed);
  const byKey = (S, key) => S.cast.find(su => su.key === key);

  function retinueSize(S) {
    return TUNING.retinue.base + Math.floor((S.turn - 1) / TUNING.retinue.growEverySeasons);
  }
  function headcount(S) {
    if (S.married) return 0;
    return active(S).length * (1 + retinueSize(S));
  }
  function tableGrainDemand(S) { return Math.round(headcount(S) * TUNING.retinue.grainPerHead); }
  function tableSheepDemand(S) { return Math.ceil(headcount(S) / TUNING.retinue.headsPerSheep); }

  /* ---------- event engine ----------
   * Every social action is one of these objects. Private events never
   * touch Honor here (discovery mechanic deferred — the flag exists).
   */
  function applyEvent(S, ev) {
    const { target, visibility = "public", deltas = {}, kind } = ev;
    if (target && deltas.expectation) {
      let d = deltas.expectation;
      if (d > 0 && kind === "gift") d *= traitMult(target, "deltaMult", "giftGain");
      if (d < 0) d *= traitMult(target, "deltaMult", "expectationLoss");
      d = Math.round(d);
      const before = target.expectation;
      target.expectation = clamp(target.expectation + d, 0, 100);
      if (d < 0) target.recentDrop += before - target.expectation;
      // Jealousy coupling: a public favor to ONE suitor docks the others.
      // Broadcasts (feasts) and suitor-initiated events don't trigger it.
      if (d > 0 && visibility === "public" && ev.initiator === "penelope" && kind !== "feast") {
        const bite = Math.round(d * TUNING.expectation.jealousyFraction);
        if (bite > 0) for (const other of active(S)) {
          if (other === target) continue;
          const ob = other.expectation;
          other.expectation = clamp(other.expectation - bite, 0, 100);
          other.recentDrop += ob - other.expectation;
        }
      }
      return d;
    }
    if (deltas.honor && visibility === "public") {
      S.honor = clamp(S.honor + deltas.honor, 0, 100);
      if (deltas.honor < 0) S.scandalThisSeason = true;
    }
    return 0;
  }

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const credulity = su => 1 / (1 + TUNING.expectation.credulityPerMollify * su.mollify);

  /* ---------- player instruments (main turn) ---------- */

  function feastCost(S) {
    return {
      grain: Math.ceil(headcount(S) * TUNING.feast.grainPerHead),
      sheep: Math.ceil(headcount(S) / TUNING.feast.headsPerSheep),
    };
  }

  function feast(S) {
    if (S.feastedThisSeason || S.married) return false;
    const cost = feastCost(S);
    if (S.grain < cost.grain || S.sheep < cost.sheep) return false;
    S.grain -= cost.grain; S.sheep -= cost.sheep;
    S.feastedThisSeason = true;
    S.missedFeasts = 0;
    for (const su of active(S)) {
      applyEvent(S, { initiator: "penelope", target: su, visibility: "public", kind: "feast",
        deltas: { expectation: TUNING.feast.expectationEach } });
    }
    log(`You hold a proper feast — ${cost.grain} grain and ${cost.sheep} sheep — and for a season the hall is easy.`, "good");
    return true;
  }

  function gift(S, key) {
    const su = byKey(S, key);
    if (!su || su.dispersed || S.married) return false;
    const cost = TUNING.gift.cost;
    if (S.cloth < cost.cloth || S.sheep < cost.sheep) return false;
    S.cloth -= cost.cloth; S.sheep -= cost.sheep;
    const gain = TUNING.gift.expectationBase * credulity(su);
    const got = applyEvent(S, { initiator: "penelope", target: su, visibility: "public", kind: "gift",
      deltas: { expectation: gain } });
    su.mollify += 1;
    su.seasonsSinceToken = 0;
    maybeCalm(S, su);
    log(`You send ${su.name} a rich gift before the whole hall. His hopes rise (+${got}) — and the others' eyes narrow.`);
    return true;
  }

  function promise(S, key) {
    const su = byKey(S, key);
    if (!su || su.dispersed || S.married) return false;
    const gain = TUNING.promise.expectationBase * credulity(su);
    const got = applyEvent(S, { initiator: "penelope", target: su, visibility: "private", kind: "promise",
      deltas: { expectation: gain } });
    su.mollify += TUNING.promise.mollifyCost;
    su.activePromises += 1;
    su.seasonsSinceToken = 0;
    maybeCalm(S, su);
    log(`In private you give ${su.name} a sign of commitment. His hopes rise (+${got}) — but a promise can come to light.`);
    return true;
  }

  function maybeCalm(S, su) {
    if (su.state === "restless" && !su.hostile && su.expectation >= TUNING.restless.calmBackThreshold) {
      su.state = "content";
      log(`${su.name} is mollified and settles back among the feasters.`);
    }
  }

  /* ---------- marriage ---------- */

  function marry(S, key) {
    const su = byKey(S, key);
    if (!su || su.dispersed || S.married) return false;
    const t = TUNING.marriage;
    const grudge = 1 + t.grudgePerMollify * su.mollify;
    const honorMod = t.honorModBase - S.honor / 100;
    su.pKill = clamp(killBase(su) * grudge * honorMod, t.pKillMin, t.pKillMax);
    S.married = { key: su.key, pKill: su.pKill };
    for (const other of S.cast) if (other !== su) other.dispersed = true;
    S.demandQueue = [];
    S.plotArmed = null;
    log(`You wed ${su.name}. The other suitors curse their luck, gather their retinues, and are gone within days. The hall is quiet — and his now, too.`, "season-head");
    return true;
  }

  /* ---------- fulfillment demands (between-season) ---------- */

  function pickDemand(S) {
    if (S.married) return null;
    while (S.demandQueue.length) {
      const queued = byKey(S, S.demandQueue.shift());
      if (queued && !queued.dispersed) return queued;
    }
    const t = TUNING.demand;
    const triggered = [];
    for (const su of active(S)) {
      if (su.injuredSeasons > 0 || su.expectation < t.minExpectation) continue;
      const staleness = Math.min(su.seasonsSinceToken, t.stalenessCap) / t.stalenessCap;
      const p = t.baseChance * (su.expectation / 100) * staleness;
      if (Math.random() < p) triggered.push(su);
    }
    if (!triggered.length) return null;
    triggered.sort((a, b) => b.expectation - a.expectation);
    for (const su of triggered.slice(1)) S.demandQueue.push(su.key); // cap: one per season
    return triggered[0];
  }

  function payCost(S, su) {
    const t = TUNING.demand;
    const value = Math.round(t.payValueBase * (1 + su.expectation / 100) * (1 + 0.3 * su.mollify));
    // Assemble a goods bundle worth `value`, richest goods first.
    const bundle = {};
    let left = value;
    for (const k of ["cloth", "sheep", "wood", "grain"]) {
      const take = Math.min(S[k], Math.floor(left / TUNING.household.value[k]));
      if (take > 0) { bundle[k] = take; left -= take * TUNING.household.value[k]; }
    }
    return { value, bundle, affordable: left <= 0 };
  }

  function respondToDemand(S, su, choice) {
    const t = TUNING.demand;
    if (choice === "marry") { marry(S, su.key); return; }
    if (choice === "pay") {
      const { bundle } = payCost(S, su);
      for (const [k, v] of Object.entries(bundle)) S[k] -= v;
      applyEvent(S, { initiator: "penelope", target: su, visibility: "public", kind: "gift",
        deltas: { expectation: t.payExpectation } });
      su.mollify += 1;
      su.seasonsSinceToken = 0;
      maybeCalm(S, su);
      const txt = Object.entries(bundle).map(([k, v]) => `${v} ${k}`).join(", ");
      log(`You buy ${su.name} off with ${txt}. He preens before the others.`);
      return;
    }
    if (choice === "repromise") {
      const gain = t.rePromiseExpectation * credulity(su);
      const got = applyEvent(S, { initiator: "penelope", target: su, visibility: "private", kind: "promise",
        deltas: { expectation: gain } });
      su.mollify += t.rePromiseMollify;
      su.activePromises += 1;
      su.seasonsSinceToken = 0;
      maybeCalm(S, su);
      log(`You renew your promise to ${su.name} (+${got} hope). Each retelling buys less, and each promise may come to light.`);
      return;
    }
    // refuse
    const before = su.expectation;
    su.expectation = Math.round(su.expectation * t.refuseKeepFraction);
    su.recentDrop += before - su.expectation;
    su.seasonsSinceToken = 0;
    log(`You refuse ${su.name} to his face. His hopes collapse (−${before - su.expectation}).`, "bad");
    if (su.state === "content" && Math.random() < t.refuseRestlessChance * traitMult(su, "deltaMult", "expectationLoss")) {
      su.state = "restless";
      log(`${su.name} pushes back from the table, white with anger — he is restless now.`, "bad");
    }
  }

  function demandText(S, su) {
    const { value, affordable, bundle } = payCost(S, su);
    const txt = Object.entries(bundle).map(([k, v]) => `${v} ${k}`).join(", ") || "nothing you have";
    return {
      title: `${su.name} demands fulfillment`,
      body: `${su.name}, ${su.epithet}, rises before the hall: he has waited long enough, and demands to know when you will wed him.`,
      pay: { label: `Pay him off (${txt})`, disabled: !affordable, value },
      repromise: { label: "Renew your promise (free — but promises surface, and he grows harder to fool)" },
      refuse: { label: "Refuse him outright (his hopes collapse; he will likely turn restless)" },
      marry: { label: `Marry ${su.name} (the other suitors disperse — endgame)` },
    };
  }

  /* ---------- season-end resolution ---------- */

  function wealthyGifts(S) {
    if (S.married) return;
    for (const su of active(S)) {
      if (!hasBehavior(su, "giver")) continue;
      if (su.expectation >= TUNING.wealthy.minExpectation && Math.random() < TUNING.wealthy.giftChance) {
        for (const [k, v] of Object.entries(TUNING.wealthy.gift)) S[k] += v;
        applyEvent(S, { initiator: su.key, target: su, visibility: "public", kind: "gift",
          deltas: { expectation: 2 } });
        log(`${su.name}, sure of his suit, sends fine goods to your stores (+${Object.entries(TUNING.wealthy.gift).map(([k, v]) => `${v} ${k}`).join(", ")}).`, "good");
      }
    }
  }

  // Runs after production/consumption. May end the game (returns "lost" reason).
  function resolveSeasonEnd(S, seizeGoods) {
    if (S.married) { S.scandalThisSeason = false; return null; }
    const T = TUNING;

    // Injuries heal by one season
    for (const su of active(S)) if (su.injuredSeasons > 0) {
      su.injuredSeasons--;
      if (su.injuredSeasons === 0) log(`${su.name} is healed of his bruises and returns to the feasting.`);
    }

    // Expectation decay + staleness
    for (const su of active(S)) {
      const before = su.expectation;
      su.expectation = clamp(su.expectation - T.expectation.decayPerSeason, 0, 100);
      su.recentDrop += before - su.expectation;
      su.seasonsSinceToken++;
    }

    // Promise collisions — deferred Honor exposure coming due
    for (const su of active(S)) {
      for (let i = 0; i < su.activePromises; i++) {
        if (Math.random() < T.honor.promiseCollisionChance) {
          su.activePromises--;
          applyEvent(S, { initiator: "penelope", visibility: "public", kind: "scandal",
            deltas: { honor: -T.honor.promiseCollisionCost } });
          log(`Your private promise to ${su.name} is bandied about the hall. Your honor suffers (−${T.honor.promiseCollisionCost}).`, "bad");
          break;
        }
      }
    }

    if (!S.feastedThisSeason) S.missedFeasts++;

    // Restlessness rolls (suppressed by a feast this season)
    if (!S.feastedThisSeason) {
      for (const su of active(S)) {
        if (su.state !== "content" || su.injuredSeasons > 0) continue;
        const w = T.restless;
        let p = 0;
        const reasons = [];
        const feastless = Math.min(S.missedFeasts, w.missedFeastCap);
        if (su.expectation < 50) { p += w.lowExpectationWeight * (50 - su.expectation) / 50; reasons.push("his hopes fade"); }
        if (su.recentDrop > 0) { p += w.recentDropWeight * su.recentDrop; reasons.push("his standing has slipped"); }
        if (feastless > 0) { p += w.missedFeastWeight * feastless; reasons.push(`no feast for ${S.missedFeasts} season${S.missedFeasts > 1 ? "s" : ""}`); }
        p *= traitMult(su, "weightMult", "aggression"); // Violent men chafe faster
        if (Math.random() < p) {
          su.state = "restless";
          log(`${su.name} grows restless — ${reasons.join(", and ")}. He is surly at table and his demands sharpen.`, "bad");
        }
      }
    }

    // Aggression rolls for those still Restless at season's end
    // (a feast this season keeps even the restless from open violence)
    let lostReason = null;
    if (S.plotCooldown > 0) S.plotCooldown--;
    const feastCalms = S.feastedThisSeason && T.feast.suppressesAggression;
    for (const su of active(S)) {
      if (feastCalms) break;
      if (su.state !== "restless" || su.injuredSeasons > 0) continue;
      const a = T.aggression;
      let p = a.base * traitMult(su, "weightMult", "aggression")
        + a.missedFeastWeight * Math.min(S.missedFeasts, T.restless.missedFeastCap)
        + a.lowHonorWeight * (1 - S.honor / 100);
      if (su.hostile) p *= a.hostileRateMult;
      if (Math.random() >= p) continue;

      // The Telemachos plot instead — rare, telegraphed, needs high pressure + low honor
      const pressure = active(S).filter(x => x.state === "restless" || x.hostile).length;
      if (!S.plotArmed && !S.plotCooldown && pressure >= T.plot.minRestless && S.honor < T.plot.maxHonor) {
        S.plotArmed = su.key;
        log(`Dark whispers in the hall: ${su.name} and his fellows speak of Telemachos as an obstacle. Mollify them, or your son is in danger.`, "bad");
        continue;
      }

      su.state = "aggressive";
      resolveAggression(S, su, seizeGoods);
    }

    // Armed plot comes due
    if (!lostReason && S.plotArmed) {
      const plotter = byKey(S, S.plotArmed);
      if (!plotter || plotter.dispersed || plotter.state === "content") {
        if (plotter && plotter.state === "content") log(`Mollified, ${plotter.name} lets the dark talk of Telemachos die away.`, "good");
        S.plotArmed = null;
      } else if (Math.random() < T.plot.successChance) {
        lostReason = `${plotter.name}'s men waylay Telemachos on the shore road. Your son is slain, and with him the house of Odysseus.`;
      } else {
        log(`${plotter.name}'s plot against Telemachos is foiled — a loyal herdsman warned the boy in time. The hall pretends nothing happened.`, "bad");
        S.plotArmed = null;
        S.plotCooldown = T.plot.cooldownSeasons;
      }
    }

    // Honor's slow regain
    if (!S.scandalThisSeason) S.honor = clamp(S.honor + T.honor.regainPerSeason, 0, 100);
    S.scandalThisSeason = false;
    for (const su of S.cast) su.recentDrop = 0;
    S.feastedThisSeason = false;
    return lostReason;
  }

  function resolveAggression(S, aggressor, seizeGoods) {
    const a = TUNING.aggression;
    const joiners = [], opposers = [];
    for (const su of active(S)) {
      if (su === aggressor || su.injuredSeasons > 0) continue;
      if (su.hostile) { joiners.push(su); continue; }
      const pOppose = clamp((su.expectation / 100) * a.opposeWeight, 0, 0.85);
      const pJoin = clamp((1 - S.honor / 100) * a.joinWeight * honorWeightOf(su), 0, 0.85);
      const r = Math.random();
      if (r < pOppose) opposers.push(su);
      else if (r < pOppose + pJoin) joiners.push(su);
      // else: stands aside
    }

    const aggSide = [aggressor, ...joiners];
    log(`${aggressor.name} rises in fury and moves on your storerooms${joiners.length ? `, and ${joiners.map(s => s.name).join(" and ")} stand with him` : ""}${opposers.length ? ` — but ${opposers.map(s => s.name).join(" and ")} bar the way` : ""}.`, "bad");

    let aggressorsPrevail = true;
    if (opposers.length) {
      const sumA = aggSide.reduce((t, s) => t + brawlPower(s), 0);
      const sumD = opposers.reduce((t, s) => t + brawlPower(s), 0);
      aggressorsPrevail = Math.random() < sumA / (sumA + sumD);
      const losers = aggressorsPrevail ? opposers : aggSide;
      const winners = aggressorsPrevail ? aggSide : opposers;
      for (const su of losers) su.injuredSeasons = a.injurySeasons;
      for (const su of winners) {
        applyEvent(S, { initiator: su.key, target: su, visibility: "public", kind: "brawl",
          deltas: { expectation: a.winnerExpectation } });
      }
      log(`Benches overturn — a brawl in the hall of Odysseus! The ${aggressorsPrevail ? "aggressors" : "defenders"} have the better of it; ${losers.map(s => s.name).join(" and ")} ${losers.length > 1 ? "are" : "is"} carried out bloodied.`, "bad");
    }

    if (aggressorsPrevail) {
      const seized = seizeGoods(a.theftValuePerAggressor * aggSide.length);
      log(`The aggressors carry off ${seized || "what little remains"} from your stores.`, "bad");
    } else {
      log(`Your stores are saved — this time.`, "good");
    }

    // He spent his claim
    const before = aggressor.expectation;
    aggressor.expectation = Math.round(aggressor.expectation * a.spentFraction);
    aggressor.recentDrop += before - aggressor.expectation;
    aggressor.aggressions++;
    aggressor.state = "restless";
    if (aggressor.aggressions >= a.hostileAfter && !aggressor.hostile) {
      aggressor.hostile = true;
      log(`${aggressor.name} no longer pretends to court you. He and his men are a standing menace in your hall.`, "bad");
    }
  }

  /* ---------- endgame (season 20) ---------- */

  function endgame(S) {
    const T = TUNING;
    if (!S.married) {
      if (S.odysseusReturns) {
        return { victory: true, title: "The Bow Is Strung",
          html: `<p>A beggar appears at your door — and in the hall, before the eyes of the suitors, he strings the great bow. Odysseus has come home. The doors are barred, and by nightfall not one suitor is left alive.</p><p>You remained faithful, and the house of Odysseus stands.</p>` };
      }
      return { victory: true, title: "The Faithful Queen",
        html: `<p>Odysseus never returns — lost, as the years always whispered, somewhere at sea. But you have held his hall for ten years against a house full of wolves, and Telemachos comes into his inheritance whole.</p>` };
    }

    const husband = byKey(S, S.married.key);
    const steps = [];
    if (S.odysseusReturns) {
      const pOdy = T.odysseus.martial / (T.odysseus.martial + brawlPower(husband));
      if (Math.random() < pOdy) {
        return { victory: false, title: "The King Returns",
          html: `<p>A stranger lands on Ithaca and learns his wife is wed to ${husband.name}. He comes to the hall with his great bow, and neither your husband's men nor your pleading stop him.</p><p>${husband.name} dies first. You die beside him.</p>` };
      }
      steps.push(`<p>Odysseus returns — but ${husband.name} and his men are ready, and the old king falls in his own hall. The bards will argue about it for centuries.</p>`);
    }
    if (Math.random() < S.married.pKill) {
      return { victory: false, title: "The Stepfather",
        html: steps.join("") + `<p>${husband.name} waited a decent interval. Then Telemachos went out with the hunting party and did not come back. His own sons will inherit now — and you can prove nothing.</p>` };
    }
    return { victory: true, title: "A New House",
      html: steps.join("") + `<p>${husband.name} proves ${husband.pKill < 0.2 ? "a better man than the hall ever guessed" : "prudent enough to leave your son be"}. Telemachos lives, keeps his father's lands, and you keep the peace you bargained for.</p>` };
  }

  /* ---------- household hooks ---------- */

  // Honor as one modest input to the servant/disorder mechanic.
  function extraServantsNeeded(S) {
    return S.honor < TUNING.honor.lowServantThreshold ? 1 : 0;
  }

  return {
    TRAITS, init, active, byKey, headcount, retinueSize,
    tableGrainDemand, tableSheepDemand,
    feast, feastCost, gift, promise, marry,
    pickDemand, payCost, respondToDemand, demandText,
    wealthyGifts, resolveSeasonEnd, endgame, extraServantsNeeded,
    credulity,
  };
})();
