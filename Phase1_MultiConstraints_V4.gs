/**
 * ===================================================================
 * PHASE 1 AMÉLIORÉE : GESTION DES CONTRAINTES MULTIPLES
 * ===================================================================
 * 
 * Cette version remplace Phase1I_dispatchOptionsLV2_BASEOPTI_V3
 * pour gérer correctement les élèves avec contraintes multiples
 * (ex: élève ayant ITA ET CHAV)
 * 
 * PRINCIPE FONDAMENTAL :
 * - Les élèves avec contraintes multiples sont prioritaires
 * - Ils sont placés AVANT les élèves à contrainte simple
 * - Respect strict des quotas définis dans _STRUCTURE
 * 
 * Version: 2.0
 * Date: Janvier 2025
 */

/**
 * Phase 1 V4 : Placement par contraintes avec gestion des multi-contraintes
 * 
 * @param {Object} ctx - Contexte d'optimisation
 * @returns {Object} Résultat de la phase
 */
function Phase1_MultiConstraints_V4(ctx) {
  logLine('INFO', '='.repeat(80));
  logLine('INFO', '📌 PHASE 1 V4 - Options & LV2 avec MULTI-CONTRAINTES');
  logLine('INFO', '='.repeat(80));

  const ss = ctx.ss || SpreadsheetApp.getActive();
  const baseSheet = ss.getSheetByName('_BASEOPTI');
  
  if (!baseSheet) {
    logLine('ERROR', '❌ _BASEOPTI introuvable');
    return { ok: false, error: '_BASEOPTI introuvable' };
  }

  // Lire toutes les données
  const data = baseSheet.getDataRange().getValues();
  const headers = data[0];
  
  // Indices des colonnes importantes
  const indices = {
    id: headers.indexOf('_ID'),
    nom: headers.indexOf('NOM'),
    prenom: headers.indexOf('PRENOM'),
    lv2: headers.indexOf('LV2'),
    opt: headers.indexOf('OPT'),
    assigned: headers.indexOf('_CLASS_ASSIGNED'),
    placed: headers.indexOf('_PLACED')
  };

  // ===================================================================
  // ÉTAPE 1 : ANALYSER LES ÉLÈVES ET LEURS CONTRAINTES
  // ===================================================================
  
  logLine('INFO', '🔍 Analyse des contraintes des élèves...');
  
  const students = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // Skip si déjà placé
    if (row[indices.placed] === true || row[indices.placed] === 'TRUE') {
      continue;
    }
    
    const student = {
      rowIndex: i,
      id: row[indices.id],
      nom: row[indices.nom] + ' ' + row[indices.prenom],
      lv2: normalizeConstraint(row[indices.lv2]),
      opt: normalizeConstraint(row[indices.opt]),
      constraints: []
    };
    
    // Construire la liste des contraintes
    if (student.lv2) student.constraints.push({ type: 'LV2', value: student.lv2 });
    if (student.opt) student.constraints.push({ type: 'OPT', value: student.opt });
    
    // Déterminer le niveau de priorité
    student.priority = student.constraints.length; // 2 = multi-contrainte, 1 = simple, 0 = aucune
    
    if (student.priority > 0) {
      students.push(student);
    }
  }

  logLine('INFO', `  ✅ ${students.length} élèves avec contraintes à placer`);

  // ===================================================================
  // ÉTAPE 2 : GROUPER PAR TYPE DE CONTRAINTE
  // ===================================================================
  
  const groups = groupStudentsByConstraints(students);
  logLine('INFO', '📊 Groupes de contraintes :');
  
  // Afficher les groupes
  Object.entries(groups).forEach(([key, group]) => {
    logLine('INFO', `  - ${key} : ${group.students.length} élèves`);
  });

  // ===================================================================
  // ÉTAPE 3 : LIRE LES QUOTAS DEPUIS _STRUCTURE
  // ===================================================================
  
  const quotas = readStructureQuotas(ss);
  if (!quotas.success) {
    logLine('ERROR', '❌ Erreur lecture quotas : ' + quotas.error);
    return { ok: false, error: quotas.error };
  }
  
  logLine('INFO', '📋 Quotas par classe :');
  Object.entries(quotas.data).forEach(([classe, options]) => {
    logLine('INFO', `  - ${classe} : ${JSON.stringify(options)}`);
  });

  // ===================================================================
  // ÉTAPE 4 : CALCULER LES ALLOCATIONS OPTIMALES
  // ===================================================================
  
  logLine('INFO', '\n🎯 Calcul des allocations...');
  const allocation = calculateOptimalAllocation(groups, quotas.data);
  
  if (allocation.conflicts.length > 0) {
    logLine('WARN', '⚠️ Conflits détectés :');
    allocation.conflicts.forEach(conflict => {
      logLine('WARN', `  - ${conflict}`);
    });
  }

  // ===================================================================
  // ÉTAPE 5 : APPLIQUER LES PLACEMENTS
  // ===================================================================
  
  logLine('INFO', '\n✍️ Application des placements...');
  
  const placementResults = {
    total: 0,
    byClass: {},
    byConstraint: {},
    errors: []
  };

  // Placer d'abord les multi-contraintes
  const multiConstraintGroups = Object.entries(groups)
    .filter(([key, group]) => key.includes('+'))
    .sort((a, b) => b[1].students.length - a[1].students.length);

  for (const [constraintKey, group] of multiConstraintGroups) {
    const result = placeGroupInClasses(
      group.students, 
      constraintKey, 
      allocation.assignments[constraintKey] || [],
      data, 
      indices, 
      placementResults
    );
    
    logLine('INFO', `  ✅ ${constraintKey} : ${result.placed}/${group.students.length} placés`);
  }

  // Puis placer les contraintes simples
  const simpleConstraintGroups = Object.entries(groups)
    .filter(([key, group]) => !key.includes('+'))
    .sort((a, b) => b[1].students.length - a[1].students.length);

  for (const [constraintKey, group] of simpleConstraintGroups) {
    const result = placeGroupInClasses(
      group.students, 
      constraintKey, 
      allocation.assignments[constraintKey] || [],
      data, 
      indices, 
      placementResults
    );
    
    logLine('INFO', `  ✅ ${constraintKey} : ${result.placed}/${group.students.length} placés`);
  }

  // ===================================================================
  // ÉTAPE 6 : ÉCRIRE LES MODIFICATIONS
  // ===================================================================
  
  if (placementResults.total > 0) {
    baseSheet.getRange(1, 1, data.length, headers.length).setValues(data);
    SpreadsheetApp.flush();
    logLine('INFO', `✅ ${placementResults.total} élèves placés et écrits dans _BASEOPTI`);
  }

  // Afficher le résumé par classe
  logLine('INFO', '\n📊 Résumé des placements par classe :');
  Object.entries(placementResults.byClass).forEach(([classe, count]) => {
    logLine('INFO', `  - ${classe} : ${count} élèves`);
  });

  // Retourner le résultat
  return {
    ok: true,
    assigned: placementResults.total,
    counts: placementResults.byClass,
    byConstraint: placementResults.byConstraint,
    errors: placementResults.errors
  };
}

