import { describe, expect, it } from 'vitest';
import { fitsMySizes, hasAnySize, type MySizes } from '../mySize';

const mine: MySizes = { tops: 'S', bottoms: 'M', dresses: 'S', shoe: '8' } as MySizes;

describe('fitsMySizes', () => {
  it('matches each category against the right one of her sizes', () => {
    expect(fitsMySizes({ category: 'dresses', size: 'S', shoeSize: null }, mine)).toBe(true);
    expect(fitsMySizes({ category: 'dresses', size: 'L', shoeSize: null }, mine)).toBe(false);
    expect(fitsMySizes({ category: 'bottoms', size: 'M', shoeSize: null }, mine)).toBe(true);
    expect(fitsMySizes({ category: 'outerwear', size: 'M', shoeSize: null }, mine)).toBe(false);
    expect(fitsMySizes({ category: 'shoes', size: null, shoeSize: '8' }, mine)).toBe(true);
    expect(fitsMySizes({ category: 'shoes', size: null, shoeSize: '9' }, mine)).toBe(false);
  });

  it('never hides one-size pieces', () => {
    expect(fitsMySizes({ category: 'bags', size: null, shoeSize: null }, mine)).toBe(true);
    expect(fitsMySizes({ category: 'jewelry', size: 'L', shoeSize: null }, mine)).toBe(true);
  });

  it('keeps a piece listed without a size, and a category she gave no size for', () => {
    expect(fitsMySizes({ category: 'tops', size: null, shoeSize: null }, mine)).toBe(true);
    const onlyDress = { tops: null, bottoms: null, dresses: 'S', shoe: null } as MySizes;
    expect(fitsMySizes({ category: 'tops', size: 'XL', shoeSize: null }, onlyDress)).toBe(true);
  });

  it('keeps everything when she has no sizes at all', () => {
    expect(fitsMySizes({ category: 'tops', size: 'XL', shoeSize: null }, null)).toBe(true);
  });
});

describe('hasAnySize', () => {
  it('is true once one size is given', () => {
    expect(hasAnySize(null)).toBe(false);
    expect(hasAnySize({ tops: null, bottoms: null, dresses: null, shoe: null })).toBe(false);
    expect(hasAnySize({ tops: null, bottoms: null, dresses: 'M', shoe: null } as MySizes)).toBe(
      true,
    );
  });
});
