/**
 * ===================================================================
 * MISE À JOUR DE setStructureOptionsFromUI POUR CONTRAINTES COMBINÉES
 * ===================================================================
 * 
 * Cette version améliorée permet de gérer :
 * - Les contraintes simples (LV2 seule ou OPT seule)
 * - Les contraintes combinées (LV2 + OPT)
 * - La détection automatique des intersections
 * - L'allocation intelligente des élèves
 * 
 * À INTÉGRER dans Code.gs en remplacement de la fonction actuelle
 * ===================================================================
 */

/**
 * Met à jour _STRUCTURE avec les options depuis l'UI
 * VERSION AMÉLIORÉE avec gestion des contraintes combinées
 * 
 * @param {Object} optionsByClass - Configuration des options par classe
 * Format attendu :
 * {
 *   "5°1": {
 *     "LV2": {"ITA": 7},
 *     "OPT": {},
 *     "COMBINED": {"ITA+CHAV": 0}  // Nouveau : contraintes combinées
 *   },
 *   "5°2": {
 *     "LV2": {},
 *     "OPT": {"CHAV": 6},
 *     "COMBINED": {}
 *   },
 *   "5°3": {
 *     "LV2": {},
 *     "OPT": {},
 *     "COMBINED": {"ITA+CHAV": 4}
 *   }
 * }
 */
function setStructureOptionsFromUI_Enhanced(optionsByClass) {
  try {
    console.log('📝 setStructureOptionsFromUI_Enhanced appelé avec:', JSON.stringify(optionsByClass));

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const structureSheet = ss.getSheetByName('_STRUCTURE');

    if (!structureSheet) {
      console.error('⚠️ Feuille _STRUCTURE introuvable');
      return { success: false, error: 'Feuille _STRUCTURE introuvable' };
    }

    // Analyser les contraintes avant d'écrire
    const constraintAnalysis = analyzeConstraintsFromUI(optionsByClass);
    console.log('🔍 Analyse des contraintes:', JSON.stringify(constraintAnalysis));

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
    for (let i = headerRow + 1; i < data.length; i++) {
      const classeDest = String(data[i][colDest] || '').trim();
      if (!classeDest) continue;

      const classConfig = optionsByClass[classeDest];
      if (!classConfig) continue;

      // Construire la chaîne OPTIONS avec support des contraintes combinées
      const optionPairs = [];

      // 1. Ajouter les LV2 simples
      if (classConfig.LV2 && typeof classConfig.LV2 === 'object') {
        Object.keys(classConfig.LV2).forEach(lv2 => {
          const quota = classConfig.LV2[lv2];
          if (quota > 0) {
            optionPairs.push(`${lv2}=${quota}`);
          }
        });
      }

      // 2. Ajouter les OPT simples
      if (classConfig.OPT && typeof classConfig.OPT === 'object') {
        Object.keys(classConfig.OPT).forEach(opt => {
          const quota = classConfig.OPT[opt];
          if (quota > 0) {
            optionPairs.push(`${opt}=${quota}`);
          }
        });
      }

      // 3. NOUVEAU : Ajouter les contraintes combinées
      if (classConfig.COMBINED && typeof classConfig.COMBINED === 'object') {
        Object.keys(classConfig.COMBINED).forEach(combined => {
          const quota = classConfig.COMBINED[combined];
          if (quota > 0) {
            // Format spécial pour les contraintes combinées
            optionPairs.push(`[${combined}]=${quota}`);
          }
        });
      }

      const optionsStr = optionPairs.join(',');
      console.log(`✍️ Classe ${classeDest}: OPTIONS="${optionsStr}"`);

      // Écrire dans la cellule
      structureSheet.getRange(i + 1, colOptions + 1).setValue(optionsStr);
      updatedCount++;
    }

    SpreadsheetApp.flush();
    console.log(`✅ ${updatedCount} classes mises à jour dans _STRUCTURE`);

    return {
      success: true,
      updatedCount: updatedCount,
      analysis: constraintAnalysis
    };

  } catch (error) {
    console.error('❌ Erreur dans setStructureOptionsFromUI_Enhanced:', error);
    return { 
      success: false, 
      error: error.toString() 
    };
  }
}

/**
 * Analyse les contraintes depuis la configuration UI
 * Détecte automatiquement les intersections et propose des allocations
 * 
 * @param {Object} optionsByClass - Configuration des options
 * @returns {Object} Analyse détaillée des contraintes
 */
