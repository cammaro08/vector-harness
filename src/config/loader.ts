/**
 * Vector v2 Configuration Loader
 *
 * Loads and resolves vector configurations from project and task-level files.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  validateConfig,
  validateActiveConfig,
  VectorConfig,
  ActiveConfig,
  CheckDefinition,
  VectorName,
} from './schema';

/**
 * Loads the project configuration from .vector/config.yaml
 * Parses YAML and validates against VectorConfig schema.
 *
 * Throws if:
 * - File does not exist (ENOENT)
 * - File cannot be parsed as YAML
 * - Parsed data does not match VectorConfig schema
 */
export function loadProjectConfig(projectRoot: string): VectorConfig {
  const configPath = path.join(projectRoot, '.vector', 'config.yaml');

  let fileContent: string;
  try {
    fileContent = fs.readFileSync(configPath, 'utf-8');
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      throw new Error(
        `Project config not found at ${configPath}. Create .vector/config.yaml in your project root.`
      );
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(fileContent);
  } catch (error) {
    throw new Error(
      `Failed to parse YAML at ${configPath}: ${(error as Error).message}`
    );
  }

  return validateConfig(parsed);
}

/**
 * Loads the active (task-level) configuration from .vector/active.yaml
 * Returns null if the file does not exist (graceful fallback).
 *
 * Throws if:
 * - File exists but cannot be parsed as YAML
 * - Parsed data does not match ActiveConfig schema
 */
export function loadActiveConfig(projectRoot: string): ActiveConfig | null {
  const activePath = path.join(projectRoot, '.vector', 'active.yaml');

  let fileContent: string;
  try {
    fileContent = fs.readFileSync(activePath, 'utf-8');
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(fileContent);
  } catch (error) {
    throw new Error(
      `Failed to parse YAML at ${activePath}: ${(error as Error).message}`
    );
  }

  return validateActiveConfig(parsed);
}

/**
 * Resolves the checks to run for a given vector.
 *
 * If activeConfig specifies overrides for the vector, those are used.
 * Otherwise, the project config is used.
 *
 * Returns an array of CheckDefinition objects from the config.
 * Returns an empty array if:
 * - Vector is not in config
 * - Active config specifies an empty override
 */
export function resolveChecksForVector(
  config: VectorConfig,
  active: ActiveConfig | null,
  vector: VectorName
): CheckDefinition[] {
  // Determine which check names to use
  const checkNames: string[] =
    active && vector in active.vectors
      ? active.vectors[vector] || []
      : config.vectors[vector]?.checks || [];

  // Map check names to CheckDefinition objects
  const checks: CheckDefinition[] = checkNames
    .map((checkName) => config.checks[checkName])
    .filter((check): check is CheckDefinition => check !== undefined);

  // Return immutable copy
  return checks.map((check) => ({ ...check }));
}

/**
 * Resolve check names and definitions for a vector, respecting active overrides.
 * Returns array of { name, definition } pairs.
 */
export function resolveNamedChecksForVector(
  config: VectorConfig,
  active: ActiveConfig | null,
  vector: VectorName
): Array<{ name: string; definition: CheckDefinition }> {
  // Determine which check names to use
  const checkNames: string[] =
    active && vector in active.vectors
      ? active.vectors[vector] || []
      : config.vectors[vector]?.checks || [];

  // Warn if any check names are not found in the config
  const missingChecks = checkNames.filter((name) => config.checks[name] === undefined);
  if (missingChecks.length > 0) {
    console.warn(`[vector] Warning: Vector '${vector}' references missing checks: ${missingChecks.join(', ')}`);
  }

  return checkNames
    .filter((name) => config.checks[name] !== undefined)
    .map((name) => ({ name, definition: { ...config.checks[name] } }));
}
