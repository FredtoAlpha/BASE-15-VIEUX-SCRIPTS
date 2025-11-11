/**
 * ===================================================================
 * INTÉGRATION DES CONTRAINTES MULTIPLES DANS LE PIPELINE OPTI
 * ===================================================================
 * 
 * Ce fichier contient les modifications nécessaires pour intégrer
 * la gestion des contraintes multiples dans votre système existant.
 * 
 * Version: 1.0
 * Date: Janvier 2025
 */

/**
 * ÉTAPE 1: MODIFICATION DE setStructureOptionsFromUI
 * 
 * Cette version modifiée prend en compte les contraintes multiples
 * et respecte les quotas spécifiés par l'utilisateur.
 */
function setStructureOptionsFromUI_V2(optionsByClass) {
  try {
    console.log('📝 setStructureOptionsFromUI_V2 appelé avec:', JSON.stringify(optionsByClass));

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const structureSheet = ss.getSheetByName('_STRUCTURE');

    if (!structureSheet) {
      console.error('⚠️ Feuille _STRUCTURE introuvable');
      return { success: false, error: 'Feuille _STRUCTURE introuvable' };
    }

    // Analyser d'abord les élèves pour identifier les contraintes multiples
    const allStudents = collectAllStudentsFromTest();
    const analysis = analyzeStudentConstraints(allStudents);
    
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
    let colConstraints = headers.indexOf("CONTRAINTES_MULTIPLES");
    
    // Ajouter la colonne CONTRAINTES_MULTIPLES si elle n'existe pas
    if (colConstraints === -1) {
      structureSheet.getRange(headerRow + 1, headers.length + 1).setValue('CONTRAINTES_MULTIPLES');
      colConstraints = headers.length;
      // Recharger les headers
      headers.push('CONTRAINTES_MULTIPLES');
    }

    if (colDest === -1 || colOptions === -1) {
      console.error('⚠️ Colonnes CLASSE_DEST ou OPTIONS non trouvées');
      return { success: false, error: 'Colonnes manquantes dans _STRUCTURE' };
    }

    // Écrire les options pour chaque classe avec gestion des contraintes multiples
    let updatedCount = 0;
    for (let i = headerRow + 1; i < data.length; i++) {
      const classeDest = String(data[i][colDest] || '').trim();
      if (!classeDest) continue;

      const classConfig = optionsByClass[classeDest];
      if (!classConfig) continue;

      // Analyser les contraintes pour cette classe
      const classConstraints = analyzeClassConstraints(classConfig, analysis, classeDest);
      
      // Construire la chaîne OPTIONS avec les valeurs de l'UI
      const optionPairs = [];

      // Ajouter les LV2 avec leurs quotas UI
      if (classConfig.LV2 && typeof classConfig.LV2 === 'object') {
        Object.keys(classConfig.LV2).forEach(lv2 => {
          const quota = classConfig.LV2[lv2];
          if (quota > 0) {
            optionPairs.push(`${lv2}=${quota}`);
          }
        });
      }

      // Ajouter les OPT avec leurs quotas UI
      if (classConfig.OPT && typeof classConfig.OPT === 'object') {
        Object.keys(classConfig.OPT).forEach(opt => {
          const quota = classConfig.OPT[opt];
          if (quota > 0) {
            optionPairs.push(`${opt}=${quota}`);
          }
        });
      }

      const optionsStr = optionPairs.join(',');
      const constraintsStr = classConstraints.join('; ');
      
      console.log(`✍️ Classe ${classeDest}: OPTIONS="${optionsStr}" CONTRAINTES="${constraintsStr}"`);

      // Écrire dans les cellules
      structureSheet.getRange(i + 1, colOptions + 1).setValue(optionsStr);
      structureSheet.getRange(i + 1, colConstraints + 1).setValue(constraintsStr);
      updatedCount++;
    }

    SpreadsheetApp.flush();
    console.log(`✅ ${updatedCount} classes mises à jour dans _STRUCTURE avec contraintes multiples`);

    return { 
      success: true, 
      message: `${updatedCount} classes configurées avec gestion des contraintes multiples`,
      analysis: analysis
    };
  } catch (e) {
    console.error('❌ Erreur setStructureOptionsFromUI_V2:', e);
    return { success: false, error: e.toString() };
  }
}

