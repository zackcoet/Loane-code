/**
 * Metro config for a monorepo.
 *
 * Without this, Metro only looks for packages inside `mobile/node_modules`
 * and cannot find `@loane/shared` or anything npm hoisted to the repo root.
 * These two settings tell it to watch the whole repo and to look in both
 * node_modules folders.
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
/*
  disableHierarchicalLookup USED to be set here, to stop Metro finding
  two copies of the same package. Expo 58 expects it left alone — its
  own monorepo resolution relies on the hierarchical lookup, and
  expo-doctor fails the project with it on.

  The duplicate it was guarding against is handled properly instead, by
  the `overrides` block in the root package.json, which pins one React
  for the whole repo.
*/

module.exports = config;
