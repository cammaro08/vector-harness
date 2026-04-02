import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, generateDefaultConfigYaml } from '../defaults';
import { validateConfig } from '../schema';
import * as yaml from 'js-yaml';

describe('defaults', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should be a valid VectorConfig', () => {
      expect(() => validateConfig(DEFAULT_CONFIG)).not.toThrow();
    });

    it('should have version 2', () => {
      expect(DEFAULT_CONFIG.version).toBe('2');
    });

    it('should include test-pass check', () => {
      expect(DEFAULT_CONFIG.checks['test-pass']).toBeDefined();
      expect(DEFAULT_CONFIG.checks['test-pass'].run).toBe('npm test');
      expect(DEFAULT_CONFIG.checks['test-pass'].expect).toBe('exit-0');
      expect(DEFAULT_CONFIG.checks['test-pass'].enabled).toBe(true);
    });

    it('should include no-ts-errors check', () => {
      expect(DEFAULT_CONFIG.checks['no-ts-errors']).toBeDefined();
      expect(DEFAULT_CONFIG.checks['no-ts-errors'].run).toBe('npx tsc --noEmit');
      expect(DEFAULT_CONFIG.checks['no-ts-errors'].expect).toBe('exit-0');
      expect(DEFAULT_CONFIG.checks['no-ts-errors'].enabled).toBe(true);
    });

    it('should have at least one vector', () => {
      expect(Object.keys(DEFAULT_CONFIG.vectors).length).toBeGreaterThan(0);
    });

    it('should have valid defaults', () => {
      expect(DEFAULT_CONFIG.defaults.maxRetries).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_CONFIG.defaults.timeout).toBeGreaterThan(0);
    });

    it('should reference existing checks in vectors', () => {
      for (const vectorDef of Object.values(DEFAULT_CONFIG.vectors)) {
        for (const checkName of vectorDef.checks) {
          expect(DEFAULT_CONFIG.checks[checkName]).toBeDefined();
        }
      }
    });
  });

  describe('generateDefaultConfigYaml', () => {
    it('should generate valid YAML', () => {
      const yamlString = generateDefaultConfigYaml();

      expect(() => yaml.load(yamlString)).not.toThrow();
    });

    it('should generate YAML that parses to valid config', () => {
      const yamlString = generateDefaultConfigYaml();
      const parsed = yaml.load(yamlString);

      expect(() => validateConfig(parsed)).not.toThrow();
    });

    it('should include version 2', () => {
      const yamlString = generateDefaultConfigYaml();

      expect(yamlString).toContain("version: '2'");
    });

    it('should include test-pass check definition', () => {
      const yamlString = generateDefaultConfigYaml();

      expect(yamlString).toContain('test-pass:');
      expect(yamlString).toContain('npm test');
    });

    it('should include no-ts-errors check definition', () => {
      const yamlString = generateDefaultConfigYaml();

      expect(yamlString).toContain('no-ts-errors:');
      expect(yamlString).toContain('npx tsc --noEmit');
    });

    it('should include vectors section', () => {
      const yamlString = generateDefaultConfigYaml();

      expect(yamlString).toContain('vectors:');
    });

    it('should include defaults section', () => {
      const yamlString = generateDefaultConfigYaml();

      expect(yamlString).toContain('defaults:');
      expect(yamlString).toContain('maxRetries:');
      expect(yamlString).toContain('timeout:');
    });

    it('should generate YAML equivalent to DEFAULT_CONFIG', () => {
      const yamlString = generateDefaultConfigYaml();
      const parsed = yaml.load(yamlString);

      expect(parsed).toEqual(DEFAULT_CONFIG);
    });

    it('should produce readable YAML with proper indentation', () => {
      const yamlString = generateDefaultConfigYaml();

      // Should have reasonable indentation (not all on one line)
      expect(yamlString.split('\n').length).toBeGreaterThan(5);

      // Should be reasonably readable (not heavily nested)
      const indentLevels = yamlString
        .split('\n')
        .map((line) => line.match(/^ */)?.[0].length || 0);
      const maxIndent = Math.max(...indentLevels);
      expect(maxIndent).toBeLessThanOrEqual(8);
    });
  });
});
