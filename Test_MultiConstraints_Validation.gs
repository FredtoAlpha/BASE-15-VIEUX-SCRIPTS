/**
 * ===================================================================
 * SCRIPT DE TEST ET VALIDATION DES MULTI-CONTRAINTES
 * ===================================================================
 * 
 * Ce script permet de tester et valider que le système de 
 * multi-contraintes fonctionne correctement de bout en bout
 * 
 * Version: 1.0
 * Date: Janvier 2025
 */

/**
 * Test complet du pipeline avec multi-contraintes
 */
function testMultiConstraintsPipeline() {
  console.log('='.repeat(80));
  console.log('🧪 TEST COMPLET DU PIPELINE MULTI-CONTRAINTES');
  console.log('='.repeat(80));
  
  try {
    // ===================================================================
    // TEST 1 : ANALYSE DES DONNÉES
    // ===================================================================
    console.log('\n📊 TEST 1: Analyse des données TEST');
    const analysisResult = testDataAnalysis();
    if (!analysisResult.success) {
      throw new Error('Échec de l\'analyse des données');
    }
    
    // ===================================================================
    // TEST 2 : ÉCRITURE DANS _STRUCTURE
    // ===================================================================
    console.log('\n✍️ TEST 2: Écriture dans _STRUCTURE');
    const writeResult = testStructureWriting();
    if (!writeResult.success) {
      throw new Error('Échec de l\'écriture dans _STRUCTURE');
    }
    
    // ===================================================================
    // TEST 3 : LECTURE ET PARSING DES QUOTAS
    // ===================================================================
    console.log('\n📖 TEST 3: Lecture des quotas');
    const readResult = testQuotaReading();
    if (!readResult.success) {
      throw new Error('Échec de la lecture des quotas');
    }
    
    // ===================================================================
    // TEST 4 : PLACEMENT DES ÉLÈVES
    // ===================================================================
    console.log('\n🎯 TEST 4: Placement des élèves');
    const placementResult = testStudentPlacement();
    if (!placementResult.success) {
      throw new Error('Échec du placement des élèves');
    }
    
    // ===================================================================
    // RÉSUMÉ
    // ===================================================================
    console.log('\n' + '='.repeat(80));
    console.log('✅ TOUS LES TESTS RÉUSSIS !');
    console.log('='.repeat(80));
    
    return {
      success: true,
      tests: {
        analysis: analysisResult,
        writing: writeResult,
        reading: readResult,
        placement: placementResult
      }
    };
    
  } catch (error) {
    console.error('\n❌ ERREUR DANS LES TESTS:', error.message);
    console.error(error.stack);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * TEST 1: Analyse des données dans TEST
 */
function testDataAnalysis() {
  console.log('  Analyse des élèves dans TEST...');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const testSheet = ss.getSheetByName('TEST');
  
  if (!testSheet) {
    return { success: false, error: 'Feuille TEST introuvable' };
  }
  
  // Créer des données de test si nécessaire
  createTestDataIfNeeded(testSheet);
  
  // Analyser
  const analysis = analyzeTestForMultiConstraints(ss);
  
  console.log('  📊 Résultats de l\'analyse:');
  console.log('    - Total élèves avec contraintes:', analysis.total);
  console.log('    - LV2 uniquement:', analysis.lv2Only);
  console.log('    - OPT uniquement:', analysis.optOnly);
  console.log('    - Multi-contraintes:', analysis.multiConstraints);
  
  if (analysis.multiConstraints === 0) {
    console.warn('  ⚠️ Aucune multi-contrainte détectée dans TEST');
    console.log('  💡 Conseil: Assurez-vous d\'avoir des élèves avec LV2 ET OPT');
  } else {
    console.log('  ✅ Multi-contraintes détectées:');
    Object.entries(analysis.combinations).forEach(([combo, count]) => {
      console.log(`    - ${combo}: ${count} élèves`);
    });
  }
  
  return {
    success: true,
    analysis: analysis
  };
}

/**
 * TEST 2: Écriture dans _STRUCTURE
 */
function testStructureWriting() {
  console.log('  Configuration de test pour _STRUCTURE...');
  
  // Configuration de test avec multi-contraintes
  const testConfig = {
    "5°1": {
      "LV2": {"ITA": 11},  // Total ITA
      "OPT": {}
    },
    "5°2": {
      "LV2": {},
      "OPT": {"CHAV": 10}  // Total CHAV
    },
    "5°3": {
      "LV2": {"ITA": 4},   // Pour accueillir ITA+CHAV
      "OPT": {"CHAV": 4}   // Pour accueillir ITA+CHAV
    }
  };
  
  console.log('  Configuration:', JSON.stringify(testConfig, null, 2));
  
  // Appeler la fonction d'écriture
  const result = setStructureOptionsFromUI_MultiConstraints(testConfig);
  
  if (result.success) {
    console.log('  ✅ Écriture réussie');
    console.log('  📝 Configurations écrites:');
    Object.entries(result.writtenConfigs || {}).forEach(([classe, options]) => {
      console.log(`    - ${classe}: ${options}`);
    });
  } else {
    console.error('  ❌ Échec de l\'écriture:', result.error);
  }
  
  return result;
}

/**
 * TEST 3: Lecture et parsing des quotas
 */
function testQuotaReading() {
  console.log('  Lecture des quotas depuis _STRUCTURE...');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const quotas = readStructureQuotas(ss);
  
  if (!quotas.success) {
    console.error('  ❌ Échec de la lecture:', quotas.error);
    return quotas;
  }
  
  console.log('  ✅ Quotas lus avec succès:');
  Object.entries(quotas.data).forEach(([classe, options]) => {
    console.log(`    - ${classe}:`, JSON.stringify(options));
    
    // Vérifier la présence de multi-contraintes
    Object.keys(options).forEach(key => {
      if (key.includes('_')) {
        console.log(`      → Multi-contrainte détectée: ${key}`);
      }
    });
  });
  
  return {
    success: true,
    quotas: quotas.data
  };
}

/**
 * TEST 4: Placement des élèves avec multi-contraintes
 */
function testStudentPlacement() {
  console.log('  Simulation du placement des élèves...');
  
  // Créer un contexte de test
  const ctx = {
    ss: SpreadsheetApp.getActiveSpreadsheet(),
    levels: ['5°1', '5°2', '5°3', '5°4', '5°5', '5°6']
  };
  
  // Préparer _BASEOPTI pour le test
  prepareBaseoptiForTest(ctx.ss);
  
  // Exécuter la Phase 1 améliorée
  const result = Phase1_MultiConstraints_V4(ctx);
  
  if (result.ok) {
    console.log('  ✅ Placement réussi');
    console.log('  📊 Résumé des placements:');
    console.log('    - Total placés:', result.assigned);
    console.log('    - Par classe:', JSON.stringify(result.counts));
    console.log('    - Par contrainte:', JSON.stringify(result.byConstraint));
    
    // Vérifier les multi-contraintes
    Object.entries(result.byConstraint || {}).forEach(([constraint, count]) => {
      if (constraint.includes('+')) {
        console.log(`    → Multi-contrainte ${constraint}: ${count} élèves placés ✅`);
      }
    });
  } else {
    console.error('  ❌ Échec du placement:', result.error);
  }
  
  return result;
}

/**
 * Crée des données de test si nécessaire
 */
function createTestDataIfNeeded(testSheet) {
  const data = testSheet.getDataRange().getValues();
  
  // Vérifier s'il y a des multi-contraintes
  let hasMultiConstraints = false;
  const headers = data[0];
  const idxLV2 = headers.indexOf('LV2');
  const idxOPT = headers.indexOf('OPT');
  
  if (idxLV2 >= 0 && idxOPT >= 0) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][idxLV2] && data[i][idxOPT]) {
        hasMultiConstraints = true;
        break;
      }
    }
  }
  
  if (!hasMultiConstraints) {
    console.log('  ⚠️ Création de données de test avec multi-contraintes...');
    
    // Ajouter quelques élèves avec ITA+CHAV pour le test
    // (Dans un vrai cas, vous devriez modifier vos données réelles)
    console.log('  💡 Ajoutez manuellement des élèves avec LV2=ITA ET OPT=CHAV dans TEST');
  }
}

