# Workflow pesticides — mode simplifié et mode complet

## Décision produit actuelle

Betalab commence par un parcours pédagogique simplifié pour l'analyse de
résidus de pesticides dans la pomme.

Ce mode conserve les manipulations essentielles :

- réception et identification de l'échantillon ;
- homogénéisation cryogénique ;
- prise d'essai ;
- extraction QuEChERS ;
- vortex ;
- centrifugation et séparation visible des phases ;
- prélèvement de la phase organique ;
- préparation du vial et analyse LC-MS/MS.

Le cleanup d-SPE est exclu du premier parcours. Après la première
centrifugation, le joueur transfère directement la phase organique supérieure
dans un vial d'autosampler.

Ce parcours est une simplification pédagogique. Il ne doit pas être présenté
comme l'exécution stricte et complète d'une méthode EN 15662 ou AOAC 2007.01.

### État d'implémentation de la centrifugation

La centrifugeuse du mode simplifié est implémentée de bout en bout :

- équipement déployable et rangeable avec les comportements génériques des widgets ;
- dépôt par drag-and-drop réservé aux tubes à centrifuger ;
- cycle de `10 s` à `4 000 rpm`, avancé par le moteur de simulation physique ;
- tube obligatoirement fermé et préalablement vortexé ;
- progression persistante et séparation visible entre surnageant et culot ;
- aspiration de l'extrait bloquée tant que la centrifugation n'est pas terminée.

La sélection spatiale d'une phase avec la pointe de pipette reste une évolution
ultérieure. Pour l'instant, l'état séparé autorise l'aspiration de l'extrait,
mais la hauteur exacte de la pointe dans le tube n'est pas encore simulée.

## Mode simplifié retenu

| Étape | Contenant | Équipement | Action | Transvasement |
|---|---|---|---|---|
| 1. Réception | Sac d'échantillonnage | Balance de réception et LIMS | Peser, enregistrer et étiqueter les pommes | Aucun |
| 2. Découpe | Planche à découper | Outil de découpe | Sortir les pommes du sac et les découper | Sac → planche |
| 3. Broyage | Chambre du broyeur | Broyeur cryogénique | Ajouter la glace carbonique et homogénéiser les morceaux de pomme | Planche → broyeur |
| 4. Stockage facultatif | Pot HDPE à large ouverture | Aucun | Conserver temporairement la poudre homogénéisée | Broyeur → pot HDPE |
| 5. Prise d'essai | Tube à centrifuger de 50 mL | Balance analytique et spatule | Tarer le tube puis introduire `10,000 g` de poudre | Broyeur ou pot HDPE → tube de 50 mL |
| 6. Extraction | Même tube de 50 mL, ouvert | Pipette | Ajouter l'étalon interne puis `10 mL` d'acétonitrile | Réactifs → tube de 50 mL |
| 7. Partition QuEChERS | Même tube de 50 mL, fermé | Vortex | Ajouter les sels QuEChERS, fermer le tube et mélanger immédiatement | Aucun changement de tube |
| 8. Séparation | Même tube de 50 mL, fermé | Centrifugeuse | Séparer visiblement la phase organique supérieure, la matrice et le culot solide | Aucun pendant la centrifugation |
| 9. Préparation du vial | Vial d'autosampler d'environ 2 mL | Pipette | Prélever uniquement la phase organique supérieure sans toucher l'interface ni le culot | Tube de 50 mL → vial |
| 10. Mise en séquence | Vials échantillon, calibrants et blancs | Rack autosampler | Fermer puis placer les vials dans l'ordre d'injection | Paillasse → rack |
| 11. Analyse | Vials présents dans le rack | LC-MS/MS | Charger le rack par glisser-déposer, puis lancer la séquence et analyser les injections | Rack → instrument |

### Enchaînement central du mode simplifié

```text
Tube de 50 mL
  → vortex : homogénéiser et favoriser l'extraction
  → centrifugeuse : séparer les phases
  → pipette : prélever la phase organique supérieure
  → vial d'autosampler
  → rack
  → LC-MS/MS
```

