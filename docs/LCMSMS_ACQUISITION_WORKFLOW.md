# Workflow LC-MS/MS — du chargement du rack aux fichiers mzML

## 1. Objet du document

Ce document décrit le parcours Betalab qui commence lorsque les vials sont
prêts dans le rack autosampler et se termine lorsque le LC-MS/MS a produit ses
données instrumentales.

Le parcours de préparation de l'échantillon en amont est décrit dans
`docs/PESTICIDE_WORKFLOW_MODES.md`.

Le présent document doit servir de référence pour implémenter le parcours par
petits incréments cohérents.

## 2. Périmètre du Step 1

Le premier parcours complet contient seulement deux injections :

1. un vial de calibration à une concentration choisie pendant sa préparation ;
2. un vial contenant l'extrait du sample.

Le technicien doit pouvoir :

1. placer les deux vials dans les positions de son choix dans le rack ;
2. charger physiquement le rack dans le LC-MS/MS ;
3. ouvrir la console d'acquisition de l'instrument ;
4. vérifier ou renseigner le rôle de chaque vial ;
5. utiliser une méthode LC-MS/MS prédéfinie ;
6. lancer la séquence ;
7. suivre les deux injections ;
8. obtenir les fichiers mzML générés.

Le Step 1 ne couvre pas :

- les blancs ;
- les QC ;
- les gammes de calibration multipoints ;
- le développement interactif d'une méthode MRM ;
- l'intégration des pics ;
- la construction d'une courbe de calibration ;
- la quantification finale ;
- la validation analytique ;
- la comparaison aux LMR ;
- le rapport final.

Ces traitements appartiennent à une autre application qui consommera les
données produites par Betalab.

## 3. Principe métier central

Betalab doit distinguer deux réalités.

### 3.1. Contenu physique du vial

Le contenu physique provient des manipulations réalisées sur la paillasse.

Pour un calibrant, il comprend notamment :

- la concentration nominale choisie pendant la préparation ;
- la concentration réellement préparée, conservée comme vérité cachée de la simulation ;
- les composés présents dans la solution multirésidus.

Pour un sample, il comprend notamment :

- la provenance de l'extrait ;
- la prise d'essai ;
- les volumes nominaux et réels ;
- les résidus effectivement présents ;
- les conséquences des manipulations et erreurs précédentes ;
- la présence et le moment d'ajout de l'étalon interne.

Le chargement du rack et la console constructeur ne doivent pas modifier ce
contenu physique.

### 3.2. Déclaration dans la séquence

La console constructeur décrit la manière dont le technicien déclare chaque
injection à l'instrument :

- nom du sample ;
- type d'injection ;
- niveau de calibration déclaré ;
- méthode d'acquisition ;
- volume d'injection ;
- nom du fichier de sortie.

Dans le parcours nominal, ces informations sont préremplies depuis le vial.
Le technicien les vérifie avant de lancer la séquence.

À terme, une déclaration incorrecte pourra être conservée comme erreur de
manipulation : elle ne changera pas le contenu réel du vial, mais elle changera
les métadonnées transmises à l'application de traitement.

## 4. Vue d'ensemble du parcours

```text
Rack avec vials prêts
  → chargement physique du rack dans le LC-MS/MS
  → ouverture de la console constructeur
  → création automatique de la table de séquence
  → vérification calibrant + sample
  → sélection de la méthode fixe
  → contrôles avant acquisition
  → lancement de la séquence
  → injection du calibrant
  → génération de ses données instrumentales
  → injection du sample
  → génération de ses données instrumentales
  → finalisation des mzML
  → fichiers disponibles pour l'application de traitement
```

## 5. Étape A — Préparer l'ordre dans le rack

### 5.1. Action du technicien

Le technicien place les vials dans les positions de son choix.

Exemple recommandé pour le Step 1 :

