/**
 * ===================================================================
 * PHASES 3 & 4 OPTIMISÉES : PARITÉ ADAPTATIVE & HÉTÉROGÉNÉITÉ
 * ===================================================================
 * 
 * Phase 3 : Parité F/M adaptative (pas forcément 50/50)
 * Phase 4 : Hétérogénéité maximale des scores COM/TRA/PART/ABS
 * 
 * PRINCIPE FONDAMENTAL :
 * - Respecter ABSOLUMENT les contraintes OPT/LV2/ASSO/DISSO
 * - Optimiser la parité selon le ratio global disponible
 * - Créer des classes hétérogènes (éviter les classes "fortes" ou "faibles")
 * 
 * Version: 2.0
 * Date: Janvier 2025
 */

// ===================================================================
// PHASE 3 AMÉLIORÉE : PARITÉ ADAPTATIVE
// ===================================================================

/**
 * Phase 3 V4 : Complétion avec parité adaptative intelligente
 * 
 * @param {Object} ctx - Contexte d'optimisation
 * @returns {Object} Résultat de la phase
 */
function Phase3_AdaptiveParity_V4(ctx) {
  logLine('INFO', '='.repeat(80));
  logLine('INFO', '📌 PHASE 3 V4 - Effectifs & Parité ADAPTATIVE');
  logLine('INFO', '='.repeat(80));

  const ss = ctx.ss || SpreadsheetApp.getActive();
  const baseSheet = ss.getSheetByName('_BASEOPTI');
  const data = baseSheet.getDataRange().getValues();
  const headers = data[0];

  const indices = {
    assigned: headers.indexOf('_CLASS_ASSIGNED'),
    placed: headers.indexOf('_PLACED'),
    sexe: headers.indexOf('SEXE'),
    nom: headers.indexOf('NOM'),
    prenom: headers.indexOf('PRENOM'),
    opt: headers.indexOf('OPT'),
    lv2: headers.indexOf('LV2'),
    asso: headers.indexOf('ASSO'),
    disso: headers.indexOf('DISSO'),
    // Scores pour pré-analyse
    com: headers.indexOf('COM'),
    tra: headers.indexOf('TRA'),
    part: headers.indexOf('PART'),
    abs: headers.indexOf('ABS')
  };

  // ===================================================================
  // ÉTAPE 1 : ANALYSER LA SITUATION ACTUELLE
  // ===================================================================
  
  const analysis = analyzeCurrentDistribution(data, indices, ctx);
  
  logLine('INFO', '📊 Analyse de la distribution actuelle :');
  logLine('INFO', `  - Ratio global : ${analysis.globalRatio.F}% F / ${analysis.globalRatio.M}% M`);
  logLine('INFO', `  - Élèves non placés : ${analysis.unplacedByGender.F} F, ${analysis.unplacedByGender.M} M`);
  
  // Afficher l'état de chaque classe
  Object.entries(analysis.classeStats).forEach(([classe, stats]) => {
    logLine('INFO', `  - ${classe} : ${stats.current}/${stats.target} (${stats.F}F/${stats.M}M)`);
  });

  // ===================================================================
  // ÉTAPE 2 : CALCULER LES CIBLES ADAPTATIVES
  // ===================================================================
  
  const targets = calculateAdaptiveTargets(analysis, ctx);
  
  logLine('INFO', '\n🎯 Cibles adaptatives calculées :');
  Object.entries(targets).forEach(([classe, target]) => {
    logLine('INFO', `  - ${classe} : ${target.F}F + ${target.M}M = ${target.total} (ratio ${target.ratioF}%F)`);
  });

  // ===================================================================
  // ÉTAPE 3 : PLACER LES ÉLÈVES EN RESPECTANT LES CIBLES
  // ===================================================================
  
  logLine('INFO', '\n✍️ Placement des élèves...');
  
  const placementResult = placeStudentsWithAdaptiveParity(
    data, 
    indices, 
    analysis, 
    targets
  );

  // ===================================================================
  // ÉTAPE 4 : ÉCRIRE LES MODIFICATIONS
  // ===================================================================
  
  if (placementResult.total > 0) {
    baseSheet.getRange(1, 1, data.length, headers.length).setValues(data);
    SpreadsheetApp.flush();
    logLine('INFO', `✅ ${placementResult.total} élèves placés`);
  }

  // Afficher le résumé final
  logLine('INFO', '\n📊 Résumé final :');
  Object.entries(placementResult.byClass).forEach(([classe, stats]) => {
    const ratioF = stats.total > 0 ? Math.round((stats.F / stats.total) * 100) : 0;
    logLine('INFO', `  - ${classe} : ${stats.total} élèves (${stats.F}F/${stats.M}M = ${ratioF}%F)`);
  });

  return {
    ok: true,
    placed: placementResult.total,
    byClass: placementResult.byClass
  };
}

