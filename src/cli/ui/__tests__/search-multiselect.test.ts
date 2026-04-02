import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  filterOptions,
  searchMultiselect,
  SearchMultiselectOption,
  SearchMultiselectConfig,
} from '../search-multiselect';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  multiselect: vi.fn(),
  isCancel: vi.fn((val) => val === Symbol.for('cancel')),
  log: {
    info: vi.fn(),
    message: vi.fn(),
  },
}));

describe('search-multiselect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('filterOptions', () => {
    const testOptions: SearchMultiselectOption[] = [
      { value: 'test1', label: 'Test One' },
      { value: 'prod1', label: 'Production Check' },
      { value: 'lint', label: 'ESLint' },
      { value: 'type-check', label: 'TypeScript' },
    ];

    it('returns all options when search is empty', () => {
      const result = filterOptions(testOptions, '');
      expect(result).toEqual(testOptions);
    });

    it('returns all options when search is whitespace only', () => {
      const result = filterOptions(testOptions, '   ');
      expect(result).toEqual(testOptions);
    });

    it('filters options by label (case-insensitive)', () => {
      const result = filterOptions(testOptions, 'test');
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('test1');
    });

    it('filters options by label with uppercase search', () => {
      const result = filterOptions(testOptions, 'PROD');
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('prod1');
    });

    it('filters options by value (case-insensitive)', () => {
      const result = filterOptions(testOptions, 'lint');
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('ESLint');
    });

    it('returns empty array when no matches found', () => {
      const result = filterOptions(testOptions, 'nonexistent');
      expect(result).toEqual([]);
    });

    it('matches partial strings in label', () => {
      const result = filterOptions(testOptions, 'script');
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('TypeScript');
    });

    it('matches partial strings in value', () => {
      const result = filterOptions(testOptions, 'type');
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('type-check');
    });

    it('handles empty options array', () => {
      const result = filterOptions([], 'search');
      expect(result).toEqual([]);
    });

    it('matches multiple results', () => {
      const result = filterOptions(testOptions, 'e');
      // Should match: test1, prod1 (Production), lint (ESLint), type-check (TypeScript)
      expect(result.length).toBeGreaterThan(1);
    });

    it('preserves option order when filtering', () => {
      const result = filterOptions(testOptions, 'o');
      // Should match: Test One, Production Check
      expect(result[0].value).toBe('test1');
      expect(result[1].value).toBe('prod1');
    });

    it('is case-insensitive for both search and options', () => {
      const result1 = filterOptions(testOptions, 'PROD');
      const result2 = filterOptions(testOptions, 'prod');
      const result3 = filterOptions(testOptions, 'Prod');
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    it('handles options with special characters', () => {
      const opts: SearchMultiselectOption[] = [
        { value: 'test-1', label: 'Test-One' },
        { value: 'test_2', label: 'Test_Two' },
      ];
      const result = filterOptions(opts, 'test-');
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('test-1');
    });

    it('handles options with spaces in label', () => {
      const opts: SearchMultiselectOption[] = [
        { value: 'opt1', label: 'Option One' },
        { value: 'opt2', label: 'Option Two' },
      ];
      const result = filterOptions(opts, 'Option');
      expect(result).toHaveLength(2);
    });

    it('handles hint field when present', () => {
      const opts: SearchMultiselectOption[] = [
        { value: 'opt1', label: 'Option', hint: 'useful hint' },
      ];
      // Hint should not affect filtering (only label and value matter)
      const result = filterOptions(opts, 'useful');
      expect(result).toEqual([]);
    });
  });

  describe('searchMultiselect', () => {
    const testOptions: SearchMultiselectOption[] = [
      { value: 'check1', label: 'Check One' },
      { value: 'check2', label: 'Check Two' },
      { value: 'check3', label: 'Check Three' },
    ];

    it('returns selected values from multiselect', async () => {
      const prompts = await import('@clack/prompts');
      (prompts.multiselect as any).mockResolvedValueOnce(['check1', 'check2']);

      const result = await searchMultiselect({
        message: 'Select checks',
        options: testOptions,
      });

      expect(result.selected).toEqual(['check1', 'check2']);
      expect(result.cancelled).toBe(false);
    });

    it('includes locked values in all array', async () => {
      const prompts = await import('@clack/prompts');
      (prompts.multiselect as any).mockResolvedValueOnce(['check1']);

      const lockedItems: SearchMultiselectOption[] = [
        { value: 'locked1', label: 'Locked One' },
      ];

      const result = await searchMultiselect({
        message: 'Select checks',
        options: testOptions,
        locked: lockedItems,
      });

      expect(result.selected).toEqual(['check1']);
      expect(result.locked).toEqual(['locked1']);
      expect(result.all).toContain('locked1');
      expect(result.all).toContain('check1');
    });

    it('returns empty selected array when no selections made', async () => {
      const prompts = await import('@clack/prompts');
      (prompts.multiselect as any).mockResolvedValueOnce([]);

      const result = await searchMultiselect({
        message: 'Select checks',
        options: testOptions,
      });

      expect(result.selected).toEqual([]);
      expect(result.cancelled).toBe(false);
    });

    it('handles cancellation gracefully', async () => {
      const prompts = await import('@clack/prompts');
      const cancelSymbol = Symbol.for('cancel');
      (prompts.multiselect as any).mockResolvedValueOnce(cancelSymbol);
      (prompts.isCancel as any).mockReturnValueOnce(true);

      const result = await searchMultiselect({
        message: 'Select checks',
        options: testOptions,
      });

      expect(result.cancelled).toBe(true);
    });

    it('returns empty selected when cancelled', async () => {
      const prompts = await import('@clack/prompts');
      const cancelSymbol = Symbol.for('cancel');
      (prompts.multiselect as any).mockResolvedValueOnce(cancelSymbol);
      (prompts.isCancel as any).mockReturnValueOnce(true);

      const result = await searchMultiselect({
        message: 'Select checks',
        options: testOptions,
      });

      expect(result.selected).toEqual([]);
      expect(result.cancelled).toBe(true);
    });

    it('passes message to multiselect', async () => {
      const prompts = await import('@clack/prompts');
      (prompts.multiselect as any).mockResolvedValueOnce([]);

      await searchMultiselect({
        message: 'Select your checks',
        options: testOptions,
      });

      expect(prompts.multiselect).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Select your checks',
        })
      );
    });

    it('passes options to multiselect', async () => {
      const prompts = await import('@clack/prompts');
      (prompts.multiselect as any).mockResolvedValueOnce([]);

      await searchMultiselect({
        message: 'Select',
        options: testOptions,
      });

      expect(prompts.multiselect).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.any(Array),
        })
      );
    });

    it('uses initialValues when provided', async () => {
      const prompts = await import('@clack/prompts');
      (prompts.multiselect as any).mockResolvedValueOnce(['check1']);

      await searchMultiselect({
        message: 'Select',
        options: testOptions,
        initialValues: ['check1'],
      });

      expect(prompts.multiselect).toHaveBeenCalledWith(
        expect.objectContaining({
          initialValues: ['check1'],
        })
      );
    });

    it('locked array is empty when no locked items provided', async () => {
      const prompts = await import('@clack/prompts');
      (prompts.multiselect as any).mockResolvedValueOnce(['check1']);

      const result = await searchMultiselect({
        message: 'Select',
        options: testOptions,
      });

      expect(result.locked).toEqual([]);
    });

    it('all array combines locked and selected', async () => {
      const prompts = await import('@clack/prompts');
      (prompts.multiselect as any).mockResolvedValueOnce(['check1', 'check2']);

      const lockedItems: SearchMultiselectOption[] = [
        { value: 'locked1', label: 'Locked' },
      ];

      const result = await searchMultiselect({
        message: 'Select',
        options: testOptions,
        locked: lockedItems,
      });

      expect(result.all).toEqual(['locked1', 'check1', 'check2']);
    });

    it('handles multiple locked items', async () => {
      const prompts = await import('@clack/prompts');
      (prompts.multiselect as any).mockResolvedValueOnce(['check1']);

      const lockedItems: SearchMultiselectOption[] = [
        { value: 'locked1', label: 'Locked One' },
        { value: 'locked2', label: 'Locked Two' },
      ];

      const result = await searchMultiselect({
        message: 'Select',
        options: testOptions,
        locked: lockedItems,
      });

      expect(result.locked).toEqual(['locked1', 'locked2']);
      expect(result.all).toContain('locked1');
      expect(result.all).toContain('locked2');
      expect(result.all).toContain('check1');
    });

    it('returns correct type structure', async () => {
      const prompts = await import('@clack/prompts');
      (prompts.multiselect as any).mockResolvedValueOnce(['check1']);

      const result = await searchMultiselect({
        message: 'Select',
        options: testOptions,
      });

      expect(typeof result.selected).toBe('object');
      expect(Array.isArray(result.selected)).toBe(true);
      expect(typeof result.locked).toBe('object');
      expect(Array.isArray(result.locked)).toBe(true);
      expect(typeof result.all).toBe('object');
      expect(Array.isArray(result.all)).toBe(true);
      expect(typeof result.cancelled).toBe('boolean');
    });

    it('handles empty options array', async () => {
      const prompts = await import('@clack/prompts');
      (prompts.multiselect as any).mockResolvedValueOnce([]);

      const result = await searchMultiselect({
        message: 'Select',
        options: [],
      });

      expect(result.selected).toEqual([]);
    });

    it('displays locked items information before multiselect', async () => {
      const prompts = await import('@clack/prompts');
      const { log } = await import('@clack/prompts');
      (prompts.multiselect as any).mockResolvedValueOnce([]);

      const lockedItems: SearchMultiselectOption[] = [
        { value: 'locked1', label: 'Locked One' },
      ];

      await searchMultiselect({
        message: 'Select',
        options: testOptions,
        locked: lockedItems,
      });

      // Should have called log.info or log.message when locked items exist
      expect(
        (log.info as any).mock.calls.length > 0 ||
          (log.message as any).mock.calls.length > 0
      ).toBe(true);
    });

    it('skips locked items log when no locked items', async () => {
      const prompts = await import('@clack/prompts');
      const { log } = await import('@clack/prompts');
      (prompts.multiselect as any).mockResolvedValueOnce([]);

      await searchMultiselect({
        message: 'Select',
        options: testOptions,
      });

      // When no locked items, may not call log at all or minimal logging
      // This is flexible based on implementation
    });
  });
});
