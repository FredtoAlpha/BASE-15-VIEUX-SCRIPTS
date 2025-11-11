/**
 * ===================================================================
 * TABLEAU DE BORD D'ANALYSE DE L'HÉTÉROGÉNÉITÉ
 * ===================================================================
 * 
 * Ce module crée un rapport détaillé pour visualiser et analyser
 * l'hétérogénéité des classes après optimisation
 * 
 * Version: 1.0
 * Date: Janvier 2025
 */

/**
 * Génère un rapport complet d'hétérogénéité
 */
function generateHeterogeneityReport() {
  console.log('📊 Génération du rapport d\'hétérogénéité...');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Créer ou récupérer la feuille de rapport
  let reportSheet = ss.getSheetByName('_RAPPORT_HETEROGENEITE');
  if (reportSheet) {
    reportSheet.clear();
  } else {
    reportSheet = ss.insertSheet('_RAPPORT_HETEROGENEITE');
  }
  
  // Analyser les données
  const analysis = performFullAnalysis(ss);
  
  // Générer le rapport
  writeReportHeader(reportSheet, analysis);
  writeGlobalStats(reportSheet, analysis);
  writeClassDetails(reportSheet, analysis);
  writeDistributionCharts(reportSheet, analysis);
  writeRecommendations(reportSheet, analysis);
  
  // Formater le rapport
  formatReport(reportSheet);
  
  console.log('✅ Rapport généré avec succès');
  
  // Activer la feuille du rapport
  reportSheet.activate();
  
  return {
    success: true,
    analysis: analysis
  };
}

/**
 * Effectue une analyse complète des classes
 */
function performFullAnalysis(ss) {
  const analysis = {
    timestamp: new Date(),
    classes: {},
    global: {
      totalStudents: 0,
      avgCOM: 0,
      avgTRA: 0,
      avgPART: 0,
      avgABS: 0,
      parityF: 0,
      parityM: 0,
      heterogeneityScore: 0
    },
    distributions: {
      COM: { 1: 0, 2: 0, 3: 0, 4: 0 },
      TRA: { 1: 0, 2: 0, 3: 0, 4: 0 },
      PART: { 1: 0, 2: 0, 3: 0, 4: 0 },
      ABS: { 1: 0, 2: 0, 3: 0, 4: 0 }
    },
    warnings: [],
    strengths: []
  };
  
  // Lire les données depuis _BASEOPTI
  const baseSheet = ss.getSheetByName('_BASEOPTI');
  if (!baseSheet) {
    analysis.warnings.push('_BASEOPTI introuvable');
    return analysis;
  }
  
  const data = baseSheet.getDataRange().getValues();
  const headers = data[0];
  
  // Indices des colonnes
  const indices = {
    assigned: headers.indexOf('_CLASS_ASSIGNED'),
    placed: headers.indexOf('_PLACED'),
    sexe: headers.indexOf('SEXE'),
    com: headers.indexOf('COM'),
    tra: headers.indexOf('TRA'),
    part: headers.indexOf('PART'),
    abs: headers.indexOf('ABS'),
    lv2: headers.indexOf('LV2'),
    opt: headers.indexOf('OPT'),
    nom: headers.indexOf('NOM'),
    prenom: headers.indexOf('PRENOM')
  };
  
  // Collecter les données par classe
  const classData = {};
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[indices.placed] || !row[indices.assigned]) continue;
    
    const classe = row[indices.assigned];
    if (!classData[classe]) {
      classData[classe] = {
        students: [],
        F: 0,
        M: 0,
        scores: { COM: [], TRA: [], PART: [], ABS: [] }
      };
    }
    
    const student = {
      nom: row[indices.nom] + ' ' + row[indices.prenom],
      sexe: row[indices.sexe],
      com: parseFloat(row[indices.com]) || 0,
      tra: parseFloat(row[indices.tra]) || 0,
      part: parseFloat(row[indices.part]) || 0,
      abs: parseFloat(row[indices.abs]) || 0,
      lv2: row[indices.lv2],
      opt: row[indices.opt]
    };
    
    classData[classe].students.push(student);
    
    // Compter par sexe
    if (student.sexe === 'F') classData[classe].F++;
    else if (student.sexe === 'M') classData[classe].M++;
    
    // Collecter les scores
    classData[classe].scores.COM.push(student.com);
    classData[classe].scores.TRA.push(student.tra);
    classData[classe].scores.PART.push(student.part);
    classData[classe].scores.ABS.push(student.abs);
    
    // Distributions globales
    ['COM', 'TRA', 'PART', 'ABS'].forEach(critere => {
      const score = Math.round(student[critere.toLowerCase()]);
      if (score >= 1 && score <= 4) {
        analysis.distributions[critere][score]++;
      }
    });
    
    analysis.global.totalStudents++;
  }
  
  // Analyser chaque classe
  Object.entries(classData).forEach(([classe, data]) => {
    const stats = {
      effectif: data.students.length,
      F: data.F,
      M: data.M,
      ratioF: data.students.length > 0 ? Math.round((data.F / data.students.length) * 100) : 0,
      moyennes: {},
      ecartTypes: {},
      distributions: {},
      scoreHeterogeneite: 0
    };
    
    // Calculer les statistiques
    ['COM', 'TRA', 'PART', 'ABS'].forEach(critere => {
      const scores = data.scores[critere];
      stats.moyennes[critere] = average(scores);
      stats.ecartTypes[critere] = standardDeviation(scores);
      
      // Distribution des scores
      stats.distributions[critere] = { 1: 0, 2: 0, 3: 0, 4: 0 };
      scores.forEach(score => {
        const rounded = Math.round(score);
        if (rounded >= 1 && rounded <= 4) {
          stats.distributions[critere][rounded]++;
        }
      });
    });
    
    // Score d'hétérogénéité de la classe
    stats.scoreHeterogeneite = (stats.ecartTypes.COM * 2 + stats.ecartTypes.TRA) / 3;
    
    analysis.classes[classe] = stats;
  });
  
  // Calculer les statistiques globales
  const allClasses = Object.values(analysis.classes);
  if (allClasses.length > 0) {
    analysis.global.avgCOM = average(allClasses.map(c => c.moyennes.COM));
    analysis.global.avgTRA = average(allClasses.map(c => c.moyennes.TRA));
    analysis.global.avgPART = average(allClasses.map(c => c.moyennes.PART));
    analysis.global.avgABS = average(allClasses.map(c => c.moyennes.ABS));
    
    const totalF = allClasses.reduce((sum, c) => sum + c.F, 0);
    const totalM = allClasses.reduce((sum, c) => sum + c.M, 0);
    const total = totalF + totalM;
    
    analysis.global.parityF = total > 0 ? Math.round((totalF / total) * 100) : 0;
    analysis.global.parityM = 100 - analysis.global.parityF;
    
    // Score d'hétérogénéité global
    const interClassVarianceCOM = variance(allClasses.map(c => c.moyennes.COM));
    const avgIntraClassStdCOM = average(allClasses.map(c => c.ecartTypes.COM));
    analysis.global.heterogeneityScore = avgIntraClassStdCOM / (1 + interClassVarianceCOM);
  }
  
  // Identifier les points forts et les avertissements
  analyzeStrengthsAndWarnings(analysis);
  
  return analysis;
}