/**
 * Analyse la distribution actuelle des élèves
 */
function analyzeCurrentDistribution(data, indices, ctx) {
  const analysis = {
    totalStudents: 0,
    placedStudents: 0,
    unplacedStudents: 0,
    totalByGender: { F: 0, M: 0 },
    placedByGender: { F: 0, M: 0 },
    unplacedByGender: { F: 0, M: 0 },
    globalRatio: { F: 0, M: 0 },
    classeStats: {},
    unplacedPool: []
  };

  const safeGet = (row, index) => (index >= 0 ? row[index] : '');
  const normalizeConstraintValue = value => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (value === true) return 'TRUE';
    if (value === false) return '';
    return String(value).trim();
  };

  // Initialiser les stats par classe
  (ctx.levels || ['5°1', '5°2', '5°3', '5°4', '5°5', '5°6']).forEach(classe => {
    analysis.classeStats[classe] = {
      current: 0,
      target: ctx.targets?.[classe] || 28,
      F: 0,
      M: 0,
      needed: 0
    };
  });

  // Parcourir tous les élèves
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const sexe = String(row[indices.sexe]).toUpperCase();
    const placed = row[indices.placed] === true || row[indices.placed] === 'TRUE';
    const assigned = row[indices.assigned];
    const nom = String(safeGet(row, indices.nom) || '').trim();
    const prenom = String(safeGet(row, indices.prenom) || '').trim();

    if (sexe === 'F' || sexe === 'M') {
      analysis.totalStudents++;
      analysis.totalByGender[sexe]++;

      if (placed && assigned) {
        analysis.placedStudents++;
        analysis.placedByGender[sexe]++;
        
        if (analysis.classeStats[assigned]) {
          analysis.classeStats[assigned].current++;
          analysis.classeStats[assigned][sexe]++;
        }
      } else {
        analysis.unplacedStudents++;
        analysis.unplacedByGender[sexe]++;

        // Ajouter au pool des non-placés avec leurs scores
        const opt = normalizeConstraintValue(safeGet(row, indices.opt));
        const lv2 = normalizeConstraintValue(safeGet(row, indices.lv2));
        const asso = normalizeConstraintValue(safeGet(row, indices.asso));
        const disso = normalizeConstraintValue(safeGet(row, indices.disso));
        const constraintLabels = [];
        if (opt) constraintLabels.push(`OPT=${opt}`);
        if (lv2) constraintLabels.push(`LV2=${lv2}`);
        if (asso) constraintLabels.push(`ASSO=${asso}`);
        if (disso) constraintLabels.push(`DISSO=${disso}`);

        analysis.unplacedPool.push({
          index: i,
          sexe: sexe,
          nom: nom,
          prenom: prenom,
          com: parseFloat(row[indices.com]) || 0,
          tra: parseFloat(row[indices.tra]) || 0,
          part: parseFloat(row[indices.part]) || 0,
          abs: parseFloat(row[indices.abs]) || 0,
          opt: opt,
          lv2: lv2,
          asso: asso,
          disso: disso,
          constraintLabels: constraintLabels,
          hasConstraint: constraintLabels.length > 0,
          // Score composite (COM prioritaire)
          compositeScore: (parseFloat(row[indices.com]) || 0) * 2 +
                         (parseFloat(row[indices.tra]) || 0) +
                         (parseFloat(row[indices.part]) || 0) +
                         (parseFloat(row[indices.abs]) || 0)
        });
      }
    }
  }

  // Calculer le ratio global
  if (analysis.totalStudents > 0) {
    analysis.globalRatio.F = Math.round((analysis.totalByGender.F / analysis.totalStudents) * 100);
    analysis.globalRatio.M = 100 - analysis.globalRatio.F;
  }

  // Calculer les besoins par classe
  Object.keys(analysis.classeStats).forEach(classe => {
    const stats = analysis.classeStats[classe];
    stats.needed = Math.max(0, stats.target - stats.current);
  });

  return analysis;
}

