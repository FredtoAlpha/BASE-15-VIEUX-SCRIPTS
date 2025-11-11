/**
 * ===================================================================
 * MISE À JOUR DE setStructureOptionsFromUI POUR MULTI-CONTRAINTES
 * ===================================================================
 * 
 * Cette version gère correctement l'écriture des contraintes multiples
 * dans _STRUCTURE avec le format approprié
 * 
 * Version: 3.0
 * Date: Janvier 2025
 */

/**
 * Version améliorée de setStructureOptionsFromUI avec support multi-contraintes
 * 
 * Format supporté dans _STRUCTURE :
 * - Contraintes simples : ITA=7,CHAV=6
 * - Contraintes combinées : [ITA+CHAV]=4
 * 
 * @param {Object} optionsByClass - Configuration depuis l'UI
 */
function setStructureOptionsFromUI_MultiConstraints(optionsByClass) {
  try {
    console.log('📝 setStructureOptionsFromUI_MultiConstraints appelé');
    console.log('Configuration reçue:', JSON.stringify(optionsByClass, null, 2));

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const structureSheetName = (typeof ELEVES_MODULE_CONFIG !== 'undefined' && ELEVES_MODULE_CONFIG && ELEVES_MODULE_CONFIG.STRUCTURE_SHEET)
      ? ELEVES_MODULE_CONFIG.STRUCTURE_SHEET
      : '_STRUCTURE';
    const structureSheet = ss.getSheetByName(structureSheetName);

    if (!structureSheet) {
      console.error(`⚠️ Feuille ${structureSheetName} introuvable`);
      return { success: false, error: `Feuille ${structureSheetName} introuvable` };
    }

    // ===================================================================
    // ÉTAPE 1 : ANALYSER LES ÉLÈVES POUR DÉTECTER LES MULTI-CONTRAINTES
    // ===================================================================
    
    console.log('🔍 Analyse des élèves dans TEST...');
    const testAnalysis = analyzeTestForMultiConstraints(ss);
    
    console.log('📊 Résultats de l\'analyse:');
    console.log('- Élèves avec LV2 uniquement:', testAnalysis.lv2Only);
    console.log('- Élèves avec OPT uniquement:', testAnalysis.optOnly);
    console.log('- Élèves avec LV2 ET OPT:', testAnalysis.multiConstraints);
    
    // Afficher les combinaisons détectées
    Object.entries(testAnalysis.combinations).forEach(([combo, count]) => {
      console.log(`  → ${combo}: ${count} élèves`);
    });

    // ===================================================================
    // ÉTAPE 2 : ENRICHIR LA CONFIGURATION AVEC LES MULTI-CONTRAINTES
    // ===================================================================
    
    const enrichedConfig = enrichConfigurationWithMultiConstraints(
      optionsByClass, 
      testAnalysis
    );

    // ===================================================================
    // ÉTAPE 3 : ÉCRIRE DANS _STRUCTURE
    // ===================================================================

    // Lire la feuille _STRUCTURE
    const data = structureSheet.getDataRange().getValues();
    let headerRow = -1;

    // Trouver l'en-tête
    for (let i = 0; i < Math.min(10, data.length); i++) {
      if (data[i][0] === "CLASSE_ORIGINE" && data[i][1] === "CLASSE_DEST") {
        headerRow = i;
        break;
      }
    }

    if (headerRow === -1) {
      console.error('⚠️ En-têtes non trouvés dans _STRUCTURE');
      return { success: false, error: 'En-têtes non trouvés dans _STRUCTURE' };
    }

    const headers = data[headerRow];
    const colDest = headers.indexOf("CLASSE_DEST");
    const colOptions = headers.indexOf("OPTIONS");

    if (colDest === -1 || colOptions === -1) {
      console.error('⚠️ Colonnes CLASSE_DEST ou OPTIONS non trouvées');
      return { success: false, error: 'Colonnes manquantes dans _STRUCTURE' };
    }

    // Écrire les options pour chaque classe
    let updatedCount = 0;
    const writtenConfigs = {};

    for (let i = headerRow + 1; i < data.length; i++) {
      const classeDest = String(data[i][colDest] || '').trim();
      if (!classeDest) continue;

      const classConfig = enrichedConfig[classeDest];
      if (!classConfig) continue;

      // Construire la chaîne OPTIONS avec le nouveau format
      const optionsStr = buildOptionsString(classConfig);
      
      console.log(`✍️ Classe ${classeDest}: OPTIONS="${optionsStr}"`);
      writtenConfigs[classeDest] = optionsStr;

      // Écrire dans la cellule
      structureSheet.getRange(i + 1, colOptions + 1).setValue(optionsStr);
      updatedCount++;
    }

    SpreadsheetApp.flush();
    console.log(`✅ ${updatedCount} classes mises à jour dans _STRUCTURE`);

    // ===================================================================
    // ÉTAPE 4 : VÉRIFIER LA COHÉRENCE
    // ===================================================================
    
    const validation = validateConfiguration(enrichedConfig, testAnalysis);
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Avertissements de configuration:');
      validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    return {
      success: true,
      updatedCount: updatedCount,
      writtenConfigs: writtenConfigs,
      analysis: testAnalysis,
      validation: validation
    };

  } catch (error) {
    console.error('❌ Erreur dans setStructureOptionsFromUI_MultiConstraints:', error);
    return { 
      success: false, 
      error: error.toString(),
      stack: error.stack
    };
  }
}

