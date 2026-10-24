import { describe, expect, it } from 'vitest';
import { campusDemand } from '../campusDemand';
import type { Campus } from '../types/campus';

function campus(id: string, userCount: number | undefined, name = id): Campus {
  return {
    id,
    name,
    shortName: name,
    emailDomains: [`${id}.edu`],
    city: '',
    state: '',
    brandColor: '',
    isLive: true,
    stats: { userCount, verifiedUserCount: 0, listingCount: 0, postCount: 0, bookingCount: 0 },
  } as unknown as Campus;
}

describe('campusDemand', () => {
  it('leaves out the launch campus', () => {
    const d = campusDemand([campus('university-of-south-carolina', 500), campus('clemson', 3)]);
    expect(d.rows.map((r) => r.id)).toEqual(['clemson']);
    expect(d.totalStudents).toBe(3);
  });

  it('puts the school with the most students first, ties by name', () => {
    const d = campusDemand([campus('b', 2, 'Bravo'), campus('c', 9), campus('a', 2, 'Alpha')]);
    expect(d.rows.map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('drops schools with no students left, and treats a missing count as zero', () => {
    const d = campusDemand([campus('gone', 0), campus('old', undefined), campus('ok', 1)]);
    expect(d.rows.map((r) => r.id)).toEqual(['ok']);
    expect(d.totalStudents).toBe(1);
  });

  it('is empty when only the launch campus exists', () => {
    expect(campusDemand([campus('university-of-south-carolina', 10)])).toEqual({
      rows: [],
      totalStudents: 0,
    });
  });
});
