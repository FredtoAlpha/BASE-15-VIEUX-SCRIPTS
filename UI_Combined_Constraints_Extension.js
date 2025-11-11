/**
 * ===================================================================
 * EXTENSION UI POUR CONTRAINTES COMBINÉES
 * ===================================================================
 * 
 * Ce code JavaScript ajoute la gestion des contraintes combinées
 * dans l'interface OptimizationPanel.html
 * 
 * FONCTIONNALITÉS :
 * - Détection automatique des élèves avec contraintes multiples
 * - Interface pour allouer les groupes combinés
 * - Visualisation des intersections
 * - Suggestions d'allocation intelligente
 * 
 * À INTÉGRER dans OptimizationPanel.html
 * ===================================================================
 */

// ===================================================================
// SECTION 1 : ANALYSE DES CONTRAINTES
// ===================================================================

/**
 * Analyse les données TEST pour détecter les contraintes combinées
 * @returns {Object} Analyse complète des contraintes
 */
async function analyzeTestConstraints() {
  console.log('🔍 Analyse des contraintes dans TEST...');
  
  try {
    // Appeler la fonction côté serveur
    const stats = await gs('getConstraintStatistics');
    
    if (stats.error) {
      throw new Error(stats.error);
    }
    
    console.log('📊 Statistiques des contraintes:', stats);
    
    // Afficher les résultats
    displayConstraintAnalysis(stats);
    
    return stats;
  } catch (error) {
    console.error('❌ Erreur analyse contraintes:', error);
    showError('Erreur lors de l\'analyse des contraintes: ' + error.message);
  }
}

/**
 * Affiche l'analyse des contraintes dans l'UI
 * @param {Object} stats - Statistiques des contraintes
 */
function displayConstraintAnalysis(stats) {
  // Créer le HTML pour l'affichage
  let html = '<div class="constraint-analysis">';
  
  // Résumé
  html += '<h4>📊 Analyse des contraintes</h4>';
  html += '<div class="summary">';
  html += `<p>Total élèves: <strong>${stats.total}</strong></p>`;
  html += '</div>';
  
  // LV2
  if (Object.keys(stats.lv2Count).length > 0) {
    html += '<div class="lv2-section">';
    html += '<h5>Langues vivantes (LV2)</h5>';
    html += '<ul>';
    for (const [lv2, count] of Object.entries(stats.lv2Count)) {
      html += `<li>${lv2}: ${count} élèves</li>`;
    }
    html += '</ul>';
    html += '</div>';
  }
  
  // Options
  if (Object.keys(stats.optCount).length > 0) {
    html += '<div class="opt-section">';
    html += '<h5>Options (OPT)</h5>';
    html += '<ul>';
    for (const [opt, count] of Object.entries(stats.optCount)) {
      html += `<li>${opt}: ${count} élèves</li>`;
    }
    html += '</ul>';
    html += '</div>';
  }
  
  // Combinaisons détectées
  if (Object.keys(stats.combinations).length > 0) {
    html += '<div class="combinations-section alert alert-warning">';
    html += '<h5>⚠️ Contraintes combinées détectées</h5>';
    html += '<p>Les élèves suivants ont plusieurs contraintes :</p>';
    html += '<ul>';
    for (const [combo, count] of Object.entries(stats.combinations)) {
      const [lv2, opt] = combo.split('+');
      const lv2Total = stats.lv2Count[lv2] || 0;
      const optTotal = stats.optCount[opt] || 0;
      const percentage = Math.round((count / Math.min(lv2Total, optTotal)) * 100);
      
      html += `<li>`;
      html += `<strong>${count} élèves</strong> ont ${lv2} ET ${opt} `;
      html += `<span class="badge">${percentage}% d'intersection</span>`;
      html += `</li>`;
    }
    html += '</ul>';
    html += '</div>';
  }
  
  html += '</div>';
  
  // Insérer dans l'UI
  const container = document.getElementById('constraint-analysis-container');
  if (container) {
    container.innerHTML = html;
    container.style.display = 'block';
  }
}

// ===================================================================
// SECTION 2 : INTERFACE DE GESTION DES CONTRAINTES COMBINÉES
// ===================================================================

/**
 * Crée l'interface pour gérer les contraintes combinées
 * @param {Object} stats - Statistiques des contraintes
 */
