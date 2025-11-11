/**
 * ===================================================================
 * PHASE 4 V2 — Optimisation par swaps (pure _BASEOPTI)
 * ===================================================================
 * 
 * Version V2 native qui travaille avec :
 * - _BASEOPTI comme source d'état
 * - _OPTI_CONFIG pour les poids et paramètres
 * - Schéma fixe avec ID_ELEVE et scores COM/TRA/PART/ABS
 * 
 * Objectifs :
 * 1. Optimiser les scores comportementaux (COM prioritaire)
 * 2. Équilibrer la parité F/M
 * 3. Répartir équitablement les élèves COM=1 entre classes
 * 4. Respecter les quotas LV2/OPT
 * 5. Préserver les groupes ASSO et séparer les DISSO
 */

/**
 * Phase 4 V2 : Optimisation par swaps
 * @param {Object} ctx - Contexte V2 (buildCtx_V2)
 * @returns {Object} Résultat avec statistiques
 */
function Phase4_balanceScoresSwaps_BASEOPTI(ctx) {
  logLine('INFO', '🔄 PHASE 4 V2 — Optimisation par swaps (pure _BASEOPTI)');
  
  // 1. Vérifications pré-optimisation
  _assertInvariants_(ctx, 'PRE P4');
  
  // 2. Lire l'état depuis _BASEOPTI
  let state = readStateFromBaseopti_(ctx);

  // 3. Vérifier que tous les élèves sont placés
  const notPlaced = state.free.length;
  if (notPlaced > 0) {
    logLine('WARN', '⚠️ ' + notPlaced + ' élèves non placés avant P4 — tentative de placement');
    placeRemainingStudents_(ctx);
    // Relire l'état
    state = readStateFromBaseopti_(ctx);
  }
  
  // 4. Paramètres d'optimisation
  const weights = ctx.weights || { com: 0.4, tra: 0.1, part: 0.1, abs: 0.1, parity: 0.3 };
  const tolParity = ctx.tolParite || 2;
  const maxSwaps = ctx.maxSwaps || 1000;
  const runtimeSec = ctx.runtimeSec || 30;
  
  logLine('INFO', '  📊 Poids: COM=' + weights.com + ', TRA=' + weights.tra + ', PART=' + weights.part + ', ABS=' + weights.abs + ', Parité=' + weights.parity);
  logLine('INFO', '  ⏱️ Budget: ' + maxSwaps + ' swaps max, ' + runtimeSec + 's max');
  logLine('INFO', '  🎯 Tolérance parité: ±' + tolParity);
  
  // 5. Statistiques initiales
  const initialStats = computeGlobalStats_(state, weights);
  logLine('INFO', '  📈 Score initial: ' + initialStats.totalScore.toFixed(2));
  logLine('INFO', '  📊 Mobilité: LIBRE=' + initialStats.mobilite.LIBRE + ', FIXE=' + initialStats.mobilite.FIXE + ', PERMUT=' + initialStats.mobilite.PERMUT);
  
  // 5.5. Vérifier que les scores sont présents
  let scoresPresent = 0;
  let scoresTotal = 0;
  for (const cls in state.byClass) {
    state.byClass[cls].forEach(function(stu) {
      scoresTotal++;
      const hasCOM = stu.COM !== undefined && stu.COM !== null && stu.COM !== '';
      const hasTRA = stu.TRA !== undefined && stu.TRA !== null && stu.TRA !== '';
      const hasPART = stu.PART !== undefined && stu.PART !== null && stu.PART !== '';
      if (hasCOM || hasTRA || hasPART) scoresPresent++;
    });
  }
  logLine('INFO', '  📊 Scores présents : ' + scoresPresent + '/' + scoresTotal + ' élèves (' + Math.round(100 * scoresPresent / scoresTotal) + '%)');

  // 6. Optimisation par swaps
  const result = runSwapOptimization_(state, ctx, weights, tolParity, maxSwaps, runtimeSec);

  // 7. Écrire l'état optimisé vers CACHE
  writeStateToCache_(result.state, ctx);
  
  // 8. Vérifications post-optimisation
  _assertInvariants_(ctx, 'POST P4');
  
  // 9. Statistiques finales
  const finalStats = computeGlobalStats_(result.state, weights);
  logLine('INFO', '  ✅ Score final: ' + finalStats.totalScore.toFixed(2) + ' (Δ=' + (finalStats.totalScore - initialStats.totalScore).toFixed(2) + ')');
  logLine('INFO', '  ✅ Swaps appliqués: ' + result.swapsApplied + ' / ' + result.swapsEvaluated + ' évalués');
  logLine('INFO', '  ✅ Parité finale: ' + finalStats.parityOk + '/' + ctx.levels.length + ' classes OK');
  logLine('INFO', '  ✅ COM=1 répartition: écart=' + finalStats.com1Spread.toFixed(2));
  
  return {
    ok: true,
    swapsApplied: result.swapsApplied,
    swapsEvaluated: result.swapsEvaluated,
    scoreImprovement: finalStats.totalScore - initialStats.totalScore,
    parityOk: finalStats.parityOk === ctx.levels.length,
    com1Spread: finalStats.com1Spread,
    summary: result.summary
  };
}

