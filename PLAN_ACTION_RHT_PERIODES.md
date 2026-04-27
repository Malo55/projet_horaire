# Plan d'action : Ajout de la gestion dynamique des périodes RHT

## 📋 Objectif
Permettre l'ajout et la suppression dynamique de plusieurs périodes RHT Phase 1 et Phase 2 via des boutons + et corbeille dans les paramètres.

---

## 🔍 Analyse de l'existant

### Structure actuelle
- **RHT Phase 1** : Une seule période avec :
  - Checkbox activation/désactivation
  - Date début (JJ.MM.AA)
  - Date fin (JJ.MM.AA)
  
- **RHT Phase 2** : Une seule période avec :
  - Checkbox activation/désactivation
  - Date début (JJ.MM.AA)
  - Date fin (JJ.MM.AA)
  - Heures/jour (décimal + HH:MM)
  - Pause offerte (minutes)
  - Plages horaires (arrivée min/max, départ min/max)

### Stockage actuel (localStorage)
- `param-rht-phase1-enabled`
- `param-rht-phase1-debut`
- `param-rht-phase1-fin`
- `rht_enabled`
- `rht_debut`
- `rht_fin`
- `rht_heures_dec`
- `rht_heures_hhmm`
- `rht_pause_offerte`
- `rhtPlageArriveeMin`
- `rhtPlageArriveeMax`
- `rhtPlageDepartMin`
- `rhtPlageDepartMax`

### Fonctions existantes à modifier
- `isDateInRHTPhase1(dateStr)` - Vérifie si une date est en Phase 1
- `isDateInRHT(dateStr)` - Vérifie si une date est en Phase 2
- `verifierChevauchementRHT()` - Vérifie les chevauchements
- `getHeuresJourMinutesEffective(dateStr)` - Récupère les heures/jour selon la période
- `getPauseOfferteEffective(dateStr)` - Récupère la pause offerte selon la période
- `calculerHeuresSupCalculette()` - Utilise les périodes RHT
- Tous les event listeners dans la section paramètres RHT

---

## 🎯 Plan d'action détaillé

### Phase 1 : Refactorisation du stockage

#### 1.1 Nouveau format de stockage
**Remplacer les clés simples par des tableaux JSON :**

```javascript
// Nouveau format
rht_periodes_phase1: [
  {
    id: "uuid-v4",
    enabled: true,
    debut: "01.01.24",
    fin: "31.01.24"
  },
  {
    id: "uuid-v4",
    enabled: false,
    debut: "01.02.24",
    fin: "28.02.24"
  }
]

rht_periodes_phase2: [
  {
    id: "uuid-v4",
    enabled: true,
    debut: "01.03.24",
    fin: "31.03.24",
    heuresJour: 7.5,
    heuresJourHHMM: "07:30",
    pauseOfferte: 15,
    plageArriveeMin: "08:00",
    plageArriveeMax: "10:00",
    plageDepartMin: "15:45",
    plageDepartMax: "18:00"
  }
]
```

#### 1.2 Migration des données existantes
- Créer une fonction `migrerDonneesRHT()` qui :
  - Vérifie si les nouvelles clés existent
  - Si non, migre les anciennes données vers le nouveau format
  - Supprime les anciennes clés (optionnel, pour garder la compatibilité)

---

### Phase 2 : Refactorisation de l'interface HTML

#### 2.1 Structure HTML dynamique
**Remplacer les blocs statiques par des conteneurs dynamiques :**

```html
<!-- RHT Phase 1 -->
<div id="rht-phase1-container">
  <!-- Les périodes seront ajoutées dynamiquement ici -->
</div>
<button id="btn-add-phase1">+ Ajouter une période Phase 1</button>

<!-- RHT Phase 2 -->
<div id="rht-phase2-container">
  <!-- Les périodes seront ajoutées dynamiquement ici -->
</div>
<button id="btn-add-phase2">+ Ajouter une période Phase 2</button>
```

#### 2.2 Template de période
- Créer des fonctions pour générer le HTML d'une période :
  - `genererHTMLPhase1(periode)` - Génère le HTML d'une période Phase 1
  - `genererHTMLPhase2(periode)` - Génère le HTML d'une période Phase 2

#### 2.3 Boutons d'action
- Chaque période aura :
  - Un bouton **+** pour ajouter une nouvelle période après celle-ci
  - Un bouton **🗑️** (corbeille) pour supprimer la période
  - Un bouton **✓** (activation) au lieu d'une checkbox

---

### Phase 3 : Refactorisation de la logique JavaScript

#### 3.1 Fonctions de gestion des périodes

##### 3.1.1 CRUD des périodes
- `ajouterPeriodeRHT(phase, periodeData)` - Ajoute une nouvelle période
- `supprimerPeriodeRHT(phase, periodeId)` - Supprime une période
- `modifierPeriodeRHT(phase, periodeId, updates)` - Met à jour une période
- `obtenirPeriodesRHT(phase)` - Récupère toutes les périodes d'une phase

##### 3.1.2 Fonctions de vérification
- `verifierChevauchementsRHT(phase, periodeId?)` - Vérifie les chevauchements :
  - Entre périodes de la même phase
  - Entre périodes de phases différentes
- `isDateInRHTPhase1(dateStr)` - Refactoriser pour parcourir toutes les périodes
- `isDateInRHTPhase2(dateStr)` - Refactoriser pour parcourir toutes les périodes
- `obtenirPeriodeRHTPourDate(dateStr)` - Retourne la période active pour une date donnée