### Comportement attendu de la pipette

Avant la centrifugation, le contenu du tube est traité comme un mélange.

Après la centrifugation, le tube contient plusieurs zones visibles. La pipette
ne prélève plus indistinctement tout le contenu : elle prélève la phase dans
laquelle sa pointe est placée.

Dans le parcours correct, le joueur vise la phase organique supérieure. Une
aspiration trop basse pourra ultérieurement entraîner une contamination par
la matrice ou le culot.

## Mode complet avec cleanup d-SPE

Le mode complet prolonge le même parcours par une purification d-SPE. Il
pourra être ajouté lorsque les effets matrice, l'encrassement instrumental et
les pertes de récupération auront une conséquence visible dans les résultats.

| Étape | Contenant | Équipement | Action | Transvasement |
|---|---|---|---|---|
| 1. Réception | Sac d'échantillonnage | Balance de réception et LIMS | Peser, enregistrer et étiqueter les pommes | Aucun |
| 2. Découpe | Planche à découper | Outil de découpe | Sortir les pommes du sac et les découper | Sac → planche |
| 3. Broyage | Chambre du broyeur | Broyeur cryogénique | Ajouter la glace carbonique et homogénéiser les morceaux de pomme | Planche → broyeur |
| 4. Stockage facultatif | Pot HDPE à large ouverture | Aucun | Conserver temporairement la poudre homogénéisée | Broyeur → pot HDPE |
| 5. Prise d'essai | Tube à centrifuger de 50 mL | Balance analytique et spatule | Tarer le tube puis introduire `10,000 g` de poudre | Broyeur ou pot HDPE → tube de 50 mL |
| 6. Extraction | Même tube de 50 mL, ouvert | Pipette | Ajouter l'étalon interne puis `10 mL` d'acétonitrile | Réactifs → tube de 50 mL |
| 7. Partition QuEChERS | Même tube de 50 mL, fermé | Vortex | Ajouter les sels QuEChERS, fermer le tube et mélanger immédiatement | Aucun changement de tube |
| 8. Première séparation | Même tube de 50 mL, fermé | Centrifugeuse | Séparer la phase organique supérieure, la matrice et le culot solide | Aucun pendant la centrifugation |
| 9. Transfert du surnageant | Tube d-SPE contenant les sorbants de cleanup | Pipette | Prélever uniquement la phase organique supérieure | Tube de 50 mL → tube d-SPE |
| 10. Cleanup | Même tube d-SPE, fermé | Vortex | Mettre l'extrait en contact avec les sorbants | Aucun changement de tube |
| 11. Deuxième séparation | Même tube d-SPE, fermé | Centrifugeuse | Déposer les sorbants et les impuretés au fond du tube | Aucun pendant la centrifugation |
| 12. Préparation du vial | Vial d'autosampler d'environ 2 mL | Pipette | Prélever uniquement l'extrait clarifié supérieur | Tube d-SPE → vial |
| 13. Mise en séquence | Vials échantillon, calibrants et blancs | Rack autosampler | Fermer puis placer les vials dans l'ordre d'injection | Paillasse → rack |
| 14. Analyse | Vials présents dans le rack | LC-MS/MS | Charger le rack par glisser-déposer, puis lancer la séquence et analyser les injections | Rack → instrument |

### Enchaînement central du mode complet

```text
Tube de 50 mL
  → vortex
  → première centrifugation
  → pipetage de la phase organique
  → tube d-SPE
  → vortex
  → deuxième centrifugation
  → pipetage de l'extrait clarifié
  → vial d'autosampler
  → rack
  → LC-MS/MS
```

## Différence de gameplay

| Mode | Avantage | Limite ou conséquence future |
|---|---|---|
| Simplifié | Parcours plus court, une seule centrifugation et un seul prélèvement sélectif | Extrait moins propre, effets matrice et encrassement potentiellement plus importants |
| Complet avec d-SPE | Extrait plus propre et préparation plus fidèle au workflow QuEChERS complet | Manipulations supplémentaires et risque de perte de certains analytes pendant le cleanup |