| Position | Contenu physique | Ordre d'injection |
|---|---|---:|
| 1 | Calibrant `10 ng/mL` | 1 |
| 2 | Sample `APP-2026-0001` | 2 |

Les positions vides sont autorisées et ignorées. Par exemple, si les positions
2 et 7 sont occupées, la position 2 est injectée avant la position 7.

### 5.2. Règle d'ordre

Pour le Step 1, l'ordre physique du rack est l'ordre de la séquence :

- parcours des positions par numéro croissant ;
- omission des positions vides ;
- absence d'un ordre logiciel indépendant du rack.

Un éditeur permettant de réordonner virtuellement la séquence pourra être
ajouté plus tard, mais il n'est pas requis pour terminer le premier parcours.

### 5.3. État actuel

Le rack possède déjà douze positions. Les vials peuvent être créés ou déplacés
vers une position libre, déplacés entre deux positions et retirés du rack.

## 6. Étape B — Charger le rack dans le LC-MS/MS

### 6.1. Action du technicien

Le technicien glisse le rack complet sur la zone autosampler du widget
LC-MS/MS.

Cette manipulation représente l'insertion physique du rack dans le passeur
d'échantillons.

### 6.2. États du rack

Le rack doit pouvoir être dans l'un des états suivants :

- `available` : présent sur le plan de travail et modifiable ;
- `loaded` : chargé dans le LC-MS/MS ;
- `locked` : acquisition en cours, aucune modification autorisée ;
- `completed` : acquisition terminée, rack retirable.

### 6.3. Conséquences du chargement

Lorsque le rack est chargé :

- le LC-MS/MS conserve une référence structurée vers ce rack ;
- la console peut lire les positions et les vials ;
- le rack apparaît dans la zone autosampler de l'instrument ;
- les vials restent visibles dans leur position ;
- le technicien peut encore retirer le rack tant que la séquence n'est pas lancée ;
- le rack et ses vials deviennent non déplaçables pendant l'acquisition.

### 6.4. Contrôles de chargement

Le chargement est refusé si :

- le LC-MS/MS n'est pas déployé ;
- le rack n'est pas déployé ;
- le LC-MS/MS contient déjà un rack ;
- le rack est vide ;
- une acquisition est déjà en cours.

### 6.5. État actuel

Cette manipulation est implémentée par glisser-déposer. Le technicien saisit la
poignée `Drag rack into LC-MS/MS` sous le rack puis dépose le rack entier sur le
widget LC-MS/MS. La cible est mise en évidence pendant le déplacement.

Le chargement exige que le rack et l'instrument soient déployés et que le rack
contienne au moins un vial. Le rack passe alors de `available` à `loaded`, ses
positions ne sont plus modifiables et la console d'acquisition devient
accessible. Le retrait du rack après acquisition reste à implémenter.

## 7. Étape C — Ouvrir la console constructeur

### 7.1. Ouverture

Après le chargement du rack, le technicien ouvre la console en cliquant sur le
LC-MS/MS ou sur une action `Open acquisition software`.

La console simule un logiciel constructeur sans chercher à reproduire une
marque réelle.

### 7.2. Zones minimales de la console

La console comporte quatre zones :

1. état de l'instrument ;
2. méthode sélectionnée ;
3. table de séquence ;
4. commandes et progression de l'acquisition.

Exemple conceptuel :

```text
┌─────────────────────────────────────────────────────────────┐
│ LC-MS/MS Acquisition                           READY        │
│ Method: Apple pesticides — MRM v1                           │
├──────┬───────────────────┬─────────────┬──────────┬─────────┤
│ Pos. │ Sample name       │ Type        │ Level    │ File    │
├──────┼───────────────────┼─────────────┼──────────┼─────────┤
│ 1    │ CAL-10            │ Calibration │ 10 ng/mL │ CAL-10  │
│ 2    │ APP-2026-0001     │ Sample      │ —        │ APP...  │
└──────┴───────────────────┴─────────────┴──────────┴─────────┘

                       [ Start acquisition ]
```