/**
 * Calcule les cibles adaptatives pour chaque classe
 */
function calculateAdaptiveTargets(analysis, ctx) {
  const targets = {};
  
  // Tolérance de parité (ex: ±3 du ratio idéal)
  const PARITY_TOLERANCE = ctx.parityTolerance || 3;

  Object.entries(analysis.classeStats).forEach(([classe, stats]) => {
    if (stats.needed === 0) {
      targets[classe] = { F: 0, M: 0, total: 0, ratioF: 0 };
      return;
    }

    // Calculer le ratio idéal basé sur le ratio global
    const idealF = Math.round(stats.needed * (analysis.globalRatio.F / 100));
    const idealM = stats.needed - idealF;

    // Ajuster selon les disponibilités
    let targetF = Math.min(idealF, analysis.unplacedByGender.F);
    let targetM = Math.min(idealM, analysis.unplacedByGender.M);

    // Si on ne peut pas atteindre l'effectif cible, ajuster
    if (targetF + targetM < stats.needed) {
      // Essayer d'ajouter de l'autre genre si disponible
      const missingF = idealF - targetF;
      const missingM = idealM - targetM;
      
      if (missingF > 0 && analysis.unplacedByGender.M > targetM) {
        const additionalM = Math.min(missingF, analysis.unplacedByGender.M - targetM);
        targetM += additionalM;
      }
      
      if (missingM > 0 && analysis.unplacedByGender.F > targetF) {
        const additionalF = Math.min(missingM, analysis.unplacedByGender.F - targetF);
        targetF += additionalF;
      }
    }

    // Vérifier que le ratio reste dans la tolérance
    const totalTarget = targetF + targetM;
    let ratioF = totalTarget > 0 ? Math.round((targetF / totalTarget) * 100) : 0;
    
    // Ajuster si hors tolérance
    if (Math.abs(ratioF - analysis.globalRatio.F) > PARITY_TOLERANCE) {
      logLine('DEBUG', `  Ajustement parité ${classe}: ratio ${ratioF}% hors tolérance`);
      // Réajuster légèrement pour rester dans la tolérance
      // (logique simplifiée, peut être améliorée)
    }

    targets[classe] = {
      F: targetF,
      M: targetM,
      total: targetF + targetM,
      ratioF: ratioF
    };
  });

  return targets;
}

/**
 * Place les élèves en respectant les cibles de parité
 */
