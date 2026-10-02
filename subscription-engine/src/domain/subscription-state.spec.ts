import {
  addPeriod, applyEvent, hasAccess, DEFAULT_POLICY, SubscriptionState, SubscriptionEvent,
} from './subscription-state';

const d = (s: string) => new Date(s + 'T00:00:00.000Z');
const iso = (x: Date | null) => x?.toISOString().slice(0, 10);

const pending = (): SubscriptionState => ({
  status: 'PENDING', period: { unit: 'MONTH', count: 1 }, createdAt: d('2026-01-01'),
  currentPeriodStart: null, currentPeriodEnd: null, graceEndsAt: null, expiresAt: null,
  cancelAtPeriodEnd: false, canceledAt: null,
});

function run(s: SubscriptionState, e: SubscriptionEvent, policy = DEFAULT_POLICY): SubscriptionState {
  const r = applyEvent(s, e, policy);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

const active = () => run(pending(), { type: 'PAYMENT_CONFIRMED', now: d('2026-01-01') }); // fin 2026-02-01

describe('addPeriod', () => {
  it('ajoute des mois', () => expect(iso(addPeriod(d('2026-01-15'), { unit: 'MONTH', count: 1 }))).toBe('2026-02-15'));
  it('recule au dernier jour du mois', () => {
    expect(iso(addPeriod(d('2026-01-31'), { unit: 'MONTH', count: 1 }))).toBe('2026-02-28');
    expect(iso(addPeriod(d('2028-01-31'), { unit: 'MONTH', count: 1 }))).toBe('2028-02-29');
  });
  it('année et passage d\'année', () => {
    expect(iso(addPeriod(d('2026-11-30'), { unit: 'MONTH', count: 3 }))).toBe('2027-02-28');
    expect(iso(addPeriod(d('2026-03-10'), { unit: 'YEAR', count: 1 }))).toBe('2027-03-10');
  });
});

describe('cycle nominal', () => {
  it('PENDING -> ACTIVE au premier paiement, période démarrée à la date du paiement', () => {
    const s = run(pending(), { type: 'PAYMENT_CONFIRMED', now: d('2026-01-05') });
    expect(s.status).toBe('ACTIVE');
    expect(iso(s.currentPeriodStart)).toBe('2026-01-05');
    expect(iso(s.currentPeriodEnd)).toBe('2026-02-05');
  });
  it('renouvellement anticipé : la période s\'enchaîne sans perdre de jours', () => {
    const s = run(active(), { type: 'PAYMENT_CONFIRMED', now: d('2026-01-20') });
    expect(iso(s.currentPeriodStart)).toBe('2026-02-01');
    expect(iso(s.currentPeriodEnd)).toBe('2026-03-01');
  });
  it('ACTIVE -> GRACE -> PAST_DUE -> EXPIRED avec les bonnes dates', () => {
    let s = run(active(), { type: 'PERIOD_ENDED', now: d('2026-02-01') });
    expect(s.status).toBe('GRACE');
    expect(iso(s.graceEndsAt)).toBe('2026-02-04');
    expect(iso(s.expiresAt)).toBe('2026-03-03');
    s = run(s, { type: 'GRACE_ENDED', now: d('2026-02-04') });
    expect(s.status).toBe('PAST_DUE');
    s = run(s, { type: 'EXPIRY_REACHED', now: d('2026-03-03') });
    expect(s.status).toBe('EXPIRED');
  });
  it('graceDays = 0 : ACTIVE -> PAST_DUE directement', () => {
    const s = run(active(), { type: 'PERIOD_ENDED', now: d('2026-02-01') }, { ...DEFAULT_POLICY, graceDays: 0 });
    expect(s.status).toBe('PAST_DUE');
  });
});

describe('restauration des droits', () => {
  it('paiement pendant la grâce : continuité depuis l\'ancienne échéance', () => {
    const g = run(active(), { type: 'PERIOD_ENDED', now: d('2026-02-01') });
    const s = run(g, { type: 'PAYMENT_CONFIRMED', now: d('2026-02-03') });
    expect(s.status).toBe('ACTIVE');
    expect(iso(s.currentPeriodStart)).toBe('2026-02-01');
    expect(iso(s.currentPeriodEnd)).toBe('2026-03-01');
    expect(s.graceEndsAt).toBeNull();
  });
  it('paiement en retard : la période repart à la date du paiement', () => {
    let s = run(active(), { type: 'PERIOD_ENDED', now: d('2026-02-01') });
    s = run(s, { type: 'GRACE_ENDED', now: d('2026-02-04') });
    s = run(s, { type: 'PAYMENT_CONFIRMED', now: d('2026-02-10') });
    expect(s.status).toBe('ACTIVE');
    expect(iso(s.currentPeriodStart)).toBe('2026-02-10');
    expect(iso(s.currentPeriodEnd)).toBe('2026-03-10');
  });
  it('réactivation après expiration', () => {
    let s = run(active(), { type: 'PERIOD_ENDED', now: d('2026-02-01') });
    s = run(s, { type: 'GRACE_ENDED', now: d('2026-02-04') });
    s = run(s, { type: 'EXPIRY_REACHED', now: d('2026-03-03') });
    s = run(s, { type: 'PAYMENT_CONFIRMED', now: d('2026-06-01') });
    expect(s.status).toBe('ACTIVE');
    expect(iso(s.currentPeriodEnd)).toBe('2026-07-01');
  });
});

describe('droits d\'accès', () => {
  it.each([
    ['PENDING', false], ['ACTIVE', true], ['GRACE', true], ['PAST_DUE', false], ['EXPIRED', false], ['CANCELED', false],
  ] as const)('%s -> %s', (st, expected) => expect(hasAccess(st)).toBe(expected));
});

describe('annulation', () => {
  it('à l\'échéance : reste ACTIVE, puis CANCELED', () => {
    let s = run(active(), { type: 'CANCEL_REQUESTED', now: d('2026-01-10'), atPeriodEnd: true });
    expect(s.status).toBe('ACTIVE');
    expect(s.cancelAtPeriodEnd).toBe(true);
    s = run(s, { type: 'PERIOD_ENDED', now: d('2026-02-01') });
    expect(s.status).toBe('CANCELED');
  });
  it('immédiate', () => {
    const s = run(active(), { type: 'CANCEL_REQUESTED', now: d('2026-01-10'), atPeriodEnd: false });
    expect(s.status).toBe('CANCELED');
    expect(iso(s.canceledAt)).toBe('2026-01-10');
  });
  it('idempotente', () => {
    const c = run(active(), { type: 'CANCEL_REQUESTED', now: d('2026-01-10'), atPeriodEnd: false });
    const r = applyEvent(c, { type: 'CANCEL_REQUESTED', now: d('2026-01-11'), atPeriodEnd: false });
    expect(r.ok && r.changed).toBe(false);
  });
  it('un paiement tardif sur un abonnement annulé est refusé (revue manuelle)', () => {
    const c = run(active(), { type: 'CANCEL_REQUESTED', now: d('2026-01-10'), atPeriodEnd: false });
    expect(applyEvent(c, { type: 'PAYMENT_CONFIRMED', now: d('2026-01-12') }).ok).toBe(false);
  });
});

describe('garde-fous', () => {
  it('PENDING abandonné après le délai', () => {
    expect(applyEvent(pending(), { type: 'PENDING_TIMEOUT', now: d('2026-01-02') }).ok).toBe(false);
    expect(run(pending(), { type: 'PENDING_TIMEOUT', now: d('2026-01-04') }).status).toBe('CANCELED');
  });
  it('événements temporels refusés avant l\'heure ou depuis un mauvais état', () => {
    expect(applyEvent(active(), { type: 'PERIOD_ENDED', now: d('2026-01-15') }).ok).toBe(false);
    expect(applyEvent(active(), { type: 'GRACE_ENDED', now: d('2026-03-01') }).ok).toBe(false);
    expect(applyEvent(pending(), { type: 'EXPIRY_REACHED', now: d('2026-03-01') }).ok).toBe(false);
  });
  it('ne mute pas l\'état d\'entrée', () => {
    const s = active();
    const copy = JSON.stringify(s);
    run(s, { type: 'PERIOD_ENDED', now: d('2026-02-01') });
    expect(JSON.stringify(s)).toBe(copy);
  });
});