## 8. Étape D — Construire et vérifier la séquence

### 8.1. Création automatique

La console crée une ligne pour chaque position occupée, triée dans l'ordre du
rack.

Pour chaque ligne, elle préremplit les informations connues :

| Champ | Source proposée |
|---|---|
| Position | Position physique dans le rack |
| Nom | Étiquette LIMS ou nom du vial |
| Type | Contexte de calibration ou contexte d'injection du vial |
| Niveau | Concentration nominale du calibrant |
| Méthode | Méthode fixe du Step 1 |
| Volume d'injection | Valeur fixe de la méthode |
| Répétitions | `1` |
| Nom de sortie | Dérivé du nom et de la position |

### 8.2. Types disponibles au Step 1

Le Step 1 propose seulement :

- `calibration` ;
- `sample`.

Les types `blank`, `qc` et autres catégories spécialisées sont hors périmètre.

### 8.3. Action du technicien

Le technicien vérifie que :

- le calibrant est déclaré comme `calibration` ;
- son niveau déclaré correspond à la préparation ;
- le sample est déclaré comme `sample` ;
- les noms sont corrects ;
- le calibrant est placé avant le sample dans le parcours recommandé ;
- les noms de fichiers ne sont pas ambigus.

La modification du type ou du niveau déclaré peut être autorisée, mais ne doit
jamais modifier le contenu physique du vial.

## 9. Étape E — Sélectionner la méthode d'acquisition

### 9.1. Décision du Step 1

Le Step 1 utilise une seule méthode préinstallée et non modifiable :

`apple_pesticides_mrm_v1`

Le technicien la sélectionne ou vérifie qu'elle est sélectionnée. Il ne
développe pas les transitions MRM dans ce parcours.

### 9.2. Résumé affiché

La console peut afficher en lecture seule :

- nom et version de la méthode ;
- durée du run ;
- volume d'injection ;
- polarité utilisée ;
- nombre de transitions ;
- liste des composés ciblés ;
- liste des étalons internes.

### 9.3. Données nécessaires au moteur

La méthode devra fournir, pour chaque canal MRM :

- identifiant stable de la transition ;
- composé associé ;
- rôle analyte ou étalon interne ;
- `m/z` précurseur ;
- `m/z` produit ;
- polarité ;
- temps de rétention attendu ;
- fenêtre d'acquisition ou plage temporelle ;
- paramètres nécessaires à l'écriture mzML.

Des paramètres comme l'énergie de collision, le dwell time, la colonne, le
débit ou le gradient pourront être conservés comme métadonnées si les exemples
mzML ou l'application consommatrice les exigent.

Betalab ne simule pas la fragmentation physique des ions. Une transition est
un canal instrumental prédéfini auquel le moteur associe une trace
temps/intensité.

### 9.4. Informations encore attendues

Le catalogue exact des transitions et les constantes de la méthode seront
définis ultérieurement :

- à partir d'une méthode réelle fournie par l'utilisateur ;
- à partir des métadonnées présentes dans les exemples mzML ;
- ou à partir d'un catalogue pédagogique documenté.

## 10. Étape F — Contrôles avant lancement

Le bouton `Start acquisition` devient disponible lorsque tous les contrôles
obligatoires sont satisfaits.

### 10.1. Contrôles du Step 1

- le LC-MS/MS est déployé ;
- un rack est chargé dans l'instrument ;
- le rack contient au moins un calibrant et un sample ;
- chaque ligne possède un nom ;
- chaque ligne possède un type reconnu ;
- le calibrant possède un niveau déclaré strictement positif ;
- une méthode d'acquisition est sélectionnée ;
- chaque ligne possède un nom de sortie ;
- les noms de sortie sont uniques dans la séquence ;
- aucune acquisition n'est déjà active.

