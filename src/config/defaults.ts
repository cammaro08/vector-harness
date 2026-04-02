/**
 * Vector v2 Configuration Defaults
 *
 * Provides a starter configuration and utilities for generating
 * default YAML files for new Vector projects.
 */

import * as yaml from 'js-yaml';
import { VectorConfig } from './schema';

/**
 * Default configuration for Vector projects.
 * Includes two basic checks: npm test and TypeScript compilation check.
 */
export const DEFAULT_CONFIG: VectorConfig = {
  version: '2',
  checks: {
    'test-pass': {
      run: 'npm test',
      expect: 'exit-0',
      enabled: true,
    },
    'no-ts-errors': {
      run: 'npx tsc --noEmit',
      expect: 'exit-0',
      enabled: true,
    },
  },
  vectors: {
    v1: {
      trigger: 'Full test suite and type check',
      checks: ['test-pass', 'no-ts-errors'],
    },
  },
  defaults: {
    maxRetries: 3,
    timeout: 30000,
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