/**
 * Identifie les points forts et les avertissements
 */
function analyzeStrengthsAndWarnings(analysis) {
  const classes = Object.entries(analysis.classes);
  
  // Vérifier l'équilibre des moyennes
  const comMoyennes = classes.map(([_, stats]) => stats.moyennes.COM);
  const comVariance = variance(comMoyennes);
  
  if (comVariance < 0.1) {
    analysis.strengths.push('Excellente homogénéité des moyennes COM entre classes');
  } else if (comVariance > 0.5) {
    analysis.warnings.push('Fortes disparités des moyennes COM entre classes');
  }
  
  // Vérifier la parité
  classes.forEach(([classe, stats]) => {
    if (Math.abs(stats.ratioF - analysis.global.parityF) > 10) {
      analysis.warnings.push(`${classe}: parité déséquilibrée (${stats.ratioF}%F)`);
    }
    
    // Vérifier l'hétérogénéité interne
    if (stats.ecartTypes.COM < 0.5) {
      analysis.warnings.push(`${classe}: faible diversité des scores COM`);
    } else if (stats.ecartTypes.COM > 1.2) {
      analysis.strengths.push(`${classe}: excellente diversité des scores`);
    }
  });
  
  // Score global
  if (analysis.global.heterogeneityScore > 1.0) {
    analysis.strengths.push('Très bonne hétérogénéité globale');
  } else if (analysis.global.heterogeneityScore < 0.5) {
    analysis.warnings.push('Hétérogénéité globale insuffisante');
  }
}

/**
 * Écrit l'en-tête du rapport
 */
function writeReportHeader(sheet, analysis) {
  let row = 1;
  
  sheet.getRange(row, 1).setValue('RAPPORT D\'HÉTÉROGÉNÉITÉ DES CLASSES');
  sheet.getRange(row, 1).setFontSize(16).setFontWeight('bold');
  row += 2;
  
  sheet.getRange(row, 1).setValue('Date: ' + Utilities.formatDate(analysis.timestamp, 'GMT+1', 'dd/MM/yyyy HH:mm'));
  row += 1;
  
  sheet.getRange(row, 1).setValue('Score d\'hétérogénéité global: ' + analysis.global.heterogeneityScore.toFixed(2));
  sheet.getRange(row, 1).setFontWeight('bold');
  
  return row + 2;
}

