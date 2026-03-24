import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateDocs, DocValidatorOptions, DocValidationResult } from '../docValidator';
import * as fsPromises from 'fs/promises';

vi.mock('fs/promises');

describe('docValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateDocs', () => {
    it('returns passes:true when docs/PROGRESS_LOG.md exists and docs/ has .md files', async () => {
      const mockAccess = vi.spyOn(fsPromises, 'access');
      const mockReaddir = vi.spyOn(fsPromises, 'readdir');

      // Mock successful access for PROGRESS_LOG.md
      mockAccess.mockResolvedValueOnce(undefined);
      // Mock readdir to return .md files
      mockReaddir.mockResolvedValueOnce(['README.md', 'SETUP.md'] as any);

      const result = await validateDocs({
        cwd: '/test'
      });

      expect(result.passes).toBe(true);
      expect(result.hasProgressLog).toBe(true);
      expect(result.hasDocs).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('returns passes:false with missing:[docs/PROGRESS_LOG.md] when file absent', async () => {
      const mockAccess = vi.spyOn(fsPromises, 'access');
      const mockReaddir = vi.spyOn(fsPromises, 'readdir');

      // Mock ENOENT for PROGRESS_LOG.md
      mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
      // Mock readdir to return .md files
      mockReaddir.mockResolvedValueOnce(['README.md'] as any);

      const result = await validateDocs({
        cwd: '/test'
      });

      expect(result.passes).toBe(false);
      expect(result.missing).toContain('docs/PROGRESS_LOG.md');
    });

    it('returns hasProgressLog:false when PROGRESS_LOG.md missing', async () => {
      const mockAccess = vi.spyOn(fsPromises, 'access');
      const mockReaddir = vi.spyOn(fsPromises, 'readdir');

      // Mock ENOENT for PROGRESS_LOG.md
      mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
      // Mock readdir to return .md files
      mockReaddir.mockResolvedValueOnce(['README.md'] as any);

      const result = await validateDocs({
        cwd: '/test'
      });

      expect(result.hasProgressLog).toBe(false);
    });

    it('returns hasDocs:false when docs/ has no .md files', async () => {
      const mockAccess = vi.spyOn(fsPromises, 'access');
      const mockReaddir = vi.spyOn(fsPromises, 'readdir');

      // Mock successful access for PROGRESS_LOG.md
      mockAccess.mockResolvedValueOnce(undefined);
      // Mock readdir to return no .md files
      mockReaddir.mockResolvedValueOnce(['notes.txt', 'data.json'] as any);

      const result = await validateDocs({
        cwd: '/test'
      });

      expect(result.hasDocs).toBe(false);
      expect(result.passes).toBe(false);
    });

    it('returns hasDocs:false when docs/ directory does not exist', async () => {
      const mockAccess = vi.spyOn(fsPromises, 'access');
      const mockReaddir = vi.spyOn(fsPromises, 'readdir');

      // Mock successful access for PROGRESS_LOG.md
      mockAccess.mockResolvedValueOnce(undefined);
      // Mock readdir to throw for non-existent docs/
      mockReaddir.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await validateDocs({
        cwd: '/test'
      });

      expect(result.hasDocs).toBe(false);
      expect(result.passes).toBe(false);
    });

    it('validates additional requiredFiles when specified', async () => {
      const mockAccess = vi.spyOn(fsPromises, 'access');
      const mockReaddir = vi.spyOn(fsPromises, 'readdir');

      // Mock successful access for PROGRESS_LOG.md and custom files
      mockAccess
        .mockResolvedValueOnce(undefined) // PROGRESS_LOG.md
        .mockResolvedValueOnce(undefined); // custom file
      // Mock readdir to return .md files
      mockReaddir.mockResolvedValueOnce(['README.md'] as any);

      const result = await validateDocs({
        cwd: '/test',
        requiredFiles: ['docs/CUSTOM.md']
      });

      expect(result.passes).toBe(true);
      expect(mockAccess).toHaveBeenCalledWith('/test/docs/CUSTOM.md', expect.any(Number));
    });

    it('returns passes:false when additional requiredFiles are missing', async () => {
      const mockAccess = vi.spyOn(fsPromises, 'access');
      const mockReaddir = vi.spyOn(fsPromises, 'readdir');

      // Mock successful access for PROGRESS_LOG.md but fail for custom file
      mockAccess
        .mockResolvedValueOnce(undefined) // PROGRESS_LOG.md
        .mockRejectedValueOnce(new Error('ENOENT')); // custom file
      // Mock readdir to return .md files
      mockReaddir.mockResolvedValueOnce(['README.md'] as any);

      const result = await validateDocs({
        cwd: '/test',
        requiredFiles: ['docs/CUSTOM.md']
      });

      expect(result.passes).toBe(false);
      expect(result.missing).toContain('docs/CUSTOM.md');
    });

    it('requireProgressLog:false skips progress log check', async () => {
      const mockAccess = vi.spyOn(fsPromises, 'access');
      const mockReaddir = vi.spyOn(fsPromises, 'readdir');

      // Don't set up any access mock for PROGRESS_LOG.md - it shouldn't be called
      // Mock readdir to return .md files
      mockReaddir.mockResolvedValueOnce(['README.md'] as any);

      const result = await validateDocs({
        cwd: '/test',
        requireProgressLog: false
      });

      expect(result.passes).toBe(true);
      // When not required, PROGRESS_LOG.md is not checked but hasDocs passes
    });

    it('returns correct checked[] list of paths that were verified', async () => {
      const mockAccess = vi.spyOn(fsPromises, 'access');
      const mockReaddir = vi.spyOn(fsPromises, 'readdir');

      // Mock successful access for PROGRESS_LOG.md and custom file
      mockAccess
        .mockResolvedValueOnce(undefined) // PROGRESS_LOG.md
        .mockResolvedValueOnce(undefined); // custom file
      // Mock readdir to return .md files
      mockReaddir.mockResolvedValueOnce(['README.md'] as any);

      const result = await validateDocs({
        cwd: '/test',
        requiredFiles: ['docs/CUSTOM.md']
      });

      expect(result.checked).toContain('/test/docs/PROGRESS_LOG.md');
      expect(result.checked).toContain('/test/docs/CUSTOM.md');
      expect(result.checked).toContain('/test/docs');
    });

    it('handles non-existent docs/ directory gracefully without throwing', async () => {
      const mockAccess = vi.spyOn(fsPromises, 'access');
      const mockReaddir = vi.spyOn(fsPromises, 'readdir');

      // Mock successful access for PROGRESS_LOG.md
      mockAccess.mockResolvedValueOnce(undefined);
      // Mock readdir to throw for non-existent docs/
      mockReaddir.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await validateDocs({
        cwd: '/test'
      });

      expect(result).toBeDefined();
      expect(result.passes).toBe(false);
      // Should not throw
    });

    it('correctly identifies .md files in docs/ directory', async () => {
      const mockAccess = vi.spyOn(fsPromises, 'access');
      const mockReaddir = vi.spyOn(fsPromises, 'readdir');

      // Mock successful access for PROGRESS_LOG.md
      mockAccess.mockResolvedValueOnce(undefined);
      // Mock readdir with mixed file types
      mockReaddir.mockResolvedValueOnce([
        'README.md',
        'SETUP.md',
        'notes.txt',
        'data.json',
        'API.md'
      ] as any);

      const result = await validateDocs({
        cwd: '/test'
      });

      expect(result.hasDocs).toBe(true);
      expect(result.passes).toBe(true);
    });

    it('uses default requireProgressLog:true when not specified', async () => {
      const mockAccess = vi.spyOn(fsPromises, 'access');
      const mockReaddir = vi.spyOn(fsPromises, 'readdir');

      // Mock ENOENT for PROGRESS_LOG.md
      mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
      // Mock readdir to return .md files
      mockReaddir.mockResolvedValueOnce(['README.md'] as any);

      const result = await validateDocs({
        cwd: '/test'
        // requireProgressLog not specified, should default to true
      });

      expect(result.passes).toBe(false);
      expect(result.missing).toContain('docs/PROGRESS_LOG.md');
    });
  });
});
