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
// Don't let Metro resolve two copies of the same package.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
