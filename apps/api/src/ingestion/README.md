# Ingestion

Le pipeline transforme une collecte externe en état local exploitable pour les alertes.

## Règles

- un nouvel identifiant source devient `NEW` ;
- un changement d'un champ significatif devient `UPDATED` et crée une révision ;
- le même événement relu sans changement devient `UNCHANGED` ;
- un événement futur absent d'une collecte **complète** devient `MISSING` ;
- un événement absent ne devient jamais automatiquement `cancelled` ;
- une collecte incomplète n'a pas le droit de marquer des événements comme manquants ;
- une collecte complète contenant zéro événement normalisé ne marque rien comme manquant par sécurité.

Le hash est calculé sur le snapshot normalisé, jamais sur le JSON brut de la source. Une modification technique sans impact joueur ne déclenche donc pas de changement.