/**
 * Analyse TEST pour détecter les multi-contraintes
 */
function analyzeTestForMultiConstraints(ss) {
  const testSheet = ss.getSheetByName('TEST');
  if (!testSheet) {
    throw new Error('Feuille TEST introuvable');
  }

  const data = testSheet.getDataRange().getValues();
  const headers = data[0];
  
  const idxLV2 = headers.indexOf('LV2');
  const idxOPT = headers.indexOf('OPT');
  
  const analysis = {
    total: 0,
    lv2Only: 0,
    optOnly: 0,
    multiConstraints: 0,
    combinations: {},
    byConstraint: {
      LV2: {},
      OPT: {}
    }
  };

  // Analyser chaque élève
  for (let i = 1; i < data.length; i++) {
    const lv2 = normalizeValue(data[i][idxLV2]);
    const opt = normalizeValue(data[i][idxOPT]);
    
    if (!lv2 && !opt) continue;
    
    analysis.total++;
    
    // Compter par type
    if (lv2 && !opt) {
      analysis.lv2Only++;
      analysis.byConstraint.LV2[lv2] = (analysis.byConstraint.LV2[lv2] || 0) + 1;
    } else if (!lv2 && opt) {
      analysis.optOnly++;
      analysis.byConstraint.OPT[opt] = (analysis.byConstraint.OPT[opt] || 0) + 1;
    } else if (lv2 && opt) {
      analysis.multiConstraints++;
      analysis.byConstraint.LV2[lv2] = (analysis.byConstraint.LV2[lv2] || 0) + 1;
      analysis.byConstraint.OPT[opt] = (analysis.byConstraint.OPT[opt] || 0) + 1;
      
      // Compter les combinaisons
      const combo = `${lv2}+${opt}`;
      analysis.combinations[combo] = (analysis.combinations[combo] || 0) + 1;
    }
  }
  
  return analysis;
}

/**
 * Normalise une valeur (CHAV 2 → CHAV, etc.)
 */
function normalizeValue(value) {
  if (!value) return '';
  
  const str = String(value).trim().toUpperCase();
  
  // Normaliser CHAV
  if (str.startsWith('CHAV')) return 'CHAV';
  
  // Normaliser LATIN
  if (str === 'LAT' || str === 'LATIN') return 'LATIN';
  
  // Normaliser GREC
  if (str === 'GRE' || str === 'GREC') return 'GREC';
  
  return str;
}

