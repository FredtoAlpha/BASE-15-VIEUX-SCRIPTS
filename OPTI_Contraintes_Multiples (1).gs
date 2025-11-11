/**
 * ===================================================================
 * SYSTÈME DE CONTRAINTES MULTIPLES POUR OPTI
 * ===================================================================
 * 
 * Ce module permet de gérer des élèves ayant plusieurs contraintes
 * simultanées (ex: LV2=ITA ET OPT=CHAV) et de les placer dans des
 * classes spécifiques selon ces combinaisons.
 * 
 * Version: 1.0
 * Date: Janvier 2025
 */

/**
 * Configuration des contraintes multiples
 */
const CONSTRAINTS_CONFIG = {
  // Types de contraintes supportés
  CONSTRAINT_TYPES: ['LV2', 'OPT'],
  
  // Séparateur pour les combinaisons
  COMBINATION_SEPARATOR: '+',
  
  // Colonnes dans _STRUCTURE
  STRUCTURE_COLUMNS: {
    CLASSE_DEST: 'CLASSE_DEST',
    OPTIONS: 'OPTIONS',
    CONSTRAINTS: 'CONTRAINTES_MULTIPLES' // Nouvelle colonne
  }
};

/**
 * Analyse les contraintes des élèves et identifie les combinaisons
 * @param {Array<Object>} students - Liste des élèves
 * @returns {Object} Analyse des contraintes et combinaisons
 */
function analyzeStudentConstraints(students) {
  const analysis = {
    // Comptage par contrainte unique
    singleConstraints: {
      LV2: {},
      OPT: {}
    },
    // Comptage des combinaisons
    combinations: {},
    // Élèves par combinaison
    studentsByConstraint: {},
    // Stats globales
    stats: {
      totalStudents: students.length,
      studentsWithLV2: 0,
      studentsWithOPT: 0,
      studentsWithBoth: 0,
      studentsWithNone: 0
    }
  };
  
  students.forEach(student => {
    const lv2 = student.LV2 || '';
    const opt = student.OPT || '';
    
    // Construire la clé de contrainte
    let constraintKey = '';
    const constraints = [];
    
    if (lv2) {
      analysis.singleConstraints.LV2[lv2] = (analysis.singleConstraints.LV2[lv2] || 0) + 1;
      constraints.push(`LV2=${lv2}`);
      analysis.stats.studentsWithLV2++;
    }
    
    if (opt) {
      analysis.singleConstraints.OPT[opt] = (analysis.singleConstraints.OPT[opt] || 0) + 1;
      constraints.push(`OPT=${opt}`);
      analysis.stats.studentsWithOPT++;
    }
    
    if (constraints.length > 0) {
      constraintKey = constraints.join(CONSTRAINTS_CONFIG.COMBINATION_SEPARATOR);
    } else {
      constraintKey = 'AUCUNE';
      analysis.stats.studentsWithNone++;
    }
    
    if (lv2 && opt) {
      analysis.stats.studentsWithBoth++;
    }
    
    // Comptabiliser la combinaison
    analysis.combinations[constraintKey] = (analysis.combinations[constraintKey] || 0) + 1;
    
    // Stocker l'élève par contrainte
    if (!analysis.studentsByConstraint[constraintKey]) {
      analysis.studentsByConstraint[constraintKey] = [];
    }
    analysis.studentsByConstraint[constraintKey].push({
      ...student,
      constraintKey: constraintKey
    });
  });
  
  return analysis;
}

/**
 * Génère une stratégie de répartition optimale
 * @param {Object} analysis - Résultat de analyzeStudentConstraints
 * @param {Object} config - Configuration des classes disponibles
 * @returns {Object} Stratégie de répartition
 */