function createCombinedConstraintsUI(stats) {
  if (!stats.combinations || Object.keys(stats.combinations).length === 0) {
    console.log('Aucune contrainte combinée détectée');
    return;
  }
  
  const container = document.getElementById('combined-constraints-container');
  if (!container) {
    console.error('Container combined-constraints-container non trouvé');
    return;
  }
  
  let html = '<div class="combined-constraints-panel">';
  html += '<h4>🔗 Gestion des contraintes combinées</h4>';
  html += '<p>Définissez comment répartir les élèves avec contraintes multiples :</p>';
  
  // Pour chaque combinaison détectée
  Object.entries(stats.combinations).forEach(([combo, count]) => {
    const [lv2, opt] = combo.split('+');
    const comboId = combo.replace('+', '_');
    
    html += `<div class="combo-allocation" data-combo="${combo}">`;
    html += `<h5>${count} élèves avec ${lv2} + ${opt}</h5>`;
    
    // Options d'allocation
    html += '<div class="allocation-options">';
    
    // Option 1 : Allouer ensemble
    html += '<div class="form-check">';
    html += `<input class="form-check-input" type="radio" name="alloc_${comboId}" id="together_${comboId}" value="together" checked>`;
    html += `<label class="form-check-label" for="together_${comboId}">`;
    html += 'Garder ensemble dans une classe dédiée';
    html += '</label>';
    html += `<select class="form-control mt-2 class-select" id="class_together_${comboId}">`;
    html += '<option value="">-- Sélectionner une classe --</option>';
    
    // Ajouter les classes disponibles
    const classes = getAvailableClasses();
    classes.forEach(cls => {
      html += `<option value="${cls}">${cls}</option>`;
    });
    
    html += '</select>';
    html += '</div>';
    
    // Option 2 : Séparer
    html += '<div class="form-check mt-3">';
    html += `<input class="form-check-input" type="radio" name="alloc_${comboId}" id="separate_${comboId}" value="separate">`;
    html += `<label class="form-check-label" for="separate_${comboId}">`;
    html += 'Séparer selon la contrainte prioritaire';
    html += '</label>';
    html += '<div class="priority-options ml-3 mt-2" style="display:none;">';
    html += `<label><input type="radio" name="priority_${comboId}" value="lv2" checked> Priorité ${lv2}</label><br>`;
    html += `<label><input type="radio" name="priority_${comboId}" value="opt"> Priorité ${opt}</label>`;
    html += '</div>';
    html += '</div>';
    
    html += '</div>'; // allocation-options
    html += '</div>'; // combo-allocation
  });
  
  // Bouton de validation
  html += '<button class="btn btn-primary mt-3" onclick="applyCombinedConstraints()">Appliquer les contraintes combinées</button>';
  html += '</div>';
  
  container.innerHTML = html;
  container.style.display = 'block';
  
  // Ajouter les event listeners
  setupCombinedConstraintsListeners();
}

/**
 * Configure les event listeners pour l'interface des contraintes combinées
 */
function setupCombinedConstraintsListeners() {
  // Montrer/cacher les options de priorité
  document.querySelectorAll('input[type="radio"][name^="alloc_"]').forEach(radio => {
    radio.addEventListener('change', function() {
      const comboId = this.name.replace('alloc_', '');
      const priorityDiv = this.closest('.allocation-options').querySelector('.priority-options');
      const classSelect = document.getElementById(`class_together_${comboId}`);
      
      if (this.value === 'separate') {
        priorityDiv.style.display = 'block';
        classSelect.style.display = 'none';
      } else {
        priorityDiv.style.display = 'none';
        classSelect.style.display = 'block';
      }
    });
  });
}

/**
 * Récupère les classes disponibles depuis la configuration
 * @returns {Array} Liste des classes
 */
function getAvailableClasses() {
  // Récupérer depuis la configuration existante
  const config = window.currentOptimizationConfig || {};
  return config.levels || ['5°1', '5°2', '5°3', '5°4', '5°5', '5°6'];
}

// ===================================================================
// SECTION 3 : APPLICATION DES CONTRAINTES
// ===================================================================

/**
 * Applique les contraintes combinées définies par l'utilisateur
 */