La fermeture des vials peut être ajoutée comme contrôle bloquant si le modèle
visuel du vial expose clairement un bouchon manipulable.

### 10.2. Avertissements non bloquants possibles

- sample placé avant le calibrant ;
- niveau déclaré différent du contenu préparé ;
- positions vides entre deux injections ;
- vial sans étiquette métier explicite.

Ces avertissements ne sont pas indispensables au premier incrément.

## 11. Étape G — Lancer la séquence

### 11.1. Action du technicien

Le technicien clique sur `Start acquisition` puis confirme le lancement.

### 11.2. Snapshot de la séquence

Au lancement, Betalab crée un snapshot immuable de la séquence :

- ordre des injections ;
- identité et déclaration des vials ;
- contenu physique nécessaire à la simulation ;
- méthode et version ;
- paramètres d'acquisition ;
- noms des fichiers de sortie.

Les modifications ultérieures du rack ne doivent pas changer une séquence déjà
lancée.

### 11.3. Verrouillage

Pendant la séquence :

- le rack est verrouillé ;
- les vials ne sont plus déplaçables ;
- la méthode n'est plus modifiable ;
- les lignes de séquence ne sont plus modifiables ;
- une seconde séquence ne peut pas être lancée sur le même instrument.

## 12. Étape H — Exécuter les injections

### 12.1. Ordre

Le moteur traite les lignes l'une après l'autre selon l'ordre du snapshot.

Pour le Step 1 :

```text
Injection 1 : calibrant
  → fin du run calibrant
Injection 2 : sample
  → fin du run sample
Fin de séquence
```

### 12.2. États de séquence

Une séquence peut avoir les états :

- `draft` ;
- `ready` ;
- `running` ;
- `completed` ;
- `failed`.

### 12.3. États d'injection

Une injection peut avoir les états :

- `queued` ;
- `running` ;
- `completed` ;
- `failed`.

### 12.4. Progression temporelle

L'acquisition doit progresser avec l'horloge autoritaire du backend. Les
conséquences temporelles ne doivent pas être pilotées par un simple timer du
frontend.

Le frontend affiche les snapshots reçus et peut montrer :

- injection active ;
- position active ;
- temps écoulé ;
- progression du run ;
- progression globale de la séquence ;
- statut des fichiers.

Pour un premier incrément technique, la durée simulée peut être courte, mais
le modèle doit rester compatible avec une acquisition progressive.

## 13. Étape I — Générer le signal instrumental

### 13.1. Entrées du générateur

Le générateur reçoit :

- le contenu physique du vial ;
- le type déclaré dans la séquence ;
- la méthode d'acquisition ;
- les transitions MRM ;
- les paramètres de bruit et de variation instrumentale.

### 13.2. Sortie interne minimale

Pour chaque transition, le moteur produit au minimum :

- une suite de temps ;
- une intensité pour chaque temps ;
- les métadonnées de la transition ;
- les métadonnées d'acquisition requises par le futur mzML.

### 13.3. Modèle pédagogique du Step 1

Le Step 1 peut utiliser :

- un temps de rétention prédéfini par transition ;
- un pic gaussien simplifié ;
- une aire ou une amplitude dépendant de la quantité réellement injectée ;
- un faible décalage aléatoire du temps de rétention ;
- une variation instrumentale du signal ;
- un bruit de fond ;
- les effets hérités de la préparation du sample ;
- les signaux des étalons internes lorsqu'ils sont présents.

Le moteur ne calcule pas la chimie de l'ionisation ou de la fragmentation à
partir de la structure moléculaire.

### 13.4. Frontière avec l'application de traitement

La sortie officielle de Betalab ne doit pas contenir :

- concentration finale calculée du sample ;
- valeur vraie cachée ;
- erreur relative ;
- courbe de calibration ;
- intégration ou correction manuelle des pics ;
- verdict de conformité ;
- comparaison aux LMR.

