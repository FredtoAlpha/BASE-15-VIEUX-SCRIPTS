# 🚀 DÉPLOIEMENT CONSOLE

Ce dossier contient UNIQUEMENT les fichiers nécessaires pour le menu CONSOLE.

## 📋 Contenu (10 fichiers)

### Fichiers principaux
1. **Code.gs** - Menu CONSOLE + LEGACY + fonction testMenus()
2. **PanneauControle.html** - Interface sidebar
3. **appsscript.json** - Manifest Apps Script

### Scripts récupérés (VIEUX-SCRIPTS)
4. **Initialisation.gs** - Création automatique des onglets sources
5. **Structure.gs** - Gestion _STRUCTURE
6. **Config.gs** - Configuration centralisée
7. **GenereNOMprenomID.gs** - Génération ID élèves
8. **ListesDeroulantes.gs** - Listes déroulantes
9. **COMPTER.gs** - Rapports statistiques
10. **Consolidation.gs** - Fusion onglets sources
11. **Utils_VIEUX.gs** - Fonctions utilitaires

## 🔧 Instructions de déploiement

### 1️⃣ Aller dans le dossier
```powershell
cd "C:\OUTIL 25 26\DOSSIER BASE 15 VIEUX SCRIPTS\BASE 15 v1\CONSOLE_DEPLOY"
```

### 2️⃣ Vérifier la connexion
```powershell
clasp login --status
```

### 3️⃣ Pousser vers Apps Script
```powershell
clasp push --force
```

### 4️⃣ Vérifier le projet
Ouvrir : https://script.google.com/home/projects/1DPLbFgn109nQm8PW4rnYuo1L8uyG-uFaUymbf3tWQwummzF3fjQF_qsZ/edit

### 5️⃣ Tester la fonction testMenus()
1. Dans Apps Script, sélectionner fonction `testMenus`
2. Cliquer ▶️ Exécuter
3. Consulter logs : View → Logs (Ctrl+Enter)

## ✅ Résultat attendu

Après `clasp push --force`, vous devriez avoir dans Apps Script :
- Menu CONSOLE avec 10 items
- Menu LEGACY avec pipeline complet
- Fonction testMenus() pour diagnostic
- Tous les scripts récupérés fonctionnels
