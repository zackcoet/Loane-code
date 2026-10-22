/**
 * Does every Firestore query in the code have the index it needs?
 *
 * WHY THIS EXISTS. The emulator answers any query, index or not.
 * Production refuses a query whose composite index is missing — and it
 * refuses it at runtime, on the real project, where nobody is looking.
 * That is exactly how the hourly booking sweep crashed for weeks while
 * every test passed on a laptop. This reads the source instead of
 * running it, so it catches the gap before a deploy.
 *
 * HOW. It walks the TypeScript of the app, the admin dashboard and the
 * Cloud Functions, and finds both shapes of query we write:
 *
 *   query(collection(db, COLLECTIONS.posts), where(...), orderBy(...))  // app, admin
 *   db.collection(COLLECTIONS.posts).where(...).orderBy(...)           // functions
 *
 * For each it works out the filters and the sort, decides whether
 * Firestore needs a composite index, and looks for a matching one in
 * backend/firestore.indexes.json.
 *
 * WHAT IT CANNOT SEE. A query whose collection or field name is only
 * known at runtime (a variable), or whose filters are built up in an
 * array and spread in. Those are reported as "not checked", never as
 * passing, so a human knows to look.
 *
 * THE RULES IT APPLIES (Firestore's, simplified to what we use):
 * - Equality filters (==, in, array-contains) on any number of fields
 *   need no composite index: Firestore merges single-field indexes.
 * - A sort, or a range filter (<, <=, >, >=, !=, not-in), combined with
 *   a filter or sort on ANY other field needs a composite index: the
 *   equality fields first, then the range field, then the sorts.
 * - A collection-group query on a single field needs that field's
 *   collection-group index switched on in "fieldOverrides".
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

// --- Types -----------------------------------------------------------------

export type Direction = 'ASCENDING' | 'DESCENDING';

export interface FoundQuery {
  file: string;
  line: number;
  collection: string;
  scope: 'COLLECTION' | 'COLLECTION_GROUP';
  equality: string[];
  arrayContains: string[];
  range: string[];
  orderBy: { field: string; direction: Direction }[];
}

export interface Unchecked {
  file: string;
  line: number;
  reason: string;
}

export interface IndexField {
  fieldPath: string;
  order?: Direction;
  arrayConfig?: 'CONTAINS';
}

export interface CompositeIndex {
  collectionGroup: string;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  fields: IndexField[];
}

export interface FieldOverride {
  collectionGroup: string;
  fieldPath: string;
  indexes: { order?: Direction; arrayConfig?: 'CONTAINS'; queryScope: string }[];
}

export interface IndexFile {
  indexes: CompositeIndex[];
  fieldOverrides?: FieldOverride[];
}

export interface Problem {
  query: FoundQuery;
  needed: IndexField[];
  message: string;
}

const EQUALITY_OPS = new Set(['==', 'in']);
const ARRAY_OPS = new Set(['array-contains', 'array-contains-any']);
const RANGE_OPS = new Set(['<', '<=', '>', '>=', '!=', 'not-in']);

// --- Reading the source ----------------------------------------------------

/** COLLECTIONS.x / SUBCOLLECTIONS.x → the string, read from shared. */
export function loadCollectionNames(sharedCollectionsFile: string): Map<string, string> {
  const text = fs.readFileSync(sharedCollectionsFile, 'utf8');
  const src = ts.createSourceFile('c.ts', text, ts.ScriptTarget.Latest, true);
  const names = new Map<string, string>();
  src.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      let init: ts.Expression = decl.initializer;
      if (ts.isAsExpression(init)) init = init.expression;
      if (!ts.isObjectLiteralExpression(init)) continue;
      for (const prop of init.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isStringLiteral(prop.initializer)) continue;
        const key = prop.name.getText(src);
        names.set(`${decl.name.text}.${key}`, prop.initializer.text);
      }
    }
  });
  return names;
}

/**
 * What a query's names can be resolved against: the shared COLLECTIONS
 * map, and the file's own `const`s (a name declared twice is ambiguous
 * and resolves to nothing).
 */
interface Ctx {
  names: Map<string, string>;
  locals: Map<string, ts.Expression | null>;
}