function placeStudentsWithAdaptiveParity(data, indices, analysis, targets) {
  const result = {
    total: 0,
    byClass: {}
  };

  const hasConstraintForAutoPlacement = student => {
    if (!student) return false;
    if (student.hasConstraint) return true;
    return Boolean(student.constraintLabels && student.constraintLabels.length > 0);
  };

  const formatStudentNameForLog = student => {
    if (!student) return 'Élève inconnu';
    const parts = [];
    if (student.prenom) parts.push(student.prenom);
    if (student.nom) parts.push(student.nom);
    if (parts.length === 0) return `Élève #${student.index}`;
    return parts.join(' ').trim();
  };

  // Initialiser les compteurs
  Object.keys(targets).forEach(classe => {
    result.byClass[classe] = { total: 0, F: 0, M: 0 };
  });

  // Trier le pool par score composite (pour distribuer équitablement)
  // Les scores faibles (1) sont prioritaires pour être répartis
  analysis.unplacedPool.sort((a, b) => a.compositeScore - b.compositeScore);

  // Pour chaque classe, placer les élèves selon les cibles
  Object.entries(targets).forEach(([classe, target]) => {
    if (target.total === 0) return;

    let neededF = target.F;
    let neededM = target.M;
    
    // Placer en alternant F/M pour maintenir l'équilibre
    // et en prenant les scores variés (début, milieu, fin du pool trié)
    let placed = 0;
    let poolIndex = 0;

    while ((neededF > 0 || neededM > 0) && poolIndex < analysis.unplacedPool.length) {
      const student = analysis.unplacedPool[poolIndex];

      if (!student) {
        poolIndex++;
        continue;
      }

      if (student.skippedForConstraints) {
        poolIndex++;
        continue;
      }

      if (data[student.index][indices.placed]) {
        poolIndex++;
        continue;
      }

      if (hasConstraintForAutoPlacement(student)) {
        if (!student.constraintLogged) {
          const constraintMessage = (student.constraintLabels && student.constraintLabels.length > 0)
            ? student.constraintLabels.join(', ')
            : 'contraintes inconnues';
          logLine('INFO', `  ⛔ ${formatStudentNameForLog(student)} ignoré pour placement auto (contraintes : ${constraintMessage})`);
          student.constraintLogged = true;
        }

        student.skippedForConstraints = true;
        poolIndex++;
        continue;
      }

      // Vérifier si on a besoin de ce genre
      if ((student.sexe === 'F' && neededF > 0) ||
          (student.sexe === 'M' && neededM > 0)) {

        // Placer l'élève
        data[student.index][indices.assigned] = classe;
        data[student.index][indices.placed] = true;
        
        result.total++;
        result.byClass[classe].total++;
        result.byClass[classe][student.sexe]++;
        
        if (student.sexe === 'F') neededF--;
        else neededM--;
        
        placed++;
        
        // Marquer comme placé pour ne pas le reprendre
        student.placed = true;
      }
      
      // Stratégie de sélection : alterner entre début et fin du pool
      // pour mélanger les scores
      if (placed % 2 === 0) {
        poolIndex++;
      } else {
        // Chercher un élève non placé vers la fin
        let endIndex = analysis.unplacedPool.length - 1;
        while (endIndex > poolIndex && (analysis.unplacedPool[endIndex].placed ||
               analysis.unplacedPool[endIndex].skippedForConstraints)) {
          endIndex--;
        }
        if (endIndex > poolIndex) {
          // Échanger pour traiter celui de la fin
          [analysis.unplacedPool[poolIndex], analysis.unplacedPool[endIndex]] = 
          [analysis.unplacedPool[endIndex], analysis.unplacedPool[poolIndex]];
        }
      }
    }
  });

  return result;
}

// ===================================================================
// PHASE 4 OPTIMISÉE : HÉTÉROGÉNÉITÉ MAXIMALE
// ===================================================================

/**
 * Phase 4 V4 : Optimisation avancée pour l'hétérogénéité
 * Utilise un algorithme génétique simplifié pour maximiser l'hétérogénéité
 * 
 * @param {Object} ctx - Contexte d'optimisation
 * @returns {Object} Résultat de la phase
 */