async function applyCombinedConstraints() {
  console.log('✅ Application des contraintes combinées...');
  
  // Collecter les décisions de l'utilisateur
  const allocations = {};
  
  document.querySelectorAll('.combo-allocation').forEach(div => {
    const combo = div.dataset.combo;
    const comboId = combo.replace('+', '_');
    
    const allocType = document.querySelector(`input[name="alloc_${comboId}"]:checked`).value;
    
    if (allocType === 'together') {
      const targetClass = document.getElementById(`class_together_${comboId}`).value;
      if (targetClass) {
        allocations[combo] = {
          type: 'together',
          targetClass: targetClass
        };
      }
    } else {
      const priority = document.querySelector(`input[name="priority_${comboId}"]:checked`).value;
      allocations[combo] = {
        type: 'separate',
        priority: priority
      };
    }
  });
  
  console.log('📋 Allocations définies:', allocations);
  
  // Mettre à jour la configuration
  updateConfigWithCombinedAllocations(allocations);
}

/**
 * Met à jour la configuration avec les allocations de contraintes combinées
 * @param {Object} allocations - Décisions d'allocation
 */
function updateConfigWithCombinedAllocations(allocations) {
  const config = window.currentOptimizationConfig || {};
  
  // Initialiser la structure si nécessaire
  if (!config.quotas) config.quotas = {};
  
  // Pour chaque allocation
  Object.entries(allocations).forEach(([combo, allocation]) => {
    const [lv2, opt] = combo.split('+');
    
    if (allocation.type === 'together') {
      // Allouer ensemble dans la classe cible
      const targetClass = allocation.targetClass;
      
      if (!config.quotas[targetClass]) {
        config.quotas[targetClass] = {};
      }
      
      // Ajouter la contrainte combinée
      if (!config.quotas[targetClass].COMBINED) {
        config.quotas[targetClass].COMBINED = {};
      }
      
      // Récupérer le nombre d'élèves depuis les stats
      const stats = window.lastConstraintStats || {};
      const count = (stats.combinations && stats.combinations[combo]) || 0;
      
      config.quotas[targetClass].COMBINED[combo] = count;
      
      console.log(`✅ ${count} élèves ${combo} → ${targetClass}`);
      
    } else {
      // Séparer selon la priorité
      console.log(`ℹ️ Séparation ${combo} selon priorité ${allocation.priority}`);
      // La logique de séparation sera gérée côté serveur
    }
  });
  
  // Mettre à jour la configuration globale
  window.currentOptimizationConfig = config;
  
  // Mettre à jour l'affichage
  updateQuotaDisplay();
}

/**
 * Met à jour l'affichage des quotas avec les contraintes combinées
 */
function updateQuotaDisplay() {
  const config = window.currentOptimizationConfig || {};
  
  Object.entries(config.quotas || {}).forEach(([className, quotas]) => {
    // Afficher les contraintes combinées si présentes
    if (quotas.COMBINED) {
      Object.entries(quotas.COMBINED).forEach(([combo, count]) => {
        console.log(`📍 ${className}: ${combo} = ${count} élèves`);
        
        // Mettre à jour l'UI
        const classDiv = document.querySelector(`[data-class="${className}"]`);
        if (classDiv) {
          // Ajouter un badge pour les contraintes combinées
          let badgeContainer = classDiv.querySelector('.combined-badges');
          if (!badgeContainer) {
            badgeContainer = document.createElement('div');
            badgeContainer.className = 'combined-badges mt-2';
            classDiv.appendChild(badgeContainer);
          }
          
          const badge = document.createElement('span');
          badge.className = 'badge badge-warning mr-1';
          badge.textContent = `${combo}: ${count}`;
          badgeContainer.appendChild(badge);
        }
      });
    }
  });
}

// ===================================================================
// SECTION 4 : MODIFICATION DE runOptimizationStreaming
// ===================================================================

/**
 * Extension de runOptimizationStreaming pour gérer les contraintes combinées
 * Cette fonction remplace des parties spécifiques de la fonction originale
 */
function enhanceOptimizationWithCombined() {
  // Sauvegarder la fonction originale
  const originalRunOptimization = window.runOptimizationStreaming;
  
  // Remplacer par une version améliorée
  window.runOptimizationStreaming = async function() {
    console.log('🚀 Lancement optimisation avec contraintes combinées...');
    
    // Analyser d'abord les contraintes
    const stats = await analyzeTestConstraints();
    window.lastConstraintStats = stats;
    
    // Si des contraintes combinées sont détectées, afficher l'UI
    if (stats && stats.combinations && Object.keys(stats.combinations).length > 0) {
      createCombinedConstraintsUI(stats);
      
      // Demander confirmation avant de continuer
      const proceed = confirm(
        'Des élèves avec contraintes multiples ont été détectés.\n' +
        'Voulez-vous configurer leur répartition avant de lancer l\'optimisation ?'
      );
      
      if (proceed) {
        // Attendre que l'utilisateur configure les contraintes
        console.log('⏸️ En attente de la configuration des contraintes combinées...');
        return;
      }
    }
    
    // Continuer avec l'optimisation normale
    return originalRunOptimization.apply(this, arguments);
  };
}

