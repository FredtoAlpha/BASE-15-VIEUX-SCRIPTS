/**
 * ===================================================================
 * PHASE 1 V15 - PLACEMENT INTELLIGENT PAR CAPACITÉS
 * ===================================================================
 *
 * Nouvelle approche centrée sur les ÉLÈVES plutôt que les QUOTAS
 * - Charge la configuration de capacités (quelles classes offrent quelles options)
 * - Trie les élèves par nombre de contraintes (multi-contraintes en premier)
 * - Place chaque élève dans une classe compatible qui offre TOUTES ses contraintes
 */

/**
 * ✅ V15 : Phase 1 avec placement intelligent par capacités
 *
 * DIFFÉRENCES avec V12 :
 * - V12 : Approche "quota-first" (traiter chaque quota séparément)
 * - V15 : Approche "student-first" (traiter chaque élève en vérifiant toutes ses contraintes)
 *
 * EXEMPLE V15 :
 * Config capacités : 6°1=[CHAV], 6°2=[ITA,CHAV], 6°3=[ITA]
 * Quotas : 6°2 = ITA:8, CHAV:8
 *
 * Tri élèves (multi-contraintes first) :
 *   1. 6 élèves ITA+CHAV → placés en 6°2 (seule classe compatible)
 *   2. 2 élèves ITA seul → placés en 6°2 (ITA 8/8 complet) ou 6°3
 *   3. 5 élèves CHAV seul → placés en 6°1 (6°2 CHAV déjà complet)
 *
 * LIT : _BASEOPTI (colonne _CLASS_ASSIGNED vide)
 * ÉCRIT : _BASEOPTI (remplit _CLASS_ASSIGNED)
 */
