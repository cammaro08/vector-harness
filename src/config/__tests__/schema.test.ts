import { describe, it, expect } from 'vitest';
import {
  VectorConfig,
  CheckDefinition,
  VectorDefinition,
  ActiveConfig,
  validateConfig,
  validateActiveConfig,
} from '../schema';

describe('schema', () => {
  describe('validateConfig', () => {
    it('should validate a valid config', () => {
      const validConfig = {
        version: '2' as const,
        checks: {
          'test-pass': {
            run: 'npm test',
            expect: 'exit-0' as const,
            enabled: true,
          },
          'no-ts-errors': {
            run: 'npx tsc --noEmit',
            expect: 'exit-0' as const,
            enabled: true,
          },
        },
        vectors: {
          v1: {
            trigger: 'Code quality checks',
            checks: ['test-pass', 'no-ts-errors'],
          },
        },
        defaults: {
          maxRetries: 3,
          timeout: 30000,
        },
      };

      const result = validateConfig(validConfig);
      expect(result).toEqual(validConfig);
      expect(result.version).toBe('2');
      expect(result.checks['test-pass']).toBeDefined();
    });

    it('should validate config with optional timeout override', () => {
      const config = {
        version: '2' as const,
        checks: {
          'test-pass': {
            run: 'npm test',
            expect: 'exit-0' as const,
            enabled: true,
            timeout: 60000,
          },
        },
        vectors: {
          v1: {
            trigger: 'Test checks',
            checks: ['test-pass'],
          },
        },
        defaults: {
          maxRetries: 3,
          timeout: 30000,
        },
      };

      const result = validateConfig(config);
      expect(result.checks['test-pass'].timeout).toBe(60000);
    });

    it('should validate config with optional capture setting', () => {
      const config = {
        version: '2' as const,
        checks: {
          'test-pass': {
            run: 'npm test',
            expect: 'exit-0' as const,
            enabled: true,
            capture: 'stdout' as const,
          },
        },
        vectors: {
          v1: {
            trigger: 'Test checks',
            checks: ['test-pass'],
          },
        },
        defaults: {
          maxRetries: 3,
          timeout: 30000,
        },
      };

      const result = validateConfig(config);
      expect(result.checks['test-pass'].capture).toBe('stdout');
    });

    it('should reject config with missing version', () => {
      const invalid = {
        checks: {},
        vectors: {},
        defaults: { maxRetries: 3, timeout: 30000 },
      };

      expect(() => validateConfig(invalid)).toThrow();
    });

    it('should reject config with invalid version', () => {
      const invalid = {
        version: '1',
        checks: {},
        vectors: {},
        defaults: { maxRetries: 3, timeout: 30000 },
      };

      expect(() => validateConfig(invalid)).toThrow();
    });

    it('should reject config with missing checks', () => {
      const invalid = {
        version: '2' as const,
        vectors: {},
        defaults: { maxRetries: 3, timeout: 30000 },
      };

      expect(() => validateConfig(invalid)).toThrow();
    });

    it('should reject config with missing vectors', () => {
      const invalid = {
        version: '2' as const,
        checks: {},
        defaults: { maxRetries: 3, timeout: 30000 },
      };

      expect(() => validateConfig(invalid)).toThrow();
    });

    it('should reject config with missing defaults', () => {
      const invalid = {
        version: '2' as const,
        checks: {},
        vectors: {},
      };

      expect(() => validateConfig(invalid)).toThrow();
    });

    it('should reject check with missing run field', () => {
      const invalid = {
        version: '2' as const,
        checks: {
          'bad-check': {
            expect: 'exit-0' as const,
            enabled: true,
          },
        },
        vectors: {},
        defaults: { maxRetries: 3, timeout: 30000 },
      };

      expect(() => validateConfig(invalid)).toThrow();
    });

    it('should reject check with missing expect field', () => {
      const invalid = {
        version: '2' as const,
        checks: {
          'bad-check': {
            run: 'npm test',
            enabled: true,
          },
        },
        vectors: {},
        defaults: { maxRetries: 3, timeout: 30000 },
      };

      expect(() => validateConfig(invalid)).toThrow();
    });

    it('should reject check with missing enabled field', () => {
      const invalid = {
        version: '2' as const,
        checks: {
          'bad-check': {
            run: 'npm test',
            expect: 'exit-0' as const,
          },
        },
        vectors: {},
        defaults: { maxRetries: 3, timeout: 30000 },
      };

      expect(() => validateConfig(invalid)).toThrow();
    });

    it('should reject check with invalid expect value', () => {
      const invalid = {
        version: '2' as const,
        checks: {
          'bad-check': {
            run: 'npm test',
            expect: 'exit-1',
            enabled: true,
          },
        },
        vectors: {},
        defaults: { maxRetries: 3, timeout: 30000 },
      };

      expect(() => validateConfig(invalid)).toThrow();
    });

    it('should reject check with invalid capture value', () => {
      const invalid = {
        version: '2' as const,
        checks: {
          'bad-check': {
            run: 'npm test',
            expect: 'exit-0' as const,
            enabled: true,
            capture: 'invalid',
          },
        },
        vectors: {},
        defaults: { maxRetries: 3, timeout: 30000 },
      };

      expect(() => validateConfig(invalid)).toThrow();
    });

    it('should reject vector with missing trigger field', () => {
      const invalid = {
        version: '2' as const,
        checks: {
          'test-pass': {
            run: 'npm test',
            expect: 'exit-0' as const,
            enabled: true,
          },
        },
        vectors: {
          v1: {
            checks: ['test-pass'],
          },
        },
        defaults: { maxRetries: 3, timeout: 30000 },
      };

      expect(() => validateConfig(invalid)).toThrow();
    });

    it('should reject vector with missing checks field', () => {
      const invalid = {
        version: '2' as const,
        checks: {
          'test-pass': {
            run: 'npm test',
            expect: 'exit-0' as const,
            enabled: true,
          },
        },
        vectors: {
          v1: {
            trigger: 'Test checks',
          },
        },
        defaults: { maxRetries: 3, timeout: 30000 },
      };

      expect(() => validateConfig(invalid)).toThrow();
    });

    it('should reject vector with non-array checks field', () => {
      const invalid = {
        version: '2' as const,
        checks: {
          'test-pass': {
            run: 'npm test',
            expect: 'exit-0' as const,
            enabled: true,
          },
        },
        vectors: {
          v1: {
            trigger: 'Test checks',
            checks: 'test-pass',
          },
        },
        defaults: { maxRetries: 3, timeout: 30000 },
      };

      expect(() => validateConfig(invalid)).toThrow();
    });

    it('should reject defaults with missing maxRetries', () => {
      const invalid = {
        version: '2' as const,
        checks: {},
        vectors: {},
        defaults: {
          timeout: 30000,
        },
      };

      expect(() => validateConfig(invalid)).toThrow();
    });

    it('should reject defaults with missing timeout', () => {
      const invalid = {
        version: '2' as const,
        checks: {},
        vectors: {},
        defaults: {
          maxRetries: 3,
        },
      };

      expect(() => validateConfig(invalid)).toThrow();
    });

    it('should include descriptive error messages', () => {
      const invalid = {
        version: '1',
        checks: {},
        vectors: {},
        defaults: { maxRetries: 3, timeout: 30000 },
      };

      expect(() => validateConfig(invalid)).toThrow(/version|Version|2/);
    });
  });

  describe('validateActiveConfig', () => {
    it('should validate a valid active config', () => {
      const validActive = {
        vectors: {
          v1: ['test-pass', 'no-ts-errors'],
          v2: ['test-pass'],
        },
      };

      const result = validateActiveConfig(validActive);
      expect(result).toEqual(validActive);
    });

    it('should accept empty active config', () => {
      const emptyActive = {
        vectors: {},
      };

      const result = validateActiveConfig(emptyActive);
      expect(result).toEqual(emptyActive);
    });

    it('should accept partial vector overrides', () => {
      const partial = {
        vectors: {
          v1: ['test-pass'],
        },
      };

      const result = validateActiveConfig(partial);
      expect(result.vectors.v1).toEqual(['test-pass']);
      expect(result.vectors.v2).toBeUndefined();
    });

    it('should reject active config with missing vectors field', () => {
      const invalid = {};

      expect(() => validateActiveConfig(invalid)).toThrow();
    });

    it('should reject active config with non-object vectors', () => {
      const invalid = {
        vectors: ['v1', 'v2'],
      };

      expect(() => validateActiveConfig(invalid)).toThrow();
    });

    it('should reject vector override with non-array checks', () => {
      const invalid = {
        vectors: {
          v1: 'test-pass',
        },
      };

      expect(() => validateActiveConfig(invalid)).toThrow();
    });

    it('should reject vector override with non-string check names', () => {
      const invalid = {
        vectors: {
          v1: ['test-pass', 123],
        },
      };

      expect(() => validateActiveConfig(invalid)).toThrow();
    });

    it('should include descriptive error messages', () => {
      const invalid = {
        vectors: 'not-an-object',
      };

      expect(() => validateActiveConfig(invalid)).toThrow(/vectors|object/i);
    });
  });
});