function collectLocals(src: ts.SourceFile): Map<string, ts.Expression | null> {
  const locals = new Map<string, ts.Expression | null>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isVariableDeclarationList(node.parent) &&
      node.parent.flags & ts.NodeFlags.Const
    ) {
      const name = node.name.text;
      locals.set(name, locals.has(name) ? null : node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return locals;
}

function stringValue(expr: ts.Expression, ctx: Ctx): string | null {
  // where(documentId(), 'in', ids) / FieldPath.documentId() — the document id.
  if (ts.isCallExpression(expr) && calleeName(expr) === 'documentId') return '__name__';
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) {
    return ctx.names.get(expr.getText().replace(/\s+/g, '')) ?? null;
  }
  // A local `const field = 'ownerUid'` (or a ?: of names) — follow it.
  if (ts.isIdentifier(expr)) {
    const init = ctx.locals.get(expr.text);
    if (init && (ts.isStringLiteral(init) || ts.isPropertyAccessExpression(init))) {
      return stringValue(init, ctx);
    }
  }
  return null;
}

/**
 * Every value a field-name expression can take. `side === 'renting' ?
 * 'renterUid' : 'lenderUid'` is two queries, and both are checked.
 */
function stringOptions(expr: ts.Expression, ctx: Ctx): string[] | null {
  if (ts.isParenthesizedExpression(expr)) return stringOptions(expr.expression, ctx);
  if (ts.isConditionalExpression(expr)) {
    const a = stringOptions(expr.whenTrue, ctx);
    const b = stringOptions(expr.whenFalse, ctx);
    return a && b ? [...a, ...b] : null;
  }
  if (ts.isIdentifier(expr)) {
    const init = ctx.locals.get(expr.text);
    if (init && ts.isConditionalExpression(init)) return stringOptions(init, ctx);
  }
  const one = stringValue(expr, ctx);
  return one === null ? null : [one];
}