function analyzeConstraintsFromUI(optionsByClass) {
  const analysis = {
    totalConstraints: {},
    intersections: {},
    suggestions: []
  };

  // 1. Collecter toutes les contraintes
  const allLV2 = {};
  const allOPT = {};

  Object.keys(optionsByClass).forEach(className => {
    const config = optionsByClass[className];
    
    // Collecter LV2
    if (config.LV2) {
      Object.keys(config.LV2).forEach(lv2 => {
        allLV2[lv2] = (allLV2[lv2] || 0) + (config.LV2[lv2] || 0);
      });
    }
    
    // Collecter OPT
    if (config.OPT) {
      Object.keys(config.OPT).forEach(opt => {
        allOPT[opt] = (allOPT[opt] || 0) + (config.OPT[opt] || 0);
      });
    }
  });

  analysis.totalConstraints = {
    LV2: allLV2,
    OPT: allOPT
  };

  // 2. Détecter les intersections possibles
  Object.keys(allLV2).forEach(lv2 => {
    Object.keys(allOPT).forEach(opt => {
      const key = `${lv2}+${opt}`;
      
      // Vérifier si cette combinaison est utilisée
      let combinedCount = 0;
      Object.values(optionsByClass).forEach(config => {
        if (config.COMBINED && config.COMBINED[key]) {
          combinedCount += config.COMBINED[key];
        }
      });

      if (combinedCount > 0) {
        analysis.intersections[key] = {
          count: combinedCount,
          lv2: lv2,
          opt: opt,
          percentage: Math.round((combinedCount / Math.min(allLV2[lv2], allOPT[opt])) * 100)
        };
      }
    });
  });

  // 3. Générer des suggestions d'allocation
  if (Object.keys(analysis.intersections).length > 0) {
    analysis.suggestions.push({
      type: 'INFO',
      message: 'Des élèves avec contraintes multiples ont été détectés'
    });

    Object.keys(analysis.intersections).forEach(key => {
      const inter = analysis.intersections[key];
      analysis.suggestions.push({
        type: 'COMBINED',
        message: `${inter.count} élèves ont ${inter.lv2} ET ${inter.opt} (${inter.percentage}% d'intersection)`
      });
    });
  }

  return analysis;
}

/**
 * Convertit la configuration UI en format avec détection automatique des intersections
 * Cette fonction peut être appelée depuis l'UI pour préparer les données
 * 
 * @param {Object} simpleConfig - Configuration simple depuis l'UI
 * @param {Object} studentData - Données des élèves pour détecter les intersections
 * @returns {Object} Configuration enrichie avec contraintes combinées
 */
function enrichConfigWithCombinedConstraints(simpleConfig, studentData) {
  console.log('🔄 Enrichissement de la configuration avec contraintes combinées...');

  // Analyser les élèves pour détecter les combinaisons
  const combinations = {};
  
  studentData.forEach(student => {
    if (student.LV2 && student.OPT) {
      const key = `${student.LV2}+${student.OPT}`;
      combinations[key] = (combinations[key] || 0) + 1;
    }
  });

  // Pour chaque classe, suggérer une allocation
  const enrichedConfig = JSON.parse(JSON.stringify(simpleConfig)); // Deep copy

  // Exemple d'allocation intelligente
  // Cette logique peut être adaptée selon vos besoins spécifiques
  Object.keys(combinations).forEach(comboKey => {
    const count = combinations[comboKey];
    
    // Trouver la meilleure classe pour cette combinaison
    // (Cette logique est simplifiée, vous pouvez l'améliorer)
    let bestClass = null;
    let bestScore = -1;

    Object.keys(enrichedConfig).forEach(className => {
      const config = enrichedConfig[className];
      const [lv2, opt] = comboKey.split('+');
      
      // Score basé sur la disponibilité des contraintes
      const lv2Available = (config.LV2 && config.LV2[lv2]) || 0;
      const optAvailable = (config.OPT && config.OPT[opt]) || 0;
      const score = Math.min(lv2Available, optAvailable);

      if (score > bestScore) {
        bestScore = score;
        bestClass = className;
      }
    });

    // Allouer à la meilleure classe
    if (bestClass && bestScore > 0) {
      if (!enrichedConfig[bestClass].COMBINED) {
        enrichedConfig[bestClass].COMBINED = {};
      }
      enrichedConfig[bestClass].COMBINED[comboKey] = Math.min(count, bestScore);
    }
  });

  console.log('✅ Configuration enrichie:', JSON.stringify(enrichedConfig));
  return enrichedConfig;
}

