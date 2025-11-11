/**
 * ===================================================================
 * GESTIONNAIRE DE CONTRAINTES COMBINÉES POUR PIPELINE OPTI
 * ===================================================================
 * 
 * Ce module permet de gérer les contraintes multiples (OPT + LV2)
 * pour la répartition des élèves dans les classes.
 * 
 * FONCTIONNALITÉS :
 * - Détection automatique des combinaisons OPT/LV2
 * - Calcul des intersections entre contraintes
 * - Répartition intelligente respectant toutes les contraintes
 * - Support des contraintes simples et combinées
 * 
 * EXEMPLE D'UTILISATION :
 * - 11 élèves ITA (LV2)
 * - 10 élèves CHAV (OPT)
 * - 4 élèves ont ITA ET CHAV
 * 
 * Le système peut répartir :
 * - 7 élèves ITA seul en 5°1
 * - 6 élèves CHAV seul en 5°2
 * - 4 élèves ITA+CHAV en 5°3
 * ===================================================================
 */

// ===================================================================
// STRUCTURES DE DONNÉES
// ===================================================================

/**
 * Structure pour stocker les contraintes d'un élève
 * @typedef {Object} StudentConstraints
 * @property {string} id - ID de l'élève
 * @property {string} nom - Nom de l'élève
 * @property {string[]} lv2 - Liste des LV2 (ex: ['ITA'])
 * @property {string[]} opt - Liste des options (ex: ['CHAV'])
 * @property {string} constraintKey - Clé unique représentant la combinaison (ex: 'LV2:ITA|OPT:CHAV')
 */

/**
 * Structure pour stocker les groupes de contraintes
 * @typedef {Object} ConstraintGroup
 * @property {string} key - Clé de la contrainte (ex: 'LV2:ITA|OPT:CHAV')
 * @property {string[]} lv2 - LV2 de ce groupe
 * @property {string[]} opt - Options de ce groupe
 * @property {number} count - Nombre d'élèves dans ce groupe
 * @property {Object[]} students - Liste des élèves
 * @property {string} targetClass - Classe cible pour ce groupe
 */

// ===================================================================
// ANALYSE DES CONTRAINTES
// ===================================================================

/**
 * Analyse les contraintes de tous les élèves et crée des groupes
 * @param {Object[][]} data - Données des élèves depuis _BASEOPTI
 * @param {string[]} headers - En-têtes des colonnes
 * @returns {Object} Analyse complète avec groupes et statistiques
 */
function analyzeStudentConstraints(data, headers) {
  logLine('INFO', '🔍 Analyse des contraintes combinées...');
  
  // Indices des colonnes
  const idxId = headers.indexOf('_ID');
  const idxNom = headers.indexOf('NOM');
  const idxPrenom = headers.indexOf('PRENOM');
  const idxLV2 = headers.indexOf('LV2');
  const idxOPT = headers.indexOf('OPT');
  const idxAssigned = headers.indexOf('_CLASS_ASSIGNED');
  
  // Analyser chaque élève
  const students = [];
  const constraintGroups = {};
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // Extraire les contraintes
    const lv2List = parseConstraintField(row[idxLV2]);
    const optList = parseConstraintField(row[idxOPT]);
    
    // Créer la clé de contrainte unique
    const constraintKey = buildConstraintKey(lv2List, optList);
    
    // Créer l'objet élève
    const student = {
      index: i,
      id: row[idxId],
      nom: row[idxNom] + ' ' + row[idxPrenom],
      lv2: lv2List,
      opt: optList,
      constraintKey: constraintKey,
      currentClass: row[idxAssigned] || null
    };
    
    students.push(student);
    
    // Grouper par contrainte
    if (!constraintGroups[constraintKey]) {
      constraintGroups[constraintKey] = {
        key: constraintKey,
        lv2: lv2List,
        opt: optList,
        count: 0,
        students: [],
        targetClass: null
      };
    }
    
    constraintGroups[constraintKey].count++;
    constraintGroups[constraintKey].students.push(student);
  }
  
  // Calculer les statistiques
  const stats = calculateConstraintStats(constraintGroups);
  
  logLine('INFO', '  ✅ ' + students.length + ' élèves analysés');
  logLine('INFO', '  ✅ ' + Object.keys(constraintGroups).length + ' groupes de contraintes identifiés');
  
  // Afficher les groupes
  for (const key in constraintGroups) {
    const group = constraintGroups[key];
    logLine('INFO', '  📊 ' + key + ' : ' + group.count + ' élèves');
  }
  
  return {
    students: students,
    constraintGroups: constraintGroups,
    stats: stats
  };
}