/**
 * Lit l'état depuis CACHE (pas BASEOPTI !)
 * ✅ CORRECTION CRITIQUE : Lire depuis CACHE où sont réellement les élèves après P1/P2/P3
 */
function readStateFromBaseopti_(ctx) {
  // Validation du contexte
  if (!ctx) {
    throw new Error('readStateFromBaseopti_: contexte undefined');
  }
  if (!ctx.levels || !Array.isArray(ctx.levels) || ctx.levels.length === 0) {
    throw new Error('readStateFromBaseopti_: ctx.levels manquant ou vide');
  }

  logLine('INFO', '  📖 Lecture état depuis CACHE (pas BASEOPTI)...');

  const byClass = {};
  const allPlaced = [];

  // ✅ LIRE DEPUIS CACHE (source de vérité après P1/P2/P3)
  (ctx.cacheSheets || []).forEach(function(cacheName) {
    const cls = cacheName.replace('CACHE', '').trim();
    const sh = (ctx.ss || SpreadsheetApp.getActive()).getSheetByName(cacheName);

    byClass[cls] = [];

    if (!sh || sh.getLastRow() < 2) {
      return;
    }

    const data = sh.getDataRange().getValues();
    const headers = data[0];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // Skip lignes vides

      const student = {};
      headers.forEach(function(h, idx) {
        student[h] = row[idx];
      });
      student._currentClass = cls;

      byClass[cls].push(student);
      allPlaced.push(student);
    }
  });

  logLine('INFO', '  ✅ ' + allPlaced.length + ' élèves lus depuis CACHE');

  // Log par classe
  for (const cls in byClass) {
    logLine('INFO', '    ' + cls + ' : ' + byClass[cls].length + ' élèves');
  }

  return {
    byClass: byClass,
    placed: allPlaced,
    free: [] // Plus utilisé en Phase 4
  };
}

/**
 * Écrit l'état optimisé vers CACHE
 */
function writeStateToCache_(state, ctx) {
  logLine('INFO', '  💾 Écriture de l\'état optimisé vers CACHE...');

  // Validation de l'état
  if (!state || !state.byClass || typeof state.byClass !== 'object') {
    logLine('ERROR', '❌ writeStateToCache_: state.byClass invalide');
    throw new Error('writeStateToCache_: state.byClass invalide');
  }

  for (const cls in state.byClass) {
    if (!state.byClass.hasOwnProperty(cls)) continue;
    const students = state.byClass[cls];
    if (!Array.isArray(students)) continue;
    if (students.length > 0) {
      writeBatchToCache_(ctx, cls, students);
    }
  }
}

/**
 * === PARITÉ ADAPTATIVE : CALCUL DES CIBLES RÉALISTES ===
 * Calcule le ratio global F/M et détermine les cibles par classe
 */
