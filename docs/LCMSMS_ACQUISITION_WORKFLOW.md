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

Le premier parcours complet couvre une séquence de 1 à N injections, quelle que
soit la préparation des vials. Le cas de référence utilisé dans les exemples
reste :

1. un vial de calibration à une concentration choisie pendant sa préparation ;
2. un vial contenant l'extrait du sample.

Mais rien n'impose cette composition : deux calibrants et un sample, plusieurs
samples sans calibrant, ou un seul vial sont des séquences valides.

Le technicien doit pouvoir :

1. placer les vials dans les positions de son choix dans le rack ;
2. charger physiquement le rack dans le LC-MS/MS ;
3. ouvrir la console d'acquisition de l'instrument ;
4. utiliser une méthode LC-MS/MS prédéfinie ;
5. lancer la séquence ;
6. suivre les injections ;
7. obtenir les fichiers mzML générés.

Le Step 1 ne couvre pas :

- les blancs ;
- les QC ;
- les gammes de calibration multipoints ;
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
- méthode d'acquisition ;
- volume d'injection ;
- nombre de répétitions ;
- nom du fichier de sortie.

Ces informations sont des paramètres d'acquisition. Elles ne décrivent pas
l'usage analytique futur du vial.

La séquence est neutre : elle ne demande jamais au technicien si une fiole est
un calibrant, un sample, un blanc ou un QC. Ce rôle appartient à
l'interprétation des données, donc à l'application de traitement en aval. Ce que
Betalab injecte dépend uniquement du contenu physique du vial
(`CalibrationContext` ou `InjectionContext`), jamais d'une déclaration.

Dans le parcours nominal, le nom et le fichier de sortie sont préremplis depuis
le vial et sa position. Le technicien les vérifie avant de lancer la séquence.

## 4. Vue d'ensemble du parcours