/**
 * Normalise une contrainte (gère CHAV 2 → CHAV, etc.)
 */
function normalizeConstraint(value) {
  if (!value) return '';
  
  const str = String(value).trim().toUpperCase();
  
  // Gérer les variantes de CHAV
  if (str.startsWith('CHAV')) {
    return 'CHAV';
  }
  
  // Gérer LATIN/LAT
  if (str === 'LAT' || str === 'LATIN') {
    return 'LATIN';
  }
  
  return str;
}

/**
 * Groupe les élèves par combinaison de contraintes
 */
function groupStudentsByConstraints(students) {
  const groups = {};
  
  students.forEach(student => {
    // Construire la clé de groupe
    const keys = [];
    if (student.lv2) keys.push(`LV2:${student.lv2}`);
    if (student.opt) keys.push(`OPT:${student.opt}`);
    
    const groupKey = keys.join('+') || 'AUCUNE';
    
    if (!groups[groupKey]) {
      groups[groupKey] = {
        key: groupKey,
        lv2: student.lv2,
        opt: student.opt,
        students: []
      };
    }
    
    groups[groupKey].students.push(student);
  });
  
  return groups;
}

/**
 * Lit les quotas depuis _STRUCTURE
 */
function readStructureQuotas(ss) {
  const structureSheet = ss.getSheetByName('_STRUCTURE');
  
  if (!structureSheet) {
    return { success: false, error: '_STRUCTURE introuvable' };
  }
  
  const data = structureSheet.getDataRange().getValues();
  let headerRow = -1;
  
  // Trouver l'en-tête
  for (let i = 0; i < Math.min(10, data.length); i++) {
    if (data[i][0] === 'CLASSE_ORIGINE') {
      headerRow = i;
      break;
    }
  }
  
  if (headerRow === -1) {
    return { success: false, error: 'En-têtes non trouvés dans _STRUCTURE' };
  }
  
  const headers = data[headerRow];
  const colDest = headers.indexOf('CLASSE_DEST');
  const colOptions = headers.indexOf('OPTIONS');
  
  if (colDest === -1 || colOptions === -1) {
    return { success: false, error: 'Colonnes manquantes dans _STRUCTURE' };
  }
  
  // Lire les quotas
  const quotas = {};
  
  for (let i = headerRow + 1; i < data.length; i++) {
    const classe = data[i][colDest];
    const optionsStr = data[i][colOptions];
    
    if (!classe || !optionsStr) continue;
    
    quotas[classe] = parseOptionsString(optionsStr);
  }
  
  return { success: true, data: quotas };
}

