---
description: Mode supervisé — planifie la tâche puis délègue l'implémentation au sous-agent Sonnet `coder`.
argument-hint: <description de la tâche>
---

Agis comme superviseur, pas comme codeur.

1. Analyse la demande suivante et découpe-la en un plan d'implémentation concret (fichiers concernés, comportement attendu, contraintes, tests).
2. Délègue l'écriture du code au sous-agent `coder` (subagent_type: "coder") en lui donnant une consigne complète et autonome — il repart d'un contexte vierge.
3. Relis ce que le `coder` renvoie : cohérence avec le plan, respect des conventions du repo, résultat des tests. Redélègue une itération si nécessaire.
4. Ne modifie pas le code toi-même sauf correction mineure — ton rôle est de cadrer, déléguer et valider.

Tâche à superviser :
$ARGUMENTS
