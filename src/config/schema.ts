/**
 * Vector v2 Configuration Schema
 *
 * Defines the shape and validation logic for Vector config files.
 * Uses TypeScript types and runtime validators to ensure type safety.
 */

export interface CheckDefinition {
  run: string; // shell command to execute
  expect: 'exit-0'; // expected exit code
  capture?: 'stdout' | 'stderr' | 'both'; // optional output capture mode
  enabled: boolean; // whether this check is active
  timeout?: number; // optional timeout in milliseconds (overrides default)
}

export type VectorName = 'v1' | 'v2' | 'v3' | 'v4' | 'v5';

export interface VectorDefinition {
  trigger: string; // human-readable description
  checks: string[]; // array of check names to run
}

export interface VectorConfig {
  version: '2';
  checks: Record<string, CheckDefinition>;
  vectors: Partial<Record<VectorName, VectorDefinition>>;
  defaults: {
    maxRetries: number;
    timeout: number; // milliseconds
  };
}

export interface ActiveConfig {
  vectors: Partial<Record<VectorName, string[]>>;
}

/**
 * Validates that data conforms to the VectorConfig schema.
 * Throws a descriptive error if validation fails.
 */
export function validateConfig(data: unknown): VectorConfig {
  if (!isObject(data)) {
    throw new Error('Config must be a plain object');
  }

  // Check version
  if (data.version !== '2') {
    throw new Error(
      `Config version must be '2', got '${data.version || 'undefined'}'`
    );
  }

  // Check checks
  if (!isObject(data.checks)) {
    throw new Error('Config.checks must be an object');
  }

  for (const [name, check] of Object.entries(data.checks)) {
    validateCheckDefinition(name, check);
  }

  // Check vectors
  if (!isObject(data.vectors)) {
    throw new Error('Config.vectors must be an object');
  }

  for (const [name, vector] of Object.entries(data.vectors)) {
    validateVectorDefinition(name, vector);
  }

  // Check defaults
  if (!isObject(data.defaults)) {
    throw new Error('Config.defaults must be an object');
  }

  if (typeof data.defaults.maxRetries !== 'number') {
    throw new Error('Config.defaults.maxRetries must be a number');
  }

  if (typeof data.defaults.timeout !== 'number') {
    throw new Error('Config.defaults.timeout must be a number');
  }

  // Return as VectorConfig after all validations pass
  // All fields have been validated above; this single cast is safe
  return data as VectorConfig;
}

/**
 * Validates that data conforms to the ActiveConfig schema.
 * Throws a descriptive error if validation fails.
 */
export function validateActiveConfig(data: unknown): ActiveConfig {
  if (!isObject(data)) {
    throw new Error('Active config must be a plain object');
  }

  if (!isObject(data.vectors)) {
    throw new Error('Active config.vectors must be an object');
  }

  // Validate each vector override
  for (const [vectorName, checkNames] of Object.entries(data.vectors)) {
    if (!Array.isArray(checkNames)) {
      throw new Error(
        `Active config.vectors.${vectorName} must be an array of check names`
      );
    }

    for (const checkName of checkNames) {
      if (typeof checkName !== 'string') {
        throw new Error(
          `Active config.vectors.${vectorName} contains non-string check name: ${checkName}`
        );
      }
    }
  }

  // Return as ActiveConfig after all validations pass
  // All fields have been validated above; this single cast is safe
  return data as ActiveConfig;
}

// ============================================================================
// Private helpers
// ============================================================================

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateCheckDefinition(name: string, check: unknown): void {
  if (!isObject(check)) {
    throw new Error(`Check '${name}' must be an object`);
  }

  if (typeof check.run !== 'string') {
    throw new Error(`Check '${name}'.run must be a string`);
  }

  if (check.expect !== 'exit-0') {
    throw new Error(
      `Check '${name}'.expect must be 'exit-0', got '${check.expect || 'undefined'}'`
    );
  }

  if (typeof check.enabled !== 'boolean') {
    throw new Error(`Check '${name}'.enabled must be a boolean`);
  }

  // Optional: capture
  if (check.capture !== undefined) {
    if (!['stdout', 'stderr', 'both'].includes(check.capture as string)) {
      throw new Error(
        `Check '${name}'.capture must be 'stdout', 'stderr', or 'both', got '${check.capture}'`
      );
    }
  }

  // Optional: timeout
  if (check.timeout !== undefined && typeof check.timeout !== 'number') {
    throw new Error(`Check '${name}'.timeout must be a number`);
  }
}

function validateVectorDefinition(name: string, vector: unknown): void {
  if (!isObject(vector)) {
    throw new Error(`Vector '${name}' must be an object`);
  }

  if (typeof vector.trigger !== 'string') {
    throw new Error(`Vector '${name}'.trigger must be a string`);
  }

  if (!Array.isArray(vector.checks)) {
    throw new Error(`Vector '${name}'.checks must be an array`);
  }

  for (const checkName of vector.checks) {
    if (typeof checkName !== 'string') {
      throw new Error(`Vector '${name}' contains non-string check name`);
    }
  }
}