/**
 * Parse un champ de contrainte (peut contenir plusieurs valeurs séparées par virgule)
 * @param {string} field - Valeur du champ (ex: 'ITA,ESP' ou 'CHAV')
 * @returns {string[]} Liste des contraintes
 */
function parseConstraintField(field) {
  if (!field) return [];
  
  const str = String(field).trim().toUpperCase();
  if (!str) return [];
  
  // Gérer les séparateurs multiples
  return str.split(/[,;|]/)
    .map(function(s) { return s.trim(); })
    .filter(function(s) { return s.length > 0; });
}

/**
 * Construit une clé unique pour une combinaison de contraintes
 * @param {string[]} lv2List - Liste des LV2
 * @param {string[]} optList - Liste des options
 * @returns {string} Clé unique (ex: 'LV2:ITA|OPT:CHAV')
 */
function buildConstraintKey(lv2List, optList) {
  const parts = [];
  
  if (lv2List.length > 0) {
    parts.push('LV2:' + lv2List.sort().join(','));
  }
  
  if (optList.length > 0) {
    parts.push('OPT:' + optList.sort().join(','));
  }
  
  return parts.length > 0 ? parts.join('|') : 'NONE';
}

/**
 * Calcule les statistiques sur les contraintes
 * @param {Object} constraintGroups - Groupes de contraintes
 * @returns {Object} Statistiques détaillées
 */
function calculateConstraintStats(constraintGroups) {
  const stats = {
    totalStudents: 0,
    lv2Count: {},
    optCount: {},
    combinedCount: 0,
    simpleCount: 0
  };
  
  for (const key in constraintGroups) {
    const group = constraintGroups[key];
    stats.totalStudents += group.count;
    
    // Compter les LV2
    group.lv2.forEach(function(lv2) {
      stats.lv2Count[lv2] = (stats.lv2Count[lv2] || 0) + group.count;
    });
    
    // Compter les OPT
    group.opt.forEach(function(opt) {
      stats.optCount[opt] = (stats.optCount[opt] || 0) + group.count;
    });
    
    // Identifier contraintes simples vs combinées
    if (group.lv2.length > 0 && group.opt.length > 0) {
      stats.combinedCount += group.count;
    } else {
      stats.simpleCount += group.count;
    }
  }
  
  return stats;
}

// ===================================================================
// ASSIGNATION DES CONTRAINTES
// ===================================================================

/**
 * Assigne les groupes de contraintes aux classes selon la configuration UI
 * @param {Object} analysis - Résultat de analyzeStudentConstraints
 * @param {Object} uiConfig - Configuration depuis l'UI (quotas par classe)
 * @param {Object} ctx - Contexte d'optimisation
 * @returns {Object} Plan d'assignation
 */
