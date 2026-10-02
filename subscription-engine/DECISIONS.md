# Décisions techniques

| Date | Décision | Raison |
|---|---|---|
| 2026-10-02 | Projet dans `subscription-engine/` du dépôt `coachos-landing` | Seul dépôt accessible à la session ; à extraire vers un dépôt dédié plus tard (aucun lien avec la landing). |
| 2026-10-02 | Stack : NestJS, Prisma, PostgreSQL (Docker Compose), Jest | Validé par Igor. |
| 2026-10-02 | Sondage phase 1 en Node pur, sans dépendance | Isolé du futur moteur. |
| 2026-10-02 | Secrets : `.env.sandbox` ignoré par git, jamais de clé Live | Règle non négociable 1. |
| 2026-10-02 | Phase 2 : domaine pur en TypeScript (`src/domain`), NestJS reporté à la phase 3 | La machine à états et la conversion n'ont pas besoin du framework ; elles se testent sans base. |
| 2026-10-02 | Prisma 6 (pas 7) | Évite la nouvelle configuration `prisma.config.ts` ; `prisma validate` passe. |
| 2026-10-02 | Montants en entiers d'unités mineures (EUR centimes, XOF francs) | Aucun flottant ; calcul de conversion en BigInt. |
| 2026-10-02 | Conversion EUR->XOF : taux `655.957` configurable, arrondi `HALF_UP` au franc, `roundingUnit` optionnel (5 ou 10 XOF) | 10,00 EUR = 6559,57 -> 6 560 XOF, conforme à l'exemple de la doc. Le taux utilisé est figé sur la commande (`Order.fxRate`) avec le prix catalogue d'origine. |
| 2026-10-02 | Environnement (SANDBOX/LIVE) sur Subscription, Order, Payment avec clés étrangères composites `(id, environment)` | La base elle-même refuse qu'un paiement sandbox soit rattaché à une commande ou un abonnement live (règle 3). |
| 2026-10-02 | `Payment` : unicité `(provider, providerReference)` ; `PaymentEvent` : unicité `(provider, environment, dedupeKey)` ; `Payment.appliedAt` | Règle 5 : un événement rejoué ne prolonge jamais deux fois. |
| 2026-10-02 | `tenantId` en simple colonne (défaut `default`), sans logique | Ne bloque pas la décision ouverte multi-tenant. |
| 2026-10-02 | Statuts : PENDING, ACTIVE, GRACE, PAST_DUE, EXPIRED, CANCELED ; accès seulement en ACTIVE et GRACE | GRACE = accès conservé après l'échéance ; PAST_DUE = en retard, accès suspendu, renouvellement encore possible. |
| 2026-10-02 | Politique par défaut : grâce 3 jours, expiration 30 jours après l'échéance, abandon du premier paiement après 48 h | Valeurs de départ configurables (`SubscriptionPolicy`), à valider par Igor. |
| 2026-10-02 | Période : ACTIVE/GRACE -> la nouvelle période s'enchaîne depuis l'ancienne échéance ; PENDING/PAST_DUE/EXPIRED -> elle démarre à la date du paiement | Aucun jour perdu pour un client à jour ; pas de période rétroactive offerte à un client en retard. |
| 2026-10-02 | Paiement sur abonnement CANCELED : refusé par la machine, à traiter manuellement | Évite de ressusciter un abonnement résilié. |
| 2026-10-02 | Limites de montant FeexPay (100 à 2 000 000 XOF) hors du moteur | Spécifique au prestataire : à valider dans l'adaptateur (phase 3). |

## Limites connues (phase 2)
- Calcul des mois sans ancre mensuelle : un abonnement démarré le 31 dérive vers le 28 après février.
- Pas encore de migration SQL générée : le schéma est validé (`prisma validate`), pas appliqué à PostgreSQL (Docker Compose à venir).
