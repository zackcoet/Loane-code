/**
 * The index checker (scripts/indexCheck.ts). No emulator needed — it
 * reads source code, not a database.
 *
 * The last test is the one that matters day to day: it runs the checker
 * over the whole repo, so `npm test` fails the moment someone writes a
 * query production would refuse.
 */

import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkQuery,
  checkRepo,
  findQueries,
  neededIndex,
  type IndexFile,
} from '../../scripts/indexCheck';

const names = new Map([
  ['COLLECTIONS.posts', 'posts'],
  ['COLLECTIONS.bookings', 'bookings'],
  ['COLLECTIONS.conversations', 'conversations'],
]);

const one = (code: string) => {
  const { queries, unchecked } = findQueries('x.ts', code, names);
  return { queries, unchecked };
};

const postsIndex: IndexFile = {
  indexes: [
    {
      collectionGroup: 'posts',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'campusId', order: 'ASCENDING' },
        { fieldPath: 'status', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' },
      ],
    },
  ],
};

describe('reading queries out of code', () => {
  it('reads an app-style query', () => {
    const { queries } = one(`
      query(collection(db, COLLECTIONS.posts), where('campusId', '==', c),
        where('status', '==', 'active'), orderBy('createdAt', 'desc'), limit(20));
    `);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatchObject({
      collection: 'posts',
      equality: ['campusId', 'status'],
      orderBy: [{ field: 'createdAt', direction: 'DESCENDING' }],
    });
  });

  it('reads a functions-style chain, ignoring a trailing limit and get', () => {
    const { queries } = one(`
      await db().collection(COLLECTIONS.bookings)
        .where('status', '==', 'requested').where('expiresAt', '<=', now).limit(400).get();
    `);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatchObject({
      collection: 'bookings',
      equality: ['status'],
      range: ['expiresAt'],
    });
  });

  it('takes a subcollection’s own name', () => {
    const { queries } = one(`
      query(collection(db, COLLECTIONS.conversations, id, 'messages'), orderBy('createdAt', 'desc'));
    `);
    expect(queries[0]?.collection).toBe('messages');
  });

  it('checks both sides of a ?: field name', () => {
    const { queries } = one(`
      query(collection(db, COLLECTIONS.bookings),
        where(side === 'renting' ? 'renterUid' : 'lenderUid', '==', uid), orderBy('createdAt', 'desc'));
    `);
    expect(queries.map((q) => q.equality[0])).toEqual(['renterUid', 'lenderUid']);
  });

  it('follows a local const, and both sides of a spread-in ?:', () => {
    const { queries, unchecked } = one(`
      const field = 'ownerUid';
      query(collection(db, COLLECTIONS.posts), where(field, '==', uid),
        ...(all ? [where('status', 'in', ['a', 'b'])] : [where('status', '==', 'a')]),
        orderBy('createdAt', 'desc'));
    `);
    expect(unchecked).toEqual([]);
    expect(queries).toHaveLength(2);
    expect(queries[0]?.equality).toEqual(['ownerUid', 'status']);
  });

  it('never passes a query it cannot read — it says so', () => {
    const { queries, unchecked } = one(`
      query(collection(db, COLLECTIONS.posts), where(someParam, '==', x), orderBy('createdAt'));
    `);
    expect(queries).toEqual([]);
    expect(unchecked).toHaveLength(1);
  });
});

describe('deciding what needs an index', () => {
  const q = (code: string) => one(code).queries[0]!;

  it('equality on several fields needs none (Firestore merges them)', () => {
    expect(
      neededIndex(
        q(`query(collection(db, COLLECTIONS.posts), where('a', '==', 1), where('b', '==', 2))`),
      ),
    ).toBeNull();
  });

  it('a sort on its own needs none', () => {
    expect(
      neededIndex(q(`query(collection(db, COLLECTIONS.posts), orderBy('createdAt', 'desc'))`)),
    ).toBeNull();
  });

  it('a filter plus a sort on another field does', () => {
    expect(
      neededIndex(
        q(`query(collection(db, COLLECTIONS.posts), where('a', '==', 1), orderBy('createdAt'))`),
      ),
    ).toEqual([
      { fieldPath: 'a', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'ASCENDING' },
    ]);
  });

  it('the sweep’s shape — == plus a range — does (this is the one that crashed)', () => {
    const sweep = q(`db().collection(COLLECTIONS.bookings)
      .where('status', '==', 'requested').where('expiresAt', '<=', now).get()`);
    const problem = checkQuery(sweep, { indexes: [] });
    expect(problem?.message).toMatch(/bookings \(status asc, expiresAt asc\)/);
  });

  it('a matching index passes; equality fields may come in any order', () => {
    const feed = q(`query(collection(db, COLLECTIONS.posts), where('status', '==', 'active'),
      where('campusId', '==', c), orderBy('createdAt', 'desc'))`);
    expect(checkQuery(feed, postsIndex)).toBeNull();
  });

  it('the wrong sort direction is missing', () => {
    const feed = q(`query(collection(db, COLLECTIONS.posts), where('status', '==', 'active'),
      where('campusId', '==', c), orderBy('createdAt', 'asc'))`);
    expect(checkQuery(feed, postsIndex)).not.toBeNull();
  });

  it('a collection-group filter needs its field override', () => {
    const purge = q(`db().collectionGroup('notifications').where('readAt', '<=', cutoff).get()`);
    expect(checkQuery(purge, { indexes: [] })).not.toBeNull();
    expect(
      checkQuery(purge, {
        indexes: [],
        fieldOverrides: [
          {
            collectionGroup: 'notifications',
            fieldPath: 'readAt',
            indexes: [{ order: 'ASCENDING', queryScope: 'COLLECTION_GROUP' }],
          },
        ],
      }),
    ).toBeNull();
  });
});

describe('the whole repo', () => {
  it('every query has the index production needs', () => {
    const report = checkRepo(path.resolve(__dirname, '../../../..'));
    // Sanity: it really is reading the code, not finding nothing.
    expect(report.checked).toBeGreaterThan(40);
    expect(report.problems.map((p) => `${p.query.file}:${p.query.line} ${p.message}`)).toEqual([]);
    expect(report.unchecked.map((u) => `${u.file}:${u.line} ${u.reason}`)).toEqual([]);
  });
});
