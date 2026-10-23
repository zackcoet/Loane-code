#!/usr/bin/env node
/**
 * Fails when a screen draws text with React Native's own <Text> or
 * <TextInput> without the text-size cap.
 *
 * Why: Loane follows the iPhone's Text Size setting up to
 * controls.maxFontScale (1.5x). Our shared <Text> applies the cap for
 * you; React Native's own components do not, so a label written with
 * them grows without limit at the largest sizes and breaks its row.
 * Run 23 fixed every one by hand. This keeps new screens from
 * forgetting — it runs as part of `npm run lint`, so GitHub catches it.
 *
 * The rule: in any file under mobile/, a <Text> or <TextInput> that was
 * imported from 'react-native' (under any local name) must have a
 * maxFontSizeMultiplier prop, or spread props ({...rest}) that carry it,
 * or turn scaling off on purpose with allowFontScaling={false}.
 * The shared Text component is not checked — it IS the cap.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const CHECKED = ['Text', 'TextInput'];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(tsx|jsx)$/.test(name)) yield path;
  }
}

/** Local names this file gave to React Native's Text and TextInput. */
function nativeTextNames(source) {
  const names = new Set();
  for (const stmt of source.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (stmt.moduleSpecifier.text !== 'react-native') continue;
    const bindings = stmt.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const el of bindings.elements) {
      const imported = (el.propertyName ?? el.name).text;
      if (CHECKED.includes(imported)) names.add(el.name.text);
    }
  }
  return names;
}

const problems = [];
for (const path of files(join(root, 'mobile'))) {
  const text = readFileSync(path, 'utf8');
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = nativeTextNames(source);
  if (names.size === 0) continue;
  const visit = (node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      names.has(node.tagName.text)
    ) {
      const props = node.attributes.properties;
      // allowFontScaling={false} counts too: a logo or an avatar's
      // initial sits in a fixed shape and deliberately never grows.
      const capped = props.some(
        (p) =>
          ts.isJsxSpreadAttribute(p) ||
          (ts.isJsxAttribute(p) &&
            ['maxFontSizeMultiplier', 'allowFontScaling'].includes(p.name.getText(source))),
      );
      if (!capped) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        problems.push(`${relative(root, path)}:${line + 1}  <${node.tagName.text}>`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

if (problems.length > 0) {
  console.error(
    `Text without the size cap (${problems.length}). React Native's own <Text>/<TextInput> ` +
      `must set maxFontSizeMultiplier={controls.maxFontScale} — or use the shared <Text> ` +
      `from src/components/Text, which does it for you:\n` +
      problems.map((p) => `  ${p}`).join('\n'),
  );
  process.exit(1);
}
console.log('Text size cap: every native Text and TextInput is capped.');