function generateDistributionStrategy(analysis, config) {
  const strategy = {
    classAssignments: {},
    warnings: [],
    recommendations: []
  };
  
  const targetClassSize = config.targetClassSize || 28;
  const availableClasses = config.availableClasses || ['5°1', '5°2', '5°3', '5°4', '5°5', '5°6'];
  
  // Trier les combinaisons par fréquence décroissante
  const sortedCombinations = Object.entries(analysis.combinations)
    .sort((a, b) => b[1] - a[1]);
  
  let classIndex = 0;
  
  // Phase 1 : Placer les combinaisons multiples d'abord
  sortedCombinations
    .filter(([key, _]) => key.includes(CONSTRAINTS_CONFIG.COMBINATION_SEPARATOR))
    .forEach(([constraintKey, count]) => {
      if (classIndex < availableClasses.length) {
        const className = availableClasses[classIndex];
        strategy.classAssignments[className] = {
          constraints: constraintKey,
          students: analysis.studentsByConstraint[constraintKey],
          count: count,
          type: 'MULTI_CONSTRAINT'
        };
        
        // Si la classe est trop petite, on peut la compléter
        if (count < targetClassSize * 0.5) {
          strategy.warnings.push(
            `Classe ${className}: seulement ${count} élèves avec ${constraintKey}. ` +
            `Considérez de compléter avec des élèves ayant une contrainte compatible.`
          );
        }
        
        classIndex++;
      }
    });
  
  // Phase 2 : Placer les contraintes simples
  sortedCombinations
    .filter(([key, _]) => !key.includes(CONSTRAINTS_CONFIG.COMBINATION_SEPARATOR) && key !== 'AUCUNE')
    .forEach(([constraintKey, count]) => {
      if (classIndex < availableClasses.length) {
        const className = availableClasses[classIndex];
        
        // Vérifier si on peut fusionner avec une classe existante
        let merged = false;
        for (const [existingClass, assignment] of Object.entries(strategy.classAssignments)) {
          if (assignment.count + count <= targetClassSize * 1.1) {
            // Fusionner si compatible
            const existingConstraints = assignment.constraints.split(CONSTRAINTS_CONFIG.COMBINATION_SEPARATOR);
            const newConstraints = constraintKey.split('=');
            
            // Vérifier la compatibilité
            let compatible = true;
            existingConstraints.forEach(ec => {
              const [type, value] = ec.split('=');
              if (constraintKey.startsWith(type + '=') && constraintKey !== ec) {
                compatible = false;
              }
            });
            
            if (compatible) {
              assignment.students = assignment.students.concat(analysis.studentsByConstraint[constraintKey]);
              assignment.count += count;
              assignment.constraints += ' + ' + constraintKey;
              assignment.type = 'MIXED';
              merged = true;
              break;
            }
          }
        }
        
        if (!merged) {
          strategy.classAssignments[className] = {
            constraints: constraintKey,
            students: analysis.studentsByConstraint[constraintKey],
            count: count,
            type: 'SINGLE_CONSTRAINT'
          };
          classIndex++;
        }
      }
    });
  
  // Phase 3 : Placer les élèves sans contrainte
  if (analysis.studentsByConstraint['AUCUNE'] && classIndex < availableClasses.length) {
    const remainingStudents = analysis.studentsByConstraint['AUCUNE'];
    const studentsPerClass = Math.ceil(remainingStudents.length / (availableClasses.length - classIndex));
    
    let studentIndex = 0;
    while (classIndex < availableClasses.length && studentIndex < remainingStudents.length) {
      const className = availableClasses[classIndex];
      const studentsForThisClass = remainingStudents.slice(
        studentIndex, 
        Math.min(studentIndex + studentsPerClass, remainingStudents.length)
      );
      
      strategy.classAssignments[className] = {
        constraints: 'AUCUNE',
        students: studentsForThisClass,
        count: studentsForThisClass.length,
        type: 'NO_CONSTRAINT'
      };
      
      studentIndex += studentsPerClass;
      classIndex++;
    }
  }
  
  // Générer des recommandations
  generateRecommendations(strategy, analysis, config);
  
  return strategy;
}

/**
 * Génère des recommandations basées sur la stratégie
 */
function generateRecommendations(strategy, analysis, config) {
  // Vérifier l'équilibre des classes
  const classSizes = Object.values(strategy.classAssignments).map(a => a.count);
  const avgSize = classSizes.reduce((sum, size) => sum + size, 0) / classSizes.length;
  const maxDeviation = Math.max(...classSizes.map(size => Math.abs(size - avgSize)));
  
  if (maxDeviation > 3) {
    strategy.recommendations.push(
      `Les effectifs des classes varient significativement (écart max: ${Math.round(maxDeviation)} élèves). ` +
      `Envisagez de rééquilibrer en déplaçant quelques élèves sans contrainte.`
    );
  }
  
  // Vérifier les combinaisons fréquentes
  const frequentCombos = Object.entries(analysis.combinations)
    .filter(([key, count]) => count >= 5 && key.includes(CONSTRAINTS_CONFIG.COMBINATION_SEPARATOR))
    .map(([key, count]) => `${key} (${count} élèves)`);
  
  if (frequentCombos.length > 0) {
    strategy.recommendations.push(
      `Combinaisons fréquentes détectées : ${frequentCombos.join(', ')}. ` +
      `Ces élèves ont été prioritairement regroupés.`
    );
  }
}

/**
 * Applique la stratégie de répartition dans _STRUCTURE
 * @param {Object} strategy - Stratégie générée
 * @returns {Object} Résultat de l'application
 */
