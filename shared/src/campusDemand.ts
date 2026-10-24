/**
 * "Which school should Loane open next?" — for the admin dashboard.
 *
 * Any .edu email can sign up today, and a student from a school we have
 * not launched gets her own small campus made on the fly (createAccount).
 * Each of those campuses already keeps a server-written student count, so
 * demand from other schools is simply every campus except the launch one,
 * biggest first. Nothing new is stored and nothing is counted on a phone.
 */

import type { Campus } from './types/campus';
import { LAUNCH_CAMPUS_ID } from './socialProof';

export interface CampusDemandRow {
  id: string;
  name: string;
  /** The email domains seen for it, e.g. "clemson.edu". */
  domains: string[];
  students: number;
}

export interface CampusDemand {
  /** Other schools with at least one student, most students first. */
  rows: CampusDemandRow[];
  /** Students across all of those schools. */
  totalStudents: number;
}

/** Counts can be missing on an old campus document; treat that as zero. */
function studentCount(campus: Campus): number {
  const n = campus.stats?.userCount;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function campusDemand(
  campuses: readonly Campus[],
  launchCampusId: string = LAUNCH_CAMPUS_ID,
): CampusDemand {
  const rows = campuses
    .filter((c) => c.id !== launchCampusId)
    .map((c) => ({
      id: c.id,
      name: c.name || c.id,
      domains: c.emailDomains ?? [],
      students: studentCount(c),
    }))
    // A campus whose only student deleted her account is not demand.
    .filter((r) => r.students > 0)
    // Ties by name, so the order does not shuffle between refreshes.
    .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name));
  return { rows, totalStudents: rows.reduce((sum, r) => sum + r.students, 0) };
}