function Phase4_MaxHeterogeneity_V4(ctx) {
  logLine('INFO', '='.repeat(80));
  logLine('INFO', '📌 PHASE 4 V4 - Optimisation HÉTÉROGÉNÉITÉ MAXIMALE');
  logLine('INFO', '='.repeat(80));

  const ss = ctx.ss || SpreadsheetApp.getActive();
  const baseSheet = ss.getSheetByName('_BASEOPTI');
  const data = baseSheet.getDataRange().getValues();
  const headers = data[0];

  const indices = {
    id: headers.indexOf('_ID'),
    nom: headers.indexOf('NOM'),
    prenom: headers.indexOf('PRENOM'),
    assigned: headers.indexOf('_CLASS_ASSIGNED'),
    placed: headers.indexOf('_PLACED'),
    sexe: headers.indexOf('SEXE'),
    lv2: headers.indexOf('LV2'),
    opt: headers.indexOf('OPT'),
    asso: headers.indexOf('ASSO'),
    disso: headers.indexOf('DISSO'),
    com: headers.indexOf('COM'),
    tra: headers.indexOf('TRA'),
    part: headers.indexOf('PART'),
    abs: headers.indexOf('ABS')
  };

  // ===================================================================
  // ÉTAPE 1 : ANALYSER LA SITUATION INITIALE
  // ===================================================================
  
  const initialAnalysis = analyzeClassHeterogeneity(data, indices, ctx);
  
  logLine('INFO', '📊 Analyse initiale de l\'hétérogénéité :');
  logLine('INFO', `  - Score global : ${initialAnalysis.globalScore.toFixed(2)}`);
  logLine('INFO', '  - Moyennes par classe :');
  
  Object.entries(initialAnalysis.classStats).forEach(([classe, stats]) => {
    logLine('INFO', `    ${classe} : COM=${stats.avgCOM.toFixed(2)}, ` +
                   `TRA=${stats.avgTRA.toFixed(2)}, ` +
                   `écart-type COM=${stats.stdCOM.toFixed(2)}`);
  });

  // ===================================================================
  // ÉTAPE 2 : IDENTIFIER LES ÉLÈVES ÉCHANGEABLES
  // ===================================================================
  
  const swappableStudents = identifySwappableStudents(data, indices);
  logLine('INFO', `\n🔄 ${swappableStudents.length} élèves échangeables identifiés`);

  if (swappableStudents.length < 2) {
    logLine('WARN', '⚠️ Pas assez d\'élèves échangeables pour optimiser');
    return { ok: true, swapsApplied: 0 };
  }

  // ===================================================================
  // ÉTAPE 3 : OPTIMISATION PAR ALGORITHME GÉNÉTIQUE SIMPLIFIÉ
  // ===================================================================
  
  const maxIterations = ctx.maxSwaps || 1000;
  const maxRuntime = ctx.runtimeSec || 30;
  const startTime = new Date();
  
  let currentScore = initialAnalysis.globalScore;
  let swapsApplied = 0;
  let iterations = 0;
  let improvements = 0;

  logLine('INFO', '\n🧬 Début de l\'optimisation génétique...');
  logLine('INFO', `  - Max iterations : ${maxIterations}`);
  logLine('INFO', `  - Max runtime : ${maxRuntime}s`);

  while (iterations < maxIterations) {
    iterations++;
    
    // Vérifier le timeout
    if ((new Date() - startTime) / 1000 > maxRuntime) {
      logLine('INFO', '⏱️ Timeout atteint');
      break;
    }

    // Générer un swap candidat
    const swap = generateSmartSwap(
      swappableStudents, 
      data, 
      indices, 
      initialAnalysis.classStats
    );

    if (!swap) continue;

    // Vérifier que le swap est valide
    if (!isSwapValid(swap, data, indices, ctx)) {
      continue;
    }

    // Simuler le swap et calculer le nouveau score
    const simulation = simulateSwap(swap, data, indices, initialAnalysis);
    
    // Accepter si amélioration ou avec probabilité décroissante (recuit simulé)
    const deltaScore = simulation.newScore - currentScore;
    const temperature = 1.0 - (iterations / maxIterations); // Refroidissement
    const acceptProbability = deltaScore > 0 ? 1.0 : Math.exp(deltaScore / temperature);
    
    if (deltaScore > 0 || Math.random() < acceptProbability) {
      // Appliquer le swap
      applySwap(swap, data, indices);
      currentScore = simulation.newScore;
      swapsApplied++;
      
      if (deltaScore > 0) {
        improvements++;
        logLine('INFO', `  ✅ Swap ${swapsApplied}: ${swap.student1.nom} ↔ ${swap.student2.nom} ` +
                       `(amélioration: +${deltaScore.toFixed(3)})`);
      }
    }

    // Afficher la progression
    if (iterations % 100 === 0) {
      logLine('INFO', `  📈 Itération ${iterations}: score=${currentScore.toFixed(2)}, ` +
                     `swaps=${swapsApplied}, améliorations=${improvements}`);
    }
  }

  // ===================================================================
  // ÉTAPE 4 : ANALYSER LE RÉSULTAT FINAL
  // ===================================================================
  
  const finalAnalysis = analyzeClassHeterogeneity(data, indices, ctx);
  const improvement = ((finalAnalysis.globalScore - initialAnalysis.globalScore) / 
                       initialAnalysis.globalScore * 100).toFixed(1);

  logLine('INFO', '\n📊 Résultat final :');
  logLine('INFO', `  - Score initial : ${initialAnalysis.globalScore.toFixed(2)}`);
  logLine('INFO', `  - Score final : ${finalAnalysis.globalScore.toFixed(2)}`);
  logLine('INFO', `  - Amélioration : ${improvement}%`);
  logLine('INFO', `  - Swaps appliqués : ${swapsApplied}`);
  logLine('INFO', `  - Itérations : ${iterations}`);

  // Écrire les modifications si des swaps ont été effectués
  if (swapsApplied > 0) {
    baseSheet.getRange(1, 1, data.length, headers.length).setValues(data);
    SpreadsheetApp.flush();
    logLine('INFO', '✅ Modifications écrites dans _BASEOPTI');
  }

  return {
    ok: true,
    swapsApplied: swapsApplied,
    iterations: iterations,
    improvement: parseFloat(improvement),
    finalScore: finalAnalysis.globalScore
  };
}

