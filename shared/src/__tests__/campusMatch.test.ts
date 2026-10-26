import { describe, expect, it } from 'vitest';
import { findCampusForEmail, newCampusId, schoolDomain } from '../campusMatch';

const USC = { id: 'university-of-south-carolina', emailDomains: ['sc.edu', 'email.sc.edu'] };
const CLEMSON = { id: 'school-clemson-edu', emailDomains: ['clemson.edu'] };
const CAMPUSES = [USC, CLEMSON];

describe('which school an email belongs to', () => {
  it('matches a listed domain exactly', () => {
    expect(findCampusForEmail('ella@email.sc.edu', CAMPUSES)).toBe(USC);
    expect(findCampusForEmail('ella@SC.EDU', CAMPUSES)).toBe(USC);
    expect(findCampusForEmail('kate@clemson.edu', CAMPUSES)).toBe(CLEMSON);
  });

  it('puts a sub-address with its school', () => {
    expect(findCampusForEmail('ella@mailbox.sc.edu', CAMPUSES)).toBe(USC);
    expect(findCampusForEmail('kate@g.clemson.edu', CAMPUSES)).toBe(CLEMSON);
  });

  it('never matches a lookalike', () => {
    expect(findCampusForEmail('x@notsc.edu', CAMPUSES)).toBeNull();
    expect(findCampusForEmail('x@sc.edu.evil.com', CAMPUSES)).toBeNull();
    expect(findCampusForEmail('x@duke.edu', CAMPUSES)).toBeNull();
    expect(findCampusForEmail('no-at-sign', CAMPUSES)).toBeNull();
  });

  it('prefers an exact match over a sub-address one', () => {
    const OLD = { id: 'school-g-clemson-edu', emailDomains: ['g.clemson.edu'] };
    expect(findCampusForEmail('kate@g.clemson.edu', [CLEMSON, OLD])).toBe(OLD);
  });
});

describe("a new school's campus", () => {
  it('is named after the school, not the sub-address', () => {
    expect(schoolDomain('g.clemson.edu')).toBe('clemson.edu');
    expect(schoolDomain('Clemson.EDU')).toBe('clemson.edu');
    expect(newCampusId('g.clemson.edu')).toBe('school-clemson-edu');
    expect(newCampusId('clemson.edu')).toBe('school-clemson-edu');
    expect(newCampusId('my-school.edu')).toBe('school-my-school-edu');
  });
});
