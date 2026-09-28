# Vision produit

## Promesse

**Tu ne rates plus un événement Pokémon près de chez toi.**

Poké Event Alert transforme une recherche manuelle et répétitive en système d'abonnement : l'utilisateur choisit les boutiques, Ligues ou zones qui l'intéressent et reçoit une alerte lorsqu'un nouvel événement apparaît.

## Utilisateurs principaux

### Joueur local
Suit quelques boutiques et veut être averti de leurs prochains événements.

### Joueur compétitif
Suit davantage de Ligues, filtre Cup / Challenge et peut surveiller une zone géographique plus large.

### Organisateur
Veut vérifier la visibilité de ses événements et peut recommander l'outil aux joueurs de sa communauté.

## MVP

### Indispensable

- liste des événements à venir ;
- recherche de boutiques / Ligues ;
- favoris ;
- filtres par type d'événement ;
- abonnement aux alertes ;
- détection nouvel événement ;
- détection modification d'événement ;
- lien vers la source ;
- export calendrier.

### Après MVP

- abonnement par rayon géographique ;
- carte ;
- notification Discord / email ;
- page publique d'une Ligue ;
- historique des changements ;
- préférences avancées de notification ;
- compte organisateur.

## Métriques utiles

Le MVP doit permettre de mesurer :

- nombre de boutiques suivies par utilisateur ;
- taux d'activation des notifications ;
- nombre d'alertes ouvertes ;
- nombre d'événements ajoutés au calendrier ;
- rétention hebdomadaire ;
- proportion de joueurs déclarant avoir découvert un événement grâce à l'outil.

## Contraintes

- Ne pas dépendre d'une seule source sans couche d'abstraction.
- Conserver l'URL et la provenance de chaque événement.
- Éviter d'affirmer qu'un événement est annulé uniquement parce qu'il a disparu d'une source.
- Respecter les conditions d'utilisation des sources de données.
