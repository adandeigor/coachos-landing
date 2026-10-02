// Machine à états des abonnements : fonction pure, sans base de données ni horloge cachée.
// L'appelant fournit `now` ; le résultat décrit le nouvel état à persister.
//
//   PENDING --PAYMENT_CONFIRMED--> ACTIVE
//   PENDING --PENDING_TIMEOUT----> CANCELED
//   ACTIVE  --PERIOD_ENDED------> GRACE (si graceDays > 0) sinon PAST_DUE ; CANCELED si cancelAtPeriodEnd
//   GRACE   --GRACE_ENDED-------> PAST_DUE
//   PAST_DUE--EXPIRY_REACHED----> EXPIRED
//   ACTIVE|GRACE|PAST_DUE|EXPIRED --PAYMENT_CONFIRMED--> ACTIVE (voir règle de période)
//   tout non terminal --CANCEL_REQUESTED--> CANCELED (immédiat) ou drapeau cancelAtPeriodEnd
//   CANCELED est terminal : un paiement tardif est refusé (revue manuelle).

export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'GRACE' | 'PAST_DUE' | 'EXPIRED' | 'CANCELED';
export type PeriodUnit = 'MONTH' | 'YEAR';

export interface Period {
  unit: PeriodUnit;
  count: number;
}

export interface SubscriptionPolicy {
  graceDays: number; // accès conservé après l'échéance (0 = aucune grâce)
  expireAfterDays: number; // jours après l'échéance avant EXPIRED
  pendingTimeoutHours: number; // abandon d'un premier paiement jamais confirmé
}

export const DEFAULT_POLICY: SubscriptionPolicy = { graceDays: 3, expireAfterDays: 30, pendingTimeoutHours: 48 };

export interface SubscriptionState {
  status: SubscriptionStatus;
  period: Period;
  createdAt: Date;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
  expiresAt: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
}

export type SubscriptionEvent =
  | { type: 'PAYMENT_CONFIRMED'; now: Date }
  | { type: 'PERIOD_ENDED'; now: Date }
  | { type: 'GRACE_ENDED'; now: Date }
  | { type: 'EXPIRY_REACHED'; now: Date }
  | { type: 'PENDING_TIMEOUT'; now: Date }
  | { type: 'CANCEL_REQUESTED'; now: Date; atPeriodEnd: boolean };

export type TransitionResult =
  | { ok: true; state: SubscriptionState; changed: boolean; reason: string }
  | { ok: false; error: string };

/** Accès accordé : seulement ACTIVE et GRACE. */
export function hasAccess(status: SubscriptionStatus): boolean {
  return status === 'ACTIVE' || status === 'GRACE';
}

const DAY_MS = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

/**
 * Ajoute des mois/années en UTC. Si le jour n'existe pas dans le mois cible, on recule au dernier jour
 * (31 janv. + 1 mois = 28/29 févr.). Limite connue : pas d'ancre mensuelle, donc une dérive est possible
 * (31 janv. -> 28 févr. -> 28 mars).
 */
export function addPeriod(date: Date, period: Period): Date {
  const months = period.unit === 'YEAR' ? period.count * 12 : period.count;
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const out = new Date(date.getTime());
  out.setUTCDate(1);
  out.setUTCFullYear(y, m, Math.min(date.getUTCDate(), lastDay));
  return out;
}

const fail = (error: string): TransitionResult => ({ ok: false, error });
const done = (state: SubscriptionState, reason: string, changed = true): TransitionResult => ({
  ok: true, state, changed, reason,
});

export function applyEvent(
  s: SubscriptionState,
  e: SubscriptionEvent,
  policy: SubscriptionPolicy = DEFAULT_POLICY,
): TransitionResult {
  const now = e.now;

  switch (e.type) {
    case 'PAYMENT_CONFIRMED': {
      if (s.status === 'CANCELED') return fail('Abonnement annulé : paiement à traiter manuellement');
      // Règle de période :
      //  - PENDING, PAST_DUE, EXPIRED : la période démarre à la date du paiement (pas de rétroactivité)
      //  - ACTIVE, GRACE : la période s'enchaîne à partir de l'échéance existante (aucun jour perdu)
      const continuous = (s.status === 'ACTIVE' || s.status === 'GRACE') && s.currentPeriodEnd !== null;
      const start = continuous ? (s.currentPeriodEnd as Date) : now;
      const end = addPeriod(start, s.period);
      return done({
        ...s,
        status: 'ACTIVE',
        currentPeriodStart: start,
        currentPeriodEnd: end,
        graceEndsAt: null,
        expiresAt: null,
      }, `Paiement confirmé : période jusqu'au ${end.toISOString()}`);
    }

    case 'PERIOD_ENDED': {
      if (s.status !== 'ACTIVE' || !s.currentPeriodEnd) return fail(`PERIOD_ENDED invalide depuis ${s.status}`);
      if (now < s.currentPeriodEnd) return fail('Échéance pas encore atteinte');
      if (s.cancelAtPeriodEnd) {
        return done({ ...s, status: 'CANCELED', canceledAt: now }, 'Annulation effective à l\'échéance');
      }
      const expiresAt = addDays(s.currentPeriodEnd, policy.expireAfterDays);
      if (policy.graceDays > 0) {
        return done({ ...s, status: 'GRACE', graceEndsAt: addDays(s.currentPeriodEnd, policy.graceDays), expiresAt },
          'Échéance dépassée : période de grâce');
      }
      return done({ ...s, status: 'PAST_DUE', graceEndsAt: null, expiresAt }, 'Échéance dépassée : en retard');
    }

    case 'GRACE_ENDED': {
      if (s.status !== 'GRACE' || !s.graceEndsAt) return fail(`GRACE_ENDED invalide depuis ${s.status}`);
      if (now < s.graceEndsAt) return fail('Période de grâce pas encore terminée');
      return done({ ...s, status: 'PAST_DUE' }, 'Grâce terminée : accès suspendu');
    }

    case 'EXPIRY_REACHED': {
      if (s.status !== 'PAST_DUE' || !s.expiresAt) return fail(`EXPIRY_REACHED invalide depuis ${s.status}`);
      if (now < s.expiresAt) return fail('Date d\'expiration pas encore atteinte');
      return done({ ...s, status: 'EXPIRED' }, 'Abonnement expiré');
    }

    case 'PENDING_TIMEOUT': {
      if (s.status !== 'PENDING') return fail(`PENDING_TIMEOUT invalide depuis ${s.status}`);
      if (now < new Date(s.createdAt.getTime() + policy.pendingTimeoutHours * 3_600_000)) {
        return fail('Délai de paiement initial pas encore écoulé');
      }
      return done({ ...s, status: 'CANCELED', canceledAt: now }, 'Premier paiement jamais confirmé');
    }

    case 'CANCEL_REQUESTED': {
      if (s.status === 'CANCELED') return done(s, 'Déjà annulé', false);
      if (e.atPeriodEnd && s.status === 'ACTIVE') {
        return s.cancelAtPeriodEnd
          ? done(s, 'Annulation à l\'échéance déjà demandée', false)
          : done({ ...s, cancelAtPeriodEnd: true }, 'Annulation programmée à l\'échéance');
      }
      return done({ ...s, status: 'CANCELED', canceledAt: now, cancelAtPeriodEnd: false }, 'Annulation immédiate');
    }
  }
}