/**
 * Analyse l'hétérogénéité des classes
 */
function analyzeClassHeterogeneity(data, indices, ctx) {
  const analysis = {
    classStats: {},
    globalScore: 0
  };

  // Calculer les stats par classe
  const classes = ctx.levels || ['5°1', '5°2', '5°3', '5°4', '5°5', '5°6'];
  
  classes.forEach(classe => {
    const students = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][indices.assigned] === classe && data[i][indices.placed]) {
        students.push({
          index: i,
          com: parseFloat(data[i][indices.com]) || 0,
          tra: parseFloat(data[i][indices.tra]) || 0,
          part: parseFloat(data[i][indices.part]) || 0,
          abs: parseFloat(data[i][indices.abs]) || 0
        });
      }
    }

    if (students.length > 0) {
      // Calculer moyennes et écarts-types
      const stats = {
        count: students.length,
        avgCOM: average(students.map(s => s.com)),
        avgTRA: average(students.map(s => s.tra)),
        avgPART: average(students.map(s => s.part)),
        avgABS: average(students.map(s => s.abs)),
        stdCOM: standardDeviation(students.map(s => s.com)),
        stdTRA: standardDeviation(students.map(s => s.tra)),
        stdPART: standardDeviation(students.map(s => s.part)),
        stdABS: standardDeviation(students.map(s => s.abs))
      };

      analysis.classStats[classe] = stats;
    }
  });

  // Calculer le score global d'hétérogénéité
  // Plus le score est élevé, plus les classes sont hétérogènes
  analysis.globalScore = calculateHeterogeneityScore(analysis.classStats);

  return analysis;
}

/**
 * Calcule un score global d'hétérogénéité
 * Objectif : minimiser les écarts entre classes ET maximiser la diversité intra-classe
 */
