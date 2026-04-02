/**
 * Tests for Claude Code Adapter
 *
 * Tests the adapter that wires Vector into Claude Code hooks.
 * Verifies config loading, check resolution, engine invocation, and output formatting.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runAdapter, generateHookConfig } from '../claude-code';
import { VectorName } from '../../config/schema';

describe('Claude Code Adapter', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for test projects
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-adapter-test-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('runAdapter', () => {
    it('should call engine with correct vector name', async () => {
      // Setup: Create a project config with a passing check
      const vectorDir = path.join(tempDir, '.vector');
      fs.mkdirSync(vectorDir, { recursive: true });

      const configYaml = `
version: '2'
checks:
  simple_pass:
    run: 'echo hello'
    expect: 'exit-0'
    enabled: true
vectors:
  v1:
    trigger: 'Test vector v1'
    checks:
      - simple_pass
defaults:
  maxRetries: 0
  timeout: 5000
`;
      fs.writeFileSync(path.join(vectorDir, 'config.yaml'), configYaml, 'utf-8');

      // Act: Run the adapter for v1
      const result = await runAdapter({
        projectRoot: tempDir,
        vectorName: 'v1',
      });

      // Assert: Result contains expected report structure
      expect(result.report).toBeDefined();
      expect(result.report.blueprintName).toBe('v1');
      expect(result.exitCode).toBe(0);
      expect(result.output).toBeTruthy();
    });

    it('should return exit code 0 when all checks pass', async () => {
      // Setup: Create a project config with passing checks
      const vectorDir = path.join(tempDir, '.vector');
      fs.mkdirSync(vectorDir, { recursive: true });

      const configYaml = `
version: '2'
checks:
  check_1:
    run: 'true'
    expect: 'exit-0'
    enabled: true
  check_2:
    run: 'exit 0'
    expect: 'exit-0'
    enabled: true
vectors:
  v1:
    trigger: 'Test vector'
    checks:
      - check_1
      - check_2
defaults:
  maxRetries: 0
  timeout: 5000
`;
      fs.writeFileSync(path.join(vectorDir, 'config.yaml'), configYaml, 'utf-8');

      // Act
      const result = await runAdapter({
        projectRoot: tempDir,
        vectorName: 'v1',
      });

      // Assert
      expect(result.exitCode).toBe(0);
      expect(result.report.checks.every((check) => check.status === 'passed')).toBe(
        true
      );
    });

    it('should return exit code 1 when any check fails', async () => {
      // Setup: Create a project config with a failing check
      const vectorDir = path.join(tempDir, '.vector');
      fs.mkdirSync(vectorDir, { recursive: true });

      const configYaml = `
version: '2'
checks:
  failing_check:
    run: 'exit 1'
    expect: 'exit-0'
    enabled: true
vectors:
  v1:
    trigger: 'Test vector'
    checks:
      - failing_check
defaults:
  maxRetries: 0
  timeout: 5000
`;
      fs.writeFileSync(path.join(vectorDir, 'config.yaml'), configYaml, 'utf-8');

      // Act
      const result = await runAdapter({
        projectRoot: tempDir,
        vectorName: 'v1',
      });

      // Assert
      expect(result.exitCode).toBe(1);
      expect(result.report.checks.some((check) => check.status === 'failed')).toBe(true);
    });

    it('should include formatted terminal output in result', async () => {
      // Setup
      const vectorDir = path.join(tempDir, '.vector');
      fs.mkdirSync(vectorDir, { recursive: true });

      const configYaml = `
version: '2'
checks:
  simple:
    run: 'true'
    expect: 'exit-0'
    enabled: true
vectors:
  v1:
    trigger: 'Test'
    checks:
      - simple
defaults:
  maxRetries: 0
  timeout: 5000
`;
      fs.writeFileSync(path.join(vectorDir, 'config.yaml'), configYaml, 'utf-8');

      // Act
      const result = await runAdapter({
        projectRoot: tempDir,
        vectorName: 'v1',
      });

      // Assert: Output should be a formatted string
      expect(typeof result.output).toBe('string');
      expect(result.output.length).toBeGreaterThan(0);
      // Should contain report elements like blueprint name or check details
      expect(result.output).toMatch(/v1|passed|failed|Blueprint/i);
    });

    it('should load project and active configs correctly', async () => {
      // Setup: Create both project and active configs
      const vectorDir = path.join(tempDir, '.vector');
      fs.mkdirSync(vectorDir, { recursive: true });

      const projectYaml = `
version: '2'
checks:
  check_a:
    run: 'true'
    expect: 'exit-0'
    enabled: true
  check_b:
    run: 'true'
    expect: 'exit-0'
    enabled: true
vectors:
  v1:
    trigger: 'All checks'
    checks:
      - check_a
      - check_b
defaults:
  maxRetries: 0
  timeout: 5000
`;
      fs.writeFileSync(path.join(vectorDir, 'config.yaml'), projectYaml, 'utf-8');

      // Create active config that overrides to use only check_a
      const activeYaml = `
vectors:
  v1:
    - check_a
`;
      fs.writeFileSync(path.join(vectorDir, 'active.yaml'), activeYaml, 'utf-8');

      // Act
      const result = await runAdapter({
        projectRoot: tempDir,
        vectorName: 'v1',
      });

      // Assert: Should have loaded both configs and resolved to only check_a
      expect(result.report.checks).toHaveLength(1);
      expect(result.report.checks[0].checkName).toBe('check_a');
    });

    it('should handle missing active config gracefully', async () => {
      // Setup: Create only project config (no active config)
      const vectorDir = path.join(tempDir, '.vector');
      fs.mkdirSync(vectorDir, { recursive: true });

      const configYaml = `
version: '2'
checks:
  simple:
    run: 'true'
    expect: 'exit-0'
    enabled: true
vectors:
  v1:
    trigger: 'Test'
    checks:
      - simple
defaults:
  maxRetries: 0
  timeout: 5000
`;
      fs.writeFileSync(path.join(vectorDir, 'config.yaml'), configYaml, 'utf-8');
      // Do NOT create active.yaml

      // Act & Assert: Should not throw
      const result = await runAdapter({
        projectRoot: tempDir,
        vectorName: 'v1',
      });

      expect(result.report).toBeDefined();
      expect(result.report.checks).toHaveLength(1);
    });

    it('should handle different vector names (v2, v3, etc)', async () => {
      // Setup
      const vectorDir = path.join(tempDir, '.vector');
      fs.mkdirSync(vectorDir, { recursive: true });

      const configYaml = `
version: '2'
checks:
  test:
    run: 'true'
    expect: 'exit-0'
    enabled: true
vectors:
  v1:
    trigger: 'V1 vector'
    checks:
      - test
  v2:
    trigger: 'V2 vector'
    checks:
      - test
defaults:
  maxRetries: 0
  timeout: 5000
`;
      fs.writeFileSync(path.join(vectorDir, 'config.yaml'), configYaml, 'utf-8');

      // Act: Run for v2
      const result = await runAdapter({
        projectRoot: tempDir,
        vectorName: 'v2',
      });

      // Assert
      expect(result.report.blueprintName).toBe('v2');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('generateHookConfig', () => {
    it('should return valid hook structure', () => {
      // Act
      const config = generateHookConfig();

      // Assert
      expect(config).toBeDefined();
      expect(config.hooks).toBeDefined();
      expect(typeof config.hooks).toBe('object');
    });

    it('should include Stop hook for v1', () => {
      // Act
      const config = generateHookConfig();

      // Assert
      expect(config.hooks.Stop).toBeDefined();
      expect(Array.isArray(config.hooks.Stop)).toBe(true);
      expect(config.hooks.Stop!.length).toBeGreaterThan(0);

      const stopHook = config.hooks.Stop![0];
      expect(stopHook.type).toBe('command');
      expect(stopHook.command).toBeTruthy();
    });

    it('should reference npx vector run in hook command', () => {
      // Act
      const config = generateHookConfig();

      // Assert
      const stopHook = config.hooks.Stop![0];
      expect(stopHook.command).toMatch(/npx vector run/);
    });

    it('should include v1 in the Stop hook command', () => {
      // Act
      const config = generateHookConfig();

      // Assert
      const stopHook = config.hooks.Stop![0];
      expect(stopHook.command).toMatch(/v1/);
    });
  });
});