/**
 * Enrichit la configuration avec les multi-contraintes détectées
 */
function enrichConfigurationWithMultiConstraints(originalConfig, analysis) {
  const enrichedConfig = JSON.parse(JSON.stringify(originalConfig));
  
  // Si aucune multi-contrainte détectée, retourner la config originale
  if (Object.keys(analysis.combinations).length === 0) {
    console.log('ℹ️ Aucune multi-contrainte détectée');
    return enrichedConfig;
  }
  
  console.log('🔄 Enrichissement de la configuration...');
  
  // Pour chaque combinaison détectée
  Object.entries(analysis.combinations).forEach(([combo, count]) => {
    const [lv2, opt] = combo.split('+');
    
    console.log(`\n📍 Traitement de ${combo} (${count} élèves):`);
    
    // Trouver la meilleure allocation
    const allocation = findBestAllocationForCombo(
      lv2, 
      opt, 
      count, 
      enrichedConfig,
      analysis
    );
    
    if (allocation.success) {
      console.log(`  ✅ Allocation réussie:`);
      allocation.assignments.forEach(assignment => {
        const classe = assignment.classe;
        const nombre = assignment.count;
        
        // Ajouter la contrainte combinée
        if (!enrichedConfig[classe].COMBINED) {
          enrichedConfig[classe].COMBINED = {};
        }
        enrichedConfig[classe].COMBINED[combo] = nombre;
        
        // Ajuster les quotas simples
        if (enrichedConfig[classe].LV2 && enrichedConfig[classe].LV2[lv2]) {
          enrichedConfig[classe].LV2[lv2] -= nombre;
          if (enrichedConfig[classe].LV2[lv2] <= 0) {
            delete enrichedConfig[classe].LV2[lv2];
          }
        }
        
        if (enrichedConfig[classe].OPT && enrichedConfig[classe].OPT[opt]) {
          enrichedConfig[classe].OPT[opt] -= nombre;
          if (enrichedConfig[classe].OPT[opt] <= 0) {
            delete enrichedConfig[classe].OPT[opt];
          }
        }
        
        console.log(`    - ${classe}: ${nombre} élèves`);
      });
    } else {
      console.warn(`  ⚠️ Allocation échouée: ${allocation.reason}`);
    }
  });
  
  return enrichedConfig;
}

/**
 * Trouve la meilleure allocation pour une combinaison de contraintes
 */
function findBestAllocationForCombo(lv2, opt, count, config, analysis) {
  const possibleClasses = [];
  
  // Identifier les classes qui peuvent accueillir cette combinaison
  Object.entries(config).forEach(([classe, classConfig]) => {
    const hasLV2 = classConfig.LV2 && classConfig.LV2[lv2] && classConfig.LV2[lv2] > 0;
    const hasOPT = classConfig.OPT && classConfig.OPT[opt] && classConfig.OPT[opt] > 0;
    
    if (hasLV2 && hasOPT) {
      const capacity = Math.min(classConfig.LV2[lv2], classConfig.OPT[opt]);
      possibleClasses.push({
        classe: classe,
        capacity: capacity,
        lv2Quota: classConfig.LV2[lv2],
        optQuota: classConfig.OPT[opt]
      });
    }
  });
  
  if (possibleClasses.length === 0) {
    return {
      success: false,
      reason: `Aucune classe ne peut accueillir ${lv2}+${opt}`
    };
  }
  
  // Trier par capacité décroissante
  possibleClasses.sort((a, b) => b.capacity - a.capacity);
  
  // Allouer les élèves
  const assignments = [];
  let remaining = count;
  
  for (const classInfo of possibleClasses) {
    if (remaining <= 0) break;
    
    const toAssign = Math.min(remaining, classInfo.capacity);
    assignments.push({
      classe: classInfo.classe,
      count: toAssign
    });
    
    remaining -= toAssign;
  }
  
  if (remaining > 0) {
    return {
      success: false,
      reason: `Capacité insuffisante: ${remaining} élèves ${lv2}+${opt} non placés`
    };
  }
  
  return {
    success: true,
    assignments: assignments
  };
}