/**
 * Prépare _BASEOPTI pour le test
 */
function prepareBaseoptiForTest(ss) {
  let baseSheet = ss.getSheetByName('_BASEOPTI');
  
  if (!baseSheet) {
    console.log('  Création de _BASEOPTI pour le test...');
    
    // Créer _BASEOPTI depuis TEST
    const testSheet = ss.getSheetByName('TEST');
    if (testSheet) {
      baseSheet = ss.insertSheet('_BASEOPTI');
      const testData = testSheet.getDataRange().getValues();
      
      // Ajouter les colonnes nécessaires
      const headers = [...testData[0], '_ID', '_PLACED', '_CLASS_ASSIGNED', '_TARGET_CLASS'];
      const newData = [headers];
      
      // Copier les données
      for (let i = 1; i < testData.length; i++) {
        const row = [...testData[i], 
          'ID_' + i,  // _ID
          false,      // _PLACED
          '',         // _CLASS_ASSIGNED
          ''          // _TARGET_CLASS
        ];
        newData.push(row);
      }
      
      baseSheet.getRange(1, 1, newData.length, headers.length).setValues(newData);
    }
  }
  
  return baseSheet;
}

/**
 * Fonction pour vérifier manuellement les résultats
 */
function verifyMultiConstraintsResults() {
  console.log('\n🔍 VÉRIFICATION DES RÉSULTATS');
  console.log('='.repeat(50));
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Vérifier _STRUCTURE
  console.log('\n📋 Contenu de _STRUCTURE:');
  const structureSheet = ss.getSheetByName('_STRUCTURE');
  if (structureSheet) {
    const data = structureSheet.getDataRange().getValues();
    
    // Trouver la ligne d'en-tête
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === 'CLASSE_ORIGINE') {
        const headers = data[i];
        const idxDest = headers.indexOf('CLASSE_DEST');
        const idxOptions = headers.indexOf('OPTIONS');
        
        // Afficher les options de chaque classe
        for (let j = i + 1; j < data.length; j++) {
          if (data[j][idxDest]) {
            console.log(`  ${data[j][idxDest]}: ${data[j][idxOptions]}`);
            
            // Vérifier la présence de contraintes combinées
            const options = data[j][idxOptions];
            if (options && options.includes('[') && options.includes(']')) {
              const matches = options.match(/\[([^\]]+)\]/g);
              if (matches) {
                matches.forEach(match => {
                  console.log(`    → Contrainte combinée trouvée: ${match}`);
                });
              }
            }
          }
        }
        break;
      }
    }
  }
  
  // Vérifier _BASEOPTI
  console.log('\n📊 Résumé des placements dans _BASEOPTI:');
  const baseSheet = ss.getSheetByName('_BASEOPTI');
  if (baseSheet) {
    const data = baseSheet.getDataRange().getValues();
    const headers = data[0];
    
    const idxLV2 = headers.indexOf('LV2');
    const idxOPT = headers.indexOf('OPT');
    const idxAssigned = headers.indexOf('_CLASS_ASSIGNED');
    
    const summary = {};
    let multiConstraintCount = 0;
    
    for (let i = 1; i < data.length; i++) {
      const classe = data[i][idxAssigned];
      const lv2 = data[i][idxLV2];
      const opt = data[i][idxOPT];
      
      if (classe) {
        if (!summary[classe]) {
          summary[classe] = {
            total: 0,
            multiConstraints: []
          };
        }
        
        summary[classe].total++;
        
        if (lv2 && opt) {
          multiConstraintCount++;
          summary[classe].multiConstraints.push(`${lv2}+${opt}`);
        }
      }
    }
    
    // Afficher le résumé
    Object.entries(summary).forEach(([classe, info]) => {
      console.log(`  ${classe}: ${info.total} élèves`);
      if (info.multiConstraints.length > 0) {
        const counts = {};
        info.multiConstraints.forEach(mc => {
          counts[mc] = (counts[mc] || 0) + 1;
        });
        Object.entries(counts).forEach(([mc, count]) => {
          console.log(`    → ${mc}: ${count} élèves`);
        });
      }
    });
    
    console.log(`\n  Total élèves avec multi-contraintes placés: ${multiConstraintCount}`);
  }
  
  console.log('\n' + '='.repeat(50));
}