##### 3.1.3 Fonctions utilitaires
- `genererIdUnique()` - Génère un UUID v4 pour chaque période
- `sauvegarderPeriodesRHT(phase)` - Sauvegarde les périodes dans localStorage
- `chargerPeriodesRHT(phase)` - Charge les périodes depuis localStorage
- `afficherPeriodesRHT(phase)` - Affiche toutes les périodes dans l'interface

#### 3.2 Gestion des événements

##### 3.2.1 Event listeners dynamiques
- Utiliser la délégation d'événements pour les boutons dynamiques
- Écouter sur les conteneurs parent au lieu de chaque élément

```javascript
document.getElementById('rht-phase1-container').addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-delete-period')) {
    const periodeId = e.target.dataset.periodId;
    supprimerPeriodeRHT('phase1', periodeId);
  }
  // etc.
});
```

##### 3.2.2 Sauvegarde automatique
- Sauvegarder dans localStorage à chaque modification
- Déclencher les mises à jour nécessaires (tableau, calculs, etc.)

#### 3.3 Mise à jour des fonctions existantes

##### 3.3.1 Fonctions de calcul
- `getHeuresJourMinutesEffective(dateStr)` :
  - Trouver la période Phase 2 active pour la date
  - Retourner les heures/jour de cette période
  
- `getPauseOfferteEffective(dateStr)` :
  - Trouver la période Phase 2 active pour la date
  - Retourner la pause offerte de cette période

##### 3.3.2 Fonctions d'affichage
- Mettre à jour `afficherMessageChevauchement()` pour gérer plusieurs périodes
- Mettre à jour tous les endroits qui utilisent les anciennes clés localStorage

---

### Phase 4 : Migration et compatibilité

#### 4.1 Migration au chargement
- Appeler `migrerDonneesRHT()` au chargement de la page
- Afficher un message informatif si migration effectuée

#### 4.2 Tests de régression
- Vérifier que les fonctions existantes fonctionnent toujours :
  - Calcul des heures supplémentaires
  - Affichage du calendrier
  - Export/import Excel
  - Tous les modules qui utilisent RHT

---

### Phase 5 : Améliorations UX

#### 5.1 Validation
- Validation des dates (début < fin)
- Validation des chevauchements en temps réel
- Messages d'erreur clairs et contextuels

#### 5.2 Interface utilisateur
- Style cohérent avec le reste de l'application
- Animation lors de l'ajout/suppression
- Confirmation avant suppression
- Tri automatique des périodes par date

#### 5.3 Feedback visuel
- Indicateur visuel si période active/inactive
- Mise en évidence des périodes qui se chevauchent
- Tooltips explicatifs

---

## 📝 Étapes d'implémentation recommandées

### Étape 1 : Migration du stockage (1-2h)
1. Créer la fonction `migrerDonneesRHT()`
2. Créer les fonctions de base `chargerPeriodesRHT()` et `sauvegarderPeriodesRHT()`
3. Tester la migration avec les données existantes

### Étape 2 : Refactorisation des fonctions de vérification (2-3h)
1. Refactoriser `isDateInRHTPhase1()` et `isDateInRHTPhase2()`
2. Créer `obtenirPeriodeRHTPourDate()`
3. Refactoriser `verifierChevauchementsRHT()`
4. Mettre à jour `getHeuresJourMinutesEffective()` et `getPauseOfferteEffective()`

### Étape 3 : Interface HTML dynamique (3-4h)
1. Créer les conteneurs dynamiques dans `index.html`
2. Créer les fonctions `genererHTMLPhase1()` et `genererHTMLPhase2()`
3. Créer la fonction `afficherPeriodesRHT()`
4. Implémenter les boutons + et corbeille

### Étape 4 : Logique CRUD (2-3h)
1. Implémenter `ajouterPeriodeRHT()`
2. Implémenter `supprimerPeriodeRHT()`
3. Implémenter `modifierPeriodeRHT()`
4. Connecter les event listeners

### Étape 5 : Tests et ajustements (2-3h)
1. Tester tous les scénarios d'utilisation
2. Vérifier la compatibilité avec les fonctionnalités existantes
3. Corriger les bugs éventuels
4. Optimiser les performances si nécessaire

**Temps total estimé : 10-15 heures**

---

## 🔧 Points d'attention

### Chevauchements
- Gérer les chevauchements entre périodes de la même phase
- Gérer les chevauchements entre Phase 1 et Phase 2
- Permettre ou interdire les chevauchements selon les besoins métier

### Performance
- Éviter de parcourir toutes les périodes à chaque calcul
- Mettre en cache les périodes actives si nécessaire
- Optimiser les requêtes localStorage

### Compatibilité
- Assurer la rétrocompatibilité avec les données existantes
- Gérer les cas où aucune période n'est définie
- Gérer les cas où plusieurs périodes sont actives pour une même date

---

## ✅ Critères de succès

- [ ] Possibilité d'ajouter plusieurs périodes Phase 1
- [ ] Possibilité d'ajouter plusieurs périodes Phase 2
- [ ] Suppression d'une période avec confirmation
- [ ] Validation des chevauchements en temps réel
- [ ] Migration automatique des anciennes données
- [ ] Toutes les fonctionnalités existantes fonctionnent toujours
- [ ] Interface intuitive et cohérente
- [ ] Sauvegarde automatique dans localStorage

---

## 📚 Ressources nécessaires

- Compréhension de la structure actuelle du projet
- Connaissance des fonctions existantes utilisant RHT
- Tests avec des données réelles
- Validation des besoins métier pour les chevauchements


