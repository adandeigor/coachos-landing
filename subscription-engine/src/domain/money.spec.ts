import { eurToXof, convertToBilling, DEFAULT_FX_CONFIG } from './money';

describe('eurToXof', () => {
  it('10,00 EUR -> 6 560 XOF (6559,57 arrondi au franc)', () => {
    expect(eurToXof(1000)).toBe(6560);
  });
  it('1,00 EUR -> 656 XOF', () => expect(eurToXof(100)).toBe(656));
  it('0 -> 0', () => expect(eurToXof(0)).toBe(0));
  it('arrondit 0,5 vers le haut (HALF_UP)', () => {
    // 1 centime à taux 50 XOF/EUR = 0,5 XOF
    expect(eurToXof(1, { ...DEFAULT_FX_CONFIG, rate: '50' })).toBe(1);
    expect(eurToXof(1, { ...DEFAULT_FX_CONFIG, rate: '49.98' })).toBe(0);
  });
  it('FLOOR et CEIL', () => {
    expect(eurToXof(1000, { ...DEFAULT_FX_CONFIG, roundingMode: 'FLOOR' })).toBe(6559);
    expect(eurToXof(1000, { ...DEFAULT_FX_CONFIG, roundingMode: 'CEIL' })).toBe(6560);
  });
  it('arrondi à un multiple de 5 XOF', () => {
    expect(eurToXof(1000, { ...DEFAULT_FX_CONFIG, roundingUnit: 5 })).toBe(6560);
    expect(eurToXof(900, { ...DEFAULT_FX_CONFIG, roundingUnit: 5 })).toBe(5905); // 5903,613 -> 5905
  });
  it('taux configurable', () => {
    expect(eurToXof(1000, { ...DEFAULT_FX_CONFIG, rate: '600' })).toBe(6000);
  });
  it('refuse les entrées invalides', () => {
    expect(() => eurToXof(10.5)).toThrow();
    expect(() => eurToXof(-1)).toThrow();
    expect(() => eurToXof(100, { ...DEFAULT_FX_CONFIG, rate: 'abc' })).toThrow();
    expect(() => eurToXof(100, { ...DEFAULT_FX_CONFIG, rate: '0' })).toThrow();
    expect(() => eurToXof(100, { ...DEFAULT_FX_CONFIG, roundingUnit: 0 })).toThrow();
  });
});

describe('convertToBilling', () => {
  it('même devise : inchangé', () => expect(convertToBilling(5000, 'XOF', 'XOF')).toBe(5000));
  it('EUR -> XOF', () => expect(convertToBilling(1000, 'EUR', 'XOF')).toBe(6560));
  it('XOF -> EUR non pris en charge', () => expect(() => convertToBilling(5000, 'XOF', 'EUR')).toThrow());
});