function assignConstraintGroups(analysis, uiConfig, ctx) {
  logLine('INFO', '🎯 Assignation des groupes de contraintes...');
  
  const plan = {
    assignments: {},  // { className: [groupKeys] }
    unassigned: [],   // Groupes non assignés
    conflicts: []     // Conflits détectés
  };
  
  // Initialiser les classes disponibles
  const availableClasses = {};
  for (const className in uiConfig) {
    availableClasses[className] = {
      name: className,
      targetSize: ctx.targets[className] || 28,
      currentSize: 0,
      constraints: uiConfig[className],
      groups: []
    };
    plan.assignments[className] = [];
  }
  
  // Trier les groupes par priorité (combinés d'abord, puis par taille)
  const sortedGroups = Object.values(analysis.constraintGroups).sort(function(a, b) {
    // Priorité 1 : Contraintes combinées
    const aIsCombined = a.lv2.length > 0 && a.opt.length > 0;
    const bIsCombined = b.lv2.length > 0 && b.opt.length > 0;
    if (aIsCombined !== bIsCombined) {
      return aIsCombined ? -1 : 1;
    }
    
    // Priorité 2 : Taille du groupe
    return b.count - a.count;
  });
  
  // Assigner chaque groupe
  sortedGroups.forEach(function(group) {
    const assigned = tryAssignGroup(group, availableClasses, uiConfig);
    
    if (assigned) {
      plan.assignments[assigned].push(group.key);
      group.targetClass = assigned;
      logLine('INFO', '  ✅ Groupe ' + group.key + ' (' + group.count + ' élèves) → ' + assigned);
    } else {
      plan.unassigned.push(group.key);
      logLine('WARN', '  ⚠️ Groupe ' + group.key + ' (' + group.count + ' élèves) non assigné');
    }
  });
  
  // Vérifier les conflits
  plan.conflicts = detectConflicts(plan, analysis);
  
  return plan;
}

/**
 * Essaie d'assigner un groupe à une classe
 * @param {Object} group - Groupe de contraintes
 * @param {Object} availableClasses - Classes disponibles
 * @param {Object} uiConfig - Configuration UI
 * @returns {string|null} Nom de la classe assignée ou null
 */
function tryAssignGroup(group, availableClasses, uiConfig) {
  // Chercher une classe qui accepte toutes les contraintes du groupe
  for (const className in availableClasses) {
    const classInfo = availableClasses[className];
    const classConstraints = uiConfig[className] || {};
    
    // Vérifier si la classe a de la place
    if (classInfo.currentSize + group.count > classInfo.targetSize) {
      continue;
    }
    
    // Vérifier si la classe accepte les LV2 du groupe
    let lv2Match = true;
    if (group.lv2.length > 0) {
      lv2Match = group.lv2.every(function(lv2) {
        return classConstraints[lv2] && classConstraints[lv2] > 0;
      });
    }
    
    // Vérifier si la classe accepte les OPT du groupe
    let optMatch = true;
    if (group.opt.length > 0) {
      optMatch = group.opt.every(function(opt) {
        return classConstraints[opt] && classConstraints[opt] > 0;
      });
    }
    
    // Si toutes les contraintes correspondent
    if (lv2Match && optMatch) {
      // Mettre à jour les compteurs
      classInfo.currentSize += group.count;
      classInfo.groups.push(group);
      
      // Décrémenter les quotas
      group.lv2.forEach(function(lv2) {
        if (classConstraints[lv2]) {
          classConstraints[lv2] -= group.count;
        }
      });
      
      group.opt.forEach(function(opt) {
        if (classConstraints[opt]) {
          classConstraints[opt] -= group.count;
        }
      });
      
      return className;
    }
  }
  
  return null;
}

/**
 * Détecte les conflits dans le plan d'assignation
 * @param {Object} plan - Plan d'assignation
 * @param {Object} analysis - Analyse des contraintes
 * @returns {Array} Liste des conflits
 */
function detectConflicts(plan, analysis) {
  const conflicts = [];
  
  // Vérifier les groupes non assignés
  plan.unassigned.forEach(function(groupKey) {
    const group = analysis.constraintGroups[groupKey];
    conflicts.push({
      type: 'UNASSIGNED',
      message: 'Groupe ' + groupKey + ' (' + group.count + ' élèves) non assigné',
      group: group
    });
  });
  
  // TODO: Ajouter d'autres types de conflits (surcharge, quotas dépassés, etc.)
  
  return conflicts;
}

// ===================================================================
// APPLICATION DES ASSIGNATIONS
// ===================================================================

/**
 * Applique le plan d'assignation dans _BASEOPTI
 * @param {Object} plan - Plan d'assignation
 * @param {Object} analysis - Analyse des contraintes
 * @param {Object} ctx - Contexte d'optimisation
 * @returns {Object} Résultat de l'application
 */