function computeParityTargets_BASEOPTI(state) {
  let totalF = 0, totalM = 0;
  const classCounts = {};
  
  for (const cls in state.byClass) {
    if (!state.byClass.hasOwnProperty(cls)) continue;
    const students = state.byClass[cls];
    if (!Array.isArray(students)) continue;
    
    let F = 0, M = 0;
    students.forEach(function(stu) {
      const sexe = String(stu.SEXE || '').toUpperCase();
      if (sexe === 'F' || sexe === 'FILLE' || sexe === 'FEMININ') F++;
      else if (sexe === 'M' || sexe === 'GARCON' || sexe === 'MASCULIN') M++;
    });
    
    classCounts[cls] = { F: F, M: M };
    totalF += F;
    totalM += M;
  }
  
  const totalConnus = totalF + totalM;
  if (totalConnus === 0) {
    return { totalF: 0, totalM: 0, ratioF: 0.5, ratioM: 0.5, targets: {} };
  }
  
  const ratioF = totalF / totalConnus;
  const ratioM = totalM / totalConnus;
  
  logLine('INFO', '  🎯 Parité globale: ' + totalF + 'F + ' + totalM + 'M = ' + (ratioF * 100).toFixed(1) + '% F');
  
  // Répartir avec arrondi banquier
  const targets = {};
  let sumTargetF = 0, sumTargetM = 0;
  const remainders = [];
  
  for (const cls in classCounts) {
    const counts = classCounts[cls];
    const knownCount = counts.F + counts.M;
    
    if (knownCount === 0) {
      targets[cls] = { targetF: 0, targetM: 0, targetDelta: 0, enforce: false };
      continue;
    }
    
    const idealF = knownCount * ratioF;
    const idealM = knownCount * ratioM;
    let targetF = Math.floor(idealF);
    let targetM = Math.floor(idealM);
    
    remainders.push({
      cls: cls,
      targetF: targetF,
      targetM: targetM,
      remainderF: idealF - targetF,
      remainderM: idealM - targetM
    });
    
    sumTargetF += targetF;
    sumTargetM += targetM;
  }
  
  // Distribuer les unités restantes
  const missingF = totalF - sumTargetF;
  const missingM = totalM - sumTargetM;
  
  remainders.sort(function(a, b) { return b.remainderF - a.remainderF; });
  for (let i = 0; i < missingF && i < remainders.length; i++) {
    remainders[i].targetF++;
  }
  
  remainders.sort(function(a, b) { return b.remainderM - a.remainderM; });
  for (let i = 0; i < missingM && i < remainders.length; i++) {
    remainders[i].targetM++;
  }
  
  remainders.forEach(function(r) {
    targets[r.cls] = {
      targetF: r.targetF,
      targetM: r.targetM,
      targetDelta: r.targetF - r.targetM,
      enforce: true
    };
    logLine('INFO', '    ' + r.cls + ': cible ' + r.targetF + 'F / ' + r.targetM + 'M (Δ=' + (r.targetF - r.targetM) + ')');
  });
  
  return { totalF: totalF, totalM: totalM, ratioF: ratioF, ratioM: ratioM, targets: targets };
}

/**
 * ✅ V16 : Calcule écart-type d'un tableau de valeurs
 * Utile pour mesurer l'hétérogénéité intra-classe
 */
