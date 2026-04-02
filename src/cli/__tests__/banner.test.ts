/**
 * Tests for CLI banner display module
 *
 * Tests the BANNER constant and rendering functions for
 * consistent, styled output to terminal.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { BANNER, renderBanner, showBanner } from '../banner';

describe('banner', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('BANNER constant', () => {
    it('should be a non-empty string', () => {
      expect(typeof BANNER).toBe('string');
      expect(BANNER.length).toBeGreaterThan(0);
    });

    it('should contain block characters from ASCII art', () => {
      expect(BANNER).toMatch(/█/); // Should contain block characters
      expect(BANNER).toContain('██╗');
    });

    it('should be multi-line', () => {
      const lines = BANNER.split('\n');
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe('renderBanner()', () => {
    it('should return a string', () => {
      const result = renderBanner();
      expect(typeof result).toBe('string');
    });

    it('should include the ASCII art banner', () => {
      const result = renderBanner();
      expect(result).toContain('██╗');
    });

    it('should include the tagline', () => {
      const result = renderBanner();
      expect(result).toContain('Configurable enforcement checks for AI coding agents');
    });

    it('should include the version from package.json', () => {
      const result = renderBanner();
      // The version is 1.0.0 from package.json
      expect(result).toContain('1.0.0');
    });

    it('should return plain text when color: false', () => {
      const result = renderBanner({ color: false });
      // Plain text should not contain ANSI escape codes
      expect(result).not.toMatch(/\u001b\[/);
    });

    it('should not apply color when explicitly disabled', () => {
      const result = renderBanner({ color: false });
      const lines = result.split('\n');
      // Should have the banner, tagline, and version lines
      expect(lines.length).toBeGreaterThanOrEqual(8); // Banner + tagline + version + spacing
    });

    it('should include version in format when color: false', () => {
      const result = renderBanner({ color: false });
      // Version should be prefixed with 'v'
      expect(result).toContain('v1.0.0');
    });

    it('should apply color by default (when no options provided)', () => {
      const result = renderBanner();
      // Result should contain the core content
      expect(result).toContain('██╗');
      expect(result).toContain('Configurable enforcement checks for AI coding agents');
      expect(result).toContain('1.0.0');
    });

    it('should format with banner, tagline, and version', () => {
      const result = renderBanner({ color: false });
      // Should contain all three components
      expect(result).toContain('██╗');
      expect(result).toContain('Configurable enforcement checks for AI coding agents');
      expect(result).toContain('1.0.0');
    });
  });

  describe('showBanner()', () => {
    it('should call console.log with the rendered banner', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      showBanner();
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it('should log content containing the ASCII art banner', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      showBanner();
      const loggedContent = consoleSpy.mock.calls[0][0];
      expect(loggedContent).toContain('██╗');
      consoleSpy.mockRestore();
    });

    it('should respect the color option when logging', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      showBanner({ color: false });
      const loggedContent = consoleSpy.mock.calls[0][0];
      // Should not contain ANSI codes
      expect(loggedContent).not.toMatch(/\u001b\[/);
      consoleSpy.mockRestore();
    });

    it('should log the tagline and version', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      showBanner();
      const loggedContent = consoleSpy.mock.calls[0][0];
      // Should contain the content
      expect(loggedContent).toContain('Configurable enforcement checks for AI coding agents');
      expect(loggedContent).toContain('1.0.0');
      consoleSpy.mockRestore();
    });
  });
});