function applyConstraintAssignments(plan, analysis, ctx) {
  logLine('INFO', '✍️ Application des assignations de contraintes...');
  
  const ss = ctx.ss || SpreadsheetApp.getActive();
  const baseSheet = ss.getSheetByName('_BASEOPTI');
  const data = baseSheet.getDataRange().getValues();
  const headers = data[0];
  
  const idxAssigned = headers.indexOf('_CLASS_ASSIGNED');
  let updatedCount = 0;
  
  // Appliquer les assignations pour chaque groupe
  for (const groupKey in analysis.constraintGroups) {
    const group = analysis.constraintGroups[groupKey];
    
    if (group.targetClass) {
      // Assigner tous les élèves du groupe
      group.students.forEach(function(student) {
        const rowIndex = student.index;
        const currentClass = data[rowIndex][idxAssigned];
        
        if (currentClass !== group.targetClass) {
          data[rowIndex][idxAssigned] = group.targetClass;
          updatedCount++;
          logLine('INFO', '  ✅ ' + student.nom + ' → ' + group.targetClass + ' (contraintes: ' + groupKey + ')');
        }
      });
    }
  }
  
  // Écrire les mises à jour
  if (updatedCount > 0) {
    const range = baseSheet.getRange(1, 1, data.length, headers.length);
    range.setValues(data);
    SpreadsheetApp.flush();
    logLine('INFO', '✅ ' + updatedCount + ' élèves mis à jour avec contraintes combinées');
  } else {
    logLine('INFO', 'ℹ️ Aucune mise à jour nécessaire');
  }
  
  return {
    success: true,
    updatedCount: updatedCount,
    plan: plan
  };
}

// ===================================================================
// INTÉGRATION AVEC LE PIPELINE
// ===================================================================

/**
 * Phase 1 améliorée avec gestion des contraintes combinées
 * @param {Object} ctx - Contexte d'optimisation
 * @returns {Object} Résultat de la phase
 */
function Phase1_CombinedConstraints(ctx) {
  logLine('INFO', '='.repeat(80));
  logLine('INFO', '📌 PHASE 1 AMÉLIORÉE - Options & LV2 avec contraintes combinées');
  logLine('INFO', '='.repeat(80));
  
  const ss = ctx.ss || SpreadsheetApp.getActive();
  const baseSheet = ss.getSheetByName('_BASEOPTI');
  
  if (!baseSheet) {
    throw new Error('_BASEOPTI introuvable');
  }
  
  // Analyser les contraintes
  const data = baseSheet.getDataRange().getValues();
  const headers = data[0];
  const analysis = analyzeStudentConstraints(data, headers);
  
  // Récupérer la configuration UI
  const uiConfig = getUIConstraintsConfig(ctx);
  
  // Créer le plan d'assignation
  const plan = assignConstraintGroups(analysis, uiConfig, ctx);
  
  // Afficher le plan
  logLine('INFO', '\n📋 PLAN D\'ASSIGNATION :');
  for (const className in plan.assignments) {
    const groups = plan.assignments[className];
    if (groups.length > 0) {
      logLine('INFO', '  🏫 ' + className + ' : ' + groups.length + ' groupes');
      groups.forEach(function(groupKey) {
        const group = analysis.constraintGroups[groupKey];
        logLine('INFO', '    - ' + groupKey + ' : ' + group.count + ' élèves');
      });
    }
  }
  
  // Afficher les conflits
  if (plan.conflicts.length > 0) {
    logLine('WARN', '\n⚠️ CONFLITS DÉTECTÉS :');
    plan.conflicts.forEach(function(conflict) {
      logLine('WARN', '  - ' + conflict.message);
    });
  }
  
  // Appliquer les assignations
  const result = applyConstraintAssignments(plan, analysis, ctx);
  
  return {
    ok: result.success,
    phase: 'PHASE1_COMBINED',
    assigned: result.updatedCount,
    groups: Object.keys(analysis.constraintGroups).length,
    conflicts: plan.conflicts.length
  };
}

/**
 * Récupère la configuration des contraintes depuis l'UI
 * @param {Object} ctx - Contexte d'optimisation
 * @returns {Object} Configuration des contraintes par classe
 */
