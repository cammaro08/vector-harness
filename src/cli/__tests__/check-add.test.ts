/**
 * Check Add Command Tests
 *
 * Tests for vector check add command with interactive and non-interactive modes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { checkAddCommand, validateCheckName, validateRunCommand } from '../commands/check-add';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  text: vi.fn(),
  multiselect: vi.fn(),
  outro: vi.fn(),
  isCancel: vi.fn((val) => val === Symbol.for('cancel')),
}));

// Mock theme module
vi.mock('../ui/theme', () => ({
  isInteractive: vi.fn(() => true),
  S: {
    start: '┌',
    middle: '│',
    end: '└',
    step: '◇',
    active: '●',
    prompt: '◆',
    success: '✓',
    failure: '✗',
    skipped: '○',
    bar: '─',
    corner: '╮',
  },
  colors: {
    success: (s: string) => s,
    error: (s: string) => s,
    warning: (s: string) => s,
    info: (s: string) => s,
    muted: (s: string) => s,
    highlight: (s: string) => s,
    brand: (s: string) => s,
  },
}));

describe('validateCheckName', () => {
  describe('valid names', () => {
    it('accepts lowercase alphanumeric names', () => {
      expect(validateCheckName('lint')).toBe(true);
      expect(validateCheckName('test')).toBe(true);
      expect(validateCheckName('format')).toBe(true);
    });

    it('accepts names with hyphens', () => {
      expect(validateCheckName('lint-staged')).toBe(true);
      expect(validateCheckName('format-check')).toBe(true);
      expect(validateCheckName('my-custom-check')).toBe(true);
    });

    it('accepts names starting with number', () => {
      expect(validateCheckName('4xx-test')).toBe(true);
      expect(validateCheckName('2to3')).toBe(true);
    });

    it('accepts single character names', () => {
      expect(validateCheckName('a')).toBe(true);
      expect(validateCheckName('1')).toBe(true);
    });

    it('accepts names up to 64 characters', () => {
      const maxName = 'a'.repeat(64);
      expect(validateCheckName(maxName)).toBe(true);
    });
  });

  describe('invalid names', () => {
    it('rejects empty names', () => {
      expect(validateCheckName('')).toBe(false);
    });

    it('rejects names with uppercase letters', () => {
      expect(validateCheckName('Lint')).toBe(false);
      expect(validateCheckName('LINT')).toBe(false);
      expect(validateCheckName('LintStaged')).toBe(false);
    });

    it('rejects names with spaces', () => {
      expect(validateCheckName('lint staged')).toBe(false);
      expect(validateCheckName('my check')).toBe(false);
    });

    it('rejects names with special characters', () => {
      expect(validateCheckName('lint_staged')).toBe(false);
      expect(validateCheckName('lint.staged')).toBe(false);
      expect(validateCheckName('lint/staged')).toBe(false);
      expect(validateCheckName('lint@staged')).toBe(false);
    });

    it('rejects names longer than 64 characters', () => {
      const tooLong = 'a'.repeat(65);
      expect(validateCheckName(tooLong)).toBe(false);
    });

    it('rejects names starting with hyphen', () => {
      expect(validateCheckName('-lint')).toBe(false);
    });

    it('rejects names with trailing hyphen', () => {
      expect(validateCheckName('lint-')).toBe(false);
    });
  });
});

describe('validateRunCommand', () => {
  describe('valid commands', () => {
    it('accepts simple commands', () => {
      expect(validateRunCommand('npm test')).toBe(true);
      expect(validateRunCommand('npx lint')).toBe(true);
      expect(validateRunCommand('bash script.sh')).toBe(true);
    });

    it('accepts commands with pipes', () => {
      expect(validateRunCommand('npm run lint | grep error')).toBe(true);
    });

    it('accepts commands with special characters', () => {
      expect(validateRunCommand('npm run build && npm test')).toBe(true);
      expect(validateRunCommand('grep -r "TODO"')).toBe(true);
    });

    it('accepts long commands', () => {
      const longCmd = 'npm test && npm run lint && npm run format';
      expect(validateRunCommand(longCmd)).toBe(true);
    });
  });

  describe('invalid commands', () => {
    it('rejects empty commands', () => {
      expect(validateRunCommand('')).toBe(false);
    });

    it('rejects whitespace-only commands', () => {
      expect(validateRunCommand('   ')).toBe(false);
      expect(validateRunCommand('\t')).toBe(false);
      expect(validateRunCommand('\n')).toBe(false);
    });

    it('rejects commands longer than 4096 characters', () => {
      const tooLong = 'a'.repeat(4097);
      expect(validateRunCommand(tooLong)).toBe(false);
    });

    it('accepts commands exactly 4096 characters', () => {
      const maxCmd = 'a'.repeat(4096);
      expect(validateRunCommand(maxCmd)).toBe(true);
    });
  });
});

describe('checkAddCommand', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join('/tmp', 'vector-test-'));
    // Initialize .vector directory with a basic config
    fs.mkdirSync(path.join(tempDir, '.vector'), { recursive: true });
    const defaultConfig = {
      version: '2',
      checks: {},
      vectors: {
        v1: { trigger: 'Run on CI', checks: [] },
        v2: { trigger: 'Run on PR', checks: [] },
      },
      defaults: {
        maxRetries: 2,
        timeout: 30000,
      },
    };
    fs.writeFileSync(
      path.join(tempDir, '.vector', 'config.yaml'),
      yaml.dump(defaultConfig),
      'utf-8'
    );
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('non-interactive mode (--name and --run flags provided)', () => {
    it('adds check to config and returns 0', async () => {
      const exitCode = await checkAddCommand(
        {
          name: 'lint',
          run: 'npm run lint',
        },
        tempDir
      );

      expect(exitCode).toBe(0);

      const configPath = path.join(tempDir, '.vector', 'config.yaml');
      const content = yaml.load(fs.readFileSync(configPath, 'utf-8')) as any;
      expect(content.checks.lint).toBeDefined();
      expect(content.checks.lint.run).toBe('npm run lint');
      expect(content.checks.lint.enabled).toBe(true);
      expect(content.checks.lint.expect).toBe('exit-0');
    });

    it('rejects missing --name flag', async () => {
      const exitCode = await checkAddCommand(
        {
          run: 'npm run lint',
        },
        tempDir
      );

      expect(exitCode).toBe(1);
    });

    it('rejects missing --run flag', async () => {
      const exitCode = await checkAddCommand(
        {
          name: 'lint',
        },
        tempDir
      );

      expect(exitCode).toBe(1);
    });

    it('rejects invalid check name', async () => {
      const exitCode = await checkAddCommand(
        {
          name: 'Lint-Invalid',
          run: 'npm run lint',
        },
        tempDir
      );

      expect(exitCode).toBe(1);
    });

    it('rejects invalid run command', async () => {
      const exitCode = await checkAddCommand(
        {
          name: 'lint',
          run: '',
        },
        tempDir
      );

      expect(exitCode).toBe(1);
    });

    it('rejects duplicate check name without --force', async () => {
      // Add first check
      await checkAddCommand(
        {
          name: 'lint',
          run: 'npm run lint',
        },
        tempDir
      );

      // Try to add duplicate
      const exitCode = await checkAddCommand(
        {
          name: 'lint',
          run: 'npm run lint-fix',
        },
        tempDir
      );

      expect(exitCode).toBe(1);
    });

    it('overwrites check with --force flag', async () => {
      // Add first check
      await checkAddCommand(
        {
          name: 'lint',
          run: 'npm run lint',
        },
        tempDir
      );

      // Overwrite with --force
      const exitCode = await checkAddCommand(
        {
          name: 'lint',
          run: 'npm run lint-fix',
          force: true,
        },
        tempDir
      );

      expect(exitCode).toBe(0);

      const configPath = path.join(tempDir, '.vector', 'config.yaml');
      const content = yaml.load(fs.readFileSync(configPath, 'utf-8')) as any;
      expect(content.checks.lint.run).toBe('npm run lint-fix');
    });
  });

  describe('interactive mode (prompts used)', () => {
    beforeEach(async () => {
      // Mock isInteractive to return true
      const { isInteractive } = await import('../ui/theme');
      (isInteractive as any).mockReturnValue(true);
    });

    it('prompts for check name when only --run provided', async () => {
      const prompts = await import('@clack/prompts');

      (prompts.text as any)
        .mockResolvedValueOnce('test-check') // check name
        .mockResolvedValueOnce('npm test'); // run command

      (prompts.multiselect as any).mockResolvedValueOnce(['v1']);

      const exitCode = await checkAddCommand(
        {
          run: 'npm test',
        },
        tempDir
      );

      expect(exitCode).toBe(0);
      expect(prompts.text).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('name'),
        })
      );
    });

    it('prompts for run command when only --name provided', async () => {
      const prompts = await import('@clack/prompts');

      (prompts.text as any)
        .mockResolvedValueOnce('npm test'); // run command

      (prompts.multiselect as any).mockResolvedValueOnce(['v1']);

      const exitCode = await checkAddCommand(
        {
          name: 'test-check',
        },
        tempDir
      );

      expect(exitCode).toBe(0);
      expect(prompts.text).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('command'),
        })
      );
    });

    it('enters interactive mode when no flags provided', async () => {
      const prompts = await import('@clack/prompts');

      (prompts.text as any)
        .mockResolvedValueOnce('lint-check') // check name
        .mockResolvedValueOnce('npm run lint'); // run command

      (prompts.multiselect as any).mockResolvedValueOnce(['v1', 'v2']);

      const exitCode = await checkAddCommand({}, tempDir);

      expect(exitCode).toBe(0);
      expect(prompts.intro).toHaveBeenCalled();
      expect(prompts.text).toHaveBeenCalledTimes(2);
      expect(prompts.multiselect).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('vector'),
        })
      );
    });

    it('adds check to selected vectors', async () => {
      const prompts = await import('@clack/prompts');

      (prompts.text as any)
        .mockResolvedValueOnce('lint-check')
        .mockResolvedValueOnce('npm run lint');

      (prompts.multiselect as any).mockResolvedValueOnce(['v1', 'v2']);

      await checkAddCommand({}, tempDir);

      const configPath = path.join(tempDir, '.vector', 'config.yaml');
      const content = yaml.load(fs.readFileSync(configPath, 'utf-8')) as any;

      expect(content.vectors.v1.checks).toContain('lint-check');
      expect(content.vectors.v2.checks).toContain('lint-check');
    });

    it('does not add check to unselected vectors', async () => {
      const prompts = await import('@clack/prompts');

      (prompts.text as any)
        .mockResolvedValueOnce('lint-check')
        .mockResolvedValueOnce('npm run lint');

      (prompts.multiselect as any).mockResolvedValueOnce(['v1']);

      await checkAddCommand({}, tempDir);

      const configPath = path.join(tempDir, '.vector', 'config.yaml');
      const content = yaml.load(fs.readFileSync(configPath, 'utf-8')) as any;

      expect(content.vectors.v1.checks).toContain('lint-check');
      expect(content.vectors.v2.checks).not.toContain('lint-check');
    });

    it('handles invalid check name with re-prompt', async () => {
      const prompts = await import('@clack/prompts');

      (prompts.text as any)
        .mockResolvedValueOnce('Invalid-Name') // invalid
        .mockResolvedValueOnce('valid-name') // valid
        .mockResolvedValueOnce('npm test'); // run command

      (prompts.multiselect as any).mockResolvedValueOnce(['v1']);

      const exitCode = await checkAddCommand({}, tempDir);

      expect(exitCode).toBe(0);
      expect(prompts.text).toHaveBeenCalledTimes(3);
    });

    it('handles invalid run command with re-prompt', async () => {
      const prompts = await import('@clack/prompts');

      (prompts.text as any)
        .mockResolvedValueOnce('valid-name')
        .mockResolvedValueOnce('') // invalid
        .mockResolvedValueOnce('npm test'); // valid

      (prompts.multiselect as any).mockResolvedValueOnce(['v1']);

      const exitCode = await checkAddCommand({}, tempDir);

      expect(exitCode).toBe(0);
      expect(prompts.text).toHaveBeenCalledTimes(3);
    });

    it('handles user cancellation during name prompt', async () => {
      const prompts = await import('@clack/prompts');
      const cancelSymbol = Symbol.for('cancel');

      (prompts.text as any).mockResolvedValueOnce(cancelSymbol);

      const exitCode = await checkAddCommand({}, tempDir);

      expect(exitCode).toBe(1);
      expect(prompts.outro).toHaveBeenCalled();
    });

    it('handles user cancellation during run command prompt', async () => {
      const prompts = await import('@clack/prompts');
      const cancelSymbol = Symbol.for('cancel');

      (prompts.text as any)
        .mockResolvedValueOnce('valid-name')
        .mockResolvedValueOnce(cancelSymbol);

      const exitCode = await checkAddCommand({}, tempDir);

      expect(exitCode).toBe(1);
      expect(prompts.outro).toHaveBeenCalled();
    });

    it('handles user cancellation during vector selection', async () => {
      const prompts = await import('@clack/prompts');
      const cancelSymbol = Symbol.for('cancel');

      (prompts.text as any)
        .mockResolvedValueOnce('valid-name')
        .mockResolvedValueOnce('npm test');

      (prompts.multiselect as any).mockResolvedValueOnce(cancelSymbol);

      const exitCode = await checkAddCommand({}, tempDir);

      expect(exitCode).toBe(1);
      expect(prompts.outro).toHaveBeenCalled();
    });

    it('shows outro on successful completion', async () => {
      const prompts = await import('@clack/prompts');

      (prompts.text as any)
        .mockResolvedValueOnce('lint-check')
        .mockResolvedValueOnce('npm run lint');

      (prompts.multiselect as any).mockResolvedValueOnce(['v1']);

      await checkAddCommand({}, tempDir);

      expect(prompts.outro).toHaveBeenCalled();
    });

    it('shows outro on cancellation', async () => {
      const prompts = await import('@clack/prompts');
      const cancelSymbol = Symbol.for('cancel');

      (prompts.text as any).mockResolvedValueOnce(cancelSymbol);

      await checkAddCommand({}, tempDir);

      expect(prompts.outro).toHaveBeenCalled();
    });
  });

  describe('non-interactive mode (non-TTY)', () => {
    it('requires both --name and --run in non-TTY', async () => {
      const { isInteractive } = await import('../ui/theme');
      (isInteractive as any).mockReturnValue(false);

      const exitCode = await checkAddCommand(
        {
          name: 'lint',
        },
        tempDir
      );

      expect(exitCode).toBe(1);
    });

    it('uses flags silently without prompts when non-TTY', async () => {
      const { isInteractive } = await import('../ui/theme');
      (isInteractive as any).mockReturnValue(false);

      const prompts = await import('@clack/prompts');

      const exitCode = await checkAddCommand(
        {
          name: 'lint',
          run: 'npm run lint',
        },
        tempDir
      );

      expect(exitCode).toBe(0);
      expect(prompts.text).not.toHaveBeenCalled();
      expect(prompts.multiselect).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('returns 1 on config load failure', async () => {
      // Corrupt the config file
      fs.writeFileSync(
        path.join(tempDir, '.vector', 'config.yaml'),
        'invalid: yaml: content:',
        'utf-8'
      );

      const exitCode = await checkAddCommand(
        {
          name: 'lint',
          run: 'npm test',
        },
        tempDir
      );

      expect(exitCode).toBe(1);
    });

    it('logs error message on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await checkAddCommand(
        {
          name: 'Invalid-Name',
          run: 'npm test',
        },
        tempDir
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[vector]')
      );

      consoleSpy.mockRestore();
    });
  });
});