/**
 * Parse la chaîne OPTIONS (ex: "ITA=7,CHAV=6,[ITA+CHAV]=4")
 */
function parseOptionsString(optionsStr) {
  const result = {};
  
  if (!optionsStr) return result;
  
  // Gestion des contraintes combinées entre crochets
  const combinedRegex = /\[([^\]]+)\]=(\d+)/g;
  let match;
  
  while ((match = combinedRegex.exec(optionsStr)) !== null) {
    const key = match[1].replace(/\+/g, '_'); // ITA+CHAV → ITA_CHAV
    result[key] = parseInt(match[2]) || 0;
  }
  
  // Retirer les contraintes combinées pour traiter les simples
  const cleanStr = optionsStr.replace(/\[[^\]]+\]=\d+,?/g, '');
  
  // Gestion des contraintes simples
  const pairs = cleanStr.split(',');
  pairs.forEach(pair => {
    const [key, value] = pair.trim().split('=');
    if (key && value) {
      result[key.trim()] = parseInt(value.trim()) || 0;
    }
  });
  
  return result;
}

/**
 * Calcule l'allocation optimale des groupes aux classes
 */
function calculateOptimalAllocation(groups, quotas) {
  const allocation = {
    assignments: {}, // { constraintKey: [className1, className2, ...] }
    conflicts: []
  };
  
  // Copier les quotas pour les modifier
  const availableQuotas = JSON.parse(JSON.stringify(quotas));
  
  // Traiter d'abord les multi-contraintes
  const sortedGroups = Object.entries(groups).sort((a, b) => {
    // Priorité aux multi-contraintes
    const aIsMulti = a[0].includes('+');
    const bIsMulti = b[0].includes('+');
    if (aIsMulti !== bIsMulti) return aIsMulti ? -1 : 1;
    
    // Puis par taille décroissante
    return b[1].students.length - a[1].students.length;
  });
  
  for (const [constraintKey, group] of sortedGroups) {
    const classesForGroup = findCompatibleClasses(
      group, 
      availableQuotas, 
      constraintKey
    );
    
    if (classesForGroup.length === 0) {
      allocation.conflicts.push(
        `Aucune classe compatible pour ${constraintKey} (${group.students.length} élèves)`
      );
    } else {
      allocation.assignments[constraintKey] = classesForGroup;
      
      // Mettre à jour les quotas disponibles
      updateAvailableQuotas(
        availableQuotas, 
        classesForGroup, 
        group, 
        constraintKey
      );
    }
  }
  
  return allocation;
}

/**
 * Trouve les classes compatibles pour un groupe
 */
