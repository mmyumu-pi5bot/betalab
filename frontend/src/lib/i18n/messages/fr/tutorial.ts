import type { enTutorial } from "../en/tutorial";

export const frTutorial: Record<keyof typeof enTutorial, string> = {

  // Nouns the tutorial slots into its own sentences
  "tutorial.item.extractionTube": "tube d'extraction",
  "tutorial.item.sampleVial": "vial d'échantillon",
  "tutorial.item.standardAtLevel": "étalon à {p0} ng/mL",
  "tutorial.item.autosamplerVial": "vial autosampler",
  "tutorial.item.chilledTube": "tube refroidi",
  "tutorial.item.calibrationStandardVial": "vial d'étalon",
  "tutorial.item.cuttingBoard": "planche à découper",
  "tutorial.item.sampleBag": "sachet d'échantillon",
  "tutorial.item.weighedTube": "tube pesé",
  "tutorial.item.mixedExtractionTube": "tube d'extraction mélangé",
  "tutorial.item.separatedExtractionTube": "tube d'extraction séparé",
  "tutorial.item.tube": "tube",
  "tutorial.tool.knife": "Couteau en acier inoxydable",
  "tutorial.tool.pipette": "Micropipette",
  "tutorial.tool.spatula": "Spatule à poudre",


  // More tutorial nouns
  "tutorial.item.storageJar": "bocal de stockage",

  // Tutoriel guidé — étapes, chapitres et texte d'accompagnement
  "tutorial.gettutorialcountdown.label":
    "Fermez le tube et démarrez le vortex",
  "tutorial.gettutorialactiontoolpresentation.title":
    "Reposez le {p0}",
  "tutorial.gettutorialactiontoolpresentation.instruction":
    "Le {p0} est encore en main, et le glisser-déposer reste désactivé tant qu'un outil est sélectionné. Cliquez sur le {p1} mis en évidence dans Actions, ou appuyez sur {p2}, pour le reposer.",
  "tutorial.gettutorialactiontoolpresentation.hint":
    "Dès qu'aucun outil n'est sélectionné, le tutoriel met en évidence ce qu'il faut glisser pour cette étape.",
  "tutorial.gettutorialactiontoolpresentation.label":
    "Recliquez dessus ou appuyez sur {p0}",
  "tutorial.gettutorialactiontoolpickuppresentation.title":
    "Reprenez le {p0}",
  "tutorial.gettutorialactiontoolpickuppresentation.instruction":
    "Le {p0} contient encore le reste du dernier versement, mais il n'est pas en main. Cliquez sur le {p1} mis en évidence dans Actions, ou appuyez sur {p2}, pour le reprendre.",
  "tutorial.gettutorialactiontoolpickuppresentation.hint":
    "Le versement s'arrête quand vous relâchez : le {p0} conserve donc ce qui lui reste.",
  "tutorial.gettutorialactiontoolpickuppresentation.label":
    "Cliquez dessus ou appuyez sur {p0}",
  "tutorial.gettutorialinventorycategorypresentation.title":
    "Ouvrez la section {p0}",
  "tutorial.gettutorialinventorycategorypresentation.instruction":
    "L'élément de cette étape se trouve dans la section {p0} de l'Inventaire, et cette section est repliée. Cliquez sur l'en-tête mis en évidence pour la déplier.",
  "tutorial.gettutorialinventorycategorypresentation.hint":
    "Le tutoriel mettra en évidence l'élément à utiliser dès que la section sera ouverte.",
  "tutorial.gettutorialinventorycategorypresentation.label":
    "Cliquez sur l'en-tête {p0} mis en évidence",
  "tutorial.getmethodwalkpresentation.title":
    "Ouvrez l'éditeur de méthode",
  "tutorial.getmethodwalkpresentation.instruction":
    "Cliquez sur l'onglet Modifier mis en évidence pour ouvrir l'éditeur de cette méthode.",
  "tutorial.getmethodwalkpresentation.hint":
    "L'onglet Détails ne fait qu'afficher la méthode ; la gamme d'étalonnage se modifie dans Modifier.",
  "tutorial.getmethodwalkpresentation.label":
    "Ouvrir Modifier",
  "tutorial.getmethodwalkpresentation.title2":
    "Dupliquez d'abord la méthode",
  "tutorial.getmethodwalkpresentation.instruction2":
    "Cette méthode est intégrée et ne peut pas être modifiée. Cliquez sur Dupliquer la méthode, mis en évidence, pour obtenir une copie modifiable, puis modifiez la copie.",
  "tutorial.getmethodwalkpresentation.hint2":
    "La copie conserve toutes les transitions de l'originale — seule son identité change.",
  "tutorial.getmethodwalkpresentation.label2":
    "Dupliquer la méthode",
  "tutorial.getmethodwalkpresentation.title3":
    "Enregistrez la méthode",
  "tutorial.getmethodwalkpresentation.instruction3":
    "Cliquez sur Enregistrer comme nouvelle version, mis en évidence, pour enregistrer la copie avec sa gamme d'étalonnage.",
  "tutorial.getmethodwalkpresentation.hint3":
    "Rien n'est écrit tant que vous n'enregistrez pas : quitter l'éditeur maintenant perdrait le niveau saisi.",
  "tutorial.getmethodwalkpresentation.label3":
    "Enregistrer comme nouvelle version",
  "tutorial.getmethodwalkpresentation.title4":
    "Fermez le gestionnaire de méthodes",
  "tutorial.getmethodwalkpresentation.instruction4":
    "La méthode est enregistrée. Fermez le gestionnaire de méthodes mis en évidence pour revenir à la console d'acquisition.",
  "tutorial.getmethodwalkpresentation.hint4":
    "La console doit encore pointer vers la copie — le gestionnaire ne bascule pas la sélection à votre place.",
  "tutorial.getmethodwalkpresentation.label4":
    "Fermer le gestionnaire",
  "tutorial.getmethodwalkpresentation.title5":
    "Lancez l'acquisition",
  "tutorial.getmethodwalkpresentation.instruction5":
    "La méthode est enregistrée et la console pointe déjà dessus — la duplication a basculé la sélection pour vous. Cliquez sur Lancer l'acquisition pour enregistrer la séquence.",
  "tutorial.getmethodwalkpresentation.hint5":
    "La gamme déclarée n'atteint le fichier de méthode qu'au travers d'une séquence : l'étape se valide dès que la séquence démarre.",
  "tutorial.getmethodwalkpresentation.label5":
    "Lancer l'acquisition",
  "tutorial.getmethodwalkpresentation.title6":
    "Saisissez les niveaux d'étalonnage",
  "tutorial.getmethodwalkpresentation.instruction6":
    "Cliquez sur le champ Niveaux d'étalonnage mis en évidence et saisissez exactement : {p0}. Cliquez ensuite sur Enregistrer comme nouvelle version, puis sélectionnez la copie comme méthode d'acquisition.",
  "tutorial.getmethodwalkpresentation.label6":
    "Saisir {p0}",
  "tutorial.getmethodwalkpresentation.hint6":
    "Vos étalons ont été préparés à {p0} ng/mL. Le tutoriel compare les deux : ce que vous saisissez ici est ce que le fichier de méthode exporté prétendra qu'il y avait dans les vials.",
  "tutorial.getmethodwalkpresentation.title7":
    "Ce ne sont pas les niveaux que vous avez préparés",
  "tutorial.getmethodwalkpresentation.instruction7":
    "Le champ Niveaux d'étalonnage ne correspond pas aux étalons présents dans votre portoir. Ressaisissez exactement : {p0}.",
  "tutorial.getmethodwalkpresentation.hint7":
    "Une gamme déclarée qui contredit les vials remet à l'échelle toutes les concentrations calculées sur la courbe, et rien en aval ne peut le détecter : la séquence paraît propre et rapporte de mauvais chiffres. Vos étalons sont à {p0} ng/mL.",
  "tutorial.getmethodwalkpresentation.label7":
    "Corriger les niveaux en {p0}",
  "tutorial.getmethodwalkpresentation.title8":
    "La méthode sélectionnée déclare de mauvais niveaux",
  "tutorial.getmethodwalkpresentation.instruction8":
    "La méthode visée par la console ne déclare pas {p0} ng/mL. Cliquez sur Gérer les méthodes et corrigez ses niveaux d'étalonnage avant de lancer.",
  "tutorial.getmethodwalkpresentation.hint8":
    "Les niveaux rejoignent le fichier de méthode au moment de la séquence : ils doivent être justes avant le départ, pas après.",
  "tutorial.getmethodwalkpresentation.label8":
    "Ouvrir Gérer les méthodes",
  "tutorial.getlimstutorialfieldpresentation.title":
    "Vérifiez la pesée de réception",
  "tutorial.getlimstutorialfieldpresentation.instruction":
    "Cliquez sur le récapitulatif de masse mis en évidence et vérifiez le calcul : {p0} g − {p1} g = {p2} g. La balance a pesé le sachet scellé ; en soustrayant la tare connue du sachet, on obtient la masse réellement reçue.",
  "tutorial.getlimstutorialfieldpresentation.hint":
    "La masse déclarée sur l'étiquette terrain est de {p0} g. C'est une valeur de référence, qui peut différer légèrement de la masse nette mesurée de {p1} g.",
  "tutorial.getlimstutorialfieldpresentation.label":
    "Vérifier le calcul de masse",
  "tutorial.getlimstutorialfieldpresentation.title2":
    "Saisissez le verger / producteur",
  "tutorial.getlimstutorialfieldpresentation.instruction2":
    "Cliquez sur le champ mis en évidence et saisissez exactement : {p0}. Cette valeur provient de l'étiquette terrain du sachet d'échantillon.",
  "tutorial.getlimstutorialfieldpresentation.hint2":
    "La balance de réception affiche actuellement {p0} g. Laissez le sachet dessus pendant que vous complétez la fiche LIMS.",
  "tutorial.getlimstutorialfieldpresentation.label2":
    "Saisir {p0}",
  "tutorial.getlimstutorialfieldpresentation.title3":
    "Saisissez la date de récolte",
  "tutorial.getlimstutorialfieldpresentation.instruction3":
    "Cliquez sur le champ de date mis en évidence et saisissez {p0}, comme imprimé sur l'étiquette du sachet.",
  "tutorial.getlimstutorialfieldpresentation.hint3":
    "Utilisez la date de l'étiquette terrain, pas celle du jour ni celle de création de l'expérience.",
  "tutorial.getlimstutorialfieldpresentation.label3":
    "Saisir {p0}",
  "tutorial.getlimstutorialfieldpresentation.title4":
    "Saisissez la masse déclarée",
  "tutorial.getlimstutorialfieldpresentation.instruction4":
    "Cliquez sur le champ mis en évidence et saisissez {p0} g. C'est la masse nette approximative déclarée sur l'étiquette du sachet.",
  "tutorial.getlimstutorialfieldpresentation.hint4":
    "Ne recopiez pas ici la lecture brute de {p0} g ni la masse nette calculée de {p1} g. Ce champ conserve ce que l'expéditeur a déclaré.",
  "tutorial.getlimstutorialfieldpresentation.label4":
    "Saisir {p0}",
  "tutorial.getlimstutorialfieldpresentation.title5":
    "Créez la fiche LIMS",
  "tutorial.getlimstutorialfieldpresentation.instruction5":
    "Laissez Masse d'échantillon vide pour l'instant, puis cliquez sur le bouton Créer la fiche LIMS mis en évidence.",
  "tutorial.getlimstutorialfieldpresentation.hint5":
    "Le LIMS conserve la masse brute mesurée de {p0} g, la tare de {p1} g du sachet et la masse nette reçue calculée de {p2} g. La masse d'échantillon sera mesurée plus tard sur la balance analytique.",
  "tutorial.getlimstutorialfieldpresentation.label5":
    "Cliquer sur Créer la fiche LIMS",
  "tutorial.registersamplepresentation.title":
    "Installez le terminal LIMS",
  "tutorial.registersamplepresentation.instruction":
    "Dans l'Inventaire, ouvrez Équipements de paillasse. Glissez le terminal LIMS mis en évidence et déposez-le sur le plan de travail central.",
  "tutorial.registersamplepresentation.label":
    "Glisser sur le plan de travail",
  "tutorial.registersamplepresentation.title2":
    "Remettez le sachet d'échantillon sur la balance de réception",
  "tutorial.registersamplepresentation.hint":
    "Laissez le sachet sur la balance jusqu'à ce que la fiche LIMS soit complète et son étiquette imprimée apposée.",
  "tutorial.registersamplepresentation.label2":
    "Glisser sur la balance",
  "tutorial.registersamplepresentation.title3":
    "Créez la fiche LIMS",
  "tutorial.registersamplepresentation.instruction2":
    "Vérifiez le calcul de masse à réception. Saisissez ensuite Verger / producteur : {p0}. Saisissez Date de récolte : {p1}. Saisissez Masse déclarée sur l'étiquette du sachet : {p2} g. Laissez Masse d'échantillon vide pour l'instant. Cliquez enfin sur Créer la fiche LIMS.",
  "tutorial.registersamplepresentation.hint2":
    "Le LIMS conserve automatiquement la lecture brute de {p0} g et calcule {p1} g après soustraction de la tare de {p2} g du sachet.",
  "tutorial.registersamplepresentation.label3":
    "Saisissez les valeurs, puis cliquez",
  "tutorial.registersamplepresentation.title4":
    "Imprimez l'étiquette LIMS",
  "tutorial.registersamplepresentation.instruction3":
    "Dans le terminal LIMS, cliquez sur Imprimer l'étiquette.",
  "tutorial.registersamplepresentation.hint3":
    "L'étiquette imprimée apparaîtra dans le terminal LIMS et pourra alors être glissée.",
  "tutorial.registersamplepresentation.label4":
    "Cliquer sur Imprimer l'étiquette",
  "tutorial.registersamplepresentation.title5":
    "Apposez l'étiquette LIMS",
  "tutorial.registersamplepresentation.instruction4":
    "Glissez l'étiquette LIMS imprimée depuis le terminal et déposez-la directement sur le sachet d'échantillon posé sur la balance de réception.",
  "tutorial.registersamplepresentation.hint4":
    "Une fois l'étiquette apposée, vous pouvez déplacer le sachet et ranger la balance.",
  "tutorial.registersamplepresentation.label5":
    "Glisser l'étiquette sur le sachet",
  "tutorial.extractionequipmentpresentation.title":
    "Installez le {p0}",
  "tutorial.extractionequipmentpresentation.instruction":
    "Dans l'Inventaire, ouvrez Équipements de paillasse. Glissez le {p0} mis en évidence et déposez-le sur le plan de travail central.",
  "tutorial.extractionequipmentpresentation.title2":
    "Remettez le tube d'extraction dans le {p0}",
  "tutorial.extractionequipmentpresentation.instruction2":
    "Repérez le tube d'extraction à l'emplacement mis en évidence, puis glissez-le et déposez-le dans le {p0}.",
  "tutorial.extractionequipmentpresentation.hint":
    "Déplacer un élément nécessaire ne réinitialise pas la progression ; le tutoriel continuera de pointer vers son emplacement actuel.",
  "tutorial.extractionequipmentpresentation.instruction3":
    "Surveillez la barre de progression mise en évidence. Laissez le tube d'extraction à l'intérieur jusqu'à ce qu'elle atteigne 100 %.",
  "tutorial.extractionequipmentpresentation.label":
    "Attendre 100 %",
  "tutorial.extractionequipmentpresentation.label2":
    "Cliquer sur Démarrer le vortex",
  "tutorial.extractionequipmentpresentation.label3":
    "Cliquer sur Fermer",
  "tutorial.extractionequipmentpresentation.title3":
    "Démarrez le cycle de centrifugation",
  "tutorial.extractionequipmentpresentation.instruction4":
    "Cliquez sur le bouton Démarrer la centrifugeuse mis en évidence.",
  "tutorial.extractionequipmentpresentation.label4":
    "Cliquer sur Démarrer la centrifugeuse",
  "tutorial.samplevialpresentation.title":
    "Sortez le tube de la centrifugeuse",
  "tutorial.samplevialpresentation.instruction":
    "Glissez le tube d'extraction séparé hors de la centrifugeuse et déposez-le sur un poste de paillasse libre. Le pipetage se fait à la paillasse, pas dans l'instrument.",
  "tutorial.samplevialpresentation.hint":
    "Les phases séparées restent en place tant que le tube est déplacé délicatement.",
  "tutorial.samplevialpresentation.label":
    "Glisser le tube sur la paillasse",
  "tutorial.samplevialpresentation.title2":
    "Ouvrez le tube d'extraction",
  "tutorial.samplevialpresentation.instruction2":
    "Cliquez sur le bouton Ouvrir mis en évidence sur le tube d'extraction. La micropipette ne peut pas aspirer à travers un bouchon fermé.",
  "tutorial.samplevialpresentation.hint2":
    "Seul le surnageant est prélevé ; le culot déposé reste au fond du tube.",
  "tutorial.samplevialpresentation.label2":
    "Cliquer sur Ouvrir",
  "tutorial.samplevialpresentation.title3":
    "Prélevez davantage d'extrait avant de distribuer",
  "tutorial.samplevialpresentation.instruction3":
    "La micropipette contient {p0} mL, ce qui laisserait le vial trop peu rempli pour que l'aiguille de l'autosampler l'atteigne. Maintenez à nouveau le clic sur le tube d'extraction jusqu'à ce que la pipette affiche environ 1,00 mL.",
  "tutorial.samplevialpresentation.hint3":
    "Un clic bref ne valide qu'un seul pas de 0,05 mL. Gardez le bouton enfoncé et regardez le volume monter.",
  "tutorial.samplevialpresentation.label3":
    "Maintenir sur le tube pour prélever plus",
  "tutorial.samplevialpresentation.instruction4":
    "La micropipette contient maintenant de l'extrait. Maintenez le clic sur le vial autosampler mis en évidence pour le distribuer, et relâchez une fois la pipette vide.",
  "tutorial.samplevialpresentation.hint4":
    "L'icône de la micropipette indique la quantité de liquide actuellement chargée.",
  "tutorial.samplevialpresentation.label4":
    "Maintenir sur le vial pour distribuer",
  "tutorial.samplevialpresentation.hint5":
    "Un clic bref ne prélève que 0,05 mL — maintenez jusqu'à atteindre le volume voulu. La quantité prélevée ne change pas la concentration mesurée, mais elle doit suffire à injecter.",
  "tutorial.samplevialpresentation.label5":
    "Maintenir sur le tube pour prélever 1,00 mL",
  "tutorial.samplevialpresentation.label6":
    "Cliquer sur la pipette ou appuyer sur P",
  "tutorial.samplevialpresentation.title4":
    "Sortez un vial autosampler",
  "tutorial.samplevialpresentation.instruction5":
    "Dans l'Inventaire, ouvrez Contenants. Glissez un vial autosampler et déposez-le sur un poste de paillasse libre.",
  "tutorial.samplevialpresentation.hint6":
    "Une fois le vial posé, utilisez la micropipette pour y transférer l'extrait séparé.",
  "tutorial.stagevialspresentation.title":
    "Installez le rack autosampler",
  "tutorial.stagevialspresentation.instruction":
    "Dans l'Inventaire, ouvrez Équipements de paillasse. Glissez le rack autosampler et déposez-le sur le plan de travail central.",
  "tutorial.stagevialspresentation.title2":
    "Remettez le {p0} dans le rack",
  "tutorial.stagevialspresentation.instruction2":
    "Glissez le {p0} mis en évidence et déposez-le dans une position libre du rack.",
  "tutorial.stagevialspresentation.title3":
    "Fermez et placez le {p0}",
  "tutorial.stagevialspresentation.instruction3":
    "À l'emplacement mis en évidence, cliquez sur Fermer sur le {p0}. Glissez-le ensuite dans une position libre du rack.",
  "tutorial.stagevialspresentation.title4":
    "Vérifiez les deux vials placés",
  "tutorial.stagevialspresentation.instruction4":
    "Assurez-vous que les deux vials du rack sont fermés. Fermez tout vial encore ouvert.",
  "tutorial.weighreceptionpresentation.title":
    "Installez la balance de réception",
  "tutorial.weighreceptionpresentation.instruction":
    "Dans l'Inventaire, ouvrez Équipements de paillasse. Glissez la balance de réception mise en évidence et déposez-la sur le plan de travail central.",
  "tutorial.weighreceptionpresentation.label":
    "Glisser sur le plan de travail",
  "tutorial.weighreceptionpresentation.title2":
    "Posez le sachet d'échantillon sur la balance de réception",
  "tutorial.weighreceptionpresentation.instruction2":
    "Repérez le sachet d'échantillon mis en évidence, puis glissez-le et déposez-le sur la balance de réception.",
  "tutorial.weighreceptionpresentation.label2":
    "Glisser le sachet sur la balance",
  "tutorial.weighreceptionpresentation.title3":
    "Attendez la masse brute",
  "tutorial.weighreceptionpresentation.instruction3":
    "Laissez le sachet sur la balance de réception le temps que sa masse soit relevée.",
  "tutorial.weighreceptionpresentation.label3":
    "Attendre la masse",
  "tutorial.grindsamplepresentation.title":
    "Installez le broyeur cryogénique",
  "tutorial.grindsamplepresentation.instruction":
    "Dans l'Inventaire, ouvrez Équipements de paillasse. Glissez le broyeur cryogénique et déposez-le sur le plan de travail central.",
  "tutorial.grindsamplepresentation.label":
    "Glisser sur le plan de travail",
  "tutorial.grindsamplepresentation.title2":
    "Chargez les pommes découpées dans le broyeur",
  "tutorial.grindsamplepresentation.instruction2":
    "Glissez les pommes découpées depuis l'emplacement mis en évidence et déposez-les dans le broyeur cryogénique.",
  "tutorial.grindsamplepresentation.label2":
    "Glisser les pommes dans le broyeur",
  "tutorial.grindsamplepresentation.title3":
    "Ajoutez des pastilles de carboglace",
  "tutorial.grindsamplepresentation.instruction3":
    "Dans l'Inventaire, ouvrez Réactifs & matières. Glissez des pastilles de carboglace dans le broyeur cryogénique. Dans la boîte de dosage, saisissez {p0} g — à peu près la masse des pommes — puis confirmez.",
  "tutorial.grindsamplepresentation.hint":
    "Un rapport de masse carboglace/pommes de 1:1 refroidit le lot progressivement. Ne démarrez pas le broyeur tant que la température est supérieure à −{p0} °C — un départ plus chaud broie les pommes en granulés plutôt qu'en poudre fine.",
  "tutorial.grindsamplepresentation.label3":
    "Ajouter {p0} g de carboglace",
  "tutorial.grindsamplepresentation.title4":
    "Attendez la fin du broyage",
  "tutorial.grindsamplepresentation.instruction4":
    "Surveillez la barre de progression mise en évidence. Ne retirez pas les pommes pendant que le broyeur tourne.",
  "tutorial.grindsamplepresentation.hint2":
    "Le tutoriel continuera automatiquement dès que la matière sera broyée.",
  "tutorial.grindsamplepresentation.label4":
    "Attendre 100 %",
  "tutorial.grindsamplepresentation.title5":
    "Attendez que les pommes atteignent la température cryogénique",
  "tutorial.grindsamplepresentation.instruction5":
    "Surveillez le thermomètre mis en évidence. Attendez qu'il affiche −{p0} °C ou moins avant de démarrer le broyeur.",
  "tutorial.grindsamplepresentation.hint3":
    "La température baisse au fil des pas de simulation après l'ajout de carboglace. Broyer un lot plus chaud le laisse granuleux, et un lot granuleux rend la prise d'essai pesée non représentative.",
  "tutorial.grindsamplepresentation.label5":
    "Attendre −{p0} °C",
  "tutorial.grindsamplepresentation.title6":
    "Démarrez le cycle de broyage",
  "tutorial.grindsamplepresentation.instruction6":
    "Les pommes sont assez froides. Cliquez sur le bouton d'alimentation rouge mis en évidence sur le broyeur.",
  "tutorial.grindsamplepresentation.hint4":
    "Après le clic, surveillez l'indicateur de progression et laissez le contenu dans le broyeur.",
  "tutorial.grindsamplepresentation.label6":
    "Cliquer sur l'alimentation",
  "tutorial.spentextractiontubepresentation.label":
    "Jeter le tube",
  "tutorial.spentextractiontubepresentation.title":
    "Le tube d'extraction est perdu",
  "tutorial.spentextractiontubepresentation.instruction":
    "Ce tube a été vortexé avant d'être fermé : son contenu a giclé et ses parois sont contaminées. Plus rien ne peut en être extrait. Jetez-le à la poubelle, puis pesez une nouvelle prise d'essai.",
  "tutorial.spentextractiontubepresentation.title2":
    "Le tube d'extraction est perdu",
  "tutorial.spentextractiontubepresentation.instruction2":
    "Ce tube a été vortexé avant l'ajout des sels QuEChERS : l'échantillon s'est fixé sur les parois au lieu de passer dans le solvant. Jetez-le à la poubelle, puis pesez une nouvelle prise d'essai.",
  "tutorial.spentextractiontubepresentation.title3":
    "Les sels QuEChERS ont pris en masse",
  "tutorial.spentextractiontubepresentation.instruction3":
    "Les sels QuEChERS étaient déjà dans ce tube sec à l'arrivée du solvant : ils ont pris au contact au lieu de se dissoudre avec l'échantillon. Ajoutez d'abord le solvant, les sels en dernier. Jetez ce tube à la poubelle, puis pesez une nouvelle prise d'essai.",
  "tutorial.spentextractiontubepresentation.title4":
    "Les sels QuEChERS ont pris en masse",
  "tutorial.spentextractiontubepresentation.instruction4":
    "L'ajout des sels QuEChERS déclenche une réaction exothermique, et le tube doit être fermé et vortexé dans les 15 secondes. Au-delà, les sels prennent en bloc autour de l'échantillon et aucun extrait ne peut être récupéré. Jetez ce tube à la poubelle, puis pesez une nouvelle prise d'essai — et cette fois, installez l'agitateur vortex avant d'ajouter les sels.",
  "tutorial.analyticalweighingpresentation.title":
    "Installez la balance analytique",
  "tutorial.analyticalweighingpresentation.instruction":
    "Dans l'Inventaire, ouvrez Équipements de paillasse. Glissez la balance analytique et déposez-la sur le plan de travail central.",
  "tutorial.analyticalweighingpresentation.title2":
    "Remplacez le tube compromis",
  "tutorial.analyticalweighingpresentation.instruction2":
    "Ce tube a été taré alors que de la poudre y avait déjà été ajoutée : son affichage Net ne peut plus enseigner correctement la pesée. Jetez-le, puis sortez un tube de 50 mL neuf de l'Inventaire.",
  "tutorial.analyticalweighingpresentation.hint":
    "Le tutoriel ignorera ce tube compromis une fois qu'il sera à la poubelle et pointera vers son remplaçant.",
  "tutorial.analyticalweighingpresentation.label":
    "Jeter ce tube",
  "tutorial.analyticalweighingpresentation.title3":
    "Remettez le tube sur la balance analytique",
  "tutorial.analyticalweighingpresentation.instruction3":
    "Glissez le tube de 50 mL mis en évidence et déposez-le sur la balance analytique.",
  "tutorial.analyticalweighingpresentation.instruction4":
    "Le tube de remplacement est vide. Cliquez sur Tare maintenant pour que le Net revienne à 0,000 g avant d'ajouter la moindre poudre.",
  "tutorial.analyticalweighingpresentation.label2":
    "Cliquer sur Tare",
  "tutorial.analyticalweighingpresentation.title4":
    "Ajoutez la prise d'essai",
  "tutorial.analyticalweighingpresentation.label3":
    "Maintenir pour doser environ 10,000 g",
  "tutorial.analyticalweighingpresentation.label4":
    "Cliquer sur la spatule ou appuyer sur S",
  "tutorial.extractionpreparationpresentation.title":
    "Ajoutez la solution d'étalon interne",
  "tutorial.extractionpreparationpresentation.instruction":
    "Glissez la solution d'étalon interne mise en évidence sur le tube d'extraction. Conservez 0,05 mL dans la boîte de dialogue, puis cliquez sur Add.",
  "tutorial.extractionpreparationpresentation.label":
    "Ajouter 0,05 mL d'étalon interne",
  "tutorial.extractionpreparationpresentation.title2":
    "Ajoutez le solvant d'extraction",
  "tutorial.extractionpreparationpresentation.instruction2":
    "Glissez l'acétonitrile mis en évidence sur le même tube. Saisissez 10 mL dans la boîte de dialogue, puis cliquez sur Add.",
  "tutorial.extractionpreparationpresentation.label2":
    "Ajouter 10 mL d'acétonitrile",
  "tutorial.extractionpreparationpresentation.title3":
    "Installez l'agitateur vortex avant les sels",
  "tutorial.extractionpreparationpresentation.instruction3":
    "Les sels viennent en dernier, et ils déclenchent une réaction exothermique dès qu'ils touchent le solvant : à partir de là, vous avez 15 secondes pour fermer le tube et démarrer l'agitateur. Installez l'agitateur vortex dès maintenant pour qu'il soit prêt. Dans l'Inventaire, ouvrez Équipements de paillasse, puis glissez-le sur le plan de travail central.",
  "tutorial.extractionpreparationpresentation.hint":
    "Manquez cette fenêtre et les sels prennent en bloc, emportant l'extraction avec eux.",
  "tutorial.extractionpreparationpresentation.deadline":
    "15 secondes pour vortexer une fois les sels ajoutés",
  "tutorial.extractionpreparationpresentation.label3":
    "Glisser sur le plan de travail",
  "tutorial.chillextractionpresentation.title":
    "Attendez que le tube redescende",
  "tutorial.chillextractionpresentation.instruction":
    "Surveillez la température du tube posé dans le bain de glace. Laissez-le jusqu'à ce qu'il affiche moins de {p0} °C.",
  "tutorial.chillextractionpresentation.hint":
    "Rien ne se dégrade encore. Le froid est mis en réserve face à la chaleur que les sels vont libérer.",
  "tutorial.chillextractionpresentation.label":
    "Attendre moins de {p0} °C",
  "tutorial.chillextractionpresentation.title2":
    "Installez le bain de glace avant les sels",
  "tutorial.chillextractionpresentation.instruction2":
    "Les sels libèrent le même exotherme quelle que soit la température de départ du tube : le seul moyen de contenir le pic est donc de partir bas. Dans l'Inventaire, ouvrez DIVERS, puis glissez le bain de glace sur le plan de travail central.",
  "tutorial.chillextractionpresentation.hint2":
    "Au-dessus de 30 °C, les résidus commencent à se dégrader, et pas tous à la même vitesse. L'étalon interne, lui, ne se dégrade pas du tout : le rapport ne peut donc rien corriger.",
  "tutorial.chillextractionpresentation.label2":
    "Glisser sur le plan de travail",
  "tutorial.chillextractionpresentation.title3":
    "Refroidissez le tube dans le bain de glace",
  "tutorial.chillextractionpresentation.instruction3":
    "Glissez le tube d'extraction dans le bain de glace et laissez-le jusqu'à ce qu'il affiche moins de {p0} °C.",
  "tutorial.chillextractionpresentation.hint3":
    "Salé à température ambiante, le tube culmine vers 45 °C et perd des résidus, même avec un passage parfait à l'agitateur.",
  "tutorial.chillextractionpresentation.label3":
    "Glisser le tube dans le bain de glace",
  "tutorial.saltextractionpresentation.title":
    "Ressortez le tube refroidi",
  "tutorial.saltextractionpresentation.instruction":
    "Glissez le tube hors du bain de glace et déposez-le sur un poste de paillasse libre. Les sels ne peuvent pas être versés tant que le tube est dans la glace.",
  "tutorial.saltextractionpresentation.hint":
    "Hors de la glace, le tube se réchauffe lentement : vous avez le temps de viser — la course commence quand les sels entrent.",
  "tutorial.saltextractionpresentation.label":
    "Glisser le tube hors du bain de glace",
  "tutorial.saltextractionpresentation.title2":
    "Ajoutez les sels QuEChERS",
  "tutorial.saltextractionpresentation.instruction2":
    "Glissez le sachet de sels QuEChERS mis en évidence sur le tube d'extraction et confirmez l'ajout. Le compte à rebours démarre à la confirmation : vous avez alors 15 secondes pour fermer le tube, le déposer dans l'agitateur vortex et lancer le cycle.",
  "tutorial.saltextractionpresentation.hint2":
    "Sachez où vous allez avant de confirmer : fermer le tube, le glisser dans l'agitateur, cliquer sur Démarrer le vortex.",
  "tutorial.saltextractionpresentation.deadline":
    "15 secondes démarrent dès que vous confirmez",
  "tutorial.saltextractionpresentation.label2":
    "Ajouter le sachet de sels",
  "tutorial.labelsamplevialpresentation.title":
    "Ressortez le terminal LIMS",
  "tutorial.labelsamplevialpresentation.instruction":
    "Dans l'Inventaire, ouvrez Équipements de paillasse. Glissez le terminal LIMS mis en évidence et déposez-le sur le plan de travail central.",
  "tutorial.labelsamplevialpresentation.hint":
    "La fiche de réception est toujours là ; le terminal ne sert qu'à réimprimer depuis celle-ci.",
  "tutorial.labelsamplevialpresentation.label":
    "Glisser sur le plan de travail",
  "tutorial.labelsamplevialpresentation.title2":
    "Imprimez une seconde étiquette",
  "tutorial.labelsamplevialpresentation.instruction2":
    "Cliquez sur Imprimer l'étiquette dans le terminal LIMS pour réimprimer l'étiquette de réception.",
  "tutorial.labelsamplevialpresentation.hint2":
    "C'est le même code échantillon que le sachet : une réception, une identité, quel que soit le nombre de contenants traversés.",
  "tutorial.labelsamplevialpresentation.label2":
    "Cliquer sur Imprimer l'étiquette",
  "tutorial.labelsamplevialpresentation.title3":
    "Collez l'étiquette sur le vial d'échantillon",
  "tutorial.labelsamplevialpresentation.instruction3":
    "Glissez l'étiquette LIMS imprimée et déposez-la sur le vial d'échantillon.",
  "tutorial.labelsamplevialpresentation.hint3":
    "L'instrument lit le rack position par position : le vial doit donc dire ce qu'il contient. Sans étiquette, la ligne de la console arrive vide et vous devez saisir le nom à la main.",
  "tutorial.labelsamplevialpresentation.label3":
    "Déposer sur le vial",
  "tutorial.calibrationvialpresentation.title":
    "Dopez l'étalon à {p0} ng/mL avec l'étalon interne",
  "tutorial.calibrationvialpresentation.instruction":
    "Glissez la solution d'étalon interne mise en évidence sur le vial à {p1} ng/mL. Remplacez le volume proposé par {p0} mL, puis cliquez sur Add.",
  "tutorial.calibrationvialpresentation.hint":
    "Chaque niveau reçoit la même dose d'étalon interne — c'est ce qui rend le rapport comparable sur toute la gamme. L'étalon a besoin de la même concentration d'étalon interne que l'échantillon, pas du même volume : le tube a reçu 0,05 mL dans 10 mL de solvant, et ce vial en contient 1 mL. Dix fois trop ici biaiserait tous les rapports d'un facteur dix.",
  "tutorial.calibrationvialpresentation.label":
    "Ajouter {p0} mL d'étalon interne",
  "tutorial.calibrationvialpresentation.title2":
    "Prenez le point d'étalonnage {p0} sur {p1} sur l'étagère",
  "tutorial.calibrationvialpresentation.instruction2":
    "Dans l'Inventaire, ouvrez Contenants. Glissez le vial d'étalon mis en évidence sur un poste de paillasse libre, réglez le niveau sur {p0} ng/mL, puis cliquez sur Prendre le vial.",
  "tutorial.calibrationvialpresentation.hint2":
    "Personne ne dilue un étalon à la paillasse le matin d'une série : les niveaux sont préparés, répartis et étiquetés à l'avance. L'étiquette indique déjà quel niveau se trouve dans le vial — prenez celui à {p0} ng/mL.",
  "tutorial.calibrationvialpresentation.title3":
    "L'étalon est prêt",
  "tutorial.calibrationvialpresentation.instruction3":
    "L'étalon à {p0} ng/mL est préparé et dopé. Bouchez-le et passez au chargement du rack.",
  "tutorial.calibrationvialpresentation.hint3":
    "Un point unique fixe la réponse par ng/mL et rien d'autre : la droite est forcée par l'origine, et un échantillon au-dessus du point sort du domaine étalonné, sans droite à extrapoler. Attendez-vous à ce que cela arrive — un lot peut porter trois fois ce niveau, et c'est la dilution qui répond. La gamme complète se construit en mode libre.",
  "tutorial.calibrationvialpresentation.label2":
    "Prendre un vial à {p0} ng/mL",
  "tutorial.calibrationvialpresentation.title4":
    "Prenez l'étalon à {p0} ng/mL sur l'étagère",
  "tutorial.addworkbenchstationpresentation.title":
    "Ajoutez un poste de paillasse",
  "tutorial.addworkbenchstationpresentation.instruction":
    "Aucun poste n'est libre pour le {p0}. Cliquez sur le bouton + mis en évidence dans l'en-tête de la paillasse pour en ajouter un.",
  "tutorial.addworkbenchstationpresentation.hint":
    "Dès que le nouveau poste apparaît, le tutoriel repointe vers l'élément à poser.",
  "tutorial.addworkbenchstationpresentation.label":
    "Cliquer sur +",
  "tutorial.storegrinderpresentation.title":
    "Transférez la poudre broyée",
  "tutorial.storegrinderpresentation.instruction":
    "Glissez la poudre broyée hors du broyeur et déposez-la dans le contenant de stockage PEHD. Rangez ensuite le broyeur vide.",
  "tutorial.storegrinderpresentation.title2":
    "Sortez un contenant de stockage PEHD",
  "tutorial.storegrinderpresentation.instruction2":
    "Dans l'Inventaire, ouvrez Contenants. Glissez le bocal PEHD à col large et déposez-le sur un poste de paillasse libre.",
  "tutorial.storegrinderpresentation.title3":
    "Rangez le broyeur vide",
  "tutorial.storegrinderpresentation.instruction3":
    "Cliquez sur Ranger dans l'inventaire dans l'en-tête du broyeur cryogénique.",
  "tutorial.storeequipmentpresentation.title":
    "Retirez le {p0}",
  "tutorial.storeequipmentpresentation.instruction":
    "Glissez le {p0} hors du {p1} et déposez-le sur un poste de paillasse libre.",
  "tutorial.storeequipmentpresentation.hint":
    "Le {p0} ne peut être rangé qu'une fois vide.",
  "tutorial.storeequipmentpresentation.label":
    "Sortir le {p0}",
  "tutorial.storeequipmentpresentation.title2":
    "Rangez le {p0}",
  "tutorial.storeequipmentpresentation.instruction2":
    "Cliquez sur Ranger dans l'inventaire dans l'en-tête du {p0}.",
  "tutorial.storeequipmentpresentation.label2":
    "Cliquer sur Ranger dans l'inventaire",
  "tutorial.infertutorialaction.label":
    "Patienter et observer",
  "tutorial.infertutorialaction.label2":
    "Saisir les valeurs demandées",
  "tutorial.infertutorialaction.label3":
    "Utiliser le raccourci clavier",
  "tutorial.infertutorialaction.label4":
    "Glisser-déposer",
  "tutorial.infertutorialaction.label5":
    "Cliquer sur la commande mise en évidence",
  "tutorial.infertutorialaction.label6":
    "Suivre la zone mise en évidence",
  "tutorial.declarecalibrationlevelspresentation.title":
    "Installez le LC-MS/MS",
  "tutorial.declarecalibrationlevelspresentation.instruction":
    "Dans l'Inventaire, ouvrez Équipements de paillasse. Glissez le LC-MS/MS et déposez-le sur le plan de travail central.",
  "tutorial.declarecalibrationlevelspresentation.title2":
    "Chargez le rack dans le LC-MS/MS",
  "tutorial.declarecalibrationlevelspresentation.instruction2":
    "Glissez le rack chargé mis en évidence et déposez-le dans le LC-MS/MS.",
  "tutorial.declarecalibrationlevelspresentation.title3":
    "Déclarez les niveaux d'étalonnage dans la méthode",
  "tutorial.declarecalibrationlevelspresentation.instruction3":
    "Ouvrez la console d'acquisition et cliquez sur Gérer les méthodes. Une méthode intégrée ne peut pas être modifiée : dupliquez-la d'abord, puis saisissez {p0} dans Niveaux d'étalonnage et enregistrez la copie. Sélectionnez cette copie comme méthode d'acquisition.",
  "tutorial.declarecalibrationlevelspresentation.hint":
    "Rien ne vérifie ces valeurs par rapport aux vials. Ce que vous saisissez ici est ce que le fichier de méthode exporté déclarera comme contenu des étalons — déclarez {p0}, les niveaux que vous avez réellement préparés, dans cet ordre. Le fichier écrit une colonne Conc. par niveau, et la plateforme les lit par position.",
  "tutorial.declarecalibrationlevelspresentation.label":
    "Gérer les méthodes",
  "tutorial.launchsequencepresentation.title":
    "Installez le LC-MS/MS",
  "tutorial.launchsequencepresentation.instruction":
    "Dans l'Inventaire, ouvrez Équipements de paillasse. Glissez le LC-MS/MS et déposez-le sur le plan de travail central.",
  "tutorial.launchsequencepresentation.title2":
    "Chargez le rack dans le LC-MS/MS",
  "tutorial.launchsequencepresentation.instruction2":
    "Glissez le rack chargé mis en évidence et déposez-le dans le LC-MS/MS.",
  "tutorial.launchsequencepresentation.title3":
    "Lancez l'acquisition",
  "tutorial.launchsequencepresentation.instruction3":
    "Cliquez sur Ouvrir la console d'acquisition. Vérifiez qu'une ligne correspond au vial d'étalon et l'autre au vial d'échantillon, puis cliquez sur Lancer l'acquisition.",
  "tutorial.launchsequencepresentation.label":
    "Ouvrir la console, puis lancer",
  "tutorial.cleanupacquisitionpresentation.title":
    "Déchargez le rack",
  "tutorial.cleanupacquisitionpresentation.instruction":
    "Dans le LC-MS/MS, cliquez sur Décharger le rack.",
  "tutorial.cleanupacquisitionpresentation.label":
    "Cliquer sur Décharger le rack",
  "tutorial.cleanupacquisitionpresentation.title2":
    "Videz le rack autosampler",
  "tutorial.cleanupacquisitionpresentation.instruction2":
    "Glissez les deux vials hors du rack et posez-les sur la paillasse ou jetez-les à la poubelle.",
  "tutorial.cleanupacquisitionpresentation.title3":
    "Rangez le rack vide",
  "tutorial.cleanupacquisitionpresentation.instruction3":
    "Cliquez sur Ranger dans l'inventaire dans l'en-tête du rack autosampler.",
  "tutorial.cleanupacquisitionpresentation.title4":
    "Rangez le LC-MS/MS",
  "tutorial.cleanupacquisitionpresentation.instruction4":
    "Cliquez sur Ranger dans l'inventaire dans l'en-tête du LC-MS/MS.",
  "tutorial.weigh-received-sample.title":
    "Pesez le sachet d'échantillon reçu",
  "tutorial.weigh-received-sample.instruction":
    "Dans l'Inventaire, ouvrez Équipements de paillasse. Glissez la balance de réception mise en évidence et déposez-la sur le plan de travail central. Ouvrez ensuite le panier de fruits, glissez le sachet d'échantillon et déposez-le sur la balance.",
  "tutorial.weigh-received-sample.hint":
    "Déposer le sachet sur la balance enregistre automatiquement sa masse brute.",
  "tutorial.register-and-label-sample.title":
    "Enregistrez et identifiez l'échantillon",
  "tutorial.register-and-label-sample.instruction":
    "Remplissez le formulaire LIMS, cliquez sur Créer la fiche LIMS, puis sur Imprimer l'étiquette.",
  "tutorial.register-and-label-sample.hint":
    "Glissez l'étiquette LIMS imprimée et déposez-la directement sur le sachet d'échantillon.",
  "tutorial.store-gross-balance.title":
    "Rangez la balance de réception",
  "tutorial.store-gross-balance.instruction":
    "Glissez le sachet d'échantillon hors de la balance et déposez-le sur un poste de paillasse libre. Cliquez ensuite sur Ranger dans l'inventaire dans l'en-tête de la balance.",
  "tutorial.store-gross-balance.hint":
    "Le bouton Ranger dans l'inventaire devient disponible une fois le plateau de pesée vide.",
  "tutorial.store-gross-balance.title2":
    "Rangez le terminal LIMS",
  "tutorial.store-gross-balance.instruction2":
    "Cliquez sur le bouton Ranger dans l'inventaire mis en évidence, en haut à droite du terminal LIMS.",
  "tutorial.store-gross-balance.hint2":
    "La fiche LIMS et l'étiquette imprimée restent enregistrées après le rangement du terminal.",
  "tutorial.store-gross-balance.label":
    "Cliquer sur le bouton en haut à droite",
  "tutorial.cut-sample.title":
    "Découpez les pommes",
  "tutorial.cut-sample.instruction":
    "Glissez une planche à découper depuis l'Inventaire et déposez-la sur un poste de paillasse libre. Glissez les pommes du sachet d'échantillon sur la planche, cliquez sur Couteau en acier inoxydable dans Actions, puis cliquez sur les pommes.",
  "tutorial.cut-sample.hint":
    "Cliquer sur les pommes avec le couteau actif fait passer leur état de matière à découpé.",
  "tutorial.cut-sample.title2":
    "Sortez une planche à découper",
  "tutorial.cut-sample.instruction2":
    "Dans l'Inventaire, ouvrez DIVERS. Glissez une planche à découper et déposez-la sur un poste de paillasse libre.",
  "tutorial.cut-sample.label":
    "Glisser la planche sur la paillasse",
  "tutorial.cut-sample.title3":
    "Ouvrez le sachet d'échantillon",
  "tutorial.cut-sample.instruction3":
    "Cliquez sur le bouton Ouvrir mis en évidence sur le sachet d'échantillon. Les pommes ne peuvent pas être glissées tant que le sachet est scellé.",
  "tutorial.cut-sample.hint2":
    "Une fois le sachet ouvert, le tutoriel mettra en évidence les pommes qu'il contient.",
  "tutorial.cut-sample.label2":
    "Cliquer sur Ouvrir",
  "tutorial.cut-sample.title4":
    "Posez les pommes sur la planche à découper",
  "tutorial.cut-sample.instruction4":
    "Glissez les pommes elles-mêmes, mises en évidence — pas le sachet — et déposez-les sur la planche à découper.",
  "tutorial.cut-sample.hint3":
    "Le sachet d'échantillon reste en place. Seul le lot de pommes passe sur la planche de préparation.",
  "tutorial.cut-sample.label3":
    "Glisser les pommes",
  "tutorial.cut-sample.title5":
    "Sélectionnez le couteau en acier inoxydable",
  "tutorial.cut-sample.instruction5":
    "Cliquez sur le couteau mis en évidence dans Actions, ou appuyez sur K. Cliquez ensuite sur les pommes posées sur la planche pour les découper.",
  "tutorial.cut-sample.hint4":
    "Le bouton du couteau reste actif jusqu'à ce que vous recliquiez dessus ou sélectionniez une autre action.",
  "tutorial.cut-sample.label4":
    "Cliquer sur le couteau ou appuyer sur K",
  "tutorial.grind-sample.title":
    "Homogénéisez l'échantillon à froid",
  "tutorial.grind-sample.instruction":
    "Glissez le broyeur cryogénique mis en évidence depuis l'Inventaire et déposez-le sur le plan de travail central. Glissez ensuite les pommes découpées et des pastilles de carboglace dans le broyeur, puis cliquez sur Démarrer le broyeur.",
  "tutorial.grind-sample.hint":
    "Attendez la fin du cycle et que l'état de la matière passe à broyé.",
  "tutorial.store-grinder.title":
    "Videz et rangez le broyeur",
  "tutorial.store-grinder.instruction":
    "Glissez un contenant de stockage PEHD depuis l'Inventaire sur un poste de paillasse libre. Transférez-y la poudre broyée, puis cliquez sur Ranger dans l'inventaire dans l'en-tête du broyeur.",
  "tutorial.store-grinder.hint":
    "Le broyeur doit être vide pour que Ranger dans l'inventaire devienne disponible.",
  "tutorial.weigh-test-portion.title":
    "Préparez la prise d'essai",
  "tutorial.weigh-test-portion.instruction":
    "Glissez la balance analytique mise en évidence depuis l'Inventaire et déposez-la sur le plan de travail central. Posez-y un tube de 50 mL, cliquez sur Tare, puis utilisez l'action Spatule à poudre pour ajouter environ 10,000 g de poudre.",
  "tutorial.weigh-test-portion.hint":
    "La masse totale affichée pour le tube doit atteindre au moins 9,5 g.",
  "tutorial.store-analytical-balance.title":
    "Rangez la balance analytique",
  "tutorial.store-analytical-balance.instruction":
    "Glissez le tube pesé hors de la balance analytique et déposez-le sur un poste de paillasse libre. Cliquez ensuite sur Ranger dans l'inventaire dans l'en-tête de la balance.",
  "tutorial.store-analytical-balance.hint":
    "La prise d'essai reste dans le tube ; seule la balance vide est rangée.",
  "tutorial.prepare-extraction.title":
    "Préparez l'extraction QuEChERS",
  "tutorial.prepare-extraction.instruction":
    "Glissez la solution d'étalon interne sur le tube et confirmez le volume. Recommencez avec l'acétonitrile pour ajouter 10 mL. Installez ensuite l'agitateur vortex sur le plan de travail pour qu'il soit prêt.",
  "tutorial.prepare-extraction.hint":
    "Ajoutez l'étalon interne avant le solvant pour préserver la bonne traçabilité analytique. L'agitateur est installé dès maintenant parce que les sels ne laissent que 15 secondes pour l'atteindre.",
  "tutorial.chill-extraction.title":
    "Refroidissez le tube avant les sels",
  "tutorial.chill-extraction.instruction":
    "Sortez le bain de glace de la section DIVERS de l'Inventaire, puis glissez-y le tube d'extraction et laissez-le jusqu'à ce qu'il affiche moins de 1 °C.",
  "tutorial.chill-extraction.hint":
    "Les sels provoquent la même hausse quelle que soit la température de départ du tube. Depuis l'ambiante, cela culmine vers 45 °C, bien au-dessus des 30 °C à partir desquels les résidus se dégradent.",
  "tutorial.salt-extraction.title":
    "Ajoutez les sels QuEChERS",
  "tutorial.salt-extraction.instruction":
    "Glissez le tube refroidi hors du bain de glace sur un poste de paillasse libre, puis glissez le sachet de sels QuEChERS dessus et confirmez.",
  "tutorial.salt-extraction.hint":
    "La confirmation déclenche le compte à rebours de 15 secondes avant la prise en masse. Repérez l'agitateur avant de cliquer.",
  "tutorial.vortex-extract.title":
    "Vortexez l'extraction",
  "tutorial.vortex-extract.instruction":
    "Glissez-déposez le tube d'extraction fermé dans l'agitateur vortex qui attend sur le plan de travail, puis cliquez sur Démarrer le vortex. Les sels réagissent déjà : faites-le tout de suite.",
  "tutorial.vortex-extract.hint":
    "Attendez la fin du cycle de vortex avant de retirer le tube.",
  "tutorial.store-vortex.title":
    "Rangez l'agitateur vortex et le bain de glace",
  "tutorial.store-vortex.instruction":
    "Glissez le tube mélangé hors de l'agitateur vortex et déposez-le sur un poste de paillasse libre. Cliquez ensuite sur Ranger dans l'inventaire dans l'en-tête de l'agitateur, puis dans celui du bain de glace.",
  "tutorial.store-vortex.hint":
    "La centrifugeuse prend le relais à l'étape suivante, et le froid ne protège plus rien une fois les résidus passés dans le solvant.",
  "tutorial.separate-extract.title":
    "Centrifugez l'extrait",
  "tutorial.separate-extract.instruction":
    "Glissez la centrifugeuse mise en évidence depuis l'Inventaire et déposez-la sur le plan de travail central. Glissez le tube vortexé dans la centrifugeuse et cliquez sur Démarrer la centrifugeuse.",
  "tutorial.separate-extract.hint":
    "Attendez la fin du cycle et que la phase d'extrait soit séparée.",
  "tutorial.prepare-sample-vial.title":
    "Préparez le vial d'échantillon",
  "tutorial.prepare-sample-vial.instruction":
    "Glissez un vial autosampler depuis l'Inventaire sur un poste de paillasse libre. Sélectionnez Micropipette dans Actions, cliquez sur le tube séparé pour aspirer, puis sur le vial pour distribuer.",
  "tutorial.prepare-sample-vial.hint":
    "Le vial devient un vial d'échantillon dès qu'il reçoit de l'extrait provenant du tube séparé.",
  "tutorial.label-sample-vial.title":
    "Identifiez le vial d'échantillon",
  "tutorial.label-sample-vial.instruction":
    "Ressortez le terminal LIMS sur le plan de travail, cliquez une seconde fois sur Imprimer l'étiquette, puis glissez l'étiquette imprimée sur le vial d'échantillon.",
  "tutorial.label-sample-vial.hint":
    "Le vial quitte la paillasse pour un rack de vials identiques. Seule l'étiquette dit encore quel échantillon il contient — et c'est elle que l'instrument lit pour nommer le fichier qu'il écrit.",
  "tutorial.store-centrifuge.title":
    "Rangez la centrifugeuse",
  "tutorial.store-centrifuge.instruction":
    "Glissez le tube hors de la centrifugeuse et déposez-le sur un poste de paillasse libre. Cliquez ensuite sur Ranger dans l'inventaire dans l'en-tête de la centrifugeuse.",
  "tutorial.store-centrifuge.hint":
    "Le vial d'échantillon préparé conserve l'extrait nécessaire aux étapes restantes.",
  "tutorial.prepare-calibration-vial.title":
    "Préparez l'étalon d'étalonnage",
  "tutorial.prepare-calibration-vial.instruction":
    "Prenez un vial d'étalon dans Contenants — à {p1} ng/mL — et dopez-le avec {p0} mL de solution d'étalon interne.",
  "tutorial.prepare-calibration-vial.hint":
    "Le vial arrive préparé et étiqueté par le laboratoire des étalons, mais débouché et non dopé : l'étalon interne reste à votre charge. Une vraie série passe plusieurs niveaux — un point unique force la droite par l'origine — mais chacun se prépare avec les trois mêmes gestes : le tutoriel en fait un et laisse la gamme complète au mode libre.",
  "tutorial.stage-vials.title":
    "Placez toute la série pour la séquence",
  "tutorial.stage-vials.instruction":
    "Glissez le rack autosampler mis en évidence depuis l'Inventaire et déposez-le sur le plan de travail central. Fermez le vial d'échantillon et l'étalon, puis glissez-déposez chacun dans une position libre du rack.",
  "tutorial.stage-vials.hint":
    "Deux vials, deux injections, dans l'ordre du rack. La provenance physique de chaque vial permet au système de distinguer l'échantillon du point d'étalonnage — rien n'est déduit de la position.",
  "tutorial.declare-calibration-levels.title":
    "Déclarez le niveau d'étalonnage dans la méthode",
  "tutorial.declare-calibration-levels.instruction":
    "Glissez le LC-MS/MS mis en évidence depuis l'Inventaire et déposez-le sur le plan de travail central. Chargez le rack, ouvrez la console et cliquez sur Gérer les méthodes. Dupliquez la méthode intégrée, saisissez le niveau que vous avez préparé dans Niveaux d'étalonnage, et enregistrez la copie.",
  "tutorial.declare-calibration-levels.hint":
    "Le fichier de méthode exporté comporte une colonne de concentration par niveau déclaré ici, et aucune si vous n'en déclarez aucun. Cette étape se valide au démarrage de la séquence.",
  "tutorial.launch-sequence.title":
    "Chargez et lancez la séquence",
  "tutorial.launch-sequence.instruction":
    "Glissez le LC-MS/MS mis en évidence depuis l'Inventaire et déposez-le sur le plan de travail central. Glissez-déposez le rack chargé dans l'instrument, ouvrez la console, vérifiez les deux lignes et cliquez sur Lancer l'acquisition.",
  "tutorial.launch-sequence.hint":
    "La séquence doit contenir une injection d'étalonnage et une injection d'échantillon.",
  "tutorial.review-results.title":
    "Examinez les résultats",
  "tutorial.review-results.instruction":
    "Attendez la fin des deux injections, puis comparez les résultats du point d'étalonnage et de l'échantillon.",
  "tutorial.review-results.hint":
    "Vous pouvez suivre l'injection en cours directement sur l'illustration de l'instrument.",
  "tutorial.review-results.title2":
    "Attendez les deux injections",
  "tutorial.review-results.instruction2":
    "Surveillez l'écran de l'instrument mis en évidence. L'acquisition est à {p0} % ; attendez la fin des injections d'étalonnage et d'échantillon.",
  "tutorial.review-results.hint2":
    "Ne déchargez pas le rack pendant l'acquisition. Les résultats s'ouvrent automatiquement au fur et à mesure des injections.",
  "tutorial.review-results.label":
    "Patienter — {p0} % effectués",
  "tutorial.store-acquisition-equipment.title":
    "Libérez le plan de travail d'acquisition",
  "tutorial.store-acquisition-equipment.instruction":
    "Cliquez sur Décharger le rack depuis le LC-MS/MS, glissez les deux vials hors du rack et posez-les sur la paillasse ou jetez-les. Cliquez ensuite sur Ranger dans l'inventaire pour le rack vide et pour le LC-MS/MS.",
  "tutorial.store-acquisition-equipment.hint":
    "Les résultats restent consultables après le rangement des équipements.",
  "tutorial.definition.title":
    "1 point d'étalonnage + 1 échantillon",
  "tutorial.reception.title":
    "Réception de l'échantillon",
  "tutorial.sample-preparation.title":
    "Préparation de l'échantillon",
  "tutorial.extraction.title":
    "Extraction QuEChERS",
  "tutorial.vials.title":
    "Préparation des vials",
  "tutorial.acquisition.title":
    "Rack et acquisition",


  // Tutorial coach panel and interventions
  "coach.resume": "Reprendre le tutoriel",
  "coach.title": "Tutoriel guidé",
  "coach.chapterProgress": "{chapter} · {percent} %",
  "coach.pause": "Mettre le tutoriel en pause",
  "coach.pauseShort": "Pause",
  "coach.complete": "Tutoriel terminé",
  "coach.completeBody":
    "Le point d'étalonnage et l'échantillon ont été acquis. Passez cette expérience en mode libre pour continuer sans l'accompagnement, ou redémarrez le tutoriel.",
  "coach.switchToFreeMode": "Passer en mode libre",
  "coach.objectives": "{done}/{total} objectifs",
  "coach.restart": "Redémarrer",
  "coach.inventoryFallback": "Inventaire",
  "coach.openBasket.title": "Ouvrez le panier de fruits",
  "coach.openBasket.instruction":
    "Cliquez sur le panier de fruits mis en évidence pour l'ouvrir. Le sachet d'échantillon ou les pommes apparaîtront alors à l'intérieur.",
  "coach.openBasket.hint":
    "Le tutoriel mettra en évidence l'élément nécessaire dès que le contenant sera ouvert.",
  "coach.openBasket.label": "Cliquer sur le panier mis en évidence",
  "coach.openTrash.title": "Ouvrez la poubelle",
  "coach.openTrash.instruction":
    "Cliquez sur la poubelle mise en évidence pour l'ouvrir. L'élément à récupérer apparaîtra alors à l'intérieur.",
  "coach.openTrash.label": "Cliquer sur la poubelle mise en évidence",
  "tutorial.put-spatula-away.title": "Videz la spatule et rangez-la",
  "tutorial.put-spatula-away.instruction":
    "La spatule contient encore la poudre restée après le dosage. Cliquez sur la poubelle pour la vider, puis reposez la spatule en appuyant sur S ou en recliquant dessus dans Actions.",
  "tutorial.put-spatula-away.hint":
    "La poudre restante ne retourne jamais dans le pot de stock : la remettre contaminerait la réserve. Un outil reste en main tant que vous ne le reposez pas, et le glisser-déposer est bloqué pendant ce temps.",
  "tutorial.putspatulaawaypresentation.title": "Jetez la poudre restante",
  "tutorial.putspatulaawaypresentation.instruction":
    "Cliquez sur la poubelle mise en évidence pour vider la spatule, puis reposez-la en appuyant sur S ou en recliquant dessus dans Actions.",
  "tutorial.putspatulaawaypresentation.hint":
    "Une poudre sortie du pot est un déchet : la remettre contaminerait la réserve. Les étapes suivantes sont des glisser-déposer, bloqués tant que la spatule est en main.",
  "tutorial.putspatulaawaypresentation.label": "Cliquer sur la poubelle",
  "coach.dropDraft.amount.title": "Saisissez la quantité",
  "coach.dropDraft.amount.instruction":
    "Le dépôt est préparé, pas encore effectué. Mettez {p0} dans le champ mis en évidence, puis le tutoriel pointera le bouton {p1}.",
  "coach.dropDraft.amount.hint":
    "Cliquez dans le champ et tapez la valeur, ou faites défiler la molette dessus. Rien ne quitte le contenant tant que la boîte de dialogue n'est pas confirmée.",
  "coach.dropDraft.amount.label": "Saisir {p0}",
  "coach.dropDraft.confirm.title": "Confirmez la quantité",
  "coach.dropDraft.confirm.instruction":
    "{p0} est bien la quantité demandée par cette étape. Cliquez sur le bouton {p1} mis en évidence pour l'envoyer.",
  "coach.dropDraft.confirm.hint":
    "La valeur reste modifiable : corrigez d'abord le champ si vous vouliez une autre quantité.",
  "coach.dropDraft.confirm.label": "Cliquer sur {p0}",
  "guard.contamination.title": "Contamination évitée",
  "guard.contamination.instruction":
    "Ne posez pas les pommes directement sur la paillasse. Le contact avec la surface nue contaminerait l'échantillon de façon irréversible. Déposez-les plutôt sur la planche à découper mise en évidence.",
  "guard.contamination.hintCancelled":
    "Le dépôt tenté a été annulé : les pommes sont toujours dans leur contenant d'origine.",
  "guard.contamination.hintDeploy":
    "Sortez d'abord une planche à découper de l'Inventaire, puis transférez-y les pommes.",
  "guard.contamination.actionLabel": "Utiliser la planche à découper mise en évidence",
  "guard.contamination.continueLabel": "Continuer le tutoriel",
  "guard.contamination.leaveLabel": "Quitter le tutoriel et poser quand même",
  "guard.tare.title": "Tare protégée",
  "guard.tare.instruction":
    "Le tube contient déjà de la poudre. Retarer masquerait cette masse dans l'affichage Net : le tutoriel a donc annulé l'action. Conservez la tare mesurée avec le tube vide et poursuivez le dosage jusqu'à ce que le Net atteigne environ 10,000 g.",
  "guard.tare.hint":
    "Rien n'a changé sur la balance : la tare initiale du tube vide et la valeur Net actuelle ont été conservées.",
  "guard.tare.actionLabel": "Ne pas retarer",
  "guard.tare.continueLabel": "Conserver la tare du tube vide",
  "guard.tare.leaveLabel": "Quitter le tutoriel et tarer quand même",

  // Textes d'accompagnement propres à une branche : titres et explications que
  // le coach choisit à l'exécution, restés en dur lors de la première passe.
  "tutorial.getlimstutorialvalues.orchardName": "Verger du tutoriel",
  "tutorial.getlimstutorialfieldpresentation.grossMassFallback": "la masse actuelle",
  "tutorial.getlimstutorialfieldpresentation.netMassFallback": "la masse calculée",
  "tutorial.registersamplepresentation.grossMassFallback": "la valeur actuelle",
  "tutorial.registersamplepresentation.netMassFallback": "la masse nette",
  "tutorial.registersamplepresentation.hint5":
    "Laissez le sachet sur la balance pendant que vous installez et complétez le terminal LIMS.",
  "tutorial.registersamplepresentation.hint6":
    "Une fois le terminal installé, reposez le sachet d'échantillon sur la balance de réception avant de saisir les données LIMS.",
  "tutorial.registersamplepresentation.instruction5":
    "Ouvrez le panier de fruits, puis glissez le sachet d'échantillon et déposez-le sur la balance de réception.",
  "tutorial.registersamplepresentation.instruction6":
    "Ouvrez la poubelle, puis glissez le sachet d'échantillon et déposez-le sur la balance de réception.",
  "tutorial.registersamplepresentation.instruction7":
    "Glissez le sachet d'échantillon depuis son poste de paillasse et déposez-le sur la balance de réception.",
  "tutorial.registersamplepresentation.instruction8":
    "Repérez le sachet d'échantillon, puis glissez-le et déposez-le sur la balance de réception.",
  "tutorial.extractionequipmentpresentation.title4":
    "Attendez la fin de l'agitation",
  "tutorial.extractionequipmentpresentation.title5":
    "Attendez la séparation des phases",
  "tutorial.extractionequipmentpresentation.title6":
    "Démarrez le cycle de vortex",
  "tutorial.extractionequipmentpresentation.title7":
    "Fermez le tube d'extraction",
  "tutorial.extractionequipmentpresentation.instruction5":
    "Cliquez sur le bouton Démarrer le vortex mis en évidence.",
  "tutorial.extractionequipmentpresentation.instruction6":
    "Cliquez sur le bouton Fermer mis en évidence sur le tube d'extraction avant de démarrer l'agitateur.",
  "tutorial.samplevialpresentation.title5":
    "Complétez le vial avec de l'extrait",
  "tutorial.samplevialpresentation.title6":
    "Transférez l'extrait dans le vial autosampler",
  "tutorial.samplevialpresentation.instruction6":
    "Le vial contient trop peu pour être injecté : l'aiguille de l'autosampler ne peut pas atteindre les 0,05 mL du fond, et la séquence n'enregistrerait qu'une ligne de base plate. Sélectionnez à nouveau la Micropipette, puis maintenez le clic sur le tube d'extraction pour aspirer environ 1,00 mL et distribuez-les dans le même vial.",
  "tutorial.samplevialpresentation.instruction7":
    "Cliquez sur Micropipette dans Actions, ou appuyez sur P. Maintenez ensuite le clic sur le tube d'extraction séparé jusqu'à ce que la pipette affiche environ 1,00 mL, puis relâchez.",
  "tutorial.spentextractiontubepresentation.hint":
    "Seul ce tube est perdu. L'échantillon broyé est toujours dans le bocal de stockage : une nouvelle prise d'essai de 10 g suffit pour recommencer l'extraction.",
  "tutorial.analyticalweighingpresentation.title5":
    "Sortez un tube de 50 mL de remplacement",
  "tutorial.analyticalweighingpresentation.title6":
    "Sortez un tube de 50 mL",
  "tutorial.analyticalweighingpresentation.title7":
    "Tarez le tube de remplacement",
  "tutorial.analyticalweighingpresentation.title8":
    "Tarez le tube",
  "tutorial.analyticalweighingpresentation.instruction5":
    "Dans l'Inventaire, ouvrez Contenants. Glissez un tube à centrifuger de 50 mL neuf et déposez-le sur la balance analytique. Ne récupérez pas le tube poudré compromis dans la poubelle.",
  "tutorial.analyticalweighingpresentation.instruction6":
    "Dans l'Inventaire, ouvrez Contenants. Glissez un tube à centrifuger de 50 mL et déposez-le sur la balance analytique.",
  "tutorial.analyticalweighingpresentation.instruction7":
    "La spatule contient de la poudre. Maintenez le clic sur le tube posé sur la balance analytique jusqu'à ce que le Net atteigne environ 10,000 g ; relâchez avant 10,2 g.",
  "tutorial.analyticalweighingpresentation.instruction8":
    "Cliquez sur la Spatule à poudre mise en évidence dans Actions, ou appuyez sur S. Cliquez ensuite sur la poudre dans le contenant PEHD pour la charger.",

};
