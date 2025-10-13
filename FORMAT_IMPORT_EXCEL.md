# Format d'import/export Excel - Guide de mise en forme

Ce document explique la structure requise pour les fichiers Excel afin qu'ils soient correctement importés dans le projet de gestion des horaires.

---

## 📋 Structure générale du fichier

Le fichier Excel peut contenir **plusieurs feuilles** (sheets) :
- **Feuilles d'horaires** : une feuille par mois (ex: "Janvier", "Février", etc.)
- **Feuille spéciale** : "Backup_Jours_Posés" pour les congés, RTT, jours fériés, etc.

---

## 📅 Feuilles d'horaires (données journalières)

### En-tête obligatoire (première ligne)

Chaque feuille d'horaires **doit** contenir au minimum les colonnes suivantes :

| Colonne obligatoire | Description | Format attendu |
|---------------------|-------------|----------------|
| **Date** | Date du jour travaillé | JJ.MM.AA (ex: 15.10.24) |
| **Arrivée** | Heure d'arrivée | HH:MM ou HH:MM:SS (ex: 08:30 ou 08:30:00) |

> ⚠️ **Important** : Si les colonnes "Date" et "Arrivée" ne sont pas présentes, la feuille sera ignorée lors de l'import.

### Colonnes standards recommandées

| Colonne | Description | Format |
|---------|-------------|--------|
| **Pause avant X début** | Début de la pause avant midi (X = numéro) | HH:MM ou HH:MM:SS |
| **Pause avant X fin** | Fin de la pause avant midi (X = numéro) | HH:MM ou HH:MM:SS |
| **Début pause midi** | Début de la pause midi | HH:MM ou HH:MM:SS |
| **Fin pause midi** | Fin de la pause midi | HH:MM ou HH:MM:SS |
| **Pause après X début** | Début de la pause après midi (X = numéro) | HH:MM ou HH:MM:SS |
| **Pause après X fin** | Fin de la pause après midi (X = numéro) | HH:MM ou HH:MM:SS |
| **Départ** | Heure de départ | HH:MM ou HH:MM:SS |
| **Heures travaillées** | Total heures travaillées | x,xx (format décimal, ex: 8,50) |
| **Écart** | Écart par rapport à la norme | x,xx (format décimal, ex: 0,50 ou -0,25) |


### Exemple de structure d'une feuille "Janvier"

```
Date       | Arrivée | Pause avant 1 début | Pause avant 1 fin | Début pause midi | Fin pause midi | Pause après 1 début | Pause après 1 fin | Départ | Heures travaillées | Écart
-----------|---------|---------------------|-------------------|------------------|----------------|---------------------|-------------------|--------|-------------------|-------
02.01.25   | 08:30   |                     |                   | 12:00            | 13:00          |                     |                   | 17:00  | 7,50              | -0,75
03.01.25   | 08:00   | 10:00               | 10:15             | 12:30            | 13:30          | 15:00               | 15:10             | 17:30  | 8,25              | 0,00
04.01.25   | 08:15   |                     |                   | 12:00            | 13:15          |                     |                   | 17:45  | 8,25              | 0,00
```

### Pauses multiples

- Le système supporte **plusieurs pauses** avant et après la pause midi
- Les pauses sont numérotées : "Pause avant 1 début", "Pause avant 2 début", etc.
- Chaque pause doit avoir une colonne "début" et une colonne "fin"
- Le nombre maximum de pauses est détecté automatiquement lors de l'export

---

## 🏖️ Feuille "Backup_Jours_Posés" (congés et absences)

Cette feuille spéciale permet d'importer les jours de congés, RTT, RHT, jours fériés et jours rattrapés.

### Structure obligatoire

| Colonne obligatoire | Description | Valeurs acceptées |
|---------------------|-------------|-------------------|
| **Date** | Date du jour posé | JJ.MM.AA (ex: 15.10.24) |
| **Type** | Type de jour | Voir tableau ci-dessous |

### Types de jours acceptés