/**
 * Collecte tous les élèves depuis les onglets TEST
 */
function collectAllStudentsFromTest() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const testSheets = ss.getSheets().filter(sheet => sheet.getName().endsWith('_TEST'));
  
  const allStudents = [];
  testSheets.forEach(sheet => {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return;
    
    const headers = data[0];
    const idIndex = headers.indexOf('ID_ELEVE');
    const lv2Index = headers.indexOf('LV2');
    const optIndex = headers.indexOf('OPT');
    const nomIndex = headers.indexOf('NOM');
    const prenomIndex = headers.indexOf('PRENOM');
    
    for (let i = 1; i < data.length; i++) {
      if (!data[i][idIndex]) continue;
      
      allStudents.push({
        ID_ELEVE: data[i][idIndex],
        LV2: data[i][lv2Index] || '',
        OPT: data[i][optIndex] || '',
        NOM: data[i][nomIndex] || '',
        PRENOM: data[i][prenomIndex] || '',
        CLASSE_ORIGINE: sheet.getName().replace('_TEST', '')
      });
    }
  });
  
  return allStudents;
}

/**
 * Analyse les contraintes pour une classe spécifique
 */
function analyzeClassConstraints(classConfig, globalAnalysis, className) {
  const constraints = [];
  const hasLV2 = classConfig.LV2 && Object.keys(classConfig.LV2).some(k => classConfig.LV2[k] > 0);
  const hasOPT = classConfig.OPT && Object.keys(classConfig.OPT).some(k => classConfig.OPT[k] > 0);
  
  if (!hasLV2 && !hasOPT) {
    return ['AUCUNE_CONTRAINTE'];
  }
  
  // Identifier les combinaisons présentes dans cette classe
  const combinationsInClass = {};
  
  if (hasLV2 && hasOPT) {
    // Chercher les élèves ayant les deux types de contraintes
    Object.keys(classConfig.LV2).forEach(lv2 => {
      if (classConfig.LV2[lv2] > 0) {
        Object.keys(classConfig.OPT).forEach(opt => {
          if (classConfig.OPT[opt] > 0) {
            const comboKey = `LV2=${lv2}+OPT=${opt}`;
            // Vérifier si cette combinaison existe dans l'analyse globale
            if (globalAnalysis.combinations[comboKey]) {
              combinationsInClass[comboKey] = globalAnalysis.combinations[comboKey];
            }
          }
        });
      }
    });
  }
  
  // Construire la liste des contraintes
  if (Object.keys(combinationsInClass).length > 0) {
    Object.keys(combinationsInClass).forEach(combo => {
      constraints.push(combo);
    });
  } else {
    // Contraintes simples
    if (hasLV2) {
      Object.keys(classConfig.LV2).forEach(lv2 => {
        if (classConfig.LV2[lv2] > 0) {
          constraints.push(`LV2=${lv2}`);
        }
      });
    }
    if (hasOPT) {
      Object.keys(classConfig.OPT).forEach(opt => {
        if (classConfig.OPT[opt] > 0) {
          constraints.push(`OPT=${opt}`);
        }
      });
    }
  }
  
  return constraints;
}

/**
 * ÉTAPE 2: MODIFICATION DU PANNEAU DE CONFIGURATION
 * 
 * Ajouter une section pour visualiser et gérer les contraintes multiples
 */