function computeStdDev_(values) {
  if (!values || values.length === 0) return 0;
  const mean = values.reduce(function(a, b) { return a + b; }, 0) / values.length;
  const variance = values.reduce(function(sum, v) { return sum + Math.pow(v - mean, 2); }, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calcule les statistiques globales
 * ✅ V16 : Inclut hétérogénéité PART/ABS (pas que COM/TRA)
 */
function computeGlobalStats_(state, weights) {
  // Validation de l'état
  if (!state || !state.byClass || typeof state.byClass !== 'object') {
    logLine('WARN', '⚠️ computeGlobalStats_: state.byClass invalide');
    return {
      totalScore: 0,
      parityOk: 0,
      com1Spread: 0,
      com1Counts: {},
      mobilite: { LIBRE: 0, FIXE: 0, PERMUT: 0 }
    };
  }

  let totalScore = 0;
  let parityOk = 0;
  const com1Counts = {};
  const mobilite = { LIBRE: 0, FIXE: 0, PERMUT: 0 };

  // ✅ V16 : Hétérogénéité détaillée par critère
  const heterogeneity = {
    COM: { byClass: {}, global: 0 },
    TRA: { byClass: {}, global: 0 },
    PART: { byClass: {}, global: 0 },
    ABS: { byClass: {}, global: 0 }
  };

  for (const cls in state.byClass) {
    if (!state.byClass.hasOwnProperty(cls)) continue;
    const students = state.byClass[cls];
    if (!Array.isArray(students)) continue;

    let classScore = 0;
    let F = 0, M = 0;
    let com1 = 0;

    // ✅ V16 : Collecter scores par critère pour écart-type
    const comScores = [];
    const traScores = [];
    const partScores = [];
    const absScores = [];

    students.forEach(function(stu) {
      // Scores
      const com = Number(stu.COM || 0);
      const tra = Number(stu.TRA || 0);
      const part = Number(stu.PART || 0);
      const abs = Number(stu.ABS || 0);

      classScore += weights.com * com + weights.tra * tra + weights.part * part + weights.abs * abs;

      // ✅ V16 : Stocker pour hétérogénéité
      comScores.push(com);
      traScores.push(tra);
      partScores.push(part);
      absScores.push(abs);

      // Parité
      const sexe = String(stu.SEXE || '').toUpperCase();
      if (sexe === 'F') F++;
      else if (sexe === 'M') M++;

      // COM=1
      if (com === 1) com1++;

      // Mobilité
      const mob = String(stu.MOBILITE || stu.FIXE || '').toUpperCase();
      if (mob === 'FIXE') mobilite.FIXE++;
      else if (mob === 'PERMUT') mobilite.PERMUT++;
      else mobilite.LIBRE++;
    });

    totalScore += classScore;
    com1Counts[cls] = com1;

    // ✅ V16 : Calculer écart-types intra-classe
    heterogeneity.COM.byClass[cls] = computeStdDev_(comScores);
    heterogeneity.TRA.byClass[cls] = computeStdDev_(traScores);
    heterogeneity.PART.byClass[cls] = computeStdDev_(partScores);
    heterogeneity.ABS.byClass[cls] = computeStdDev_(absScores);

    // Parité OK si |F-M| <= tolérance
    if (Math.abs(F - M) <= 2) parityOk++;
  }

  // ✅ V16 : Hétérogénéité globale (moyenne des écart-types)
  const classesList = Object.keys(state.byClass);
  if (classesList.length > 0) {
    heterogeneity.COM.global = Object.values(heterogeneity.COM.byClass).reduce(function(a, b) { return a + b; }, 0) / classesList.length;
    heterogeneity.TRA.global = Object.values(heterogeneity.TRA.byClass).reduce(function(a, b) { return a + b; }, 0) / classesList.length;
    heterogeneity.PART.global = Object.values(heterogeneity.PART.byClass).reduce(function(a, b) { return a + b; }, 0) / classesList.length;
    heterogeneity.ABS.global = Object.values(heterogeneity.ABS.byClass).reduce(function(a, b) { return a + b; }, 0) / classesList.length;
  }
  
  // Spread COM=1 (variance)
  const com1Values = Object.values(com1Counts);
  const com1Mean = com1Values.reduce(function(a, b) { return a + b; }, 0) / com1Values.length;
  const com1Variance = com1Values.reduce(function(sum, v) { return sum + Math.pow(v - com1Mean, 2); }, 0) / com1Values.length;
  
  return {
    totalScore: totalScore,
    parityOk: parityOk,
    com1Spread: Math.sqrt(com1Variance),
    com1Counts: com1Counts,
    mobilite: mobilite,
    heterogeneity: heterogeneity  // ✅ V16 : Retourner hétérogénéité PART/ABS
  };
}

/**
 * Optimisation par swaps (timeboxed)
 */
function runSwapOptimization_(state, ctx, weights, tolParity, maxSwaps, runtimeSec) {
  const startTime = new Date().getTime();
  let swapsApplied = 0;
  let swapsEvaluated = 0;
  let iteration = 0;
  const maxIterations = maxSwaps * 10; // Limite de sécurité
  
  // === CALCUL DES CIBLES DE PARITÉ ADAPTATIVES ===
  const parityTargets = computeParityTargets_BASEOPTI(state);
  
  let currentScore = evaluateObjective_(state, weights, tolParity, parityTargets);
  let bestScore = currentScore;
  let stagnationCount = 0;
  const maxStagnation = 50;
  
  logLine('INFO', '  🔄 Début optimisation (score=' + currentScore.toFixed(2) + ')');
  
  while (swapsApplied < maxSwaps && iteration < maxIterations) {
    iteration++;
    
    // Vérifier timeout
    const elapsed = Math.round((new Date().getTime() - startTime) / 1000);
    if (elapsed >= runtimeSec) {
      logLine('INFO', '  ⏱️ Timeout atteint (' + runtimeSec + 's)');
      break;
    }
    
    // Trouver le meilleur swap
    const swap = findBestSwap_(state, ctx, weights, tolParity, parityTargets);
    swapsEvaluated++;
    
    if (!swap) {
      logLine('INFO', '  🛑 Plus de swap possible (iteration=' + iteration + ')');
      break;
    }
    
    // Appliquer le swap
    applySwap_(state, swap);
    swapsApplied++;
    
    // Évaluer le nouveau score
    const newScore = evaluateObjective_(state, weights, tolParity, parityTargets);
    
    if (newScore > bestScore) {
      bestScore = newScore;
      stagnationCount = 0;
      
      if (swapsApplied % 10 === 0) {
        logLine('INFO', '  📊 ' + swapsApplied + ' swaps | score=' + newScore.toFixed(2) + ' | elapsed=' + elapsed + 's');
      }
    } else {
      stagnationCount++;
    }
    
    // Anti-stagnation
    if (stagnationCount >= maxStagnation) {
      logLine('INFO', '  🔄 Stagnation détectée (' + maxStagnation + ' itérations) — relaxation');
      stagnationCount = 0;
      // Ici on pourrait relâcher temporairement les contraintes
    }
    
    currentScore = newScore;
  }
  
  const totalElapsed = Math.round((new Date().getTime() - startTime) / 1000);
  logLine('INFO', '  ✅ Optimisation terminée : ' + swapsApplied + ' swaps en ' + totalElapsed + 's (' + iteration + ' itérations)');
  
  return {
    state: state,
    swapsApplied: swapsApplied,
    swapsEvaluated: swapsEvaluated,
    finalScore: currentScore,
    summary: 'P4 V2: ' + swapsApplied + ' swaps, score=' + currentScore.toFixed(2)
  };
}

/**
 * Évalue la fonction objectif globale
 */
function evaluateObjective_(state, weights, tolParity, parityTargets) {
  // Validation de l'état
  if (!state || !state.byClass || typeof state.byClass !== 'object') {
    logLine('WARN', '⚠️ evaluateObjective_: state.byClass invalide');
    return 0;
  }

  let score = 0;
  const parityDeltas = []; // Stocker les écarts de parité de chaque classe

  for (const cls in state.byClass) {
    if (!state.byClass.hasOwnProperty(cls)) continue;
    const students = state.byClass[cls];
    if (!Array.isArray(students)) continue;

    let classScore = 0;
    let F = 0, M = 0;

    students.forEach(function(stu) {
      const com = Number(stu.COM || 0);
      const tra = Number(stu.TRA || 0);
      const part = Number(stu.PART || 0);
      const abs = Number(stu.ABS || 0);

      // Score comportemental (plus le score est bas, mieux c'est)
      // On inverse : score = 5 - valeur (1→4, 2→3, 3→2, 4→1)
      classScore += weights.com * (5 - com) + weights.tra * (5 - tra) + weights.part * (5 - part) + weights.abs * (5 - abs);

      const sexe = String(stu.SEXE || '').toUpperCase();
      if (sexe === 'F' || sexe === 'FILLE' || sexe === 'FEMININ') F++;
      else if (sexe === 'M' || sexe === 'GARCON' || sexe === 'MASCULIN') M++;
    });

    // === PARITÉ ADAPTATIVE : Écart par rapport à la CIBLE ===
    const delta = F - M;
    let parityDelta;
    
    if (parityTargets && parityTargets.targets && parityTargets.targets[cls] && parityTargets.targets[cls].enforce) {
      // Écart par rapport à la cible adaptative
      const target = parityTargets.targets[cls];
      parityDelta = Math.abs(delta - target.targetDelta);
    } else {
      // Fallback : écart absolu (ancien comportement)
      parityDelta = Math.abs(delta);
    }
    
    parityDeltas.push(parityDelta);
    score += classScore;
  }

  // === PÉNALITÉ PARITÉ : Variance des écarts aux cibles ===
  // Favorise l'égalisation des écarts (réduit les extrêmes)
  if (parityDeltas.length > 0) {
    const meanDelta = parityDeltas.reduce(function(a, b) { return a + b; }, 0) / parityDeltas.length;
    const variance = parityDeltas.reduce(function(sum, delta) {
      return sum + Math.pow(delta - meanDelta, 2);
    }, 0) / parityDeltas.length;

    // Pénalité proportionnelle à la variance
    score -= weights.parity * variance * 20;
  }
  
  // Bonus pour répartition équitable des COM=1
  const com1Counts = [];
  for (const cls in state.byClass) {
    let com1 = 0;
    state.byClass[cls].forEach(function(stu) {
      if (Number(stu.COM || 0) === 1) com1++;
    });
    com1Counts.push(com1);
  }
  
  const com1Mean = com1Counts.reduce(function(a, b) { return a + b; }, 0) / com1Counts.length;
  const com1Variance = com1Counts.reduce(function(sum, v) { return sum + Math.pow(v - com1Mean, 2); }, 0) / com1Counts.length;
  score -= com1Variance * 5; // Pénalité pour variance élevée
  
  return score;
}

/**
 * Trouve le meilleur swap possible
 * ✅ CORRECTION : Recherche élargie + seuil d'amélioration minimum
 */
function findBestSwap_(state, ctx, weights, tolParity, parityTargets) {
  // Validation de l'état
  if (!state || !state.byClass || typeof state.byClass !== 'object') {
    logLine('WARN', '⚠️ findBestSwap_: state.byClass invalide');
    return null;
  }

  let bestSwap = null;
  let bestImprovement = -Infinity; // ✅ Accepter même les swaps avec amélioration minimale
  const currentScore = evaluateObjective_(state, weights, tolParity, parityTargets);

  const classes = Object.keys(state.byClass);

  // ✅ AUGMENTER LA LIMITE : Recherche plus large
  const maxStudentsToCheck = 20; // Augmenté de 10 à 20

  // Essayer des swaps entre toutes les paires de classes
  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      const cls1 = classes[i];
      const cls2 = classes[j];

      const students1 = state.byClass[cls1];
      const students2 = state.byClass[cls2];

      // ✅ RANDOMISATION : Mélanger les élèves pour éviter de toujours tester les mêmes
      const shuffled1 = students1.slice().sort(function() { return Math.random() - 0.5; });
      const shuffled2 = students2.slice().sort(function() { return Math.random() - 0.5; });

      // Essayer des swaps entre élèves mobiles
      for (let s1 = 0; s1 < Math.min(shuffled1.length, maxStudentsToCheck); s1++) {
        const stu1 = shuffled1[s1];
        if (!isEleveMobile_(stu1)) continue;

        for (let s2 = 0; s2 < Math.min(shuffled2.length, maxStudentsToCheck); s2++) {
          const stu2 = shuffled2[s2];
          if (!isEleveMobile_(stu2)) continue;

          // Vérifier faisabilité
          if (!isSwapFeasible_(stu1, stu2, cls1, cls2, ctx)) continue;

          // Simuler le swap
          const newState = simulateSwap_(state, stu1, stu2, cls1, cls2);
          const newScore = evaluateObjective_(newState, weights, tolParity, parityTargets);
          const improvement = newScore - currentScore;

          // ✅ ACCEPTER si amélioration > seuil minimum (0.01)
          if (improvement > bestImprovement && improvement > 0.01) {
            bestImprovement = improvement;
            bestSwap = { stu1: stu1, stu2: stu2, cls1: cls1, cls2: cls2, improvement: improvement };
          }
        }
      }
    }
  }

  // ✅ LOG si aucun swap trouvé
  if (!bestSwap) {
    logLine('INFO', '  ⚠️ Aucun swap bénéfique trouvé (meilleure amélioration=' + bestImprovement.toFixed(3) + ')');
  }

  return bestSwap;
}

