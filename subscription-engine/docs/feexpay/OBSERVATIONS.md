# Observations réelles FeexPay (sandbox)

Constats mesurés, pas déduits de la doc. Hôte : https://api-v2.feexpay.me

## 2026-10-02 - Premier sondage (depuis le conteneur cloud)

- Hôte joignable depuis le conteneur (TLS OK, ~400 ms, `server: nginx`).
- Erreur d'authentification : `401 {"success":false,"code":"UNAUTHORIZED","message":"Unauthorized","statusCode":401}`.
  - Même réponse avec la clé de Test fournie (préfixe `test_`), avec `Bearer fp_bogus` et sans en-tête.
  - Écart avec la doc : la page « Codes d'erreur » annonce `ERR_INVALID_API_KEY`, pas `UNAUTHORIZED`.
  - Même 401 sur `POST /api/transactions/history` (avec `shop`).
- Écart de format : la doc dit que les clés sont préfixées `fp_` ; la clé de Test fournie commence par `test_`.
- Non testé : payin, webhook (numéro de test non fourni, pas de tunnel).
- Distinguer clé Test / Live : impossible à ce stade, aucune requête authentifiée n'a réussi.

## Doc (PDF) - points à vérifier en test
- Historique : `callback_info` est un objet `{order_id}` dans l'exemple, alors que la doc parle d'une chaîne libre.
- Historique : champ `custom_id`, types `PAYMENT_API`/`PAYOUT_API`/`FEEX_LINK`/`FEEX_PAGE`, réseaux `MTN`, `MOOV`, `CELTIIS BJ`, `CORIS`...

## 2026-10-02 - Second essai (curl brut, même clé `test_...`, 45 caractères)
- Même `401 UNAUTHORIZED`. Le défaut n'est donc pas dans le script du sondage.
- Collection Postman officielle ajoutée (`feexpay-api-rest-payin-payout.postman_collection.json`) : auth Bearer, chemins payin `mtn`, `moov`, `celtiis_bj`, `coris`, `moov_ci`... confirmés.
- Collection : incohérence interne repérée - le payout « FREE SN » pointe vers `/wave_sn` dans son chemin détaillé (`path`) mais `free_sn` dans son `raw`. Sans effet (pas de payout).