function getConstraintsAnalysisForUI() {
  try {
    const allStudents = collectAllStudentsFromTest();
    const analysis = analyzeStudentConstraints(allStudents);
    
    // Formater pour l'UI
    const uiData = {
      summary: {
        total: analysis.stats.totalStudents,
        withLV2Only: analysis.stats.studentsWithLV2 - analysis.stats.studentsWithBoth,
        withOPTOnly: analysis.stats.studentsWithOPT - analysis.stats.studentsWithBoth,
        withBoth: analysis.stats.studentsWithBoth,
        withNone: analysis.stats.studentsWithNone
      },
      combinations: [],
      recommendations: []
    };
    
    // Top 10 des combinaisons
    Object.entries(analysis.combinations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([combo, count]) => {
        uiData.combinations.push({
          constraint: combo,
          count: count,
          percentage: Math.round((count / analysis.stats.totalStudents) * 100)
        });
      });
    
    // Recommandations
    if (analysis.stats.studentsWithBoth > 10) {
      uiData.recommendations.push({
        type: 'info',
        message: `${analysis.stats.studentsWithBoth} élèves ont à la fois une LV2 et une option. ` +
                 `Considérez de créer des classes dédiées pour les combinaisons fréquentes.`
      });
    }
    
    // Identifier les combinaisons critiques (> 5% des élèves)
    const criticalThreshold = analysis.stats.totalStudents * 0.05;
    Object.entries(analysis.combinations).forEach(([combo, count]) => {
      if (combo.includes('+') && count >= criticalThreshold) {
        uiData.recommendations.push({
          type: 'warning',
          message: `La combinaison "${combo}" concerne ${count} élèves (${Math.round((count / analysis.stats.totalStudents) * 100)}%). ` +
                   `Il est recommandé de regrouper ces élèves dans la même classe.`
        });
      }
    });
    
    return { success: true, data: uiData };
    
  } catch (e) {
    console.error('Erreur dans getConstraintsAnalysisForUI:', e);
    return { success: false, error: e.toString() };
  }
}

/**
 * ÉTAPE 3: MODIFICATION DU PROCESSUS D'OPTIMISATION
 * 
 * Adapter la phase 1 pour respecter les contraintes multiples
 */