/**
 * Vérifie si un élève est mobile
 */
function isEleveMobile_(stu) {
  const fixe = String(stu.FIXE || '').toUpperCase();
  const mobilite = String(stu.MOBILITE || '').toUpperCase();
  return fixe !== 'FIXE' && mobilite !== 'FIXE';
}

/**
 * ✅ Normalise un tag d'option ou LV2 (copie depuis OptiConfig_System.gs)
 * Voir normalizeOptionTag_() pour documentation complète
 */
function normalizeOptionTag_(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let tag = String(raw).trim().toUpperCase();
  tag = tag.replace(/^(LV2|OPTION|OPT|LANGUE)\s*[-:\s]*/i, '');
  tag = tag.replace(/\(.*?\)/g, '');
  tag = tag.replace(/\s+\d+$/g, '');
  tag = tag.replace(/\d+$/g, '');
  tag = tag.replace(/[.,;:\-_\s]+/g, '');
  const synonyms = {
    'ITALIEN': 'ITA', 'ITALIE': 'ITA', 'ESPAGNOL': 'ESP', 'ESPAGNE': 'ESP',
    'ALLEMAND': 'ALL', 'ALLEMAGNE': 'ALL', 'CHINOIS': 'CHI', 'CHINE': 'CHI',
    'LATIN': 'LAT', 'GREC': 'GRE', 'PORTUGUAIS': 'PT', 'PORTUGAL': 'PT',
    'CHEVAL': 'CHAV'
  };
  return synonyms[tag] || tag;
}

