/**
 * Saying yes to a request: a promise already made wins, whichever kind.
 *
 * Pure — no emulator needed.
 */

import { describe, expect, it } from 'vitest';
import { acceptClash } from '../bookings/acceptClash';

const TODAY = '2026-10-24';
const active = { status: 'active' as const };

function rental(id: string, startDate: string, endDate: string, status = 'confirmed') {
  return { id, kind: 'rental' as const, status: status as never, startDate, endDate };
}
function purchase(id: string, status = 'confirmed') {
  return { id, kind: 'purchase' as const, status: status as never, startDate: null, endDate: null };
}

describe('accepting a rental', () => {
  it('fine with nothing else holding the piece', () => {
    expect(acceptClash(rental('a', '2026-11-01', '2026-11-03'), active, [], TODAY)).toBeNull();
  });

  it('refused when it overlaps a confirmed rental', () => {
    const other = rental('b', '2026-11-02', '2026-11-04');
    expect(acceptClash(rental('a', '2026-11-01', '2026-11-03'), active, [other], TODAY)).toMatch(
      /someone else for those dates/,
    );
  });

  it('back-to-back is fine (end date is not included)', () => {
    const other = rental('b', '2026-11-03', '2026-11-05');
    expect(acceptClash(rental('a', '2026-11-01', '2026-11-03'), active, [other], TODAY)).toBeNull();
  });

  it('ignores itself in the list', () => {
    const me = rental('a', '2026-11-01', '2026-11-03');
    expect(acceptClash(me, active, [me], TODAY)).toBeNull();
  });

  it('refused when she already agreed to sell the piece', () => {
    expect(
      acceptClash(rental('a', '2026-11-01', '2026-11-03'), active, [purchase('p')], TODAY),
    ).toMatch(/agreed to sell/);
  });

  for (const status of ['removed', 'suspended'] as const) {
    it(`refused on a piece that is ${status}`, () => {
      expect(acceptClash(rental('a', '2026-11-01', '2026-11-03'), { status }, [], TODAY)).toMatch(
        /no longer listed/,
      );
    });
  }

  it('refused on a piece that is gone entirely', () => {
    expect(acceptClash(rental('a', '2026-11-01', '2026-11-03'), null, [], TODAY)).toMatch(
      /no longer listed/,
    );
  });

  it('refused on a piece that has been sold', () => {
    expect(
      acceptClash(rental('a', '2026-11-01', '2026-11-03'), { status: 'sold' }, [], TODAY),
    ).toMatch(/already been sold/);
  });

  it('allowed while the piece is paused — the request came first', () => {
    expect(
      acceptClash(rental('a', '2026-11-01', '2026-11-03'), { status: 'paused' }, [], TODAY),
    ).toBeNull();
  });
});

describe('accepting a purchase', () => {
  it('fine with nothing else holding the piece', () => {
    expect(acceptClash(purchase('a', 'requested'), active, [], TODAY)).toBeNull();
  });

  it('refused when she already said yes to another buyer', () => {
    expect(acceptClash(purchase('a', 'requested'), active, [purchase('b')], TODAY)).toMatch(
      /agreed to sell/,
    );
  });

  it('refused while a rental is still to come, with the date', () => {
    const later = rental('r', '2026-11-01', '2026-11-03');
    expect(acceptClash(purchase('a', 'requested'), active, [later], TODAY)).toMatch(
      /on Loane until Tue, Nov 3, so you can't sell it yet/,
    );
  });

  it('refused while a renter has it, even if it is late back', () => {
    const late = rental('r', '2026-10-20', '2026-10-22', 'with_renter');
    expect(acceptClash(purchase('a', 'requested'), active, [late], TODAY)).toMatch(
      /on Loane right now/,
    );
  });

  it('a rental that already ended does not stand in the way', () => {
    const done = rental('r', '2026-10-20', '2026-10-22', 'confirmed');
    expect(acceptClash(purchase('a', 'requested'), active, [done], TODAY)).toBeNull();
  });

  it('refused on a sold piece', () => {
    expect(acceptClash(purchase('a', 'requested'), { status: 'sold' }, [], TODAY)).toMatch(
      /already been sold/,
    );
  });
});
