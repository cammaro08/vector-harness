/**
 * Init Command Tests
 *
 * Tests for vector init command with interactive and non-interactive modes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Mock @clack/prompts
const mockIntro = vi.fn();
const mockText = vi.fn();
const mockSelect = vi.fn();
const mockConfirm = vi.fn();
const mockOutro = vi.fn();
const mockIsCancel = vi.fn((val) => val === Symbol.for('cancel'));

vi.mock('@clack/prompts', () => ({
  intro: mockIntro,
  text: mockText,
  select: mockSelect,
  confirm: mockConfirm,
  outro: mockOutro,
  isCancel: mockIsCancel,
}));

// Mock theme module
const mockIsInteractive = vi.fn(() => true);
vi.mock('../ui/theme', () => ({
  isInteractive: mockIsInteractive,
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

// Mock banner module
const mockShowBanner = vi.fn();
vi.mock('../banner', () => ({
  showBanner: mockShowBanner,
}));

// Now import the command to test
import { initCommand } from '../commands/init';

describe('initCommand', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join('/tmp', 'vector-test-'));
    vi.clearAllMocks();
    mockIsInteractive.mockReturnValue(true);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('non-interactive mode (--yes flag)', () => {
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

    it('supports -y short flag', async () => {
      const exitCode = await initCommand({ y: true }, tempDir);

      expect(exitCode).toBe(0);
      expect(
        fs.existsSync(path.join(tempDir, '.vector', 'config.yaml'))
      ).toBe(true);
    });
  });

  describe('interactive mode (TTY)', () => {
    it('shows banner at start', async () => {
      mockText.mockResolvedValueOnce('v1');
      mockSelect.mockResolvedValueOnce('yes');
      mockConfirm.mockResolvedValueOnce(true);

      await initCommand({}, tempDir);

      expect(mockShowBanner).toHaveBeenCalled();
    });

    it('prompts for vector name', async () => {
      mockText.mockResolvedValueOnce('my-vector');
      mockSelect.mockResolvedValueOnce('yes');
      mockConfirm.mockResolvedValueOnce(true);

      await initCommand({}, tempDir);

      expect(mockText).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('vector'),
        })
      );
    });

    it('prompts for default checks option', async () => {
      mockText.mockResolvedValueOnce('v1');
      mockSelect.mockResolvedValueOnce('yes');
      mockConfirm.mockResolvedValueOnce(true);

      await initCommand({}, tempDir);

      expect(mockSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('check'),
        })
      );
    });

    it('prompts for hook integration setup', async () => {
      mockText.mockResolvedValueOnce('v1');
      mockSelect.mockResolvedValueOnce('yes');
      mockConfirm.mockResolvedValueOnce(true);

      await initCommand({}, tempDir);

      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('hook') ||
            expect.stringContaining('Claude'),
        })
      );
    });

    it('creates config with user-provided vector name', async () => {
      mockText.mockResolvedValueOnce('custom-v1');
      mockSelect.mockResolvedValueOnce('yes');
      mockConfirm.mockResolvedValueOnce(true);

      await initCommand({}, tempDir);

      const configPath = path.join(tempDir, '.vector', 'config.yaml');
      const content = yaml.load(fs.readFileSync(configPath, 'utf-8'));
      const vectors = (content as any).vectors;

      expect(Object.keys(vectors)).toContain('custom-v1');
    });

    it('creates config with default checks when user selects yes', async () => {
      mockText.mockResolvedValueOnce('v1');
      mockSelect.mockResolvedValueOnce('yes');
      mockConfirm.mockResolvedValueOnce(true);

      await initCommand({}, tempDir);

      const configPath = path.join(tempDir, '.vector', 'config.yaml');
      const content = yaml.load(fs.readFileSync(configPath, 'utf-8'));
      const checks = (content as any).checks;

      expect(Object.keys(checks).length).toBeGreaterThan(0);
    });

    it('creates config without checks when user selects no', async () => {
      mockText.mockResolvedValueOnce('v1');
      mockSelect.mockResolvedValueOnce('no');
      mockConfirm.mockResolvedValueOnce(true);

      await initCommand({}, tempDir);

      const configPath = path.join(tempDir, '.vector', 'config.yaml');
      const content = yaml.load(fs.readFileSync(configPath, 'utf-8'));
      const checks = (content as any).checks;
      const vectors = (content as any).vectors;

      expect(Object.keys(checks).length).toBe(0);
      expect(vectors.v1.checks).toEqual([]);
    });

    it('creates hook config when user confirms yes', async () => {
      mockText.mockResolvedValueOnce('v1');
      mockSelect.mockResolvedValueOnce('yes');
      mockConfirm.mockResolvedValueOnce(true);

      await initCommand({}, tempDir);

      const settingsPath = path.join(
        tempDir,
        '.claude',
        'settings.local.json'
      );
      expect(fs.existsSync(settingsPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      expect(content.hooks.Stop).toBeDefined();
    });

    it('skips hook config when user confirms no', async () => {
      mockText.mockResolvedValueOnce('v1');
      mockSelect.mockResolvedValueOnce('yes');
      mockConfirm.mockResolvedValueOnce(false);

      await initCommand({}, tempDir);

      const settingsPath = path.join(
        tempDir,
        '.claude',
        'settings.local.json'
      );
      expect(fs.existsSync(settingsPath)).toBe(false);
    });

    it('shows outro on completion', async () => {
      mockText.mockResolvedValueOnce('v1');
      mockSelect.mockResolvedValueOnce('yes');
      mockConfirm.mockResolvedValueOnce(true);

      await initCommand({}, tempDir);

      expect(mockOutro).toHaveBeenCalled();
    });

    it('returns 0 on successful completion', async () => {
      mockText.mockResolvedValueOnce('v1');
      mockSelect.mockResolvedValueOnce('yes');
      mockConfirm.mockResolvedValueOnce(true);

      const exitCode = await initCommand({}, tempDir);

      expect(exitCode).toBe(0);
    });

    it('gracefully handles user cancellation', async () => {
      const cancelSymbol = Symbol.for('cancel');
      mockText.mockResolvedValueOnce(cancelSymbol);
      mockIsCancel.mockReturnValueOnce(true);

      const exitCode = await initCommand({}, tempDir);

      expect(exitCode).toBe(1);
    });

    it('gracefully handles cancellation during checks prompt', async () => {
      const cancelSymbol = Symbol.for('cancel');
      mockText.mockResolvedValueOnce('v1');
      mockSelect.mockResolvedValueOnce(cancelSymbol);
      mockIsCancel.mockReturnValueOnce(false).mockReturnValueOnce(true);

      const exitCode = await initCommand({}, tempDir);

      expect(exitCode).toBe(1);
    });

    it('gracefully handles cancellation during hook prompt', async () => {
      const cancelSymbol = Symbol.for('cancel');
      mockText.mockResolvedValueOnce('v1');
      mockSelect.mockResolvedValueOnce('yes');
      mockConfirm.mockResolvedValueOnce(cancelSymbol);
      mockIsCancel
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const exitCode = await initCommand({}, tempDir);

      expect(exitCode).toBe(1);
    });
  });

  describe('non-interactive mode (non-TTY)', () => {
    it('creates files silently without prompts when stdout is not TTY', async () => {
      mockIsInteractive.mockReturnValueOnce(false);

      const exitCode = await initCommand({}, tempDir);

      expect(exitCode).toBe(0);
      expect(mockText).not.toHaveBeenCalled();
      expect(
        fs.existsSync(path.join(tempDir, '.vector', 'config.yaml'))
      ).toBe(true);
    });
  });

  describe('error handling', () => {
    it('returns 1 on file system error', async () => {
      // Use a path that can't be created
      const invalidPath = '/root/vector-impossible-' + Date.now();

      const exitCode = await initCommand({ yes: true }, invalidPath);

      expect(exitCode).toBe(1);
    });

    it('logs error message on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      const invalidPath = '/root/vector-impossible-' + Date.now();

      await initCommand({ yes: true }, invalidPath);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[vector]')
      );

      consoleSpy.mockRestore();
    });
  });
});