/**
 * Vérifie si un swap est faisable (quotas, groupes)
 * ✅ FIX CRITIQUE: Bloque les swaps qui violent les contraintes OPT/LV2
 * ✅ CORRECTION NORMALISATION : Applique normalizeOptionTag_() avant comparaison
 */
function isSwapFeasible_(stu1, stu2, cls1, cls2, ctx) {
  // ===== 1. VÉRIFIER QUOTAS LV2/OPT =====
  // ✅ RÈGLE: Un élève avec OPT/LV2 NE PEUT ÊTRE DÉPLACÉ que vers une classe qui propose cette option

  // Extraire OPT/LV2 des deux élèves et NORMALISER
  const opt1 = normalizeOptionTag_(String(stu1.OPT || '').trim());
  const lv21 = normalizeOptionTag_(String(stu1.LV2 || '').trim());
  const opt2 = normalizeOptionTag_(String(stu2.OPT || '').trim());
  const lv22 = normalizeOptionTag_(String(stu2.LV2 || '').trim());

  // Récupérer les quotas configurés depuis ctx (DÉJÀ NORMALISÉS par buildCtx_V2)
  const quotas = ctx.quotas || {};
  const quotasCls1 = quotas[cls1] || {};
  const quotasCls2 = quotas[cls2] || {};

  // Vérifier que stu1 peut aller dans cls2
  if (opt1 && !quotasCls2[opt1]) {
    // stu1 a un OPT (ex: CHAV) mais cls2 ne propose pas cet OPT
    logLine('DEBUG', '  🚫 Swap bloqué: ' + (stu1.NOM || 'élève') + ' (OPT=' + opt1 + ') ne peut aller en ' + cls2 + ' (pas de quota ' + opt1 + ')');
    return false;
  }
  if (lv21 && !quotasCls2[lv21]) {
    // stu1 a une LV2 (ex: ITA) mais cls2 ne propose pas cette LV2
    logLine('DEBUG', '  🚫 Swap bloqué: ' + (stu1.NOM || 'élève') + ' (LV2=' + lv21 + ') ne peut aller en ' + cls2 + ' (pas de quota ' + lv21 + ')');
    return false;
  }

  // Vérifier que stu2 peut aller dans cls1
  if (opt2 && !quotasCls1[opt2]) {
    // stu2 a un OPT mais cls1 ne propose pas cet OPT
    logLine('DEBUG', '  🚫 Swap bloqué: ' + (stu2.NOM || 'élève') + ' (OPT=' + opt2 + ') ne peut aller en ' + cls1 + ' (pas de quota ' + opt2 + ')');
    return false;
  }
  if (lv22 && !quotasCls1[lv22]) {
    // stu2 a une LV2 mais cls1 ne propose pas cette LV2
    logLine('DEBUG', '  🚫 Swap bloqué: ' + (stu2.NOM || 'élève') + ' (LV2=' + lv22 + ') ne peut aller en ' + cls1 + ' (pas de quota ' + lv22 + ')');
    return false;
  }

  // ===== 2. VÉRIFIER GROUPES ASSO (ne pas séparer) =====
  const asso1 = String(stu1.ASSO || stu1.A || '').trim();
  const asso2 = String(stu2.ASSO || stu2.A || '').trim();
  if (asso1 && asso1 === asso2) return false; // Même groupe ASSO

  // ===== 3. VÉRIFIER GROUPES DISSO (ne pas regrouper) =====
  const disso1 = String(stu1.DISSO || stu1.D || '').trim();
  const disso2 = String(stu2.DISSO || stu2.D || '').trim();
  if (disso1 && disso1 === disso2) return false; // Même groupe DISSO

  // ===== 4. V16 VÉRIFIER IMPACT SUR PARITÉ =====
  const sexe1 = String(stu1.SEXE || '').toUpperCase();
  const sexe2 = String(stu2.SEXE || '').toUpperCase();

  // Si même genre, swap neutre pour parité
  if (sexe1 === sexe2) {
    return true; // OK, parité inchangée
  }

  // Swap entre genres différents : vérifier tolérance
  const tolParity = ctx.tolParite || 2;

  // Calculer parité actuelle des deux classes (depuis state si disponible)
  // Note: state n'est pas passé en paramètre, donc on ne peut pas calculer
  // l'impact exact. On log un warning pour traçabilité.
  logLine('DEBUG', '  ⚠️ Swap entre genres différents : ' + sexe1 + ' ↔ ' + sexe2);
  logLine('DEBUG', '     Classes : ' + cls1 + ' ↔ ' + cls2);
  logLine('DEBUG', '     Impact parité : À vérifier manuellement (state non disponible ici)');

  // Pour l'instant, on ACCEPTE mais on log (TODO: améliorer en passant state)
  return true;
}