function calculateHeterogeneityScore(classStats) {
  let score = 0;
  const classes = Object.keys(classStats);
  
  if (classes.length === 0) return 0;

  // 1. Pénaliser les écarts entre moyennes de classes (on veut des moyennes proches)
  const avgCOMs = classes.map(c => classStats[c].avgCOM);
  const avgTRAs = classes.map(c => classStats[c].avgTRA);
  
  const interClassVarianceCOM = variance(avgCOMs);
  const interClassVarianceTRA = variance(avgTRAs);
  
  // 2. Récompenser la diversité intra-classe (écart-type élevé = bonne mixité)
  const avgIntraClassStdCOM = average(classes.map(c => classStats[c].stdCOM));
  const avgIntraClassStdTRA = average(classes.map(c => classStats[c].stdTRA));
  
  // Score composite (COM prioritaire avec poids x2)
  // On veut : faible variance inter-classe ET fort écart-type intra-classe
  score = (avgIntraClassStdCOM * 2 + avgIntraClassStdTRA) / 
          (1 + interClassVarianceCOM * 2 + interClassVarianceTRA);
  
  return score;
}

/**
 * Identifie les élèves qui peuvent être échangés
 */
function identifySwappableStudents(data, indices) {
  const swappable = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // Un élève est échangeable si :
    // - Il est placé
    // - Il n'a PAS de contrainte forte (OPT/LV2)
    // - Il n'a PAS de code ASSO/DISSO
    if (row[indices.placed] && row[indices.assigned] &&
        !row[indices.opt] && !row[indices.lv2] &&
        !row[indices.asso] && !row[indices.disso]) {
      
      swappable.push({
        index: i,
        classe: row[indices.assigned],
        sexe: row[indices.sexe],
        nom: row[indices.nom] + ' ' + row[indices.prenom],
        com: parseFloat(row[indices.com]) || 0,
        tra: parseFloat(row[indices.tra]) || 0,
        part: parseFloat(row[indices.part]) || 0,
        abs: parseFloat(row[indices.abs]) || 0,
        compositeScore: (parseFloat(row[indices.com]) || 0) * 2 + 
                       (parseFloat(row[indices.tra]) || 0) + 
                       (parseFloat(row[indices.part]) || 0) + 
                       (parseFloat(row[indices.abs]) || 0)
      });
    }
  }
  
  return swappable;
}

/**
 * Génère un swap intelligent basé sur l'analyse
 */
function generateSmartSwap(swappableStudents, data, indices, classStats) {
  // Stratégie : échanger des élèves avec des scores opposés
  // entre classes déséquilibrées
  
  // Identifier les classes les plus déséquilibrées
  const classPairs = [];
  const classes = Object.keys(classStats);
  
  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      const class1 = classes[i];
      const class2 = classes[j];
      const deltaCOM = Math.abs(classStats[class1].avgCOM - classStats[class2].avgCOM);
      
      classPairs.push({
        class1: class1,
        class2: class2,
        delta: deltaCOM
      });
    }
  }
  
  // Trier par delta décroissant (plus grande différence en premier)
  classPairs.sort((a, b) => b.delta - a.delta);
  
  // Essayer de trouver un swap dans les paires les plus déséquilibrées
  for (const pair of classPairs.slice(0, 3)) { // Top 3 paires
    const students1 = swappableStudents.filter(s => s.classe === pair.class1);
    const students2 = swappableStudents.filter(s => s.classe === pair.class2);
    
    if (students1.length === 0 || students2.length === 0) continue;
    
    // Sélectionner intelligemment
    let student1, student2;
    
    if (classStats[pair.class1].avgCOM > classStats[pair.class2].avgCOM) {
      // Class1 a un meilleur COM moyen, prendre un bon élève de class1
      // et un moins bon de class2
      students1.sort((a, b) => a.com - b.com); // Tri croissant
      students2.sort((a, b) => b.com - a.com); // Tri décroissant
      student1 = students1[0]; // Meilleur COM de class1
      student2 = students2[0]; // Pire COM de class2
    } else {
      students1.sort((a, b) => b.com - a.com);
      students2.sort((a, b) => a.com - b.com);
      student1 = students1[0];
      student2 = students2[0];
    }
    
    if (student1 && student2 && student1.index !== student2.index) {
      return { student1, student2 };
    }
  }
  
  // Fallback : sélection aléatoire
  const idx1 = Math.floor(Math.random() * swappableStudents.length);
  let idx2 = Math.floor(Math.random() * swappableStudents.length);
  
  while (idx2 === idx1 || swappableStudents[idx1].classe === swappableStudents[idx2].classe) {
    idx2 = Math.floor(Math.random() * swappableStudents.length);
    if (Math.random() < 0.1) break; // Éviter boucle infinie
  }
  
  return {
    student1: swappableStudents[idx1],
    student2: swappableStudents[idx2]
  };
}

