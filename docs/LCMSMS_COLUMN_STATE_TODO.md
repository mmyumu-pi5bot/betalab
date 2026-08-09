# TODO — État persistant de la colonne LC

**Statut : non implémenté, volontairement.** Ce document existe pour qu'on puisse
reprendre l'idée à froid sans la reconstruire.

## 1. De quoi il s'agit

Aujourd'hui la colonne n'existe pas en tant qu'objet. Elle est **déclarée** dans
la méthode (`liquid_chromatography.column_label`, température, débit) mais rien
ne la représente physiquement, et rien ne la fait vieillir.

Conséquence : chaque injection part d'une colonne neuve. Deux cents injections
d'extrait de pomme sale produisent exactement les mêmes pics que la première.

L'idée serait de donner à l'instrument un **état de colonne qui s'accumule
injection après injection** et qui dégrade le signal, avec une action d'entretien
pour le remettre à zéro.

## 2. Ce que ça modéliserait

### 2.1. Encrassement par la matrice — traînée et élargissement

**Le fait réel.** Les co-extraits non volatils s'accumulent en tête de colonne.
Les pics traînent, s'élargissent, et le phénomène est progressif : on le voit
venir sur plusieurs dizaines d'injections avant qu'il devienne bloquant.

**Ce qui existe déjà.** `InjectionContext.foreign_matter_mass_mg` (la crasse) et
la charge en matrice `masse / volume` sont toutes deux calculées à chaque
injection — voir § 13.4 bis de `LCMSMS_ACQUISITION_WORKFLOW.md`. Il suffirait de
les **cumuler** au lieu de les consommer et de les jeter.

**Ce qu'il faudrait ajouter.** Un pic asymétrique. Le modèle actuel est une
gaussienne symétrique, à aire conservée. La forme standard pour une traînée est
la **gaussienne modifiée par une exponentielle (EMG)**, qui est aussi ce que les
logiciels de retraitement ajustent. C'est le vrai coût de ce chantier.

### 2.2. Perte d'efficacité — dérive du temps de rétention

**Le fait réel.** Une colonne vieillissante retient moins, donc les composés
sortent plus tôt, progressivement. C'est la raison pour laquelle on surveille les
temps de rétention en routine.

**Ce qui existe déjà.** Le RT vient du catalogue de référence, avec une gigue
aléatoire de ±1,5 s (`RETENTION_JITTER_SIGMA_S`) sans lien avec quoi que ce soit.

**Ce qu'il faudrait ajouter.** Un décalage systématique fonction de l'usure, qui
s'ajoute à la gigue. Attention à l'interaction : si le RT dérive assez, il sort
de la **fenêtre d'acquisition déclarée** dans la méthode — et le canal cesse de
voir son composé. C'est exactement ce qui arrive en vrai, et c'est un excellent
exercice, mais ça veut dire que la dérive doit rester lente pour être
diagnosticable plutôt que brutale.

### 2.3. Entraînement entre injections — connexe mais distinct

**Attention à ne pas confondre.** L'entraînement (*carry-over*) n'est pas un état
de colonne : c'est une **mémoire de composé**, un résidu de l'injection
précédente qui ressort dans la suivante. Il produit un pic parfaitement
conforme — bon RT, bonnes masses, bon rapport d'ions — donc indétectable par les
critères d'identification. Seul un **blanc** l'attrape.

Les deux se rejoignent en pratique (une colonne encrassée entraîne davantage) et
partageraient le même endroit dans le code, mais ce sont deux mécanismes
différents avec deux leçons différentes.

**Préalable impératif.** Ne pas implémenter l'entraînement avant que les blancs
existent — voir § 4. Sinon on fabrique un faux positif que rien ne permet de
détecter, ce qui est injuste plutôt que pédagogique.

## 3. Où ça se brancherait

| Quoi | Où |
|---|---|
| L'état lui-même | Sur le widget `instrument` du workspace — la colonne vit dans le LC, pas dans la méthode |
| L'accumulation | `RunSequenceService._run`, à chaque injection, depuis `foreign_matter_mass_mg` et la charge en matrice |
| La lecture | `generate_transition_traces`, à côté de `_effective_peak_sigma_s` et du décalage de RT |
| La persistance | `experiment_repository`, comme les autres vérités cachées — **exclue de la réponse API** |
| La remise à zéro | Une action de paillasse à concevoir : laver ou remplacer la colonne |

Le point d'entrée naturel est `_effective_peak_sigma_s`, qui combine déjà la
bande de la colonne et celle du bouchon injecté. L'usure y ajouterait un
troisième terme, et l'asymétrie viendrait par-dessus.

## 4. Ordre recommandé

1. **Incrément « contrôles »** — étalon interne dans les calibrants, et blanc
   solvant. Préalable à tout : sans blanc, ni l'entraînement ni l'encrassement ne
   sont diagnosticables, et sans ISTD dans les calibrants la calibration
   normalisée reste impossible.
2. **Export mzML** (étape 6) — pour que la dégradation atterrisse quelque part.
3. **Encrassement** (§ 2.1), qui apporte l'EMG.
4. **Dérive de rétention** (§ 2.2), triviale une fois l'état en place.
5. **Entraînement** (§ 2.3), qui a sa propre mémoire de composé.

## 5. Hors périmètre, à noter quand même

- **Le contrôle de conformité système** (passer un standard périodiquement pour
  vérifier la colonne) est la pratique réelle qui rend tout ça observable. Il
  suppose des blancs et des QC, hors périmètre du Step 1.
- **La pression de colonne** monte avec l'encrassement et est le premier signal
  qu'un chromatographiste regarde. L'instrument affiche déjà un bandeau de
  lecture ; ce serait peu coûteux et très parlant.
- **Le réglage de résolution** des quadripôles n'est pas modélisé — sans rapport
  avec la colonne, mais dans la même catégorie « paramètre réel absent ».

## 6. Questions à trancher avant de commencer

1. L'usure se compte-t-elle en **nombre d'injections**, en **matière injectée
   cumulée**, ou les deux ? La seconde est plus juste et déjà calculée.
2. La colonne est-elle **une par expérience** ou un consommable qu'on remplace,
   avec un état par exemplaire ?
3. La dégradation est-elle **réversible** par un lavage, ou seulement par un
   remplacement ? En vrai, partiellement réversible.
4. Rend-on l'usure **visible** (pression, largeur de pic affichée) ou laisse-t-on
   le technicien la découvrir dans les données ? Cohérent avec la décision prise
   en § 13.3 bis bis : Betalab ne diagnostique pas à la place du technicien.
