import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { initCommand } from '../commands/init';
import { runCommand } from '../commands/run';
import { activateCommand } from '../commands/activate';
import { reportCommand } from '../commands/report';
import { checkAddCommand } from '../commands/check-add';

describe('CLI Commands', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join('/tmp', 'vector-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('initCommand', () => {
    it('creates .vector directory and config.yaml', async () => {
      const exitCode = await initCommand({ yes: true }, tempDir);

      expect(exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, '.vector'))).toBe(true);
      expect(
        fs.existsSync(path.join(tempDir, '.vector', 'config.yaml'))
      ).toBe(true);
    });

    it('writes valid YAML config file', async () => {
      await initCommand({ yes: true }, tempDir);

      const configPath = path.join(tempDir, '.vector', 'config.yaml');
      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = yaml.load(content);

      expect((parsed as any).version).toBe('2');
      expect((parsed as any).checks).toBeDefined();
      expect((parsed as any).vectors).toBeDefined();
      expect((parsed as any).defaults).toBeDefined();
    });

    it('creates .claude/settings.local.json with hook config', async () => {
      await initCommand({ yes: true }, tempDir);

      const settingsPath = path.join(
        tempDir,
        '.claude',
        'settings.local.json'
      );
      expect(fs.existsSync(settingsPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      expect(content.hooks).toBeDefined();
      expect(content.hooks.Stop).toBeDefined();
      expect(Array.isArray(content.hooks.Stop)).toBe(true);
    });

    it('skips config creation if it already exists', async () => {
      // Create config first
      fs.mkdirSync(path.join(tempDir, '.vector'), { recursive: true });
      const configPath = path.join(tempDir, '.vector', 'config.yaml');
      fs.writeFileSync(configPath, 'version: "2"\n');
      const originalMtime = fs.statSync(configPath).mtime;

      // Wait a bit to ensure mtime would change
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Run init again
      const exitCode = await initCommand({ yes: true }, tempDir);

      expect(exitCode).toBe(0);
      const newMtime = fs.statSync(configPath).mtime;
      expect(newMtime.getTime()).toBe(originalMtime.getTime());
    });

    it('returns 0 on success', async () => {
      const exitCode = await initCommand({ yes: true }, tempDir);
      expect(exitCode).toBe(0);
    });
  });

  describe('runCommand', () => {
    beforeEach(async () => {
      // Set up a minimal config
      fs.mkdirSync(path.join(tempDir, '.vector'), { recursive: true });
      const configPath = path.join(tempDir, '.vector', 'config.yaml');
      const config = {
        version: '2',
        checks: {
          'test-pass': {
            run: 'exit 0',
            expect: 'exit-0',
            enabled: true,
          },
        },
        vectors: {
          v1: {
            trigger: 'Test vector',
            checks: ['test-pass'],
          },
        },
        defaults: {
          maxRetries: 0,
          timeout: 5000,
        },
      };
      fs.writeFileSync(configPath, yaml.dump(config));
    });

    it('runs a vector and returns 0 on success', async () => {
      const exitCode = await runCommand('v1', tempDir);
      expect(exitCode).toBe(0);
    });

    it('creates .vector/reports directory', async () => {
      await runCommand('v1', tempDir);
      expect(
        fs.existsSync(path.join(tempDir, '.vector', 'reports'))
      ).toBe(true);
    });

    it('writes JSON report to reports directory', async () => {
      await runCommand('v1', tempDir);
      const reportsDir = path.join(tempDir, '.vector', 'reports');
      const files = fs.readdirSync(reportsDir);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toMatch(/\.json$/);
    });

    it('returns 1 on check failure', async () => {
      // Update config with a failing check
      const configPath = path.join(tempDir, '.vector', 'config.yaml');
      const config = {
        version: '2',
        checks: {
          'test-fail': {
            run: 'exit 1',
            expect: 'exit-0',
            enabled: true,
          },
        },
        vectors: {
          v1: {
            trigger: 'Test vector',
            checks: ['test-fail'],
          },
        },
        defaults: {
          maxRetries: 0,
          timeout: 5000,
        },
      };
      fs.writeFileSync(configPath, yaml.dump(config));

      const exitCode = await runCommand('v1', tempDir);
      expect(exitCode).toBe(1);
    });
  });

  describe('activateCommand', () => {
    beforeEach(async () => {
      await initCommand({ yes: true }, tempDir);
    });

    it('creates active.yaml with check override', async () => {
      const exitCode = await activateCommand(
        {
          check: 'test-pass',
          on: true,
          vector: 'v1',
        },
        tempDir
      );

      expect(exitCode).toBe(0);
      const activePath = path.join(tempDir, '.vector', 'active.yaml');
      expect(fs.existsSync(activePath)).toBe(true);

      const content = yaml.load(fs.readFileSync(activePath, 'utf-8'));
      expect((content as any).vectors).toBeDefined();
    });

    it('toggles check on with --on flag', async () => {
      await activateCommand(
        {
          check: 'test-pass',
          on: true,
          vector: 'v1',
        },
        tempDir
      );

      const activePath = path.join(tempDir, '.vector', 'active.yaml');
      const content = yaml.load(fs.readFileSync(activePath, 'utf-8'));
      const v1Checks = (content as any).vectors.v1 as string[];
      expect(v1Checks).toContain('test-pass');
    });

    it('toggles check off with --off flag', async () => {
      // First enable it
      await activateCommand(
        {
          check: 'test-pass',
          on: true,
          vector: 'v1',
        },
        tempDir
      );

      // Then disable it
      const exitCode = await activateCommand(
        {
          check: 'test-pass',
          off: true,
          vector: 'v1',
        },
        tempDir
      );

      expect(exitCode).toBe(0);
      const activePath = path.join(tempDir, '.vector', 'active.yaml');
      const content = yaml.load(fs.readFileSync(activePath, 'utf-8'));
      const v1Checks = (content as any).vectors.v1 as string[];
      expect(v1Checks).not.toContain('test-pass');
    });

    it('returns 0 on success', async () => {
      const exitCode = await activateCommand(
        {
          check: 'test-pass',
          on: true,
          vector: 'v1',
        },
        tempDir
      );
      expect(exitCode).toBe(0);
    });
  });

  describe('reportCommand', () => {
    beforeEach(async () => {
      // Set up a minimal config and run it to create a report
      fs.mkdirSync(path.join(tempDir, '.vector'), { recursive: true });
      const configPath = path.join(tempDir, '.vector', 'config.yaml');
      const config = {
        version: '2',
        checks: {
          'test-pass': {
            run: 'exit 0',
            expect: 'exit-0',
            enabled: true,
          },
        },
        vectors: {
          v1: {
            trigger: 'Test vector',
            checks: ['test-pass'],
          },
        },
        defaults: {
          maxRetries: 0,
          timeout: 5000,
        },
      };
      fs.writeFileSync(configPath, yaml.dump(config));
      await runCommand('v1', tempDir);
    });

    it('finds and displays latest report', async () => {
      const exitCode = await reportCommand({}, tempDir);
      expect(exitCode).toBe(0);
    });

    it('returns 1 if no reports found', async () => {
      const emptyDir = fs.mkdtempSync(path.join('/tmp', 'vector-test-'));
      try {
        fs.mkdirSync(path.join(emptyDir, '.vector'), { recursive: true });
        const exitCode = await reportCommand({}, emptyDir);
        expect(exitCode).toBe(1);
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it('supports --format flag', async () => {
      const exitCode = await reportCommand({ format: 'json' }, tempDir);
      expect(exitCode).toBe(0);
    });

    it('returns 0 on success', async () => {
      const exitCode = await reportCommand({}, tempDir);
      expect(exitCode).toBe(0);
    });
  });

  describe('checkAddCommand', () => {
    beforeEach(async () => {
      await initCommand({ yes: true }, tempDir);
    });

    it('adds a new check to config.yaml', async () => {
      const exitCode = await checkAddCommand(
        {
          name: 'lint',
          run: 'npm run lint',
        },
        tempDir
      );

      expect(exitCode).toBe(0);
      const configPath = path.join(tempDir, '.vector', 'config.yaml');
      const content = yaml.load(fs.readFileSync(configPath, 'utf-8'));
      const checks = (content as any).checks;
      expect(checks.lint).toBeDefined();
      expect(checks.lint.run).toBe('npm run lint');
      expect(checks.lint.enabled).toBe(true);
      expect(checks.lint.expect).toBe('exit-0');
    });

    it('returns 0 on success', async () => {
      const exitCode = await checkAddCommand(
        {
          name: 'lint',
          run: 'npm run lint',
        },
        tempDir
      );
      expect(exitCode).toBe(0);
    });

    it('preserves existing checks', async () => {
      const configPath = path.join(tempDir, '.vector', 'config.yaml');
      const originalContent = fs.readFileSync(configPath, 'utf-8');
      const originalParsed = yaml.load(originalContent);
      const originalCheckCount = Object.keys(
        (originalParsed as any).checks
      ).length;

      await checkAddCommand(
        {
          name: 'lint',
          run: 'npm run lint',
        },
        tempDir
      );

      const newContent = fs.readFileSync(configPath, 'utf-8');
      const newParsed = yaml.load(newContent);
      const newCheckCount = Object.keys((newParsed as any).checks).length;
      expect(newCheckCount).toBe(originalCheckCount + 1);
    });
  });
});