/**
 * Fonction pour réinitialiser les données de test
 */
function resetTestData() {
  console.log('🔄 Réinitialisation des données de test...');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Réinitialiser _BASEOPTI
  const baseSheet = ss.getSheetByName('_BASEOPTI');
  if (baseSheet) {
    const data = baseSheet.getDataRange().getValues();
    const headers = data[0];
    
    const idxPlaced = headers.indexOf('_PLACED');
    const idxAssigned = headers.indexOf('_CLASS_ASSIGNED');
    
    // Réinitialiser les colonnes
    for (let i = 1; i < data.length; i++) {
      data[i][idxPlaced] = false;
      data[i][idxAssigned] = '';
    }
    
    baseSheet.getRange(1, 1, data.length, headers.length).setValues(data);
    console.log('  ✅ _BASEOPTI réinitialisé');
  }
  
  console.log('✅ Réinitialisation terminée');
}

// Export des fonctions pour utilisation
globalThis.testMultiConstraintsPipeline = testMultiConstraintsPipeline;
globalThis.verifyMultiConstraintsResults = verifyMultiConstraintsResults;
globalThis.resetTestData = resetTestData;

// Message d'aide
console.log('🎯 FONCTIONS DE TEST DISPONIBLES:');
console.log('- testMultiConstraintsPipeline() : Lance tous les tests');
console.log('- verifyMultiConstraintsResults() : Vérifie les résultats');
console.log('- resetTestData() : Réinitialise les données');