```text
Rack avec vials prêts
  → chargement physique du rack dans le LC-MS/MS
  → ouverture de la console constructeur
  → création automatique de la table de séquence
  → vérification des noms et des fichiers de sortie
  → sélection de la méthode fixe
  → contrôles avant acquisition
  → lancement de la séquence
  → injection de chaque vial dans l'ordre des positions
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
accessible. Une action `Unload rack from LC-MS/MS` remet ensuite le rack à
`available`, avant ou après la séquence, afin de rendre ses vials de nouveau
déplaçables. Le déchargement reste interdit pendant l'état `locked`.

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
├──────┬───────────────────┬──────────┬──────┬────────────────┤
│ Pos. │ Sample name       │ Vol (µL) │ Rep. │ File           │
├──────┼───────────────────┼──────────┼──────┼────────────────┤
│ 1    │ CAL-10            │ 5        │ 1    │ 01_cal-10.mzML │
│ 2    │ APP-2026-0001     │ 5        │ 1    │ 02_app....mzML │
└──────┴───────────────────┴──────────┴──────┴────────────────┘

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
| Méthode | Méthode fixe du Step 1 |
| Volume d'injection | Valeur fixe de la méthode |
| Répétitions | `1` |
| Nom de sortie | Dérivé du nom et de la position |

### 8.2. Composition libre de la séquence

La séquence accepte de 1 à N lignes, sans contrainte sur la nature des vials.
La console n'affiche aucun champ `Type` ni `Calibration level` : ces notions
appartiennent au traitement des données, pas à l'acquisition.

Les catégories `calibration`, `sample`, `blank` ou `qc` ne sont donc déclarées
nulle part dans Betalab.

### 8.3. Action du technicien

Le technicien vérifie que :

- les noms sont corrects ;
- les volumes d'injection et les répétitions conviennent ;
- les noms de fichiers ne sont pas ambigus.

Aucune modification de la table de séquence ne doit jamais changer le contenu
physique du vial.

## 9. Étape E — Sélectionner la méthode d'acquisition

### 9.1. Méthode intégrée et méthodes utilisateur

Betalab fournit une méthode intégrée, non modifiable :

`apple_pesticides_mrm_v1`

Le technicien peut la sélectionner telle quelle, ou la dupliquer pour obtenir
une copie éditable.

**Duplication obligatoire.** Une méthode intégrée est immuable : toute tentative
de l'écraser ou de la supprimer est refusée. Le parcours est donc
`Duplicate method` → modifier la copie → `Save as new version`.

L'éditeur propose deux niveaux :

1. **Mode simple** — cocher les pesticides ciblés ; le catalogue de référence
   propose automatiquement leurs transitions connues.
2. **Mode avancé** — modifier Q1, Q3, polarité, CE, dwell, RT et fenêtre de
   rétention transition par transition.

### 9.2. Erreurs bloquantes et avertissements

La distinction est volontaire et structurante.

**Bloquant** (la méthode ne serait pas programmable) :

- méthode vide ;
- `m/z` négatif ou nul ;
- dwell time nul ou négatif ;
- fenêtre de rétention nulle ou négative ;
- identifiants de transition dupliqués ;
- composé ciblé sans transition `quantifier` ;
- nom, version ou durée de run manquants.

**Non bloquant** (la méthode est valide, mais ne verra pas ce qu'on croit) :

- couple `Q1/Q3` ne correspondant à aucun composé du catalogue ;
- fenêtre de rétention déclarée ne couvrant pas l'élution réelle ;
- `Q3` plus lourd que `Q1`.

Une transition physiquement bien formée qui ne correspond à rien **doit**
pouvoir être enregistrée : lancer la séquence et constater une trace plate est
précisément l'exercice pédagogique. L'avertissement s'affiche, le bouton
d'enregistrement reste actif.

Les méthodes utilisateur sont persistées côté backend, et chaque run fige le
snapshot exact de la méthode utilisée : éditer une méthode après coup ne réécrit
jamais un run déjà terminé.

### 9.3. Visualiseur de méthode

La console affiche un visualiseur en lecture seule de la méthode sélectionnée :

- nom et version ;
- badges `Educational` et `Built-in · read-only` ;
- note de provenance ;
- durée du run ;
- nombre de composés et nombre de transitions ;
- paramètres LC principaux : colonne, four, débit, phases, gradient ;
- paramètres de source principaux : type, tension de spray, températures, gaz ;
- table des transitions : composé, quantifier/qualifier, Q1, Q3, polarité, CE,
  dwell et RT.

Un glossaire explique brièvement Q1, Q3, collision energy, dwell time,
quantifier et qualifier, afin que le technicien puisse comprendre la méthode
sans devoir la modifier.

La méthode intégrée reste non modifiable : le visualiseur ne rend aucun champ
éditable.

### 9.4. Sélection de la méthode

Le sélecteur de méthode est alimenté par le catalogue backend. La méthode
choisie appartient à la séquence : elle ne dépend jamais des fioles présentes
dans le rack, et c'est bien la méthode sélectionnée qui part dans la commande
de lancement.

### 9.5. Données nécessaires au moteur

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

### 9.6. État actuel du modèle de méthode

La méthode est désormais un objet métier structuré et versionné, et non plus un
identifiant codé en dur :

```text
AcquisitionMethod
├── id, name, version
├── runtime_s
├── liquid_chromatography (colonne, phases, débit, gradient)
├── ion_source (type, tensions, températures, gaz)
└── transitions[] (MrmTransition)
```

Une `MrmTransition` porte : identifiant stable, composé annoté, Q1, Q3,
polarité, rôle `quantifier` / `qualifier`, énergie de collision, dwell time,
temps de rétention attendu, fenêtre de rétention, étalon interne associé et
provenance.

Le registre backend expose la méthode intégrée `apple_pesticides_mrm_v1` en
lecture seule :

- `GET /experiments/catalog/acquisition-methods` — liste résumée ;
- `GET /experiments/catalog/acquisition-methods/{method_id}` — détail complet.

`RunSequenceService` refuse une méthode inconnue et fige un snapshot immuable de
la méthode dans le run. Une future version publiée sous le même identifiant ne
peut donc pas réécrire l'histoire d'un run passé.

### 9.7. Statut pédagogique des valeurs

`apple_pesticides_mrm_v1` porte `is_educational = true` et chaque transition
porte `provenance = "educational_placeholder"`.

Les m/z, énergies de collision et temps de rétention sont des valeurs
pédagogiques cohérentes entre elles, **écrites pour Betalab**. Elles ne
proviennent ni d'une méthode de laboratoire validée, ni d'une note
d'application constructeur, ni de la littérature, et ne doivent pas être
réutilisées comme données analytiques de référence.

Le jour où une méthode réelle est fournie, elle remplacera ce contenu sans
changer la structure : seuls les nombres et les marqueurs de provenance
changent.

## 10. Étape F — Contrôles avant lancement

Le bouton `Start acquisition` devient disponible lorsque tous les contrôles
obligatoires sont satisfaits.

### 10.1. Contrôles du Step 1

- le LC-MS/MS est déployé ;
- un rack est chargé dans l'instrument ;
- le rack contient au moins un vial ;
- chaque position occupée apparaît exactement une fois dans la séquence ;
- chaque ligne possède un nom ;
- chaque volume d'injection est valide ;
- chaque nombre de répétitions est valide ;
- une méthode d'acquisition est sélectionnée ;
- chaque ligne possède un nom de sortie `.mzML` ;
- les noms de sortie sont uniques dans la séquence, répétitions comprises ;
- aucune acquisition n'est déjà active.

La fermeture des vials peut être ajoutée comme contrôle bloquant si le modèle
visuel du vial expose clairement un bouchon manipulable.

### 10.2. Avertissements non bloquants possibles

- positions vides entre deux injections ;
- vial sans étiquette métier explicite ;
- vial sans contenu injectable.

Ces avertissements ne sont pas indispensables au premier incrément.

## 11. Étape G — Lancer la séquence

### 11.1. Action du technicien

Le technicien clique sur `Start acquisition` puis confirme le lancement.

### 11.2. Snapshot de la séquence

Au lancement, Betalab crée un snapshot immuable de la séquence :

- ordre des injections ;
- identité des vials ;
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

```text
Injection 1 : vial de la première position occupée
  → fin du run