/**
 * Construit la chaîne OPTIONS pour _STRUCTURE
 */
function buildOptionsString(classConfig) {
  const parts = [];
  
  // Ajouter les contraintes combinées en premier
  if (classConfig.COMBINED) {
    Object.entries(classConfig.COMBINED).forEach(([combo, count]) => {
      if (count > 0) {
        parts.push(`[${combo}]=${count}`);
      }
    });
  }
  
  // Ajouter les LV2 simples
  if (classConfig.LV2) {
    Object.entries(classConfig.LV2).forEach(([lv2, count]) => {
      if (count > 0) {
        parts.push(`${lv2}=${count}`);
      }
    });
  }
  
  // Ajouter les OPT simples
  if (classConfig.OPT) {
    Object.entries(classConfig.OPT).forEach(([opt, count]) => {
      if (count > 0) {
        parts.push(`${opt}=${count}`);
      }
    });
  }
  
  return parts.join(',');
}

/**
 * Valide la configuration finale
 */
function validateConfiguration(config, analysis) {
  const validation = {
    valid: true,
    warnings: [],
    errors: []
  };
  
  // Calculer les totaux alloués
  const allocated = {
    LV2: {},
    OPT: {},
    combinations: {}
  };
  
  Object.values(config).forEach(classConfig => {
    // Compter les contraintes simples
    if (classConfig.LV2) {
      Object.entries(classConfig.LV2).forEach(([lv2, count]) => {
        allocated.LV2[lv2] = (allocated.LV2[lv2] || 0) + count;
      });
    }
    
    if (classConfig.OPT) {
      Object.entries(classConfig.OPT).forEach(([opt, count]) => {
        allocated.OPT[opt] = (allocated.OPT[opt] || 0) + count;
      });
    }
    
    // Compter les contraintes combinées
    if (classConfig.COMBINED) {
      Object.entries(classConfig.COMBINED).forEach(([combo, count]) => {
        allocated.combinations[combo] = (allocated.combinations[combo] || 0) + count;
        
        // Ajouter aussi aux totaux simples
        const [lv2, opt] = combo.split('+');
        allocated.LV2[lv2] = (allocated.LV2[lv2] || 0) + count;
        allocated.OPT[opt] = (allocated.OPT[opt] || 0) + count;
      });
    }
  });
  
  // Vérifier les totaux
  Object.entries(analysis.byConstraint.LV2).forEach(([lv2, expected]) => {
    const actual = allocated.LV2[lv2] || 0;
    if (actual < expected) {
      validation.warnings.push(
        `LV2 ${lv2}: ${actual} places allouées pour ${expected} élèves`
      );
    }
  });
  
  Object.entries(analysis.byConstraint.OPT).forEach(([opt, expected]) => {
    const actual = allocated.OPT[opt] || 0;
    if (actual < expected) {
      validation.warnings.push(
        `OPT ${opt}: ${actual} places allouées pour ${expected} élèves`
      );
    }
  });
  
  return validation;
}

// Fonction utilitaire pour tester la configuration
function testMultiConstraintsConfiguration() {
  // Configuration exemple
  const testConfig = {
    "5°1": {
      "LV2": {"ITA": 7},
      "OPT": {}
    },
    "5°2": {
      "LV2": {},
      "OPT": {"CHAV": 6}
    },
    "5°3": {
      "LV2": {"ITA": 4},
      "OPT": {"CHAV": 4}
    }
  };
  
  const result = setStructureOptionsFromUI_MultiConstraints(testConfig);
  console.log('Résultat du test:', JSON.stringify(result, null, 2));
  
  return result;
}

// Export global pour remplacement
globalThis.setStructureOptionsFromUI = setStructureOptionsFromUI_MultiConstraints;