| Type dans Excel | Description | Alias accepté |
|-----------------|-------------|---------------|
| **Congé payé** | Jour de congé payé | CP |
| **RTT** | Réduction du temps de travail | RTT |
| **RHT** | Réduction de l'horaire de travail | RHT |
| **F** | Jour férié | Férié |
| **R** | Jour rattrapé | Rattrapé |

### Exemple de feuille "Backup_Jours_Posés"

```
Date       | Type
-----------|---------------
01.01.25   | F
15.01.25   | CP
16.01.25   | CP
20.01.25   | RTT
25.01.25   | R
```

---

## 📊 Ligne de totaux

- Le système **ignore automatiquement** les lignes de totaux lors de l'import
- Une ligne est considérée comme totaux si les colonnes Date, Arrivée et Départ sont vides
- Vous pouvez donc conserver vos lignes de totaux dans le fichier sans problème

---

## ✅ Points importants pour un import réussi

### Format des dates
- **Format obligatoire** : JJ.MM.AA (ex: 15.10.24)
- Le système convertit automatiquement en AAAA-MM-JJ en interne
- Si l'année est sur 2 chiffres, "20" est ajouté automatiquement (24 → 2024)

### Format des heures
- **Formats acceptés** : HH:MM ou HH:MM:SS
- Exemples valides : 08:30, 08:30:00, 17:45, 17:45:30
- Les cellules vides sont autorisées (pauses optionnelles)

### Format des valeurs numériques
- **Format décimal** : x,xx (avec virgule, pas de point)
- Exemples : 8,50 pour 8 heures et 30 minutes
- Exemples : -0,25 pour un écart négatif de 15 minutes

### Ordre des colonnes
- L'ordre des colonnes n'est **pas important**
- Le système détecte automatiquement la position de chaque colonne par son nom
- Assurez-vous que les noms de colonnes correspondent exactement

### Noms des feuilles
- Les noms de feuilles sont **libres** (sauf "Backup_Jours_Posés")
- Recommandation : utiliser les noms de mois (Janvier, Février, etc.)
- La feuille "Backup_Jours_Posés" doit avoir exactement ce nom (sensible à la casse)

---

## 🔄 Export automatique

Lorsque vous exportez depuis l'application :

1. **Export année complète** :
   - Crée une feuille par mois
   - Ajoute automatiquement une feuille "Backup_Jours_Posés"
   - Ajoute une ligne de totaux par mois

2. **Export mois affiché** :
   - Crée une seule feuille pour le mois
   - Nomme la feuille avec le nom du mois et l'année
   - Ajoute une ligne de totaux

Les fichiers exportés peuvent être directement réimportés sans modification.

---

## 🛠️ Dépannage

### Le fichier n'est pas importé
- Vérifiez que les colonnes "Date" et "Arrivée" sont présentes
- Vérifiez l'orthographe exacte des noms de colonnes
- Assurez-vous que le format des dates est JJ.MM.AA

### Les pauses ne sont pas importées
- Vérifiez que les colonnes suivent le format exact : "Pause avant X début" et "Pause avant X fin"
- X doit être un chiffre (1, 2, 3, etc.)
- Même chose pour "Pause après X début" et "Pause après X fin"

### Les jours posés ne sont pas importés
- Vérifiez que la feuille s'appelle exactement "Backup_Jours_Posés"
- Vérifiez que les types correspondent aux valeurs acceptées
- Vérifiez le format des dates (JJ.MM.AA)

### Les données semblent écrasées
- Lors de l'import, les jours existants avec la même date sont **remplacés**
- Les jours non présents dans le fichier Excel sont **conservés**
- C'est une fusion intelligente, pas un remplacement total

---

## 📝 Template Excel vide

Voici un modèle minimal que vous pouvez copier :

### Feuille d'horaires
```
Date | Arrivée | Début pause midi | Fin pause midi | Départ | Heures travaillées | Écart
```

### Feuille Backup_Jours_Posés
```
Date | Type
```

---

**Dernière mise à jour** : Octobre 2024