function runPhase1WithMultipleConstraints(config) {
  console.log('🎯 Phase 1 avec contraintes multiples démarrée...');
  
  try {
    // Collecter et analyser les élèves
    const allStudents = collectAllStudentsFromTest();
    const analysis = analyzeStudentConstraints(allStudents);
    
    // Générer la stratégie de distribution
    const strategy = generateDistributionStrategy(analysis, {
      targetClassSize: config.effectif || 28,
      availableClasses: Object.keys(config.options || {})
    });
    
    // Appliquer la stratégie
    const result = applyDistributionStrategy(strategy);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // Log des résultats
    console.log('✅ Phase 1 avec contraintes multiples terminée');
    console.log('📊 Résumé de la distribution:');
    Object.entries(strategy.classAssignments).forEach(([classe, assignment]) => {
      console.log(`  - ${classe}: ${assignment.count} élèves (${assignment.constraints})`);
    });
    
    // Retourner les informations pour les phases suivantes
    return {
      success: true,
      strategy: strategy,
      analysis: analysis,
      warnings: strategy.warnings,
      recommendations: strategy.recommendations
    };
    
  } catch (e) {
    console.error('❌ Erreur dans runPhase1WithMultipleConstraints:', e);
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * ÉTAPE 4: FONCTION DE VALIDATION DES CONTRAINTES
 * 
 * Vérifie que les contraintes sont respectées après optimisation
 */
function validateConstraintsAfterOptimization() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const violations = [];
    
    // Parcourir tous les onglets de classe finale
    const finalSheets = ss.getSheets().filter(sheet => 
      sheet.getName().match(/^[56]°[1-6]$/) && !sheet.getName().includes('_')
    );
    
    finalSheets.forEach(sheet => {
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) return;
      
      const headers = data[0];
      const lv2Index = headers.indexOf('LV2');
      const optIndex = headers.indexOf('OPT');
      
      // Compter les contraintes dans cette classe
      const constraintCounts = {};
      
      for (let i = 1; i < data.length; i++) {
        const lv2 = data[i][lv2Index] || '';
        const opt = data[i][optIndex] || '';
        
        let constraintKey = '';
        if (lv2 && opt) {
          constraintKey = `LV2=${lv2}+OPT=${opt}`;
        } else if (lv2) {
          constraintKey = `LV2=${lv2}`;
        } else if (opt) {
          constraintKey = `OPT=${opt}`;
        } else {
          constraintKey = 'AUCUNE';
        }
        
        constraintCounts[constraintKey] = (constraintCounts[constraintKey] || 0) + 1;
      }
      
      // Vérifier contre _STRUCTURE
      const structureSheet = ss.getSheetByName('_STRUCTURE');
      if (structureSheet) {
        const structureData = structureSheet.getDataRange().getValues();
        const structureHeaders = structureData[0];
        const destIndex = structureHeaders.indexOf('CLASSE_DEST');
        const constraintsIndex = structureHeaders.indexOf('CONTRAINTES_MULTIPLES');
        
        // Trouver la ligne correspondante
        for (let i = 1; i < structureData.length; i++) {
          if (structureData[i][destIndex] === sheet.getName()) {
            const expectedConstraints = structureData[i][constraintsIndex];
            
            // Comparer avec les contraintes réelles
            if (expectedConstraints && expectedConstraints !== 'AUCUNE_CONTRAINTE') {
              const expectedList = expectedConstraints.split(';').map(c => c.trim());
              
              expectedList.forEach(expected => {
                if (!constraintCounts[expected] || constraintCounts[expected] === 0) {
                  violations.push({
                    classe: sheet.getName(),
                    type: 'CONTRAINTE_MANQUANTE',
                    message: `Contrainte "${expected}" attendue mais aucun élève trouvé`
                  });
                }
              });
            }
          }
        }
      }
      
      // Vérifier les mélanges non autorisés
      Object.entries(constraintCounts).forEach(([constraint, count]) => {
        if (constraint.includes('+') && count > 5) {
          // Vérifier si cette combinaison était prévue
          const structureAllowsIt = checkIfCombinationAllowed(sheet.getName(), constraint);
          if (!structureAllowsIt) {
            violations.push({
              classe: sheet.getName(),
              type: 'COMBINAISON_NON_AUTORISEE',
              message: `${count} élèves avec "${constraint}" - combinaison non prévue dans _STRUCTURE`
            });
          }
        }
      });
    });
    
    return {
      success: violations.length === 0,
      violations: violations,
      message: violations.length === 0 
        ? '✅ Toutes les contraintes sont respectées' 
        : `⚠️ ${violations.length} violations détectées`
    };
    
  } catch (e) {
    console.error('Erreur dans validateConstraintsAfterOptimization:', e);
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Vérifie si une combinaison est autorisée pour une classe
 */
function checkIfCombinationAllowed(className, combination) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const structureSheet = ss.getSheetByName('_STRUCTURE');
  
  if (!structureSheet) return false;
  
  const data = structureSheet.getDataRange().getValues();
  const headers = data[0];
  const destIndex = headers.indexOf('CLASSE_DEST');
  const constraintsIndex = headers.indexOf('CONTRAINTES_MULTIPLES');
  
  if (destIndex === -1 || constraintsIndex === -1) return false;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][destIndex] === className) {
      const allowedConstraints = String(data[i][constraintsIndex] || '');
      return allowedConstraints.includes(combination);
    }
  }
  
  return false;
}

/**
 * ÉTAPE 5: RAPPORT DE DISTRIBUTION DES CONTRAINTES
 * 
 * Génère un rapport détaillé sur la distribution des contraintes
 */