Ces informations peuvent rester accessibles dans un outil de debug interne,
mais ne font pas partie du résultat instrumental transmis.

## 14. Étape J — Produire les fichiers mzML

### 14.1. Responsabilité

Betalab transforme la sortie instrumentale interne en mzML puis rend les
fichiers disponibles à l'utilisateur ou à l'application de traitement.

### 14.2. Contrat à définir par exemples

Le contrat mzML définitif sera établi à partir de fichiers d'exemple fournis
par l'utilisateur.

Il faudra notamment déterminer :

- un fichier par injection ou un fichier pour toute la séquence ;
- représentation par chromatogrammes MRM ou par spectres ;
- organisation des transitions précurseur/produit ;
- unités de temps et d'intensité ;
- métadonnées de sample ;
- métadonnées de méthode et d'instrument ;
- encodage et compression des tableaux binaires ;
- conventions de nommage ;
- présence éventuelle d'un manifeste de séquence séparé.

Le document ne fige volontairement pas ces choix avant l'étude des exemples.

### 14.3. Statuts de fichier

Un fichier peut avoir les états :

- `pending` ;
- `writing` ;
- `ready` ;
- `failed`.

Un fichier `ready` doit être persistant et retéléchargeable après le
rechargement de l'expérience.

## 15. Étape K — Obtenir les résultats instrumentaux

### 15.1. Écran de fin

À la fin de la séquence, la console affiche :

- statut global `completed` ou `failed` ;
- liste des injections ;
- statut de chaque injection ;
- durée simulée ;
- fichiers mzML disponibles ;
- action de téléchargement ou de transmission.

Une prévisualisation simple des chromatogrammes bruts peut être affichée, mais
elle ne doit pas devenir une interface de traitement des données.

### 15.2. Actions finales

Le technicien peut :

- télécharger les fichiers ;
- transmettre les fichiers à l'application de traitement ;
- retirer le rack de l'instrument ;
- consulter l'historique d'acquisition ;
- relancer une nouvelle séquence après avoir déverrouillé ou remplacé le rack.

## 16. Gestion minimale des erreurs

Le Step 1 doit au moins représenter les erreurs suivantes :

| Situation | Comportement attendu |
|---|---|
| Rack vide | Chargement ou lancement refusé |
| Aucun rack chargé | Lancement refusé |
| Méthode absente | Lancement refusé |
| Aucun calibrant déclaré | Lancement refusé |
| Aucun sample déclaré | Lancement refusé |
| Niveau de calibrant invalide | Lancement refusé |
| Nom de sortie dupliqué | Lancement refusé |
| Déplacement pendant le run | Action refusée |
| Erreur de génération du signal | Injection et séquence marquées `failed` |
| Erreur d'écriture mzML | Acquisition conservée, fichier marqué `failed` |

Les erreurs instrumentales détaillées, la reprise partielle et les mécanismes
de retry sont hors périmètre du premier parcours.

## 17. État actuel et cible

| Fonction | État actuel | Cible Step 1 |
|---|---|---|
| Rack à 12 positions | Implémenté | Conserver |
| Placement libre des vials | Implémenté | Conserver |
| Ordre déterminé par les positions | Implémenté | Conserver |
| Préparation d'un calibrant | Implémentée | Conserver |
| Préparation d'un sample | Implémentée | Conserver |
| Chargement physique du rack dans l'instrument | Implémenté par glisser-déposer | Ajouter le retrait après acquisition |
| Console constructeur | Absente | À implémenter |
| Déclaration calibration/sample | Déduite implicitement du vial | À rendre visible et confirmable |
| Méthode d'acquisition | Absente | Méthode fixe à ajouter |
| Lancement de la séquence | Calcul instantané existant | Remplacer par un run structuré |
| Exécution injection par injection | Absente | À implémenter |
| Signal numérique agrégé | Implémenté | Réutiliser comme entrée éventuelle du générateur |
| Traces temps/intensité | Absentes | À implémenter |
| Sortie mzML | Absente | À implémenter selon les exemples |
| Tableau de concentrations et vérité cachée | Présent dans l'UI actuelle | Retirer de la sortie officielle ou réserver au debug |