/**
 * Simule un swap sans modifier l'état
 */
function simulateSwap_(state, stu1, stu2, cls1, cls2) {
  // Validation de l'état
  if (!state || !state.byClass || typeof state.byClass !== 'object') {
    logLine('WARN', '⚠️ simulateSwap_: state.byClass invalide');
    return { byClass: {} };
  }

  // Copie profonde simplifiée
  const newState = { byClass: {} };
  for (const cls in state.byClass) {
    if (!state.byClass.hasOwnProperty(cls)) continue;
    if (Array.isArray(state.byClass[cls])) {
      newState.byClass[cls] = state.byClass[cls].slice();
    }
  }
  
  // Échanger
  const idx1 = newState.byClass[cls1].indexOf(stu1);
  const idx2 = newState.byClass[cls2].indexOf(stu2);
  
  if (idx1 !== -1 && idx2 !== -1) {
    newState.byClass[cls1][idx1] = stu2;
    newState.byClass[cls2][idx2] = stu1;
  }
  
  return newState;
}

/**
 * Applique un swap (modifie l'état)
 */
function applySwap_(state, swap) {
  const idx1 = state.byClass[swap.cls1].indexOf(swap.stu1);
  const idx2 = state.byClass[swap.cls2].indexOf(swap.stu2);
  
  if (idx1 !== -1 && idx2 !== -1) {
    // Échanger
    state.byClass[swap.cls1][idx1] = swap.stu2;
    state.byClass[swap.cls2][idx2] = swap.stu1;
    
    // Mettre à jour CLASSE_FINAL
    swap.stu1.CLASSE_FINAL = swap.cls2;
    swap.stu2.CLASSE_FINAL = swap.cls1;
  }
}
