import { describe, expect, it } from 'vitest';
import { bookingMatchesSearch, bookingsForUser } from '../adminRentals';
import type { BookingStatus } from '../constants';

const booking = (id: string, status: BookingStatus, lenderUid = 'ella', renterUid = 'kat') => ({
  id,
  status,
  listing: { name: 'Red Satin Mini' },
  lenderUid,
  lender: { username: 'ella_old', displayName: 'Ella P' },
  renterUid,
  renter: { username: 'kat', displayName: 'Kat M' },
});

const users = new Map([
  ['ella', { uid: 'ella', username: 'ella_new', displayName: 'Ella Petrick', status: 'active' }],
  [
    'kat',
    {
      uid: 'kat',
      username: 'deleted_kat',
      displayName: 'Deleted account',
      status: 'deactivated',
      deletedAt: 1,
    },
  ],
]);

describe('finding a rental on the dashboard', () => {
  it('matches the piece, and either girl by the name on the rental', () => {
    expect(bookingMatchesSearch(booking('a', 'completed'), users, 'satin')).toBe(true);
    expect(bookingMatchesSearch(booking('a', 'completed'), users, 'ella_old')).toBe(true);
    expect(bookingMatchesSearch(booking('a', 'completed'), users, 'Kat M')).toBe(true);
  });

  it('matches a girl by her name today after a rename, with or without the @', () => {
    expect(bookingMatchesSearch(booking('a', 'completed'), users, '@ella_new')).toBe(true);
    expect(bookingMatchesSearch(booking('a', 'completed'), users, 'Petrick')).toBe(true);
  });

  it('matches everything on an empty search and nothing on a stranger', () => {
    expect(bookingMatchesSearch(booking('a', 'completed'), users, '  ')).toBe(true);
    expect(bookingMatchesSearch(booking('a', 'completed'), users, 'zoe')).toBe(false);
  });

  it('never searches a deleted account by what its shell now says', () => {
    expect(bookingMatchesSearch(booking('a', 'completed'), users, 'deleted_kat')).toBe(false);
  });
});

describe('her rentals on her dashboard page', () => {
  const all = [
    booking('1', 'completed'),
    booking('2', 'disputed', 'zoe', 'ella'),
    booking('3', 'requested', 'zoe', 'kat'),
    booking('4', 'cancelled', 'kat', 'ella'),
  ];

  it('lists both sides, says which side she was on, open disputes first', () => {
    expect(bookingsForUser(all, 'ella').map((row) => [row.booking.id, row.side])).toEqual([
      ['2', 'renter'],
      ['1', 'lender'],
      ['4', 'renter'],
    ]);
  });

  it('is empty for a girl with no rentals', () => {
    expect(bookingsForUser(all, 'nobody')).toEqual([]);
  });
});