// ===================================================================
// SECTION 5 : STYLES CSS
// ===================================================================

/**
 * Ajoute les styles CSS pour l'interface des contraintes combinées
 */
function addCombinedConstraintsStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .constraint-analysis {
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 5px;
      padding: 15px;
      margin-bottom: 20px;
    }
    
    .constraint-analysis h4 {
      color: #495057;
      margin-bottom: 15px;
    }
    
    .constraint-analysis .summary {
      font-size: 1.1em;
      margin-bottom: 15px;
    }
    
    .combinations-section {
      background-color: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 5px;
      padding: 10px;
      margin-top: 15px;
    }
    
    .combinations-section .badge {
      background-color: #ff7675;
      color: white;
      padding: 3px 8px;
      border-radius: 10px;
      font-size: 0.8em;
    }
    
    .combined-constraints-panel {
      background-color: #f8f9fa;
      border: 2px solid #007bff;
      border-radius: 5px;
      padding: 20px;
      margin: 20px 0;
    }
    
    .combo-allocation {
      background-color: white;
      border: 1px solid #dee2e6;
      border-radius: 5px;
      padding: 15px;
      margin-bottom: 15px;
    }
    
    .combo-allocation h5 {
      color: #007bff;
      margin-bottom: 10px;
    }
    
    .allocation-options {
      margin-left: 10px;
    }
    
    .class-select {
      max-width: 200px;
    }
    
    .priority-options {
      background-color: #f1f3f4;
      padding: 10px;
      border-radius: 3px;
    }
    
    .combined-badges .badge {
      font-size: 0.85em;
    }
  `;
  
  document.head.appendChild(style);
}

// ===================================================================
// SECTION 6 : INITIALISATION
// ===================================================================

/**
 * Initialise le système de contraintes combinées
 * À appeler au chargement de la page
 */
function initCombinedConstraints() {
  console.log('🔧 Initialisation du système de contraintes combinées...');
  
  // Ajouter les styles
  addCombinedConstraintsStyles();
  
  // Ajouter les conteneurs HTML nécessaires s'ils n'existent pas
  if (!document.getElementById('constraint-analysis-container')) {
    const container = document.createElement('div');
    container.id = 'constraint-analysis-container';
    container.style.display = 'none';
    
    // Insérer après le panneau de configuration principal
    const mainPanel = document.querySelector('.optimization-panel');
    if (mainPanel) {
      mainPanel.parentNode.insertBefore(container, mainPanel.nextSibling);
    }
  }
  
  if (!document.getElementById('combined-constraints-container')) {
    const container = document.createElement('div');
    container.id = 'combined-constraints-container';
    container.style.display = 'none';
    
    // Insérer après l'analyse des contraintes
    const analysisContainer = document.getElementById('constraint-analysis-container');
    if (analysisContainer) {
      analysisContainer.parentNode.insertBefore(container, analysisContainer.nextSibling);
    }
  }
  
  // Améliorer la fonction d'optimisation
  enhanceOptimizationWithCombined();
  
  // Ajouter un bouton d'analyse si nécessaire
  const toolbar = document.querySelector('.toolbar');
  if (toolbar && !document.getElementById('analyze-constraints-btn')) {
    const btn = document.createElement('button');
    btn.id = 'analyze-constraints-btn';
    btn.className = 'btn btn-info';
    btn.innerHTML = '🔍 Analyser contraintes';
    btn.onclick = analyzeTestConstraints;
    toolbar.appendChild(btn);
  }
  
  console.log('✅ Système de contraintes combinées initialisé');
}

// Appeler l'initialisation au chargement
document.addEventListener('DOMContentLoaded', initCombinedConstraints);

// Export des fonctions pour utilisation externe
window.analyzeTestConstraints = analyzeTestConstraints;
window.applyCombinedConstraints = applyCombinedConstraints;
window.createCombinedConstraintsUI = createCombinedConstraintsUI;
