# Gestion des inscriptions boutique — prochaine étape

Le site actuel est une PWA statique. Les favoris, le rayon de découverte et la position sont enregistrés sur l'appareil du joueur. Ce stockage ne peut pas servir de liste d'inscriptions partagée entre joueurs et boutique.

## Parcours visé

1. Une boutique réclame sa fiche et prouve qu'elle représente la Ligue ou le magasin.
2. Elle ouvre les inscriptions pour un événement, renseigne la capacité, une date limite et les informations réellement nécessaires.
3. Le joueur voit les places disponibles, s'inscrit ou se désinscrit et reçoit une confirmation.
4. La boutique suit les inscrits et une liste d'attente, puis marque les présences le jour de l'événement.
5. Les changements de capacité, d'horaire et les annulations envoient des alertes aux personnes concernées.

## Socle nécessaire avant mise en production

- Authentification des joueurs et des organisateurs, avec vérification de la propriété d'une boutique.
- Écriture des inscriptions côté serveur avec transaction atomique pour éviter les surbookings.
- Règles d'accès : le joueur ne voit que son inscription ; la boutique ne voit que ses événements et les données utiles à l'accueil.
- Consentement et durée de conservation des données personnelles, avec suppression à la demande.
- Historique des changements et protection contre les inscriptions répétées ou automatisées.
- Intégration aux événements importés : une boutique ne doit pas pouvoir modifier la source officielle, mais peut compléter les informations d'inscription.

Firebase Auth, Firestore et des Cloud Functions peuvent porter ce flux lorsque la migration prévue sera lancée. Les modèles `shops`, `shopMemberships`, `eventRegistrationSettings` et `registrations` devront être définis avec leurs règles de sécurité et testés avant d'ouvrir les inscriptions aux joueurs.
