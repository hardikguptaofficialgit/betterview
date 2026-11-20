import { describe, it, expect } from 'vitest';
import { parseNumericValue } from '../src/components/table';

describe('parseNumericValue', () => {
  it('parses plain numbers', () => {
    expect(parseNumericValue('42')).toBe(42);
    expect(parseNumericValue('3.14')).toBe(3.14);
    expect(parseNumericValue('0')).toBe(0);
  });

  it('parses numbers with comma separators', () => {
    expect(parseNumericValue('1,200')).toBe(1200);
    expect(parseNumericValue('3,500,000')).toBe(3500000);
  });

  it('parses currency symbols', () => {
    expect(parseNumericValue('$500')).toBe(500);
    expect(parseNumericValue('€75.50')).toBe(75.5);
    expect(parseNumericValue('₹3.5k')).toBe(3500);
    expect(parseNumericValue('₹12k')).toBe(12000);
  });

  it('parses percentages', () => {
    expect(parseNumericValue('45%')).toBe(45);
    expect(parseNumericValue('4.5%')).toBe(4.5);
    expect(parseNumericValue('90%')).toBe(90);
  });

  it('parses multiplier suffixes k, M, B (case-insensitive)', () => {
    expect(parseNumericValue('2.4k')).toBe(2400);
    expect(parseNumericValue('1M')).toBe(1000000);
    expect(parseNumericValue('10M')).toBe(10000000);
    expect(parseNumericValue('1.5B')).toBe(1500000000);
    expect(parseNumericValue('500b')).toBe(500000000000);
  });

  it('parses negative numbers', () => {
    expect(parseNumericValue('-10')).toBe(-10);
    expect(parseNumericValue('-₹5.2k')).toBe(-5200);
  });

  it('returns null for non-numeric or mixed ratio/unit strings', () => {
    expect(parseNumericValue('100:1')).toBeNull();
    expect(parseNumericValue('1.8 TB')).toBeNull();
    expect(parseNumericValue('New URLs/day')).toBeNull();
    expect(parseNumericValue('')).toBeNull();
    expect(parseNumericValue('   ')).toBeNull();
  });
});