/**
 * Écrit les statistiques globales
 */
function writeGlobalStats(sheet, analysis) {
  let row = 6;
  
  sheet.getRange(row, 1).setValue('STATISTIQUES GLOBALES');
  sheet.getRange(row, 1).setFontSize(14).setFontWeight('bold').setBackground('#E8F0FE');
  row += 2;
  
  const globalData = [
    ['Indicateur', 'Valeur'],
    ['Total élèves', analysis.global.totalStudents],
    ['Parité globale', `${analysis.global.parityF}%F / ${analysis.global.parityM}%M`],
    ['Moyenne COM globale', analysis.global.avgCOM.toFixed(2)],
    ['Moyenne TRA globale', analysis.global.avgTRA.toFixed(2)],
    ['Score hétérogénéité', analysis.global.heterogeneityScore.toFixed(2)]
  ];
  
  sheet.getRange(row, 1, globalData.length, 2).setValues(globalData);
  sheet.getRange(row, 1, 1, 2).setFontWeight('bold').setBackground('#F0F0F0');
  
  return row + globalData.length + 2;
}

/**
 * Écrit les détails par classe
 */
function writeClassDetails(sheet, analysis) {
  let row = 16;
  
  sheet.getRange(row, 1).setValue('DÉTAILS PAR CLASSE');
  sheet.getRange(row, 1).setFontSize(14).setFontWeight('bold').setBackground('#E8F0FE');
  row += 2;
  
  // En-têtes
  const headers = [
    'Classe', 'Effectif', 'Parité', 
    'Moy COM', 'σ COM', 
    'Moy TRA', 'σ TRA',
    'Score Hétérog.',
    'Distribution COM (1-2-3-4)'
  ];
  
  sheet.getRange(row, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(row, 1, 1, headers.length).setFontWeight('bold').setBackground('#F0F0F0');
  row++;
  
  // Données par classe
  Object.entries(analysis.classes).forEach(([classe, stats]) => {
    const distCOM = `${stats.distributions.COM[1]}-${stats.distributions.COM[2]}-${stats.distributions.COM[3]}-${stats.distributions.COM[4]}`;
    
    const rowData = [
      classe,
      stats.effectif,
      `${stats.F}F/${stats.M}M`,
      stats.moyennes.COM.toFixed(2),
      stats.ecartTypes.COM.toFixed(2),
      stats.moyennes.TRA.toFixed(2),
      stats.ecartTypes.TRA.toFixed(2),
      stats.scoreHeterogeneite.toFixed(2),
      distCOM
    ];
    
    sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
    
    // Colorier selon le score d'hétérogénéité
    const scoreCell = sheet.getRange(row, 8);
    if (stats.scoreHeterogeneite > 1.0) {
      scoreCell.setBackground('#C8E6C9'); // Vert
    } else if (stats.scoreHeterogeneite < 0.5) {
      scoreCell.setBackground('#FFCDD2'); // Rouge
    } else {
      scoreCell.setBackground('#FFF9C4'); // Jaune
    }
    
    row++;
  });
  
  return row + 2;
}

/**
 * Écrit les graphiques de distribution
 */
function writeDistributionCharts(sheet, analysis) {
  let row = 28;
  
  sheet.getRange(row, 1).setValue('DISTRIBUTIONS DES SCORES');
  sheet.getRange(row, 1).setFontSize(14).setFontWeight('bold').setBackground('#E8F0FE');
  row += 2;
  
  // Tableau de distribution globale
  const distHeaders = ['Score', 'COM', 'TRA', 'PART', 'ABS'];
  const distData = [
    distHeaders,
    ['Score 1', analysis.distributions.COM[1], analysis.distributions.TRA[1], 
     analysis.distributions.PART[1], analysis.distributions.ABS[1]],
    ['Score 2', analysis.distributions.COM[2], analysis.distributions.TRA[2], 
     analysis.distributions.PART[2], analysis.distributions.ABS[2]],
    ['Score 3', analysis.distributions.COM[3], analysis.distributions.TRA[3], 
     analysis.distributions.PART[3], analysis.distributions.ABS[3]],
    ['Score 4', analysis.distributions.COM[4], analysis.distributions.TRA[4], 
     analysis.distributions.PART[4], analysis.distributions.ABS[4]]
  ];
  
  sheet.getRange(row, 1, distData.length, distData[0].length).setValues(distData);
  sheet.getRange(row, 1, 1, distData[0].length).setFontWeight('bold').setBackground('#F0F0F0');
  
  // Colorier les cellules selon l'intensité
  for (let i = 1; i < distData.length; i++) {
    for (let j = 1; j < distData[0].length; j++) {
      const value = distData[i][j];
      const cell = sheet.getRange(row + i, j + 1);
      
      if (value > analysis.global.totalStudents * 0.4) {
        cell.setBackground('#FFCDD2'); // Rouge si trop concentré
      } else if (value > analysis.global.totalStudents * 0.3) {
        cell.setBackground('#FFF9C4'); // Jaune
      }
    }
  }
  
  return row + distData.length + 2;
}

/**
 * Écrit les recommandations
 */
function writeRecommendations(sheet, analysis) {
  let row = 38;
  
  sheet.getRange(row, 1).setValue('RECOMMANDATIONS');
  sheet.getRange(row, 1).setFontSize(14).setFontWeight('bold').setBackground('#E8F0FE');
  row += 2;
  
  // Points forts
  if (analysis.strengths.length > 0) {
    sheet.getRange(row, 1).setValue('✅ Points forts:');
    sheet.getRange(row, 1).setFontWeight('bold').setFontColor('#2E7D32');
    row++;
    
    analysis.strengths.forEach(strength => {
      sheet.getRange(row, 1).setValue('• ' + strength);
      sheet.getRange(row, 1).setFontColor('#2E7D32');
      row++;
    });
    row++;
  }
  
  // Avertissements
  if (analysis.warnings.length > 0) {
    sheet.getRange(row, 1).setValue('⚠️ Points d\'attention:');
    sheet.getRange(row, 1).setFontWeight('bold').setFontColor('#D32F2F');
    row++;
    
    analysis.warnings.forEach(warning => {
      sheet.getRange(row, 1).setValue('• ' + warning);
      sheet.getRange(row, 1).setFontColor('#D32F2F');
      row++;
    });
    row++;
  }
  
  // Suggestions d'amélioration
  sheet.getRange(row, 1).setValue('💡 Suggestions:');
  sheet.getRange(row, 1).setFontWeight('bold').setFontColor('#1976D2');
  row++;
  
  if (analysis.global.heterogeneityScore < 0.7) {
    sheet.getRange(row, 1).setValue('• Augmenter le nombre de swaps en Phase 4');
    row++;
    sheet.getRange(row, 1).setValue('• Vérifier les contraintes qui limitent les échanges');
    row++;
  }
  
  if (Math.max(...Object.values(analysis.classes).map(c => Math.abs(c.ratioF - analysis.global.parityF))) > 10) {
    sheet.getRange(row, 1).setValue('• Ajuster les paramètres de parité en Phase 3');
    row++;
  }
  
  return row;
}

/**
 * Formate le rapport
 */
function formatReport(sheet) {
  // Ajuster les largeurs de colonnes
  sheet.setColumnWidth(1, 200);
  for (let i = 2; i <= 9; i++) {
    sheet.setColumnWidth(i, 100);
  }
  
  // Bordures
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow > 0 && lastCol > 0) {
    sheet.getRange(1, 1, lastRow, lastCol).setBorder(
      true, true, true, true, true, true,
      '#E0E0E0', SpreadsheetApp.BorderStyle.SOLID
    );
  }
  
  // Protection
  const protection = sheet.protect();
  protection.setDescription('Rapport d\'hétérogénéité - Lecture seule');
  protection.setWarningOnly(true);
}

