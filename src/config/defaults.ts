/**
 * Vector v2 Configuration Defaults
 *
 * Provides a starter configuration and utilities for generating
 * default YAML files for new Vector projects.
 */

import * as yaml from 'js-yaml';
import { VectorConfig } from './schema';

// Default check names
const DEFAULT_CHECK_TEST = 'test-pass';
const DEFAULT_CHECK_TS = 'no-ts-errors';

// Default check commands
const DEFAULT_CMD_TEST = 'npm test';
const DEFAULT_CMD_TS = 'npx tsc --noEmit';

// Default vector settings
const DEFAULT_VECTOR_V1 = 'v1';
const DEFAULT_VECTOR_TRIGGER = 'Full test suite and type check';

// Default enforcement settings
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Default configuration for Vector projects.
 * Includes two basic checks: npm test and TypeScript compilation check.
 */
export const DEFAULT_CONFIG: VectorConfig = {
  version: '2',
  checks: {
    [DEFAULT_CHECK_TEST]: {
      run: DEFAULT_CMD_TEST,
      expect: 'exit-0',
      enabled: true,
    },
    [DEFAULT_CHECK_TS]: {
      run: DEFAULT_CMD_TS,
      expect: 'exit-0',
      enabled: true,
    },
  },
  vectors: {
    [DEFAULT_VECTOR_V1]: {
      trigger: DEFAULT_VECTOR_TRIGGER,
      checks: [DEFAULT_CHECK_TEST, DEFAULT_CHECK_TS],
    },
  },
  defaults: {
    maxRetries: DEFAULT_MAX_RETRIES,
    timeout: DEFAULT_TIMEOUT_MS,
  },
};

/**
 * Generates a YAML string representation of the default config.
 * Suitable for writing to .vector/config.yaml in new projects.
 */
export function generateDefaultConfigYaml(): string {
  return yaml.dump(DEFAULT_CONFIG, {
    indent: 2,
    lineWidth: -1, // disable line wrapping
  });
}