/**
 * Fonction utilitaire pour parser le champ OPTIONS avec support des contraintes combinées
 * Format supporté : "ITA=7,CHAV=6,[ITA+CHAV]=4"
 * 
 * @param {string} optionsStr - Chaîne d'options depuis _STRUCTURE
 * @returns {Object} Options parsées avec contraintes simples et combinées
 */
function parseOptionsWithCombined(optionsStr) {
  const result = {
    simple: {},
    combined: {}
  };

  if (!optionsStr) return result;

  const parts = optionsStr.split(',');
  
  parts.forEach(part => {
    const trimmed = part.trim();
    
    // Contrainte combinée : [ITA+CHAV]=4
    if (trimmed.startsWith('[') && trimmed.includes(']')) {
      const match = trimmed.match(/\[([^\]]+)\]=(\d+)/);
      if (match) {
        result.combined[match[1]] = parseInt(match[2]) || 0;
      }
    } 
    // Contrainte simple : ITA=7
    else {
      const [key, value] = trimmed.split('=');
      if (key && value) {
        result.simple[key.trim()] = parseInt(value.trim()) || 0;
      }
    }
  });

  return result;
}

/**
 * Fonction d'aide pour l'UI : calcule les statistiques des contraintes
 * 
 * @returns {Object} Statistiques sur les contraintes dans TEST
 */
function getConstraintStatistics() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const testSheet = ss.getSheetByName('TEST');
  
  if (!testSheet) {
    return { error: 'Feuille TEST introuvable' };
  }

  const data = testSheet.getDataRange().getValues();
  const headers = data[0];
  
  const idxLV2 = headers.indexOf('LV2');
  const idxOPT = headers.indexOf('OPT');
  
  const stats = {
    total: data.length - 1,
    lv2Count: {},
    optCount: {},
    combinations: {},
    distribution: []
  };

  // Analyser chaque élève
  for (let i = 1; i < data.length; i++) {
    const lv2 = String(data[i][idxLV2] || '').trim().toUpperCase();
    const opt = String(data[i][idxOPT] || '').trim().toUpperCase();

    // Compter LV2
    if (lv2) {
      stats.lv2Count[lv2] = (stats.lv2Count[lv2] || 0) + 1;
    }

    // Compter OPT
    if (opt) {
      stats.optCount[opt] = (stats.optCount[opt] || 0) + 1;
    }

    // Compter combinaisons
    if (lv2 && opt) {
      const combo = `${lv2}+${opt}`;
      stats.combinations[combo] = (stats.combinations[combo] || 0) + 1;
    }
  }

  // Calculer la distribution recommandée
  // (Cette logique peut être personnalisée selon vos règles métier)
  stats.distribution = calculateOptimalDistribution(stats);

  return stats;
}

/**
 * Calcule une distribution optimale des élèves
 * (À personnaliser selon vos règles métier)
 * 
 * @param {Object} stats - Statistiques des contraintes
 * @returns {Array} Distribution recommandée
 */
function calculateOptimalDistribution(stats) {
  // Exemple de logique simple
  // Vous pouvez la personnaliser selon vos besoins
  
  const distribution = [];
  const targetClassSize = 28; // Taille cible par classe
  
  // Gérer d'abord les combinaisons
  Object.keys(stats.combinations).forEach(combo => {
    const count = stats.combinations[combo];
    const [lv2, opt] = combo.split('+');
    
    distribution.push({
      type: 'COMBINED',
      constraints: { LV2: lv2, OPT: opt },
      count: count,
      suggestedClass: `Classe ${distribution.length + 1}`
    });
  });

  // Puis les contraintes simples
  // ... (logique à développer selon vos besoins)

  return distribution;
}

// Export des fonctions pour utilisation globale
globalThis.setStructureOptionsFromUI_Enhanced = setStructureOptionsFromUI_Enhanced;
globalThis.analyzeConstraintsFromUI = analyzeConstraintsFromUI;
globalThis.enrichConfigWithCombinedConstraints = enrichConfigWithCombinedConstraints;
globalThis.parseOptionsWithCombined = parseOptionsWithCombined;
globalThis.getConstraintStatistics = getConstraintStatistics;
