import { describe, it, expect } from 'vitest';
import {
  S,
  colors,
  truncate,
  pad,
  indent,
  separator,
  statusIcon,
  isInteractive,
} from '../theme';

describe('theme', () => {
  describe('S (symbols)', () => {
    it('exports S object with all expected keys', () => {
      const expectedKeys = [
        'start',
        'middle',
        'end',
        'step',
        'active',
        'prompt',
        'success',
        'failure',
        'skipped',
        'bar',
        'corner',
      ];
      expectedKeys.forEach((key) => {
        expect(S).toHaveProperty(key);
      });
    });

    it('each symbol is a non-empty string', () => {
      Object.values(S).forEach((symbol) => {
        expect(typeof symbol).toBe('string');
        expect(symbol.length).toBeGreaterThan(0);
      });
    });
  });

  describe('colors', () => {
    it('exports colors object with all expected functions', () => {
      const expectedKeys = [
        'success',
        'error',
        'warning',
        'info',
        'muted',
        'highlight',
        'brand',
      ];
      expectedKeys.forEach((key) => {
        expect(colors).toHaveProperty(key);
      });
    });

    it('each color function returns a string', () => {
      expect(typeof colors.success('test')).toBe('string');
      expect(typeof colors.error('test')).toBe('string');
      expect(typeof colors.warning('test')).toBe('string');
      expect(typeof colors.info('test')).toBe('string');
      expect(typeof colors.muted('test')).toBe('string');
      expect(typeof colors.highlight('test')).toBe('string');
      expect(typeof colors.brand('test')).toBe('string');
    });

    it('color functions preserve input text content', () => {
      // The output may have color codes but should contain the input text
      expect(colors.success('hello')).toContain('hello');
      expect(colors.error('world')).toContain('world');
    });
  });

  describe('truncate', () => {
    it('returns original string if shorter than maxLen', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('returns original string if equal to maxLen', () => {
      expect(truncate('hello', 5)).toBe('hello');
    });

    it('truncates with ellipsis if longer than maxLen', () => {
      const result = truncate('hello world', 8);
      expect(result.length).toBeLessThanOrEqual(8);
      expect(result).toContain('…');
    });

    it('handles empty string', () => {
      expect(truncate('', 10)).toBe('');
    });

    it('handles maxLen of 0', () => {
      const result = truncate('hello', 0);
      expect(typeof result).toBe('string');
    });

    it('handles maxLen of 1', () => {
      expect(truncate('hello', 1)).toBe('…');
    });

    it('adds ellipsis character with correct length', () => {
      const result = truncate('hello world', 5);
      // Should be 4 chars + ellipsis = 5 total
      expect(result.length).toBeLessThanOrEqual(5);
      expect(result).toContain('…');
    });
  });

  describe('pad', () => {
    it('pads string to specified length with spaces', () => {
      const result = pad('hello', 10);
      expect(result.length).toBe(10);
      expect(result.startsWith('hello')).toBe(true);
    });

    it('returns original if already at length', () => {
      expect(pad('hello', 5)).toBe('hello');
    });

    it('returns original if longer than target length', () => {
      expect(pad('hello', 3)).toBe('hello');
    });

    it('pads with custom character', () => {
      const result = pad('hello', 10, '-');
      expect(result.length).toBe(10);
      expect(result).toBe('hello-----');
    });

    it('handles empty string', () => {
      const result = pad('', 5);
      expect(result.length).toBe(5);
    });

    it('defaults to space padding', () => {
      const result = pad('hi', 5);
      expect(result).toBe('hi   ');
    });
  });

  describe('indent', () => {
    it('indents with default level of 1', () => {
      const result = indent('hello');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('indents with custom level', () => {
      const result = indent('hello', 2);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('indents multiline strings', () => {
      const result = indent('line1\nline2', 1);
      expect(result).toContain('line1');
      expect(result).toContain('line2');
    });

    it('handles empty string', () => {
      const result = indent('', 1);
      expect(typeof result).toBe('string');
    });

    it('level 0 returns original string', () => {
      const result = indent('hello', 0);
      expect(result).toBe('hello');
    });
  });

  describe('separator', () => {
    it('creates separator without label', () => {
      const result = separator();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('creates separator with label', () => {
      const result = separator('Status');
      expect(result).toContain('Status');
    });

    it('uses default width of 40', () => {
      const result = separator();
      expect(result.length).toBeLessThanOrEqual(50); // Some flexibility for color codes
    });

    it('creates separator with custom width', () => {
      const result = separator(undefined, 20);
      expect(result.length).toBeLessThanOrEqual(25); // Some flexibility
    });

    it('creates separator with label and custom width', () => {
      const result = separator('Test', 30);
      expect(result).toContain('Test');
    });

    it('includes bar character in output', () => {
      const result = separator();
      expect(result).toContain(S.bar);
    });
  });

  describe('statusIcon', () => {
    it('returns correct icon for passed status', () => {
      const result = statusIcon('passed');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain(S.success);
    });

    it('returns correct icon for failed status', () => {
      const result = statusIcon('failed');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain(S.failure);
    });

    it('returns correct icon for skipped status', () => {
      const result = statusIcon('skipped');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain(S.skipped);
    });

    it('returns correct icon for running status', () => {
      const result = statusIcon('running');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain(S.active);
    });

    it('status icons are colored', () => {
      const passed = statusIcon('passed');
      const failed = statusIcon('failed');
      // Different statuses should return different output
      expect(passed).not.toBe(failed);
    });
  });

  describe('isInteractive', () => {
    it('returns a boolean', () => {
      const result = isInteractive();
      expect(typeof result).toBe('boolean');
    });
  });
});