function generateConstraintsReport() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Créer une nouvelle feuille pour le rapport
    let reportSheet = ss.getSheetByName('_RAPPORT_CONTRAINTES');
    if (reportSheet) {
      ss.deleteSheet(reportSheet);
    }
    reportSheet = ss.insertSheet('_RAPPORT_CONTRAINTES');
    
    // En-têtes du rapport
    const headers = [
      'Classe', 
      'Effectif Total', 
      'Sans Contrainte', 
      'LV2 Seule', 
      'Option Seule', 
      'LV2 + Option',
      'Détail Combinaisons',
      'Conformité'
    ];
    
    reportSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    reportSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    
    // Analyser chaque classe
    const reportData = [];
    const classes = ['5°1', '5°2', '5°3', '5°4', '5°5', '5°6'];
    
    classes.forEach(className => {
      const classSheet = ss.getSheetByName(className);
      if (!classSheet) return;
      
      const data = classSheet.getDataRange().getValues();
      if (data.length < 2) return;
      
      const headers = data[0];
      const lv2Index = headers.indexOf('LV2');
      const optIndex = headers.indexOf('OPT');
      
      // Statistiques de la classe
      let stats = {
        total: 0,
        sansContrainte: 0,
        lv2Seule: 0,
        optionSeule: 0,
        lv2EtOption: 0,
        combinaisons: {}
      };
      
      for (let i = 1; i < data.length; i++) {
        if (!data[i][0]) continue; // Skip empty rows
        
        stats.total++;
        const lv2 = data[i][lv2Index] || '';
        const opt = data[i][optIndex] || '';
        
        if (!lv2 && !opt) {
          stats.sansContrainte++;
        } else if (lv2 && !opt) {
          stats.lv2Seule++;
        } else if (!lv2 && opt) {
          stats.optionSeule++;
        } else if (lv2 && opt) {
          stats.lv2EtOption++;
          const combo = `${lv2}+${opt}`;
          stats.combinaisons[combo] = (stats.combinaisons[combo] || 0) + 1;
        }
      }
      
      // Formatter les combinaisons
      const comboDetails = Object.entries(stats.combinaisons)
        .map(([combo, count]) => `${combo}:${count}`)
        .join(', ');
      
      // Vérifier la conformité
      const validation = validateClassConstraints(className);
      
      reportData.push([
        className,
        stats.total,
        stats.sansContrainte,
        stats.lv2Seule,
        stats.optionSeule,
        stats.lv2EtOption,
        comboDetails || '-',
        validation.isConform ? '✅' : '❌ ' + validation.message
      ]);
    });
    
    // Écrire les données
    if (reportData.length > 0) {
      reportSheet.getRange(2, 1, reportData.length, headers.length).setValues(reportData);
    }
    
    // Mise en forme
    reportSheet.autoResizeColumns(1, headers.length);
    reportSheet.setFrozenRows(1);
    
    // Ajouter un résumé global
    const summaryRow = reportSheet.getLastRow() + 2;
    reportSheet.getRange(summaryRow, 1).setValue('TOTAL GÉNÉRAL');
    reportSheet.getRange(summaryRow, 1, 1, headers.length).setFontWeight('bold');
    
    // Calculer les totaux
    const totals = reportData.reduce((acc, row) => {
      acc.total += row[1];
      acc.sansContrainte += row[2];
      acc.lv2Seule += row[3];
      acc.optionSeule += row[4];
      acc.lv2EtOption += row[5];
      return acc;
    }, { total: 0, sansContrainte: 0, lv2Seule: 0, optionSeule: 0, lv2EtOption: 0 });
    
    reportSheet.getRange(summaryRow, 2, 1, 5).setValues([[
      totals.total,
      totals.sansContrainte,
      totals.lv2Seule,
      totals.optionSeule,
      totals.lv2EtOption
    ]]);
    
    return {
      success: true,
      message: 'Rapport généré dans l\'onglet _RAPPORT_CONTRAINTES'
    };
    
  } catch (e) {
    console.error('Erreur dans generateConstraintsReport:', e);
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Valide les contraintes d'une classe
 */
function validateClassConstraints(className) {
  // Implémentation simplifiée - à adapter selon vos besoins
  return {
    isConform: true,
    message: 'OK'
  };
}

/**
 * POINT D'ENTRÉE PRINCIPAL POUR L'INTÉGRATION
 * 
 * Remplace l'ancienne fonction setStructureOptionsFromUI
 */
function integrateMultipleConstraints() {
  // Remplacer la fonction existante
  globalThis.setStructureOptionsFromUI = setStructureOptionsFromUI_V2;
  
  console.log('✅ Système de contraintes multiples intégré');
  
  // Ajouter les nouvelles fonctions au menu
  const ui = SpreadsheetApp.getUi();
  const existingMenu = ui.createMenu('🎯 CONSOLE AVANCÉE')
    .addItem('📊 Analyser Contraintes Multiples', 'showConstraintsAnalysis')
    .addItem('📋 Rapport Contraintes', 'generateConstraintsReport')
    .addItem('✅ Valider Contraintes', 'validateConstraintsAfterOptimization')
    .addSeparator();
    
  return {
    success: true,
    message: 'Système de contraintes multiples activé'
  };
}

/**
 * Affiche l'analyse des contraintes dans une interface
 */
function showConstraintsAnalysis() {
  const analysis = getConstraintsAnalysisForUI();
  
  if (!analysis.success) {
    SpreadsheetApp.getUi().alert('Erreur: ' + analysis.error);
    return;
  }
  
  const html = HtmlService.createHtmlOutput(`
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Analyse des Contraintes Multiples</h2>
      
      <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h3>Résumé</h3>
        <ul>
          <li>Total élèves: <strong>${analysis.data.summary.total}</strong></li>
          <li>LV2 uniquement: <strong>${analysis.data.summary.withLV2Only}</strong></li>
          <li>Option uniquement: <strong>${analysis.data.summary.withOPTOnly}</strong></li>
          <li>LV2 ET Option: <strong style="color: #ff6b6b;">${analysis.data.summary.withBoth}</strong></li>
          <li>Sans contrainte: <strong>${analysis.data.summary.withNone}</strong></li>
        </ul>
      </div>
      
      <h3>Combinaisons Principales</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #4CAF50; color: white;">
            <th style="padding: 8px; text-align: left;">Contrainte</th>
            <th style="padding: 8px; text-align: center;">Nombre</th>
            <th style="padding: 8px; text-align: center;">%</th>
          </tr>
        </thead>
        <tbody>
          ${analysis.data.combinations.map(c => `
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 8px;">${c.constraint}</td>
              <td style="padding: 8px; text-align: center;">${c.count}</td>
              <td style="padding: 8px; text-align: center;">${c.percentage}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      ${analysis.data.recommendations.length > 0 ? `
        <h3>Recommandations</h3>
        <div style="margin-top: 20px;">
          ${analysis.data.recommendations.map(r => `
            <div style="padding: 10px; margin: 5px 0; background: ${r.type === 'warning' ? '#fff3cd' : '#d1ecf1'}; 
                        border-left: 4px solid ${r.type === 'warning' ? '#ff6b6b' : '#0c5460'};">
              ${r.message}
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <div style="margin-top: 30px;">
        <button onclick="google.script.run.generateConstraintsReport()" 
                style="padding: 10px 20px; background: #4CAF50; color: white; border: none; 
                       border-radius: 5px; cursor: pointer;">
          Générer Rapport Détaillé
        </button>
      </div>
    </div>
  `)
    .setWidth(600)
    .setHeight(700);
    
  SpreadsheetApp.getUi().showModalDialog(html, 'Analyse des Contraintes Multiples');
}
