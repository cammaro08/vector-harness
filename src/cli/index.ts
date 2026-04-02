/**
 * Vector CLI Entry Point
 *
 * Provides argument parser and main() dispatch function.
 */

import * as path from 'path';
import { initCommand } from './commands/init';
import { runCommand } from './commands/run';
import { activateCommand } from './commands/activate';
import { reportCommand } from './commands/report';
import { checkAddCommand } from './commands/check-add';

export interface ParsedArgs {
  command: string; // 'init' | 'run' | 'activate' | 'report' | 'check'
  subcommand?: string; // e.g., 'add' for 'vector check add'
  positional: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Parse command line arguments.
 *
 * Returns a ParsedArgs object with:
 * - command: the first argument after 'vector' (or 'node', 'ts-node')
 * - subcommand: optional second command (e.g., 'add' in 'check add')
 * - positional: remaining non-flag arguments
 * - flags: key-value pairs for --flag and --flag=value forms
 *
 * @param argv process.argv style array
 * @returns ParsedArgs object
 */
export function parseArgs(argv: string[]): ParsedArgs {
  // Skip first two elements (node/ts-node and script path)
  const args = argv.slice(2);

  if (args.length === 0) {
    return {
      command: '',
      positional: [],
      flags: {},
    };
  }

  const command = args[0];
  let subcommand: string | undefined;
  let startIndex = 1;

  // Check if next arg is a subcommand (doesn't start with --)
  if (args.length > 1 && !args[1].startsWith('--')) {
    // Check if this could be a vector name (v1-v5) vs a subcommand
    // For 'check add', 'add' is a subcommand
    // For 'run v2', 'v2' is a positional
    // We'll treat it as subcommand if command is 'check'
    if (command === 'check') {
      subcommand = args[1];
      startIndex = 2;
    }
  }

  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  // Process remaining arguments
  for (let i = startIndex; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      // Handle flags
      const withoutDashes = arg.substring(2);

      if (withoutDashes.includes('=')) {
        // --flag=value form
        const [key, value] = withoutDashes.split('=', 2);
        flags[key] = value;
      } else {
        // --flag form (boolean or next arg is value)
        const nextArg = args[i + 1];

        // Check if next arg is available and looks like a value (not a flag)
        if (nextArg && !nextArg.startsWith('--')) {
          // This is a flag with a value
          flags[withoutDashes] = nextArg;
          i++; // Skip next arg
        } else {
          // This is a boolean flag
          flags[withoutDashes] = true;
        }
      }
    } else {
      // Positional argument
      positional.push(arg);
    }
  }

  return {
    command,
    subcommand,
    positional,
    flags,
  };
}

/**
 * Main CLI entry point.
 *
 * Parses arguments and dispatches to appropriate command handler.
 * Returns exit code (0 for success, 1 for failure).
 *
 * @param argv optional process.argv (defaults to actual process.argv)
 * @returns exit code
 */
export async function main(argv?: string[]): Promise<number> {
  const args = argv || process.argv;
  const projectRoot = process.cwd();

  const parsed = parseArgs(args);

  // Check for empty command
  if (!parsed.command) {
    console.error('[vector]: no command specified');
    console.error('Usage: vector <command> [options]');
    console.error('Commands: init, run, activate, report, check');
    console.error('Run "vector <command> --help" for more information.');
    return 1;
  }

  try {
    switch (parsed.command) {
      case 'init':
        return await initCommand(projectRoot);

      case 'run': {
        if (parsed.positional.length === 0) {
          console.error('[vector] run: missing vector name');
          console.error('Usage: vector run <vector-name>');
          return 1;
        }
        const vectorName = parsed.positional[0];
        return await runCommand(vectorName, projectRoot);
      }

      case 'activate':
        return await activateCommand(parsed.flags, projectRoot);

      case 'report':
        return await reportCommand(parsed.flags, projectRoot);

      case 'check': {
        if (parsed.subcommand === 'add') {
          return await checkAddCommand(parsed.flags, projectRoot);
        }
        console.error(`[vector] check: unknown subcommand '${parsed.subcommand}'`);
        console.error('Usage: vector check add --name <name> --run <command>');
        return 1;
      }

      default:
        console.error(`[vector]: unknown command '${parsed.command}'`);
        console.error(
          'Usage: vector <init|run|activate|report|check> [options]'
        );
        return 1;
    }
  } catch (error) {
    console.error(`[vector]: ${(error as Error).message}`);
    return 1;
  }
}