/**
 * Fonction de test rapide
 */
function testHeterogeneityAnalysis() {
  console.log('🧪 Test de l\'analyse d\'hétérogénéité...');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ctx = { levels: ['5°1', '5°2', '5°3', '5°4', '5°5', '5°6'] };
  
  // Analyser l'état actuel
  const baseSheet = ss.getSheetByName('_BASEOPTI');
  if (!baseSheet) {
    console.error('❌ _BASEOPTI introuvable');
    return;
  }
  
  const data = baseSheet.getDataRange().getValues();
  const headers = data[0];
  const indices = {
    assigned: headers.indexOf('_CLASS_ASSIGNED'),
    com: headers.indexOf('COM'),
    tra: headers.indexOf('TRA'),
    part: headers.indexOf('PART'),
    abs: headers.indexOf('ABS')
  };
  
  const analysis = analyzeClassHeterogeneity(data, indices, ctx);
  
  console.log('📊 Résultats:');
  console.log('Score global:', analysis.globalScore.toFixed(2));
  console.log('\nPar classe:');
  
  Object.entries(analysis.classStats).forEach(([classe, stats]) => {
    console.log(`${classe}: COM=${stats.avgCOM.toFixed(2)} (σ=${stats.stdCOM.toFixed(2)})`);
  });
  
  return analysis;
}

// Export des fonctions
globalThis.generateHeterogeneityReport = generateHeterogeneityReport;
globalThis.testHeterogeneityAnalysis = testHeterogeneityAnalysis;