function applyDistributionStrategy(strategy) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const structureSheet = ss.getSheetByName('_STRUCTURE');
    
    if (!structureSheet) {
      return { success: false, error: 'Feuille _STRUCTURE introuvable' };
    }
    
    // Lire la structure actuelle
    const data = structureSheet.getDataRange().getValues();
    let headerRow = -1;
    
    // Trouver l'en-tête
    for (let i = 0; i < Math.min(10, data.length); i++) {
      if (data[i].includes('CLASSE_DEST')) {
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
    let colConstraints = headers.indexOf('CONTRAINTES_MULTIPLES');
    
    // Ajouter la colonne CONTRAINTES_MULTIPLES si elle n'existe pas
    if (colConstraints === -1) {
      structureSheet.getRange(headerRow + 1, headers.length + 1).setValue('CONTRAINTES_MULTIPLES');
      colConstraints = headers.length;
    }
    
    // Mettre à jour chaque ligne
    for (let i = headerRow + 1; i < data.length; i++) {
      const classeDest = data[i][colDest];
      if (!classeDest) continue;
      
      const assignment = strategy.classAssignments[classeDest];
      if (!assignment) continue;
      
      // Formater les options pour la colonne OPTIONS
      const optionsFormatted = formatOptionsForStructure(assignment);
      
      // Écrire les valeurs
      structureSheet.getRange(i + 1, colOptions + 1).setValue(optionsFormatted);
      structureSheet.getRange(i + 1, colConstraints + 1).setValue(assignment.constraints);
    }
    
    SpreadsheetApp.flush();
    
    return { 
      success: true, 
      message: `${Object.keys(strategy.classAssignments).length} classes configurées avec contraintes multiples`,
      strategy: strategy
    };
    
  } catch (e) {
    console.error('Erreur lors de l\'application de la stratégie:', e);
    return { success: false, error: e.toString() };
  }
}

/**
 * Formate les options pour la colonne OPTIONS de _STRUCTURE
 * @param {Object} assignment - Assignment d'une classe
 * @returns {string} Options formatées
 */
function formatOptionsForStructure(assignment) {
  const optionCounts = {};
  
  assignment.students.forEach(student => {
    if (student.LV2) {
      optionCounts[student.LV2] = (optionCounts[student.LV2] || 0) + 1;
    }
    if (student.OPT) {
      optionCounts[student.OPT] = (optionCounts[student.OPT] || 0) + 1;
    }
  });
  
  return Object.entries(optionCounts)
    .map(([option, count]) => `${option}=${count}`)
    .join(',');
}

/**
 * Interface utilisateur pour configurer les contraintes multiples
 * @param {Object} analysisData - Données d'analyse préalable
 * @returns {string} HTML pour l'interface
 */
