# Décisions techniques

| Date | Décision | Raison |
|---|---|---|
| 2026-10-02 | Projet dans `subscription-engine/` du dépôt `coachos-landing` | Seul dépôt accessible à la session ; à extraire vers un dépôt dédié plus tard (aucun lien avec la landing). |
| 2026-10-02 | Stack : NestJS, Prisma, PostgreSQL (Docker Compose), Jest | Validé par Igor. |
| 2026-10-02 | Sondage phase 1 en Node pur, sans dépendance | Isolé du futur moteur. |
| 2026-10-02 | Secrets : `.env.sandbox` ignoré par git, jamais de clé Live | Règle non négociable 1. |