function calleeName(call: ts.CallExpression): string | null {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

interface Constraint {
  kind: 'where' | 'orderBy';
  /** Each name the field could be; null when unknowable. */
  field: string[] | null;
  op?: string | null;
  direction?: Direction;
}

function readConstraint(call: ts.CallExpression, ctx: Ctx): Constraint | 'skip' | 'unknown' {
  const name = calleeName(call);
  const args = call.arguments;
  if (name === 'where') {
    // where(field, op, value) — a single Filter object is not something we write.
    const [fieldArg, opArg] = args;
    if (args.length < 3 || !fieldArg || !opArg) return 'unknown';
    return {
      kind: 'where',
      field: stringOptions(fieldArg, ctx),
      op: stringValue(opArg, ctx),
    };
  }
  if (name === 'orderBy') {
    const dir = args[1] ? stringValue(args[1], ctx) : 'asc';
    return {
      kind: 'orderBy',
      field: args[0] ? stringOptions(args[0], ctx) : null,
      direction: dir === 'desc' ? 'DESCENDING' : 'ASCENDING',
    };
  }
  if (
    name === 'limit' ||
    name === 'limitToLast' ||
    name === 'startAfter' ||
    name === 'startAt' ||
    name === 'endBefore' ||
    name === 'endAt' ||
    name === 'offset' ||
    name === 'select'
  ) {
    return 'skip';
  }
  return 'unknown';
}

/** The collection a `collection(...)`/`collectionGroup(...)` call names. */
function readBase(
  call: ts.CallExpression,
  ctx: Ctx,
  chained: boolean,
): { collection: string | null; scope: FoundQuery['scope'] } | null {
  const name = calleeName(call);
  if (name !== 'collection' && name !== 'collectionGroup') return null;
  const scope = name === 'collectionGroup' ? 'COLLECTION_GROUP' : 'COLLECTION';
  // Modular: collection(db, 'a', id, 'b') — the first argument is the db.
  // Chained: db.collection('a') or doc.collection('b').
  const segments = chained ? call.arguments : call.arguments.slice(1);
  const last = segments[segments.length - 1];
  if (!last) return { collection: null, scope };
  return { collection: stringValue(last, ctx), scope };
}

function lineOf(node: ts.Node, src: ts.SourceFile): number {
  return src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1;
}

/** One query per combination of possible field names. */
function buildAll(
  base: { collection: string | null; scope: FoundQuery['scope'] },
  constraints: Constraint[],
  file: string,
  line: number,
): (FoundQuery | Unchecked)[] {
  if (constraints.some((c) => !c.field)) {
    return [{ file, line, reason: 'a field name is only known at runtime' }];
  }
  let variants: {
    kind: Constraint['kind'];
    field: string;
    op?: string | null;
    direction?: Direction;
  }[][] = [[]];
  for (const c of constraints) {
    variants = variants.flatMap((v) => (c.field ?? []).map((f) => [...v, { ...c, field: f }]));
  }
  return variants.map((v) => build(base, v, file, line));
}

function build(
  base: { collection: string | null; scope: FoundQuery['scope'] },
  constraints: {
    kind: Constraint['kind'];
    field: string;
    op?: string | null;
    direction?: Direction;
  }[],
  file: string,
  line: number,
): FoundQuery | Unchecked {
  if (!base.collection) return { file, line, reason: 'collection name is only known at runtime' };
  const q: FoundQuery = {
    file,
    line,
    collection: base.collection,
    scope: base.scope,
    equality: [],
    arrayContains: [],
    range: [],
    orderBy: [],
  };
  for (const c of constraints) {
    if (c.kind === 'orderBy') {
      q.orderBy.push({ field: c.field, direction: c.direction ?? 'ASCENDING' });
      continue;
    }
    if (!c.op) return { file, line, reason: 'a filter operator is only known at runtime' };
    if (EQUALITY_OPS.has(c.op)) q.equality.push(c.field);
    else if (ARRAY_OPS.has(c.op)) q.arrayContains.push(c.field);
    else if (RANGE_OPS.has(c.op)) q.range.push(c.field);
    else return { file, line, reason: `unrecognised operator "${c.op}"` };
  }
  return q;
}

const SPREAD = Symbol('spread');

/** The alternatives a spread can be: `[a, b]` or `cond ? [a] : [b]`. */
function spreadOptions(expr: ts.Expression): ts.CallExpression[][] | null {
  if (ts.isParenthesizedExpression(expr)) return spreadOptions(expr.expression);
  if (ts.isConditionalExpression(expr)) {
    const a = spreadOptions(expr.whenTrue);
    const b = spreadOptions(expr.whenFalse);
    return a && b ? [...a, ...b] : null;
  }
  if (ts.isArrayLiteralExpression(expr)) {
    if (!expr.elements.every(ts.isCallExpression)) return null;
    return [expr.elements as unknown as ts.CallExpression[]];
  }
  return null;
}

/** Each full list of constraints once every spread has picked a side. */
function expandSpreads(
  constraints: (Constraint | typeof SPREAD)[],
  spreads: ts.CallExpression[][][],
  ctx: Ctx,
): Constraint[][] | null {
  let out: Constraint[][] = [[]];
  let s = 0;
  for (const c of constraints) {
    if (c !== SPREAD) {
      out = out.map((v) => [...v, c]);
      continue;
    }
    const sides: Constraint[][] = [];
    for (const side of spreads[s++] ?? []) {
      const read: Constraint[] = [];
      for (const call of side) {
        const r = readConstraint(call, ctx);
        if (r === 'unknown') return null;
        if (r !== 'skip') read.push(r);
      }
      sides.push(read);
    }
    out = out.flatMap((v) => sides.map((side) => [...v, ...side]));
  }
  return out;
}

/** Every query in one file. */
export function findQueries(
  file: string,
  text: string,
  names: Map<string, string>,
): { queries: FoundQuery[]; unchecked: Unchecked[] } {
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const ctx: Ctx = { names, locals: collectLocals(src) };
  const queries: FoundQuery[] = [];
  const unchecked: Unchecked[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node);

      // --- Modular: query(base, ...constraints) ---
      if (name === 'query' && ts.isIdentifier(node.expression) && node.arguments.length > 0) {
        const [first, ...rest] = node.arguments;
        // `const ref = collection(db, X); query(ref, ...)` — follow the const.
        const resolved =
          first && ts.isIdentifier(first) ? (ctx.locals.get(first.text) ?? undefined) : first;
        const base =
          resolved && ts.isCallExpression(resolved) ? readBase(resolved, ctx, false) : null;
        if (!base && rest.length > 0) {
          unchecked.push({
            file,
            line: lineOf(node, src),
            reason: 'the query starts from a variable',
          });
        }
        if (base) {
          const constraints: (Constraint | typeof SPREAD)[] = [];
          const spreads: ts.CallExpression[][][] = [];
          let bad: string | null = null;
          for (const arg of rest) {
            if (ts.isSpreadElement(arg)) {
              // ...(cond ? [where(a)] : [where(b)]) — check each side.
              const sides = spreadOptions(arg.expression);
              if (!sides) {
                bad = 'filters are spread in from an array';
                break;
              }
              spreads.push(sides);
              constraints.push(SPREAD);
              continue;
            }
            if (!ts.isCallExpression(arg)) {
              bad = 'a filter is held in a variable';
              break;
            }
            const c = readConstraint(arg, ctx);
            if (c === 'skip') continue;
            if (c === 'unknown') {
              bad = `unrecognised query part "${calleeName(arg) ?? arg.getText(src)}"`;
              break;
            }
            constraints.push(c);
          }
          const line = lineOf(node, src);
          const expanded = bad ? [] : expandSpreads(constraints, spreads, ctx);
          if (!bad && expanded === null) bad = 'a spread-in filter is not a where/orderBy';
          if (bad) unchecked.push({ file, line, reason: bad });
          else {
            for (const cs of expanded ?? []) {
              for (const r of buildAll(base, cs, file, line)) {
                if ('reason' in r) unchecked.push(r);
                else queries.push(r);
              }
            }
          }
        }
      }

      // --- Chained: x.collection(...).where(...).orderBy(...) ---
      // Start only from the OUTERMOST where/orderBy call of a chain, so
      // one chain is one query.
      if (
        (name === 'where' || name === 'orderBy') &&
        ts.isPropertyAccessExpression(node.expression) &&
        !isInnerLinkOfChain(node)
      ) {
        const constraints: Constraint[] = [];
        let cur: ts.Expression = node;
        let base: ReturnType<typeof readBase> = null;
        let bad: string | null = null;
        while (ts.isCallExpression(cur) && ts.isPropertyAccessExpression(cur.expression)) {
          const b = readBase(cur, ctx, true);
          if (b) {
            base = b;
            break;
          }
          const c = readConstraint(cur, ctx);
          if (c === 'unknown') {
            bad = `unrecognised query part "${calleeName(cur)}"`;
            break;
          }
          if (c !== 'skip') constraints.unshift(c);
          cur = cur.expression.expression;
          // `const follows = db().collection(X); follows.where(...)`
          if (ts.isIdentifier(cur)) {
            const init = ctx.locals.get(cur.text);
            if (init && ts.isCallExpression(init)) cur = init;
          }
        }
        const line = lineOf(node, src);
        if (bad) unchecked.push({ file, line, reason: bad });
        else if (base) {
          for (const r of buildAll(base, constraints, file, line)) {
            if ('reason' in r) unchecked.push(r);
            else queries.push(r);
          }
        } else if (constraints.length > 0) {
          unchecked.push({ file, line, reason: 'the query starts from a variable' });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return { queries, unchecked };
}

/**
 * True when a later `.where`/`.orderBy` in the same chain will pick this
 * call up. (A trailing `.limit()` or `.get()` does not count — those are
 * not filters, so the last filter is still where the walk starts.)
 */
function isInnerLinkOfChain(call: ts.CallExpression): boolean {
  const parent = call.parent;
  if (!parent || !ts.isPropertyAccessExpression(parent) || parent.expression !== call) return false;
  const next = parent.parent;
  if (!next || !ts.isCallExpression(next)) return false;
  const name = calleeName(next);
  return name === 'where' || name === 'orderBy';
}

// --- Deciding what each query needs ---------------------------------------

/**
 * The composite index a query needs, or null when single-field indexes
 * are enough.
 */
export function neededIndex(q: FoundQuery): IndexField[] | null {
  // The document id is always indexed; `where(documentId(), 'in', ids)`
  // adds nothing to what an index must hold.
  const eq = unique(q.equality.filter((f) => f !== '__name__'));
  const arr = unique([...q.arrayContains]);
  // A sort on a field already pinned by == changes nothing; Firestore
  // drops it, and so do we.
  const sorts = q.orderBy.filter((o) => !eq.includes(o.field));
  // A range filter sorts by its own field first, ascending, unless the
  // code already sorts by it.
  for (const r of unique(q.range)) {
    if (!sorts.some((s) => s.field === r)) sorts.unshift({ field: r, direction: 'ASCENDING' });
  }
  const fields = unique([...eq, ...arr, ...sorts.map((s) => s.field)]);
  if (sorts.length === 0) return null; // equality only — merged
  if (fields.length < 2) return null; // one field — its own index
  return [
    ...eq.map((f) => ({ fieldPath: f, order: 'ASCENDING' as const })),
    ...arr.map((f) => ({ fieldPath: f, arrayConfig: 'CONTAINS' as const })),
    ...sorts.map((s) => ({ fieldPath: s.field, order: s.direction })),
  ];
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/**
 * Does `index` serve a query needing `needed`? The equality fields may
 * come in any order (direction is irrelevant for ==); array-contains
 * fields must be CONTAINS; the sort fields must follow in order with
 * the same directions. (Deliberately strict: a reversed index might
 * serve, but "missing" that a human double-checks beats a crash.)
 */
export function indexServes(index: CompositeIndex, needed: IndexField[], q: FoundQuery): boolean {
  if (index.collectionGroup !== q.collection || index.queryScope !== q.scope) return false;
  const fields = index.fields.filter((f) => f.fieldPath !== '__name__');
  if (fields.length !== needed.length) return false;

  const unordered = needed.filter((n) => q.equality.includes(n.fieldPath) || n.arrayConfig);
  const head = fields.slice(0, unordered.length);
  for (const n of unordered) {
    const match = head.find((f) => f.fieldPath === n.fieldPath);
    if (!match) return false;
    if (n.arrayConfig && match.arrayConfig !== 'CONTAINS') return false;
    if (!n.arrayConfig && match.arrayConfig) return false;
  }
  const ordered = needed.slice(unordered.length);
  const tail = fields.slice(unordered.length);
  return ordered.every((n, i) => tail[i]?.fieldPath === n.fieldPath && tail[i]?.order === n.order);
}

export function checkQuery(q: FoundQuery, file: IndexFile): Problem | null {
  const needed = neededIndex(q);
  if (needed) {
    if (file.indexes.some((i) => indexServes(i, needed, q))) return null;
    return {
      query: q,
      needed,
      message: `needs a composite index on ${q.collection} (${describe(needed)})`,
    };
  }
  // Single-field collection-group queries need their override switched on.
  if (q.scope === 'COLLECTION_GROUP') {
    const field = [
      ...q.equality,
      ...q.arrayContains,
      ...q.range,
      ...q.orderBy.map((o) => o.field),
    ][0];
    if (!field) return null; // a bare collectionGroup read needs nothing
    const ok = (file.fieldOverrides ?? []).some(
      (o) =>
        o.collectionGroup === q.collection &&
        o.fieldPath === field &&
        o.indexes.some((i) => i.queryScope === 'COLLECTION_GROUP'),
    );
    if (ok) return null;
    return {
      query: q,
      needed: [{ fieldPath: field, order: 'ASCENDING' }],
      message: `needs a collection-group index on ${q.collection}.${field} in fieldOverrides`,
    };
  }
  return null;
}

function describe(fields: IndexField[]): string {
  return fields
    .map(
      (f) =>
        `${f.fieldPath} ${f.arrayConfig ? 'CONTAINS' : f.order === 'DESCENDING' ? 'desc' : 'asc'}`,
    )
    .join(', ');
}

// --- Walking the repo ------------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', 'lib', 'dist', 'build', '.expo', '__tests__']);

export function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|d)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

export interface RepoReport {
  checked: number;
  problems: Problem[];
  /** Queries the script cannot read and nobody has vouched for. */
  unchecked: Unchecked[];
  /** Queries the script cannot read, with an `index-check:` note above. */
  reviewed: Unchecked[];
}

/**
 * A query the script cannot read is vouched for by a comment containing
 * `index-check:` on one of the four lines above it, saying why it needs
 * no index (e.g. "a single == filter, whatever the field"). That makes
 * every unreadable query a decision someone wrote down.
 */
export const REVIEWED_MARK = 'index-check:';

function hasReviewNote(lines: string[], line: number): boolean {
  for (let i = Math.max(0, line - 5); i < line - 1; i++) {
    if (lines[i]?.includes(REVIEWED_MARK)) return true;
  }
  return false;
}

/** Check the whole repo. `root` is the repository root. */
export function checkRepo(root: string): RepoReport {
  const names = loadCollectionNames(path.join(root, 'shared/src/collections.ts'));
  const indexFile = JSON.parse(
    fs.readFileSync(path.join(root, 'backend/firestore.indexes.json'), 'utf8'),
  ) as IndexFile;
  const dirs = ['mobile/app', 'mobile/src', 'admin/src', 'backend/functions/src'];
  const report: RepoReport = { checked: 0, problems: [], unchecked: [], reviewed: [] };
  for (const dir of dirs) {
    for (const file of sourceFiles(path.join(root, dir))) {
      const rel = path.relative(root, file);
      const text = fs.readFileSync(file, 'utf8');
      const lines = text.split('\n');
      const { queries, unchecked } = findQueries(rel, text, names);
      report.checked += queries.length;
      for (const u of unchecked) {
        (hasReviewNote(lines, u.line) ? report.reviewed : report.unchecked).push(u);
      }
      for (const q of queries) {
        const p = checkQuery(q, indexFile);
        if (p) report.problems.push(p);
      }
    }
  }
  return report;
}