function generateConstraintConfigUI(analysisData) {
  const html = `
    <div class="constraint-config">
      <h3>Configuration des Contraintes Multiples</h3>
      
      <div class="summary">
        <h4>Résumé de l'analyse</h4>
        <ul>
          <li>Total élèves : ${analysisData.stats.totalStudents}</li>
          <li>Avec LV2 uniquement : ${analysisData.stats.studentsWithLV2 - analysisData.stats.studentsWithBoth}</li>
          <li>Avec Option uniquement : ${analysisData.stats.studentsWithOPT - analysisData.stats.studentsWithBoth}</li>
          <li>Avec LV2 ET Option : ${analysisData.stats.studentsWithBoth}</li>
          <li>Sans contrainte : ${analysisData.stats.studentsWithNone}</li>
        </ul>
      </div>
      
      <div class="combinations">
        <h4>Combinaisons détectées</h4>
        <table>
          <thead>
            <tr>
              <th>Contraintes</th>
              <th>Nombre d'élèves</th>
              <th>Classe suggérée</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(analysisData.combinations)
              .sort((a, b) => b[1] - a[1])
              .map(([constraints, count], index) => `
                <tr>
                  <td>${constraints}</td>
                  <td>${count}</td>
                  <td>
                    <select class="class-assignment" data-constraint="${constraints}">
                      <option value="">-- Non assigné --</option>
                      ${['5°1', '5°2', '5°3', '5°4', '5°5', '5°6'].map(c => 
                        `<option value="${c}">Classe ${c}</option>`
                      ).join('')}
                    </select>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="actions">
        <button onclick="applyConstraintConfig()">Appliquer la configuration</button>
        <button onclick="autoDistribute()">Distribution automatique</button>
      </div>
    </div>
    
    <style>
      .constraint-config {
        font-family: Arial, sans-serif;
        padding: 20px;
      }
      
      .summary {
        background-color: #f0f0f0;
        padding: 15px;
        border-radius: 5px;
        margin-bottom: 20px;
      }
      
      .combinations table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
      }
      
      .combinations th, .combinations td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }
      
      .combinations th {
        background-color: #4CAF50;
        color: white;
      }
      
      .class-assignment {
        width: 100%;
        padding: 5px;
      }
      
      .actions {
        margin-top: 20px;
      }
      
      .actions button {
        padding: 10px 20px;
        margin-right: 10px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
      }
      
      .actions button:hover {
        background-color: #45a049;
      }
    </style>
  `;
  
  return html;
}

/**
 * Fonction principale pour lancer l'analyse et la configuration
 */
function configureMultipleConstraints() {
  try {
    // Lire les données des élèves
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const testSheets = ss.getSheets().filter(sheet => sheet.getName().endsWith('_TEST'));
    
    if (testSheets.length === 0) {
      SpreadsheetApp.getUi().alert('Aucun onglet TEST trouvé. Lancez d\'abord le pipeline.');
      return;
    }
    
    // Collecter tous les élèves
    const allStudents = [];
    testSheets.forEach(sheet => {
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      for (let i = 1; i < data.length; i++) {
        const student = {};
        headers.forEach((header, index) => {
          student[header] = data[i][index];
        });
        if (student['ID_ELEVE']) {
          allStudents.push(student);
        }
      }
    });
    
    // Analyser les contraintes
    const analysis = analyzeStudentConstraints(allStudents);
    
    // Générer la stratégie
    const strategy = generateDistributionStrategy(analysis, {
      targetClassSize: 28,
      availableClasses: ['5°1', '5°2', '5°3', '5°4', '5°5', '5°6']
    });
    
    // Afficher l'interface
    const html = HtmlService.createHtmlOutput(generateConstraintConfigUI(analysis))
      .setWidth(800)
      .setHeight(600);
    
    SpreadsheetApp.getUi().showModalDialog(html, 'Configuration des Contraintes Multiples');
    
    // Stocker la stratégie dans les propriétés du script pour utilisation ultérieure
    PropertiesService.getScriptProperties().setProperty(
      'currentStrategy', 
      JSON.stringify(strategy)
    );
    
  } catch (e) {
    console.error('Erreur lors de la configuration:', e);
    SpreadsheetApp.getUi().alert('Erreur: ' + e.toString());
  }
}

/**
 * Menu pour tester les contraintes multiples
 */
function onOpen_MultipleConstraints() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🎯 Contraintes Multiples')
    .addItem('📊 Analyser les contraintes', 'analyzeConstraintsMenu')
    .addItem('⚙️ Configurer la répartition', 'configureMultipleConstraints')
    .addItem('🚀 Appliquer la stratégie', 'applyStrategyMenu')
    .addToUi();
}

/**
 * Fonction de menu pour analyser les contraintes
 */
function analyzeConstraintsMenu() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const testSheets = ss.getSheets().filter(sheet => sheet.getName().endsWith('_TEST'));
  
  if (testSheets.length === 0) {
    SpreadsheetApp.getUi().alert('Aucun onglet TEST trouvé.');
    return;
  }
  
  const allStudents = [];
  testSheets.forEach(sheet => {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      const student = {};
      headers.forEach((header, index) => {
        student[header] = data[i][index];
      });
      if (student['ID_ELEVE']) {
        allStudents.push(student);
      }
    }
  });
  
  const analysis = analyzeStudentConstraints(allStudents);
  
  // Afficher le résultat
  let message = 'Analyse des contraintes:\n\n';
  message += `Total élèves: ${analysis.stats.totalStudents}\n`;
  message += `Avec LV2: ${analysis.stats.studentsWithLV2}\n`;
  message += `Avec Option: ${analysis.stats.studentsWithOPT}\n`;
  message += `Avec les deux: ${analysis.stats.studentsWithBoth}\n`;
  message += `Sans contrainte: ${analysis.stats.studentsWithNone}\n\n`;
  message += 'Combinaisons principales:\n';
  
  Object.entries(analysis.combinations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([combo, count]) => {
      message += `- ${combo}: ${count} élèves\n`;
    });
  
  SpreadsheetApp.getUi().alert(message);
}

/**
 * Fonction de menu pour appliquer la stratégie
 */
function applyStrategyMenu() {
  try {
    const strategyJson = PropertiesService.getScriptProperties().getProperty('currentStrategy');
    if (!strategyJson) {
      SpreadsheetApp.getUi().alert('Aucune stratégie configurée. Lancez d\'abord la configuration.');
      return;
    }
    
    const strategy = JSON.parse(strategyJson);
    const result = applyDistributionStrategy(strategy);
    
    if (result.success) {
      SpreadsheetApp.getUi().alert('Stratégie appliquée avec succès: ' + result.message);
    } else {
      SpreadsheetApp.getUi().alert('Erreur: ' + result.error);
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert('Erreur: ' + e.toString());
  }
}