## 18. Découpage d'implémentation recommandé

Chaque incrément doit être utilisable ou vérifiable indépendamment.

### Incrément 1 — Chargement du rack

- rendre le rack chargeable dans le LC-MS/MS ;
- ajouter les états `available`, `loaded` et `locked` ;
- empêcher les déplacements pendant le verrouillage ;
- représenter visuellement le rack chargé.

### Incrément 2 — Console et table de séquence

- ouvrir une console depuis le LC-MS/MS ;
- construire les lignes à partir des positions occupées ;
- préremplir `calibration` ou `sample` ;
- préremplir le niveau du calibrant ;
- afficher les contrôles de readiness.

### Incrément 3 — Méthode fixe

- créer le modèle de méthode d'acquisition ;
- ajouter `apple_pesticides_mrm_v1` ;
- ajouter un premier catalogue de transitions ;
- afficher le résumé en lecture seule.

### Incrément 4 — Cycle d'acquisition

- créer le snapshot de séquence ;
- ajouter les états de séquence et d'injection ;
- exécuter les injections dans l'ordre du rack ;
- faire progresser l'acquisition avec l'horloge backend.

### Incrément 5 — Génération du signal

- produire les grilles de temps ;
- générer les pics et le bruit par transition ;
- utiliser le contenu réel du calibrant et du sample ;
- conserver les traces brutes dans le résultat de l'acquisition.

### Incrément 6 — Écriture mzML

- analyser les exemples fournis ;
- figer le contrat de sortie ;
- sérialiser les acquisitions ;
- persister et exposer les fichiers.

### Incrément 7 — Fin de parcours

- afficher la progression et les statuts ;
- proposer le téléchargement ou la transmission ;
- permettre le retrait du rack après la séquence ;
- couvrir le parcours complet par un test d'intégration.

## 19. Scénario d'acceptation du Step 1

Le Step 1 est terminé lorsque le scénario suivant fonctionne sans outil de
debug :

1. le joueur prépare un vial de calibration à un niveau positif ;
2. le joueur prépare un vial contenant l'extrait de pomme ;
3. il place le calibrant dans une position antérieure au sample ;
4. il charge le rack complet dans le LC-MS/MS ;
5. il ouvre la console constructeur ;
6. la console préremplit une ligne `calibration` et une ligne `sample` ;
7. le joueur vérifie les noms, le niveau et la méthode fixe ;
8. les contrôles passent à l'état `ready` ;
9. il lance la séquence ;
10. le rack et les vials sont verrouillés ;
11. le calibrant est acquis ;
12. le sample est acquis ;
13. les deux acquisitions atteignent l'état `completed` ;
14. les fichiers mzML atteignent l'état `ready` ;
15. les fichiers restent disponibles après rechargement de l'expérience ;
16. l'application de traitement peut les récupérer sans dépendre de la vérité cachée de Betalab.

## 20. Questions restant volontairement ouvertes

Les points suivants seront tranchés avant ou pendant les incréments concernés :

1. contenu exact de la méthode `apple_pesticides_mrm_v1` ;
2. transitions MRM et temps de rétention ;
3. durée et fréquence d'acquisition ;
4. un mzML par injection ou un mzML par séquence ;
5. structure exacte attendue par l'application consommatrice ;
6. besoin d'un manifeste de séquence à côté des mzML ;
7. métadonnées déclaratives à inscrire dans le mzML ;
8. apparence finale de la console constructeur ;
9. comportement en cas d'arrêt ou d'échec au milieu d'une séquence.

Les exemples mzML fournis ultérieurement doivent servir de source de vérité
pour les points 4 à 7.
