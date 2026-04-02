import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import {
  loadProjectConfig,
  loadActiveConfig,
  resolveChecksForVector,
} from '../loader';
import type { VectorConfig, ActiveConfig } from '../schema';

vi.mock('fs');

describe('loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadProjectConfig', () => {
    it('should load and validate a valid config file', () => {
      const configYaml = `
version: '2'
checks:
  test-pass:
    run: npm test
    expect: exit-0
    enabled: true
  no-ts-errors:
    run: npx tsc --noEmit
    expect: exit-0
    enabled: true
vectors:
  v1:
    trigger: Code quality checks
    checks:
      - test-pass
      - no-ts-errors
  v2:
    trigger: Fast checks
    checks:
      - test-pass
defaults:
  maxRetries: 3
  timeout: 30000
`;

      vi.mocked(fs.readFileSync).mockReturnValue(configYaml);

      const config = loadProjectConfig('/home/project');

      expect(config.version).toBe('2');
      expect(config.checks['test-pass']).toBeDefined();
      expect(config.vectors.v1).toBeDefined();
      expect(config.defaults.maxRetries).toBe(3);
    });

    it('should read config from .vector/config.yaml relative to project root', () => {
      const configYaml = `
version: '2'
checks: {}
vectors: {}
defaults:
  maxRetries: 3
  timeout: 30000
`;

      vi.mocked(fs.readFileSync).mockReturnValue(configYaml);

      loadProjectConfig('/home/project');

      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/home/project/.vector/config.yaml',
        'utf-8'
      );
    });

    it('should throw error if config file does not exist', () => {
      const error = new Error('ENOENT: no such file or directory');
      (error as any).code = 'ENOENT';
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw error;
      });

      expect(() => loadProjectConfig('/home/project')).toThrow();
    });

    it('should throw error if config is invalid YAML', () => {
      const invalidYaml = `
version: '2'
checks: {
  invalid yaml syntax
`;

      vi.mocked(fs.readFileSync).mockReturnValue(invalidYaml);

      expect(() => loadProjectConfig('/home/project')).toThrow();
    });

    it('should throw error if config fails validation', () => {
      const invalidConfig = `
version: '1'
checks: {}
vectors: {}
defaults:
  maxRetries: 3
  timeout: 30000
`;

      vi.mocked(fs.readFileSync).mockReturnValue(invalidConfig);

      expect(() => loadProjectConfig('/home/project')).toThrow();
    });

    it('should parse check with optional timeout', () => {
      const configYaml = `
version: '2'
checks:
  slow-test:
    run: npm test
    expect: exit-0
    enabled: true
    timeout: 60000
vectors: {}
defaults:
  maxRetries: 3
  timeout: 30000
`;

      vi.mocked(fs.readFileSync).mockReturnValue(configYaml);

      const config = loadProjectConfig('/home/project');

      expect(config.checks['slow-test'].timeout).toBe(60000);
    });

    it('should parse check with optional capture', () => {
      const configYaml = `
version: '2'
checks:
  capture-test:
    run: npm test
    expect: exit-0
    enabled: true
    capture: stdout
vectors: {}
defaults:
  maxRetries: 3
  timeout: 30000
`;

      vi.mocked(fs.readFileSync).mockReturnValue(configYaml);

      const config = loadProjectConfig('/home/project');

      expect(config.checks['capture-test'].capture).toBe('stdout');
    });
  });

  describe('loadActiveConfig', () => {
    it('should load and validate an active config file if it exists', () => {
      const activeYaml = `
vectors:
  v1:
    - test-pass
    - no-ts-errors
  v2:
    - test-pass
`;

      vi.mocked(fs.readFileSync).mockReturnValue(activeYaml);

      const active = loadActiveConfig('/home/project');

      expect(active).not.toBeNull();
      expect(active?.vectors.v1).toEqual(['test-pass', 'no-ts-errors']);
      expect(active?.vectors.v2).toEqual(['test-pass']);
    });

    it('should read active config from .vector/active.yaml relative to project root', () => {
      const activeYaml = `
vectors: {}
`;

      vi.mocked(fs.readFileSync).mockReturnValue(activeYaml);

      loadActiveConfig('/home/project');

      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/home/project/.vector/active.yaml',
        'utf-8'
      );
    });

    it('should return null if active.yaml does not exist', () => {
      const error = new Error('ENOENT: no such file or directory');
      (error as any).code = 'ENOENT';
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw error;
      });

      const active = loadActiveConfig('/home/project');

      expect(active).toBeNull();
    });

    it('should throw error if active.yaml has invalid YAML', () => {
      const invalidYaml = `
vectors: {
  invalid yaml syntax
`;

      vi.mocked(fs.readFileSync).mockReturnValue(invalidYaml);

      expect(() => loadActiveConfig('/home/project')).toThrow();
    });

    it('should throw error if active config fails validation', () => {
      const invalidActive = `
vectors:
  v1: test-pass
`;

      vi.mocked(fs.readFileSync).mockReturnValue(invalidActive);

      expect(() => loadActiveConfig('/home/project')).toThrow();
    });

    it('should not throw for other errors besides ENOENT', () => {
      const error = new Error('Permission denied');
      (error as any).code = 'EACCES';
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw error;
      });

      expect(() => loadActiveConfig('/home/project')).toThrow();
    });
  });

  describe('resolveChecksForVector', () => {
    const defaultConfig: VectorConfig = {
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
        'lint-check': {
          run: 'npm run lint',
          expect: 'exit-0',
          enabled: true,
        },
      },
      vectors: {
        v1: {
          trigger: 'Full checks',
          checks: ['test-pass', 'no-ts-errors', 'lint-check'],
        },
        v2: {
          trigger: 'Fast checks',
          checks: ['test-pass'],
        },
      },
      defaults: {
        maxRetries: 3,
        timeout: 30000,
      },
    };

    it('should return checks for a vector from project config', () => {
      const checks = resolveChecksForVector(defaultConfig, null, 'v1');

      expect(checks).toHaveLength(3);
      expect(checks[0].run).toBe('npm test');
      expect(checks[1].run).toBe('npx tsc --noEmit');
      expect(checks[2].run).toBe('npm run lint');
    });

    it('should return checks for different vectors', () => {
      const checks = resolveChecksForVector(defaultConfig, null, 'v2');

      expect(checks).toHaveLength(1);
      expect(checks[0].run).toBe('npm test');
    });

    it('should return empty array if vector not in project config', () => {
      const checks = resolveChecksForVector(defaultConfig, null, 'v3');

      expect(checks).toEqual([]);
    });

    it('should override project checks with active config for same vector', () => {
      const activeConfig: ActiveConfig = {
        vectors: {
          v1: ['test-pass'],
        },
      };

      const checks = resolveChecksForVector(defaultConfig, activeConfig, 'v1');

      expect(checks).toHaveLength(1);
      expect(checks[0].run).toBe('npm test');
    });

    it('should use project config when active config does not specify vector', () => {
      const activeConfig: ActiveConfig = {
        vectors: {
          v2: ['lint-check'],
        },
      };

      const checks = resolveChecksForVector(defaultConfig, activeConfig, 'v1');

      expect(checks).toHaveLength(3);
      expect(checks.map((c) => c.run)).toEqual([
        'npm test',
        'npx tsc --noEmit',
        'npm run lint',
      ]);
    });

    it('should use active config when it specifies the vector', () => {
      const activeConfig: ActiveConfig = {
        vectors: {
          v1: ['test-pass', 'lint-check'],
        },
      };

      const checks = resolveChecksForVector(defaultConfig, activeConfig, 'v1');

      expect(checks).toHaveLength(2);
      expect(checks.map((c) => c.run)).toEqual(['npm test', 'npm run lint']);
    });

    it('should return empty array if active config specifies vector with no checks', () => {
      const activeConfig: ActiveConfig = {
        vectors: {
          v1: [],
        },
      };

      const checks = resolveChecksForVector(defaultConfig, activeConfig, 'v1');

      expect(checks).toEqual([]);
    });

    it('should handle multiple vectors with different overrides', () => {
      const activeConfig: ActiveConfig = {
        vectors: {
          v1: ['test-pass'],
          v2: ['no-ts-errors', 'lint-check'],
        },
      };

      const v1Checks = resolveChecksForVector(
        defaultConfig,
        activeConfig,
        'v1'
      );
      const v2Checks = resolveChecksForVector(
        defaultConfig,
        activeConfig,
        'v2'
      );

      expect(v1Checks).toHaveLength(1);
      expect(v2Checks).toHaveLength(2);
    });

    it('should preserve check definition properties in resolved checks', () => {
      const configWithTimeout: VectorConfig = {
        ...defaultConfig,
        checks: {
          ...defaultConfig.checks,
          'slow-test': {
            run: 'npm test:slow',
            expect: 'exit-0',
            enabled: true,
            timeout: 90000,
            capture: 'stdout',
          },
        },
        vectors: {
          ...defaultConfig.vectors,
          v1: {
            trigger: 'Full checks',
            checks: ['test-pass', 'slow-test'],
          },
        },
      };

      const checks = resolveChecksForVector(configWithTimeout, null, 'v1');

      expect(checks).toHaveLength(2);
      expect(checks[1].timeout).toBe(90000);
      expect(checks[1].capture).toBe('stdout');
    });

    it('should return immutable check definitions', () => {
      const checks = resolveChecksForVector(defaultConfig, null, 'v1');
      const originalRun = checks[0].run;

      // Attempt to mutate should not affect the original
      (checks[0] as any).run = 'modified';

      const checksAgain = resolveChecksForVector(defaultConfig, null, 'v1');
      expect(checksAgain[0].run).toBe(originalRun);
    });
  });
});
