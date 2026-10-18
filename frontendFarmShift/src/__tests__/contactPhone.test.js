import { describe, expect, it } from 'vitest';
import { validateContactPhone } from '../utils/contactPhone';

describe('Supplier and customer phone validation', () => {
  it.each(['02412345678', '02812345678', '0912345678', '1234567890'])('accepts %s', phone => {
    expect(validateContactPhone(phone)).toBe('');
  });
  it.each(['0241234567', '0281234567', '024123456789', '09123456789', '091234567', '09123abc78', '+84912345678', '091 2345678', '０９１２３４５６７８', ''])('rejects %s', phone => {
    expect(validateContactPhone(phone)).not.toBe('');
  });
});
