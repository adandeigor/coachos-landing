# Résumé phase 2 (à coller dans Confluence, section 10 « Décisions » et journal)

**Phase 2 - Modèle de domaine : terminée (2026-10-02).**

- Schéma Prisma : offres, prix, clients, abonnements, commandes, paiements, journal d'événements, historique de transitions. L'environnement (sandbox/live) est stocké sur abonnement, commande et paiement, avec des clés étrangères composites : la base interdit tout lien entre une ligne sandbox et une ligne live.
- Idempotence en base : référence prestataire unique (`provider`, `providerReference`), événements dédoublonnés par empreinte, `appliedAt` sur le paiement.
- Statuts : en attente, actif, période de grâce, en retard, expiré, annulé. Accès accordé en actif et en grâce uniquement. Politique par défaut : grâce 3 j, expiration 30 j après l'échéance, abandon du premier paiement après 48 h (à valider).
- Période : un paiement reçu en actif ou en grâce s'enchaîne depuis l'ancienne échéance ; reçu en retard ou après expiration, la période repart à la date du paiement. Paiement sur un abonnement annulé : refusé, revue manuelle.
- Conversion EUR -> XOF : taux fixe 655,957 configurable, arrondi au franc le plus proche (0,5 vers le haut), arrondi à 5/10 XOF possible. 10,00 EUR = 6 560 XOF. Le taux et le prix d'origine sont figés sur la commande.
- 34 tests Jest passent (conversion, états, dates, annulation, restauration des droits).
- Non fait / ouvert : migration SQL et PostgreSQL local (phase 3), sondage FeexPay toujours bloqué (la clé de test `test_…` pré-remplie est refusée en 401 ; réponse du support attendue).