function Phase1I_dispatchOptionsLV2_BASEOPTI_V15(ctx) {
  logLine('INFO', '='.repeat(80));
  logLine('INFO', '📌 PHASE 1 V15 - Placement intelligent par capacités');
  logLine('INFO', '='.repeat(80));

  const ss = ctx.ss || SpreadsheetApp.getActive();
  const baseSheet = ss.getSheetByName('_BASEOPTI');

  if (!baseSheet) {
    throw new Error('_BASEOPTI introuvable');
  }

  const data = baseSheet.getDataRange().getValues();
  const headers = data[0];

  const idxLV2 = headers.indexOf('LV2');
  const idxOPT = headers.indexOf('OPT');
  const idxAssigned = headers.indexOf('_CLASS_ASSIGNED');
  const idxNom = headers.indexOf('NOM');
  const idxPrenom = headers.indexOf('PRENOM');

  if (idxAssigned === -1) {
    throw new Error('Colonne _CLASS_ASSIGNED manquante');
  }

  // ✅ V15 : Charger la matrice de capacités
  logLine('INFO', '🔍 Chargement de la configuration des capacités...');
  const capabilities = loadClassCapabilities_();

  if (!capabilities) {
    logLine('WARN', '⚠️ Aucune configuration de capacités trouvée');
    throw new Error('❌ V15 requiert une configuration de capacités. Utilisez l\'UI OPTI pour configurer quelles classes offrent quelles options.');
  }

  logLine('INFO', '✅ Capacités chargées pour ' + Object.keys(capabilities).length + ' classe(s)');

  // Afficher la configuration pour debug
  for (const classe in capabilities) {
    const opts = [];
    for (const opt in capabilities[classe]) {
      if (capabilities[classe][opt] === true) {
        opts.push(opt);
      }
    }
    if (opts.length > 0) {
      logLine('INFO', '  ' + classe + ' offre: ' + opts.join(', '));
    }
  }

  // ✅ Analyser les multi-contraintes
  logLine('INFO', '');
  logLine('INFO', '🔍 Analyse des contraintes multiples...');
  const analysis = analyzeMultiConstraints_('_BASEOPTI');

  // ✅ Extraire tous les élèves avec leurs contraintes
  const students = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const assigned = String(row[idxAssigned] || '').trim();

    if (assigned) continue; // Déjà placé

    const opt = idxOPT >= 0 ? String(row[idxOPT] || '').trim().toUpperCase() : '';
    const lv2 = idxLV2 >= 0 ? String(row[idxLV2] || '').trim().toUpperCase() : '';
    const nom = idxNom >= 0 ? String(row[idxNom] || '').trim() : '';
    const prenom = idxPrenom >= 0 ? String(row[idxPrenom] || '').trim() : '';

    const constraints = [];
    if (opt) constraints.push(opt);
    if (lv2 && lv2 !== 'ESP') constraints.push(lv2);

    if (constraints.length > 0) {
      students.push({
        rowIndex: i,
        nom: nom,
        prenom: prenom,
        constraints: constraints,
        constraintCount: constraints.length
      });
    }
  }

  // ✅ Trier par nombre de contraintes (multi-contraintes EN PREMIER)
  students.sort((a, b) => b.constraintCount - a.constraintCount);

  logLine('INFO', '📊 ' + students.length + ' élève(s) à placer');
  const multiCount = students.filter(s => s.constraintCount > 1).length;
  if (multiCount > 0) {
    logLine('INFO', '🔗 Dont ' + multiCount + ' multi-contraintes (prioritaires)');
  }

  // ✅ Initialiser les quotas restants pour chaque classe
  const remainingQuotas = {};
  for (const classe in (ctx.quotas || {})) {
    remainingQuotas[classe] = {};
    for (const constraint in ctx.quotas[classe]) {
      remainingQuotas[classe][constraint] = ctx.quotas[classe][constraint];
    }
  }

  // ✅ Placer les élèves un par un
  const stats = { placed: 0, unplaced: 0, byConstraint: {}, byClass: {} };
  const placementLog = [];

  logLine('INFO', '');
  logLine('INFO', '🎯 Placement des élèves (tri: multi-contraintes d\'abord)');
  logLine('INFO', '-'.repeat(80));

  for (const student of students) {
    let placed = false;

    // Trouver une classe compatible
    for (const classe in remainingQuotas) {
      // ✅ V15 : Vérifier que la classe offre TOUTES les contraintes
      const classCapabilities = capabilities[classe];
      if (!classCapabilities) {
        continue; // Classe non configurée, skip
      }

      let canAcceptAll = true;
      for (const constraint of student.constraints) {
        if (!classCapabilities[constraint]) {
          canAcceptAll = false;
          break;
        }
      }

      if (!canAcceptAll) {
        continue; // Cette classe ne peut pas accepter toutes les contraintes
      }

      // ✅ Vérifier que la classe a encore du quota pour TOUTES les contraintes
      let hasQuotaForAll = true;
      for (const constraint of student.constraints) {
        const quota = remainingQuotas[classe][constraint] || 0;
        if (quota <= 0) {
          hasQuotaForAll = false;
          break;
        }
      }

      if (!hasQuotaForAll) {
        continue; // Pas assez de quota
      }

      // ✅ PLACER l'élève
      data[student.rowIndex][idxAssigned] = classe;

      // Décrémenter tous les quotas
      for (const constraint of student.constraints) {
        remainingQuotas[classe][constraint]--;
        stats.byConstraint[constraint] = (stats.byConstraint[constraint] || 0) + 1;
      }

      stats.byClass[classe] = (stats.byClass[classe] || 0) + 1;
      stats.placed++;
      placed = true;

      const constraintStr = student.constraints.join('+');
      const nameStr = (student.prenom + ' ' + student.nom).trim() || '(sans nom)';
      placementLog.push('  ✅ ' + nameStr + ' (' + constraintStr + ') → ' + classe);

      break; // Élève placé, passer au suivant
    }

    if (!placed) {
      stats.unplaced++;
      const constraintStr = student.constraints.join('+');
      const nameStr = (student.prenom + ' ' + student.nom).trim() || '(sans nom)';
      placementLog.push('  ⚠️ ' + nameStr + ' (' + constraintStr + ') → NON PLACÉ (aucune classe compatible ou quotas épuisés)');
    }
  }

  // Afficher les logs de placement (limiter à 20 premières lignes pour lisibilité)
  const logLimit = 20;
  placementLog.slice(0, logLimit).forEach(line => logLine('INFO', line));
  if (placementLog.length > logLimit) {
    logLine('INFO', '  ... (et ' + (placementLog.length - logLimit) + ' autres placements)');
  }

  logLine('INFO', '');
  logLine('INFO', '📊 Résumé placement V15:');
  logLine('INFO', '  • Placés: ' + stats.placed + '/' + students.length);
  logLine('INFO', '  • Non placés: ' + stats.unplaced);

  // Afficher quotas restants par classe
  logLine('INFO', '');
  logLine('INFO', '📊 Quotas utilisés par classe:');
  for (const classe in remainingQuotas) {
    const quotas = remainingQuotas[classe];
    const parts = [];
    for (const constraint in quotas) {
      const remaining = quotas[constraint];
      const initial = (ctx.quotas[classe] || {})[constraint] || 0;
      const used = initial - remaining;
      parts.push(constraint + ':' + used + '/' + initial);
    }
    if (parts.length > 0) {
      const placedCount = stats.byClass[classe] || 0;
      logLine('INFO', '  ' + classe + ' (' + placedCount + ' élèves) : ' + parts.join(', '));
    }
  }

  // Écrire dans _BASEOPTI
  baseSheet.getRange(1, 1, data.length, headers.length).setValues(data);
  SpreadsheetApp.flush();

  // Sync vers colonnes legacy pour compatibilité audit
  syncClassAssignedToLegacy_('P1');

  // ✅ CALCUL MOBILITÉ : Déterminer FIXE/PERMUT/LIBRE après Phase 1
  if (typeof computeMobilityFlags_ === 'function') {
    computeMobilityFlags_(ctx);
  } else {
    logLine('WARN', '⚠️ computeMobilityFlags_ non disponible (vérifier que Mobility_System.gs est chargé)');
  }

  logLine('INFO', '');
  logLine('INFO', '✅ PHASE 1 V15 terminée - Placement par capacités !');
  logLine('INFO', '='.repeat(80));

  return { ok: true, stats: stats, analysis: analysis };
}