Injection 2 : vial de la position occupée suivante
  → fin du run
…
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
- la méthode d'acquisition ;
- les transitions MRM ;
- les paramètres de bruit et de variation instrumentale.

### 13.2. Sortie interne — `TransitionTrace`

Le moteur produit une trace par transition déclarée dans la méthode :

```text
TransitionTrace
├── injection_id
├── transition           (snapshot de la transition déclarée)
├── times_s[]
├── intensities[]
└── acquisition          (durée, points, pas, dwell, polarité,
                          matched_reference_transition,
                          acquired_in_retention_window)
```

Le résultat d'une injection est donc un ensemble de chromatogrammes MRM bruts.
Il ne contient ni aire intégrée, ni courbe de calibration, ni concentration.

### 13.3. Règle de correspondance instrumentale

La correspondance est **numérique**. Une transition voit un composé uniquement
si son couple `(Q1, Q3)` tombe dans `MZ_MATCH_TOLERANCE` d'un canal du
catalogue de référence. Le `compound_id` écrit dans la méthode est une
étiquette pour l'humain : les quadripôles ne le lisent jamais.

| Situation | Trace obtenue |
|---|---|
| Composé présent, masses correctes, RT dans la fenêtre | pic gaussien + bruit |
| Composé absent du vial | bruit de fond |
| Couple Q1/Q3 ne correspondant à aucun composé | bruit de fond |
| Bonnes masses, mauvais nom de composé | pic quand même |
| Bon nom de composé, mauvaises masses | bruit de fond |
| Fenêtre de rétention déclarée ratant l'élution réelle | bruit de fond |

Quantifier et qualifier produisent deux traces distinctes ; le qualifier est
plus faible d'un rapport constant, ce qui rend le rapport d'ions exploitable.

La génération est pseudo-aléatoire et reproductible : `RunSequenceService`
accepte un générateur injecté, donc un test rejoue une acquisition à
l'identique.

### 13.4. Modèle pédagogique du Step 1

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

### 13.5. Frontière avec l'application de traitement

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
| Position occupée déclarée deux fois | Lancement refusé |
| Ligne sans nom | Lancement refusé |
| Volume d'injection ou répétitions invalides | Lancement refusé |
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
| Chargement et retrait physique du rack | Implémentés | Conserver |
| Console constructeur | Implémentée | Conserver |
| Rôle analytique des vials | Jamais déclaré | Conserver : la séquence reste neutre |
| Méthode d'acquisition | Modèle structuré et versionné | Conserver |
| Snapshot de méthode dans le run | Implémenté | Conserver |
| Catalogue MRM de référence | Placeholders pédagogiques | Remplacer par des données réelles |
| Duplication et édition de méthode | Implémentées | Conserver |
| Persistance des méthodes utilisateur | Implémentée | Conserver |
| Lancement de la séquence | Calcul instantané existant | Remplacer par un run structuré |
| Exécution injection par injection | Absente | À implémenter |
| Signal numérique agrégé | Remplacé par les traces MRM | Conserver |
| Traces temps/intensité | Implémentées | Conserver |
| Sortie mzML | Absente | À implémenter selon les exemples |
| Tableau de concentrations et vérité cachée | Retiré | Conserver hors de Betalab |

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
- préremplir le nom et le fichier de sortie depuis le vial et sa position ;
- afficher les contrôles de readiness.

### Incrément 3 — Méthode fixe

- créer le modèle de méthode d'acquisition — fait ;
- ajouter `apple_pesticides_mrm_v1` — fait ;
- ajouter un premier catalogue de transitions — fait, en valeurs pédagogiques ;
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
- conserver le retrait du rack après la séquence ;
- couvrir le parcours complet par un test d'intégration.

## 19. Scénario d'acceptation du Step 1

Le Step 1 est terminé lorsque le scénario suivant fonctionne sans outil de
debug :

1. le joueur prépare un vial de calibration à un niveau positif ;
2. le joueur prépare un vial contenant l'extrait de pomme ;
3. il place les vials dans les positions de son choix ;
4. il charge le rack complet dans le LC-MS/MS ;
5. il ouvre la console constructeur ;
6. la console préremplit une ligne par position occupée, sans demander de rôle ;
7. le joueur vérifie les noms, les fichiers de sortie et la méthode fixe ;
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

1. contenu réel de la méthode `apple_pesticides_mrm_v1` — la structure est
   figée, seules les valeurs pédagogiques restent à remplacer ;
2. transitions MRM et temps de rétention réels ;
3. durée et fréquence d'acquisition ;
4. un mzML par injection ou un mzML par séquence ;
5. structure exacte attendue par l'application consommatrice ;
6. besoin d'un manifeste de séquence à côté des mzML ;
7. métadonnées déclaratives à inscrire dans le mzML ;
8. apparence finale de la console constructeur ;
9. comportement en cas d'arrêt ou d'échec au milieu d'une séquence.

Les exemples mzML fournis ultérieurement doivent servir de source de vérité
pour les points 4 à 7.