function getUIConstraintsConfig(ctx) {
  // Lire depuis _STRUCTURE ou utiliser ctx.quotas
  const ss = ctx.ss || SpreadsheetApp.getActive();
  const structureSheet = ss.getSheetByName('_STRUCTURE');
  
  if (!structureSheet) {
    logLine('WARN', '⚠️ _STRUCTURE introuvable, utilisation des quotas du contexte');
    return ctx.quotas || {};
  }
  
  const data = structureSheet.getDataRange().getValues();
  const config = {};
  
  // Trouver les colonnes
  let headerRow = -1;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    if (data[i][0] === "CLASSE_ORIGINE") {
      headerRow = i;
      break;
    }
  }
  
  if (headerRow === -1) return {};
  
  const headers = data[headerRow];
  const idxDest = headers.indexOf('CLASSE_DEST');
  const idxOptions = headers.indexOf('OPTIONS');
  
  // Lire les contraintes pour chaque classe
  for (let i = headerRow + 1; i < data.length; i++) {
    const className = data[i][idxDest];
    const optionsStr = data[i][idxOptions];
    
    if (className && optionsStr) {
      config[className] = {};
      
      // Parser les options (format: "ITA=6,CHAV=7,LATIN=3")
      const pairs = optionsStr.split(',');
      pairs.forEach(function(pair) {
        const parts = pair.trim().split('=');
        if (parts.length === 2) {
          const option = parts[0].trim();
          const count = parseInt(parts[1].trim()) || 0;
          config[className][option] = count;
        }
      });
    }
  }
  
  logLine('INFO', '📋 Configuration des contraintes lue depuis _STRUCTURE');
  
  return config;
}

// ===================================================================
// UTILITAIRES DE VISUALISATION
// ===================================================================

/**
 * Génère un rapport visuel des contraintes
 * @param {Object} analysis - Analyse des contraintes
 * @param {Object} plan - Plan d'assignation
 * @returns {string} Rapport formaté
 */
function generateConstraintsReport(analysis, plan) {
  const lines = [];
  
  lines.push('RAPPORT DES CONTRAINTES COMBINÉES');
  lines.push('='.repeat(50));
  lines.push('');
  
  // Statistiques globales
  lines.push('STATISTIQUES GLOBALES :');
  lines.push('- Total élèves : ' + analysis.stats.totalStudents);
  lines.push('- Contraintes simples : ' + analysis.stats.simpleCount);
  lines.push('- Contraintes combinées : ' + analysis.stats.combinedCount);
  lines.push('');
  
  // Détail par LV2
  lines.push('RÉPARTITION LV2 :');
  for (const lv2 in analysis.stats.lv2Count) {
    lines.push('- ' + lv2 + ' : ' + analysis.stats.lv2Count[lv2] + ' élèves');
  }
  lines.push('');
  
  // Détail par OPT
  lines.push('RÉPARTITION OPTIONS :');
  for (const opt in analysis.stats.optCount) {
    lines.push('- ' + opt + ' : ' + analysis.stats.optCount[opt] + ' élèves');
  }
  lines.push('');
  
  // Plan d'assignation
  lines.push('PLAN D\'ASSIGNATION :');
  for (const className in plan.assignments) {
    const groups = plan.assignments[className];
    if (groups.length > 0) {
      lines.push('');
      lines.push(className + ' :');
      groups.forEach(function(groupKey) {
        const group = analysis.constraintGroups[groupKey];
        lines.push('  - ' + groupKey + ' : ' + group.count + ' élèves');
      });
    }
  }
  
  // Conflits
  if (plan.conflicts.length > 0) {
    lines.push('');
    lines.push('CONFLITS :');
    plan.conflicts.forEach(function(conflict) {
      lines.push('- ' + conflict.message);
    });
  }
  
  return lines.join('\n');
}

// ===================================================================
// EXPORT DES FONCTIONS
// ===================================================================

// Ces fonctions sont disponibles pour être appelées depuis d'autres scripts
globalThis.analyzeStudentConstraints = analyzeStudentConstraints;
globalThis.assignConstraintGroups = assignConstraintGroups;
globalThis.applyConstraintAssignments = applyConstraintAssignments;
globalThis.Phase1_CombinedConstraints = Phase1_CombinedConstraints;
globalThis.generateConstraintsReport = generateConstraintsReport;