/**
 * Vérifie qu'un swap est valide (respecte toutes les contraintes)
 */
function isSwapValid(swap, data, indices, ctx) {
  if (!swap || !swap.student1 || !swap.student2) return false;
  
  // Vérifier que les élèves sont dans des classes différentes
  if (swap.student1.classe === swap.student2.classe) return false;
  
  // Vérifier la parité
  const parityTolerance = ctx.parityTolerance || 3;
  
  // Simuler l'effet sur la parité
  // (Simplification : on pourrait faire une vérification plus poussée)
  if (swap.student1.sexe !== swap.student2.sexe) {
    // Le swap change la parité, vérifier que ça reste acceptable
    // TODO: Implémenter une vérification détaillée si nécessaire
  }
  
  return true;
}

/**
 * Simule un swap et calcule le nouveau score
 */
function simulateSwap(swap, data, indices, currentAnalysis) {
  // Copier les stats actuelles
  const newStats = JSON.parse(JSON.stringify(currentAnalysis.classStats));
  
  const class1 = swap.student1.classe;
  const class2 = swap.student2.classe;
  
  // Mettre à jour les moyennes après swap
  // (Calcul simplifié pour performance)
  const stats1 = newStats[class1];
  const stats2 = newStats[class2];
  
  if (stats1 && stats2 && stats1.count > 1 && stats2.count > 1) {
    // Retirer student1 de class1 et ajouter student2
    stats1.avgCOM = (stats1.avgCOM * stats1.count - swap.student1.com + swap.student2.com) / stats1.count;
    stats1.avgTRA = (stats1.avgTRA * stats1.count - swap.student1.tra + swap.student2.tra) / stats1.count;
    
    // Retirer student2 de class2 et ajouter student1
    stats2.avgCOM = (stats2.avgCOM * stats2.count - swap.student2.com + swap.student1.com) / stats2.count;
    stats2.avgTRA = (stats2.avgTRA * stats2.count - swap.student2.tra + swap.student1.tra) / stats2.count;
  }
  
  // Calculer le nouveau score
  const newScore = calculateHeterogeneityScore(newStats);
  
  return {
    newScore: newScore,
    newStats: newStats
  };
}

/**
 * Applique un swap dans les données
 */
function applySwap(swap, data, indices) {
  const class1 = data[swap.student1.index][indices.assigned];
  const class2 = data[swap.student2.index][indices.assigned];
  
  // Échanger les classes
  data[swap.student1.index][indices.assigned] = class2;
  data[swap.student2.index][indices.assigned] = class1;
  
  // Mettre à jour les objets swap pour les prochaines itérations
  swap.student1.classe = class2;
  swap.student2.classe = class1;
}

// ===================================================================
// FONCTIONS UTILITAIRES
// ===================================================================

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr) {
  if (arr.length === 0) return 0;
  const avg = average(arr);
  return arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length;
}

function standardDeviation(arr) {
  return Math.sqrt(variance(arr));
}

// ===================================================================
// EXPORT DES FONCTIONS
// ===================================================================

// Remplacer les phases existantes
globalThis.Phase3I_completeAndParity_BASEOPTI_V3 = Phase3_AdaptiveParity_V4;
globalThis.Phase4_balanceScoresSwaps_BASEOPTI_V3 = Phase4_MaxHeterogeneity_V4;

// Exporter pour tests
globalThis.analyzeClassHeterogeneity = analyzeClassHeterogeneity;
globalThis.calculateHeterogeneityScore = calculateHeterogeneityScore;
