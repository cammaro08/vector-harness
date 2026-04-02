import { describe, it, expect } from 'vitest';
import { parseArgs } from '../index';

describe('parseArgs', () => {
  it('parses "vector init" command', () => {
    const result = parseArgs(['node', 'vector', 'init']);
    expect(result.command).toBe('init');
    expect(result.positional).toEqual([]);
    expect(result.flags).toEqual({});
  });

  it('parses "vector run v2" command with vector name', () => {
    const result = parseArgs(['node', 'vector', 'run', 'v2']);
    expect(result.command).toBe('run');
    expect(result.positional).toEqual(['v2']);
    expect(result.flags).toEqual({});
  });

  it('parses "vector activate" with flags', () => {
    const result = parseArgs([
      'node',
      'vector',
      'activate',
      '--check',
      'test-pass',
      '--on',
      '--vector',
      'v2',
    ]);
    expect(result.command).toBe('activate');
    expect(result.flags).toEqual({
      check: 'test-pass',
      on: true,
      vector: 'v2',
    });
    expect(result.positional).toEqual([]);
  });

  it('parses "vector report" with format flag', () => {
    const result = parseArgs(['node', 'vector', 'report', '--format', 'json']);
    expect(result.command).toBe('report');
    expect(result.flags).toEqual({ format: 'json' });
  });

  it('parses "vector check add" with subcommand', () => {
    const result = parseArgs([
      'node',
      'vector',
      'check',
      'add',
      '--name',
      'lint',
      '--run',
      'npm run lint',
    ]);
    expect(result.command).toBe('check');
    expect(result.subcommand).toBe('add');
    expect(result.flags).toEqual({
      name: 'lint',
      run: 'npm run lint',
    });
  });

  it('handles boolean flags correctly', () => {
    const result = parseArgs([
      'node',
      'vector',
      'activate',
      '--off',
      '--check',
      'foo',
    ]);
    expect(result.flags.off).toBe(true);
    expect(result.flags.check).toBe('foo');
  });

  it('handles multiple positional arguments', () => {
    const result = parseArgs(['node', 'vector', 'some-command', 'arg1', 'arg2']);
    expect(result.command).toBe('some-command');
    expect(result.positional).toEqual(['arg1', 'arg2']);
  });

  it('handles mixed flags and positional arguments', () => {
    const result = parseArgs([
      'node',
      'vector',
      'run',
      'v1',
      '--verbose',
      '--extra-flag',
    ]);
    expect(result.command).toBe('run');
    expect(result.positional).toContain('v1');
    expect(result.flags.verbose).toBe(true);
  });

  it('parses flags with equals sign', () => {
    const result = parseArgs(['node', 'vector', 'report', '--format=json']);
    expect(result.command).toBe('report');
    // Both forms should be supported: --format json or --format=json
    expect(result.flags.format).toBe('json');
  });

  it('returns exit code 1 for unknown command when dispatching', () => {
    // This test will be for the main() function
    // parseArgs should not validate command existence
    const result = parseArgs(['node', 'vector', 'unknown-cmd']);
    expect(result.command).toBe('unknown-cmd');
  });
});
