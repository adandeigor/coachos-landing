// Montants en unités mineures entières. EUR : centimes (exposant 2). XOF : francs (exposant 0).
// Calcul en BigInt : aucun flottant, donc aucun écart d'arrondi caché.

export type Currency = 'EUR' | 'XOF';

export const CURRENCY_EXPONENT: Record<Currency, number> = { EUR: 2, XOF: 0 };

/** Parité fixe officielle : 1 EUR = 655,957 XOF. */
export const DEFAULT_EUR_XOF_RATE = '655.957';

/**
 * Règle d'arrondi (documentée dans DECISIONS.md) :
 *  - HALF_UP : au franc le plus proche, 0,5 vers le haut (défaut ; 10,00 EUR = 6559,57 -> 6 560 XOF)
 *  - CEIL / FLOOR : disponibles, jamais utilisés par défaut.
 * `roundingUnit` permet d'arrondir à un multiple (ex. 5 ou 10 XOF pour des prix « ronds »).
 */
export type RoundingMode = 'HALF_UP' | 'CEIL' | 'FLOOR';

export interface FxConfig {
  rate: string; // XOF pour 1 EUR, décimal en chaîne
  roundingMode: RoundingMode;
  roundingUnit: number; // entier >= 1, en XOF
}

export const DEFAULT_FX_CONFIG: FxConfig = {
  rate: DEFAULT_EUR_XOF_RATE,
  roundingMode: 'HALF_UP',
  roundingUnit: 1,
};

function parseRate(rate: string): { num: bigint; den: bigint } {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(rate);
  if (!m) throw new Error(`Taux invalide : "${rate}"`);
  const frac = m[2] ?? '';
  const num = BigInt(m[1] + frac);
  if (num === 0n) throw new Error('Le taux ne peut pas être nul');
  return { num, den: 10n ** BigInt(frac.length) };
}

function divRound(n: bigint, d: bigint, mode: RoundingMode): bigint {
  const q = n / d;
  const r = n % d;
  if (r === 0n) return q;
  if (mode === 'FLOOR') return q;
  if (mode === 'CEIL') return q + 1n;
  return r * 2n >= d ? q + 1n : q;
}

/** Convertit un montant EUR (en centimes) en XOF (en francs). */
export function eurToXof(eurCents: number, config: FxConfig = DEFAULT_FX_CONFIG): number {
  if (!Number.isSafeInteger(eurCents) || eurCents < 0) throw new Error('eurCents doit être un entier >= 0');
  if (!Number.isInteger(config.roundingUnit) || config.roundingUnit < 1) {
    throw new Error('roundingUnit doit être un entier >= 1');
  }
  const { num, den } = parseRate(config.rate);
  // XOF = eurCents / 100 * num / den, arrondi au multiple de roundingUnit
  const unit = BigInt(config.roundingUnit);
  const xofUnits = divRound(BigInt(eurCents) * num, 100n * den * unit, config.roundingMode);
  return Number(xofUnits * unit);
}

/** Convertit un prix catalogue vers la devise de facturation. Même devise : inchangé. */
export function convertToBilling(
  amountMinor: number,
  from: Currency,
  to: Currency,
  config: FxConfig = DEFAULT_FX_CONFIG,
): number {
  if (from === to) return amountMinor;
  if (from === 'EUR' && to === 'XOF') return eurToXof(amountMinor, config);
  throw new Error(`Conversion ${from} -> ${to} non prise en charge`);
}