function findCompatibleClasses(group, availableQuotas, constraintKey) {
  const compatibleClasses = [];
  const neededCount = group.students.length;
  let remainingCount = neededCount;
  
  // Pour chaque classe
  for (const [className, classQuotas] of Object.entries(availableQuotas)) {
    if (remainingCount <= 0) break;
    
    let availableInClass = 0;
    
    // Vérifier si la classe a les contraintes nécessaires
    if (constraintKey.includes('+')) {
      // Multi-contrainte (ex: LV2:ITA+OPT:CHAV)
      const parts = constraintKey.split('+');
      let hasAll = true;
      let minQuota = Infinity;
      
      parts.forEach(part => {
        const [type, value] = part.split(':');
        
        // Vérifier d'abord la contrainte combinée
        const combinedKey = constraintKey.replace(/[:\+]/g, '_'); // LV2:ITA+OPT:CHAV → LV2_ITA_OPT_CHAV
        if (classQuotas[value + '_' + parts.find(p => p !== part).split(':')[1]]) {
          minQuota = Math.min(minQuota, classQuotas[value + '_' + parts.find(p => p !== part).split(':')[1]]);
        } else if (classQuotas[value]) {
          minQuota = Math.min(minQuota, classQuotas[value]);
        } else {
          hasAll = false;
        }
      });
      
      if (hasAll && minQuota > 0) {
        availableInClass = Math.min(minQuota, remainingCount);
      }
    } else {
      // Contrainte simple
      const [type, value] = constraintKey.split(':');
      if (classQuotas[value] && classQuotas[value] > 0) {
        availableInClass = Math.min(classQuotas[value], remainingCount);
      }
    }
    
    if (availableInClass > 0) {
      compatibleClasses.push({
        className: className,
        available: availableInClass
      });
      remainingCount -= availableInClass;
    }
  }
  
  return compatibleClasses.map(c => c.className);
}

/**
 * Met à jour les quotas disponibles après allocation
 */
function updateAvailableQuotas(availableQuotas, classesForGroup, group, constraintKey) {
  let studentsToPlace = group.students.length;
  
  classesForGroup.forEach(className => {
    if (studentsToPlace <= 0) return;
    
    const classQuotas = availableQuotas[className];
    if (!classQuotas) return;
    
    // Calculer combien on peut placer dans cette classe
    let canPlace = 0;
    
    if (constraintKey.includes('+')) {
      // Multi-contrainte
      const parts = constraintKey.split('+');
      let minQuota = Infinity;
      
      parts.forEach(part => {
        const [type, value] = part.split(':');
        if (classQuotas[value]) {
          minQuota = Math.min(minQuota, classQuotas[value]);
        }
      });
      
      canPlace = Math.min(minQuota, studentsToPlace);
      
      // Décrémenter tous les quotas concernés
      parts.forEach(part => {
        const [type, value] = part.split(':');
        if (classQuotas[value]) {
          classQuotas[value] -= canPlace;
        }
      });
    } else {
      // Contrainte simple
      const [type, value] = constraintKey.split(':');
      if (classQuotas[value]) {
        canPlace = Math.min(classQuotas[value], studentsToPlace);
        classQuotas[value] -= canPlace;
      }
    }
    
    studentsToPlace -= canPlace;
  });
}

/**
 * Place un groupe d'élèves dans les classes assignées
 */
function placeGroupInClasses(students, constraintKey, assignedClasses, data, indices, results) {
  const placement = {
    placed: 0,
    errors: []
  };
  
  if (assignedClasses.length === 0) {
    placement.errors.push(`Aucune classe pour ${constraintKey}`);
    return placement;
  }
  
  let classIndex = 0;
  let studentsPerClass = Math.ceil(students.length / assignedClasses.length);
  let studentsInCurrentClass = 0;
  
  for (const student of students) {
    if (classIndex >= assignedClasses.length) {
      placement.errors.push(`Plus de classes disponibles pour ${student.nom}`);
      continue;
    }
    
    const targetClass = assignedClasses[classIndex];
    
    // Placer l'élève
    data[student.rowIndex][indices.assigned] = targetClass;
    data[student.rowIndex][indices.placed] = true;
    
    placement.placed++;
    
    // Mettre à jour les compteurs
    results.total++;
    results.byClass[targetClass] = (results.byClass[targetClass] || 0) + 1;
    results.byConstraint[constraintKey] = (results.byConstraint[constraintKey] || 0) + 1;
    
    // Passer à la classe suivante si nécessaire
    studentsInCurrentClass++;
    if (studentsInCurrentClass >= studentsPerClass && classIndex < assignedClasses.length - 1) {
      classIndex++;
      studentsInCurrentClass = 0;
    }
  }
  
  if (placement.errors.length > 0) {
    results.errors.push(...placement.errors);
  }
  
  return placement;
}

// Export de la fonction pour remplacement
globalThis.Phase1I_dispatchOptionsLV2_BASEOPTI_V3 = Phase1_MultiConstraints_V4;
